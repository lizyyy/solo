from typing import Optional, Dict, Any
from models import ConflictType, SampleStatus


class UserFriendlyError(Exception):
    def __init__(self, message: str, suggestion: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.suggestion = suggestion
        self.details = details or {}
        super().__init__(self._format_message())

    def _format_message(self) -> str:
        msg = f"❌ {self.message}"
        if self.suggestion:
            msg += f"\n💡 建议：{self.suggestion}"
        return msg


class DuplicateImportError(UserFriendlyError):
    def __init__(self, sample_id: str, existing_source: str, new_source: str):
        super().__init__(
            message=f"样本编号【{sample_id}】已存在，不能重复导入。",
            suggestion=f"该样本之前从【{existing_source}】导入，现在又从【{new_source}】导入。请检查是否需要更新该样本，或先删除已有记录再重新导入。",
            details={"sample_id": sample_id, "existing_source": existing_source, "new_source": new_source}
        )


class BoundaryValueWarning(Warning):
    def __init__(self, sample_id: str, param_value: float, threshold: float):
        self.sample_id = sample_id
        self.param_value = param_value
        self.threshold = threshold
        self.message = (
            f"⚠️  样本【{sample_id}】的方程参数值({param_value})刚好等于阈值({threshold})，"
            f"已标记为【待任课老师复核】，请任课老师确认后再继续处理。"
        )
        super().__init__(self.message)


class ConflictDetectedError(UserFriendlyError):
    def __init__(self, sample_id: str, conflict_type: ConflictType, 
                 sample_list_value: Any, parameter_table_value: Any, description: str):
        super().__init__(
            message=f"样本【{sample_id}】在抽样名单和参数调试表中存在冲突：{description}",
            suggestion=(
                f"抽样名单显示：{sample_list_value}\n"
                f"参数调试表显示：{parameter_table_value}\n"
                f"请教研负责人吴老师选择【确认】或【驳回】，不要自动处理。"
            ),
            details={
                "sample_id": sample_id,
                "conflict_type": conflict_type.value,
                "sample_list_value": sample_list_value,
                "parameter_table_value": parameter_table_value
            }
        )


class InvalidDataError(UserFriendlyError):
    def __init__(self, field_name: str, field_value: Any, reason: str):
        field_names = {
            "sample_id": "样本编号",
            "equation_param": "方程参数",
            "threshold": "阈值",
            "root_value": "方程根值",
            "status": "状态"
        }
        display_name = field_names.get(field_name, field_name)
        super().__init__(
            message=f"{display_name}【{field_value}】不正确：{reason}",
            suggestion=f"请检查{display_name}的输入格式，确保填写正确后再导入。",
            details={"field_name": field_name, "field_value": field_value, "reason": reason}
        )


class StatusTransitionError(UserFriendlyError):
    def __init__(self, sample_id: str, current_status: SampleStatus, target_status: SampleStatus):
        status_map = {
            SampleStatus.NORMAL: "正常",
            SampleStatus.BOUNDARY: "边界值",
            SampleStatus.ABNORMAL: "异常",
            SampleStatus.PENDING_REVIEW: "待任课老师复核",
            SampleStatus.CONFIRMED: "吴老师确认",
            SampleStatus.REJECTED: "吴老师驳回"
        }
        current = status_map.get(current_status, current_status.value)
        target = status_map.get(target_status, target_status.value)
        super().__init__(
            message=f"样本【{sample_id}】状态不能从【{current}】直接改为【{target}】。",
            suggestion="请按照正确的业务流程操作：先导入抽样名单，再由吴老师核对参数调试表，边界值需要任课老师复核，最后才能确认结果。",
            details={"sample_id": sample_id, "current_status": current, "target_status": target}
        )


class ExportConsistencyError(UserFriendlyError):
    def __init__(self, sample_id: str, field_name: str, original_value: Any, exported_value: Any):
        field_names = {
            "sample_id": "样本编号",
            "equation_param": "方程参数",
            "threshold": "阈值",
            "root_value": "方程根值",
            "status": "状态"
        }
        display_name = field_names.get(field_name, field_name)
        super().__init__(
            message=f"导出数据不一致：样本【{sample_id}】的{display_name}在导出前后不一样。",
            suggestion=f"原始值是【{original_value}】，导出后变成【{exported_value}】。请检查导出逻辑，或联系技术人员排查问题。",
            details={
                "sample_id": sample_id,
                "field_name": field_name,
                "original_value": original_value,
                "exported_value": exported_value
            }
        )


class MissingDataError(UserFriendlyError):
    def __init__(self, sample_id: str, missing_field: str):
        field_names = {
            "equation_param": "方程参数",
            "threshold": "阈值",
            "root_value": "方程根值"
        }
        display_name = field_names.get(missing_field, missing_field)
        super().__init__(
            message=f"样本【{sample_id}】缺少必要的{display_name}数据。",
            suggestion=f"请在抽样名单或参数调试表中填写完整的{display_name}后再继续。",
            details={"sample_id": sample_id, "missing_field": missing_field}
        )


class SelfCheckFailedError(UserFriendlyError):
    def __init__(self, check_name: str, message: str):
        check_names = {
            "duplicate_import": "重复导入检查",
            "boundary_value": "边界值检查",
            "recalc_after_supplement": "补录后重算检查",
            "export_consistency": "导出一致性检查"
        }
        display_name = check_names.get(check_name, check_name)
        super().__init__(
            message=f"自检【{display_name}】未通过：{message}",
            suggestion="请根据提示修复问题后重新运行自检，确保所有检查都通过后再进行后续操作。",
            details={"check_name": check_name, "message": message}
        )
