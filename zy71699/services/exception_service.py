from datetime import datetime, date
from models import (
    db, RepairException, ExceptionType, ExceptionStatus,
    RepairOrder, SparePartOrder, Performance, PerformanceInstrument,
    RepairOrderStatus, SparePartOrderStatus, InstrumentStatus
)
from services.status_service import StatusService
from services.reminder_service import ReminderService


class ExceptionService:
    @staticmethod
    def _create_exception(exception_type, description, repair_order_id=None,
                          spare_part_order_id=None, performance_id=None,
                          technician_id=None):
        exception = RepairException(
            exception_type=exception_type,
            status=ExceptionStatus.DETECTED,
            repair_order_id=repair_order_id,
            spare_part_order_id=spare_part_order_id,
            performance_id=performance_id,
            technician_id=technician_id,
            description=description,
            detected_at=datetime.now()
        )
        db.session.add(exception)
        db.session.flush()

        ReminderService.create_reminder(
            entity_type="RepairException",
            entity_id=exception.id,
            reminder_type="业务例外提醒",
            title=f"发现业务例外：{exception_type.value}",
            content=description,
            priority="高"
        )

        return exception

    @staticmethod
    def detect_spare_part_delay(spare_part_order_id):
        spare_order = SparePartOrder.query.get(spare_part_order_id)
        if not spare_order:
            return None

        if spare_order.status in [SparePartOrderStatus.ARRIVED, SparePartOrderStatus.RECEIVED,
                                  SparePartOrderStatus.CANCELLED]:
            return None

        today = date.today()
        expected = spare_order.expected_arrival_date

        if expected and today > expected:
            days_late = (today - expected).days

            existing = RepairException.query.filter_by(
                exception_type=ExceptionType.SPARE_PART_DELAY,
                spare_part_order_id=spare_part_order_id
            ).filter(
                RepairException.status.in_([ExceptionStatus.DETECTED, ExceptionStatus.ACKNOWLEDGED])
            ).first()

            if not existing:
                description = (
                    f"备件【{spare_order.spare_part_rel.name}】订单 {spare_order.order_no} "
                    f"预计到货日期 {expected}，实际已延误 {days_late} 天。"
                )
                if spare_order.repair_order_id:
                    description += (
                        f"关联维修工单 {spare_order.repair_order_id} "
                        f"(乐器: {spare_order.repair_order.instrument.name})"
                    )

                exception = ExceptionService._create_exception(
                    exception_type=ExceptionType.SPARE_PART_DELAY,
                    description=description,
                    spare_part_order_id=spare_part_order_id,
                    repair_order_id=spare_order.repair_order_id
                )

                StatusService.change_spare_part_order_status(
                    spare_order,
                    SparePartOrderStatus.DELAYED,
                    change_reason=f"备件到货延误，已产生业务例外 #{exception.id}",
                    operated_by="系统自动检测"
                )

                if spare_order.repair_order_id:
                    repair_order = RepairOrder.query.get(spare_order.repair_order_id)
                    if repair_order and repair_order.status == RepairOrderStatus.IN_PROGRESS:
                        StatusService.change_repair_order_status(
                            repair_order,
                            RepairOrderStatus.WAITING_SPARE,
                            change_reason=f"等待备件：订单 {spare_order.order_no} 延误",
                            operated_by="系统自动检测"
                        )

                return exception

        return None

    @staticmethod
    def detect_duplicate_repair(instrument_id, new_repair_order_id=None):
        instrument = RepairOrder.query.filter(
            RepairOrder.instrument_id == instrument_id,
            RepairOrder.status.notin_([
                RepairOrderStatus.RETURNED.value,
                RepairOrderStatus.CANCELLED.value
            ])
        ).all()

        if len(instrument) >= 2:
            order_ids = [o.order_no for o in instrument]

            for order in instrument:
                if new_repair_order_id and order.id == new_repair_order_id:
                    continue

                existing = RepairException.query.filter_by(
                    exception_type=ExceptionType.DUPLICATE_REPAIR,
                    repair_order_id=order.id
                ).filter(
                    RepairException.status.in_([ExceptionStatus.DETECTED, ExceptionStatus.ACKNOWLEDGED])
                ).first()

                if not existing:
                    description = (
                        f"乐器【{order.instrument.name}】存在 {len(instrument)} 个未完成维修工单："
                        f"{', '.join(order_ids)}。存在重复派修风险。"
                    )

                    ExceptionService._create_exception(
                        exception_type=ExceptionType.DUPLICATE_REPAIR,
                        description=description,
                        repair_order_id=order.id
                    )

            return instrument

        return None

    @staticmethod
    def detect_not_returned_before_performance():
        today = date.today()
        performances = Performance.query.filter(
            Performance.performance_date >= today
        ).order_by(Performance.performance_date.asc()).all()

        exceptions = []

        for perf in performances:
            days_to_perf = (perf.performance_date - today).days

            for pi in perf.required_instruments:
                instrument = pi.instrument
                if not instrument:
                    continue

                if instrument.status in [InstrumentStatus.IN_REPAIR,
                                         InstrumentStatus.WAITING_SPARE]:
                    active_orders = RepairOrder.query.filter_by(
                        instrument_id=instrument.id
                    ).filter(
                        RepairOrder.status.notin_([
                            RepairOrderStatus.RETURNED.value,
                            RepairOrderStatus.CANCELLED.value
                        ])
                    ).all()

                    for order in active_orders:
                        return_deadline = order.return_deadline
                        needs_attention = False
                        description = ""

                        if return_deadline and return_deadline >= perf.performance_date:
                            needs_attention = True
                            description = (
                                f"演出【{perf.name}】({perf.performance_date}) 需要使用乐器【{instrument.name}】，"
                                f"但该乐器维修工单 {order.order_no} 的预计归还日期 {return_deadline} "
                                f"晚于演出日期，演出前无法归还。"
                            )
                        elif return_deadline and days_to_perf <= 3 and order.status != RepairOrderStatus.COMPLETED:
                            needs_attention = True
                            description = (
                                f"演出【{perf.name}】({perf.performance_date}) 还有 {days_to_perf} 天，"
                                f"乐器【{instrument.name}】维修工单 {order.order_no} 仍处于【{order.status.value}】状态，"
                                f"预计归还 {return_deadline}，存在无法按时归还的风险。"
                            )

                        if needs_attention:
                            existing = RepairException.query.filter_by(
                                exception_type=ExceptionType.NOT_RETURNED_BEFORE_PERFORMANCE,
                                repair_order_id=order.id,
                                performance_id=perf.id
                            ).filter(
                                RepairException.status.in_([ExceptionStatus.DETECTED, ExceptionStatus.ACKNOWLEDGED])
                            ).first()

                            if not existing:
                                exception = ExceptionService._create_exception(
                                    exception_type=ExceptionType.NOT_RETURNED_BEFORE_PERFORMANCE,
                                    description=description,
                                    repair_order_id=order.id,
                                    performance_id=perf.id
                                )
                                exceptions.append(exception)

        return exceptions

    @staticmethod
    def run_all_exception_checks():
        results = {
            "spare_part_delays": [],
            "duplicate_repairs": [],
            "not_returned_before_performance": []
        }

        spare_orders = SparePartOrder.query.filter(
            SparePartOrder.status.in_([
                SparePartOrderStatus.ORDERED.value,
                SparePartOrderStatus.SHIPPED.value
            ])
        ).all()
        for order in spare_orders:
            exc = ExceptionService.detect_spare_part_delay(order.id)
            if exc:
                results["spare_part_delays"].append(exc)

        instruments_with_active = db.session.query(RepairOrder.instrument_id).filter(
            RepairOrder.status.notin_([
                RepairOrderStatus.RETURNED.value,
                RepairOrderStatus.CANCELLED.value
            ])
        ).distinct().all()
        for (inst_id,) in instruments_with_active:
            exc = ExceptionService.detect_duplicate_repair(inst_id)
            if exc:
                results["duplicate_repairs"].extend(exc)

        perf_exc = ExceptionService.detect_not_returned_before_performance()
        if perf_exc:
            results["not_returned_before_performance"].extend(perf_exc)

        ReminderService.check_and_create_return_deadline_reminders()
        ReminderService.check_and_create_spare_arrival_reminders()

        return results

    @staticmethod
    def resolve_return_deadline_exception(repair_order_id, resolved_by, resolution_note=None):
        exceptions = RepairException.query.filter_by(
            exception_type=ExceptionType.NOT_RETURNED_BEFORE_PERFORMANCE,
            repair_order_id=repair_order_id,
            status=ExceptionStatus.DETECTED
        ).all()

        for exc in exceptions:
            StatusService.change_exception_status(
                exc,
                ExceptionStatus.RESOLVED,
                change_reason=resolution_note or "乐器已按时归还",
                operated_by=resolved_by
            )
            exc.resolved_at = datetime.now()
            exc.resolved_by = resolved_by
            exc.resolution_note = resolution_note or "乐器已按时归还"

        db.session.flush()
        return exceptions
