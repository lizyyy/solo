import math
from datetime import datetime
from typing import List, Optional, Tuple

from ..models.models import (
    SensorRecord,
    CalculationResult,
    ThresholdConfig,
    AuditEntry,
    DataGap,
)


class LiftDragCalculator:
    AIR_DENSITY_SEA_LEVEL = 1.225  # kg/m^3

    def __init__(self, air_density: float = None, chord_length_m: float = 0.3, span_m: float = 0.5):
        self.air_density = air_density or self.AIR_DENSITY_SEA_LEVEL
        self.chord = chord_length_m
        self.span = span_m
        self.reference_area = chord_length_m * span_m

    def compute(self, record: SensorRecord, threshold: ThresholdConfig) -> Optional[CalculationResult]:
        if record.lift_force is None or record.drag_force is None:
            return None

        dynamic_pressure = self._dynamic_pressure(record)
        if dynamic_pressure <= 0:
            dynamic_pressure = max(self.air_density * (record.wind_speed or 30.0) ** 2 / 2.0, 1.0)

        cl = 2.0 * record.lift_force / (dynamic_pressure * self.reference_area)
        cd = 2.0 * record.drag_force / (dynamic_pressure * self.reference_area)

        ld_ratio = cl / cd if abs(cd) > 1e-12 else float("inf")

        exceeds, detail = self._check_threshold(cl, cd, ld_ratio, record, threshold)

        result = CalculationResult(
            record_id=record.record_id,
            timestamp=record.timestamp,
            angle_of_attack=record.angle_of_attack or 0.0,
            cl=cl,
            cd=cd,
            ld_ratio=ld_ratio if ld_ratio != float("inf") else 9999.99,
            dynamic_pressure=dynamic_pressure,
            threshold_config_id=threshold.config_id,
            threshold_version=f"v{threshold.config_id[:6]}_{threshold.created_at.strftime('%Y%m%d%H%M')}",
            exceeds_threshold=exceeds,
            threshold_violation_detail=detail,
            data_gap_ids=[],
            unit_issue_ids=[],
            is_interpolated=record.is_gap,
            raw_annotation_preserved=record.raw_annotation,
            source_file=record.source_file,
            processing_time=datetime.now(),
        )

        return result

    def compute_batch(self, records: List[SensorRecord], threshold: ThresholdConfig) -> List[CalculationResult]:
        results = []
        for rec in records:
            r = self.compute(rec, threshold)
            if r is not None:
                results.append(r)
        return results

    def _dynamic_pressure(self, record: SensorRecord) -> float:
        if record.wind_speed is not None and record.wind_speed > 0:
            return 0.5 * self.air_density * record.wind_speed ** 2
        if record.pressure is not None and record.pressure > 0:
            return record.pressure
        return 0.5 * self.air_density * 30.0 ** 2

    def _check_threshold(self, cl: float, cd: float, ld_ratio: float, record: SensorRecord, threshold: ThresholdConfig) -> Tuple[bool, str]:
        violations = []

        if cl > threshold.cl_max:
            violations.append(f"Cl={cl:.3f} > 阈值{threshold.cl_max}")
        if cl < threshold.cl_min:
            violations.append(f"Cl={cl:.3f} < 阈值{threshold.cl_min}")
        if cd > threshold.cd_max:
            violations.append(f"Cd={cd:.3f} > 阈值{threshold.cd_max}")
        if cd < threshold.cd_min:
            violations.append(f"Cd={cd:.3f} < 阈值{threshold.cd_min}")

        finite_ld = ld_ratio if ld_ratio != float("inf") else 9999.99
        if finite_ld > threshold.ld_ratio_max:
            violations.append(f"L/D={finite_ld:.1f} > 阈值{threshold.ld_ratio_max}")
        if finite_ld < threshold.ld_ratio_min:
            violations.append(f"L/D={finite_ld:.1f} < 阈值{threshold.ld_ratio_min}")

        if record.pressure is not None and record.pressure > threshold.pressure_max_kpa:
            violations.append(f"压力={record.pressure:.1f}kPa > 阈值{threshold.pressure_max_kpa}kPa")

        if record.wind_speed is not None and record.wind_speed > threshold.wind_speed_max_mps:
            violations.append(f"风速={record.wind_speed:.1f}m/s > 阈值{threshold.wind_speed_max_mps}m/s")

        if violations:
            return True, "; ".join(violations)
        return False, ""
