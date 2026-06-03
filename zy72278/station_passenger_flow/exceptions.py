from typing import Optional, Dict, Any


class StationFlowError(Exception):
    user_message: str
    technical_details: Optional[Dict[str, Any]]

    def __init__(self, user_message: str, technical_details: Optional[Dict[str, Any]] = None):
        self.user_message = user_message
        self.technical_details = technical_details
        super().__init__(user_message)


class DuplicateImportError(StationFlowError):
    @classmethod
    def create(cls, layer_name: str, existing_batch: str) -> "DuplicateImportError":
        return cls(
            user_message=f"发现重复导入：图层「{layer_name}」已经在批次「{existing_batch}」中导入过了，不需要再导一遍。",
            technical_details={"layer_name": layer_name, "existing_batch": existing_batch}
        )


class ZAxisReversedError(StationFlowError):
    @classmethod
    def create(cls, cad_value: float, expected_value: float) -> "ZAxisReversedError":
        direction_cad = "向上" if cad_value > 0 else "向下"
        direction_expected = "向上" if expected_value > 0 else "向下"
        return cls(
            user_message=f"注意：Z轴方向可能按旧习惯写反了！CAD显示{direction_cad}（值：{cad_value}），但按现场常规应该是{direction_expected}。请留给现场班组复核，别急着改。",
            technical_details={"cad_z": cad_value, "expected_z": expected_value}
        )


class DataConflictError(StationFlowError):
    @classmethod
    def create(cls, conflict_type: str, location: str, cad_value: Any, rangefinder_value: Any) -> "DataConflictError":
        conflict_messages = {
            "z_axis_direction": f"在「{location}」处，CAD图层和测距仪记录的Z轴方向对不上。",
            "distance_mismatch": f"在「{location}」处，CAD图层标注距离和测距仪实测距离差太多了。",
            "layer_name_mismatch": f"CAD图层名「{cad_value}」和测距仪记录的测量点「{rangefinder_value}」对不上。"
        }
        return cls(
            user_message=conflict_messages.get(conflict_type, f"数据冲突：在「{location}」处发现不一致。") +
            f" 请查看冲突证据后选择确认或驳回，不要自动拍板。",
            technical_details={
                "conflict_type": conflict_type,
                "location": location,
                "cad_value": cad_value,
                "rangefinder_value": rangefinder_value
            }
        )


class SupplementRecalculateNeeded(StationFlowError):
    @classmethod
    def create(cls) -> "SupplementRecalculateNeeded":
        return cls(
            user_message="检测到补录了新的测距仪数据，请重新计算客流瓶颈，确保结果准确。",
            technical_details={"action_needed": "recalculate_after_supplement"}
        )


class ExportInconsistencyError(StationFlowError):
    @classmethod
    def create(cls, field_name: str, cached_value: Any, current_value: Any) -> "ExportInconsistencyError":
        return cls(
            user_message=f"导出数据不一致：{field_name}字段和上次计算结果不一样。请确认是否需要重新计算后再导出。",
            technical_details={"field": field_name, "cached": cached_value, "current": current_value}
        )


class WorkflowStepError(StationFlowError):
    @classmethod
    def create(cls, current_step: str, required_step: str) -> "WorkflowStepError":
        step_names = {
            "cad_import": "CAD图层导入",
            "rangefinder_supplement": "补看测距仪记录",
            "path_replay_update": "路径回放更新"
        }
        return cls(
            user_message=f"流程不对：现在是「{step_names.get(current_step, current_step)}」阶段，还不能进行「{step_names.get(required_step, required_step)}」操作。请按步骤来。",
            technical_details={"current_step": current_step, "required_step": required_step}
        )
