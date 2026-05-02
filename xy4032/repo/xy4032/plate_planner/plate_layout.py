"""
孔位排布模块 - 96孔板布局管理、孔位分配、保留孔处理
"""

from typing import List, Dict, Optional, Set, Tuple
from dataclasses import dataclass

from .models import Sample, WellAssignment
from .config import PlateConfig, ReservedWell


@dataclass
class LayoutError:
    error_type: str
    message: str


class WellPosition:
    def __init__(self, row: int, col: int, row_labels: List[str]):
        self.row = row
        self.col = col
        self.row_labels = row_labels

    @property
    def label(self) -> str:
        return f"{self.row_labels[self.row]}{self.col + 1}"

    @classmethod
    def from_label(cls, label: str, row_labels: List[str]) -> "WellPosition":
        label = label.strip().upper()
        row_char = label[0]
        col_str = label[1:]

        if row_char not in row_labels:
            raise ValueError(f"无效的行标签: {row_char}")

        row = row_labels.index(row_char)
        col = int(col_str) - 1

        return cls(row, col, row_labels)


class PlateLayout:
    def __init__(self, plate_config: PlateConfig, reserved_wells: List[ReservedWell]):
        self.config = plate_config
        self.reserved_wells = reserved_wells
        self.reserved_well_set: Set[Tuple[int, int]] = set()
        self.reserved_well_map: Dict[Tuple[int, int], str] = {}

        for rw in reserved_wells:
            try:
                pos = WellPosition.from_label(rw.well, self.config.row_labels)
                self.reserved_well_set.add((pos.row, pos.col))
                self.reserved_well_map[(pos.row, pos.col)] = rw.purpose
            except ValueError:
                continue

        self.occupied_wells: Set[Tuple[int, int]] = set()
        self.well_assignments: List[WellAssignment] = []

    def get_total_available_wells(self) -> int:
        return self.config.rows * self.config.cols - len(self.reserved_well_set)

    def get_remaining_wells(self) -> int:
        return self.get_total_available_wells() - len(self.occupied_wells)

    def is_available(self, row: int, col: int) -> bool:
        if row < 0 or row >= self.config.rows:
            return False
        if col < 0 or col >= self.config.cols:
            return False
        if (row, col) in self.reserved_well_set:
            return False
        if (row, col) in self.occupied_wells:
            return False
        return True

    def get_next_available_well(self) -> Optional[Tuple[int, int]]:
        for row in range(self.config.rows):
            for col in range(self.config.cols):
                if self.is_available(row, col):
                    return (row, col)
        return None

    def assign_well(
        self,
        sample_id: str,
        concentration: float,
        concentration_unit: str,
        volume_ul: float = 20.0,
        replicate_index: Optional[int] = None,
    ) -> Tuple[Optional[WellAssignment], Optional[LayoutError]]:
        pos = self.get_next_available_well()
        if pos is None:
            return None, LayoutError(
                error_type="no_available_wells",
                message="没有可用的孔位"
            )

        row, col = pos
        self.occupied_wells.add((row, col))

        well_pos = WellPosition(row, col, self.config.row_labels)
        assignment = WellAssignment(
            sample_id=sample_id,
            well=well_pos.label,
            row=row,
            col=col,
            concentration=concentration,
            concentration_unit=concentration_unit,
            volume_ul=volume_ul,
            replicate_index=replicate_index,
        )
        self.well_assignments.append(assignment)

        return assignment, None

    def assign_sample_replicates(
        self,
        sample: Sample,
        target_concentration: float,
        target_unit: str,
        volume_ul: float = 20.0,
    ) -> Tuple[List[WellAssignment], List[LayoutError]]:
        assignments: List[WellAssignment] = []
        errors: List[LayoutError] = []

        if self.get_remaining_wells() < sample.replicate_count:
            errors.append(LayoutError(
                error_type="insufficient_wells",
                message=f"样品 {sample.sample_id} 需要 {sample.replicate_count} 个孔，但仅剩 {self.get_remaining_wells()} 个可用孔"
            ))
            return [], errors

        for i in range(sample.replicate_count):
            assignment, err = self.assign_well(
                sample_id=sample.sample_id,
                concentration=target_concentration,
                concentration_unit=target_unit,
                volume_ul=volume_ul,
                replicate_index=i + 1 if sample.replicate_count > 1 else None,
            )
            if err:
                errors.append(err)
                break
            if assignment:
                assignments.append(assignment)

        return assignments, errors

    def get_well_matrix(self) -> List[List[Optional[str]]]:
        matrix: List[List[Optional[str]]] = []
        for row in range(self.config.rows):
            row_data: List[Optional[str]] = []
            for col in range(self.config.cols):
                key = (row, col)
                if key in self.reserved_well_map:
                    row_data.append(f"[{self.reserved_well_map[key]}]")
                elif key in self.occupied_wells:
                    for wa in self.well_assignments:
                        if wa.row == row and wa.col == col:
                            row_data.append(wa.sample_id)
                            break
                else:
                    row_data.append(None)
            matrix.append(row_data)
        return matrix

    def get_reserved_wells_info(self) -> List[Dict[str, str]]:
        return [
            {"well": rw.well, "purpose": rw.purpose}
            for rw in self.reserved_wells
        ]
