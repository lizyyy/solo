from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models
import schemas
import re


class StateValidationError(ValueError):
    pass


def validate_review_result(review_result: str) -> None:
    review_result_lower = review_result.lower()
    if review_result_lower not in schemas.VALID_REVIEW_RESULTS:
        raise StateValidationError(
            f"无效的审核结果: {review_result}. 有效值为: {', '.join(schemas.VALID_REVIEW_RESULTS)}"
        )


def validate_conclusion(conclusion: str) -> None:
    conclusion_lower = conclusion.lower()
    if conclusion_lower not in schemas.VALID_CONCLUSIONS:
        raise StateValidationError(
            f"无效的结论: {conclusion}. 有效值为: {', '.join(schemas.VALID_CONCLUSIONS)}"
        )


def validate_exemption_status(status: str) -> None:
    status_lower = status.lower()
    if status_lower not in schemas.VALID_EXEMPTION_STATUSES:
        raise StateValidationError(
            f"无效的豁免状态: {status}. 有效值为: {', '.join(schemas.VALID_EXEMPTION_STATUSES)}"
        )


class BrowserMatrixService:
    @staticmethod
    def validate_browser_version(browser: str, version: str, matrix: Dict[str, str]) -> bool:
        if browser not in matrix:
            return True
        
        requirement = matrix[browser]
        return BrowserMatrixService._check_version_match(version, requirement)
    
    @staticmethod
    def _check_version_match(version: str, requirement: str) -> bool:
        version_num = BrowserMatrixService._parse_version(version)
        
        if requirement.startswith("<="):
            req_num = BrowserMatrixService._parse_version(requirement[2:])
            return version_num <= req_num
        elif requirement.startswith("<"):
            req_num = BrowserMatrixService._parse_version(requirement[1:])
            return version_num < req_num
        elif requirement.startswith(">="):
            req_num = BrowserMatrixService._parse_version(requirement[2:])
            return version_num >= req_num
        elif requirement.startswith(">"):
            req_num = BrowserMatrixService._parse_version(requirement[1:])
            return version_num > req_num
        else:
            req_num = BrowserMatrixService._parse_version(requirement)
            return version_num == req_num
    
    @staticmethod
    def _parse_version(version: str) -> tuple:
        parts = re.findall(r'\d+', version)
        return tuple(map(int, parts)) if parts else (0,)


class ExemptionService:
    @staticmethod
    def create_exemption(db: Session, exemption_data: schemas.ExemptionCreate) -> models.Exemption:
        expire_at = datetime.now() + timedelta(days=exemption_data.expire_days)
        
        db_exemption = models.Exemption(
            failure_id=exemption_data.failure_id,
            exemption_reason=exemption_data.exemption_reason,
            exempt_browsers=exemption_data.exempt_browsers,
            expire_at=expire_at,
            applicant=exemption_data.applicant,
            status="pending"
        )
        
        db.add(db_exemption)
        db.commit()
        db.refresh(db_exemption)
        return db_exemption
    
    @staticmethod
    def check_exemption_conflict(db: Session, failure_id: int) -> bool:
        active_exemption = db.query(models.Exemption).filter(
            and_(
                models.Exemption.failure_id == failure_id,
                models.Exemption.status == "approved",
                models.Exemption.expire_at > datetime.now()
            )
        ).first()
        return active_exemption is not None
    
    @staticmethod
    def is_exemption_expired(exemption: models.Exemption) -> bool:
        return exemption.expire_at < datetime.now()
    
    @staticmethod
    def get_active_exemption(db: Session, failure_id: int) -> Optional[models.Exemption]:
        return db.query(models.Exemption).filter(
            and_(
                models.Exemption.failure_id == failure_id,
                models.Exemption.status == "approved",
                models.Exemption.expire_at > datetime.now()
            )
        ).first()
    
    @staticmethod
    def get_exemption_status(db: Session, failure_id: int) -> str:
        active_exemption = ExemptionService.get_active_exemption(db, failure_id)
        if active_exemption:
            return "active"
        
        expired_exemption = db.query(models.Exemption).filter(
            and_(
                models.Exemption.failure_id == failure_id,
                models.Exemption.status == "approved",
                models.Exemption.expire_at <= datetime.now()
            )
        ).first()
        if expired_exemption:
            return "expired"
        
        pending_exemption = db.query(models.Exemption).filter(
            and_(
                models.Exemption.failure_id == failure_id,
                models.Exemption.status == "pending"
            )
        ).first()
        if pending_exemption:
            return "pending"
        
        return "none"


