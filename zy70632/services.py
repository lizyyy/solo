from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
from typing import Optional, List
import database as models
import schemas


def generate_no(prefix: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"{prefix}-{timestamp}"


class SampleBoxStatus:
    STORED = "stored"
    INSPECTED = "inspected"
    DESTROY_PENDING = "destroy_pending"
    DESTROYED = "destroyed"
    EXPIRED = "expired"
    CLOSED = "closed"


class DestructionStatus:
    PENDING_REVIEW = "pending_review"
    REVIEW_APPROVED = "review_approved"
    REVIEW_REJECTED = "review_rejected"
    DESTROYED = "destroyed"
    CANCELLED = "cancelled"


class InspectionStatus:
    PENDING_REVIEW = "pending_review"
    REVIEW_APPROVED = "review_approved"
    REVIEW_REJECTED = "review_rejected"
    CLOSED = "closed"


class ExceptionStatus:
    PENDING = "pending"
    HANDLED = "handled"
    CLOSED = "closed"


class BatchService:
    @staticmethod
    def create_batch(db: Session, batch: schemas.BatchCreate) -> models.Batch:
        db_batch = models.Batch(**batch.model_dump())
        db.add(db_batch)
        db.commit()
        db.refresh(db_batch)
        return db_batch

    @staticmethod
    def get_batch(db: Session, batch_id: int) -> Optional[models.Batch]:
        return db.query(models.Batch).filter(models.Batch.id == batch_id).first()

    @staticmethod
    def get_batch_by_no(db: Session, batch_no: str) -> Optional[models.Batch]:
        return db.query(models.Batch).filter(models.Batch.batch_no == batch_no).first()

    @staticmethod
    def list_batches(db: Session, skip: int = 0, limit: int = 100) -> List[models.Batch]:
        return db.query(models.Batch).offset(skip).limit(limit).all()

    @staticmethod
    def update_batch(db: Session, batch_id: int, batch_update: schemas.BatchUpdate) -> Optional[models.Batch]:
        db_batch = BatchService.get_batch(db, batch_id)
        if not db_batch:
            return None
        for key, value in batch_update.model_dump(exclude_unset=True).items():
            setattr(db_batch, key, value)
        db.commit()
        db.refresh(db_batch)
        return db_batch

    @staticmethod
    def close_batch(db: Session, batch_id: int, operator: str) -> Optional[models.Batch]:
        db_batch = BatchService.get_batch(db, batch_id)
        if not db_batch:
            return None
        db_batch.status = "closed"
        db.commit()
        db.refresh(db_batch)
        return db_batch


class StorageLocationService:
    @staticmethod
    def create_location(db: Session, location: schemas.StorageLocationCreate) -> models.StorageLocation:
        db_location = models.StorageLocation(**location.model_dump())
        db.add(db_location)
        db.commit()
        db.refresh(db_location)
        return db_location

    @staticmethod
    def get_location(db: Session, location_id: int) -> Optional[models.StorageLocation]:
        return db.query(models.StorageLocation).filter(models.StorageLocation.id == location_id).first()

    @staticmethod
    def list_locations(db: Session, available_only: bool = False) -> List[models.StorageLocation]:
        query = db.query(models.StorageLocation)
        if available_only:
            query = query.filter(models.StorageLocation.is_available == True)
        return query.all()


class SampleBoxService:
    @staticmethod
    def create_sample_box(db: Session, sample: schemas.SampleBoxCreate) -> models.SampleBox:
        batch = BatchService.get_batch(db, sample.batch_id)
        if not batch:
            raise ValueError("批次不存在")

        location = StorageLocationService.get_location(db, sample.storage_location_id)
        if not location:
            raise ValueError("冷藏位置不存在")
        if not location.is_available:
            raise ValueError("冷藏位置已被占用")

        expiry_date = sample.sample_date + timedelta(hours=sample.retention_days)
        db_sample = models.SampleBox(
            **sample.model_dump(),
            expiry_date=expiry_date,
            status=SampleBoxStatus.STORED
        )
        location.is_available = False
        db.add(db_sample)
        db.commit()
        db.refresh(db_sample)
        return db_sample

    @staticmethod
    def get_sample_box(db: Session, box_id: int) -> Optional[models.SampleBox]:
        return db.query(models.SampleBox).filter(models.SampleBox.id == box_id).first()

    @staticmethod
    def get_sample_box_by_no(db: Session, box_no: str) -> Optional[models.SampleBox]:
        return db.query(models.SampleBox).filter(models.SampleBox.box_no == box_no).first()

    @staticmethod
    def list_sample_boxes(db: Session, batch_id: Optional[int] = None, status: Optional[str] = None) -> List[models.SampleBox]:
        query = db.query(models.SampleBox)
        if batch_id:
            query = query.filter(models.SampleBox.batch_id == batch_id)
        if status:
            query = query.filter(models.SampleBox.status == status)
        return query.all()

    @staticmethod
    def update_sample_box(db: Session, box_id: int, update: schemas.SampleBoxUpdate) -> Optional[models.SampleBox]:
        db_sample = SampleBoxService.get_sample_box(db, box_id)
        if not db_sample:
            return None
        for key, value in update.model_dump(exclude_unset=True).items():
            setattr(db_sample, key, value)
        db.commit()
        db.refresh(db_sample)
        return db_sample

    @staticmethod
    def check_expiry(db: Session, box_id: int) -> bool:
        db_sample = SampleBoxService.get_sample_box(db, box_id)
        if not db_sample:
            return False
        return datetime.utcnow() > db_sample.expiry_date

    @staticmethod
    def close_sample_box(db: Session, box_id: int, operator: str) -> Optional[models.SampleBox]:
        db_sample = SampleBoxService.get_sample_box(db, box_id)
        if not db_sample:
            return None
        if db_sample.status == SampleBoxStatus.DESTROYED:
            raise ValueError("已销毁的留样盒无法关闭")
        db_sample.status = SampleBoxStatus.CLOSED
        if db_sample.storage_location:
            db_sample.storage_location.is_available = True
        db.commit()
        db.refresh(db_sample)
        return db_sample


class InspectionService:
    @staticmethod
    def create_inspection(db: Session, inspection: schemas.InspectionCreate) -> models.Inspection:
        batch = BatchService.get_batch(db, inspection.batch_id)
        if not batch:
            raise ValueError("批次不存在")

        sample_box = SampleBoxService.get_sample_box(db, inspection.sample_box_id)
        if not sample_box:
            raise ValueError("留样盒不存在")
        if sample_box.batch_id != inspection.batch_id:
            raise ValueError("留样盒与批次不匹配")
        if sample_box.status not in [SampleBoxStatus.STORED, SampleBoxStatus.INSPECTED]:
            raise ValueError("留样盒状态不允许抽检")

        db_inspection = models.Inspection(
            **inspection.model_dump(),
            status=InspectionStatus.PENDING_REVIEW
        )
        sample_box.status = SampleBoxStatus.INSPECTED
        db.add(db_inspection)
        db.commit()
        db.refresh(db_inspection)
        return db_inspection

    @staticmethod
    def get_inspection(db: Session, inspection_id: int) -> Optional[models.Inspection]:
        return db.query(models.Inspection).filter(models.Inspection.id == inspection_id).first()

    @staticmethod
    def list_inspections(db: Session, batch_id: Optional[int] = None, status: Optional[str] = None) -> List[models.Inspection]:
        query = db.query(models.Inspection)
        if batch_id:
            query = query.filter(models.Inspection.batch_id == batch_id)
        if status:
            query = query.filter(models.Inspection.status == status)
        return query.all()

    @staticmethod
    def review_inspection(db: Session, inspection_id: int, review: schemas.InspectionReview) -> Optional[models.Inspection]:
        db_inspection = InspectionService.get_inspection(db, inspection_id)
        if not db_inspection:
            return None
        if db_inspection.status != InspectionStatus.PENDING_REVIEW:
            raise ValueError("抽检记录状态不允许复核")

        db_inspection.reviewer = review.reviewer
        db_inspection.review_date = datetime.utcnow()
        db_inspection.review_result = review.review_result
        db_inspection.review_remark = review.review_remark

        if review.review_result == "approved":
            db_inspection.status = InspectionStatus.REVIEW_APPROVED
        else:
            db_inspection.status = InspectionStatus.REVIEW_REJECTED

        db.commit()
        db.refresh(db_inspection)
        return db_inspection


class DestructionService:
    @staticmethod
    def apply_destruction(db: Session, destruction: schemas.DestructionCreate) -> models.Destruction:
        sample_box = SampleBoxService.get_sample_box(db, destruction.sample_box_id)
        if not sample_box:
            raise ValueError("留样盒不存在")
        if sample_box.status in [SampleBoxStatus.DESTROYED, SampleBoxStatus.CLOSED]:
            raise ValueError("留样盒状态不允许申请销毁")
        if sample_box.destruction and sample_box.destruction.status != DestructionStatus.CANCELLED:
            raise ValueError("该留样盒已有正在处理的销毁申请")

        db_destruction = models.Destruction(
            **destruction.model_dump(),
            status=DestructionStatus.PENDING_REVIEW
        )
        sample_box.status = SampleBoxStatus.DESTROY_PENDING
        db.add(db_destruction)
        db.commit()
        db.refresh(db_destruction)
        return db_destruction

    @staticmethod
    def get_destruction(db: Session, destruction_id: int) -> Optional[models.Destruction]:
        return db.query(models.Destruction).filter(models.Destruction.id == destruction_id).first()

    @staticmethod
    def list_destructions(db: Session, status: Optional[str] = None) -> List[models.Destruction]:
        query = db.query(models.Destruction)
        if status:
            query = query.filter(models.Destruction.status == status)
        return query.all()

    @staticmethod
    def review_destruction(db: Session, destruction_id: int, review: schemas.DestructionReview) -> Optional[models.Destruction]:
        db_destruction = DestructionService.get_destruction(db, destruction_id)
        if not db_destruction:
            return None
        if db_destruction.status != DestructionStatus.PENDING_REVIEW:
            raise ValueError("销毁申请状态不允许审核")

        db_destruction.reviewer = review.reviewer
        db_destruction.review_date = datetime.utcnow()
        db_destruction.review_result = review.review_result
        db_destruction.review_remark = review.review_remark

        if review.review_result == "approved":
            db_destruction.status = DestructionStatus.REVIEW_APPROVED
        else:
            db_destruction.status = DestructionStatus.REVIEW_REJECTED
            db_destruction.sample_box.status = SampleBoxStatus.STORED

        db.commit()
        db.refresh(db_destruction)
        return db_destruction

    @staticmethod
    def execute_destruction(db: Session, destruction_id: int, execute: schemas.DestructionExecute) -> Optional[models.Destruction]:
        db_destruction = DestructionService.get_destruction(db, destruction_id)
        if not db_destruction:
            return None
        if db_destruction.status != DestructionStatus.REVIEW_APPROVED:
            raise ValueError("销毁申请未通过审核，不能执行销毁")

        db_destruction.destruction_date = datetime.utcnow()
        db_destruction.destructor = execute.destructor
        db_destruction.destruction_method = execute.destruction_method
        db_destruction.witness = execute.witness
        db_destruction.status = DestructionStatus.DESTROYED
        db_destruction.sample_box.status = SampleBoxStatus.DESTROYED

        if db_destruction.sample_box.storage_location:
            db_destruction.sample_box.storage_location.is_available = True

        db.commit()
        db.refresh(db_destruction)
        return db_destruction

    @staticmethod
    def cancel_destruction(db: Session, destruction_id: int, operator: str) -> Optional[models.Destruction]:
        db_destruction = DestructionService.get_destruction(db, destruction_id)
        if not db_destruction:
            return None
        if db_destruction.status == DestructionStatus.DESTROYED:
            raise ValueError("已执行的销毁不能撤回")

        db_destruction.status = DestructionStatus.CANCELLED
        db_destruction.sample_box.status = SampleBoxStatus.STORED
        db.commit()
        db.refresh(db_destruction)
        return db_destruction


class ExceptionService:
    @staticmethod
    def create_exception(db: Session, exception: schemas.ExceptionRecordCreate) -> models.ExceptionRecord:
        exception_no = generate_no("EXC")
        db_exception = models.ExceptionRecord(
            **exception.model_dump(),
            exception_no=exception_no,
            status=ExceptionStatus.PENDING
        )
        db.add(db_exception)
        db.commit()
        db.refresh(db_exception)
        return db_exception

    @staticmethod
    def get_exception(db: Session, exception_id: int) -> Optional[models.ExceptionRecord]:
        return db.query(models.ExceptionRecord).filter(models.ExceptionRecord.id == exception_id).first()

    @staticmethod
    def list_exceptions(db: Session, status: Optional[str] = None, related_type: Optional[str] = None) -> List[models.ExceptionRecord]:
        query = db.query(models.ExceptionRecord)
        if status:
            query = query.filter(models.ExceptionRecord.status == status)
        if related_type:
            query = query.filter(models.ExceptionRecord.related_type == related_type)
        return query.all()

    @staticmethod
    def handle_exception(db: Session, exception_id: int, handle: schemas.ExceptionRecordHandle) -> Optional[models.ExceptionRecord]:
        db_exception = ExceptionService.get_exception(db, exception_id)
        if not db_exception:
            return None
        if db_exception.status != ExceptionStatus.PENDING:
            raise ValueError("异常记录状态不允许处理")

        db_exception.handler = handle.handler
        db_exception.handle_date = datetime.utcnow()
        db_exception.conclusion = handle.conclusion
        db_exception.status = ExceptionStatus.HANDLED
        db.commit()
        db.refresh(db_exception)
        return db_exception


class ReportService:
    @staticmethod
    def generate_trace_report(db: Session, batch_no: Optional[str] = None,
                              start_date: Optional[datetime] = None,
                              end_date: Optional[datetime] = None) -> List[dict]:
        query = db.query(models.Batch)
        if batch_no:
            query = query.filter(models.Batch.batch_no == batch_no)
        if start_date:
            query = query.filter(models.Batch.production_date >= start_date)
        if end_date:
            query = query.filter(models.Batch.production_date <= end_date)

        batches = query.all()
        report_data = []

        for batch in batches:
            batch_data = {
                "batch_no": batch.batch_no,
                "dish_name": batch.dish_name,
                "production_date": batch.production_date.isoformat(),
                "quantity": batch.quantity,
                "operator": batch.operator,
                "samples": [],
                "inspections": [],
                "destructions": []
            }

            for sample in batch.samples:
                sample_data = {
                    "box_no": sample.box_no,
                    "sample_date": sample.sample_date.isoformat(),
                    "expiry_date": sample.expiry_date.isoformat(),
                    "status": sample.status,
                    "storage_location": sample.storage_location.location_name if sample.storage_location else None
                }
                batch_data["samples"].append(sample_data)

                for inspection in sample.inspections:
                    inspection_data = {
                        "inspection_no": inspection.inspection_no,
                        "inspection_date": inspection.inspection_date.isoformat(),
                        "inspector": inspection.inspector,
                        "result": inspection.result,
                        "conclusion": inspection.conclusion,
                        "reviewer": inspection.reviewer,
                        "review_result": inspection.review_result,
                        "status": inspection.status
                    }
                    batch_data["inspections"].append(inspection_data)

                if sample.destruction:
                    dest = sample.destruction
                    dest_data = {
                        "destruction_no": dest.destruction_no,
                        "application_date": dest.application_date.isoformat(),
                        "applicant": dest.applicant,
                        "reason": dest.reason,
                        "reviewer": dest.reviewer,
                        "review_result": dest.review_result,
                        "destruction_date": dest.destruction_date.isoformat() if dest.destruction_date else None,
                        "status": dest.status
                    }
                    batch_data["destructions"].append(dest_data)

            report_data.append(batch_data)

        return report_data
