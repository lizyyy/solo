import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import (
    Customer, Prescription, LensOrder, Frame, DegreeChangeRecord,
    ProcessingStatusHistory, PickupReport, ProcessingStatus, ChangeStatus
)
import schemas


class OrderNumberGenerator:
    @staticmethod
    def generate() -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        unique_id = str(uuid.uuid4())[:8].upper()
        return f"OD{date_str}{unique_id}"


class ReportNumberGenerator:
    @staticmethod
    def generate() -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        unique_id = str(uuid.uuid4())[:6].upper()
        return f"PR{date_str}{unique_id}"


class DegreeVersionService:
    @staticmethod
    def create_new_version(db: Session, prescription_id: int, changes: Dict[str, Any], created_by: str) -> Prescription:
        old_prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
        if not old_prescription:
            raise ValueError(f"Prescription {prescription_id} not found")

        new_version = old_prescription.version + 1

        old_prescription.is_active = False

        new_prescription_data = {
            "customer_id": old_prescription.customer_id,
            "version": new_version,
            "is_active": True,
            "optometrist": old_prescription.optometrist,
            "exam_date": datetime.now(),
            "expires_at": old_prescription.expires_at,
            "od_sphere": changes.get("od_sphere", old_prescription.od_sphere),
            "od_cylinder": changes.get("od_cylinder", old_prescription.od_cylinder),
            "od_axis": changes.get("od_axis", old_prescription.od_axis),
            "od_add": changes.get("od_add", old_prescription.od_add),
            "os_sphere": changes.get("os_sphere", old_prescription.os_sphere),
            "os_cylinder": changes.get("os_cylinder", old_prescription.os_cylinder),
            "os_axis": changes.get("os_axis", old_prescription.os_axis),
            "os_add": changes.get("os_add", old_prescription.os_add),
            "pd_distance": changes.get("pd_distance", old_prescription.pd_distance),
            "pd_near": changes.get("pd_near", old_prescription.pd_near),
            "notes": f"版本升级自 v{old_prescription.version}",
            "created_by": created_by
        }

        new_prescription = Prescription(**new_prescription_data)
        db.add(new_prescription)
        db.flush()
        return new_prescription


class ProcessingStateMachine:
    VALID_TRANSITIONS = {
        ProcessingStatus.PENDING: [ProcessingStatus.LENS_PREPARING, ProcessingStatus.CANCELLED, ProcessingStatus.ON_HOLD],
        ProcessingStatus.LENS_PREPARING: [ProcessingStatus.LENS_CUTTING, ProcessingStatus.PENDING, ProcessingStatus.CANCELLED, ProcessingStatus.ON_HOLD],
        ProcessingStatus.LENS_CUTTING: [ProcessingStatus.LENS_POLISHING, ProcessingStatus.LENS_PREPARING, ProcessingStatus.CANCELLED, ProcessingStatus.ON_HOLD],
        ProcessingStatus.LENS_POLISHING: [ProcessingStatus.FRAME_FITTING, ProcessingStatus.LENS_CUTTING, ProcessingStatus.CANCELLED, ProcessingStatus.ON_HOLD],
        ProcessingStatus.FRAME_FITTING: [ProcessingStatus.QUALITY_CHECK, ProcessingStatus.LENS_POLISHING, ProcessingStatus.CANCELLED, ProcessingStatus.ON_HOLD],
        ProcessingStatus.QUALITY_CHECK: [ProcessingStatus.READY_FOR_PICKUP, ProcessingStatus.FRAME_FITTING, ProcessingStatus.CANCELLED, ProcessingStatus.ON_HOLD],
        ProcessingStatus.READY_FOR_PICKUP: [ProcessingStatus.PICKED_UP, ProcessingStatus.QUALITY_CHECK, ProcessingStatus.CANCELLED, ProcessingStatus.ON_HOLD],
        ProcessingStatus.PICKED_UP: [],
        ProcessingStatus.CANCELLED: [],
        ProcessingStatus.ON_HOLD: [ProcessingStatus.PENDING, ProcessingStatus.LENS_PREPARING, ProcessingStatus.CANCELLED]
    }

    @classmethod
    def can_transition(cls, from_status: ProcessingStatus, to_status: ProcessingStatus) -> bool:
        return to_status in cls.VALID_TRANSITIONS.get(from_status, [])

    @classmethod
    def transition(cls, db: Session, lens_order: LensOrder, new_status: ProcessingStatus, changed_by: str, notes: str = None) -> Tuple[bool, str]:
        old_status = ProcessingStatus(lens_order.status)

        if old_status == new_status:
            return True, "状态未改变"

        if not cls.can_transition(old_status, new_status):
            return False, f"无效的状态转换: {old_status.value} -> {new_status.value}"

        history = ProcessingStatusHistory(
            lens_order_id=lens_order.id,
            from_status=old_status.value,
            to_status=new_status.value,
            changed_by=changed_by,
            notes=notes
        )
        db.add(history)

        lens_order.status = new_status.value
        lens_order.status_updated_at = datetime.now()
        lens_order.status_updated_by = changed_by

        if new_status == ProcessingStatus.READY_FOR_PICKUP:
            PickupService.create_or_update_pickup_report(db, lens_order.id)

        return True, "状态更新成功"


