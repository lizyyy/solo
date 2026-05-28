import hashlib
import uuid
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from models import (
    LoanApplication, Customer, CustomerDocument, CancellationRecord,
    FollowupRecord, StatusHistory, CancellationList, CancellationListItem,
    ApplicationStatus, CancellationReason, ReviewStatus, RiskResult
)


def generate_no(prefix: str) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


def generate_idempotent_key(application_no: str, reason: str) -> str:
    key = f"{application_no}:{reason}:{datetime.now().strftime('%Y%m%d')}"
    return hashlib.md5(key.encode()).hexdigest()


class ApplicationStateMachine:
    VALID_TRANSITIONS = {
        ApplicationStatus.SUBMITTED: [ApplicationStatus.REVIEWING, ApplicationStatus.CANCELLED, ApplicationStatus.PENDING_REVIEW],
        ApplicationStatus.REVIEWING: [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED, ApplicationStatus.CANCELLED, ApplicationStatus.PENDING_REVIEW],
        ApplicationStatus.APPROVED: [ApplicationStatus.LOANED, ApplicationStatus.CANCELLED, ApplicationStatus.PENDING_REVIEW],
        ApplicationStatus.REJECTED: [ApplicationStatus.CANCELLED, ApplicationStatus.PENDING_REVIEW],
        ApplicationStatus.LOANED: [ApplicationStatus.CANCELLED, ApplicationStatus.PENDING_REVIEW],
        ApplicationStatus.CANCELLED: [ApplicationStatus.PENDING_REVIEW],
        ApplicationStatus.PENDING_REVIEW: [ApplicationStatus.CANCELLED, ApplicationStatus.REVIEWING],
    }

    @classmethod
    def can_transition(cls, from_status: str, to_status: str) -> bool:
        from_enum = ApplicationStatus(from_status) if isinstance(from_status, str) else from_status
        to_enum = ApplicationStatus(to_status) if isinstance(to_status, str) else to_status
        return to_enum in cls.VALID_TRANSITIONS.get(from_enum, [])

    @classmethod
    def transition(cls, db: Session, application: LoanApplication, to_status: str,
                   operator: str, remark: str = "") -> Tuple[bool, str]:
        if not cls.can_transition(application.status, to_status):
            return False, f"无法从 {application.status} 变更为 {to_status}"

        from_status = application.status
        application.status = to_status

        history = StatusHistory(
            application_id=application.id,
            from_status=from_status,
            to_status=to_status,
            operator=operator,
            remark=remark
        )
        db.add(history)
        db.commit()

        return True, "状态变更成功"


class DocumentValidator:
    @staticmethod
    def check_doc_expiry(db: Session, application_id: int) -> Tuple[bool, List[str]]:
        docs = db.query(CustomerDocument).filter(
            CustomerDocument.application_id == application_id
        ).all()

        warnings = []
        today = date.today()

        for doc in docs:
            if doc.expiry_date and doc.expiry_date < today:
                doc.is_valid = False
                warnings.append(f"{doc.doc_type}（{doc.doc_no}已于{doc.expiry_date}过期")

        db.commit()
        return len(warnings) == 0, warnings

    @staticmethod
    def is_application_with_expired_docs(db: Session, application_id: int) -> bool:
        _, warnings = DocumentValidator.check_doc_expiry(db, application_id)
        return len(warnings) > 0


class CancellationService:
    @staticmethod
    def check_duplicate_cancellation(db: Session, application_id: int, reason: str) -> Optional[CancellationRecord]:
        return db.query(CancellationRecord).filter(
            and_(
                CancellationRecord.application_id == application_id,
                CancellationRecord.reason == reason
            )
        ).first()

    @staticmethod
    def check_idempotent(db: Session, idempotent_key: str) -> Optional[CancellationRecord]:
        return db.query(CancellationRecord).filter(
            CancellationRecord.idempotent_key == idempotent_key
        ).first()

    @staticmethod
    def create_cancellation(
        db: Session, application: LoanApplication, reason: str,
        reason_detail: str, operator: str,
        check_duplicate: bool = True) -> Tuple[Optional[CancellationRecord], List[str]]:

        warnings = []

        idempotent_key = generate_idempotent_key(application.application_no, reason)
        existing = CancellationService.check_idempotent(db, idempotent_key)
        if existing:
            return existing, ["该撤件已存在（幂等校验）"]

        if check_duplicate:
            dup = CancellationService.check_duplicate_cancellation(db, application.id, reason)
            if dup:
                warnings.append(f"该申请已存在相同原因的撤件记录")

        doc_ok, doc_warnings = DocumentValidator.check_doc_expiry(db, application.id)
        if not doc_ok:
            warnings.extend(doc_warnings)

        special_warnings = SpecialCaseDetector.detect(db, application)
        warnings.extend(special_warnings)

        review_status = ReviewStatus.NORMAL
        if warnings:
            review_status = ReviewStatus.PENDING

        cancellation = CancellationRecord(
            application_id=application.id,
            cancellation_no=generate_no("CX"),
            reason=reason,
            reason_detail=reason_detail,
            operator=operator,
            is_idempotent=True,
            idempotent_key=idempotent_key
        )
        db.add(cancellation)

        application.review_status = review_status
        db.commit()
        db.refresh(cancellation)

        return cancellation, warnings

    @staticmethod
    def cancel_application(
        db: Session, application: LoanApplication,
        reason: str, reason_detail: str, operator: str
    ) -> Tuple[bool, str, List[str]]:
        if application.status == ApplicationStatus.CANCELLED:
            return False, "申请已撤件", []

        cancellation, warnings = CancellationService.create_cancellation(
            db, application, reason, reason_detail, operator
        )

        if not cancellation:
            return False, warnings[0] if warnings else "撤件失败", []

        success, msg = ApplicationStateMachine.transition(
            db, application, ApplicationStatus.CANCELLED, operator, f"撤件原因：{reason}")

        return success, msg, warnings


