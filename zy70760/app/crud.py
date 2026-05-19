from sqlalchemy.orm import Session
from app.models import (
    WheelFile, MetaData, EntryPoint, Dependency,
    ValidationReport, ExceptionPath, AuditLog, WheelStatus
)
from app.schemas import (
    WheelFileCreate, WheelFileUpdate, MetaDataCreate,
    EntryPointCreate, DependencyCreate, ValidationReportCreate,
    ExceptionPathCreate, AuditLogCreate
)
from typing import List, Optional


def get_wheel_file(db: Session, wheel_file_id: int) -> Optional[WheelFile]:
    return db.query(WheelFile).filter(WheelFile.id == wheel_file_id).first()


def get_wheel_file_by_hash(db: Session, file_hash: str) -> Optional[WheelFile]:
    return db.query(WheelFile).filter(WheelFile.file_hash == file_hash).first()


def get_wheel_files(db: Session, skip: int = 0, limit: int = 100) -> List[WheelFile]:
    return db.query(WheelFile).offset(skip).limit(limit).all()


def create_wheel_file(db: Session, wheel_file: WheelFileCreate) -> WheelFile:
    db_wheel_file = WheelFile(
        filename=wheel_file.filename,
        file_hash=wheel_file.file_hash,
        file_size=wheel_file.file_size,
        uploader=wheel_file.uploader,
        status=WheelStatus.PENDING.value,
        platform_tag=wheel_file.platform_tag,
        python_version=wheel_file.python_version,
        package_name=wheel_file.package_name,
        package_version=wheel_file.package_version,
        original_filename=wheel_file.original_filename
    )
    db.add(db_wheel_file)
    db.commit()
    db.refresh(db_wheel_file)
    return db_wheel_file


def update_wheel_file_status(
    db: Session, wheel_file_id: int, new_status: str,
    actor: str = None, reason: str = None
) -> Optional[WheelFile]:
    db_wheel_file = get_wheel_file(db, wheel_file_id)
    if db_wheel_file:
        old_status = db_wheel_file.status
        db_wheel_file.status = new_status
        db.commit()
        db.refresh(db_wheel_file)

        db_audit = AuditLog(
            wheel_file_id=wheel_file_id,
            action="status_update",
            old_status=old_status,
            new_status=new_status,
            actor=actor,
            reason=reason
        )
        db.add(db_audit)
        db.commit()

    return db_wheel_file


def create_metadata(db: Session, metadata: MetaDataCreate) -> MetaData:
    db_metadata = MetaData(**metadata.model_dump())
    db.add(db_metadata)
    db.commit()
    db.refresh(db_metadata)
    return db_metadata


def create_entry_point(db: Session, entry_point: EntryPointCreate) -> EntryPoint:
    db_entry_point = EntryPoint(**entry_point.model_dump())
    db.add(db_entry_point)
    db.commit()
    db.refresh(db_entry_point)
    return db_entry_point


def create_dependency(db: Session, dependency: DependencyCreate) -> Dependency:
    db_dependency = Dependency(**dependency.model_dump())
    db.add(db_dependency)
    db.commit()
    db.refresh(db_dependency)
    return db_dependency


def create_validation_report(db: Session, report: ValidationReportCreate) -> ValidationReport:
    db_report = ValidationReport(**report.model_dump())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def create_exception_path(db: Session, exception_path: ExceptionPathCreate) -> ExceptionPath:
    db_exception = ExceptionPath(**exception_path.model_dump())
    db.add(db_exception)
    db.commit()
    db.refresh(db_exception)
    return db_exception


def create_audit_log(db: Session, audit_log: AuditLogCreate) -> AuditLog:
    db_audit = AuditLog(**audit_log.model_dump())
    db.add(db_audit)
    db.commit()
    db.refresh(db_audit)
    return db_audit


def delete_wheel_file_metadata(db: Session, wheel_file_id: int):
    db.query(MetaData).filter(MetaData.wheel_file_id == wheel_file_id).delete()


def delete_wheel_file_entry_points(db: Session, wheel_file_id: int):
    db.query(EntryPoint).filter(EntryPoint.wheel_file_id == wheel_file_id).delete()


def delete_wheel_file_dependencies(db: Session, wheel_file_id: int):
    db.query(Dependency).filter(Dependency.wheel_file_id == wheel_file_id).delete()
