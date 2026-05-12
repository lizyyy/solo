from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.models.models import Fault, Machine, FaultStatus, RestockTask, TaskStatus
from app.schemas.schemas import FaultCreate, FaultUpdate
from app.utils.exceptions import ResourceNotFoundException, InvalidStatusTransitionException, BusinessException
import json


class FaultService:
    def __init__(self, db: Session):
        self.db = db

    def create_fault(self, fault_data: FaultCreate, operator: str = "system") -> Fault:
        machine = self.db.query(Machine).filter(Machine.id == fault_data.machine_id).first()
        if not machine:
            raise ResourceNotFoundException("Machine", fault_data.machine_id)
        
        fault = Fault(
            id=fault_data.id,
            machine_id=fault_data.machine_id,
            fault_type=fault_data.fault_type,
            description=fault_data.description,
            status=FaultStatus.OPEN,
            priority=fault_data.priority,
            assigned_operator=fault_data.assigned_operator
        )
        self.db.add(fault)
        
        self._suspend_pending_tasks(fault_data.machine_id, fault.id, operator)
        
        self.db.commit()
        self.db.refresh(fault)
        return fault

    def _suspend_pending_tasks(self, machine_id: str, fault_id: str, operator: str):
        pending_tasks = self.db.query(RestockTask).filter(
            RestockTask.machine_id == machine_id,
            RestockTask.status == TaskStatus.PENDING
        ).all()
        
        for task in pending_tasks:
            task.status = TaskStatus.CANCELLED
            task.failed_reason = f"Machine fault detected: {fault_id}"
            task.completed_at = datetime.utcnow()
            
            from app.models.models import TaskHistory
            history = TaskHistory(
                task_id=task.id,
                status_from=TaskStatus.PENDING.value,
                status_to=TaskStatus.CANCELLED.value,
                operator=operator,
                reason=f"Cancelled due to machine fault: {fault_id}"
            )
            self.db.add(history)

    def get_fault(self, fault_id: str) -> Fault:
        fault = self.db.query(Fault).filter(Fault.id == fault_id).first()
        if not fault:
            raise ResourceNotFoundException("Fault", fault_id)
        return fault

    def list_faults(self, status: Optional[FaultStatus] = None, machine_id: Optional[str] = None) -> List[Fault]:
        query = self.db.query(Fault)
        if status:
            query = query.filter(Fault.status == status)
        if machine_id:
            query = query.filter(Fault.machine_id == machine_id)
        return query.order_by(Fault.created_at.desc()).all()

    def _is_valid_status_transition(self, current: FaultStatus, new: FaultStatus) -> bool:
        valid_transitions = {
            FaultStatus.OPEN: [FaultStatus.IN_PROGRESS, FaultStatus.RESOLVED, FaultStatus.CANCELLED],
            FaultStatus.IN_PROGRESS: [FaultStatus.RESOLVED, FaultStatus.CANCELLED],
            FaultStatus.RESOLVED: [],
            FaultStatus.CANCELLED: []
        }
        return new in valid_transitions.get(current, [])

    def update_fault(self, fault_id: str, update_data: FaultUpdate, operator: str = "system") -> Fault:
        fault = self.get_fault(fault_id)
        
        old_status = fault.status
        diff_before = {"status": old_status.value}
        
        if update_data.status is not None:
            if not self._is_valid_status_transition(old_status, update_data.status):
                raise InvalidStatusTransitionException("Fault", old_status.value, update_data.status.value)
            fault.status = update_data.status
            
            if update_data.status == FaultStatus.RESOLVED:
                fault.resolved_at = datetime.utcnow()
        
        if update_data.description is not None:
            fault.description = update_data.description
        
        if update_data.priority is not None:
            fault.priority = update_data.priority
        
        if update_data.assigned_operator is not None:
            fault.assigned_operator = update_data.assigned_operator
        
        if update_data.resolution_notes is not None:
            fault.resolution_notes = update_data.resolution_notes
        
        diff_after = {"status": fault.status.value}
        
        self.db.commit()
        self.db.refresh(fault)
        return fault

    def resolve_fault(self, fault_id: str, resolution_notes: str, operator: str = "system") -> Fault:
        update_data = FaultUpdate(
            status=FaultStatus.RESOLVED,
            resolution_notes=resolution_notes
        )
        return self.update_fault(fault_id, update_data, operator)
