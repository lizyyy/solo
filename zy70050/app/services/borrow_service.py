from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.borrow import Borrow, BorrowStatus
from app.models.instrument import Instrument, InstrumentStatus
from app.models.user import User
from app.schemas.borrow import BorrowCreate, BorrowReturn, BorrowUpdate
from app.services.history_service import HistoryService
from app.core.config import settings


class BorrowService:
    @staticmethod
    def create(
        db: Session,
        data: BorrowCreate,
        created_by: Optional[User] = None,
    ) -> Borrow:
        instrument = db.query(Instrument).filter(Instrument.id == data.instrument_id).first()
        if not instrument:
            raise ValueError("器具不存在")
        
        if instrument.status != InstrumentStatus.IN_STOCK:
            raise ValueError(f"器具当前状态为 {instrument.status.value}，无法借用")
        
        if data.borrow_date > data.expected_return_date:
            raise ValueError("借用日期不能晚于预计归还日期")
        
        active_borrow = (
            db.query(Borrow)
            .filter(
                Borrow.instrument_id == data.instrument_id,
                Borrow.status.in_([BorrowStatus.PENDING, BorrowStatus.BORROWED, BorrowStatus.OVERDUE]),
            )
            .first()
        )
        if active_borrow:
            raise ValueError("该器具存在未完成的借用记录")
        
        borrow = Borrow(
            instrument_id=data.instrument_id,
            borrower_id=data.borrower_id,
            purpose=data.purpose,
            department=data.department,
            workshop=data.workshop,
            work_order=data.work_order,
            borrow_date=data.borrow_date,
            expected_return_date=data.expected_return_date,
            status=BorrowStatus.BORROWED,
            created_by=created_by.id if created_by else None,
        )
        
        old_status = instrument.status
        instrument.status = InstrumentStatus.BORROWED
        
        borrower = db.query(User).filter(User.id == data.borrower_id).first()
        borrower_name = borrower.full_name if borrower else "未知借用人"
        
        HistoryService.record_borrow(
            db=db,
            instrument=instrument,
            borrower_name=borrower_name,
            borrow_purpose=data.purpose,
            created_by=created_by,
        )
        
        db.add(borrow)
        db.commit()
        db.refresh(borrow)
        return borrow

    @staticmethod
    def get_by_id(db: Session, borrow_id: int) -> Optional[Borrow]:
        return db.query(Borrow).filter(Borrow.id == borrow_id).first()

    @staticmethod
    def list(
        db: Session,
        status: Optional[BorrowStatus] = None,
        instrument_id: Optional[int] = None,
        borrower_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Borrow]:
        query = db.query(Borrow)
        
        if status:
            query = query.filter(Borrow.status == status)
        if instrument_id:
            query = query.filter(Borrow.instrument_id == instrument_id)
        if borrower_id:
            query = query.filter(Borrow.borrower_id == borrower_id)
        
        return query.order_by(Borrow.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def return_borrow(
        db: Session,
        borrow_id: int,
        data: BorrowReturn,
        operator: Optional[User] = None,
    ) -> Borrow:
        borrow = BorrowService.get_by_id(db, borrow_id)
        if not borrow:
            raise ValueError("借用记录不存在")
        
        if borrow.status not in [BorrowStatus.BORROWED, BorrowStatus.OVERDUE]:
            raise ValueError(f"借用状态为 {borrow.status.value}，无法归还")
        
        if data.return_date < borrow.borrow_date:
            raise ValueError("归还日期不能早于借用日期")
        
        instrument = db.query(Instrument).filter(Instrument.id == borrow.instrument_id).first()
        if instrument:
            instrument.status = InstrumentStatus.IN_STOCK
        
        borrow.status = BorrowStatus.RETURNED
        borrow.actual_return_date = data.return_date
        borrow.return_condition = data.return_condition or "正常"
        borrow.remarks = data.remarks
        
        HistoryService.record_return(
            db=db,
            instrument=instrument,
            return_condition=data.return_condition or "正常",
            created_by=operator,
        )
        
        db.commit()
        db.refresh(borrow)
        return borrow

    @staticmethod
    def check_overdue(db: Session) -> int:
        today = datetime.utcnow().date()
        overdue_borrows = (
            db.query(Borrow)
            .filter(
                Borrow.status.in_([BorrowStatus.BORROWED, BorrowStatus.PENDING]),
                Borrow.expected_return_date < today,
            )
            .all()
        )
        
        for borrow in overdue_borrows:
            borrow.status = BorrowStatus.OVERDUE
            borrow.is_overdue = True
        
        db.commit()
        return len(overdue_borrows)

    @staticmethod
    def get_overdue(db: Session) -> List[Borrow]:
        BorrowService.check_overdue(db)
        return (
            db.query(Borrow)
            .filter(Borrow.status == BorrowStatus.OVERDUE)
            .order_by(Borrow.expected_return_date.asc())
            .all()
        )

    @staticmethod
    def send_overdue_notice(db: Session, borrow_id: int) -> Dict[str, Any]:
        borrow = BorrowService.get_by_id(db, borrow_id)
        if not borrow:
            raise ValueError("借用记录不存在")
        
        if borrow.status != BorrowStatus.OVERDUE:
            raise ValueError("该借用未逾期")
        
        borrow.overdue_notice_count += 1
        borrow.last_overdue_notice_at = datetime.utcnow()
        
        today = datetime.utcnow().date()
        overdue_days = (today - borrow.expected_return_date).days
        
        borrower = db.query(User).filter(User.id == borrow.borrower_id).first()
        instrument = db.query(Instrument).filter(Instrument.id == borrow.instrument_id).first()
        
        notice = {
            "borrow_id": borrow.id,
            "instrument_name": instrument.name if instrument else "未知",
            "instrument_code": instrument.code if instrument else "未知",
            "borrower": borrower.full_name if borrower else "未知",
            "borrower_phone": borrower.phone if borrower else "",
            "borrow_date": borrow.borrow_date.isoformat(),
            "expected_return_date": borrow.expected_return_date.isoformat(),
            "overdue_days": overdue_days,
            "notice_count": borrow.overdue_notice_count,
            "notice_at": datetime.utcnow().isoformat(),
        }
        
        db.commit()
        return notice

    @staticmethod
    def cancel(
        db: Session,
        borrow_id: int,
        operator: Optional[User] = None,
        reason: str = "",
    ) -> Borrow:
        borrow = BorrowService.get_by_id(db, borrow_id)
        if not borrow:
            raise ValueError("借用记录不存在")
        
        if borrow.status != BorrowStatus.PENDING:
            raise ValueError(f"只有待确认的借用可以取消，当前状态：{borrow.status.value}")
        
        borrow.status = BorrowStatus.CANCELLED
        borrow.remarks = (borrow.remarks or "") + f"\n取消原因：{reason}"
        
        instrument = db.query(Instrument).filter(Instrument.id == borrow.instrument_id).first()
        if instrument:
            HistoryService.record_withdraw(
                db=db,
                instrument=instrument,
                old_values={"status": instrument.status.value if instrument.status else None},
                reason=f"取消借用：{reason}",
                created_by=operator,
            )
        
        db.commit()
        db.refresh(borrow)
        return borrow
