from datetime import datetime
from models import db, StatusHistory, RepairOrder, SparePartOrder, RepairException
from models import RepairOrderStatus, SparePartOrderStatus, ExceptionStatus, InstrumentStatus


class StatusService:
    @staticmethod
    def _record_history(entity_type, entity_id, from_status, to_status, change_reason=None, operated_by=None):
        history = StatusHistory(
            entity_type=entity_type,
            entity_id=entity_id,
            from_status=from_status,
            to_status=to_status,
            change_reason=change_reason,
            operated_by=operated_by,
            created_at=datetime.now()
        )
        db.session.add(history)
        return history

    @staticmethod
    def change_repair_order_status(repair_order, new_status, change_reason=None, operated_by=None):
        if isinstance(new_status, RepairOrderStatus):
            new_status_value = new_status.value
        else:
            new_status_value = new_status

        old_status = repair_order.status.value if repair_order.status else None

        if old_status == new_status_value:
            return None

        StatusService._record_history(
            entity_type="RepairOrder",
            entity_id=repair_order.id,
            from_status=old_status,
            to_status=new_status_value,
            change_reason=change_reason,
            operated_by=operated_by
        )

        if isinstance(new_status, RepairOrderStatus):
            repair_order.status = new_status
        else:
            repair_order.status = RepairOrderStatus(new_status)

        StatusService._sync_instrument_status(repair_order, new_status_value)

        db.session.flush()
        return repair_order

    @staticmethod
    def _sync_instrument_status(repair_order, repair_status):
        instrument = repair_order.instrument
        if not instrument:
            return

        status_map = {
            RepairOrderStatus.DRAFT.value: InstrumentStatus.AVAILABLE,
            RepairOrderStatus.ASSIGNED.value: InstrumentStatus.IN_REPAIR,
            RepairOrderStatus.IN_PROGRESS.value: InstrumentStatus.IN_REPAIR,
            RepairOrderStatus.WAITING_SPARE.value: InstrumentStatus.WAITING_SPARE,
            RepairOrderStatus.COMPLETED.value: InstrumentStatus.REPAIRED,
            RepairOrderStatus.RETURNED.value: InstrumentStatus.AVAILABLE,
            RepairOrderStatus.CANCELLED.value: InstrumentStatus.AVAILABLE,
        }

        if repair_status in status_map:
            instrument.status = status_map[repair_status]

    @staticmethod
    def change_spare_part_order_status(spare_order, new_status, change_reason=None, operated_by=None):
        if isinstance(new_status, SparePartOrderStatus):
            new_status_value = new_status.value
        else:
            new_status_value = new_status

        old_status = spare_order.status.value if spare_order.status else None

        if old_status == new_status_value:
            return None

        StatusService._record_history(
            entity_type="SparePartOrder",
            entity_id=spare_order.id,
            from_status=old_status,
            to_status=new_status_value,
            change_reason=change_reason,
            operated_by=operated_by
        )

        if isinstance(new_status, SparePartOrderStatus):
            spare_order.status = new_status
        else:
            spare_order.status = SparePartOrderStatus(new_status)

        db.session.flush()
        return spare_order

    @staticmethod
    def change_exception_status(exception, new_status, change_reason=None, operated_by=None):
        if isinstance(new_status, ExceptionStatus):
            new_status_value = new_status.value
        else:
            new_status_value = new_status

        old_status = exception.status.value if exception.status else None

        if old_status == new_status_value:
            return None

        StatusService._record_history(
            entity_type="RepairException",
            entity_id=exception.id,
            from_status=old_status,
            to_status=new_status_value,
            change_reason=change_reason,
            operated_by=operated_by
        )

        if isinstance(new_status, ExceptionStatus):
            exception.status = new_status
        else:
            exception.status = ExceptionStatus(new_status)

        db.session.flush()
        return exception

    @staticmethod
    def get_entity_history(entity_type, entity_id):
        return StatusHistory.query.filter_by(
            entity_type=entity_type,
            entity_id=entity_id
        ).order_by(StatusHistory.created_at.asc()).all()
