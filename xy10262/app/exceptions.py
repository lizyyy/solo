class BusinessException(Exception):
    def __init__(self, code: str, message: str, details: dict = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class DuplicateRecordException(BusinessException):
    def __init__(self, message: str = "记录已存在", details: dict = None):
        super().__init__("DUPLICATE_RECORD", message, details)


class MissingFieldException(BusinessException):
    def __init__(self, field_name: str, message: str = None, details: dict = None):
        msg = message or f"字段 '{field_name}' 不能为空"
        detail = details or {"missing_field": field_name}
        super().__init__("MISSING_FIELD", msg, detail)


class InvalidStatusException(BusinessException):
    def __init__(self, current_status: str, allowed_statuses: list, message: str = None):
        msg = message or f"当前状态 '{current_status}' 不允许执行此操作，允许状态: {allowed_statuses}"
        super().__init__("INVALID_STATUS", msg, {
            "current_status": current_status,
            "allowed_statuses": allowed_statuses
        })


class InvalidTemperatureException(BusinessException):
    def __init__(self, temp: float, low: float, high: float, message: str = None):
        msg = message or f"温度 {temp}℃ 超出允许范围 [{low}℃, {high}℃]"
        super().__init__("INVALID_TEMPERATURE", msg, {
            "temperature": temp,
            "allowed_range": [low, high]
        })


class ResourceNotFoundException(BusinessException):
    def __init__(self, resource_type: str, resource_id: str = None):
        msg = f"未找到{resource_type}"
        if resource_id:
            msg += f" (ID: {resource_id})"
        super().__init__("RESOURCE_NOT_FOUND", msg, {
            "resource_type": resource_type,
            "resource_id": resource_id
        })


class ManualModificationException(BusinessException):
    def __init__(self, message: str = "温度记录人工修改异常", details: dict = None):
        super().__init__("MANUAL_MODIFICATION_ERROR", message, details)
