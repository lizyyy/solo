from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from datetime import datetime
from typing import List, Optional, Dict, Any
import json
import uuid

from models import (
    Hazard, HazardPhoto, ResponsiblePerson, Rectification, RectificationPhoto,
    Recheck, RecheckPhoto, BatchOperation, BatchItem, OperationLog, RuleCheckResult,
    HazardStatus, HazardLevel, BatchStatus, OperationType
)
from schemas import (
    HazardCreate, HazardUpdate, ResponsiblePersonCreate, ResponsiblePersonUpdate,
    RectificationCreate, RecheckCreate, RuleCheckResultCreate, HazardFilter
)


class BaseRepository:
    def __init__(self, db: Session):
        self.db = db


class ResponsiblePersonRepository(BaseRepository):
    def create(self, data: ResponsiblePersonCreate) -> ResponsiblePerson:
        person = ResponsiblePerson(**data.model_dump())
        self.db.add(person)
        self.db.flush()
        return person

    def get_by_id(self, person_id: int) -> Optional[ResponsiblePerson]:
        return self.db.query(ResponsiblePerson).filter(
            ResponsiblePerson.id == person_id,
            ResponsiblePerson.is_active == True
        ).first()

    def get_by_name(self, name: str) -> Optional[ResponsiblePerson]:
        return self.db.query(ResponsiblePerson).filter(
            ResponsiblePerson.name == name,
            ResponsiblePerson.is_active == True
        ).first()

    def list_all(self) -> List[ResponsiblePerson]:
        return self.db.query(ResponsiblePerson).filter(
            ResponsiblePerson.is_active == True
        ).all()

    def update(self, person_id: int, data: ResponsiblePersonUpdate) -> Optional[ResponsiblePerson]:
        person = self.get_by_id(person_id)
        if person:
            for key, value in data.model_dump(exclude_unset=True).items():
                setattr(person, key, value)
            self.db.flush()
        return person

    def delete(self, person_id: int) -> bool:
        person = self.get_by_id(person_id)
        if person:
            person.is_active = False
            self.db.flush()
            return True
        return False


