from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from exhibition_material.storage.repository import (
    ReturnRecordRepository, AllocationRepository, MaterialRepository
)
from exhibition_material.models import ReturnRecord, RecordStatus, AnomalyType
from .material_service import MaterialService
from .allocation_service import AllocationService

class ReturnService:
    def __init__(self, session: Session):
        self.session = session
        self.repository = ReturnRecordRepository(session)
        self.allocation_repo = AllocationRepository(session)
        self.material_service = MaterialService(session)
        self._counter = 0
    
    def _generate_return_no(self) -> str:
        self._counter += 1
        return f"RT{datetime.now().strftime('%Y%m%d%H%M%S')}{self._counter:04d}"
    
    def create_return_record(self, allocation_id: int, quantity: float,
                             received_by: str, returned_by: str,
                             returned_at: datetime = None, booth_number: str = None,
                             condition_remark: str = None, remarks: str = None,
                             source_file: str = None, source_line: int = None) -> Tuple[ReturnRecord, Optional[Dict[str, Any]]]:
        return_no = self._generate_return_no()
        
        allocation = self.allocation_repo.get_by_id(allocation_id)
        if not allocation:
            error = {
                "error_type": AnomalyType.MATERIAL_NOT_FOUND,
                "error_message": f"调拨单ID {allocation_id} 不存在",
                "suggestion": "请检查调拨单ID是否正确"
            }
            return None, error
        
        if allocation.remaining_quantity < quantity:
            error = {
                "error_type": AnomalyType.QUANTITY_MISMATCH,
                "error_message": f"归还数量超过待归还数量，待归还：{allocation.remaining_quantity}，归还：{quantity}",
                "suggestion": "请调整归还数量或检查之前的归还记录"
            }
            return None, error
        
        self.material_service.return_quantity(allocation.material_id, quantity)
        
        record = self.repository.create(
            return_no=return_no,
            allocation_id=allocation_id,
            material_id=allocation.material_id,
            quantity=quantity,
            returned_at=returned_at or datetime.now(),
            received_by=received_by,
            returned_by=returned_by,
            booth_number=booth_number or allocation.booth_number,
            condition_remark=condition_remark,
            remarks=remarks,
            source_file=source_file,
            source_line=source_line,
            status=RecordStatus.APPROVED
        )
        
        self._update_allocation_status(allocation_id)
        
        return record, None
    
    def _update_allocation_status(self, allocation_id: int):
        allocation = self.allocation_repo.get_by_id(allocation_id)
        if allocation:
            if allocation.returned_quantity >= allocation.quantity:
                self.allocation_repo.update(allocation, status=RecordStatus.COMPLETED)
            elif allocation.returned_quantity > 0:
                self.allocation_repo.update(allocation, status=RecordStatus.PARTIAL)
    
    def get_return_record(self, record_id: int = None, return_no: str = None) -> Optional[ReturnRecord]:
        if record_id:
            return self.repository.get_by_id(record_id)
        if return_no:
            return self.repository.get_by_return_no(return_no)
        return None
    
    def update_return_record(self, record_id: int, **kwargs) -> ReturnRecord:
        record = self.repository.get_by_id(record_id)
        if not record:
            raise ValueError(f"归还记录 {record_id} 不存在")
        
        if 'quantity' in kwargs and kwargs['quantity'] != record.quantity:
            old_quantity = record.quantity
            new_quantity = kwargs['quantity']
            delta = new_quantity - old_quantity
            
            if delta > 0:
                self.material_service.return_quantity(record.material_id, delta)
            elif delta < 0:
                self.material_service.allocate_quantity(record.material_id, -delta)
            
            self._update_allocation_status(record.allocation_id)
        
        return self.repository.update(record, **kwargs)
    
    def delete_return_record(self, record_id: int):
        record = self.repository.get_by_id(record_id)
        if not record:
            raise ValueError(f"归还记录 {record_id} 不存在")
        
        self.material_service.allocate_quantity(record.material_id, record.quantity)
        
        self.repository.update(record, is_deleted=True)
        self._update_allocation_status(record.allocation_id)
    
    def list_return_records(self, allocation_id: int = None, received_by: str = None,
                            has_anomaly: bool = None) -> List[ReturnRecord]:
        if allocation_id:
            return self.repository.list_by_allocation(allocation_id)
        if received_by:
            return self.repository.list_by_received_by(received_by)
        if has_anomaly:
            return self.repository.list_with_anomalies()
        return self.repository.list_all()
    
    def mark_anomaly(self, record_id: int, anomaly_type: AnomalyType,
                     anomaly_remark: str = None):
        record = self.repository.get_by_id(record_id)
        if not record:
            raise ValueError(f"归还记录 {record_id} 不存在")
        
        self.repository.update(
            record,
            has_anomaly=True,
            anomaly_type=anomaly_type,
            anomaly_remark=anomaly_remark
        )
    
    def get_allocation_return_summary(self, allocation_id: int) -> Dict[str, Any]:
        allocation = self.allocation_repo.get_by_id(allocation_id)
        if not allocation:
            raise ValueError(f"调拨单 {allocation_id} 不存在")
        
        records = self.repository.list_by_allocation(allocation_id)
        
        return {
            "allocation_no": allocation.allocation_no,
            "allocation_quantity": allocation.quantity,
            "total_returned": allocation.returned_quantity,
            "pending_return": allocation.remaining_quantity,
            "return_count": len(records),
            "records": [r.to_dict() for r in records]
        }