class DegreeChangeInterceptor:
    NON_INTERCEPTABLE_STATUSES = {
        ProcessingStatus.QUALITY_CHECK,
        ProcessingStatus.READY_FOR_PICKUP,
        ProcessingStatus.PICKED_UP,
        ProcessingStatus.CANCELLED
    }

    @classmethod
    def can_apply_change(cls, lens_order: LensOrder) -> Tuple[bool, str]:
        status = ProcessingStatus(lens_order.status)

        if status in cls.NON_INTERCEPTABLE_STATUSES:
            return False, f"订单当前状态 '{status.value}' 不允许修改度数，已进入质检或后续阶段"

        if status == ProcessingStatus.LENS_POLISHING:
            return False, "镜片已进入抛光阶段，无法修改度数"

        if status == ProcessingStatus.LENS_CUTTING:
            pending_changes = lens_order.change_records
            if len(pending_changes) >= 2:
                return False, "已达到最大改度次数限制"

        return True, "可以应用改度"

    @classmethod
    def check_and_record(cls, db: Session, change_request: schemas.DegreeChangeRequest, lens_order: LensOrder) -> DegreeChangeRecord:
        can_apply, interception_reason = cls.can_apply_change(lens_order)

        original_prescription = db.query(Prescription).filter(Prescription.id == lens_order.prescription_id).first()

        changes = {}
        change_fields = []
        for field in ['od_sphere', 'od_cylinder', 'od_axis', 'od_add', 'os_sphere', 'os_cylinder', 'os_axis', 'os_add', 'pd_distance', 'pd_near']:
            new_value = getattr(change_request, field)
            if new_value is not None:
                old_value = getattr(original_prescription, field)
                if old_value != new_value:
                    changes[field] = new_value
                    change_fields.append(f"{field}: {old_value} -> {new_value}")

        if not changes:
            raise ValueError("未提供有效的度数变更")

        change_type = "full_prescription" if len(changes) >= 3 else "partial_adjustment"

        record = DegreeChangeRecord(
            lens_order_id=lens_order.id,
            prescription_id=original_prescription.id,
            change_type=change_type,
            original_value=json.dumps({f: getattr(original_prescription, f) for f in changes.keys()}, ensure_ascii=False),
            new_value=json.dumps(changes, ensure_ascii=False),
            reason=change_request.reason,
            status=ChangeStatus.PENDING_REVIEW if can_apply else ChangeStatus.REJECTED,
            can_apply=can_apply,
            interception_reason=interception_reason if not can_apply else None,
            requested_by=change_request.requested_by,
            raw_input=change_request.model_dump_json()
        )

        db.add(record)
        db.flush()

        if not can_apply:
            record.processing_conclusion = f"自动拦截: {interception_reason}"
            db.flush()

        return record


