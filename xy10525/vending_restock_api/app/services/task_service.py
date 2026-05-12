from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy import and_

from app.models.models import (
    RestockTask, TaskItem, TaskHistory, Machine, Product, Inventory, Fault,
    TaskStatus, FaultStatus
)
from app.schemas.schemas import RestockTaskCreate, RestockTaskUpdate, RestockDemand, RestockAnalysis
from app.utils.exceptions import (
    ResourceNotFoundException, DuplicateTaskException, MachineFaultException,
    InvalidStatusTransitionException, BusinessException
)
from app.config import settings
import json


class TaskService:
    def __init__(self, db: Session):
        self.db = db

    def analyze_restock_demand(self, machine_id: str) -> RestockAnalysis:
        machine = self.db.query(Machine).filter(Machine.id == machine_id).first()
        if not machine:
            raise ResourceNotFoundException("Machine", machine_id)
        
        demands: List[RestockDemand] = []
        total_shortage = 0
        
        inventories = self.db.query(Inventory).filter(Inventory.machine_id == machine_id).all()
        for inv in inventories:
            shortage = inv.max_level - inv.quantity
            reason = ""
            
            if inv.quantity < inv.min_level:
                reason = f"库存低于警戒线({inv.quantity}/{inv.min_level})"
            elif shortage > 0:
                reason = "常规补货"
            
            if reason:
                demands.append(RestockDemand(
                    machine_id=machine_id,
                    product_id=inv.product_id,
                    current_quantity=inv.quantity,
                    max_level=inv.max_level,
                    shortage=shortage,
                    reason=reason,
                    expiry_date=inv.expiry_date
                ))
                total_shortage += shortage
        
        expiry_threshold = datetime.utcnow() + timedelta(days=settings.EXPIRE_WARNING_DAYS)
        for inv in inventories:
            if inv.expiry_date and inv.expiry_date <= expiry_threshold and inv.quantity > 0:
                demands.append(RestockDemand(
                    machine_id=machine_id,
                    product_id=inv.product_id,
                    current_quantity=inv.quantity,
                    max_level=inv.max_level,
                    shortage=0,
                    reason=f"临期商品需回收(剩余{(inv.expiry_date - datetime.utcnow()).days}天)",
                    expiry_date=inv.expiry_date
                ))
        
        active_fault = self.db.query(Fault).filter(
            Fault.machine_id == machine_id,
            Fault.status.in_([FaultStatus.OPEN, FaultStatus.IN_PROGRESS])
        ).first()
        
        pending_tasks = self.db.query(RestockTask).filter(
            RestockTask.machine_id == machine_id,
            RestockTask.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
        ).count()
        
        return RestockAnalysis(
            machine_id=machine.id,
            machine_name=machine.name,
            location=machine.location,
            demands=demands,
            total_shortage=total_shortage,
            has_fault=active_fault is not None,
            active_fault=active_fault,
            pending_tasks_count=pending_tasks
        )

    def _check_duplicate_task(self, machine_id: str, exclude_task_id: Optional[str] = None) -> Optional[RestockTask]:
        query = self.db.query(RestockTask).filter(
            RestockTask.machine_id == machine_id,
            RestockTask.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
        )
        if exclude_task_id:
            query = query.filter(RestockTask.id != exclude_task_id)
        return query.first()

    def _check_active_fault(self, machine_id: str) -> Optional[Fault]:
        return self.db.query(Fault).filter(
            Fault.machine_id == machine_id,
            Fault.status.in_([FaultStatus.OPEN, FaultStatus.IN_PROGRESS])
        ).first()

    def create_task(self, task_data: RestockTaskCreate, operator: str = "system", skip_fault_check: bool = False) -> RestockTask:
        machine = self.db.query(Machine).filter(Machine.id == task_data.machine_id).first()
        if not machine:
            raise ResourceNotFoundException("Machine", task_data.machine_id)
        
        existing_task = self._check_duplicate_task(task_data.machine_id)
        if existing_task:
            raise DuplicateTaskException(task_data.machine_id, existing_task.id)
        
        if not skip_fault_check:
            active_fault = self._check_active_fault(task_data.machine_id)
            if active_fault:
                raise MachineFaultException(task_data.machine_id, active_fault.id)
        
        task = RestockTask(
            id=task_data.id,
            machine_id=task_data.machine_id,
            status=TaskStatus.PENDING,
            priority=task_data.priority,
            notes=task_data.notes,
            assigned_operator=task_data.assigned_operator
        )
        self.db.add(task)
        
        for item_data in task_data.items:
            item = TaskItem(
                task_id=task.id,
                product_id=item_data.product_id,
                item_type=item_data.item_type,
                requested_quantity=item_data.requested_quantity,
                actual_quantity=None,
                notes=item_data.notes
            )
            self.db.add(item)
        
        history = TaskHistory(
            task_id=task.id,
            status_from=None,
            status_to=TaskStatus.PENDING.value,
            operator=operator,
            reason="Task created"
        )
        self.db.add(history)
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_task(self, task_id: str) -> RestockTask:
        task = self.db.query(RestockTask).filter(RestockTask.id == task_id).first()
        if not task:
            raise ResourceNotFoundException("RestockTask", task_id)
        return task

    def list_tasks(self, status: Optional[TaskStatus] = None, machine_id: Optional[str] = None, route_id: Optional[str] = None) -> List[RestockTask]:
        query = self.db.query(RestockTask)
        if status:
            query = query.filter(RestockTask.status == status)
        if machine_id:
            query = query.filter(RestockTask.machine_id == machine_id)
        if route_id:
            query = query.filter(RestockTask.route_id == route_id)
        return query.order_by(RestockTask.created_at.desc()).all()

    def _is_valid_status_transition(self, current: TaskStatus, new: TaskStatus) -> bool:
        valid_transitions = {
            TaskStatus.PENDING: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
            TaskStatus.IN_PROGRESS: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED],
            TaskStatus.COMPLETED: [],
            TaskStatus.CANCELLED: [],
            TaskStatus.FAILED: []
        }
        return new in valid_transitions.get(current, [])

    def update_task_status(self, task_id: str, new_status: TaskStatus, operator: str = "system", reason: str = None, failed_reason: str = None) -> RestockTask:
        task = self.get_task(task_id)
        old_status = task.status
        
        if not self._is_valid_status_transition(old_status, new_status):
            raise InvalidStatusTransitionException("Task", old_status.value, new_status.value)
        
        diff_before = {"status": old_status.value}
        diff_after = {"status": new_status.value}
        
        task.status = new_status
        if new_status == TaskStatus.IN_PROGRESS:
            task.started_at = datetime.utcnow()
        elif new_status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
            task.completed_at = datetime.utcnow()
            if failed_reason:
                task.failed_reason = failed_reason
        
        history = TaskHistory(
            task_id=task.id,
            status_from=old_status.value,
            status_to=new_status.value,
            operator=operator,
            diff_before=json.dumps(diff_before),
            diff_after=json.dumps(diff_after),
            reason=reason or f"Status changed to {new_status.value}"
        )
        self.db.add(history)
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def update_task(self, task_id: str, update_data: RestockTaskUpdate, operator: str = "system") -> RestockTask:
        task = self.get_task(task_id)
        
        diff_before = {}
        diff_after = {}
        
        if update_data.notes is not None:
            diff_before["notes"] = task.notes
            diff_after["notes"] = update_data.notes
            task.notes = update_data.notes
        
        if update_data.assigned_operator is not None:
            diff_before["assigned_operator"] = task.assigned_operator
            diff_after["assigned_operator"] = update_data.assigned_operator
            task.assigned_operator = update_data.assigned_operator
        
        if update_data.status is not None:
            return self.update_task_status(task_id, update_data.status, operator)
        
        if update_data.items is not None:
            existing_items = {item.product_id: item for item in task.items}
            for item_data in update_data.items:
                if item_data.product_id in existing_items:
                    item = existing_items[item_data.product_id]
                    diff_before_key = f"item_{item_data.product_id}"
                    diff_before[diff_before_key] = {
                        "requested_quantity": item.requested_quantity,
                        "actual_quantity": item.actual_quantity,
                        "item_type": item.item_type
                    }
                    
                    if item_data.requested_quantity is not None:
                        item.requested_quantity = item_data.requested_quantity
                    if item_data.actual_quantity is not None:
                        item.actual_quantity = item_data.actual_quantity
                    if item_data.item_type is not None:
                        item.item_type = item_data.item_type
                    if item_data.notes is not None:
                        item.notes = item_data.notes
                    
                    diff_after[diff_before_key] = {
                        "requested_quantity": item.requested_quantity,
                        "actual_quantity": item.actual_quantity,
                        "item_type": item.item_type
                    }
                else:
                    item = TaskItem(
                        task_id=task.id,
                        product_id=item_data.product_id,
                        item_type=item_data.item_type,
                        requested_quantity=item_data.requested_quantity,
                        actual_quantity=item_data.actual_quantity,
                        notes=item_data.notes
                    )
                    self.db.add(item)
                    diff_after[f"item_{item_data.product_id}"] = "NEW"
        
        if diff_before:
            history = TaskHistory(
                task_id=task.id,
                status_from=task.status.value,
                status_to=task.status.value,
                operator=operator,
                diff_before=json.dumps(diff_before),
                diff_after=json.dumps(diff_after),
                reason="Task updated manually"
            )
            self.db.add(history)
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def complete_task_execution(self, task_id: str, actual_items: List[dict], operator: str = "system") -> RestockTask:
        task = self.get_task(task_id)
        
        if task.status == TaskStatus.PENDING:
            task = self.update_task_status(task_id, TaskStatus.IN_PROGRESS, operator)
        
        diff_before = {}
        diff_after = {}
        
        for actual in actual_items:
            product_id = actual.get("product_id")
            item = self.db.query(TaskItem).filter(
                TaskItem.task_id == task_id,
                TaskItem.product_id == product_id
            ).first()
            
            if not item:
                raise ResourceNotFoundException("TaskItem", f"{task_id}:{product_id}")
            
            diff_before[f"item_{product_id}"] = {
                "requested_quantity": item.requested_quantity,
                "actual_quantity": item.actual_quantity
            }
            
            item.actual_quantity = actual.get("actual_quantity", item.requested_quantity)
            
            diff_after[f"item_{product_id}"] = {
                "requested_quantity": item.requested_quantity,
                "actual_quantity": item.actual_quantity
            }
        
        history = TaskHistory(
            task_id=task.id,
            status_from=task.status.value,
            status_to=task.status.value,
            operator=operator,
            diff_before=json.dumps(diff_before),
            diff_after=json.dumps(diff_after),
            reason="Task execution details updated"
        )
        self.db.add(history)
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def cancel_task(self, task_id: str, operator: str = "system", reason: str = None) -> RestockTask:
        return self.update_task_status(task_id, TaskStatus.CANCELLED, operator, reason)

    def fail_task(self, task_id: str, failed_reason: str, operator: str = "system") -> RestockTask:
        return self.update_task_status(task_id, TaskStatus.FAILED, operator, f"Failed: {failed_reason}", failed_reason)
