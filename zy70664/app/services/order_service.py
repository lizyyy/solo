from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import date, datetime
from typing import List, Optional, Dict, Any
import json
import uuid

from app.models.models import (
    OrderRecord, CancellationRecord, OrderException, Department,
    Employee, MealType, MealReport, ProcessBatch
)
from app.schemas.schemas import (
    OrderRecordCreate, CancellationRecordCreate, OrderExceptionHandle,
    MealReportGenerate, BatchImportResult, CancelOffsetResult
)


class DateEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, date):
            return obj.isoformat()
        return super().default(obj)


def safe_json_dumps(obj: Any, **kwargs) -> str:
    return json.dumps(obj, cls=DateEncoder, **kwargs)


def generate_batch_id() -> str:
    return f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"


def create_order_record(db: Session, order: OrderRecordCreate) -> OrderRecord:
    db_order = OrderRecord(**order.model_dump())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


def batch_import_orders(
    db: Session,
    orders: List[OrderRecordCreate],
    source_file: str = None,
    created_by: str = None
) -> BatchImportResult:
    batch_id = generate_batch_id()
    batch = ProcessBatch(
        batch_id=batch_id,
        batch_type="order_import",
        source_file=source_file,
        total_records=len(orders),
        created_by=created_by,
        status="processing"
    )
    db.add(batch)
    db.commit()

    success_count = 0
    exception_count = 0
    exceptions = []

    for idx, order in enumerate(orders):
        try:
            order.batch_id = batch_id
            order.row_number = idx + 1
            order.raw_data = safe_json_dumps(order.model_dump(), ensure_ascii=False)

            department = db.query(Department).filter(
                Department.id == order.department_id
            ).first()
            if not department:
                raise ValueError(f"部门ID {order.department_id} 不存在")

            meal_type = db.query(MealType).filter(
                MealType.id == order.meal_type_id
            ).first()
            if not meal_type:
                raise ValueError(f"餐别ID {order.meal_type_id} 不存在")

            db_order = OrderRecord(**order.model_dump())
            db.add(db_order)
            success_count += 1

        except Exception as e:
            exception_count += 1
            exception = OrderException(
                batch_id=batch_id,
                exception_type="import_error",
                description=str(e),
                raw_data=safe_json_dumps(order.model_dump(), ensure_ascii=False),
                status="pending"
            )
            db.add(exception)
            exceptions.append({
                "row": idx + 1,
                "error": str(e),
                "data": order.model_dump()
            })

    batch.success_count = success_count
    batch.exception_count = exception_count
    batch.status = "completed"
    batch.completed_at = datetime.now()
    db.commit()

    return BatchImportResult(
        batch_id=batch_id,
        total_records=len(orders),
        success_count=success_count,
        exception_count=exception_count,
        exceptions=exceptions
    )


