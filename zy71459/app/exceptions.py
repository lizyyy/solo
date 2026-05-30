from fastapi import HTTPException, status


class SchedulingException(HTTPException):
    def __init__(self, detail: str, code: str = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": detail,
                "code": code or "scheduling_error"
            }
        )


class ResourceNotFoundException(HTTPException):
    def __init__(self, resource_type: str, resource_id: int):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": f"{resource_type} ID {resource_id} 不存在",
                "code": "resource_not_found"
            }
        )


class InvalidBookingException(SchedulingException):
    def __init__(self, detail: str):
        super().__init__(detail, code="invalid_booking")


class ConflictException(SchedulingException):
    def __init__(self, detail: str, conflict_type: str):
        super().__init__(detail, code=f"conflict_{conflict_type}")


class CapacityExceededException(SchedulingException):
    def __init__(self, required: int, available: int):
        super().__init__(
            f"容量不足: 需要 {required} 人, 最大可用 {available} 人",
            code="capacity_exceeded"
        )


class EquipmentUnavailableException(SchedulingException):
    def __init__(self, equipment_name: str, required: int, available: int):
        super().__init__(
            f"设备 {equipment_name} 不足: 需要 {required} 件, 可用 {available} 件",
            code="equipment_unavailable"
        )


class TimeSlotOccupiedException(SchedulingException):
    def __init__(self, room_id: int, start_time: str, end_time: str):
        super().__init__(
            f"房间 {room_id} 在 {start_time}-{end_time} 已被占用",
            code="time_slot_occupied"
        )


class BatchProcessingException(SchedulingException):
    def __init__(self, detail: str, batch_id: str = None):
        msg = f"批次处理失败: {detail}"
        if batch_id:
            msg = f"批次 {batch_id}: {detail}"
        super().__init__(msg, code="batch_processing_error")
