from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
import uuid
from typing import Optional, List, Tuple
from database import (
    Customer, SalesOrder, SalesOrderItem, ReturnRecord, ReturnItem,
    PaymentRecord, DebtReport
)
from schemas import (
    CustomerCreate, CustomerUpdate, SalesOrderCreate, SalesOrderUpdate,
    ReturnRecordCreate, PaymentRecordCreate, DebtReportRequest,
    ErrorCode
)


class BusinessException(Exception):
    def __init__(self, code: ErrorCode, message: str, details: dict = None):
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


def generate_order_no(prefix: str = "SO") -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"


def get_customer_by_id(db: Session, customer_id: int) -> Optional[Customer]:
    return db.query(Customer).filter(Customer.id == customer_id).first()


def create_customer(db: Session, customer: CustomerCreate) -> Customer:
    db_customer = Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


def get_customers(
    db: Session, skip: int = 0, limit: int = 100, name: str = None
) -> List[Customer]:
    query = db.query(Customer)
    if name:
        query = query.filter(Customer.name.contains(name))
    return query.offset(skip).limit(limit).all()


def update_customer(
    db: Session, customer_id: int, customer_update: CustomerUpdate
) -> Customer:
    db_customer = get_customer_by_id(db, customer_id)
    if not db_customer:
        raise BusinessException(
            code=ErrorCode.NOT_FOUND,
            message=f"客户ID {customer_id} 不存在"
        )
    for field, value in customer_update.model_dump(exclude_unset=True).items():
        setattr(db_customer, field, value)
    db.commit()
    db.refresh(db_customer)
    return db_customer


def get_sales_order_by_id(db: Session, order_id: int) -> Optional[SalesOrder]:
    return db.query(SalesOrder).filter(SalesOrder.id == order_id).first()


def get_sales_order_by_no(db: Session, order_no: str) -> Optional[SalesOrder]:
    return db.query(SalesOrder).filter(SalesOrder.order_no == order_no).first()


def create_sales_order(db: Session, order: SalesOrderCreate) -> SalesOrder:
    customer = get_customer_by_id(db, order.customer_id)
    if not customer:
        raise BusinessException(
            code=ErrorCode.NOT_FOUND,
            message=f"客户ID {order.customer_id} 不存在"
        )

    total_amount = sum(
        item.quantity * item.unit_price for item in order.items
    )
    discount_amount = order.discount_amount or 0.0
    actual_amount = total_amount - discount_amount

    if actual_amount < 0:
        raise BusinessException(
            code=ErrorCode.BUSINESS_ERROR,
            message="折扣金额不能大于订单总金额"
        )

    db_order = SalesOrder(
        order_no=generate_order_no("SO"),
        customer_id=order.customer_id,
        order_date=order.order_date or datetime.now(),
        total_amount=total_amount,
        discount_amount=discount_amount,
        actual_amount=actual_amount,
        debt_amount=actual_amount,
        remarks=order.remarks,
        status="active"
    )
    db.add(db_order)
    db.flush()

    for item in order.items:
        total_price = item.quantity * item.unit_price
        db_item = SalesOrderItem(
            order_id=db_order.id,
            product_name=item.product_name,
            product_batch=item.product_batch,
            unit=item.unit,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=total_price
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_order)
    return db_order


def get_sales_orders(
    db: Session, skip: int = 0, limit: int = 100,
    customer_id: int = None, status: str = None
) -> List[SalesOrder]:
    query = db.query(SalesOrder)
    if customer_id:
        query = query.filter(SalesOrder.customer_id == customer_id)
    if status:
        query = query.filter(SalesOrder.status == status)
    return query.offset(skip).limit(limit).all()


def recalculate_debt(db: Session, order_id: int) -> Tuple[SalesOrder, float]:
    db_order = get_sales_order_by_id(db, order_id)
    if not db_order:
        raise BusinessException(
            code=ErrorCode.NOT_FOUND,
            message=f"订单ID {order_id} 不存在"
        )

    if db_order.status == "settled":
        raise BusinessException(
            code=ErrorCode.INVALID_STATUS,
            message="订单已结清，不能重算",
            details={"order_no": db_order.order_no}
        )

    previous_debt = db_order.debt_amount

    total_paid = sum(
        p.amount for p in db_order.payments if p.status == "confirmed"
    )
    total_returned = sum(
        r.deduction_amount for r in db_order.returns if r.status == "confirmed"
    )

    new_debt = db_order.actual_amount - total_paid - total_returned

    need_review = False
    review_details = {}

    if new_debt < 0:
        need_review = True
        review_details["negative_debt"] = new_debt
        review_details["message"] = "欠款为负数，需要人工复核"

    db_order.paid_amount = total_paid
    db_order.returned_amount = total_returned
    db_order.debt_amount = max(new_debt, 0)

    if abs(new_debt) < 0.01:
        db_order.status = "settled"
    else:
        db_order.status = "active"

    db.commit()
    db.refresh(db_order)

    if need_review:
        raise BusinessException(
            code=ErrorCode.NEED_REVIEW,
            message="重算结果需要人工复核",
            details=review_details
        )

    return db_order, previous_debt


