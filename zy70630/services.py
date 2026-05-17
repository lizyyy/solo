from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import List, Optional
import uuid

from database import Customer, Bucket, DepositRecord, Delivery, DeliveryBucket, BucketReturn, ReturnBucket
from schemas import CustomerCreate, CustomerUpdate, BucketCreate, DeliveryCreate, BucketReturnCreate, ErrorCode


class BusinessException(Exception):
    def __init__(self, code: str, message: str, detail: dict = None):
        self.code = code
        self.message = message
        self.detail = detail or {}


def generate_transaction_no(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:12].upper()}"


class CustomerService:
    @staticmethod
    def create_customer(db: Session, customer: CustomerCreate) -> Customer:
        existing = db.query(Customer).filter(Customer.phone == customer.phone).first()
        if existing:
            raise BusinessException(
                ErrorCode.DUPLICATE_TRANSACTION,
                "该手机号客户已存在",
                {"phone": customer.phone}
            )
        
        db_customer = Customer(
            name=customer.name,
            phone=customer.phone,
            address=customer.address
        )
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        return db_customer

    @staticmethod
    def get_customer(db: Session, customer_id: int) -> Optional[Customer]:
        return db.query(Customer).filter(Customer.id == customer_id).first()

    @staticmethod
    def get_customer_by_phone(db: Session, phone: str) -> Optional[Customer]:
        return db.query(Customer).filter(Customer.phone == phone).first()

    @staticmethod
    def list_customers(db: Session, skip: int = 0, limit: int = 100) -> List[Customer]:
        return db.query(Customer).offset(skip).limit(limit).all()

    @staticmethod
    def update_customer(db: Session, customer_id: int, customer_update: CustomerUpdate) -> Customer:
        customer = CustomerService.get_customer(db, customer_id)
        if not customer:
            raise BusinessException(
                ErrorCode.CUSTOMER_NOT_FOUND,
                "客户不存在",
                {"customer_id": customer_id}
            )
        
        update_data = customer_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(customer, key, value)
        
        db.commit()
        db.refresh(customer)
        return customer


class BucketService:
    @staticmethod
    def create_bucket(db: Session, bucket: BucketCreate) -> Bucket:
        existing = db.query(Bucket).filter(Bucket.bucket_number == bucket.bucket_number).first()
        if existing:
            raise BusinessException(
                ErrorCode.DUPLICATE_TRANSACTION,
                "该桶编号已存在",
                {"bucket_number": bucket.bucket_number}
            )
        
        db_bucket = Bucket(
            bucket_number=bucket.bucket_number,
            deposit_amount=bucket.deposit_amount
        )
        db.add(db_bucket)
        db.commit()
        db.refresh(db_bucket)
        return db_bucket

    @staticmethod
    def get_bucket(db: Session, bucket_id: int) -> Optional[Bucket]:
        return db.query(Bucket).filter(Bucket.id == bucket_id).first()

    @staticmethod
    def get_bucket_by_number(db: Session, bucket_number: str) -> Optional[Bucket]:
        return db.query(Bucket).filter(Bucket.bucket_number == bucket_number).first()

    @staticmethod
    def list_buckets(db: Session, status: str = None, skip: int = 0, limit: int = 100) -> List[Bucket]:
        query = db.query(Bucket)
        if status:
            query = query.filter(Bucket.status == status)
        return query.offset(skip).limit(limit).all()


