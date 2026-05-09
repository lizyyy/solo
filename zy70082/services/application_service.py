from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from models import (
    Application, ApplicationMaterial, ApplicationStatusHistory,
    ApplicationStatus, MaterialStatus, CorrectionTaskStatus,
    AcceptNumberCounter, RejectReason, CorrectionTask
)
from schemas import (
    ApplicationCreate, ApplicationUpdate, ApplicationMaterialCreate,
    ApplicationSummary, ApplicationStatusHistoryResponse
)


class ApplicationService:
    @staticmethod
    def generate_application_no(db: Session, prefix: str = "YW") -> str:
        today = datetime.now().strftime("%Y%m%d")
        full_prefix = f"{prefix}{today}"
        
        counter = db.query(AcceptNumberCounter).filter(
            AcceptNumberCounter.prefix == full_prefix
        ).first()
        
        if not counter:
            counter = AcceptNumberCounter(prefix=full_prefix, counter=0)
            db.add(counter)
            db.commit()
            db.refresh(counter)
        
        counter.counter += 1
        db.commit()
        db.refresh(counter)
        
        return f"{full_prefix}{counter.counter:06d}"

    @staticmethod
    def create_application(db: Session, app_data: ApplicationCreate) -> Application:
        application = Application(
            applicant_name=app_data.applicant_name,
            applicant_id=app_data.applicant_id,
            business_type=app_data.business_type,
            status=ApplicationStatus.DRAFT,
            current_step="材料上传"
        )
        db.add(application)
        db.flush()

        for mat_data in app_data.materials:
            app_mat = ApplicationMaterial(
                application_id=application.id,
                material_id=mat_data.material_id,
                material_name=mat_data.material_name,
                file_name=mat_data.file_name,
                file_size=mat_data.file_size,
                status=MaterialStatus.UPLOADED
            )
            db.add(app_mat)

        db.commit()
        db.refresh(application)
        return application

    @staticmethod
    def get_applications(
        db: Session,
        status: Optional[ApplicationStatus] = None,
        applicant_name: Optional[str] = None,
        business_type: Optional[str] = None
    ) -> List[Application]:
        query = db.query(Application)
        if status:
            query = query.filter(Application.status == status)
        if applicant_name:
            query = query.filter(Application.applicant_name.like(f"%{applicant_name}%"))
        if business_type:
            query = query.filter(Application.business_type == business_type)
        return query.order_by(Application.id.desc()).all()

    @staticmethod
    def get_application_by_id(db: Session, app_id: int) -> Optional[Application]:
        return db.query(Application).filter(Application.id == app_id).first()

    @staticmethod
    def get_application_by_no(db: Session, app_no: str) -> Optional[Application]:
        return db.query(Application).filter(Application.application_no == app_no).first()

    @staticmethod
    def update_application(db: Session, app_id: int, update_data: ApplicationUpdate) -> Optional[Application]:
        app = ApplicationService.get_application_by_id(db, app_id)
        if not app:
            return None
        for key, value in update_data.model_dump(exclude_unset=True).items():
            setattr(app, key, value)
        db.commit()
        db.refresh(app)
        return app

    @staticmethod
    def add_status_history(
        db: Session,
        application_id: int,
        from_status: Optional[str],
        to_status: str,
        reason: Optional[str] = None,
        operator: Optional[str] = None
    ) -> ApplicationStatusHistory:
        history = ApplicationStatusHistory(
            application_id=application_id,
            from_status=from_status,
            to_status=to_status,
            reason=reason,
            operator=operator
        )
        db.add(history)
        db.commit()
        db.refresh(history)
        return history

    @staticmethod
    def submit_application(db: Session, app_id: int) -> Optional[Application]:
        app = ApplicationService.get_application_by_id(db, app_id)
        if not app or app.status != ApplicationStatus.DRAFT:
            return None

        app.application_no = ApplicationService.generate_application_no(db)
        old_status = app.status.value
        app.status = ApplicationStatus.SUBMITTED
        app.current_step = "提交预审"
        app.submit_time = datetime.utcnow()

        ApplicationService.add_status_history(
            db, app.id, old_status, app.status.value,
            reason="申请人提交申请",
            operator="系统"
        )

        db.commit()
        db.refresh(app)
        return app

    @staticmethod
    def start_review(db: Session, app_id: int, reviewer: Optional[str] = None) -> Optional[Application]:
        app = ApplicationService.get_application_by_id(db, app_id)
        if not app or app.status not in [ApplicationStatus.SUBMITTED, ApplicationStatus.CORRECTED]:
            return None

        old_status = app.status.value
        app.status = ApplicationStatus.UNDER_REVIEW
        app.current_step = "材料预审"

        ApplicationService.add_status_history(
            db, app.id, old_status, app.status.value,
            reason="开始预审",
            operator=reviewer or "系统"
        )

        db.commit()
        db.refresh(app)
        return app

    @staticmethod
    def reject_application(
        db: Session,
        app_id: int,
        reject_reason: str,
        operator: Optional[str] = None
    ) -> Optional[Application]:
        app = ApplicationService.get_application_by_id(db, app_id)
        if not app:
            return None

        old_status = app.status.value
        app.status = ApplicationStatus.REJECTED
        app.reject_reason = reject_reason
        app.current_step = "申请退回"

        ApplicationService.add_status_history(
            db, app.id, old_status, app.status.value,
            reason=reject_reason,
            operator=operator or "系统"
        )

        db.commit()
        db.refresh(app)
        return app

    @staticmethod
    def accept_application(
        db: Session,
        app_id: int,
        operator: Optional[str] = None
    ) -> Optional[Application]:
        app = ApplicationService.get_application_by_id(db, app_id)
        if not app:
            return None

        old_status = app.status.value
        app.status = ApplicationStatus.ACCEPTED
        app.accept_time = datetime.utcnow()
        app.current_step = "窗口受理"

        ApplicationService.add_status_history(
            db, app.id, old_status, app.status.value,
            reason="材料预审通过，窗口受理",
            operator=operator or "系统"
        )

        db.commit()
        db.refresh(app)
        return app

    @staticmethod
    def get_status_history(db: Session, app_id: int) -> List[ApplicationStatusHistory]:
        return db.query(ApplicationStatusHistory).filter(
            ApplicationStatusHistory.application_id == app_id
        ).order_by(ApplicationStatusHistory.id.asc()).all()

    @staticmethod
    def get_summary(db: Session) -> ApplicationSummary:
        summary = ApplicationSummary()
        summary.total = db.query(Application).count()
        summary.draft = db.query(Application).filter(Application.status == ApplicationStatus.DRAFT).count()
        summary.submitted = db.query(Application).filter(Application.status == ApplicationStatus.SUBMITTED).count()
        summary.under_review = db.query(Application).filter(Application.status == ApplicationStatus.UNDER_REVIEW).count()
        summary.needs_correction = db.query(Application).filter(Application.status == ApplicationStatus.NEEDS_CORRECTION).count()
        summary.corrected = db.query(Application).filter(Application.status == ApplicationStatus.CORRECTED).count()
        summary.rejected = db.query(Application).filter(Application.status == ApplicationStatus.REJECTED).count()
        summary.accepted = db.query(Application).filter(Application.status == ApplicationStatus.ACCEPTED).count()
        summary.completed = db.query(Application).filter(Application.status == ApplicationStatus.COMPLETED).count()
        return summary


