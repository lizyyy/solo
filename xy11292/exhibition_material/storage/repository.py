from typing import Type, TypeVar, List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from exhibition_material.models import (
    Material, Allocation, ReturnRecord, ImportError,
    RecordStatus, AnomalyType, MaterialType
)

T = TypeVar('T')

class BaseRepository:
    def __init__(self, session: Session, model: Type[T]):
        self.session = session
        self.model = model
    
    def create(self, **kwargs) -> T:
        instance = self.model(**kwargs)
        self.session.add(instance)
        self.session.flush()
        return instance
    
    def get_by_id(self, id: int) -> Optional[T]:
        return self.session.query(self.model).filter(self.model.id == id).first()
    
    def update(self, instance: T, **kwargs) -> T:
        for key, value in kwargs.items():
            setattr(instance, key, value)
        self.session.flush()
        return instance
    
    def delete(self, instance: T):
        self.session.delete(instance)
        self.session.flush()
    
    def list_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        return self.session.query(self.model).offset(skip).limit(limit).all()
    
    def count(self) -> int:
        return self.session.query(self.model).count()

class MaterialRepository(BaseRepository):
    def __init__(self, session: Session):
        super().__init__(session, Material)
    
    def get_by_code(self, code: str) -> Optional[Material]:
        return self.session.query(Material).filter(Material.code == code).first()
    
    def list_by_type(self, material_type: MaterialType) -> List[Material]:
        return self.session.query(Material).filter(
            Material.type == material_type,
            Material.is_active == True
        ).all()
    
    def list_by_responsible_person(self, person: str) -> List[Material]:
        return self.session.query(Material).filter(
            Material.responsible_person == person,
            Material.is_active == True
        ).all()
    
    def search(self, keyword: str = None, material_type: MaterialType = None,
               is_active: bool = None) -> List[Material]:
        query = self.session.query(Material)
        if keyword:
            query = query.filter(
                or_(
                    Material.code.contains(keyword),
                    Material.name.contains(keyword)
                )
            )
        if material_type:
            query = query.filter(Material.type == material_type)
        if is_active is not None:
            query = query.filter(Material.is_active == is_active)
        return query.all()
    
    def update_quantities(self, material_id: int, available_delta: float = 0,
                          allocated_delta: float = 0, returned_delta: float = 0):
        material = self.get_by_id(material_id)
        if material:
            material.available_quantity += available_delta
            material.allocated_quantity += allocated_delta
            material.returned_quantity += returned_delta
            self.session.flush()

class AllocationRepository(BaseRepository):
    def __init__(self, session: Session):
        super().__init__(session, Allocation)
    
    def get_by_allocation_no(self, allocation_no: str) -> Optional[Allocation]:
        return self.session.query(Allocation).filter(
            Allocation.allocation_no == allocation_no,
            Allocation.is_deleted == False
        ).first()
    
    def list_by_booth(self, booth_number: str) -> List[Allocation]:
        return self.session.query(Allocation).filter(
            Allocation.booth_number == booth_number,
            Allocation.is_deleted == False
        ).all()
    
    def list_by_responsible_person(self, person: str) -> List[Allocation]:
        return self.session.query(Allocation).filter(
            Allocation.responsible_person == person,
            Allocation.is_deleted == False
        ).all()
    
    def list_by_status(self, status: RecordStatus) -> List[Allocation]:
        return self.session.query(Allocation).filter(
            Allocation.status == status,
            Allocation.is_deleted == False
        ).all()
    
    def list_with_anomalies(self) -> List[Allocation]:
        return self.session.query(Allocation).filter(
            Allocation.has_anomaly == True,
            Allocation.is_deleted == False
        ).all()
    
    def filter_allocations(self, responsible_person: str = None,
                           booth_number: str = None,
                           status: RecordStatus = None,
                           has_anomaly: bool = None,
                           anomaly_type: AnomalyType = None,
                           start_date: datetime = None,
                           end_date: datetime = None,
                           material_id: int = None) -> List[Allocation]:
        query = self.session.query(Allocation).filter(Allocation.is_deleted == False)
        
        if responsible_person:
            query = query.filter(Allocation.responsible_person == responsible_person)
        if booth_number:
            query = query.filter(Allocation.booth_number == booth_number)
        if status:
            query = query.filter(Allocation.status == status)
        if has_anomaly is not None:
            query = query.filter(Allocation.has_anomaly == has_anomaly)
        if anomaly_type:
            query = query.filter(Allocation.anomaly_type == anomaly_type)
        if start_date:
            query = query.filter(Allocation.allocated_at >= start_date)
        if end_date:
            query = query.filter(Allocation.allocated_at <= end_date)
        if material_id:
            query = query.filter(Allocation.material_id == material_id)
        
        return query.order_by(Allocation.allocated_at.desc()).all()