def create_return_record(db: Session, return_data: ReturnRecordCreate) -> ReturnRecord:
    db_order = get_sales_order_by_id(db, return_data.order_id)
    if not db_order:
        raise BusinessException(
            code=ErrorCode.NOT_FOUND,
            message=f"订单ID {return_data.order_id} 不存在"
        )

    if db_order.status not in ["active", "pending"]:
        raise BusinessException(
            code=ErrorCode.INVALID_STATUS,
            message="订单状态不允许退货",
            details={"current_status": db_order.status}
        )

    idempotent_key = return_data.idempotent_key or generate_order_no("RET")
    existing = db.query(ReturnRecord).filter(
        ReturnRecord.idempotent_key == idempotent_key
    ).first()
    if existing:
        raise BusinessException(
            code=ErrorCode.ALREADY_PROCESSED,
            message="退货记录已处理过",
            details={"return_no": existing.return_no}
        )

    total_amount = 0.0
    return_items = []

    for item in return_data.items:
        order_item = db.query(SalesOrderItem).filter(
            SalesOrderItem.id == item.order_item_id,
            SalesOrderItem.order_id == return_data.order_id
        ).first()

        if not order_item:
            raise BusinessException(
                code=ErrorCode.NOT_FOUND,
                message=f"订单项ID {item.order_item_id} 不存在"
            )

        available_quantity = order_item.quantity - order_item.returned_quantity
        if item.quantity > available_quantity:
            raise BusinessException(
                code=ErrorCode.BUSINESS_ERROR,
                message=f"商品 {order_item.product_name} 退货数量超过可退数量",
                details={
                    "requested": item.quantity,
                    "available": available_quantity
                }
            )

        item_total = item.quantity * order_item.unit_price
        total_amount += item_total

        return_items.append({
            "order_item_id": item.order_item_id,
            "product_name": order_item.product_name,
            "quantity": item.quantity,
            "unit_price": order_item.unit_price,
            "total_price": item_total,
            "reason": item.reason
        })

    db_return = ReturnRecord(
        return_no=generate_order_no("RET"),
        order_id=return_data.order_id,
        return_date=return_data.return_date or datetime.now(),
        total_amount=total_amount,
        deduction_amount=total_amount,
        status="confirmed",
        remarks=return_data.remarks,
        idempotent_key=idempotent_key
    )
    db.add(db_return)
    db.flush()

    for item in return_items:
        db_item = ReturnItem(**item, return_id=db_return.id)
        db.add(db_item)

        order_item = db.query(SalesOrderItem).filter(
            SalesOrderItem.id == item["order_item_id"]
        ).first()
        order_item.returned_quantity += item["quantity"]

    db.commit()
    db.refresh(db_return)

    recalculate_debt(db, return_data.order_id)

    return db_return


def get_return_records(
    db: Session, skip: int = 0, limit: int = 100, order_id: int = None
) -> List[ReturnRecord]:
    query = db.query(ReturnRecord)
    if order_id:
        query = query.filter(ReturnRecord.order_id == order_id)
    return query.offset(skip).limit(limit).all()


def create_payment_record(db: Session, payment: PaymentRecordCreate) -> PaymentRecord:
    db_order = get_sales_order_by_id(db, payment.order_id)
    if not db_order:
        raise BusinessException(
            code=ErrorCode.NOT_FOUND,
            message=f"订单ID {payment.order_id} 不存在"
        )

    if db_order.status not in ["active", "pending"]:
        raise BusinessException(
            code=ErrorCode.INVALID_STATUS,
            message="订单状态不允许收款",
            details={"current_status": db_order.status}
        )

    idempotent_key = payment.idempotent_key or generate_order_no("PAY")
    existing = db.query(PaymentRecord).filter(
        PaymentRecord.idempotent_key == idempotent_key
    ).first()
    if existing:
        raise BusinessException(
            code=ErrorCode.ALREADY_PROCESSED,
            message="回款记录已处理过",
            details={"payment_no": existing.payment_no}
        )

    db_payment = PaymentRecord(
        payment_no=generate_order_no("PAY"),
        order_id=payment.order_id,
        payment_date=payment.payment_date or datetime.now(),
        amount=payment.amount,
        payment_method=payment.payment_method or "cash",
        remarks=payment.remarks,
        idempotent_key=idempotent_key,
        status="confirmed"
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)

    recalculate_debt(db, payment.order_id)

    return db_payment


def get_payment_records(
    db: Session, skip: int = 0, limit: int = 100, order_id: int = None
) -> List[PaymentRecord]:
    query = db.query(PaymentRecord)
    if order_id:
        query = query.filter(PaymentRecord.order_id == order_id)
    return query.offset(skip).limit(limit).all()


def generate_debt_report(
    db: Session, request: DebtReportRequest
) -> DebtReport:
    query = db.query(SalesOrder)

    if request.customer_id:
        query = query.filter(SalesOrder.customer_id == request.customer_id)

    if request.period_start:
        query = query.filter(SalesOrder.order_date >= request.period_start)

    if request.period_end:
        query = query.filter(SalesOrder.order_date <= request.period_end)

    orders = query.all()

    total_debt = sum(o.actual_amount for o in orders)
    total_paid = sum(o.paid_amount for o in orders)
    total_returned = sum(o.returned_amount for o in orders)
    final_debt = sum(o.debt_amount for o in orders)

    need_review = any(o.debt_amount < 0 for o in orders)

    db_report = DebtReport(
        report_no=generate_order_no("RPT"),
        customer_id=request.customer_id,
        period_start=request.period_start,
        period_end=request.period_end,
        total_debt=total_debt,
        total_paid=total_paid,
        total_returned=total_returned,
        final_debt=final_debt,
        status="generated",
        need_review=need_review
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    return db_report


def get_debt_report_by_id(db: Session, report_id: int) -> Optional[DebtReport]:
    return db.query(DebtReport).filter(DebtReport.id == report_id).first()


def get_debt_reports(
    db: Session, skip: int = 0, limit: int = 100, customer_id: int = None
) -> List[DebtReport]:
    query = db.query(DebtReport)
    if customer_id:
        query = query.filter(DebtReport.customer_id == customer_id)
    return query.offset(skip).limit(limit).all()
