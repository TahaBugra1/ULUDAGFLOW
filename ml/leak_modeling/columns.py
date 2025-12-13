"""Column definitions for the WDN1 leak detection dataset."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

FLOW_NODE_IDS = list(range(2, 10))
LEAK_NODE_IDS = list(range(10, 15))


@dataclass(frozen=True)
class ColumnSchema:
    """Stores column name groupings for the raw CSV files."""

    time: str
    flow: List[str]
    pressure: List[str]
    volume: List[str]
    coord_x: List[str]
    coord_y: List[str]
    coord_z: List[str]
    leak_flags: List[str]
    leak_coordinates: List[str]
    weekday_flag: str

    @property
    def all_columns(self) -> List[str]:
        parts = [
            [self.time],
            self.flow,
            self.pressure,
            self.volume,
            self.coord_x,
            self.coord_y,
            self.coord_z,
            self.leak_flags,
            self.leak_coordinates,
            [self.weekday_flag],
        ]
        out: List[str] = []
        for block in parts:
            out.extend(block)
        return out


def build_column_schema() -> ColumnSchema:
    time_col = "time_seconds"
    flow_cols = [f"flow_node_{node}" for node in FLOW_NODE_IDS]
    pressure_cols = [f"pressure_node_{node}" for node in FLOW_NODE_IDS]
    volume_cols = [f"volume_node_{node}" for node in FLOW_NODE_IDS]
    coord_x_cols = [f"x_node_{node}" for node in FLOW_NODE_IDS]
    coord_y_cols = [f"y_node_{node}" for node in FLOW_NODE_IDS]
    coord_z_cols = [f"z_node_{node}" for node in FLOW_NODE_IDS]
    leak_flag_cols = [f"leak_node_{node}" for node in LEAK_NODE_IDS]
    leak_coordinate_cols = ["leak_x", "leak_y", "leak_z"]
    weekday_col = "weekday_flag"
    schema = ColumnSchema(
        time=time_col,
        flow=flow_cols,
        pressure=pressure_cols,
        volume=volume_cols,
        coord_x=coord_x_cols,
        coord_y=coord_y_cols,
        coord_z=coord_z_cols,
        leak_flags=leak_flag_cols,
        leak_coordinates=leak_coordinate_cols,
        weekday_flag=weekday_col,
    )
    if len(schema.all_columns) != 58:
        raise ValueError("Unexpected column count for WDN1 schema")
    return schema