class HazardRepository(BaseRepository):
    def _generate_hazard_code(self) -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        count = self.db.query(func.count(Hazard.id)).filter(
            Hazard.hazard_code.like(f"H{date_str}%")
        ).scalar() + 1
        return f"H{date_str}{count:04d}"

    def create(self, data: HazardCreate) -> Hazard:
        hazard_data = data.model_dump(exclude={"photos"})
        hazard_data["hazard_code"] = self._generate_hazard_code()
        hazard = Hazard(**hazard_data)
        
        for photo_data in data.photos:
            photo = HazardPhoto(**photo_data.model_dump())
            hazard.photos.append(photo)
        
        self.db.add(hazard)
        self.db.flush()
        return hazard

    def get_by_id(self, hazard_id: int) -> Optional[Hazard]:
        return self.db.query(Hazard).options(
            joinedload(Hazard.responsible_person),
            joinedload(Hazard.photos),
            joinedload(Hazard.rectifications).joinedload(Rectification.photos),
            joinedload(Hazard.rechecks).joinedload(Recheck.photos),
            joinedload(Hazard.rule_check_results)
        ).filter(
            Hazard.id == hazard_id,
            Hazard.is_deleted == False
        ).first()

    def get_by_code(self, hazard_code: str) -> Optional[Hazard]:
        return self.db.query(Hazard).options(
            joinedload(Hazard.responsible_person),
            joinedload(Hazard.photos),
            joinedload(Hazard.rectifications),
            joinedload(Hazard.rechecks),
            joinedload(Hazard.rule_check_results)
        ).filter(
            Hazard.hazard_code == hazard_code,
            Hazard.is_deleted == False
        ).first()

    def list(self, filter_params: Optional[HazardFilter] = None, 
             skip: int = 0, limit: int = 100) -> List[Hazard]:
        query = self.db.query(Hazard).options(
            joinedload(Hazard.responsible_person),
            joinedload(Hazard.photos),
            joinedload(Hazard.rectifications),
            joinedload(Hazard.rechecks),
            joinedload(Hazard.rule_check_results)
        ).filter(Hazard.is_deleted == False)

        if filter_params:
            if filter_params.responsible_person_id:
                query = query.filter(Hazard.responsible_person_id == filter_params.responsible_person_id)
            if filter_params.department:
                query = query.filter(Hazard.department == filter_params.department)
            if filter_params.team:
                query = query.filter(Hazard.team == filter_params.team)
            if filter_params.status:
                query = query.filter(Hazard.status == filter_params.status)
            if filter_params.level:
                query = query.filter(Hazard.level == filter_params.level)
            if filter_params.location:
                query = query.filter(Hazard.location.like(f"%{filter_params.location}%"))
            if filter_params.start_time:
                query = query.filter(Hazard.discover_time >= filter_params.start_time)
            if filter_params.end_time:
                query = query.filter(Hazard.discover_time <= filter_params.end_time)
            if filter_params.is_closed is not None:
                if filter_params.is_closed:
                    query = query.filter(Hazard.status == HazardStatus.CLOSED)
                else:
                    query = query.filter(Hazard.status != HazardStatus.CLOSED)

        query = query.order_by(Hazard.created_at.desc())
        return query.offset(skip).limit(limit).all()

    def count(self, filter_params: Optional[HazardFilter] = None) -> int:
        query = self.db.query(func.count(Hazard.id)).filter(Hazard.is_deleted == False)
        
        if filter_params:
            if filter_params.responsible_person_id:
                query = query.filter(Hazard.responsible_person_id == filter_params.responsible_person_id)
            if filter_params.department:
                query = query.filter(Hazard.department == filter_params.department)
            if filter_params.team:
                query = query.filter(Hazard.team == filter_params.team)
            if filter_params.status:
                query = query.filter(Hazard.status == filter_params.status)
            if filter_params.level:
                query = query.filter(Hazard.level == filter_params.level)
            if filter_params.location:
                query = query.filter(Hazard.location.like(f"%{filter_params.location}%"))
            if filter_params.start_time:
                query = query.filter(Hazard.discover_time >= filter_params.start_time)
            if filter_params.end_time:
                query = query.filter(Hazard.discover_time <= filter_params.end_time)
            if filter_params.is_closed is not None:
                if filter_params.is_closed:
                    query = query.filter(Hazard.status == HazardStatus.CLOSED)
                else:
                    query = query.filter(Hazard.status != HazardStatus.CLOSED)

        return query.scalar()

    def update(self, hazard_id: int, data: HazardUpdate) -> Optional[Hazard]:
        hazard = self.get_by_id(hazard_id)
        if hazard:
            old_values = {k: getattr(hazard, k) for k in data.model_dump(exclude_unset=True).keys()}
            
            for key, value in data.model_dump(exclude_unset=True).items():
                setattr(hazard, key, value)
            
            self._add_operation_log(
                hazard_id=hazard_id,
                operation="update",
                operator="system",
                old_value=json.dumps({k: str(v) for k, v in old_values.items()}),
                new_value=json.dumps({k: str(getattr(hazard, k)) for k in old_values.keys()})
            )
            
            self.db.flush()
        return hazard

    def update_status(self, hazard_id: int, status: HazardStatus, operator: str = "system") -> Optional[Hazard]:
        hazard = self.get_by_id(hazard_id)
        if hazard:
            old_status = hazard.status
            hazard.status = status
            
            if status == HazardStatus.CLOSED:
                hazard.actual_close_time = datetime.utcnow()
            
            self._add_operation_log(
                hazard_id=hazard_id,
                operation="status_change",
                operator=operator,
                old_value=str(old_status),
                new_value=str(status)
            )
            
            self.db.flush()
        return hazard

    def delete(self, hazard_id: int, operator: str = "system") -> bool:
        hazard = self.get_by_id(hazard_id)
        if hazard:
            hazard.is_deleted = True
            
            self._add_operation_log(
                hazard_id=hazard_id,
                operation="delete",
                operator=operator,
                old_value="active",
                new_value="deleted"
            )
            
            self.db.flush()
            return True
        return False

    def find_duplicates(self, location: str, title: str, time_window_days: int = 30) -> List[Hazard]:
        from datetime import timedelta
        cutoff_time = datetime.utcnow() - timedelta(days=time_window_days)
        
        return self.db.query(Hazard).filter(
            Hazard.is_deleted == False,
            Hazard.is_duplicate == False,
            Hazard.location == location,
            Hazard.title == title,
            Hazard.discover_time >= cutoff_time
        ).all()

    def mark_as_duplicate(self, hazard_id: int, duplicate_with_id: int) -> Optional[Hazard]:
        hazard = self.get_by_id(hazard_id)
        if hazard:
            hazard.is_duplicate = True
            hazard.duplicate_with = duplicate_with_id
            
            self._add_operation_log(
                hazard_id=hazard_id,
                operation="mark_duplicate",
                operator="system",
                old_value="not_duplicate",
                new_value=f"duplicate_with_{duplicate_with_id}"
            )
            
            self.db.flush()
        return hazard

    def _add_operation_log(self, hazard_id: int, operation: str, operator: str,
                          old_value: str, new_value: str, remark: str = ""):
        log = OperationLog(
            hazard_id=hazard_id,
            operation=operation,
            operator=operator,
            old_value=old_value,
            new_value=new_value,
            remark=remark
        )
        self.db.add(log)

    def add_photo(self, hazard_id: int, photo_data: Dict[str, Any]) -> Optional[HazardPhoto]:
        hazard = self.get_by_id(hazard_id)
        if hazard:
            photo = HazardPhoto(**photo_data)
            hazard.photos.append(photo)
            self.db.flush()
            return photo
        return None

    def add_rule_check_result(self, hazard_id: int, result_data: RuleCheckResultCreate) -> RuleCheckResult:
        result = RuleCheckResult(hazard_id=hazard_id, **result_data.model_dump())
        self.db.add(result)
        self.db.flush()
        return result

    def get_overdue_hazards(self) -> List[Hazard]:
        now = datetime.utcnow()
        return self.db.query(Hazard).options(
            joinedload(Hazard.responsible_person)
        ).filter(
            Hazard.is_deleted == False,
            Hazard.status.notin_([HazardStatus.CLOSED, HazardStatus.ESCALATED]),
            Hazard.deadline < now
        ).all()

    def has_photos(self, hazard_id: int) -> bool:
        return self.db.query(func.count(HazardPhoto.id)).filter(
            HazardPhoto.hazard_id == hazard_id,
            HazardPhoto.is_deleted == False
        ).scalar() > 0


