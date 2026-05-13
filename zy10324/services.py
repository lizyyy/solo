from sqlalchemy.orm import Session
from models import (
    DetectionTask, DetectionStatus, DetectionHistory, ApiInventory,
    CloseRecord, RiskLevel, InspectionReport, Environment, AuthType
)
from schemas import (
    ApiInventoryCreate, DetectionTaskCreate, CloseRecordCreate,
    generate_task_id
)
from datetime import datetime
from typing import List, Optional
import json


class TaskStateMachine:
    STATE_TRANSITIONS = {
        DetectionStatus.CREATED: [DetectionStatus.SCANNING, DetectionStatus.CANCELLED],
        DetectionStatus.SCANNING: [DetectionStatus.SCANNED, DetectionStatus.FAILED],
        DetectionStatus.SCANNED: [DetectionStatus.AUTH_CHECKING, DetectionStatus.CANCELLED],
        DetectionStatus.AUTH_CHECKING: [DetectionStatus.AUTH_CHECKED, DetectionStatus.FAILED],
        DetectionStatus.AUTH_CHECKED: [DetectionStatus.RISK_ASSESSING, DetectionStatus.CANCELLED],
        DetectionStatus.RISK_ASSESSING: [DetectionStatus.RISK_ASSESSED, DetectionStatus.FAILED],
        DetectionStatus.RISK_ASSESSED: [DetectionStatus.CONFIRMING_CLOSE, DetectionStatus.CANCELLED],
        DetectionStatus.CONFIRMING_CLOSE: [DetectionStatus.CLOSED, DetectionStatus.FAILED],
        DetectionStatus.CLOSED: [],
        DetectionStatus.CANCELLED: [],
        DetectionStatus.FAILED: []
    }

    @classmethod
    def can_transition(cls, from_status: DetectionStatus, to_status: DetectionStatus) -> bool:
        return to_status in cls.STATE_TRANSITIONS.get(from_status, [])

    @classmethod
    def get_next_states(cls, current_status: DetectionStatus) -> List[DetectionStatus]:
        return cls.STATE_TRANSITIONS.get(current_status, [])


class ApiInventoryService:
    @staticmethod
    def create_api_inventory(db: Session, api_data: ApiInventoryCreate) -> ApiInventory:
        db_api = ApiInventory(**api_data.model_dump())
        db.add(db_api)
        db.commit()
        db.refresh(db_api)
        return db_api

    @staticmethod
    def get_api_inventory(db: Session, api_id: int) -> Optional[ApiInventory]:
        return db.query(ApiInventory).filter(ApiInventory.id == api_id).first()

    @staticmethod
    def list_api_inventory(db: Session, skip: int = 0, limit: int = 100) -> List[ApiInventory]:
        return db.query(ApiInventory).offset(skip).limit(limit).all()

    @staticmethod
    def get_or_create_api(db: Session, api_path: str, method: str, environment: Environment,
                          service_name: str = None, description: str = None) -> ApiInventory:
        existing = db.query(ApiInventory).filter(
            ApiInventory.api_path == api_path,
            ApiInventory.method == method,
            ApiInventory.environment == environment
        ).first()
        if existing:
            return existing
        new_api = ApiInventory(
            api_path=api_path, method=method, environment=environment,
            service_name=service_name, description=description
        )
        db.add(new_api)
        db.commit()
        db.refresh(new_api)
        return new_api