class SpecialCaseDetector:
    @staticmethod
    def detect(db: Session, application: LoanApplication) -> List[str]:
        warnings = []

        if SpecialCaseDetector.is_cancelling_during_review(application):
            warnings.append("【注意】该申请正处于审批中撤件，需确认是否已通知审批人员")

        if SpecialCaseDetector.is_loan_after_doc_expired(db, application):
            warnings.append("【警惕】资料已过期但已放款，请核实是否存在违规操作")

        if SpecialCaseDetector.has_duplicate_application(db, application):
            warnings.append("【提示】该客户近期有重复申请记录，请核对是否为同一笔业务")

        return warnings

    @staticmethod
    def is_cancelling_during_review(application: LoanApplication) -> bool:
        return application.status == ApplicationStatus.REVIEWING

    @staticmethod
    def is_loan_after_doc_expired(db: Session, application: LoanApplication) -> bool:
        if application.status != ApplicationStatus.LOANED:
            return False
        return DocumentValidator.is_application_with_expired_docs(db, application.id)

    @staticmethod
    def has_duplicate_application(db: Session, application: LoanApplication) -> bool:
        thirty_days_ago = datetime.now() - timedelta(days=30)
        count = db.query(LoanApplication).filter(
            and_(
                LoanApplication.customer_id == application.customer_id,
                LoanApplication.id != application.id,
                LoanApplication.created_at >= thirty_days_ago
            )
        ).count()
        return count > 0


class FollowupService:
    @staticmethod
    def add_followup(
        db: Session, application_id: int,
        followup_type: str, content: str,
        operator: str,
        parent_id: int = None
    ) -> FollowupRecord:
        version = 1
        is_original = True

        if parent_id:
            parent = db.query(FollowupRecord).get(parent_id)
            if parent:
                version = parent.version + 1
                is_original = False

        followup = FollowupRecord(
            application_id=application_id,
            followup_type=followup_type,
            content=content,
            operator=operator,
            parent_id=parent_id,
            version=version,
            is_original=is_original
        )
        db.add(followup)
        db.commit()
        db.refresh(followup)
        return followup

    @staticmethod
    def get_followup_history(db: Session, application_id: int) -> List[FollowupRecord]:
        return db.query(FollowupRecord).filter(
            FollowupRecord.application_id == application_id
        ).order_by(FollowupRecord.followup_at.desc()).all()


class CancellationListService:
    @staticmethod
    def generate_daily_list(db: Session, batch_date: date, operator: str) -> CancellationList:
        cancellations = db.query(CancellationRecord).filter(
            func.date(CancellationRecord.cancelled_at) == batch_date
        ).all()

        cancel_list = CancellationList(
            list_no=generate_no("QD"),
            batch_date=batch_date,
            total_count=len(cancellations),
            customer_regret_count=sum(1 for c in cancellations if c.reason == CancellationReason.CUSTOMER_REGRET),
            doc_expired_count=sum(1 for c in cancellations if c.reason == CancellationReason.DOC_EXPIRED),
            risk_rejected_count=sum(1 for c in cancellations if c.reason == CancellationReason.RISK_REJECTED),
            operator=operator
        )
        db.add(cancel_list)
        db.flush()

        for cancellation in cancellations:
            application = db.query(LoanApplication).get(cancellation.application_id)
            customer = application.customer

            special_warnings = SpecialCaseDetector.detect(db, application)
            warnings_text = " | ".join(special_warnings) if special_warnings else None

            item = CancellationListItem(
                list_id=cancel_list.id,
                application_id=application.id,
                cancellation_id=cancellation.id,
                customer_name=customer.name,
                id_card=customer.id_card,
                application_no=application.application_no,
                loan_amount=application.loan_amount,
                cancellation_reason=cancellation.reason,
                review_status=application.review_status,
                warnings=warnings_text
            )
            db.add(item)

        cancel_list.exported_at = datetime.now()
        db.commit()
        db.refresh(cancel_list)

        return cancel_list

    @staticmethod
    def get_list_data(db: Session, list_id: int) -> List[Dict]:
        items = db.query(CancellationListItem).filter(
            CancellationListItem.list_id == list_id
        ).all()

        return [
            {
                "customer_name": item.customer_name,
                "id_card": item.id_card,
                "application_no": item.application_no,
                "loan_amount": item.loan_amount,
                "cancellation_reason": item.cancellation_reason,
                "review_status": item.review_status,
                "warnings": item.warnings
            }
            for item in items
        ]