class PickupService:
    @staticmethod
    def create_or_update_pickup_report(db: Session, lens_order_id: int) -> PickupReport:
        report = db.query(PickupReport).filter(PickupReport.lens_order_id == lens_order_id).first()

        if not report:
            report = PickupReport(
                lens_order_id=lens_order_id,
                report_no=ReportNumberGenerator.generate(),
                pickup_ready_date=datetime.now()
            )
            db.add(report)
        else:
            report.pickup_ready_date = datetime.now()

        db.flush()
        return report

    @staticmethod
    def get_or_create_report(db: Session, lens_order_id: int) -> PickupReport:
        report = db.query(PickupReport).filter(PickupReport.lens_order_id == lens_order_id).first()
        if not report:
            lens_order = db.query(LensOrder).filter(LensOrder.id == lens_order_id).first()
            if not lens_order:
                raise ValueError(f"订单 {lens_order_id} 不存在")
            if lens_order.status != ProcessingStatus.READY_FOR_PICKUP.value:
                raise ValueError(f"订单状态不是待取件，当前状态: {lens_order.status}")

            report = PickupReport(
                lens_order_id=lens_order_id,
                report_no=ReportNumberGenerator.generate(),
                pickup_ready_date=lens_order.status_updated_at or datetime.now()
            )
            db.add(report)
            db.flush()
        return report

    @staticmethod
    def send_reminder(db: Session, lens_order_id: int, reminder_type: str, sent_by: str, notes: str = None) -> PickupReport:
        report = PickupService.get_or_create_report(db, lens_order_id)

        now = datetime.now()

        if reminder_type == "first":
            report.first_reminder_sent = True
            report.first_reminder_date = now
        elif reminder_type == "second":
            report.second_reminder_sent = True
            report.second_reminder_date = now
        else:
            if not report.first_reminder_sent:
                report.first_reminder_sent = True
                report.first_reminder_date = now
            else:
                report.second_reminder_sent = True
                report.second_reminder_date = now

        lens_order = db.query(LensOrder).filter(LensOrder.id == lens_order_id).first()
        if lens_order:
            lens_order.pickup_reminder_sent = True

        db.flush()
        return report

    @staticmethod
    def confirm_pickup(db: Session, lens_order_id: int, picked_up_by: str, pickup_notes: str = None) -> Tuple[PickupReport, LensOrder]:
        report = PickupService.get_or_create_report(db, lens_order_id)

        lens_order = db.query(LensOrder).filter(LensOrder.id == lens_order_id).first()
        if not lens_order:
            raise ValueError(f"订单 {lens_order_id} 不存在")

        if lens_order.status != ProcessingStatus.READY_FOR_PICKUP.value:
            raise ValueError(f"订单状态不是待取件，当前状态: {lens_order.status}")

        report.picked_up = True
        report.pickup_date = datetime.now()
        report.picked_up_by = picked_up_by
        report.pickup_notes = pickup_notes

        history = ProcessingStatusHistory(
            lens_order_id=lens_order.id,
            from_status=lens_order.status,
            to_status=ProcessingStatus.PICKED_UP.value,
            changed_by=picked_up_by,
            notes=pickup_notes
        )
        db.add(history)

        lens_order.status = ProcessingStatus.PICKED_UP.value
        lens_order.status_updated_at = datetime.now()
        lens_order.status_updated_by = picked_up_by

        db.flush()
        return report, lens_order


class CustomerService:
    @staticmethod
    def create(db: Session, customer: schemas.CustomerCreate) -> Customer:
        db_customer = Customer(**customer.model_dump())
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        return db_customer

    @staticmethod
    def get_by_phone(db: Session, phone: str) -> Optional[Customer]:
        return db.query(Customer).filter(Customer.phone == phone).first()

    @staticmethod
    def get_by_id(db: Session, customer_id: int) -> Optional[Customer]:
        return db.query(Customer).filter(Customer.id == customer_id).first()


class PrescriptionService:
    @staticmethod
    def create(db: Session, prescription: schemas.PrescriptionCreate) -> Prescription:
        db_prescription = Prescription(**prescription.model_dump())
        db.add(db_prescription)
        db.commit()
        db.refresh(db_prescription)
        return db_prescription

    @staticmethod
    def get_by_customer(db: Session, customer_id: int) -> list:
        return db.query(Prescription).filter(Prescription.customer_id == customer_id).order_by(Prescription.version.desc()).all()


class LensOrderService:
    @staticmethod
    def create(db: Session, order: schemas.LensOrderCreate) -> LensOrder:
        order_data = order.model_dump()
        order_data["order_no"] = OrderNumberGenerator.generate()

        db_order = LensOrder(**order_data)
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        return db_order

    @staticmethod
    def get_by_order_no(db: Session, order_no: str) -> Optional[LensOrder]:
        return db.query(LensOrder).filter(LensOrder.order_no == order_no).first()

    @staticmethod
    def get_by_id(db: Session, order_id: int) -> Optional[LensOrder]:
        return db.query(LensOrder).filter(LensOrder.id == order_id).first()

    @staticmethod
    def list_orders(db: Session, status: Optional[ProcessingStatus] = None, customer_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> Tuple[list, int]:
        query = db.query(LensOrder)

        if status:
            query = query.filter(LensOrder.status == status.value)
        if customer_id:
            query = query.filter(LensOrder.customer_id == customer_id)

        total = query.count()
        orders = query.order_by(LensOrder.created_at.desc()).offset(skip).limit(limit).all()

        return orders, total

    @staticmethod
    def withdraw_order(db: Session, order_id: int, reason: str, changed_by: str) -> LensOrder:
        order = db.query(LensOrder).filter(LensOrder.id == order_id).first()
        if not order:
            raise ValueError(f"订单 {order_id} 不存在")

        if order.status == ProcessingStatus.PICKED_UP.value:
            raise ValueError("已取件的订单无法撤回")

        history = ProcessingStatusHistory(
            lens_order_id=order.id,
            from_status=order.status,
            to_status=ProcessingStatus.CANCELLED.value,
            changed_by=changed_by,
            notes=f"撤回原因: {reason}"
        )
        db.add(history)

        order.status = ProcessingStatus.CANCELLED.value
        order.status_updated_at = datetime.now()
        order.status_updated_by = changed_by
        order.notes = (order.notes or "") + f"\n撤回: {reason}"

        db.commit()
        db.refresh(order)
        return order
