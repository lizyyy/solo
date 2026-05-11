class BusinessError(Exception):
    error_code: str
    error_message: str
    error_type: str
    detail: dict

    def __init__(self, error_code: str, error_message: str, error_type: str = "business", detail: dict = None):
        self.error_code = error_code
        self.error_message = error_message
        self.error_type = error_type
        self.detail = detail or {}
        super().__init__(self.error_message)


class InvalidOrderError(BusinessError):
    def __init__(self, message: str = "项目顺序错误，会影响检查结果", detail: dict = None):
        super().__init__(
            error_code="INVALID_ORDER",
            error_message=message,
            error_type="validation",
            detail=detail or {}
        )


class FastingRuleViolationError(BusinessError):
    def __init__(self, message: str, detail: dict = None):
        super().__init__(
            error_code="FASTING_RULE_VIOLATION",
            error_message=message,
            error_type="rule_violation",
            detail=detail or {}
        )


class DependencyNotMetError(BusinessError):
    def __init__(self, message: str, detail: dict = None):
        super().__init__(
            error_code="DEPENDENCY_NOT_MET",
            error_message=message,
            error_type="dependency",
            detail=detail or {}
        )


class ResourceNotFoundError(BusinessError):
    def __init__(self, resource_type: str, resource_id: int):
        super().__init__(
            error_code="RESOURCE_NOT_FOUND",
            error_message=f"{resource_type} 不存在: ID={resource_id}",
            error_type="not_found",
            detail={"resource_type": resource_type, "resource_id": resource_id}
        )


class DuplicateResourceError(BusinessError):
    def __init__(self, resource_type: str, identifier: str):
        super().__init__(
            error_code="DUPLICATE_RESOURCE",
            error_message=f"{resource_type} 已存在: {identifier}",
            error_type="conflict",
            detail={"resource_type": resource_type, "identifier": identifier}
        )


class InvalidStatusTransitionError(BusinessError):
    def __init__(self, current_status: str, target_status: str, detail: dict = None):
        super().__init__(
            error_code="INVALID_STATUS_TRANSITION",
            error_message=f"状态转换无效: {current_status} -> {target_status}",
            error_type="state_machine",
            detail=detail or {"current_status": current_status, "target_status": target_status}
        )


class InvalidDataError(BusinessError):
    def __init__(self, message: str, detail: dict = None):
        super().__init__(
            error_code="INVALID_DATA",
            error_message=message,
            error_type="validation",
            detail=detail or {}
        )


ERROR_MAPPING = {
    "INVALID_ORDER": "项目顺序错误",
    "FASTING_RULE_VIOLATION": "空腹规则违反",
    "DEPENDENCY_NOT_MET": "依赖未满足",
    "RESOURCE_NOT_FOUND": "资源不存在",
    "DUPLICATE_RESOURCE": "资源重复",
    "INVALID_STATUS_TRANSITION": "状态转换无效",
    "INVALID_DATA": "数据无效",
}