def get_order_records(
    db: Session,
    meal_date: Optional[date] = None,
    department_id: Optional[int] = None,
    meal_type_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[OrderRecord]:
    query = db.query(OrderRecord)
    if meal_date:
        query = query.filter(OrderRecord.meal_date == meal_date)
    if department_id:
        query = query.filter(OrderRecord.department_id == department_id)
    if meal_type_id:
        query = query.filter(OrderRecord.meal_type_id == meal_type_id)
    if status:
        query = query.filter(OrderRecord.status == status)
    return query.offset(skip).limit(limit).all()


def process_cancellation_offset(
    db: Session,
    cancellations: List[CancellationRecordCreate],
    source_file: str = None
) -> CancelOffsetResult:
    batch_id = generate_batch_id()
    batch = ProcessBatch(
        batch_id=batch_id,
        batch_type="cancellation_offset",
        source_file=source_file,
        total_records=len(cancellations),
        status="processing"
    )
    db.add(batch)
    db.commit()

    matched_count = 0
    unmatched_count = 0
    offset_quantity = 0

    for idx, cancel in enumerate(cancellations):
        cancel.batch_id = batch_id
        cancel.row_number = idx + 1
        cancel.raw_data = safe_json_dumps(cancel.model_dump(), ensure_ascii=False)

        matched_order = None

        if cancel.order_record_id:
            matched_order = db.query(OrderRecord).filter(
                OrderRecord.id == cancel.order_record_id,
                OrderRecord.meal_date == cancel.cancel_date
            ).first()
        else:
            employee = None
            department = None
            meal_type = None

            if cancel.employee_no:
                employee = db.query(Employee).filter(
                    Employee.employee_no == cancel.employee_no
                ).first()

            if cancel.department_code:
                department = db.query(Department).filter(
                    Department.code == cancel.department_code
                ).first()

            if cancel.meal_type_code:
                meal_type = db.query(MealType).filter(
                    MealType.code == cancel.meal_type_code
                ).first()

            filters = [OrderRecord.meal_date == cancel.cancel_date]
            if employee:
                filters.append(OrderRecord.employee_id == employee.id)
            if department:
                filters.append(OrderRecord.department_id == department.id)
            if meal_type:
                filters.append(OrderRecord.meal_type_id == meal_type.id)

            if len(filters) > 1:
                matched_order = db.query(OrderRecord).filter(
                    and_(*filters)
                ).first()

        db_cancel = CancellationRecord(**cancel.model_dump(exclude={
            'employee_no', 'department_code', 'meal_type_code'
        }))

        if matched_order:
            db_cancel.order_record_id = matched_order.id
            db_cancel.matched = True
            db_cancel.matched_order_id = matched_order.id
            db_cancel.status = "matched"
            matched_count += 1
            offset_quantity += cancel.cancel_quantity
        else:
            db_cancel.status = "unmatched"
            unmatched_count += 1

            exception = OrderException(
                batch_id=batch_id,
                exception_type="cancellation_unmatched",
                description=f"取消记录无法匹配到订餐记录: 第{idx+1}行",
                raw_data=cancel.raw_data,
                status="pending"
            )
            db.add(exception)

        db.add(db_cancel)

    batch.success_count = matched_count
    batch.exception_count = unmatched_count
    batch.status = "completed"
    batch.completed_at = datetime.now()
    db.commit()

    return CancelOffsetResult(
        batch_id=batch_id,
        total_cancellations=len(cancellations),
        matched_count=matched_count,
        unmatched_count=unmatched_count,
        offset_quantity=offset_quantity
    )


def get_cancellation_records(
    db: Session,
    cancel_date: Optional[date] = None,
    matched: Optional[bool] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[CancellationRecord]:
    query = db.query(CancellationRecord)
    if cancel_date:
        query = query.filter(CancellationRecord.cancel_date == cancel_date)
    if matched is not None:
        query = query.filter(CancellationRecord.matched == matched)
    if status:
        query = query.filter(CancellationRecord.status == status)
    return query.offset(skip).limit(limit).all()


def handle_exception(
    db: Session,
    exception_id: int,
    handle_data: OrderExceptionHandle
) -> OrderException:
    exception = db.query(OrderException).filter(
        OrderException.id == exception_id
    ).first()
    if not exception:
        raise ValueError(f"异常记录ID {exception_id} 不存在")

    exception.handler = handle_data.handler
    exception.handle_result = handle_data.handle_result
    exception.handle_notes = handle_data.handle_notes
    exception.handled_at = datetime.now()
    exception.status = "handled"
    db.commit()
    db.refresh(exception)
    return exception


def get_exceptions(
    db: Session,
    batch_id: Optional[str] = None,
    status: Optional[str] = None,
    exception_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[OrderException]:
    query = db.query(OrderException)
    if batch_id:
        query = query.filter(OrderException.batch_id == batch_id)
    if status:
        query = query.filter(OrderException.status == status)
    if exception_type:
        query = query.filter(OrderException.exception_type == exception_type)
    return query.offset(skip).limit(limit).all()


def generate_meal_report(
    db: Session,
    report_data: MealReportGenerate,
    generated_by: str = None
) -> List[MealReport]:
    report_date = report_data.report_date
    meal_type_id = report_data.meal_type_id
    department_id = report_data.department_id

    departments = db.query(Department)
    if department_id:
        departments = departments.filter(Department.id == department_id)
    departments = departments.all()

    meal_types = db.query(MealType)
    if meal_type_id:
        meal_types = meal_types.filter(MealType.id == meal_type_id)
    meal_types = meal_types.all()

    reports = []

    for dept in departments:
        for mt in meal_types:
            orders = db.query(OrderRecord).filter(
                OrderRecord.meal_date == report_date,
                OrderRecord.department_id == dept.id,
                OrderRecord.meal_type_id == mt.id,
                OrderRecord.status != "cancelled"
            ).all()

            total_orders = sum(o.quantity for o in orders)

            cancellations = db.query(CancellationRecord).filter(
                CancellationRecord.cancel_date == report_date,
                CancellationRecord.matched == True,
                CancellationRecord.status == "matched"
            ).join(OrderRecord).filter(
                OrderRecord.department_id == dept.id,
                OrderRecord.meal_type_id == mt.id
            ).all()

            total_cancelled = sum(c.cancel_quantity for c in cancellations)
            net_quantity = max(0, total_orders - total_cancelled)

            restrictions = {}
            for o in orders:
                if o.diet_restriction and o.diet_restriction.strip():
                    rest_list = [r.strip() for r in o.diet_restriction.split(',')]
                    for r in rest_list:
                        if r:
                            restrictions[r] = restrictions.get(r, 0) + 1

            restriction_count = len(restrictions)
            diet_restrictions = json.dumps(restrictions, ensure_ascii=False)

            existing = db.query(MealReport).filter(
                MealReport.report_date == report_date,
                MealReport.department_id == dept.id,
                MealReport.meal_type_id == mt.id
            ).first()

            if existing:
                existing.total_orders = total_orders
                existing.total_cancelled = total_cancelled
                existing.net_quantity = net_quantity
                existing.diet_restrictions = diet_restrictions
                existing.restriction_count = restriction_count
                existing.status = "draft"
                report = existing
            else:
                report = MealReport(
                    report_date=report_date,
                    meal_type_id=mt.id,
                    department_id=dept.id,
                    total_orders=total_orders,
                    total_cancelled=total_cancelled,
                    net_quantity=net_quantity,
                    diet_restrictions=diet_restrictions,
                    restriction_count=restriction_count,
                    status="draft",
                    generated_by=generated_by
                )
                db.add(report)

            db.commit()
            db.refresh(report)
            reports.append(report)

    return reports


def confirm_report(
    db: Session,
    report_id: int,
    confirmed_by: str
) -> MealReport:
    report = db.query(MealReport).filter(MealReport.id == report_id).first()
    if not report:
        raise ValueError(f"报告ID {report_id} 不存在")

    report.status = "confirmed"
    report.confirmed_at = datetime.now()
    report.confirmed_by = confirmed_by
    db.commit()
    db.refresh(report)
    return report


def close_report(
    db: Session,
    report_id: int,
    closed_by: str
) -> MealReport:
    report = db.query(MealReport).filter(MealReport.id == report_id).first()
    if not report:
        raise ValueError(f"报告ID {report_id} 不存在")

    report.status = "closed"
    db.commit()
    db.refresh(report)
    return report


def get_reports(
    db: Session,
    report_date: Optional[date] = None,
    department_id: Optional[int] = None,
    meal_type_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[MealReport]:
    query = db.query(MealReport)
    if report_date:
        query = query.filter(MealReport.report_date == report_date)
    if department_id:
        query = query.filter(MealReport.department_id == department_id)
    if meal_type_id:
        query = query.filter(MealReport.meal_type_id == meal_type_id)
    if status:
        query = query.filter(MealReport.status == status)
    return query.offset(skip).limit(limit).all()


def get_diet_restriction_summary(
    db: Session,
    report_date: date,
    meal_type_id: Optional[int] = None
) -> Dict[str, Any]:
    reports = db.query(MealReport).filter(
        MealReport.report_date == report_date
    )
    if meal_type_id:
        reports = reports.filter(MealReport.meal_type_id == meal_type_id)
    reports = reports.all()

    meal_type_name = "全部"
    if meal_type_id:
        meal_type = db.query(MealType).filter(MealType.id == meal_type_id).first()
        if meal_type:
            meal_type_name = meal_type.name

    all_restrictions = {}
    total_orders = 0
    total_cancelled = 0

    for report in reports:
        total_orders += report.total_orders
        total_cancelled += report.total_cancelled

        if report.diet_restrictions:
            try:
                rests = json.loads(report.diet_restrictions)
                for rest, count in rests.items():
                    if rest not in all_restrictions:
                        all_restrictions[rest] = {"count": 0, "departments": set()}
                    all_restrictions[rest]["count"] += count

                    dept = db.query(Department).filter(
                        Department.id == report.department_id
                    ).first()
                    if dept:
                        all_restrictions[rest]["departments"].add(dept.name)
            except:
                pass

    restrictions_list = []
    for rest, data in all_restrictions.items():
        restrictions_list.append({
            "restriction": rest,
            "count": data["count"],
            "departments": list(data["departments"])
        })

    return {
        "report_date": report_date,
        "meal_type": meal_type_name,
        "total_orders": total_orders,
        "total_cancelled": total_cancelled,
        "net_quantity": total_orders - total_cancelled,
        "restriction_count": len(restrictions_list),
        "restrictions": restrictions_list
    }


def manually_correct_order(
    db: Session,
    order_id: int,
    update_data: Dict[str, Any],
    handler: str
) -> OrderRecord:
    order = db.query(OrderRecord).filter(OrderRecord.id == order_id).first()
    if not order:
        raise ValueError(f"订餐记录ID {order_id} 不存在")

    for key, value in update_data.items():
        if hasattr(order, key):
            setattr(order, key, value)

    order.status = "manual_updated"
    db.commit()
    db.refresh(order)

    exception = OrderException(
        order_record_id=order_id,
        exception_type="manual_correction",
        description=f"人工修正订餐记录",
        raw_data=json.dumps(update_data, ensure_ascii=False),
        handler=handler,
        handle_result="corrected",
        status="handled",
        handled_at=datetime.now()
    )
    db.add(exception)
    db.commit()

    return order


def withdraw_order(
    db: Session,
    order_id: int,
    handler: str,
    reason: str
) -> OrderRecord:
    order = db.query(OrderRecord).filter(OrderRecord.id == order_id).first()
    if not order:
        raise ValueError(f"订餐记录ID {order_id} 不存在")

    order.status = "withdrawn"
    db.commit()
    db.refresh(order)

    exception = OrderException(
        order_record_id=order_id,
        exception_type="withdraw",
        description=f"撤回订餐记录: {reason}",
        handler=handler,
        handle_result="withdrawn",
        status="handled",
        handled_at=datetime.now()
    )
    db.add(exception)
    db.commit()

    return order
