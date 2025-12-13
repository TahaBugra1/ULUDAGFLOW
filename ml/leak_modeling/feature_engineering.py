"""Feature engineering routines for WDN1 leak modeling."""

from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd

from .columns import ColumnSchema, FLOW_NODE_IDS, build_column_schema


def _add_statistical_aggregates(frame: pd.DataFrame, schema: ColumnSchema) -> pd.DataFrame:
    aggregates = {}
    for group_name, cols in {
        "flow": schema.flow,
        "pressure": schema.pressure,
        "volume": schema.volume,
    }.items():
        subset = frame[cols]
        aggregates[f"{group_name}_sum"] = subset.sum(axis=1)
        aggregates[f"{group_name}_mean"] = subset.mean(axis=1)
        aggregates[f"{group_name}_std"] = subset.std(axis=1)
        aggregates[f"{group_name}_min"] = subset.min(axis=1)
        aggregates[f"{group_name}_max"] = subset.max(axis=1)
        range_name = f"{group_name}_range"
        aggregates[range_name] = aggregates[f"{group_name}_max"] - aggregates[f"{group_name}_min"]
    return frame.assign(**aggregates)


def _add_relative_measures(frame: pd.DataFrame, schema: ColumnSchema) -> pd.DataFrame:
    augmented = frame.copy()
    for cols in (schema.flow, schema.pressure, schema.volume):
        group = augmented.groupby("scenario_id", sort=False)
        first_values = group[cols].transform("first")
        diff_baseline = augmented[cols] - first_values
        diff_baseline.columns = [f"{name}_from_start" for name in cols]
        augmented = pd.concat([augmented, diff_baseline], axis=1)

        diff_step = group[cols].diff().fillna(0.0)
        diff_step.columns = [f"{name}_step_diff" for name in cols]
        augmented = pd.concat([augmented, diff_step], axis=1)

        for window in (3, 5):
            rolling = (
                group[cols]
                .rolling(window=window, min_periods=1)
                .mean()
                .reset_index(level=0, drop=True)
            )
            rolling.columns = [f"{name}_roll_mean_{window}" for name in cols]
            augmented = pd.concat([augmented, rolling], axis=1)
    return augmented


def _add_fractional_features(frame: pd.DataFrame, schema: ColumnSchema) -> pd.DataFrame:
    augmented = frame.copy()
    total_flow = augmented["flow_sum"].replace(0, np.nan)
    total_pressure = augmented["pressure_sum"].replace(0, np.nan)
    for col in schema.flow:
        augmented[f"{col}_share"] = augmented[col] / total_flow
    for col in schema.pressure:
        augmented[f"{col}_share"] = augmented[col] / total_pressure
    augmented = augmented.fillna(0.0)
    return augmented


def _parse_neighbor_ids(series: pd.Series) -> Iterable[int]:
    indices = []
    for label, value in series.items():
        if value <= 0:
            continue
        _, node_str = label.split("_")
        indices.append(int(node_str))
    return indices


def _add_graph_differences(
    frame: pd.DataFrame,
    schema: ColumnSchema,
    distance_matrix: pd.DataFrame | None,
) -> pd.DataFrame:
    if distance_matrix is None:
        return frame
    augmented = frame.copy()
    for node in FLOW_NODE_IDS:
        flow_col = f"flow_node_{node}"
        pressure_col = f"pressure_node_{node}"
        neighbors = _parse_neighbor_ids(distance_matrix.loc[node])
        if not neighbors:
            continue
        neighbor_flow_cols = [f"flow_node_{nb}" for nb in neighbors]
        neighbor_pressure_cols = [f"pressure_node_{nb}" for nb in neighbors]
        augmented[f"{flow_col}_neighbor_delta"] = (
            augmented[flow_col] - augmented[neighbor_flow_cols].mean(axis=1)
        )
        augmented[f"{pressure_col}_neighbor_delta"] = (
            augmented[pressure_col] - augmented[neighbor_pressure_cols].mean(axis=1)
        )
    return augmented.fillna(0.0)


def engineer_features(
    raw_frame: pd.DataFrame,
    distance_matrix: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Create model-ready features from the concatenated WDN1 dataset."""

    schema: ColumnSchema = build_column_schema()
    data = raw_frame.sort_values(["scenario_index", "scenario_step"]).reset_index(drop=True)
    data = _add_statistical_aggregates(data, schema)
    data = _add_relative_measures(data, schema)
    data = _add_fractional_features(data, schema)
    data = _add_graph_differences(data, schema, distance_matrix)
    numeric_cols = data.select_dtypes(include=[np.number]).columns
    data[numeric_cols] = data[numeric_cols].astype(float)
    return data
