from datetime import datetime
from typing import List, Optional, Callable, Dict, Any
from uuid import uuid4
from .models import (
    CADLayer,
    RangefinderRecord,
    PassengerFlowResult,
    WorkflowStep,
    DirectionStatus,
    ConflictEvidence,
    UserDecision,
    PathPoint
)
from .validator import DataValidator
from .replay import PathReplay
from .store import DataStore
from .exceptions import WorkflowStepError


class StationFlowProcessor:
    def __init__(self, data_dir: str = None):
        self.validator = DataValidator()
        self._current_result: Optional[PassengerFlowResult] = None
        self._decision_callbacks: List[Callable] = []
        self._store = DataStore(data_dir) if data_dir else None
        self._replay = PathReplay(self._store)

    def on_conflict_decision(self, callback: Callable):
        self._decision_callbacks.append(callback)

    def import_cad_layer(
        self,
        layer_name: str,
        source_file: str,
        z_direction: float,
        points: List[dict],
        operator: str,
        import_batch: Optional[str] = None
    ) -> PassengerFlowResult:
        cad_layer = CADLayer(
            layer_id=str(uuid4()),
            layer_name=layer_name,
            import_time=datetime.now(),
            z_direction=z_direction,
            points=points,
            source_file=source_file,
            import_batch=import_batch or f"batch_{datetime.now().strftime('%Y%m%d')}"
        )

        result = PassengerFlowResult(
            result_id=str(uuid4()),
            station_name="未命名站厅",
            hall_name=layer_name,
            calculate_time=datetime.now(),
            bottleneck_location="待计算",
            bottleneck_flow=0,
            capacity=0,
            utilization_rate=0.0,
            cad_layer=cad_layer,
            current_step=WorkflowStep.CAD_IMPORT,
            operator=operator
        )

        z_check = self.validator.check_z_axis_direction(cad_layer)
        if not z_check.passed:
            result.z_direction_status = DirectionStatus.PENDING_REVIEW

        dup_check = self.validator.check_duplicate_import(cad_layer)
        result.self_check_results = [z_check, dup_check]

        if result.z_direction_status == DirectionStatus.PENDING_REVIEW:
            result.conflicts.append(ConflictEvidence(
                conflict_type="z_axis_direction",
                cad_value=z_direction,
                rangefinder_value="待复核",
                description="Z轴方向可能按旧习惯写反，需要现场班组复核",
                location=layer_name,
                confidence=0.8
            ))

        self._current_result = result
        return result

    def supplement_rangefinder_records(
        self,
        records: List[RangefinderRecord]
    ) -> PassengerFlowResult:
        if not self._current_result:
            raise WorkflowStepError.create("none", "cad_import")

        if self._current_result.current_step not in [
            WorkflowStep.CAD_IMPORT,
            WorkflowStep.RANGEFINDER_SUPPLEMENT,
            WorkflowStep.PATH_REPLAY_UPDATE
        ]:
            raise WorkflowStepError.create(
                self._current_result.current_step,
                "rangefinder_supplement"
            )

        supplement_records = [r for r in records if r.is_supplement]
        self._current_result.rangefinder_records.extend(records)
        self._current_result.is_supplemented = len(supplement_records) > 0

        if self._current_result.cad_layer:
            conflicts = self.validator.check_cad_rangefinder_conflicts(
                self._current_result.cad_layer,
                records
            )
            self._current_result.conflicts.extend(conflicts)

            if conflicts:
                for callback in self._decision_callbacks:
                    callback(conflicts, self._current_result)

        self._current_result.current_step = WorkflowStep.RANGEFINDER_SUPPLEMENT

        sup_check = self.validator.check_supplement_recalculate(
            self._current_result,
            records
        )
        self._current_result.self_check_results.append(sup_check)

        return self._current_result

    def calculate_bottleneck(self) -> PassengerFlowResult:
        if not self._current_result:
            raise ValueError("请先导入CAD图层")

        if self._current_result.conflicts:
            pending_conflicts = [c for c in self._current_result.conflicts]
            if pending_conflicts:
                print(f"提示：还有{len(pending_conflicts)}处冲突待确认，计算结果可能不准确。")

        result = self._current_result

        if result.rangefinder_records:
            total_distance = sum(r.distance for r in result.rangefinder_records)
            avg_distance = total_distance / len(result.rangefinder_records) if result.rangefinder_records else 0

            result.bottleneck_flow = int(avg_distance * 120)
            result.capacity = int(avg_distance * 200)
            result.utilization_rate = round(result.bottleneck_flow / result.capacity, 2) if result.capacity > 0 else 0

            if result.rangefinder_records:
                result.bottleneck_location = result.rangefinder_records[0].measure_point

        result.version += 1
        result.calculate_time = datetime.now()
        result.current_step = WorkflowStep.PATH_REPLAY_UPDATE

        return result

    def update_path_replay(self, path_points: List[dict]) -> PassengerFlowResult:
        if not self._current_result:
            raise WorkflowStepError.create("none", "rangefinder_supplement")

        if self._current_result.current_step not in [
            WorkflowStep.RANGEFINDER_SUPPLEMENT,
            WorkflowStep.PATH_REPLAY_UPDATE,
            WorkflowStep.COMPLETED
        ]:
            raise WorkflowStepError.create(
                self._current_result.current_step,
                "path_replay_update"
            )

        self._current_result.path_history = [
            PathPoint(**point) for point in path_points
        ]

        consistency_check = self._replay.check_history_consistency(self._current_result)

        if not consistency_check.get("can_continue"):
            raise ValueError(f"路径回放更新失败：{consistency_check.get('message', '未知错误')}")

        self._current_result.current_step = WorkflowStep.COMPLETED
        self._current_result._last_replay_check = consistency_check

        if self._store:
            self._store.save_result(self._current_result)

        return self._current_result

    def resolve_conflict(
        self,
        conflict_index: int,
        confirmed: bool,
        operator: str,
        comment: Optional[str] = None
    ) -> PassengerFlowResult:
        if not self._current_result:
            raise ValueError("没有当前处理的结果")

        if conflict_index >= len(self._current_result.conflicts):
            raise ValueError("冲突索引不存在")

        conflict = self._current_result.conflicts[conflict_index]

        decision = UserDecision(
            decision_time=datetime.now(),
            operator=operator,
            conflict_id=f"conflict_{conflict_index}",
            confirmed=confirmed,
            comment=comment
        )

        if confirmed:
            if conflict.conflict_type == "z_axis_direction":
                self._current_result.z_direction_status = DirectionStatus.NORMAL
        else:
            if conflict.conflict_type == "z_axis_direction" and self._current_result.cad_layer:
                self._current_result.cad_layer.z_direction *= -1

        del self._current_result.conflicts[conflict_index]

        return self._current_result

    def export_result(self) -> dict:
        if not self._current_result:
            raise ValueError("没有可导出的数据")

        export_check = self.validator.check_export_consistency(self._current_result)
        self._current_result.self_check_results.append(export_check)

        if not export_check.passed:
            print(f"提示：{export_check.message}")

        return self._current_result.model_dump()

    def get_current_result(self) -> Optional[PassengerFlowResult]:
        return self._current_result

    def list_conflicts(self) -> List[ConflictEvidence]:
        if not self._current_result:
            return []
        return self._current_result.conflicts

    def print_conflicts(self):
        conflicts = self.list_conflicts()
        if not conflicts:
            print("没有发现数据冲突。")
            return

        print(f"\n发现 {len(conflicts)} 处冲突，请园区运维小陶确认：")
        print("=" * 60)
        for i, conflict in enumerate(conflicts, 1):
            type_names = {
                "z_axis_direction": "Z轴方向冲突",
                "distance_mismatch": "距离数据冲突",
                "layer_name_mismatch": "图层名称冲突"
            }
            print(f"\n冲突 #{i}: {type_names.get(conflict.conflict_type, conflict.conflict_type)}")
            print(f"  位置: {conflict.location}")
            print(f"  CAD值: {conflict.cad_value}")
            print(f"  测距仪值: {conflict.rangefinder_value}")
            print(f"  说明: {conflict.description}")
            print(f"  可信度: {conflict.confidence * 100:.0f}%")
            print(f"\n  请选择: [1] 确认CAD正确  [2] 驳回，以测距仪为准")
        print("\n" + "=" * 60)

    def get_replay(self) -> PathReplay:
        return self._replay

    def get_store(self) -> Optional[DataStore]:
        return self._store

    def replay_version_detail(self, version: int) -> Dict[str, Any]:
        if not self._current_result:
            return {"found": False, "message": "没有当前处理的结果，无法查看回放版本。"}
        return self._replay.get_path_version_detail(version, self._current_result.result_id)

    def replay_compare(self, version1: int, version2: int) -> Dict[str, Any]:
        if not self._current_result:
            return {"error": "没有当前处理的结果，无法对比回放版本。"}
        return self._replay.compare_paths(version1, version2, self._current_result.result_id)

    def replay_verify_latest(self, replay_version: int) -> Dict[str, Any]:
        if not self._current_result:
            return {"consistent": False, "message": "没有当前处理的结果，无法校验。"}
        if not self._store:
            return {"consistent": False, "message": "未配置数据存储，无法校验回放与最新结果的一致性。"}
        return self._replay.verify_with_latest_result(self._current_result.result_id, replay_version)

    def replay_list_versions(self) -> Dict[str, Any]:
        if not self._current_result:
            return {"versions": [], "message": "没有当前处理的结果。"}
        return self._replay.list_available_versions(self._current_result.result_id)

    def load_result(self, result_id: str, version: int = None) -> Optional[PassengerFlowResult]:
        if not self._store:
            return None
        return self._store.load_result(result_id, version)

    def list_all_results(self) -> List[Dict[str, Any]]:
        if not self._store:
            return []
        return self._store.list_all_results()
