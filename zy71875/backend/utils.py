from datetime import datetime, date
from typing import Optional, Dict, Any
import uuid
import re
from fastapi import HTTPException, status
from pydantic import ValidationError


USER_FRIENDLY_ERRORS = {
    "value_error.date": "日期格式不正确，请使用 YYYY-MM-DD 格式（例如：2024-01-15）",
    "value_error.missing": "缺少必填信息，请检查表单是否填写完整",
    "value_error.number.not_ge": "数值不能为负数，请检查输入的数字",
    "value_error.str_overflow": "输入的文字太长了，请精简一下",
    "IntegrityError": "数据重复了，这条记录可能已经存在，请检查日期、餐次和菜品名称",
    "FileNotFoundError": "找不到文件，请确认文件路径是否正确",
    "PermissionError": "没有权限操作，请联系管理员",
    "ValueError": "输入的数据有问题，请检查后重试",
    "KeyError": "缺少必要的字段，请检查导入的文件格式",
    "IndexError": "数据格式不正确，请检查每行的列数是否正确",
    "TypeError": "数据类型不匹配，请检查输入的内容格式",
    "AssertionError": "验证失败，请检查输入的数据",
}


def generate_id(prefix: str = "") -> str:
    """生成唯一ID"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique = str(uuid.uuid4())[:8].upper()
    return f"{prefix}{timestamp}{unique}"


def get_user_friendly_message(error: Exception) -> str:
    """将技术错误转换为用户友好的提示"""
    error_type = type(error).__name__
    error_str = str(error)

    if isinstance(error, ValidationError):
        errors = error.errors()
        if errors:
            first_error = errors[0]
            field = first_error.get('loc', [''])[-1]
            msg = first_error.get('msg', '')
            type_ = first_error.get('type', '')

            field_names = {
                'record_date': '日期',
                'meal_type': '餐次',
                'dish_name': '菜品名称',
                'predicted_count': '预测份数',
                'actual_count': '实际份数',
                'price': '价格',
                'start_date': '开始日期',
                'end_date': '结束日期',
                'reason': '修正原因',
            }
            field_cn = field_names.get(field, field)

            if 'not_ge' in type_:
                return f"{field_cn}不能为负数，请检查后重试"
            if 'missing' in type_:
                return f"请填写{field_cn}"
            if 'str_overflow' in type_:
                return f"{field_cn}太长了，请精简一下"
            if 'value_error' in type_:
                return f"{field_cn}：{msg}"
            return f"{field_cn}：{msg}"

    if error_type in USER_FRIENDLY_ERRORS:
        return USER_FRIENDLY_ERRORS[error_type]

    for key, msg in USER_FRIENDLY_ERRORS.items():
        if key in error_str:
            return msg

    if "UNIQUE constraint failed" in error_str:
        return "这条记录已经存在了（相同日期、餐次和菜品），请检查后重试"

    if "date" in error_str.lower() and ("format" in error_str.lower() or "invalid" in error_str.lower()):
        return "日期格式不正确，请使用 YYYY-MM-DD 格式（例如：2024-01-15）"

    if "not found" in error_str.lower():
        return "找不到请求的数据，请刷新页面后重试"

    return "操作失败了，请检查输入的数据，或者稍后再试"


class FriendlyHTTPException(HTTPException):
    """友好的HTTP异常，包含用户可理解的错误信息"""

    def __init__(
        self,
        status_code: int,
        error_code: str,
        error_message: str,
        user_friendly_message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(status_code=status_code, detail=error_message)
        self.error_code = error_code
        self.user_friendly_message = user_friendly_message or error_message
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_code": self.error_code,
            "error_message": self.detail,
            "user_friendly_message": self.user_friendly_message,
            "details": self.details,
            "timestamp": datetime.utcnow().isoformat(),
        }


def validate_date_range(start_date: date, end_date: date, max_days: int = 365):
    """验证日期范围是否合理"""
    if start_date > end_date:
        raise FriendlyHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="INVALID_DATE_RANGE",
            error_message="Start date cannot be after end date",
            user_friendly_message="开始日期不能晚于结束日期，请调整日期范围",
        )

    days_diff = (end_date - start_date).days
    if days_diff > max_days:
        raise FriendlyHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="DATE_RANGE_TOO_LARGE",
            error_message=f"Date range exceeds {max_days} days",
            user_friendly_message=f"日期范围太大了，最多只能选择 {max_days} 天（约1年），请缩小范围后重试",
            details={"max_days": max_days, "requested_days": days_diff},
        )


def clean_filename(filename: str) -> str:
    """清理文件名，移除不安全字符"""
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    filename = filename.strip()
    if not filename:
        filename = "unnamed"
    return filename


def parse_meal_type(value: str) -> str:
    """解析餐次，支持多种写法"""
    if not value:
        raise FriendlyHTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="EMPTY_MEAL_TYPE",
            error_message="Meal type cannot be empty",
            user_friendly_message="餐次不能为空，请填写早餐、午餐或晚餐",
        )

    value = str(value).strip().lower()
    mapping = {
        '早餐': '早餐', '早饭': '早餐', '早': '早餐', 'morning': '早餐', 'breakfast': '早餐', '1': '早餐',
        '午餐': '午餐', '中饭': '午餐', '午': '午餐', 'noon': '午餐', 'lunch': '午餐', '2': '午餐',
        '晚餐': '晚餐', '晚饭': '晚餐', '晚': '晚餐', 'evening': '晚餐', 'dinner': '晚餐', '3': '晚餐',
    }

    if value in mapping:
        return mapping[value]

    raise FriendlyHTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        error_code="INVALID_MEAL_TYPE",
        error_message=f"Invalid meal type: {value}",
        user_friendly_message=f"不认识的餐次「{value}」，请填写早餐、午餐或晚餐",
        details={"invalid_value": value, "valid_values": ["早餐", "午餐", "晚餐"]},
    )
