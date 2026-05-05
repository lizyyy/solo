from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from app.database import Application, AuditLog, IdempotentKey, User
from app.config import (
    ApplicationStatus, UserRole, STATUS_TRANSITIONS, TERMINAL_STATUSES
)
from app.exceptions import (
    ApplicationNotFoundException, InvalidStatusTransitionException,
    TerminalStatusException, PermissionDeniedException,
    VersionConflictException, IdempotentKeyConflictException,
    MissingEthicsApprovalException, DeidentificationNotPassedException
)
from app.schemas import (
    ApplicationCreate, ApplicationUpdate,
    SubmitForEthicsReviewRequest, EthicsReviewRequest,
    DeidentificationReviewRequest, MakeAvailableRequest,
    RevokeRequest, ExpireRequest
)


class ApplicationService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, application_id: int) -> Application:
        app = self.db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise ApplicationNotFoundException(application_id)
        return app

    def get_all(self, skip: int = 0, limit: int = 100, status: Optional[ApplicationStatus] = None) -> List[Application]:
        query = self.db.query(Application)
        if status:
            query = query.filter(Application.status == status)
        return query.order_by(Application.created_at.desc()).offset(skip).limit(limit).all()

    def create(self, data: ApplicationCreate) -> Application:
        app = Application(
            applicant_id=data.applicant_id,
            applicant_name=data.applicant_name,
            department=data.department,
            project_name=data.project_name,
            project_description=data.project_description,
            dataset_id=data.dataset_id,
            dataset_name=data.dataset_name,
            status=ApplicationStatus.DRAFT,
            version=1
        )
        self.db.add(app)
        self.db.flush()
        
        self._create_audit_log(
            application_id=app.id,
            operator_id=data.applicant_id,
            operator_name=data.applicant_name,
            operator_role=UserRole.RESEARCHER,
            action="CREATE_APPLICATION",
            from_status=None,
            to_status=ApplicationStatus.DRAFT,
            reason="创建数据访问申请",
            idempotent_key=None,
            version=1
        )
        
        self.db.commit()
        self.db.refresh(app)
        return app

    def update(self, application_id: int, data: ApplicationUpdate, operator_id: int) -> Application:
        app = self.get_by_id(application_id)
        
        if app.status in TERMINAL_STATUSES:
            raise TerminalStatusException(app.status.value)
        
        if app.status != ApplicationStatus.DRAFT:
            raise InvalidStatusTransitionException(
                app.status.value, 
                "更新操作仅允许在草稿状态"
            )
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(app, key, value)
        
        app.version += 1
        self.db.commit()
        self.db.refresh(app)
        return app

    def _check_idempotent_key(
        self, 
        application_id: int, 
        idempotent_key: str, 
        action: str,
        operator_id: int
    ) -> Optional[IdempotentKey]:
        existing = self.db.query(IdempotentKey).filter(
            IdempotentKey.idempotent_key == idempotent_key
        ).first()
        
        if existing:
            if existing.application_id != application_id:
                raise IdempotentKeyConflictException(
                    idempotent_key, 
                    f"此键已被用于申请 {existing.application_id}"
                )
            if existing.action != action:
                raise IdempotentKeyConflictException(
                    idempotent_key,
                    f"此键已被用于操作 {existing.action}"
                )
            if existing.processed == 1:
                return existing
        
        if not existing:
            key_record = IdempotentKey(
                application_id=application_id,
                idempotent_key=idempotent_key,
                action=action,
                operator_id=operator_id,
                processed=0
            )
            try:
                self.db.add(key_record)
                self.db.flush()
            except IntegrityError:
                self.db.rollback()
                existing = self.db.query(IdempotentKey).filter(
                    IdempotentKey.idempotent_key == idempotent_key
                ).first()
                if existing and existing.processed == 1:
                    return existing
                raise IdempotentKeyConflictException(
                    idempotent_key,
                    "幂等键冲突，请重试"
                )
        
        return None

    def _mark_idempotent_processed(
        self, 
        idempotent_key: str, 
        result_status: ApplicationStatus
    ):
        key_record = self.db.query(IdempotentKey).filter(
            IdempotentKey.idempotent_key == idempotent_key
        ).first()
        if key_record:
            key_record.processed = 1
            key_record.result_status = result_status
            key_record.processed_at = datetime.utcnow()
            self.db.flush()

    def _check_status_transition(
        self, 
        app: Application, 
        target_status: ApplicationStatus,
        operator_role: UserRole
    ):
        if app.status in TERMINAL_STATUSES:
            raise TerminalStatusException(app.status.value)
        
        transition_info = STATUS_TRANSITIONS.get(app.status, {})
        allowed_next = transition_info.get("allowed_next", [])
        
        if target_status not in allowed_next:
            raise InvalidStatusTransitionException(
                app.status.value, 
                target_status.value
            )
        
        required_roles = transition_info.get("required_roles", {}).get(target_status, [])
        if operator_role not in required_roles:
            raise PermissionDeniedException(operator_role.value, [r.value for r in required_roles])

    def _check_version(self, app: Application, expected_version: int):
        if app.version != expected_version:
            raise VersionConflictException(expected_version, app.version)

    def _create_audit_log(
        self,
        application_id: int,
        operator_id: int,
        operator_name: str,
        operator_role: UserRole,
        action: str,
        from_status: Optional[ApplicationStatus],
        to_status: Optional[ApplicationStatus],
        reason: Optional[str],
        idempotent_key: Optional[str],
        version: int
    ):
        log = AuditLog(
            application_id=application_id,
            operator_id=operator_id,
            operator_name=operator_name,
            operator_role=operator_role,
            action=action,
            from_status=from_status,
            to_status=to_status,
            reason=reason,
            idempotent_key=idempotent_key,
            version=version
        )
        self.db.add(log)

    def _transition_status(
        self,
        app: Application,
        target_status: ApplicationStatus,
        request,
        action: str,
        reason: Optional[str] = None
    ):
        idempotent_result = self._check_idempotent_key(
            app.id,
            request.idempotent_key,
            action,
            request.operator_id
        )
        
        if idempotent_result:
            return app
        
        self._check_status_transition(app, target_status, request.operator_role)
        self._check_version(app, request.current_version)
        
        from_status = app.status
        app.status = target_status
        app.version += 1
        
        self._create_audit_log(
            application_id=app.id,
            operator_id=request.operator_id,
            operator_name=request.operator_name,
            operator_role=request.operator_role,
            action=action,
            from_status=from_status,
            to_status=target_status,
            reason=reason or request.reason,
            idempotent_key=request.idempotent_key,
            version=app.version
        )
        
        self._mark_idempotent_processed(request.idempotent_key, target_status)
        self.db.commit()
        self.db.refresh(app)
        
        return app

    def submit_for_ethics_review(self, application_id: int, request: SubmitForEthicsReviewRequest) -> Application:
        app = self.get_by_id(application_id)
        
        if not app.ethics_approval_file_id:
            raise MissingEthicsApprovalException()
        
        return self._transition_status(
            app=app,
            target_status=ApplicationStatus.PENDING_ETHICS_REVIEW,
            request=request,
            action="SUBMIT_FOR_ETHICS_REVIEW",
            reason="提交伦理审核"
        )

    def ethics_review(self, application_id: int, request: EthicsReviewRequest) -> Application:
        app = self.get_by_id(application_id)
        
        idempotent_result = self._check_idempotent_key(
            app.id,
            request.idempotent_key,
            "ETHICS_REVIEW",
            request.operator_id
        )
        
        if idempotent_result:
            return app
        
        if request.approved:
            target_status = ApplicationStatus.PENDING_DEIDENTIFICATION_REVIEW
            if request.ethics_approval_file_id:
                app.ethics_approval_file_id = request.ethics_approval_file_id
            if request.ethics_approval_date:
                app.ethics_approval_date = request.ethics_approval_date
        else:
            target_status = ApplicationStatus.REJECTED
        
        self._check_status_transition(app, target_status, request.operator_role)
        self._check_version(app, request.current_version)
        
        from_status = app.status
        app.status = target_status
        app.version += 1
        app.ethics_reviewer_id = request.operator_id
        app.ethics_reviewer_name = request.operator_name
        app.ethics_comments = request.reviewer_comments
        
        self._create_audit_log(
            application_id=app.id,
            operator_id=request.operator_id,
            operator_name=request.operator_name,
            operator_role=request.operator_role,
            action="ETHICS_REVIEW_APPROVED" if request.approved else "ETHICS_REVIEW_REJECTED",
            from_status=from_status,
            to_status=target_status,
            reason=request.reviewer_comments,
            idempotent_key=request.idempotent_key,
            version=app.version
        )
        
        self._mark_idempotent_processed(request.idempotent_key, target_status)
        self.db.commit()
        self.db.refresh(app)
        
        return app

    def deidentification_review(self, application_id: int, request: DeidentificationReviewRequest) -> Application:
        app = self.get_by_id(application_id)
        
        idempotent_result = self._check_idempotent_key(
            app.id,
            request.idempotent_key,
            "DEIDENTIFICATION_REVIEW",
            request.operator_id
        )
        
        if idempotent_result:
            return app
        
        if request.passed:
            target_status = ApplicationStatus.AVAILABLE_FOR_DOWNLOAD
        else:
            target_status = ApplicationStatus.REJECTED
        
        self._check_status_transition(app, target_status, request.operator_role)
        self._check_version(app, request.current_version)
        
        if request.deidentification_report_id:
            app.deidentification_report_id = request.deidentification_report_id
        
        from_status = app.status
        app.status = target_status
        app.version += 1
        app.deidentification_passed = 1 if request.passed else 0
        app.deidentification_reviewer_id = request.operator_id
        app.deidentification_reviewer_name = request.operator_name
        app.deidentification_comments = request.reviewer_comments
        
        self._create_audit_log(
            application_id=app.id,
            operator_id=request.operator_id,
            operator_name=request.operator_name,
            operator_role=request.operator_role,
            action="DEIDENTIFICATION_PASSED" if request.passed else "DEIDENTIFICATION_FAILED",
            from_status=from_status,
            to_status=target_status,
            reason=request.reviewer_comments,
            idempotent_key=request.idempotent_key,
            version=app.version
        )
        
        self._mark_idempotent_processed(request.idempotent_key, target_status)
        self.db.commit()
        self.db.refresh(app)
        
        return app

    def make_available(self, application_id: int, request: MakeAvailableRequest) -> Application:
        app = self.get_by_id(application_id)
        
        if app.deidentification_passed != 1:
            raise DeidentificationNotPassedException()
        
        idempotent_result = self._check_idempotent_key(
            app.id,
            request.idempotent_key,
            "MAKE_AVAILABLE",
            request.operator_id
        )
        
        if idempotent_result:
            return app
        
        self._check_status_transition(app, ApplicationStatus.AVAILABLE_FOR_DOWNLOAD, request.operator_role)
        self._check_version(app, request.current_version)
        
        from_status = app.status
        app.status = ApplicationStatus.AVAILABLE_FOR_DOWNLOAD
        app.version += 1
        app.download_url = request.download_url
        app.download_expiry_date = datetime.utcnow() + timedelta(days=request.download_expiry_days)
        
        self._create_audit_log(
            application_id=app.id,
            operator_id=request.operator_id,
            operator_name=request.operator_name,
            operator_role=request.operator_role,
            action="MAKE_AVAILABLE",
            from_status=from_status,
            to_status=ApplicationStatus.AVAILABLE_FOR_DOWNLOAD,
            reason=request.reason,
            idempotent_key=request.idempotent_key,
            version=app.version
        )
        
        self._mark_idempotent_processed(request.idempotent_key, ApplicationStatus.AVAILABLE_FOR_DOWNLOAD)
        self.db.commit()
        self.db.refresh(app)
        
        return app

    def revoke(self, application_id: int, request: RevokeRequest) -> Application:
        app = self.get_by_id(application_id)
        
        return self._transition_status(
            app=app,
            target_status=ApplicationStatus.REVOKED,
            request=request,
            action="REVOKE",
            reason=request.reason
        )

    def expire(self, application_id: int, request: ExpireRequest) -> Application:
        app = self.get_by_id(application_id)
        
        return self._transition_status(
            app=app,
            target_status=ApplicationStatus.EXPIRED,
            request=request,
            action="EXPIRE",
            reason=request.reason or "下载链接已过期"
        )

    def get_audit_logs(self, application_id: int) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(
            AuditLog.application_id == application_id
        ).order_by(AuditLog.created_at.desc()).all()


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_all(self) -> List[User]:
        return self.db.query(User).all()

    def create(self, username: str, name: str, role: UserRole, department: Optional[str] = None) -> User:
        user = User(
            username=username,
            name=name,
            role=role,
            department=department
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
