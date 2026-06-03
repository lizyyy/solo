"""
异常处理模块

提供人类可读的错误提示，而非内部字段名。
"""

from typing import Optional, Dict, Any


class SchedulingError(Exception):
    """排班系统基础异常类"""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)

    def __str__(self) -> str:
        return self.message


class DataFormatError(SchedulingError):
    """数据格式错误"""
    pass


class MixedNumberError(SchedulingError):
    """百分数和小数混合错误"""
    pass


class DuplicateImportError(SchedulingError):
    """重复导入错误"""
    pass


class ValidationError(SchedulingError):
    """校验错误"""
    pass


class WorkflowError(SchedulingError):
    """工作流程错误"""
    pass


# 人类可读错误映射表
# 关键：错误提示要说人话，不能只吐内部字段名
ERROR_MESSAGES = {
    "mixed_number_detected": "发现百分数和小数混合出现，请活动负责人复核后再继续",
    "duplicate_import": "该批次抽样名单已导入过，系统将自动跳过重复记录，不会重复计算",
    "invalid_percentage": "百分数格式不正确，请检查后重新导入",
    "invalid_decimal": "小数格式不正确，请检查后重新导入",
    "missing_required_field": "缺少必填字段：{field_name}",
    "invalid_route_code": "线路编号格式不正确",
    "workflow_step_skipped": "请先完成上一步骤再继续",
    "no_pending_issues": "没有待复核的问题",
    "record_not_found": "找不到指定的记录",
    "invalid_param_value": "参数值超出有效范围",
    "calculation_failed": "排班计算失败，请检查输入数据",
    "rollback_failed": "回滚失败，请检查操作记录",
    "history_not_found": "找不到指定的历史记录",
    "review_required": "该数据需要活动负责人复核后才能继续",
}


def format_error(error_code: str, **kwargs) -> str:
    """
    将错误代码转换为人类可读的错误信息

    Args:
        error_code: 错误代码
        **kwargs: 格式化参数

    Returns:
        人类可读的错误信息
    """
    template = ERROR_MESSAGES.get(error_code, error_code)
    try:
        return template.format(**kwargs)
    except (KeyError, IndexError):
        return template


def raise_if_mixed_number_error(field_name: str, value: str, record_id: str) -> None:
    """
    抛出百分数和小数混合错误

    Args:
        field_name: 字段名
        value: 原始值
        record_id: 记录ID
    """
    message = (
        f"发现百分数和小数混合：字段「{field_name}」的值「{value}，"
        f"请活动负责人复核。系统已暂停自动处理，"
        f"该记录将标记为待复核状态，不会立即归入正常计算。"
    )
    raise MixedNumberError(
        message,
        {
            "field_name": field_name,
            "original_value": value,
            "record_id": record_id,
        },
    )
