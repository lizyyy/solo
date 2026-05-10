from fastapi import status


class BusinessException(Exception):
    def __init__(self, code: str, message: str, detail: str = None, http_status: int = status.HTTP_400_BAD_REQUEST):
        self.code = code
        self.message = message
        self.detail = detail
        self.http_status = http_status
        super().__init__(message)


class StateTransitionError(BusinessException):
    def __init__(self, entity: str, entity_id: int, from_state: str, to_state: str, detail: str = None):
        super().__init__(
            code="STATE_TRANSITION_ERROR",
            message=f"{entity}#{entity_id} 不允许从状态 [{from_state}] 流转到 [{to_state}]",
            detail=detail,
            http_status=status.HTTP_409_CONFLICT
        )


class DuplicateSubmissionError(BusinessException):
    def __init__(self, entity: str, unique_key: str, detail: str = None):
        super().__init__(
            code="DUPLICATE_SUBMISSION",
            message=f"{entity} 已存在重复提交: {unique_key}",
            detail=detail,
            http_status=status.HTTP_409_CONFLICT
        )


class NotFoundError(BusinessException):
    def __init__(self, entity: str, entity_id: int = None, key: str = None, detail: str = None):
        msg = f"{entity} 不存在"
        if entity_id is not None:
            msg += f": id={entity_id}"
        if key is not None:
            msg += f": {key}"
        super().__init__(
            code="NOT_FOUND",
            message=msg,
            detail=detail,
            http_status=status.HTTP_404_NOT_FOUND
        )


class AmountExceededError(BusinessException):
    def __init__(self, entity: str, available: float, requested: float, detail: str = None):
        super().__init__(
            code="AMOUNT_EXCEEDED",
            message=f"{entity} 金额不足: 可用 {available}, 请求 {requested}",
            detail=detail,
            http_status=status.HTTP_400_BAD_REQUEST
        )


class VersionConflictError(BusinessException):
    def __init__(self, entity: str, entity_id: int, detail: str = None):
        super().__init__(
            code="VERSION_CONFLICT",
            message=f"{entity}#{entity_id} 已被其他操作修改，请刷新后重试",
            detail=detail,
            http_status=status.HTTP_409_CONFLICT
        )


class InvalidOperationError(BusinessException):
    def __init__(self, entity: str, action: str, reason: str, detail: str = None):
        super().__init__(
            code="INVALID_OPERATION",
            message=f"不能对 {entity} 执行 [{action}]: {reason}",
            detail=detail,
            http_status=status.HTTP_400_BAD_REQUEST
        )
