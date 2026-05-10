class MRSException(Exception):
    pass


class MessageNotFoundError(MRSException):
    def __init__(self, message_id: str = None, business_key: str = None):
        self.message_id = message_id
        self.business_key = business_key
        msg_parts = ["找不到指定的消息"]
        if message_id:
            msg_parts.append(f"(消息ID: {message_id})")
        if business_key:
            msg_parts.append(f"(业务主键: {business_key})")
        super().__init__("".join(msg_parts))


class ApprovalRequiredError(MRSException):
    def __init__(self, request_id: str):
        self.request_id = request_id
        super().__init__(f"重放请求 {request_id} 尚未通过审批，不能执行")


class RequestAlreadyProcessedError(MRSException):
    def __init__(self, request_id: str):
        self.request_id = request_id
        super().__init__(f"重放请求 {request_id} 已处理，不能重复执行")


class IdempotencyConflictError(MRSException):
    def __init__(self, idempotency_key: str, existing_status: str):
        self.idempotency_key = idempotency_key
        self.existing_status = existing_status
        super().__init__(
            f"幂等键 {idempotency_key} 已存在且状态为 {existing_status}，"
            "为保证幂等性，跳过此消息重放"
        )


class RateLimitExceededError(MRSException):
    def __init__(self, limit_type: str, limit_value: int):
        self.limit_type = limit_type
        self.limit_value = limit_value
        super().__init__(
            f"超过{limit_type}速率限制 (限制: {limit_value})，请稍后重试"
        )


class InvalidScopeError(MRSException):
    def __init__(self, scope_type: str, detail: str = None):
        self.scope_type = scope_type
        msg = f"无效的重放范围类型: {scope_type}"
        if detail:
            msg += f" ({detail})"
        super().__init__(msg)


class NoMessagesFoundError(MRSException):
    def __init__(self, scope_type: str, scope_value: dict):
        self.scope_type = scope_type
        self.scope_value = scope_value
        super().__init__(
            f"根据指定范围未找到任何消息 (范围类型: {scope_type})"
        )


class ExecutionTimeoutError(MRSException):
    def __init__(self, execution_id: str, timeout_seconds: int):
        self.execution_id = execution_id
        self.timeout_seconds = timeout_seconds
        super().__init__(
            f"执行超时: {execution_id} (超时时间: {timeout_seconds}秒)"
        )


class BrokerConnectionError(MRSException):
    def __init__(self, broker_type: str, detail: str = None):
        self.broker_type = broker_type
        msg = f"无法连接到{broker_type}消息中间件"
        if detail:
            msg += f" ({detail})"
        super().__init__(msg)
