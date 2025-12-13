"""Model training helpers for leak detection, localization, and coordinate regression."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    classification_report,
    f1_score,
    mean_absolute_error,
    r2_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.multioutput import MultiOutputRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .columns import ColumnSchema, build_column_schema
from .data_loading import DatasetVariant, load_distance_matrix, load_wdn_dataset
from .feature_engineering import engineer_features


@dataclass
class ModelResult:
    model: object
    feature_columns: List[str]
    metrics: Dict[str, float]
    report: Optional[Dict[str, Dict[str, float]]] = None
    baseline_metrics: Optional[Dict[str, float]] = None


def _select_feature_columns(frame: pd.DataFrame, schema: ColumnSchema) -> List[str]:
    exclude = set(
        ["scenario_index", "scenario_id", "scenario_step", "source_file"]
        + schema.leak_flags
        + schema.leak_coordinates
    )
    return [col for col in frame.columns if col not in exclude]


def _split_data(
    X: pd.DataFrame,
    y: pd.Series | pd.DataFrame,
    groups: pd.Series,
    test_size: float,
    random_state: int,
    stratify=None,
    split_strategy: str = "random",
):
    if split_strategy == "scenario":
        splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
        train_idx, test_idx = next(splitter.split(X, y, groups))
        return X.iloc[train_idx], X.iloc[test_idx], y.iloc[train_idx], y.iloc[test_idx]
    return train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )


def train_leak_detection_model(
    feature_frame: pd.DataFrame,
    random_state: int = 42,
    test_size: float = 0.2,
    split_strategy: str = "random",
) -> ModelResult:
    """Train a binary classifier that predicts whether any leak is active."""

    schema = build_column_schema()
    features = feature_frame.copy()
    target = (features[schema.leak_flags].sum(axis=1) > 0).astype(int)
    feature_cols = _select_feature_columns(features, schema)
    X = features[feature_cols]
    groups = features["scenario_id"]
    X_train, X_test, y_train, y_test = _split_data(
        X,
        target,
        groups,
        test_size=test_size,
        random_state=random_state,
        stratify=target if split_strategy == "random" else None,
        split_strategy=split_strategy,
    )
    model = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("gb", GradientBoostingClassifier(random_state=random_state)),
        ]
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    report = classification_report(y_test, y_pred, output_dict=True)
    try:
        roc_auc = roc_auc_score(y_test, y_prob)
    except ValueError:
        roc_auc = float("nan")
    metrics = {
        "f1_weighted": f1_score(y_test, y_pred, average="weighted"),
        "f1_binary": f1_score(y_test, y_pred),
        "roc_auc": float(roc_auc),
        "support_test": float(len(y_test)),
    }
    majority_class = int(pd.Series(y_train).mode()[0])
    baseline_pred = np.full(len(y_test), fill_value=majority_class)
    baseline_metrics = {
        "f1_weighted": f1_score(y_test, baseline_pred, average="weighted"),
        "f1_binary": f1_score(y_test, baseline_pred),
    }
    return ModelResult(
        model=model,
        feature_columns=feature_cols,
        metrics=metrics,
        report=report,
        baseline_metrics=baseline_metrics,
    )


def train_leak_localization_model(
    feature_frame: pd.DataFrame,
    random_state: int = 42,
    test_size: float = 0.2,
    split_strategy: str = "random",
) -> ModelResult:
    """Train a multi-class classifier that predicts the leak node (10-14)."""

    schema = build_column_schema()
    features = feature_frame.copy()
    leak_flags = features[schema.leak_flags]
    leak_mask = leak_flags.sum(axis=1) > 0
    if not leak_mask.any():
        raise ValueError("No leak events found in the dataset; cannot train localization model")
    target = leak_flags[leak_mask].idxmax(axis=1).str.replace("leak_node_", "").astype(int)
    features = features.loc[leak_mask]
    feature_cols = _select_feature_columns(features, schema)
    X = features[feature_cols]
    groups = features["scenario_id"]
    X_train, X_test, y_train, y_test = _split_data(
        X,
        target,
        groups,
        test_size=test_size,
        random_state=random_state,
        stratify=target if split_strategy == "random" else None,
        split_strategy=split_strategy,
    )
    model = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("rf", RandomForestClassifier(random_state=random_state, n_estimators=400)),
        ]
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    report = classification_report(y_test, y_pred, output_dict=True)
    metrics = {
        "f1_weighted": f1_score(y_test, y_pred, average="weighted"),
        "f1_macro": f1_score(y_test, y_pred, average="macro"),
        "support_test": float(len(y_test)),
    }
    majority_class = int(pd.Series(y_train).mode()[0])
    baseline_pred = np.full(len(y_test), fill_value=majority_class)
    baseline_metrics = {
        "f1_weighted": f1_score(y_test, baseline_pred, average="weighted"),
        "f1_macro": f1_score(y_test, baseline_pred, average="macro"),
    }
    return ModelResult(
        model=model,
        feature_columns=feature_cols,
        metrics=metrics,
        report=report,
        baseline_metrics=baseline_metrics,
    )


def train_leak_coordinate_regressor(
    feature_frame: pd.DataFrame,
    random_state: int = 42,
    test_size: float = 0.2,
    split_strategy: str = "random",
) -> ModelResult:
    """Train a regressor that predicts leak coordinates (x, y, z)."""

    schema = build_column_schema()
    features = feature_frame.copy()
    leak_flags = features[schema.leak_flags]
    leak_mask = leak_flags.sum(axis=1) > 0
    if not leak_mask.any():
        raise ValueError("No leak events found in the dataset; cannot train regression model")
    targets = features.loc[leak_mask, schema.leak_coordinates]
    features = features.loc[leak_mask]
    feature_cols = _select_feature_columns(features, schema)
    X = features[feature_cols]
    groups = features["scenario_id"]
    X_train, X_test, y_train, y_test = _split_data(
        X,
        targets,
        groups,
        test_size=test_size,
        random_state=random_state,
        split_strategy=split_strategy,
    )
    base_estimator = RandomForestRegressor(random_state=random_state, n_estimators=400)
    model = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("rf", MultiOutputRegressor(base_estimator)),
        ]
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    metrics = {
        "mae": float(mae),
        "r2": float(r2),
        "support_test": float(len(y_test)),
    }
    baseline_pred = np.tile(y_train.mean(axis=0).to_numpy(), (len(y_test), 1))
    baseline_metrics = {
        "mae": float(mean_absolute_error(y_test, baseline_pred)),
        "r2": float(r2_score(y_test, baseline_pred)),
    }
    return ModelResult(
        model=model,
        feature_columns=feature_cols,
        metrics=metrics,
        baseline_metrics=baseline_metrics,
    )


def run_full_training(
    dataset_root: Path | str,
    variant: DatasetVariant = "orig",
    random_state: int = 42,
    test_size: float = 0.2,
    split_strategy: str = "random",
) -> Dict[str, ModelResult]:
    """Execute end-to-end training for the three leak modeling tasks."""

    raw = load_wdn_dataset(dataset_root, variant=variant)
    distance = load_distance_matrix(dataset_root)
    features = engineer_features(raw, distance_matrix=distance)

    detection_result = train_leak_detection_model(
        features,
        random_state=random_state,
        test_size=test_size,
        split_strategy=split_strategy,
    )
    localization_result = train_leak_localization_model(
        features,
        random_state=random_state,
        test_size=test_size,
        split_strategy=split_strategy,
    )
    regression_result = train_leak_coordinate_regressor(
        features,
        random_state=random_state,
        test_size=test_size,
        split_strategy=split_strategy,
    )
    return {
        "detection": detection_result,
        "localization": localization_result,
        "coordinate_regression": regression_result,
    }


def cli():
    """Simple CLI entry point for manual experimentation."""

    import argparse

    parser = argparse.ArgumentParser(description="Train leak models on the WDN1 dataset")
    parser.add_argument(
        "dataset_root",
        type=Path,
        help="Path to the WDN1 directory containing the csv-dist-* folders",
    )
    parser.add_argument(
        "--variant",
        choices=["orig", "x100"],
        default="orig",
        help="Dataset variant to use",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fraction of data reserved for evaluation",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed for reproducibility",
    )
    parser.add_argument(
        "--split-strategy",
        choices=["random", "scenario"],
        default="random",
        help="Whether to split randomly or hold out entire scenarios",
    )
    args = parser.parse_args()

    results = run_full_training(
        dataset_root=args.dataset_root,
        variant=args.variant,
        random_state=args.random_state,
        test_size=args.test_size,
        split_strategy=args.split_strategy,
    )
    for name, result in results.items():
        print(f"\n=== {name.upper()} ===")
        for metric_name, value in result.metrics.items():
            print(f"{metric_name}: {value:.4f}")
        if result.baseline_metrics:
            print("-- Baseline --")
            for metric_name, value in result.baseline_metrics.items():
                print(f"{metric_name}: {value:.4f}")


if __name__ == "__main__":
    cli()
