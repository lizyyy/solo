from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
import json

from app.models import JourneyAsset, FailureSample, RegistrationReport, JourneyStatus
from app.schemas import JourneyAssetCreate, JourneyAssetUpdate, FailureSampleCreate, RegistrationReportCreate


class JourneyAssetError(Exception):
    def __init__(self, error_code: str, message: str, details: dict = None):
        self.error_code = error_code
        self.message = message
        self.details = details or {}
        super().__init__(message)


def validate_steps_definition(steps_definition: str):
    try:
        steps = json.loads(steps_definition)
        if not isinstance(steps, list):
            raise JourneyAssetError(
                error_code="INVALID_STEPS_FORMAT",
                message="步骤定义必须是数组格式",
                details={"format_error": "not a list"}
            )
        if len(steps) == 0:
            raise JourneyAssetError(
                error_code="EMPTY_STEPS",
                message="步骤定义不能为空",
                details={}
            )
        for idx, step in enumerate(steps):
            if "step_id" not in step:
                raise JourneyAssetError(
                    error_code="MISSING_STEP_ID",
                    message=f"步骤 {idx} 缺少 step_id",
                    details={"step_index": idx}
                )
            if "name" not in step:
                raise JourneyAssetError(
                    error_code="MISSING_STEP_NAME",
                    message=f"步骤 {idx} 缺少 name",
                    details={"step_index": idx, "step_id": step.get("step_id")}
                )
        return True
    except json.JSONDecodeError as e:
        raise JourneyAssetError(
            error_code="INVALID_JSON",
            message="步骤定义必须是有效的JSON格式",
            details={"parse_error": str(e)}
        )


def validate_frequency_conflict(db: Session, name: str, frequency: str, exclude_id: int = None):
    conflict = db.query(JourneyAsset).filter(
        and_(
            JourneyAsset.run_frequency == frequency,
            JourneyAsset.name != name,
            JourneyAsset.id != exclude_id if exclude_id else True
        )
    ).first()
    if conflict:
        raise JourneyAssetError(
            error_code="FREQUENCY_CONFLICT",
            message=f"运行频率冲突，旅程 '{conflict.name}' 已使用相同频率 '{frequency}'",
            details={"conflict_journey": conflict.name, "frequency": frequency}
        )
    return True


def validate_dependent_services(dependent_services: str):
    if not dependent_services:
        return True
    try:
        services = json.loads(dependent_services)
        if not isinstance(services, list):
            raise JourneyAssetError(
                error_code="INVALID_DEPENDENT_FORMAT",
                message="依赖服务必须是数组格式",
                details={}
            )
        return True
    except json.JSONDecodeError as e:
        raise JourneyAssetError(
            error_code="INVALID_DEPENDENT_JSON",
            message="依赖服务必须是有效的JSON格式",
            details={"parse_error": str(e)}
        )


def get_journey_asset(db: Session, journey_id: int):
    journey = db.query(JourneyAsset).filter(JourneyAsset.id == journey_id).first()
    if not journey:
        raise JourneyAssetError(
            error_code="NOT_FOUND",
            message=f"旅程资产 ID {journey_id} 不存在",
            details={"journey_id": journey_id}
        )
    return journey


def get_journey_asset_by_name(db: Session, name: str):
    return db.query(JourneyAsset).filter(JourneyAsset.name == name).first()


def get_journey_assets(db: Session, skip: int = 0, limit: int = 100, status: JourneyStatus = None, keyword: str = None):
    query = db.query(JourneyAsset)
    if status:
        query = query.filter(JourneyAsset.status == status)
    if keyword:
        query = query.filter(
            or_(
                JourneyAsset.name.ilike(f"%{keyword}%"),
                JourneyAsset.description.ilike(f"%{keyword}%")
            )
        )
    return query.offset(skip).limit(limit).all()


def create_journey_asset(db: Session, journey: JourneyAssetCreate):
    existing = get_journey_asset_by_name(db, journey.name)
    if existing:
        raise JourneyAssetError(
            error_code="DUPLICATE_NAME",
            message=f"旅程名称 '{journey.name}' 已存在",
            details={"name": journey.name}
        )

    validate_steps_definition(journey.steps_definition)
    validate_frequency_conflict(db, journey.name, journey.run_frequency)
    if journey.dependent_services:
        validate_dependent_services(journey.dependent_services)

    db_journey = JourneyAsset(
        name=journey.name,
        description=journey.description,
        steps_definition=journey.steps_definition,
        dependent_services=journey.dependent_services,
        run_frequency=journey.run_frequency,
        status=JourneyStatus.DRAFT
    )
    db.add(db_journey)
    db.commit()
    db.refresh(db_journey)
    return db_journey


def update_journey_asset(db: Session, journey_id: int, journey: JourneyAssetUpdate):
    db_journey = get_journey_asset(db, journey_id)

    if journey.name and journey.name != db_journey.name:
        existing = get_journey_asset_by_name(db, journey.name)
        if existing:
            raise JourneyAssetError(
                error_code="DUPLICATE_NAME",
                message=f"旅程名称 '{journey.name}' 已存在",
                details={"name": journey.name}
            )
        db_journey.name = journey.name

    if journey.steps_definition:
        validate_steps_definition(journey.steps_definition)
        db_journey.steps_definition = journey.steps_definition

    if journey.run_frequency:
        validate_frequency_conflict(db, db_journey.name, journey.run_frequency, journey_id)
        db_journey.run_frequency = journey.run_frequency

    if journey.dependent_services:
        validate_dependent_services(journey.dependent_services)
        db_journey.dependent_services = journey.dependent_services

    if journey.description is not None:
        db_journey.description = journey.description

    db.commit()
    db.refresh(db_journey)
    return db_journey