class ApplicationMaterialService:
    @staticmethod
    def get_application_material(db: Session, mat_id: int) -> Optional[ApplicationMaterial]:
        return db.query(ApplicationMaterial).filter(ApplicationMaterial.id == mat_id).first()

    @staticmethod
    def review_material(
        db: Session,
        mat_id: int,
        status: MaterialStatus,
        review_result: Optional[str] = None,
        reviewer: Optional[str] = None
    ) -> Optional[ApplicationMaterial]:
        mat = ApplicationMaterialService.get_application_material(db, mat_id)
        if not mat:
            return None

        mat.status = status
        mat.review_result = review_result
        mat.review_time = datetime.utcnow()
        mat.reviewer = reviewer

        db.commit()
        db.refresh(mat)
        return mat

    @staticmethod
    def mark_for_correction(
        db: Session,
        mat_id: int,
        review_result: str,
        reviewer: Optional[str] = None
    ) -> Optional[ApplicationMaterial]:
        return ApplicationMaterialService.review_material(
            db, mat_id, MaterialStatus.NEEDS_CORRECTION, review_result, reviewer
        )

    @staticmethod
    def update_after_correction(db: Session, mat_id: int) -> Optional[ApplicationMaterial]:
        mat = ApplicationMaterialService.get_application_material(db, mat_id)
        if not mat:
            return None
        mat.status = MaterialStatus.CORRECTED
        db.commit()
        db.refresh(mat)
        return mat