class ReviewService:
    @staticmethod
    def review_exemption(
        db: Session, 
        exemption_id: int, 
        review_data: schemas.ExemptionReview
    ) -> Optional[models.Exemption]:
        exemption = db.query(models.Exemption).filter(models.Exemption.id == exemption_id).first()
        if not exemption:
            return None
        
        if exemption.status != "pending":
            raise ValueError("豁免申请已处理，无法重复审核")
        
        validate_review_result(review_data.review_result)
        
        review_result_lower = review_data.review_result.lower()
        exemption.status = review_result_lower
        exemption.review_result = review_result_lower
        exemption.review_comment = review_data.review_comment
        exemption.reviewer = review_data.reviewer
        exemption.reviewed_at = datetime.now()
        
        if review_result_lower == "approved":
            failure_case = db.query(models.FailureCase).filter(
                models.FailureCase.id == exemption.failure_id
            ).first()
            if failure_case:
                failure_case.conclusion = "exempted"
        
        db.commit()
        db.refresh(exemption)
        return exemption
    
    @staticmethod
    def withdraw_exemption(
        db: Session, 
        exemption_id: int, 
        operator: str
    ) -> Optional[models.Exemption]:
        exemption = db.query(models.Exemption).filter(models.Exemption.id == exemption_id).first()
        if not exemption:
            return None
        
        if exemption.status == "withdrawn":
            raise ValueError("豁免已撤回，无法重复操作")
        
        exemption.status = "withdrawn"
        
        failure_case = db.query(models.FailureCase).filter(
            models.FailureCase.id == exemption.failure_id
        ).first()
        if failure_case and failure_case.conclusion == "exempted":
            failure_case.conclusion = "pending"
        
        db.commit()
        db.refresh(exemption)
        return exemption


class FailureCaseService:
    @staticmethod
    def create_failure_case(db: Session, failure_data: schemas.FailureCaseCreate) -> models.FailureCase:
        db_failure = models.FailureCase(
            page_path=failure_data.page_path,
            browser_matrix=failure_data.browser_matrix,
            failure_cases=failure_data.failure_cases,
            reporter=failure_data.reporter,
            conclusion="pending"
        )
        db.add(db_failure)
        db.commit()
        db.refresh(db_failure)
        return db_failure
    
    @staticmethod
    def get_failure_case(db: Session, failure_id: int) -> Optional[models.FailureCase]:
        return db.query(models.FailureCase).filter(models.FailureCase.id == failure_id).first()
    
    @staticmethod
    def list_failure_cases(
        db: Session, 
        page_path: Optional[str] = None,
        conclusion: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[models.FailureCase]:
        query = db.query(models.FailureCase)
        
        if page_path:
            query = query.filter(models.FailureCase.page_path.contains(page_path))
        if conclusion:
            query = query.filter(models.FailureCase.conclusion == conclusion)
        
        return query.offset(skip).limit(limit).all()
    
    @staticmethod
    def update_conclusion(
        db: Session, 
        failure_id: int, 
        conclusion_data: schemas.ConclusionUpdate
    ) -> Optional[models.FailureCase]:
        failure_case = db.query(models.FailureCase).filter(models.FailureCase.id == failure_id).first()
        if not failure_case:
            return None
        
        validate_conclusion(conclusion_data.conclusion)
        
        conclusion_lower = conclusion_data.conclusion.lower()
        failure_case.conclusion = conclusion_lower
        failure_case.conclusion_note = conclusion_data.conclusion_note
        
        db.commit()
        db.refresh(failure_case)
        return failure_case


class AuditService:
    @staticmethod
    def create_audit_log(
        db: Session,
        operation_type: str,
        resource_type: str,
        resource_id: int,
        operator: str,
        original_input: Optional[Dict[str, Any]] = None,
        process_result: Optional[Dict[str, Any]] = None
    ) -> models.AuditLog:
        db_audit = models.AuditLog(
            operation_type=operation_type,
            resource_type=resource_type,
            resource_id=resource_id,
            operator=operator,
            original_input=original_input,
            process_result=process_result
        )
        db.add(db_audit)
        db.commit()
        db.refresh(db_audit)
        return db_audit
    
    @staticmethod
    def list_audit_logs(
        db: Session,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        operator: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[models.AuditLog]:
        query = db.query(models.AuditLog)
        
        if resource_type:
            query = query.filter(models.AuditLog.resource_type == resource_type)
        if resource_id is not None:
            query = query.filter(models.AuditLog.resource_id == resource_id)
        if operator:
            query = query.filter(models.AuditLog.operator == operator)
        
        return query.order_by(models.AuditLog.created_at.desc()).offset(skip).limit(limit).all()
