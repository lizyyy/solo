from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from app.models import CompensationVoucher, CompensationRecord, CompensationStatus
from app.schemas import VoucherCreate


class VoucherService:
    def __init__(self, db: Session):
        self.db = db

    def create_voucher(
        self,
        voucher_no: str,
        user_id: str,
        amount: float,
        valid_days: int = 30
    ) -> CompensationVoucher:
        now = datetime.utcnow()
        valid_from = now
        valid_to = now + timedelta(days=valid_days)

        existing = self.db.query(CompensationVoucher).filter(
            CompensationVoucher.voucher_no == voucher_no
        ).first()
        if existing:
            raise ValueError(f"券号 {voucher_no} 已存在")

        voucher = CompensationVoucher(
            voucher_no=voucher_no,
            user_id=user_id,
            amount=amount,
            valid_from=valid_from,
            valid_to=valid_to,
            status="unused"
        )
        self.db.add(voucher)
        self.db.flush()
        return voucher

    def get_voucher(self, voucher_no: str) -> Optional[CompensationVoucher]:
        return self.db.query(CompensationVoucher).filter(
            CompensationVoucher.voucher_no == voucher_no
        ).first()

    def get_voucher_by_id(self, voucher_id: int) -> Optional[CompensationVoucher]:
        return self.db.query(CompensationVoucher).filter(
            CompensationVoucher.id == voucher_id
        ).first()

    def get_user_vouchers(
        self,
        user_id: str,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[CompensationVoucher], int]:
        query = self.db.query(CompensationVoucher).filter(
            CompensationVoucher.user_id == user_id
        )
        if status:
            query = query.filter(CompensationVoucher.status == status)

        total = query.count()
        vouchers = query.order_by(CompensationVoucher.created_at.desc()) \
            .offset((page - 1) * page_size) \
            .limit(page_size) \
            .all()
        return vouchers, total

    def bind_voucher_to_case(
        self,
        voucher_no: str,
        case_no: str
    ) -> CompensationRecord:
        voucher = self.get_voucher(voucher_no)
        if not voucher:
            raise ValueError(f"券号 {voucher_no} 不存在")

        if voucher.status != "unused":
            raise ValueError(f"券号 {voucher_no} 状态不是未使用，无法绑定")

        record = self.db.query(CompensationRecord).filter(
            CompensationRecord.case_no == case_no
        ).first()
        if not record:
            raise ValueError(f"案件 {case_no} 不存在")

        if record.voucher_id:
            raise ValueError(f"案件 {case_no} 已绑定补偿券")

        record.voucher_id = voucher.id
        self.db.flush()
        return record

    def use_voucher(
        self,
        voucher_no: str,
        operator: Optional[str] = None,
        remark: Optional[str] = None
    ) -> CompensationVoucher:
        voucher = self.get_voucher(voucher_no)
        if not voucher:
            raise ValueError(f"券号 {voucher_no} 不存在")

        if voucher.status != "unused":
            raise ValueError(f"券号 {voucher_no} 状态不是未使用，无法核销")

        now = datetime.utcnow()
        if voucher.valid_to and now > voucher.valid_to:
            raise ValueError(f"券号 {voucher_no} 已过期")

        voucher.status = "used"
        voucher.used_time = now

        record = self.db.query(CompensationRecord).filter(
            CompensationRecord.voucher_id == voucher.id
        ).first()
        if record:
            record.status = CompensationStatus.COMPENSATED
            from app.services.compensation_service import CompensationStateMachine
            if CompensationStateMachine.can_transition(record.status, CompensationStatus.COMPENSATED):
                record.status = CompensationStatus.COMPENSATED

        self.db.flush()
        return voucher

    def create_and_bind_voucher(
        self,
        case_no: str,
        voucher_no: Optional[str] = None,
        amount: Optional[float] = None,
        valid_days: int = 30
    ) -> Tuple[CompensationVoucher, CompensationRecord]:
        record = self.db.query(CompensationRecord).filter(
            CompensationRecord.case_no == case_no
        ).first()
        if not record:
            raise ValueError(f"案件 {case_no} 不存在")

        if record.voucher_id:
            raise ValueError(f"案件 {case_no} 已绑定补偿券")

        if amount is None:
            amount = record.compensation_amount

        if amount <= 0:
            raise ValueError("补偿金额必须大于0")

        if not voucher_no:
            voucher_no = f"VOU{datetime.now().strftime('%Y%m%d%H%M%S')}{record.id:04d}"

        voucher = self.create_voucher(
            voucher_no=voucher_no,
            user_id=record.user_id,
            amount=amount,
            valid_days=valid_days
        )

        record.voucher_id = voucher.id
        self.db.flush()

        return voucher, record

    def query_vouchers(
        self,
        voucher_no: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[CompensationVoucher], int]:
        query = self.db.query(CompensationVoucher)

        if voucher_no:
            query = query.filter(CompensationVoucher.voucher_no == voucher_no)
        if user_id:
            query = query.filter(CompensationVoucher.user_id == user_id)
        if status:
            query = query.filter(CompensationVoucher.status == status)
        if start_date:
            query = query.filter(CompensationVoucher.created_at >= start_date)
        if end_date:
            query = query.filter(CompensationVoucher.created_at <= end_date)

        total = query.count()
        vouchers = query.order_by(CompensationVoucher.created_at.desc()) \
            .offset((page - 1) * page_size) \
            .limit(page_size) \
            .all()

        return vouchers, total
