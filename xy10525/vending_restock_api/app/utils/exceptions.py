from fastapi import HTTPException, status


class BusinessException(Exception):
    def __init__(self, code: str, message: str, details: dict = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)


class DuplicateTaskException(BusinessException):
    def __init__(self, machine_id: str, existing_task_id: str):
        super().__init__(
            code="DUPLICATE_TASK",
            message=f"Machine {machine_id} already has a pending task: {existing_task_id}",
            details={"machine_id": machine_id, "existing_task_id": existing_task_id}
        )


class CapacityExceededException(BusinessException):
    def __init__(self, route_id: str, required: int, available: int):
        super().__init__(
            code="CAPACITY_EXCEEDED",
            message=f"Route {route_id} capacity exceeded. Required: {required}, Available: {available}",
            details={"route_id": route_id, "required": required, "available": available}
        )


class MachineFaultException(BusinessException):
    def __init__(self, machine_id: str, fault_id: str):
        super().__init__(
            code="MACHINE_FAULT",
            message=f"Machine {machine_id} has active fault: {fault_id}",
            details={"machine_id": machine_id, "fault_id": fault_id}
        )


class InvalidStatusTransitionException(BusinessException):
    def __init__(self, resource: str, from_status: str, to_status: str):
        super().__init__(
            code="INVALID_STATUS_TRANSITION",
            message=f"Invalid {resource} status transition: {from_status} -> {to_status}",
            details={"resource": resource, "from": from_status, "to": to_status}
        )


class IdempotentViolationException(BusinessException):
    def __init__(self, idempotent_key: str):
        super().__init__(
            code="IDEMPOTENT_VIOLATION",
            message=f"Idempotent key {idempotent_key} already used with different parameters",
            details={"idempotent_key": idempotent_key}
        )


class ResourceNotFoundException(BusinessException):
    def __init__(self, resource: str, id: str):
        super().__init__(
            code="NOT_FOUND",
            message=f"{resource} with id {id} not found",
            details={"resource": resource, "id": id}
        )


def handle_business_exception(exc: BusinessException):
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "code": exc.code,
            "message": exc.message,
            "details": exc.details
        }
    )
