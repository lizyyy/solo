from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Tuple
from datetime import datetime
import uuid
import json
import os
import pandas as pd
from app.models import (
    Customer, CreditOrder, CreditOrderItem, ReturnRecord,
    Payment, DebtReport, ExceptionLog
)
from app.schemas import (
    CustomerCreate, CustomerUpdate, CreditOrderCreate,
    ReturnRecordCreate, PaymentCreate, ManualCorrectionRequest
)


def generate_order_no():
    return f"SO{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"


def generate_return_no():
    return f"RT{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"


def generate_payment_no():
    return f"PY{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"


def generate_report_no():
    return f"RP{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"


def recalculate_order_debt(db: Session, order_id: int):
    order = db.query(CreditOrder).filter(CreditOrder.id == order_id).first()
    if not order:
        return

    total_amount = sum(item.total_price for item in order.items)
    return_amount = sum(ret.total_amount for ret in order.returns)
    paid_amount = sum(pay.amount for pay in order.payments if pay.status == "confirmed")

    order.total_amount = total_amount
    order.return_amount = return_amount
    order.paid_amount = paid_amount
    order.debt_amount = max(0.0, total_amount - order.discount_amount - return_amount - paid_amount)

    if order.debt_amount <= 0:
        order.status = "paid"
    elif order.paid_amount > 0:
        order.status = "partial"
    else:
        order.status = "pending"

    db.commit()


def log_exception(
    db: Session,
    request_id: str,
    endpoint: str,
    method: str,
    raw_input: dict,
    error_message: str,
    error_type: str,
    resolution: str = "待处理"
):
    exception_log = ExceptionLog(
        request_id=request_id,
        endpoint=endpoint,
        method=method,
        raw_input=json.dumps(raw_input, ensure_ascii=False),
        error_message=error_message,
        error_type=error_type,
        resolution=resolution,
        status="pending"
    )
    db.add(exception_log)
    db.commit()
    return exception_log


class CustomerService:
    @staticmethod
    def create(db: Session, customer: CustomerCreate):
        db_customer = Customer(**customer.dict())
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        return db_customer

    @staticmethod
    def get_by_id(db: Session, customer_id: int):
        return db.query(Customer).filter(Customer.id == customer_id).first()

    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100, only_active: bool = True):
        query = db.query(Customer)
        if only_active:
            query = query.filter(Customer.is_active == True)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def update(db: Session, customer_id: int, customer_update: CustomerUpdate):
        customer = CustomerService.get_by_id(db, customer_id)
        if not customer:
            return None
        for key, value in customer_update.dict(exclude_unset=True).items():
            setattr(customer, key, value)
        db.commit()
        db.refresh(customer)
        return customer


class CreditOrderService:
    @staticmethod
    def create(db: Session, order: CreditOrderCreate, request_id: str = None):
        existing = db.query(CreditOrder).filter(
            CreditOrder.idempotency_key == order.idempotency_key
        ).first()
        if existing:
            return existing, False

        customer = CustomerService.get_by_id(db, order.customer_id)
        if not customer:
            raise ValueError(f"客户ID {order.customer_id} 不存在")

        try:
            db_order = CreditOrder(
                order_no=generate_order_no(),
                customer_id=order.customer_id,
                order_date=order.order_date or datetime.now(),
                discount_amount=order.discount_amount or 0.0,
                remark=order.remark,
                idempotency_key=order.idempotency_key,
                status="pending"
            )
            db.add(db_order)
            db.flush()

            total_amount = 0.0
            for item in order.items:
                total_price = item.quantity * item.unit_price
                db_item = CreditOrderItem(
                    order_id=db_order.id,
                    product_batch=item.product_batch,
                    product_name=item.product_name,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    total_price=total_price,
                    unit=item.unit,
                    specification=item.specification
                )
                db.add(db_item)
                total_amount += total_price

            db_order.total_amount = total_amount
            db_order.debt_amount = max(0.0, total_amount - db_order.discount_amount)

            db.commit()
            db.refresh(db_order)
            return db_order, True
        except IntegrityError as e:
            db.rollback()
            existing = db.query(CreditOrder).filter(
                CreditOrder.idempotency_key == order.idempotency_key
            ).first()
            if existing:
                return existing, False
            raise e

    @staticmethod
    def get_by_id(db: Session, order_id: int):
        return db.query(CreditOrder).filter(CreditOrder.id == order_id).first()

    @staticmethod
    def get_by_no(db: Session, order_no: str):
        return db.query(CreditOrder).filter(CreditOrder.order_no == order_no).first()

    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100, customer_id: int = None, status: str = None):
        query = db.query(CreditOrder)
        if customer_id:
            query = query.filter(CreditOrder.customer_id == customer_id)
        if status:
            query = query.filter(CreditOrder.status == status)
        return query.order_by(CreditOrder.created_at.desc()).offset(skip).limit(limit).all()


