"""Train a baseline pressure forecasting model on the WDN1 benchmark dataset."""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
from sklearn.model_selection import train_test_split

FLOW_NODES: Sequence[int] = tuple(range(2, 10))
PRESSURE_NODES: Sequence[int] = tuple(range(2, 10))
VOLUME_NODES: Sequence[int] = tuple(range(2, 10))
# Coordinates are provided for the meter node (N2) and junction/leak nodes (N7-N14).
COORD_NODES: Sequence[int] = (2, 7, 8, 9, 10, 11, 12, 13)
LEAK_NODES: Sequence[int] = tuple(range(10, 15))


@dataclass(frozen=True)
class TrainingConfig:
    data_root: Path
    model_out: Path
    file_pattern: str = "data_*.csv"
    horizon: int = 1
    test_size: float = 0.2
    random_state: int = 42


def build_column_names() -> list[str]:
    names: list[str] = ["time_s"]
    names += [f"flow_n{node}" for node in FLOW_NODES]
    names += [f"pressure_n{node}" for node in PRESSURE_NODES]
    names += [f"volume_n{node}" for node in VOLUME_NODES]

    axis_labels = ("x", "y", "z")
    for axis in axis_labels:
        names += [f"coord_{axis}_n{node}" for node in COORD_NODES]

    names += [f"leak_present_n{node}" for node in LEAK_NODES]
    names += [f"leak_coord_{axis}" for axis in axis_labels]
    names.append("weekday_flag")
    return names


COLUMN_NAMES: list[str] = build_column_names()
FEATURE_COLS: list[str] = (
    ["time_s", "weekday_flag"]
    + [f"flow_n{node}" for node in FLOW_NODES]
    + [f"pressure_n{node}" for node in PRESSURE_NODES]
    + [f"volume_n{node}" for node in VOLUME_NODES]
)
TARGET_COLS: list[str] = [f"pressure_n{node}" for node in PRESSURE_NODES]


def find_data_files(config: TrainingConfig) -> list[Path]:
    files = sorted(config.data_root.glob(config.file_pattern))
    if not files:
        raise FileNotFoundError(
            f"No CSV files matching '{config.file_pattern}' found in {config.data_root}"
        )
    return files


def load_dataset(files: Iterable[Path]) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for file_path in files:
        frame = pd.read_csv(file_path, header=None, names=COLUMN_NAMES)
        frame.insert(0, "scenario_id", file_path.stem)
        frames.append(frame)
    dataset = pd.concat(frames, ignore_index=True)
    dataset.sort_values(["scenario_id", "time_s"], inplace=True)
    dataset.reset_index(drop=True, inplace=True)
    return dataset


def make_supervised_pairs(
    dataset: pd.DataFrame,
    horizon: int,
    feature_cols: Sequence[str],
    target_cols: Sequence[str],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    grouped = dataset.groupby("scenario_id", sort=False)
    future_targets = grouped[target_cols].shift(-horizon)
    supervised = dataset.join(future_targets.add_suffix("_future"))

    target_future_cols = [f"{col}_future" for col in target_cols]
    valid_rows = supervised[target_future_cols].notna().all(axis=1)
    if not valid_rows.any():
        raise ValueError(
            "Not enough rows to create supervised samples. "
            "Consider reducing the forecast horizon."
        )

    features = supervised.loc[valid_rows, feature_cols].copy()
    targets = supervised.loc[valid_rows, target_future_cols].copy()
    targets.columns = target_cols
    return features, targets


def train_model(
    features: pd.DataFrame,
    targets: pd.DataFrame,
    random_state: int,
) -> RandomForestRegressor:
    model = RandomForestRegressor(
        n_estimators=500,
        max_depth=None,
        n_jobs=-1,
        random_state=random_state,
    )
    model.fit(features, targets)
    return model


def evaluate_model(
    model: RandomForestRegressor,
    features: pd.DataFrame,
    targets: pd.DataFrame,
    target_cols: Sequence[str],
) -> dict[str, float]:
    predictions = model.predict(features)
    rmse_per_target = np.sqrt(
        mean_squared_error(targets, predictions, multioutput="raw_values")
    )
    return {col: float(rmse) for col, rmse in zip(target_cols, rmse_per_target)}


def persist_artifacts(
    model: RandomForestRegressor,
    metrics: dict[str, float],
    features: Sequence[str],
    targets: Sequence[str],
    config: TrainingConfig,
    training_files: Sequence[Path],
) -> None:
    config.model_out.mkdir(parents=True, exist_ok=True)
    model_path = config.model_out / "pressure_forecast_model.joblib"
    metadata_path = config.model_out / "pressure_forecast_metadata.json"

    joblib.dump(model, model_path)

    metadata = {
        "feature_columns": list(features),
        "target_columns": list(targets),
        "forecast_horizon_steps": config.horizon,
        "training_files": [str(path) for path in training_files],
        "metrics_rmse": metrics,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2))


def parse_args() -> TrainingConfig:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path("WDN1") / "csv-dist-orig",
        help="Directory containing the WDN1 CSV scenario files.",
    )
    parser.add_argument(
        "--model-out",
        type=Path,
        default=Path("ml") / "artifacts",
        help="Directory where the trained model and metadata will be stored.",
    )
    parser.add_argument(
        "--file-pattern",
        type=str,
        default="data_*.csv",
        help="Glob pattern to select scenario files inside data-root.",
    )
    parser.add_argument(
        "--horizon",
        type=int,
        default=1,
        help="Number of rows ahead to forecast. Each row equals 600 seconds.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fraction of samples reserved for evaluation.",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed used for train/validation split and model training.",
    )
    args = parser.parse_args()

    return TrainingConfig(
        data_root=args.data_root,
        model_out=args.model_out,
        file_pattern=args.file_pattern,
        horizon=args.horizon,
        test_size=args.test_size,
        random_state=args.random_state,
    )


def main() -> None:
    config = parse_args()
    data_files = find_data_files(config)
    dataset = load_dataset(data_files)

    features, targets = make_supervised_pairs(
        dataset,
        config.horizon,
        FEATURE_COLS,
        TARGET_COLS,
    )

    X_train, X_test, y_train, y_test = train_test_split(
        features,
        targets,
        test_size=config.test_size,
        random_state=config.random_state,
    )

    model = train_model(X_train, y_train, config.random_state)
    metrics = evaluate_model(model, X_test, y_test, TARGET_COLS)

    print("RMSE per node (meters of H2O):")
    for node, rmse in metrics.items():
        print(f"  {node}: {rmse:.3f}")

    persist_artifacts(
        model,
        metrics,
        FEATURE_COLS,
        TARGET_COLS,
        config,
        data_files,
    )


if __name__ == "__main__":
    main()
