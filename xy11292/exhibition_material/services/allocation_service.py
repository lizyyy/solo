from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from exhibition_material.storage.repository import AllocationRepository, MaterialRepository
from exhibition_material.models import Allocation, RecordStatus, AnomalyType, Material
from .material_service import MaterialService

class AllocationService:
    def __init__(self, session: Session):
        self.session = session
        self.repository = AllocationRepository(session)
        self.material_service = MaterialService(session)
        self._counter = 0
    
    def _generate_allocation_no(self) -> str:
        self._counter += 1
        return f"AL{datetime.now().strftime('%Y%m%d%H%M%S')}{self._counter:04d}"
    
    def create_allocation(self, material_id: int, booth_number: str, quantity: float,
                          responsible_person: str, contact_phone: str = None,
                          allocated_at: datetime = None, expected_return_at: datetime = None,
                          remarks: str = None, source_file: str = None,
                          source_line: int = None) -> Tuple[Allocation, Optional[Dict[str, Any]]]:
        allocation_no = self._generate_allocation_no()
        
        material = self.material_service.get_material(material_id)
        if not material:
            error = {
                "error_type": AnomalyType.MATERIAL_NOT_FOUND,
                "error_message": f"物料ID {material_id} 不存在",
                "suggestion": "请检查物料ID是否正确，或先创建物料"
            }
            return None, error
        
        if not self.material_service.check_available_quantity(material_id, quantity):
            error = {
                "error_type": AnomalyType.INSUFFICIENT_STOCK,
                "error_message": f"物料 {material.code} 库存不足，可用：{material.available_quantity}，需要：{quantity}",
                "suggestion": "请调整调拨数量或等待物料归还"
            }
            return None, error
        
        self.material_service.allocate_quantity(material_id, quantity)
        
        allocation = self.repository.create(
            allocation_no=allocation_no,
            material_id=material_id,
            booth_number=booth_number,
            quantity=quantity,
            responsible_person=responsible_person,
            contact_phone=contact_phone,
            allocated_at=allocated_at or datetime.now(),
            expected_return_at=expected_return_at,
            remarks=remarks,
            source_file=source_file,
            source_line=source_line,
            status=RecordStatus.APPROVED
        )
        
        return allocation, None
    
    def get_allocation(self, allocation_id: int = None, allocation_no: str = None) -> Optional[Allocation]:
        if allocation_id:
            return self.repository.get_by_id(allocation_id)
        if allocation_no:
            return self.repository.get_by_allocation_no(allocation_no)
        return None
    
    def update_allocation(self, allocation_id: int, **kwargs) -> Allocation:
        allocation = self.repository.get_by_id(allocation_id)
        if not allocation:
            raise ValueError(f"调拨单 {allocation_id} 不存在")
        
        if 'quantity' in kwargs and kwargs['quantity'] != allocation.quantity:
            old_quantity = allocation.quantity
            new_quantity = kwargs['quantity']
            delta = new_quantity - old_quantity
            
            if delta > 0:
                self.material_service.allocate_quantity(allocation.material_id, delta)
            elif delta < 0:
                self.material_service.return_quantity(allocation.material_id, -delta)
        
        return self.repository.update(allocation, **kwargs)
    
    def cancel_allocation(self, allocation_id: int, cancelled_by: str = None):
        allocation = self.repository.get_by_id(allocation_id)
        if not allocation:
            raise ValueError(f"调拨单 {allocation_id} 不存在")
        
        self.material_service.return_quantity(
            allocation.material_id,
            allocation.remaining_quantity
        )
        
        self.repository.update(
            allocation,
            status=RecordStatus.CANCELLED,
            is_deleted=True
        )
    
    def list_allocations(self, booth_number: str = None, responsible_person: str = None,
                         status: RecordStatus = None, has_anomaly: bool = None) -> List[Allocation]:
        if booth_number:
            return self.repository.list_by_booth(booth_number)
        if responsible_person:
            return self.repository.list_by_responsible_person(responsible_person)
        if status:
            return self.repository.list_by_status(status)
        if has_anomaly:
            return self.repository.list_with_anomalies()
        return self.repository.list_all()
    
    def mark_anomaly(self, allocation_id: int, anomaly_type: AnomalyType,
                     anomaly_remark: str = None):
        allocation = self.repository.get_by_id(allocation_id)
        if not allocation:
            raise ValueError(f"调拨单 {allocation_id} 不存在")
        
        self.repository.update(
            allocation,
            has_anomaly=True,
            anomaly_type=anomaly_type,
            anomaly_remark=anomaly_remark
        )
    
    def approve_allocation(self, allocation_id: int, approved_by: str):
        allocation = self.repository.get_by_id(allocation_id)
        if not allocation:
            raise ValueError(f"调拨单 {allocation_id} 不存在")
        
        self.repository.update(
            allocation,
            status=RecordStatus.APPROVED,
            approved_by=approved_by,
            approved_at=datetime.now()
        )
    
    def get_booth_summary(self, booth_number: str) -> Dict[str, Any]:
        allocations = self.repository.list_by_booth(booth_number)
        total_allocations = len(allocations)
        total_quantity = sum(a.quantity for a in allocations)
        total_returned = sum(a.returned_quantity for a in allocations)
        pending_return = total_quantity - total_returned
        anomaly_count = sum(1 for a in allocations if a.has_anomaly)
        
        return {
            "booth_number": booth_number,
            "total_allocations": total_allocations,
            "total_quantity": total_quantity,
            "total_returned": total_returned,
            "pending_return": pending_return,
            "anomaly_count": anomaly_count,
            "allocations": [a.to_dict() for a in allocations]
        }
