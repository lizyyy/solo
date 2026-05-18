from datetime import datetime
from typing import Optional, Dict


class PrintQueueException(Exception):
    error_code: str
    error_message: str
    error_details: Optional[Dict]

    def __init__(self, error_code: str, error_message: str, error_details: Optional[Dict] = None):
        self.error_code = error_code
        self.error_message = error_message
        self.error_details = error_details
        super().__init__(self.error_message)


class DeliveryTimeConflictError(PrintQueueException):
    def __init__(self, affected_orders: list, conflict_details: Dict):
        super().__init__(
            error_code="DELIVERY_TIME_CONFLICT",
            error_message="插队操作影响了已承诺的交付时间",
            error_details={
                "affected_orders_count": len(affected_orders),
                "affected_orders": affected_orders,
                **conflict_details
            }
        )


class CapacityConsistencyError(PrintQueueException):
    def __init__(self, log_no: str, existing_log: Dict, attempted_override: Dict):
        super().__init__(
            error_code="CAPACITY_CONSISTENCY_ERROR",
            error_message="不能静默覆盖原产能日志记录",
            error_details={
                "log_no": log_no,
                "existing_log": existing_log,
                "attempted_override": attempted_override
            }
        )


class OrderNotFoundError(PrintQueueException):
    def __init__(self, order_no: str):
        super().__init__(
            error_code="ORDER_NOT_FOUND",
            error_message=f"订单不存在: {order_no}",
            error_details={"order_no": order_no}
        )


class OrderAlreadyExistsError(PrintQueueException):
    def __init__(self, order_no: str):
        super().__init__(
            error_code="ORDER_ALREADY_EXISTS",
            error_message=f"订单已存在: {order_no}",
            error_details={"order_no": order_no}
        )


class InvalidQueuePositionError(PrintQueueException):
    def __init__(self, target_position: int, max_position: int):
        super().__init__(
            error_code="INVALID_QUEUE_POSITION",
            error_message="无效的插队位置",
            error_details={
                "target_position": target_position,
                "valid_range": f"1-{max_position}"
            }
        )


class StatusTransitionError(PrintQueueException):
    def __init__(self, current_status: str, target_status: str):
        super().__init__(
            error_code="STATUS_TRANSITION_ERROR",
            error_message="无效的状态转换",
            error_details={
                "current_status": current_status,
                "target_status": target_status,
                "allowed_transitions": {
                    "normal": ["rejected", "supplemented", "completed"],
                    "supplemented": ["completed", "rejected"],
                    "rejected": [],
                    "completed": []
                }
            }
        )


class ImportValidationError(PrintQueueException):
    def __init__(self, row_index: int, validation_errors: Dict):
        super().__init__(
            error_code="IMPORT_VALIDATION_ERROR",
            error_message=f"第 {row_index} 行数据验证失败",
            error_details={
                "row_index": row_index,
                "validation_errors": validation_errors
            }
        )