class DetectionTaskService:
    @staticmethod
    def create_detection_task(db: Session, task_data: DetectionTaskCreate) -> DetectionTask:
        existing_task = db.query(DetectionTask).filter(
            DetectionTask.api_inventory_id == task_data.api_inventory_id,
            DetectionTask.status.in_([
                DetectionStatus.CREATED, DetectionStatus.SCANNING,
                DetectionStatus.SCANNED, DetectionStatus.AUTH_CHECKING,
                DetectionStatus.AUTH_CHECKED, DetectionStatus.RISK_ASSESSING,
                DetectionStatus.RISK_ASSESSED, DetectionStatus.CONFIRMING_CLOSE
            ])
        ).first()
        if existing_task:
            return existing_task

        task_id = generate_task_id()
        db_task = DetectionTask(
            task_id=task_id,
            api_inventory_id=task_data.api_inventory_id,
            current_handler=task_data.handler,
            status=DetectionStatus.CREATED
        )
        db.add(db_task)
        db.flush()

        history = DetectionHistory(
            task_id=db_task.id,
            from_status=None,
            to_status=DetectionStatus.CREATED,
            handler=task_data.handler,
            remark="任务创建"
        )
        db.add(history)
        db.commit()
        db.refresh(db_task)
        return db_task

    @staticmethod
    def get_task_by_id(db: Session, task_id: str) -> Optional[DetectionTask]:
        return db.query(DetectionTask).filter(DetectionTask.task_id == task_id).first()

    @staticmethod
    def list_tasks(db: Session, skip: int = 0, limit: int = 100, status: Optional[DetectionStatus] = None) -> List[DetectionTask]:
        query = db.query(DetectionTask)
        if status:
            query = query.filter(DetectionTask.status == status)
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def transition_status(db: Session, task_id: str, to_status: DetectionStatus,
                          handler: Optional[str] = None, remark: Optional[str] = None) -> DetectionTask:
        task = DetectionTaskService.get_task_by_id(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        if not TaskStateMachine.can_transition(task.status, to_status):
            raise ValueError(
                f"Cannot transition from {task.status.value} to {to_status.value}. "
                f"Valid transitions: {[s.value for s in TaskStateMachine.get_next_states(task.status)]}"
            )

        from_status = task.status
        task.status = to_status

        history = DetectionHistory(
            task_id=task.id,
            from_status=from_status,
            to_status=to_status,
            handler=handler or task.current_handler,
            remark=remark
        )
        db.add(history)

        if to_status in [DetectionStatus.CLOSED, DetectionStatus.CANCELLED, DetectionStatus.FAILED]:
            task.completed_at = datetime.now()

        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get_task_history(db: Session, task_id: str) -> List[DetectionHistory]:
        task = DetectionTaskService.get_task_by_id(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        return db.query(DetectionHistory).filter(DetectionHistory.task_id == task.id).order_by(DetectionHistory.created_at).all()

    @staticmethod
    def update_scan_result(db: Session, task_id: str, scan_result: str,
                           handler: Optional[str] = None) -> DetectionTask:
        task = DetectionTaskService.get_task_by_id(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        if task.status != DetectionStatus.SCANNING:
            raise ValueError(f"Task must be in SCANNING state, current: {task.status.value}")

        task.scan_result = scan_result
        return DetectionTaskService.transition_status(
            db, task_id, DetectionStatus.SCANNED,
            handler=handler, remark="路由扫描完成"
        )

    @staticmethod
    def update_auth_check(db: Session, task_id: str, auth_type: AuthType,
                         auth_configured: bool, auth_check_result: str,
                         handler: Optional[str] = None) -> DetectionTask:
        task = DetectionTaskService.get_task_by_id(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        if task.status != DetectionStatus.AUTH_CHECKING:
            raise ValueError(f"Task must be in AUTH_CHECKING state, current: {task.status.value}")

        task.auth_type = auth_type
        task.auth_configured = auth_configured
        task.auth_check_result = auth_check_result
        return DetectionTaskService.transition_status(
            db, task_id, DetectionStatus.AUTH_CHECKED,
            handler=handler, remark="认证检查完成"
        )

    @staticmethod
    def update_risk_assessment(db: Session, task_id: str, risk_level: RiskLevel,
                                risk_tags: List[str], risk_assessment_result: str,
                                handler: Optional[str] = None) -> DetectionTask:
        task = DetectionTaskService.get_task_by_id(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        if task.status != DetectionStatus.RISK_ASSESSING:
            raise ValueError(f"Task must be in RISK_ASSESSING state, current: {task.status.value}")

        task.risk_level = risk_level
        task.risk_tags = json.dumps(risk_tags)
        task.risk_assessment_result = risk_assessment_result
        return DetectionTaskService.transition_status(
            db, task_id, DetectionStatus.RISK_ASSESSED,
            handler=handler, remark="风险评估完成"
        )

    @staticmethod
    def confirm_close(db: Session, task_id: str, close_data: CloseRecordCreate,
                       close_confirmation_result: str) -> DetectionTask:
        task = DetectionTaskService.get_task_by_id(db, task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        if task.status != DetectionStatus.CONFIRMING_CLOSE:
            raise ValueError(f"Task must be in CONFIRMING_CLOSE state, current: {task.status.value}")

        task.close_confirmation_result = close_confirmation_result

        close_record = CloseRecord(
            task_id=task.id,
            closed_by=close_data.closed_by,
            close_evidence=close_data.close_evidence,
            conclusion=close_data.conclusion
        )
        db.add(close_record)

        return DetectionTaskService.transition_status(
            db, task_id, DetectionStatus.CLOSED,
            handler=close_data.closed_by, remark="关闭确认完成"
        )


class InspectionReportService:
    @staticmethod
    def generate_report(db: Session) -> InspectionReport:
        from sqlalchemy import func
        import uuid

        total_apis = db.query(func.count(ApiInventory.id)).scalar()

        status_counts = db.query(
            DetectionTask.risk_level,
            func.count(DetectionTask.id)
        ).filter(
            DetectionTask.risk_level.isnot(None)
        ).group_by(DetectionTask.risk_level).all()

        risk_counts = {level: 0 for level in RiskLevel}
        for level, count in status_counts:
            risk_counts[level] = count

        closed_count = db.query(func.count(DetectionTask.id)).filter(
            DetectionTask.status == DetectionStatus.CLOSED
        ).scalar()

        report_content = {
            "summary": f"共检测API总数: {total_apis}",
            "risk_distribution": {
                "critical": risk_counts.get(RiskLevel.CRITICAL, 0),
                "high": risk_counts.get(RiskLevel.HIGH, 0),
                "medium": risk_counts.get(RiskLevel.MEDIUM, 0),
                "low": risk_counts.get(RiskLevel.LOW, 0)
            },
            "closed_count": closed_count
        }

        report = InspectionReport(
            report_id=f"report_{uuid.uuid4().hex[:12]}",
            start_time=datetime.now(),
            end_time=datetime.now(),
            total_apis=total_apis,
            high_risk_count=risk_counts.get(RiskLevel.HIGH, 0) + risk_counts.get(RiskLevel.CRITICAL, 0),
            medium_risk_count=risk_counts.get(RiskLevel.MEDIUM, 0),
            low_risk_count=risk_counts.get(RiskLevel.LOW, 0),
            closed_count=closed_count,
            report_content=json.dumps(report_content, ensure_ascii=False)
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_report(db: Session, report_id: str) -> Optional[InspectionReport]:
        return db.query(InspectionReport).filter(InspectionReport.report_id == report_id).first()

    @staticmethod
    def list_reports(db: Session, skip: int = 0, limit: int = 10) -> List[InspectionReport]:
        return db.query(InspectionReport).order_by(InspectionReport.created_at.desc()).offset(skip).limit(limit).all()
