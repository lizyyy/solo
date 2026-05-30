from datetime import datetime, date
from models import (
    db, RepairOrder, RepairOrderStatus, SparePartUsage,
    FaultRecord, SparePart, Instrument, Performance, PerformanceInstrument,
    SparePartOrder, SparePartOrderStatus
)
from services.status_service import StatusService
from services.exception_service import ExceptionService
from services.reminder_service import ReminderService
import random
import string


class RepairService:
    @staticmethod
    def _generate_order_no():
        prefix = f"RO{date.today().strftime('%Y%m%d')}"
        suffix = ''.join(random.choices(string.digits, k=4))
        return f"{prefix}{suffix}"

    @staticmethod
    def _calculate_return_deadline(instrument_id, scheduled_complete_date):
        if not scheduled_complete_date:
            return None

        performances = Performance.query.join(
            PerformanceInstrument,
            PerformanceInstrument.performance_id == Performance.id
        ).filter(
            PerformanceInstrument.instrument_id == instrument_id,
            Performance.performance_date >= scheduled_complete_date
        ).order_by(Performance.performance_date.asc()).first()

        if performances:
            return min(scheduled_complete_date, performances.performance_date)
        return scheduled_complete_date

    @staticmethod
    def create_repair_order(data, created_by=None):
        instrument = Instrument.query.get(data['instrument_id'])
        if not instrument:
            raise ValueError(f"乐器ID {data['instrument_id']} 不存在")

        order_no = data.get('order_no') or RepairService._generate_order_no()

        scheduled_start = data.get('scheduled_start_date')
        if isinstance(scheduled_start, str):
            scheduled_start = datetime.strptime(scheduled_start, '%Y-%m-%d').date()

        scheduled_complete = data.get('scheduled_complete_date')
        if isinstance(scheduled_complete, str):
            scheduled_complete = datetime.strptime(scheduled_complete, '%Y-%m-%d').date()

        return_deadline = data.get('return_deadline')
        if isinstance(return_deadline, str):
            return_deadline = datetime.strptime(return_deadline, '%Y-%m-%d').date()

        if not return_deadline:
            return_deadline = RepairService._calculate_return_deadline(
                data['instrument_id'], scheduled_complete
            )

        order = RepairOrder(
            order_no=order_no,
            instrument_id=data['instrument_id'],
            fault_record_id=data.get('fault_record_id'),
            priority=data.get('priority', '普通'),
            description=data['description'],
            repair_type=data.get('repair_type'),
            estimated_hours=data.get('estimated_hours'),
            scheduled_start_date=scheduled_start,
            scheduled_complete_date=scheduled_complete,
            return_deadline=return_deadline,
            created_by=created_by,
            status=RepairOrderStatus.DRAFT
        )

        db.session.add(order)
        db.session.flush()

        StatusService._record_history(
            entity_type="RepairOrder",
            entity_id=order.id,
            from_status=None,
            to_status=order.status.value,
            change_reason="创建维修工单",
            operated_by=created_by
        )

        ExceptionService.detect_duplicate_repair(data['instrument_id'], new_repair_order_id=order.id)

        if data.get('fault_record_id'):
            fault = FaultRecord.query.get(data['fault_record_id'])
            if fault:
                fault.is_resolved = False

        db.session.flush()
        return order

    @staticmethod
    def assign_technician(repair_order_id, technician_id, scheduled_start_date=None,
                          scheduled_complete_date=None, operated_by=None):
        order = RepairOrder.query.get(repair_order_id)
        if not order:
            raise ValueError(f"维修工单ID {repair_order_id} 不存在")

        from models import Technician
        tech = Technician.query.get(technician_id)
        if not tech:
            raise ValueError(f"维修师ID {technician_id} 不存在")

        ExceptionService.detect_duplicate_repair(order.instrument_id, new_repair_order_id=order.id)

        order.technician_id = technician_id
        if scheduled_start_date:
            order.scheduled_start_date = scheduled_start_date
        if scheduled_complete_date:
            order.scheduled_complete_date = scheduled_complete_date
            if not order.return_deadline or order.return_deadline > scheduled_complete_date:
                order.return_deadline = RepairService._calculate_return_deadline(
                    order.instrument_id, scheduled_complete_date
                )

        StatusService.change_repair_order_status(
            order,
            RepairOrderStatus.ASSIGNED,
            change_reason=f"派工给维修师【{tech.name}】",
            operated_by=operated_by
        )

        db.session.flush()
        return order

    @staticmethod
    def start_repair(repair_order_id, operated_by=None):
        order = RepairOrder.query.get(repair_order_id)
        if not order:
            raise ValueError(f"维修工单ID {repair_order_id} 不存在")

        if order.status not in [RepairOrderStatus.ASSIGNED, RepairOrderStatus.WAITING_SPARE]:
            raise ValueError(f"当前状态 {order.status.value} 不能开始维修")

        order.actual_start_date = date.today()

        StatusService.change_repair_order_status(
            order,
            RepairOrderStatus.IN_PROGRESS,
            change_reason="维修师开始维修",
            operated_by=operated_by
        )

        db.session.flush()
        return order

    @staticmethod
    def add_spare_part_usage(repair_order_id, spare_part_id, quantity, used_by=None, remarks=None):
        order = RepairOrder.query.get(repair_order_id)
        if not order:
            raise ValueError(f"维修工单ID {repair_order_id} 不存在")

        spare_part = SparePart.query.get(spare_part_id)
        if not spare_part:
            raise ValueError(f"备件ID {spare_part_id} 不存在")

        if spare_part.stock_quantity < quantity:
            raise ValueError(f"备件库存不足，当前库存: {spare_part.stock_quantity}")

        usage = SparePartUsage(
            repair_order_id=repair_order_id,
            spare_part_id=spare_part_id,
            quantity=quantity,
            used_by=used_by,
            remarks=remarks
        )
        db.session.add(usage)

        spare_part.stock_quantity -= quantity

        db.session.flush()
        return usage

    @staticmethod
    def create_spare_part_order_for_repair(repair_order_id, spare_part_id, quantity,
                                            expected_arrival_date, supplier=None,
                                            operated_by=None):
        order = RepairOrder.query.get(repair_order_id)
        if not order:
            raise ValueError(f"维修工单ID {repair_order_id} 不存在")

        spare_part = SparePart.query.get(spare_part_id)
        if not spare_part:
            raise ValueError(f"备件ID {spare_part_id} 不存在")

        prefix = f"SPO{date.today().strftime('%Y%m%d')}"
        suffix = ''.join(random.choices(string.digits, k=4))
        order_no = f"{prefix}{suffix}"

        if isinstance(expected_arrival_date, str):
            expected_arrival_date = datetime.strptime(expected_arrival_date, '%Y-%m-%d').date()

        spare_order = SparePartOrder(
            spare_part_id=spare_part_id,
            order_no=order_no,
            quantity=quantity,
            unit_price=spare_part.unit_price,
            total_amount=spare_part.unit_price * quantity if spare_part.unit_price else None,
            supplier=supplier or spare_part.supplier,
            expected_arrival_date=expected_arrival_date,
            repair_order_id=repair_order_id,
            status=SparePartOrderStatus.ORDERED
        )

        db.session.add(spare_order)
        db.session.flush()

        StatusService._record_history(
            entity_type="SparePartOrder",
            entity_id=spare_order.id,
            from_status=None,
            to_status=spare_order.status.value,
            change_reason=f"为维修工单 {order.order_no} 创建备件订单",
            operated_by=operated_by
        )

        if order.status == RepairOrderStatus.IN_PROGRESS:
            StatusService.change_repair_order_status(
                order,
                RepairOrderStatus.WAITING_SPARE,
                change_reason=f"已下单采购备件 {spare_part.name}，等待到货",
                operated_by=operated_by
            )

        ReminderService.create_reminder(
            entity_type="RepairOrder",
            entity_id=repair_order_id,
            reminder_type="备件采购提醒",
            title=f"已创建备件采购订单 {order_no}",
            content=f"为维修工单 {order.order_no} 采购备件 {spare_part.name} x {quantity}，预计到货 {expected_arrival_date}",
            priority="普通",
            due_date=expected_arrival_date
        )

        db.session.flush()
        return spare_order

    @staticmethod
    def cancel_repair_order(repair_order_id, cancel_reason, operated_by=None):
        order = RepairOrder.query.get(repair_order_id)
        if not order:
            raise ValueError(f"维修工单ID {repair_order_id} 不存在")

        if order.status == RepairOrderStatus.CANCELLED:
            return order

        StatusService.change_repair_order_status(
            order,
            RepairOrderStatus.CANCELLED,
            change_reason=f"取消维修工单: {cancel_reason}",
            operated_by=operated_by
        )

        db.session.flush()
        return order
