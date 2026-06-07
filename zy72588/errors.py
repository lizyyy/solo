from typing import Optional, List


class AUCAnomalyError(Exception):
    def __init__(self, user_message: str, technical_details: Optional[str] = None):
        self.user_message = user_message
        self.technical_details = technical_details
        super().__init__(user_message)


class DuplicateImportError(AUCAnomalyError):
    def __init__(self, note_id: str, existing_version: int, new_version: int):
        super().__init__(
            user_message=f"阈值调参笔记 {note_id} 已经导入过了（已有版本号 {existing_version}），请不要重复导入。如果是补录，请使用补录功能。",
            technical_details=f"Duplicate import for note_id={note_id}, existing_version={existing_version}, new_version={new_version}"
        )


class ThresholdMismatchError(AUCAnomalyError):
    def __init__(self, field_name: str, old_value: float, new_value: float):
        super().__init__(
            user_message=f"检测到阈值 '{field_name}' 已经从 {old_value} 改成了 {new_value}，但报告里还写着旧值 {old_value}。请先找数据科学家复核，别急着归为正常。",
            technical_details=f"Threshold mismatch for field={field_name}, old_value={old_value}, new_value={new_value}"
        )


class ConflictUnresolvedError(AUCAnomalyError):
    def __init__(self, conflict_count: int):
        super().__init__(
            user_message=f"还有 {conflict_count} 处阈值调参笔记和线上实验桶的冲突没处理，请先让实验平台负责人阿越确认或驳回后再继续。",
            technical_details=f"{conflict_count} unresolved conflicts detected"
        )


class MaterialTypeError(AUCAnomalyError):
    def __init__(self, expected: str, actual: str):
        super().__init__(
            user_message=f"材料类型不对。期望是 '{expected}'，实际是 '{actual}'。请检查你上传的材料是不是拿错了。",
            technical_details=f"Material type mismatch: expected={expected}, actual={actual}"
        )


class ExportConsistencyError(AUCAnomalyError):
    def __init__(self, diff_fields: List[str]):
        super().__init__(
            user_message=f"导出的数据和系统里存的不一致，差异字段：{', '.join(diff_fields)}。请检查是不是中途有人改过数据。",
            technical_details=f"Export consistency check failed for fields: {diff_fields}"
        )


class StepOrderError(AUCAnomalyError):
    def __init__(self, current_step: str, required_step: str):
        super().__init__(
            user_message=f"流程走反了。应该先完成「{required_step}」，现在才到「{current_step}」这一步。",
            technical_details=f"Step order error: current={current_step}, required={required_step}"
        )