class RectificationRepository(BaseRepository):
    def create(self, hazard_id: int, data: RectificationCreate) -> Rectification:
        rectification_data = data.model_dump(exclude={"photos"})
        rectification = Rectification(hazard_id=hazard_id, **rectification_data)
        
        for photo_data in data.photos:
            photo = RectificationPhoto(**photo_data.model_dump())
            rectification.photos.append(photo)
        
        self.db.add(rectification)
        self.db.flush()
        return rectification

    def get_by_id(self, rectification_id: int) -> Optional[Rectification]:
        return self.db.query(Rectification).options(
            joinedload(Rectification.photos)
        ).filter(Rectification.id == rectification_id).first()

    def get_by_hazard_id(self, hazard_id: int) -> List[Rectification]:
        return self.db.query(Rectification).options(
            joinedload(Rectification.photos)
        ).filter(Rectification.hazard_id == hazard_id).order_by(Rectification.created_at.desc()).all()


class RecheckRepository(BaseRepository):
    def create(self, hazard_id: int, data: RecheckCreate) -> Recheck:
        recheck_data = data.model_dump(exclude={"photos"})
        recheck = Recheck(hazard_id=hazard_id, **recheck_data)
        
        for photo_data in data.photos:
            photo = RecheckPhoto(**photo_data.model_dump())
            recheck.photos.append(photo)
        
        self.db.add(recheck)
        self.db.flush()
        return recheck

    def get_by_id(self, recheck_id: int) -> Optional[Recheck]:
        return self.db.query(Recheck).options(
            joinedload(Recheck.photos)
        ).filter(Recheck.id == recheck_id).first()

    def get_by_hazard_id(self, hazard_id: int) -> List[Recheck]:
        return self.db.query(Recheck).options(
            joinedload(Recheck.photos)
        ).filter(Recheck.hazard_id == hazard_id).order_by(Recheck.created_at.desc()).all()