class CorrectionTaskService:
    @staticmethod
    def create_task(
        db: Session,
        application_id: int,
        application_material_id: int,
        task_name: str,
        correction_content: str,
        assignee: Optional[str] = None,
        due_date: Optional[datetime] = None
    ) -> CorrectionTask:
        task = CorrectionTask(
            application_id=application_id,
            application_material_id=application_material_id,
            task_name=task_name,
            correction_content=correction_content,
            assignee=assignee,
            due_date=due_date,
            status=CorrectionTaskStatus.PENDING
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get_tasks(
        db: Session,
        application_id: Optional[int] = None,
        status: Optional[CorrectionTaskStatus] = None,
        assignee: Optional[str] = None
    ) -> List[CorrectionTask]:
        query = db.query(CorrectionTask)
        if application_id:
            query = query.filter(CorrectionTask.application_id == application_id)
        if status:
            query = query.filter(CorrectionTask.status == status)
        if assignee:
            query = query.filter(CorrectionTask.assignee == assignee)
        return query.order_by(CorrectionTask.id.desc()).all()

    @staticmethod
    def get_task_by_id(db: Session, task_id: int) -> Optional[CorrectionTask]:
        return db.query(CorrectionTask).filter(CorrectionTask.id == task_id).first()

    @staticmethod
    def start_task(db: Session, task_id: int) -> Optional[CorrectionTask]:
        task = CorrectionTaskService.get_task_by_id(db, task_id)
        if not task or task.status != CorrectionTaskStatus.PENDING:
            return None
        task.status = CorrectionTaskStatus.IN_PROGRESS
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def complete_task(db: Session, task_id: int) -> Optional[CorrectionTask]:
        task = CorrectionTaskService.get_task_by_id(db, task_id)
        if not task or task.status not in [CorrectionTaskStatus.IN_PROGRESS, CorrectionTaskStatus.FAILED]:
            return None
        task.status = CorrectionTaskStatus.COMPLETED
        task.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def fail_task(db: Session, task_id: int, error_message: str) -> Optional[CorrectionTask]:
        task = CorrectionTaskService.get_task_by_id(db, task_id)
        if not task:
            return None
        task.status = CorrectionTaskStatus.FAILED
        task.last_error = error_message
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def retry_task(db: Session, task_id: int, operator: Optional[str] = None) -> Optional[CorrectionTask]:
        task = CorrectionTaskService.get_task_by_id(db, task_id)
        if not task or task.status != CorrectionTaskStatus.FAILED:
            return None
        task.status = CorrectionTaskStatus.IN_PROGRESS
        task.retry_count += 1
        task.last_error = None
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get_summary(db: Session):
        from schemas import CorrectionTaskSummary
        total = db.query(CorrectionTask).count()
        pending = db.query(CorrectionTask).filter(CorrectionTask.status == CorrectionTaskStatus.PENDING).count()
        in_progress = db.query(CorrectionTask).filter(CorrectionTask.status == CorrectionTaskStatus.IN_PROGRESS).count()
        completed = db.query(CorrectionTask).filter(CorrectionTask.status == CorrectionTaskStatus.COMPLETED).count()
        failed = db.query(CorrectionTask).filter(CorrectionTask.status == CorrectionTaskStatus.FAILED).count()
        return CorrectionTaskSummary(
            total=total,
            pending=pending,
            in_progress=in_progress,
            completed=completed,
            failed=failed
        )


class RejectReasonService:
    @staticmethod
    def get_reasons(db: Session, is_active: Optional[int] = 1) -> List[RejectReason]:
        query = db.query(RejectReason)
        if is_active is not None:
            query = query.filter(RejectReason.is_active == is_active)
        return query.order_by(RejectReason.id.asc()).all()

    @staticmethod
    def create_reason(db: Session, code: str, name: str, description: Optional[str] = None, category: Optional[str] = None) -> RejectReason:
        reason = RejectReason(code=code, name=name, description=description, category=category)
        db.add(reason)
        db.commit()
        db.refresh(reason)
        return reason
