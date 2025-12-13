"""Data loading utilities for the WDN1 leak detection dataset."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd

from .columns import ColumnSchema, FLOW_NODE_IDS, build_column_schema

DatasetVariant = Literal["orig", "x100"]

_VARIANT_DIR = {
    "orig": "csv-dist-orig",
    "x100": "csv-dist-x100",
}


def load_wdn_dataset(dataset_root: Path | str, variant: DatasetVariant = "orig") -> pd.DataFrame:
    """Load and concatenate all scenario CSV files for a given variant.

    Parameters
    ----------
    dataset_root:
        Base directory containing the WDN1 assets (e.g. ``WDN1``).
    variant:
        Either ``"orig"`` for the deterministic runs or ``"x100"`` for the
        perturbed version with injected noise.

    Returns
    -------
    pandas.DataFrame
        Combined dataset indexed by scenario and time step with the raw columns
        named according to :mod:`ml.leak_modeling.columns`.
    """

    schema: ColumnSchema = build_column_schema()
    root_path = Path(dataset_root)
    variant_dir = root_path / _VARIANT_DIR[variant]
    if not variant_dir.exists():
        raise FileNotFoundError(f"Variant directory not found: {variant_dir}")

    csv_files = sorted(variant_dir.glob("data_*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in {variant_dir}")

    frames = []
    for file_index, csv_path in enumerate(csv_files):
        frame = pd.read_csv(csv_path, header=None, names=schema.all_columns)
        scenario_id = int(csv_path.stem.split("_")[1])
        frame.insert(0, "scenario_step", np.arange(len(frame), dtype=int))
        frame.insert(0, "scenario_id", scenario_id)
        frame.insert(0, "scenario_index", file_index)
        frame["source_file"] = csv_path.name
        frames.append(frame)

    combined = pd.concat(frames, ignore_index=True)
    numeric_cols = [
        schema.time,
        *schema.flow,
        *schema.pressure,
        *schema.volume,
        *schema.coord_x,
        *schema.coord_y,
        *schema.coord_z,
        *schema.leak_flags,
        *schema.leak_coordinates,
        schema.weekday_flag,
    ]
    combined[numeric_cols] = combined[numeric_cols].apply(pd.to_numeric, errors="coerce")
    combined["scenario_id"] = combined["scenario_id"].astype(int)
    return combined


def load_distance_matrix(dataset_root: Path | str) -> pd.DataFrame:
    """Load the node distance matrix used to describe the network topology."""

    root_path = Path(dataset_root)
    csv_path = root_path / "Distane.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"Distance matrix not found at {csv_path}")
    matrix = pd.read_csv(csv_path, header=None)
    matrix.index = pd.Index(FLOW_NODE_IDS, name="from_node")
    matrix.columns = [f"node_{node}" for node in FLOW_NODE_IDS]
    return matrix