def submit_for_review(db: Session, journey_id: int):
    db_journey = get_journey_asset(db, journey_id)
    if db_journey.status not in [JourneyStatus.DRAFT, JourneyStatus.REJECTED]:
        raise JourneyAssetError(
            error_code="INVALID_STATUS_TRANSITION",
            message=f"当前状态 '{db_journey.status}' 不允许提交审核",
            details={"current_status": db_journey.status, "allowed_statuses": ["draft", "rejected"]}
        )
    db_journey.status = JourneyStatus.PENDING_REVIEW
    db.commit()
    db.refresh(db_journey)
    return db_journey


def register_journey(db: Session, journey_id: int, reporter: str = None):
    db_journey = get_journey_asset(db, journey_id)
    if db_journey.status != JourneyStatus.PENDING_REVIEW:
        raise JourneyAssetError(
            error_code="INVALID_STATUS_TRANSITION",
            message=f"只有待审核状态的旅程才能注册，当前状态: '{db_journey.status}'",
            details={"current_status": db_journey.status, "required_status": "pending_review"}
        )
    db_journey.status = JourneyStatus.REGISTERED
    db_journey.registered_at = datetime.utcnow()

    report = RegistrationReport(
        journey_id=journey_id,
        report_content=json.dumps({
            "action": "register",
            "journey_name": db_journey.name,
            "registered_at": db_journey.registered_at.isoformat()
        }, ensure_ascii=False),
        reporter=reporter or "system"
    )
    db.add(report)
    db.commit()
    db.refresh(db_journey)
    return db_journey


def reject_journey(db: Session, journey_id: int, reason: str, reporter: str = None):
    db_journey = get_journey_asset(db, journey_id)
    if db_journey.status != JourneyStatus.PENDING_REVIEW:
        raise JourneyAssetError(
            error_code="INVALID_STATUS_TRANSITION",
            message=f"只有待审核状态的旅程才能驳回，当前状态: '{db_journey.status}'",
            details={"current_status": db_journey.status, "required_status": "pending_review"}
        )
    db_journey.status = JourneyStatus.REJECTED

    report = RegistrationReport(
        journey_id=journey_id,
        report_content=json.dumps({
            "action": "reject",
            "journey_name": db_journey.name,
            "reason": reason,
            "rejected_at": datetime.utcnow().isoformat()
        }, ensure_ascii=False),
        reporter=reporter or "system"
    )
    db.add(report)
    db.commit()
    db.refresh(db_journey)
    return db_journey


def archive_journey(db: Session, journey_id: int):
    db_journey = get_journey_asset(db, journey_id)
    if db_journey.status not in [JourneyStatus.REGISTERED, JourneyStatus.REJECTED]:
        raise JourneyAssetError(
            error_code="INVALID_STATUS_TRANSITION",
            message=f"只有已注册或已驳回的旅程才能归档，当前状态: '{db_journey.status}'",
            details={"current_status": db_journey.status, "allowed_statuses": ["registered", "rejected"]}
        )
    db_journey.status = JourneyStatus.ARCHIVED
    db.commit()
    db.refresh(db_journey)
    return db_journey


def delete_journey_asset(db: Session, journey_id: int):
    db_journey = get_journey_asset(db, journey_id)
    if db_journey.status == JourneyStatus.REGISTERED:
        raise JourneyAssetError(
            error_code="DELETE_NOT_ALLOWED",
            message="已注册的旅程不能删除，请先归档",
            details={"status": db_journey.status}
        )
    db.delete(db_journey)
    db.commit()
    return True


def create_failure_sample(db: Session, sample: FailureSampleCreate):
    journey = get_journey_asset(db, sample.journey_id)
    db_sample = FailureSample(
        journey_id=sample.journey_id,
        sample_data=sample.sample_data,
        error_message=sample.error_message
    )
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


def get_failure_samples(db: Session, journey_id: int = None, archived: bool = None, skip: int = 0, limit: int = 100):
    query = db.query(FailureSample)
    if journey_id:
        query = query.filter(FailureSample.journey_id == journey_id)
    if archived is not None:
        query = query.filter(FailureSample.archived == 1 if archived else 0)
    return query.offset(skip).limit(limit).all()


def archive_failure_sample(db: Session, sample_id: int):
    sample = db.query(FailureSample).filter(FailureSample.id == sample_id).first()
    if not sample:
        raise JourneyAssetError(
            error_code="NOT_FOUND",
            message=f"失败样本 ID {sample_id} 不存在",
            details={"sample_id": sample_id}
        )
    if sample.archived == 1:
        raise JourneyAssetError(
            error_code="ALREADY_ARCHIVED",
            message=f"失败样本 ID {sample_id} 已归档，无需重复处理",
            details={"sample_id": sample_id}
        )
    sample.archived = 1
    sample.archived_at = datetime.utcnow()
    db.commit()
    db.refresh(sample)
    return sample


def create_registration_report(db: Session, report: RegistrationReportCreate):
    journey = get_journey_asset(db, report.journey_id)
    db_report = RegistrationReport(
        journey_id=report.journey_id,
        report_content=report.report_content,
        reporter=report.reporter
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_registration_reports(db: Session, journey_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(RegistrationReport)
    if journey_id:
        query = query.filter(RegistrationReport.journey_id == journey_id)
    return query.offset(skip).limit(limit).all()