class ReturnRecordRepository(BaseRepository):
    def __init__(self, session: Session):
        super().__init__(session, ReturnRecord)
    
    def get_by_return_no(self, return_no: str) -> Optional[ReturnRecord]:
        return self.session.query(ReturnRecord).filter(
            ReturnRecord.return_no == return_no,
            ReturnRecord.is_deleted == False
        ).first()
    
    def list_by_allocation(self, allocation_id: int) -> List[ReturnRecord]:
        return self.session.query(ReturnRecord).filter(
            ReturnRecord.allocation_id == allocation_id,
            ReturnRecord.is_deleted == False
        ).all()
    
    def list_by_received_by(self, received_by: str) -> List[ReturnRecord]:
        return self.session.query(ReturnRecord).filter(
            ReturnRecord.received_by == received_by,
            ReturnRecord.is_deleted == False
        ).all()
    
    def list_with_anomalies(self) -> List[ReturnRecord]:
        return self.session.query(ReturnRecord).filter(
            ReturnRecord.has_anomaly == True,
            ReturnRecord.is_deleted == False
        ).all()
    
    def filter_records(self, received_by: str = None,
                       returned_by: str = None,
                       booth_number: str = None,
                       status: RecordStatus = None,
                       has_anomaly: bool = None,
                       anomaly_type: AnomalyType = None,
                       start_date: datetime = None,
                       end_date: datetime = None,
                       allocation_id: int = None,
                       material_id: int = None) -> List[ReturnRecord]:
        query = self.session.query(ReturnRecord).filter(ReturnRecord.is_deleted == False)
        
        if received_by:
            query = query.filter(ReturnRecord.received_by == received_by)
        if returned_by:
            query = query.filter(ReturnRecord.returned_by == returned_by)
        if booth_number:
            query = query.filter(ReturnRecord.booth_number == booth_number)
        if status:
            query = query.filter(ReturnRecord.status == status)
        if has_anomaly is not None:
            query = query.filter(ReturnRecord.has_anomaly == has_anomaly)
        if anomaly_type:
            query = query.filter(ReturnRecord.anomaly_type == anomaly_type)
        if start_date:
            query = query.filter(ReturnRecord.returned_at >= start_date)
        if end_date:
            query = query.filter(ReturnRecord.returned_at <= end_date)
        if allocation_id:
            query = query.filter(ReturnRecord.allocation_id == allocation_id)
        if material_id:
            query = query.filter(ReturnRecord.material_id == material_id)
        
        return query.order_by(ReturnRecord.returned_at.desc()).all()

class ImportErrorRepository(BaseRepository):
    def __init__(self, session: Session):
        super().__init__(session, ImportError)
    
    def list_by_batch(self, batch_id: str) -> List[ImportError]:
        return self.session.query(ImportError).filter(
            ImportError.import_batch_id == batch_id
        ).all()
    
    def list_unresolved(self) -> List[ImportError]:
        return self.session.query(ImportError).filter(
            ImportError.is_resolved == False
        ).all()
    
    def list_by_error_type(self, error_type: AnomalyType) -> List[ImportError]:
        return self.session.query(ImportError).filter(
            ImportError.error_type == error_type
        ).all()
    
    def mark_resolved(self, error_id: int, resolved_by: str):
        error = self.get_by_id(error_id)
        if error:
            error.is_resolved = True
            error.resolved_by = resolved_by
            error.resolved_at = int(datetime.now().timestamp())
            self.session.flush()
