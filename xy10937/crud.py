from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
import models, schemas
from models import (
    OrderStatus, ReturnStatus, CompensationStatus, 
    DamageType, MaterialCategory
)


def generate_no(prefix: str, db: Session, model_class) -> str:
    last_record = db.query(model_class).order_by(desc(model_class.id)).first()
    next_id = 1 if not last_record else last_record.id + 1
    date_str = datetime.now().strftime("%Y%m%d")
    return f"{prefix}{date_str}{next_id:04d}"


def create_order(db: Session, order: schemas.OrderCreate):
    db_order = models.Order(
        order_no=order.order_no,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        event_date=order.event_date,
        event_location=order.event_location,
        notes=order.notes,
        status=OrderStatus.PENDING,
        total_materials=len(order.materials)
    )
    db.add(db_order)
    db.flush()

    for material in order.materials:
        db_material = models.Material(
            order_id=db_order.id,
            name=material.name,
            category=material.category,
            quantity=material.quantity,
            unit_price=material.unit_price,
            description=material.description
        )
        db.add(db_material)

    db.commit()
    db.refresh(db_order)
    return db_order


def get_order(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()


def get_order_by_no(db: Session, order_no: str):
    return db.query(models.Order).filter(models.Order.order_no == order_no).first()


def get_orders(db: Session, skip: int = 0, limit: int = 100, status: OrderStatus = None):
    query = db.query(models.Order)
    if status:
        query = query.filter(models.Order.status == status)
    return query.order_by(desc(models.Order.created_at)).offset(skip).limit(limit).all()


def update_order_status(db: Session, order_id: int, new_status: OrderStatus, notes: str = None):
    db_order = get_order(db, order_id)
    if not db_order:
        return None
    db_order.status = new_status
    if notes:
        db_order.notes = (db_order.notes or "") + f"\n[{datetime.now()}] {notes}"
    db.commit()
    db.refresh(db_order)
    return db_order


def create_outbound(db: Session, outbound: schemas.OutboundCreate):
    db_order = get_order(db, outbound.order_id)
    if not db_order:
        return None, "订单不存在"

    if db_order.status not in [OrderStatus.PENDING, OrderStatus.IN_PROGRESS]:
        return None, f"订单状态不允许出库，当前状态: {db_order.status}"

    db_outbound = models.Outbound(
        order_id=outbound.order_id,
        outbound_no=generate_no("OB", db, models.Outbound),
        operator=outbound.operator,
        notes=outbound.notes
    )
    db.add(db_outbound)
    db.flush()

    for item in outbound.items:
        material = db.query(models.Material).filter(
            models.Material.id == item.material_id,
            models.Material.order_id == outbound.order_id
        ).first()
        if not material:
            db.rollback()
            return None, f"物料不存在: {item.material_id}"
        
        if item.quantity > material.quantity:
            db.rollback()
            return None, f"物料数量不足: {material.name}, 需要: {item.quantity}, 可用: {material.quantity}"

        db_item = models.OutboundItem(
            outbound_id=db_outbound.id,
            material_id=item.material_id,
            quantity=item.quantity
        )
        db.add(db_item)

    db_order.status = OrderStatus.MATERIALS_OUT
    db.commit()
    db.refresh(db_outbound)
    return db_outbound, None


def get_outbound(db: Session, outbound_id: int):
    return db.query(models.Outbound).filter(models.Outbound.id == outbound_id).first()


def get_outbounds_by_order(db: Session, order_id: int):
    return db.query(models.Outbound).filter(models.Outbound.order_id == order_id).all()


def create_return(db: Session, return_data: schemas.ReturnCreate):
    db_order = get_order(db, return_data.order_id)
    if not db_order:
        return None, "订单不存在"

    if db_order.status not in [OrderStatus.MATERIALS_OUT, OrderStatus.RETURNING]:
        return None, f"订单状态不允许归还，当前状态: {db_order.status}"

    existing_return = db.query(models.Return).filter(
        models.Return.order_id == return_data.order_id,
        models.Return.status.not_in([ReturnStatus.REJECTED])
    ).first()
    if existing_return:
        return None, f"该订单已有进行中的归还记录: {existing_return.return_no}"

    for item in return_data.items:
        material = db.query(models.Material).filter(
            models.Material.id == item.material_id,
            models.Material.order_id == return_data.order_id
        ).first()
        if not material:
            return None, f"物料不存在或不属于该订单: material_id={item.material_id}"
        
        if item.expected_quantity > material.quantity:
            return None, f"物料 {material.name}: 预期归还数量({item.expected_quantity})超出订单数量({material.quantity})"

    db_return = models.Return(
        order_id=return_data.order_id,
        return_no=generate_no("RT", db, models.Return),
        operator=return_data.operator,
        notes=return_data.notes,
        status=ReturnStatus.PENDING_REVIEW
    )
    db.add(db_return)
    db.flush()

    for item in return_data.items:
        db_item = models.ReturnItem(
            return_id=db_return.id,
            material_id=item.material_id,
            expected_quantity=item.expected_quantity,
            returned_quantity=item.returned_quantity,
            damage_type=item.damage_type,
            damage_notes=item.damage_notes
        )
        db.add(db_item)

    db_order.status = OrderStatus.RETURNING
    db.commit()
    db.refresh(db_return)
    return db_return, None


def get_return(db: Session, return_id: int):
    return db.query(models.Return).filter(models.Return.id == return_id).first()


def get_returns_by_order(db: Session, order_id: int):
    return db.query(models.Return).filter(models.Return.order_id == order_id).all()


def review_return(db: Session, return_id: int, review_data: schemas.ReturnReview):
    db_return = get_return(db, return_id)
    if not db_return:
        return None, "归还记录不存在"

    if db_return.status != ReturnStatus.PENDING_REVIEW:
        return None, f"当前状态不允许审核，当前状态: {db_return.status}"

    db_return.status = review_data.status
    db_return.reviewed_by = review_data.reviewed_by
    db_return.reviewed_at = datetime.now()
    db_return.review_notes = review_data.review_notes

    db_order = get_order(db, db_return.order_id)

    if review_data.status == ReturnStatus.REJECTED:
        db_order.status = OrderStatus.MATERIALS_OUT
    elif review_data.status == ReturnStatus.REVIEWED:
        has_compensation = False
        for item in db_return.items:
            if item.damage_type != DamageType.NONE:
                has_compensation = True
                break
        if has_compensation:
            db_order.status = OrderStatus.COMPENSATING
        else:
            db_order.status = OrderStatus.COMPLETED

    db.commit()
    db.refresh(db_return)
    return db_return, None


def create_compensation(db: Session, compensation: schemas.CompensationCreate):
    db_order = get_order(db, compensation.order_id)
    if not db_order:
        return None, "订单不存在"

    db_return = get_return(db, compensation.return_id)
    if not db_return:
        return None, "归还记录不存在"

    if db_return.order_id != compensation.order_id:
        return None, "归还记录不属于该订单"

    if db_return.status not in [ReturnStatus.REVIEWED, ReturnStatus.PENDING_REVIEW]:
        return None, f"归还记录状态不允许创建赔付，当前状态: {db_return.status}"

    return_item = None
    for item in db_return.items:
        if item.material_id == compensation.material_id:
            return_item = item
            break
    
    if not return_item:
        return None, f"归还记录中不存在该物料: material_id={compensation.material_id}"

    if return_item.damage_type == DamageType.NONE:
        return None, "该物料在归还记录中无丢损记录，无需赔付"

    if return_item.damage_type != compensation.damage_type:
        return None, f"赔付类型与归还记录不符: 归还记录为{return_item.damage_type}，申请赔付为{compensation.damage_type}"

    expected_loss = return_item.expected_quantity - return_item.returned_quantity
    if compensation.quantity > expected_loss:
        return None, f"赔付数量({compensation.quantity})超出实际丢损数量({expected_loss})"

    existing_compensation = db.query(models.Compensation).filter(
        models.Compensation.return_id == compensation.return_id,
        models.Compensation.material_id == compensation.material_id
    ).first()
    if existing_compensation:
        return None, f"该物料已存在赔付记录: {existing_compensation.compensation_no}"

    total_amount = compensation.quantity * compensation.unit_amount

    db_compensation = models.Compensation(
        order_id=compensation.order_id,
        compensation_no=generate_no("CP", db, models.Compensation),
        return_id=compensation.return_id,
        material_id=compensation.material_id,
        damage_type=compensation.damage_type,
        quantity=compensation.quantity,
        unit_amount=compensation.unit_amount,
        total_amount=total_amount,
        notes=compensation.notes,
        status=CompensationStatus.PENDING
    )
    db.add(db_compensation)

    db_order.total_compensation += total_amount
    db.commit()
    db.refresh(db_compensation)
    return db_compensation, None


def get_compensation(db: Session, compensation_id: int):
    return db.query(models.Compensation).filter(models.Compensation.id == compensation_id).first()


def get_compensations_by_order(db: Session, order_id: int):
    return db.query(models.Compensation).filter(models.Compensation.order_id == order_id).all()


def update_compensation_status(db: Session, compensation_id: int, update_data: schemas.CompensationUpdate):
    db_compensation = get_compensation(db, compensation_id)
    if not db_compensation:
        return None, "赔付记录不存在"

    if update_data.status is not None:
        db_compensation.status = update_data.status
        if update_data.status == CompensationStatus.PAID:
            db_compensation.paid_at = datetime.now()
            db_compensation.paid_by = update_data.paid_by

            all_paid = True
            compensations = get_compensations_by_order(db, db_compensation.order_id)
            for cp in compensations:
                if cp.status != CompensationStatus.PAID and cp.status != CompensationStatus.WAIVED:
                    all_paid = False
                    break
            if all_paid:
                db_order = get_order(db, db_compensation.order_id)
                db_order.status = OrderStatus.COMPLETED

    if update_data.notes:
        db_compensation.notes = update_data.notes

    db.commit()
    db.refresh(db_compensation)
    return db_compensation, None


def create_exception(db: Session, exception_data: schemas.ProcessingExceptionCreate):
    db_exception = models.ProcessingException(
        order_id=exception_data.order_id,
        exception_type=exception_data.exception_type,
        operation=exception_data.operation,
        original_input=exception_data.original_input,
        error_message=exception_data.error_message,
        processing_result=exception_data.processing_result
    )
    db.add(db_exception)
    db.commit()
    db.refresh(db_exception)
    return db_exception


def get_exception(db: Session, exception_id: int):
    return db.query(models.ProcessingException).filter(models.ProcessingException.id == exception_id).first()


def get_exceptions(db: Session, skip: int = 0, limit: int = 100, handled: bool = None):
    query = db.query(models.ProcessingException)
    if handled is not None:
        query = query.filter(models.ProcessingException.handled == handled)
    return query.order_by(desc(models.ProcessingException.created_at)).offset(skip).limit(limit).all()


def handle_exception(db: Session, exception_id: int, handle_data: schemas.ProcessingExceptionHandle):
    db_exception = get_exception(db, exception_id)
    if not db_exception:
        return None, "异常记录不存在"

    db_exception.handled = True
    db_exception.handled_by = handle_data.handled_by
    db_exception.handled_at = datetime.now()
    db_exception.correction_notes = handle_data.correction_notes
    db.commit()
    db.refresh(db_exception)
    return db_exception, None


def create_report(db: Session, report: schemas.ReportCreate):
    db_report = models.Report(
        order_id=report.order_id,
        report_no=generate_no("RP", db, models.Report),
        report_type=report.report_type,
        generated_by=report.generated_by,
        content=report.content
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_report(db: Session, report_id: int):
    return db.query(models.Report).filter(models.Report.id == report_id).first()


def get_reports_by_order(db: Session, order_id: int):
    return db.query(models.Report).filter(models.Report.order_id == order_id).all()


def get_materials_by_order(db: Session, order_id: int):
    return db.query(models.Material).filter(models.Material.order_id == order_id).all()