class BatchOperationRepository(BaseRepository):
    def _generate_batch_no(self) -> str:
        return f"BATCH{uuid.uuid4().hex[:8].upper()}"

    def create(self, operation_type: OperationType, total_count: int = 0,
               operator: str = "", remark: str = "") -> BatchOperation:
        batch = BatchOperation(
            batch_no=self._generate_batch_no(),
            operation_type=operation_type,
            total_count=total_count,
            operator=operator,
            remark=remark
        )
        self.db.add(batch)
        self.db.flush()
        return batch

    def get_by_id(self, batch_id: int) -> Optional[BatchOperation]:
        return self.db.query(BatchOperation).options(
            joinedload(BatchOperation.items)
        ).filter(BatchOperation.id == batch_id).first()

    def get_by_batch_no(self, batch_no: str) -> Optional[BatchOperation]:
        return self.db.query(BatchOperation).options(
            joinedload(BatchOperation.items)
        ).filter(BatchOperation.batch_no == batch_no).first()

    def update_status(self, batch_id: int, status: BatchStatus, 
                      success_count: int = None, failed_count: int = None) -> Optional[BatchOperation]:
        batch = self.get_by_id(batch_id)
        if batch:
            batch.status = status
            if success_count is not None:
                batch.success_count = success_count
            if failed_count is not None:
                batch.failed_count = failed_count
            self.db.flush()
        return batch

    def add_item(self, batch_id: int, row_index: int, row_data: str,
                 hazard_id: int = None, success: bool = None, 
                 error_message: str = None) -> BatchItem:
        item = BatchItem(
            batch_id=batch_id,
            row_index=row_index,
            row_data=row_data,
            hazard_id=hazard_id,
            success=success,
            error_message=error_message,
            processed_at=datetime.utcnow() if success is not None else None
        )
        self.db.add(item)
        self.db.flush()
        return item

    def update_item(self, item_id: int, success: bool, error_message: str = None,
                    hazard_id: int = None) -> Optional[BatchItem]:
        item = self.db.query(BatchItem).filter(BatchItem.id == item_id).first()
        if item:
            item.success = success
            item.error_message = error_message
            item.hazard_id = hazard_id
            item.processed_at = datetime.utcnow()
            item.retry_count += 1
            item.last_retry_at = datetime.utcnow()
            self.db.flush()
        return item

    def get_failed_items(self, batch_id: int) -> List[BatchItem]:
        return self.db.query(BatchItem).filter(
            BatchItem.batch_id == batch_id,
            BatchItem.success == False
        ).all()


class OperationLogRepository(BaseRepository):
    def get_by_hazard_id(self, hazard_id: int, limit: int = 50) -> List[OperationLog]:
        return self.db.query(OperationLog).filter(
            OperationLog.hazard_id == hazard_id
        ).order_by(OperationLog.operate_time.desc()).limit(limit).all()

    def create(self, hazard_id: int, operation: str, operator: str,
               old_value: str = "", new_value: str = "", remark: str = "") -> OperationLog:
        log = OperationLog(
            hazard_id=hazard_id,
            operation=operation,
            operator=operator,
            old_value=old_value,
            new_value=new_value,
            remark=remark
        )
        self.db.add(log)
        self.db.flush()
        return log
