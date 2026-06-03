from datetime import datetime
from typing import List, Set, Tuple
from .models import (
    CADLayer,
    RangefinderRecord,
    PassengerFlowResult,
    SelfCheckResult,
    ConflictEvidence,
    ConflictType,
    DirectionStatus
)
from .exceptions import (
    DuplicateImportError,
    ZAxisReversedError,
    DataConflictError,
    SupplementRecalculateNeeded,
    ExportInconsistencyError
)


class DataValidator:
    def __init__(self):
        self._imported_layers: Set[Tuple[str, str]] = set()
        self._last_export_snapshot: dict = {}

    def check_duplicate_import(self, cad_layer: CADLayer) -> SelfCheckResult:
        key = (cad_layer.layer_name, cad_layer.source_file)
        if key in self._imported_layers:
            return SelfCheckResult(
                check_name="重复导入检查",
                passed=False,
                message=f"图层「{cad_layer.layer_name}」已经导入过，请勿重复操作。",
                details={"existing_batch": cad_layer.import_batch}
            )
        self._imported_layers.add(key)
        return SelfCheckResult(
            check_name="重复导入检查",
            passed=True,
            message="没有发现重复导入，没问题。"
        )

    def check_z_axis_direction(self, cad_layer: CADLayer, expected_z_positive: bool = True) -> SelfCheckResult:
        is_positive = cad_layer.z_direction > 0
        if is_positive != expected_z_positive:
            expected_dir = "向上" if expected_z_positive else "向下"
            actual_dir = "向上" if is_positive else "向下"
            return SelfCheckResult(
                check_name="Z轴方向检查",
                passed=False,
                message=f"Z轴方向可能写反了！CAD显示{actual_dir}，按现场常规应该是{expected_dir}。请留给现场班组复核。",
                details={
                    "cad_z_value": cad_layer.z_direction,
                    "expected_direction": expected_dir,
                    "status": "pending_review"
                }
            )
        return SelfCheckResult(
            check_name="Z轴方向检查",
            passed=True,
            message="Z轴方向正常。"
        )

    def check_cad_rangefinder_conflicts(
        self,
        cad_layer: CADLayer,
        rangefinder_records: List[RangefinderRecord]
    ) -> List[ConflictEvidence]:
        conflicts: List[ConflictEvidence] = []

        for record in rangefinder_records:
            if abs(cad_layer.z_direction - record.z_direction) > 0.1:
                cad_dir = "向上" if cad_layer.z_direction > 0 else "向下"
                rf_dir = "向上" if record.z_direction > 0 else "向下"
                conflicts.append(ConflictEvidence(
                    conflict_type=ConflictType.Z_AXIS_DIRECTION,
                    cad_value=f"{cad_dir}({cad_layer.z_direction})",
                    rangefinder_value=f"{rf_dir}({record.z_direction})",
                    description=f"CAD图层{cad_layer.layer_name}与测距仪记录{record.record_id}的Z轴方向相反",
                    location=record.measure_point,
                    confidence=0.95
                ))

            cad_distance = sum(
                ((p.get("x", 0) - cad_layer.points[i-1].get("x", 0))**2 +
                 (p.get("y", 0) - cad_layer.points[i-1].get("y", 0))**2)**0.5
                for i, p in enumerate(cad_layer.points) if i > 0
            ) if len(cad_layer.points) > 1 else 0

            if cad_distance > 0 and abs(cad_distance - record.distance) / cad_distance > 0.1:
                conflicts.append(ConflictEvidence(
                    conflict_type=ConflictType.DISTANCE_MISMATCH,
                    cad_value=round(cad_distance, 2),
                    rangefinder_value=record.distance,
                    description=f"CAD计算距离与测距仪实测距离相差超过10%",
                    location=record.measure_point,
                    confidence=0.85
                ))

        return conflicts

    def check_supplement_recalculate(
        self,
        result: PassengerFlowResult,
        new_records: List[RangefinderRecord]
    ) -> SelfCheckResult:
        if not new_records:
            return SelfCheckResult(
                check_name="补录重算检查",
                passed=True,
                message="没有新的补录数据，无需重算。"
            )

        supplement_records = [r for r in new_records if r.is_supplement]
        if supplement_records and result.version == 1:
            return SelfCheckResult(
                check_name="补录重算检查",
                passed=False,
                message=f"检测到{len(supplement_records)}条补录数据，请重新计算客流瓶颈。",
                details={"supplement_count": len(supplement_records)}
            )

        return SelfCheckResult(
            check_name="补录重算检查",
            passed=True,
            message="补录数据已纳入计算。"
        )

    def check_export_consistency(self, result: PassengerFlowResult) -> SelfCheckResult:
        current_snapshot = {
            "bottleneck_location": result.bottleneck_location,
            "bottleneck_flow": result.bottleneck_flow,
            "capacity": result.capacity,
            "utilization_rate": result.utilization_rate,
            "version": result.version
        }

        if not self._last_export_snapshot:
            self._last_export_snapshot = current_snapshot
            return SelfCheckResult(
                check_name="导出一致性检查",
                passed=True,
                message="首次导出，已记录当前数据快照。"
            )

        inconsistent_fields = []
        for key in ["bottleneck_location", "bottleneck_flow", "capacity", "utilization_rate"]:
            if self._last_export_snapshot.get(key) != current_snapshot.get(key):
                inconsistent_fields.append(key)

        if inconsistent_fields:
            return SelfCheckResult(
                check_name="导出一致性检查",
                passed=False,
                message=f"导出数据有变化：{', '.join(inconsistent_fields)} 字段和上次导出不一样。请确认是否重新计算。",
                details={
                    "previous": {k: self._last_export_snapshot[k] for k in inconsistent_fields},
                    "current": {k: current_snapshot[k] for k in inconsistent_fields}
                }
            )

        return SelfCheckResult(
            check_name="导出一致性检查",
            passed=True,
            message="导出数据与上次一致，可以正常导出。"
        )

    def run_all_checks(
        self,
        result: PassengerFlowResult,
        new_rangefinder_records: List[RangefinderRecord] = None
    ) -> List[SelfCheckResult]:
        results = []

        if result.cad_layer:
            results.append(self.check_duplicate_import(result.cad_layer))
            results.append(self.check_z_axis_direction(result.cad_layer))

        if result.cad_layer and result.rangefinder_records:
            conflicts = self.check_cad_rangefinder_conflicts(
                result.cad_layer,
                result.rangefinder_records
            )
            if conflicts:
                results.append(SelfCheckResult(
                    check_name="数据一致性检查",
                    passed=False,
                    message=f"发现{len(conflicts)}处CAD与测距仪数据不一致，请查看冲突证据后确认。",
                    details={"conflict_count": len(conflicts)}
                ))
            else:
                results.append(SelfCheckResult(
                    check_name="数据一致性检查",
                    passed=True,
                    message="CAD与测距仪数据一致，没问题。"
                ))

        if new_rangefinder_records is not None:
            results.append(self.check_supplement_recalculate(result, new_rangefinder_records))

        results.append(self.check_export_consistency(result))

        return results

    def reset_export_snapshot(self):
        self._last_export_snapshot = {}