class ReturnService:
    @staticmethod
    def create(db: Session, return_record: ReturnRecordCreate):
        existing = db.query(ReturnRecord).filter(
            ReturnRecord.idempotency_key == return_record.idempotency_key
        ).first()
        if existing:
            return existing, False

        order = CreditOrderService.get_by_id(db, return_record.order_id)
        if not order:
            raise ValueError(f"赊销单ID {return_record.order_id} 不存在")

        order_item = None
        for item in order.items:
            if item.product_batch == return_record.product_batch:
                order_item = item
                break

        if not order_item:
            raise ValueError(f"赊销单中未找到商品批次 {return_record.product_batch}")

        available_quantity = order_item.quantity - order_item.return_quantity
        if return_record.quantity > available_quantity:
            raise ValueError(f"退货数量超过可退数量，可退数量: {available_quantity}")

        total_amount = return_record.quantity * return_record.unit_price

        db_return = ReturnRecord(
            return_no=generate_return_no(),
            order_id=return_record.order_id,
            return_date=return_record.return_date or datetime.now(),
            product_batch=return_record.product_batch,
            product_name=return_record.product_name,
            quantity=return_record.quantity,
            unit_price=return_record.unit_price,
            total_amount=total_amount,
            reason=return_record.reason,
            idempotency_key=return_record.idempotency_key
        )
        db.add(db_return)
        db.flush()

        order_item.return_quantity += return_record.quantity

        db.commit()
        recalculate_order_debt(db, return_record.order_id)
        db.refresh(db_return)
        return db_return, True

    @staticmethod
    def get_by_id(db: Session, return_id: int):
        return db.query(ReturnRecord).filter(ReturnRecord.id == return_id).first()

    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100, order_id: int = None):
        query = db.query(ReturnRecord)
        if order_id:
            query = query.filter(ReturnRecord.order_id == order_id)
        return query.order_by(ReturnRecord.created_at.desc()).offset(skip).limit(limit).all()


class PaymentService:
    @staticmethod
    def create(db: Session, payment: PaymentCreate):
        existing = db.query(Payment).filter(
            Payment.idempotency_key == payment.idempotency_key
        ).first()
        if existing:
            return existing, False

        customer = CustomerService.get_by_id(db, payment.customer_id)
        if not customer:
            raise ValueError(f"客户ID {payment.customer_id} 不存在")

        if payment.order_id:
            order = CreditOrderService.get_by_id(db, payment.order_id)
            if not order:
                raise ValueError(f"赊销单ID {payment.order_id} 不存在")

        db_payment = Payment(
            payment_no=generate_payment_no(),
            customer_id=payment.customer_id,
            order_id=payment.order_id,
            payment_date=payment.payment_date or datetime.now(),
            amount=payment.amount,
            payment_method=payment.payment_method or "现金",
            remark=payment.remark,
            idempotency_key=payment.idempotency_key,
            status="confirmed"
        )
        db.add(db_payment)
        db.commit()

        if payment.order_id:
            recalculate_order_debt(db, payment.order_id)

        db.refresh(db_payment)
        return db_payment, True

    @staticmethod
    def get_by_id(db: Session, payment_id: int):
        return db.query(Payment).filter(Payment.id == payment_id).first()

    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100, customer_id: int = None, order_id: int = None):
        query = db.query(Payment)
        if customer_id:
            query = query.filter(Payment.customer_id == customer_id)
        if order_id:
            query = query.filter(Payment.order_id == order_id)
        return query.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()