class DeliveryService:
    @staticmethod
    def create_delivery(db: Session, delivery: DeliveryCreate) -> Delivery:
        customer = CustomerService.get_customer(db, delivery.customer_id)
        if not customer:
            raise BusinessException(
                ErrorCode.CUSTOMER_NOT_FOUND,
                "客户不存在",
                {"customer_id": delivery.customer_id}
            )

        if delivery.use_deposit_credit > customer.available_deposit:
            raise BusinessException(
                ErrorCode.INSUFFICIENT_DEPOSIT,
                "可用押金余额不足",
                {"available": customer.available_deposit, "requested": delivery.use_deposit_credit}
            )

        buckets = []
        for bucket_number in delivery.bucket_numbers:
            bucket = BucketService.get_bucket_by_number(db, bucket_number)
            if not bucket:
                raise BusinessException(
                    ErrorCode.BUCKET_NOT_FOUND,
                    f"桶编号 {bucket_number} 不存在",
                    {"bucket_number": bucket_number}
                )
            if bucket.status != "in_stock":
                raise BusinessException(
                    ErrorCode.INVALID_STATE,
                    f"桶编号 {bucket_number} 状态不允许出库",
                    {"bucket_number": bucket_number, "status": bucket.status}
                )
            buckets.append(bucket)

        total_deposit = delivery.quantity * delivery.deposit_per_bucket
        actual_pay_deposit = max(0, total_deposit - delivery.use_deposit_credit)

        order_no = generate_transaction_no("DL")

        db_delivery = Delivery(
            order_no=order_no,
            customer_id=delivery.customer_id,
            delivery_address=delivery.delivery_address,
            quantity=delivery.quantity,
            deposit_per_bucket=delivery.deposit_per_bucket,
            total_deposit=total_deposit,
            use_deposit_credit=delivery.use_deposit_credit,
            actual_pay_deposit=actual_pay_deposit,
            notes=delivery.notes
        )
        db.add(db_delivery)
        db.flush()

        for bucket in buckets:
            db_delivery_bucket = DeliveryBucket(
                delivery_id=db_delivery.id,
                bucket_id=bucket.id
            )
            db.add(db_delivery_bucket)
            
            bucket.status = "out"
            bucket.current_customer_id = customer.id

        if delivery.use_deposit_credit > 0:
            customer.used_deposit += delivery.use_deposit_credit
            customer.available_deposit -= delivery.use_deposit_credit

        customer.total_deposit += actual_pay_deposit
        customer.available_deposit += actual_pay_deposit
        customer.pending_buckets += delivery.quantity

        transaction_no = generate_transaction_no("DP")
        db_deposit = DepositRecord(
            customer_id=customer.id,
            transaction_no=transaction_no,
            amount=actual_pay_deposit,
            record_type="charge",
            status="completed",
            related_order_no=order_no,
            processed_at=datetime.utcnow()
        )
        db.add(db_deposit)

        db.commit()
        db.refresh(db_delivery)
        return db_delivery

    @staticmethod
    def get_delivery(db: Session, delivery_id: int) -> Optional[Delivery]:
        return db.query(Delivery).filter(Delivery.id == delivery_id).first()

    @staticmethod
    def get_delivery_by_order_no(db: Session, order_no: str) -> Optional[Delivery]:
        return db.query(Delivery).filter(Delivery.order_no == order_no).first()

    @staticmethod
    def list_deliveries(db: Session, customer_id: int = None, skip: int = 0, limit: int = 100) -> List[Delivery]:
        query = db.query(Delivery)
        if customer_id:
            query = query.filter(Delivery.customer_id == customer_id)
        return query.offset(skip).limit(limit).all()


