import json
from datetime import datetime
from models import db, ConfirmationRecord, ConfirmationType, RepairException, RepairOrder
from services.status_service import StatusService
from services.exception_service import ExceptionService
from models import ExceptionStatus


class ConfirmationService:
    @staticmethod
    def _take_snapshot(entity):
        if entity is None:
            return None
        data = {}
        for col in entity.__table__.columns:
            val = getattr(entity, col.name)
            if hasattr(val, 'isoformat'):
                data[col.name] = val.isoformat()
            elif hasattr(val, 'value'):
                data[col.name] = val.value
            else:
                data[col.name] = str(val) if val is not None else None
        return json.dumps(data, ensure_ascii=False)

    @staticmethod
    def confirm_exception(exception_id, confirmed_by, confirmation_note=None,
                          resolve_exception=False, resolution_note=None):
        exception = RepairException.query.get(exception_id)
        if not exception:
            return None

        before_snapshot = ConfirmationService._take_snapshot(exception)

        from models import ConfirmationType
        type_map = {
            "备件晚到": ConfirmationType.SPARE_PART_DELAY_ACK,
            "重复派修": ConfirmationType.DUPLICATE_REPAIR_ACK,
            "演出前未归还": ConfirmationType.OVERRIDE_RETURN_DEADLINE,
        }
        conf_type = type_map.get(exception.exception_type.value, ConfirmationType.SPARE_PART_DELAY_ACK)

        StatusService.change_exception_status(
            exception,
            ExceptionStatus.ACKNOWLEDGED,
            change_reason=f"人工确认: {confirmation_note or '已知悉并确认该例外情况'}",
            operated_by=confirmed_by
        )

        exception.acknowledged_at = datetime.now()
        exception.acknowledged_by = confirmed_by
        exception.acknowledge_note = confirmation_note

        if resolve_exception:
            StatusService.change_exception_status(
                exception,
                ExceptionStatus.RESOLVED,
                change_reason=resolution_note or "已通过人工确认解决",
                operated_by=confirmed_by
            )
            exception.resolved_at = datetime.now()
            exception.resolved_by = confirmed_by
            exception.resolution_note = resolution_note

        after_snapshot = ConfirmationService._take_snapshot(exception)

        confirmation = ConfirmationRecord(
            confirmation_type=conf_type,
            exception_id=exception.id,
            repair_order_id=exception.repair_order_id,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            confirmed_by=confirmed_by,
            confirmed_at=datetime.now(),
            confirmation_note=confirmation_note
        )
        db.session.add(confirmation)
        db.session.flush()

        return confirmation

    @staticmethod
    def confirm_repair_completion(repair_order_id, confirmed_by, quality_check_note=None):
        order = RepairOrder.query.get(repair_order_id)
        if not order:
            return None

        before_snapshot = ConfirmationService._take_snapshot(order)

        from models import RepairOrderStatus
        StatusService.change_repair_order_status(
            order,
            RepairOrderStatus.COMPLETED,
            change_reason=f"维修完成确认: {quality_check_note or '维修完成，质检通过'}",
            operated_by=confirmed_by
        )

        order.actual_complete_date = date.today()
        order.quality_check_note = quality_check_note

        after_snapshot = ConfirmationService._take_snapshot(order)

        confirmation = ConfirmationRecord(
            confirmation_type=ConfirmationType.REPAIR_COMPLETION,
            repair_order_id=order.id,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            confirmed_by=confirmed_by,
            confirmed_at=datetime.now(),
            confirmation_note=quality_check_note
        )
        db.session.add(confirmation)
        db.session.flush()

        return confirmation

    @staticmethod
    def confirm_instrument_return(repair_order_id, confirmed_by, return_note=None):
        order = RepairOrder.query.get(repair_order_id)
        if not order:
            return None

        before_snapshot = ConfirmationService._take_snapshot(order)

        from models import RepairOrderStatus
        StatusService.change_repair_order_status(
            order,
            RepairOrderStatus.RETURNED,
            change_reason=f"乐器归还确认: {return_note or '乐器已归还，验收通过'}",
            operated_by=confirmed_by
        )

        order.actual_return_date = date.today()

        after_snapshot = ConfirmationService._take_snapshot(order)

        confirmation = ConfirmationRecord(
            confirmation_type=ConfirmationType.INSTRUMENT_RETURN,
            repair_order_id=order.id,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            confirmed_by=confirmed_by,
            confirmed_at=datetime.now(),
            confirmation_note=return_note
        )
        db.session.add(confirmation)
        db.session.flush()

        ExceptionService.resolve_return_deadline_exception(order.id, confirmed_by, return_note)

        return confirmation

    @staticmethod
    def get_confirmation_history(repair_order_id=None, exception_id=None):
        query = ConfirmationRecord.query
        if repair_order_id:
            query = query.filter_by(repair_order_id=repair_order_id)
        if exception_id:
            query = query.filter_by(exception_id=exception_id)
        return query.order_by(ConfirmationRecord.confirmed_at.desc()).all()


from datetime import date