class ReportService:
    @staticmethod
    def generate_debt_report(
        db: Session,
        customer_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ):
        query = db.query(CreditOrder)

        if customer_id:
            query = query.filter(CreditOrder.customer_id == customer_id)
        if start_date:
            query = query.filter(CreditOrder.order_date >= start_date)
        if end_date:
            query = query.filter(CreditOrder.order_date <= end_date)

        orders = query.all()

        total_debt = sum(o.total_amount - o.discount_amount for o in orders)
        total_paid = sum(o.paid_amount for o in orders)
        total_return = sum(o.return_amount for o in orders)
        net_debt = sum(o.debt_amount for o in orders)

        customer_name = None
        if customer_id:
            customer = CustomerService.get_by_id(db, customer_id)
            if customer:
                customer_name = customer.name

        report = DebtReport(
            report_no=generate_report_no(),
            customer_id=customer_id,
            customer_name=customer_name,
            report_date=datetime.now(),
            start_date=start_date,
            end_date=end_date,
            total_debt=total_debt,
            total_paid=total_paid,
            total_return=total_return,
            net_debt=net_debt,
            order_count=len(orders),
            status="generated"
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def export_to_excel(db: Session, report_id: int, export_dir: str = "./exports"):
        report = db.query(DebtReport).filter(DebtReport.id == report_id).first()
        if not report:
            raise ValueError(f"报告ID {report_id} 不存在")

        os.makedirs(export_dir, exist_ok=True)

        query = db.query(CreditOrder)
        if report.customer_id:
            query = query.filter(CreditOrder.customer_id == report.customer_id)
        if report.start_date:
            query = query.filter(CreditOrder.order_date >= report.start_date)
        if report.end_date:
            query = query.filter(CreditOrder.order_date <= report.end_date)

        orders = query.all()

        order_data = []
        for order in orders:
            customer = CustomerService.get_by_id(db, order.customer_id)
            order_data.append({
                "赊销单号": order.order_no,
                "客户名称": customer.name if customer else "",
                "联系电话": customer.phone if customer else "",
                "赊销日期": order.order_date.strftime("%Y-%m-%d") if order.order_date else "",
                "商品金额": order.total_amount,
                "折扣金额": order.discount_amount,
                "退货金额": order.return_amount,
                "已付金额": order.paid_amount,
                "欠款金额": order.debt_amount,
                "状态": order.status,
                "备注": order.remark or ""
            })

        df_orders = pd.DataFrame(order_data)

        detail_data = []
        for order in orders:
            customer = CustomerService.get_by_id(db, order.customer_id)
            for item in order.items:
                detail_data.append({
                    "赊销单号": order.order_no,
                    "客户名称": customer.name if customer else "",
                    "商品批次": item.product_batch,
                    "商品名称": item.product_name,
                    "规格": item.specification or "",
                    "单位": item.unit or "",
                    "数量": item.quantity,
                    "单价": item.unit_price,
                    "金额": item.total_price,
                    "已退数量": item.return_quantity
                })

        df_details = pd.DataFrame(detail_data)

        return_data = []
        for order in orders:
            for ret in order.returns:
                return_data.append({
                    "退货单号": ret.return_no,
                    "赊销单号": order.order_no,
                    "退货日期": ret.return_date.strftime("%Y-%m-%d") if ret.return_date else "",
                    "商品批次": ret.product_batch,
                    "商品名称": ret.product_name,
                    "退货数量": ret.quantity,
                    "单价": ret.unit_price,
                    "退货金额": ret.total_amount,
                    "退货原因": ret.reason or ""
                })

        df_returns = pd.DataFrame(return_data) if return_data else pd.DataFrame()

        payment_data = []
        for order in orders:
            for payment in order.payments:
                payment_data.append({
                    "回款单号": payment.payment_no,
                    "赊销单号": order.order_no,
                    "回款日期": payment.payment_date.strftime("%Y-%m-%d") if payment.payment_date else "",
                    "回款金额": payment.amount,
                    "回款方式": payment.payment_method or "",
                    "状态": payment.status,
                    "备注": payment.remark or ""
                })

        df_payments = pd.DataFrame(payment_data) if payment_data else pd.DataFrame()

        file_path = os.path.join(export_dir, f"{report.report_no}.xlsx")

        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            df_orders.to_excel(writer, sheet_name='欠款汇总', index=False)
            df_details.to_excel(writer, sheet_name='商品明细', index=False)
            if not df_returns.empty:
                df_returns.to_excel(writer, sheet_name='退货记录', index=False)
            if not df_payments.empty:
                df_payments.to_excel(writer, sheet_name='回款流水', index=False)

            summary_df = pd.DataFrame([{
                "报告编号": report.report_no,
                "生成日期": report.report_date.strftime("%Y-%m-%d %H:%M:%S"),
                "客户范围": report.customer_name or "全部客户",
                "日期范围": f"{report.start_date.strftime('%Y-%m-%d') if report.start_date else '不限'} 至 {report.end_date.strftime('%Y-%m-%d') if report.end_date else '不限'}",
                "订单总数": report.order_count,
                "应收总额": report.total_debt,
                "已收总额": report.total_paid,
                "退货总额": report.total_return,
                "欠款总额": report.net_debt,
            }])
            summary_df.to_excel(writer, sheet_name='报告摘要', index=False)

        report.file_path = file_path
        db.commit()

        return file_path

    @staticmethod
    def get_report_by_id(db: Session, report_id: int):
        return db.query(DebtReport).filter(DebtReport.id == report_id).first()

    @staticmethod
    def get_all_reports(db: Session, skip: int = 0, limit: int = 100):
        return db.query(DebtReport).order_by(DebtReport.created_at.desc()).offset(skip).limit(limit).all()


class CorrectionService:
    @staticmethod
    def manual_correct(db: Session, request: ManualCorrectionRequest):
        order = CreditOrderService.get_by_id(db, request.order_id)
        if not order:
            raise ValueError(f"赊销单ID {request.order_id} 不存在")

        original_debt = order.debt_amount
        order.debt_amount = request.new_debt_amount

        if request.new_debt_amount <= 0:
            order.status = "paid"
        elif order.paid_amount > 0:
            order.status = "partial"
        else:
            order.status = "pending"

        order.remark = f"{order.remark or ''} | 人工调整: 原欠款{original_debt} -> 新欠款{request.new_debt_amount}, 原因: {request.correction_reason}, 操作人: {request.corrected_by}"

        db.commit()
        db.refresh(order)
        return order


class ExceptionService:
    @staticmethod
    def get_all(db: Session, skip: int = 0, limit: int = 100, status: str = None):
        query = db.query(ExceptionLog)
        if status:
            query = query.filter(ExceptionLog.status == status)
        return query.order_by(ExceptionLog.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def resolve(db: Session, exception_id: int, resolution: str, resolved_by: str):
        exception = db.query(ExceptionLog).filter(ExceptionLog.id == exception_id).first()
        if not exception:
            return None
        exception.status = "resolved"
        exception.resolution = resolution
        exception.resolved_by = resolved_by
        exception.resolved_at = datetime.now()
        db.commit()
        db.refresh(exception)
        return exception