class ReturnService:
    @staticmethod
    def create_return(db: Session, return_data: BucketReturnCreate) -> BucketReturn:
        customer = CustomerService.get_customer(db, return_data.customer_id)
        if not customer:
            raise BusinessException(
                ErrorCode.CUSTOMER_NOT_FOUND,
                "客户不存在",
                {"customer_id": return_data.customer_id}
            )

        buckets = []
        for bucket_number in return_data.bucket_numbers:
            bucket = BucketService.get_bucket_by_number(db, bucket_number)
            if not bucket:
                raise BusinessException(
                    ErrorCode.BUCKET_NOT_FOUND,
                    f"桶编号 {bucket_number} 不存在",
                    {"bucket_number": bucket_number}
                )
            if bucket.current_customer_id != customer.id:
                raise BusinessException(
                    ErrorCode.NEEDS_MANUAL_REVIEW,
                    f"桶编号 {bucket_number} 不属于当前客户，需人工复核",
                    {"bucket_number": bucket_number, "current_customer_id": bucket.current_customer_id}
                )
            buckets.append(bucket)

        quantity = len(buckets)
        refund_amount = sum(b.deposit_amount for b in buckets)
        actual_refund = max(0, refund_amount - return_data.deduct_amount)

        return_no = generate_transaction_no("RT")

        db_return = BucketReturn(
            return_no=return_no,
            customer_id=return_data.customer_id,
            quantity=quantity,
            refund_amount=refund_amount,
            deduct_amount=return_data.deduct_amount,
            actual_refund=actual_refund,
            notes=return_data.notes
        )
        db.add(db_return)
        db.flush()

        for bucket in buckets:
            db_return_bucket = ReturnBucket(
                return_id=db_return.id,
                bucket_id=bucket.id
            )
            db.add(db_return_bucket)
            
            bucket.status = "in_stock"
            bucket.current_customer_id = None

        customer.total_deposit -= refund_amount
        customer.available_deposit -= actual_refund
        customer.pending_buckets -= quantity

        if customer.pending_buckets < 0:
            customer.pending_buckets = 0

        transaction_no = generate_transaction_no("RF")
        db_deposit = DepositRecord(
            customer_id=customer.id,
            transaction_no=transaction_no,
            amount=-actual_refund,
            record_type="refund",
            status="completed",
            related_order_no=return_no,
            processed_at=datetime.utcnow()
        )
        db.add(db_deposit)

        db.commit()
        db.refresh(db_return)
        return db_return

    @staticmethod
    def get_return(db: Session, return_id: int) -> Optional[BucketReturn]:
        return db.query(BucketReturn).filter(BucketReturn.id == return_id).first()

    @staticmethod
    def get_return_by_return_no(db: Session, return_no: str) -> Optional[BucketReturn]:
        return db.query(BucketReturn).filter(BucketReturn.return_no == return_no).first()

    @staticmethod
    def list_returns(db: Session, customer_id: int = None, skip: int = 0, limit: int = 100) -> List[BucketReturn]:
        query = db.query(BucketReturn)
        if customer_id:
            query = query.filter(BucketReturn.customer_id == customer_id)
        return query.offset(skip).limit(limit).all()


class DepositService:
    @staticmethod
    def list_deposit_records(db: Session, customer_id: int = None, record_type: str = None, 
                              skip: int = 0, limit: int = 100) -> List[DepositRecord]:
        query = db.query(DepositRecord)
        if customer_id:
            query = query.filter(DepositRecord.customer_id == customer_id)
        if record_type:
            query = query.filter(DepositRecord.record_type == record_type)
        return query.offset(skip).limit(limit).all()


class ReportService:
    @staticmethod
    def generate_deposit_report(db: Session):
        customers = db.query(Customer).all()
        
        items = []
        total_pending_buckets = 0
        total_deposit_amount = 0
        total_available_deposit = 0

        for customer in customers:
            delivery_count = db.query(func.count(Delivery.id)).filter(
                Delivery.customer_id == customer.id
            ).scalar()
            
            return_count = db.query(func.count(BucketReturn.id)).filter(
                BucketReturn.customer_id == customer.id
            ).scalar()

            items.append({
                "customer_id": customer.id,
                "customer_name": customer.name,
                "customer_phone": customer.phone,
                "pending_buckets": customer.pending_buckets,
                "total_deposit": customer.total_deposit,
                "used_deposit": customer.used_deposit,
                "available_deposit": customer.available_deposit,
                "total_deliveries": delivery_count,
                "total_returns": return_count
            })

            total_pending_buckets += customer.pending_buckets
            total_deposit_amount += customer.total_deposit
            total_available_deposit += customer.available_deposit

        return {
            "generated_at": datetime.utcnow(),
            "total_customers": len(customers),
            "total_pending_buckets": total_pending_buckets,
            "total_deposit_amount": total_deposit_amount,
            "total_available_deposit": total_available_deposit,
            "items": items
        }
