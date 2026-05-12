from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import and_

from app.models.models import (
    Route, RestockTask, TaskItem, RouteHistory, Product, Machine, Inventory, Fault,
    RouteStatus, TaskStatus, FaultStatus
)
from app.schemas.schemas import (
    RouteCreate, RouteUpdate, RouteResponse, RestockTaskResponse,
    RouteDetail, DailyReport, StockoutRisk, RecoveryItem, ExecutionDiff
)
from app.utils.exceptions import (
    ResourceNotFoundException, CapacityExceededException,
    InvalidStatusTransitionException, BusinessException
)
from app.config import settings
import json


class RouteService:
    def __init__(self, db: Session):
        self.db = db

    def create_route(self, route_data: RouteCreate, operator: str = "system") -> Route:
        route = Route(
            id=route_data.id,
            name=route_data.name,
            status=RouteStatus.PLANNED,
            total_capacity=route_data.total_capacity,
            used_capacity=0,
            operator=route_data.operator,
            vehicle_id=route_data.vehicle_id,
            scheduled_date=route_data.scheduled_date
        )
        self.db.add(route)
        
        history = RouteHistory(
            route_id=route.id,
            status_from=None,
            status_to=RouteStatus.PLANNED.value,
            operator=operator,
            reason="Route created"
        )
        self.db.add(history)
        
        if route_data.task_ids:
            for task_id in route_data.task_ids:
                self.add_task_to_route(route.id, task_id, operator, auto_commit=False)
        
        self.db.commit()
        self.db.refresh(route)
        return route

    def get_route(self, route_id: str) -> Route:
        route = self.db.query(Route).filter(Route.id == route_id).first()
        if not route:
            raise ResourceNotFoundException("Route", route_id)
        return route

    def list_routes(self, status: Optional[RouteStatus] = None, scheduled_date: Optional[datetime] = None) -> List[Route]:
        query = self.db.query(Route)
        if status:
            query = query.filter(Route.status == status)
        if scheduled_date:
            query = query.filter(
                and_(
                    Route.scheduled_date >= scheduled_date.replace(hour=0, minute=0, second=0),
                    Route.scheduled_date <= scheduled_date.replace(hour=23, minute=59, second=59)
                )
            )
        return query.order_by(Route.scheduled_date.desc()).all()

    def add_task_to_route(self, route_id: str, task_id: str, operator: str = "system", auto_commit: bool = True):
        route = self.get_route(route_id)
        
        if route.status not in [RouteStatus.PLANNED, RouteStatus.DISPATCHED]:
            raise InvalidStatusTransitionException(
                "Route", route.status.value, "add_task"
            )
        
        task = self.db.query(RestockTask).filter(RestockTask.id == task_id).first()
        if not task:
            raise ResourceNotFoundException("RestockTask", task_id)
        
        if task.route_id and task.route_id != route_id:
            raise BusinessException(
                "TASK_ALREADY_ASSIGNED",
                f"Task {task_id} is already assigned to route {task.route_id}",
                {"task_id": task_id, "current_route_id": task.route_id}
            )
        
        required_capacity = self._calculate_task_capacity(task)
        available_capacity = route.total_capacity - route.used_capacity
        
        if required_capacity > available_capacity:
            raise CapacityExceededException(route_id, required_capacity, available_capacity)
        
        task.route_id = route.id
        route.used_capacity += required_capacity
        
        history = RouteHistory(
            route_id=route.id,
            status_from=route.status.value,
            status_to=route.status.value,
            operator=operator,
            diff_before=json.dumps({"used_capacity": route.used_capacity - required_capacity}),
            diff_after=json.dumps({"used_capacity": route.used_capacity}),
            reason=f"Added task {task_id}"
        )
        self.db.add(history)
        
        if auto_commit:
            self.db.commit()
            self.db.refresh(route)
        
        return route

    def remove_task_from_route(self, route_id: str, task_id: str, operator: str = "system"):
        route = self.get_route(route_id)
        
        if route.status not in [RouteStatus.PLANNED, RouteStatus.DISPATCHED]:
            raise InvalidStatusTransitionException(
                "Route", route.status.value, "remove_task"
            )
        
        task = self.db.query(RestockTask).filter(
            RestockTask.id == task_id,
            RestockTask.route_id == route_id
        ).first()
        if not task:
            raise ResourceNotFoundException("RestockTask in route", task_id)
        
        capacity_to_free = self._calculate_task_capacity(task)
        task.route_id = None
        route.used_capacity -= capacity_to_free
        
        history = RouteHistory(
            route_id=route.id,
            status_from=route.status.value,
            status_to=route.status.value,
            operator=operator,
            diff_before=json.dumps({"used_capacity": route.used_capacity + capacity_to_free}),
            diff_after=json.dumps({"used_capacity": route.used_capacity}),
            reason=f"Removed task {task_id}"
        )
        self.db.add(history)
        
        self.db.commit()
        self.db.refresh(route)
        return route

    def update_route_status(self, route_id: str, new_status: RouteStatus, operator: str = "system", reason: str = None):
        route = self.get_route(route_id)
        old_status = route.status
        
        if not self._is_valid_status_transition(old_status, new_status):
            raise InvalidStatusTransitionException("Route", old_status.value, new_status.value)
        
        diff_before = {"status": old_status.value}
        diff_after = {"status": new_status.value}
        
        route.status = new_status
        if new_status == RouteStatus.IN_PROGRESS:
            route.started_at = datetime.utcnow()
        elif new_status in [RouteStatus.COMPLETED, RouteStatus.PARTIALLY_COMPLETED]:
            route.completed_at = datetime.utcnow()
        
        history = RouteHistory(
            route_id=route.id,
            status_from=old_status.value,
            status_to=new_status.value,
            operator=operator,
            diff_before=json.dumps(diff_before),
            diff_after=json.dumps(diff_after),
            reason=reason or f"Status changed to {new_status.value}"
        )
        self.db.add(history)
        
        self.db.commit()
        self.db.refresh(route)
        return route

    def update_route(self, route_id: str, update_data: RouteUpdate, operator: str = "system") -> Route:
        route = self.get_route(route_id)
        
        diff_before = {}
        diff_after = {}
        
        if update_data.operator is not None:
            diff_before["operator"] = route.operator
            diff_after["operator"] = update_data.operator
            route.operator = update_data.operator
        
        if update_data.vehicle_id is not None:
            diff_before["vehicle_id"] = route.vehicle_id
            diff_after["vehicle_id"] = update_data.vehicle_id
            route.vehicle_id = update_data.vehicle_id
        
        if update_data.scheduled_date is not None:
            diff_before["scheduled_date"] = route.scheduled_date.isoformat()
            diff_after["scheduled_date"] = update_data.scheduled_date.isoformat()
            route.scheduled_date = update_data.scheduled_date
        
        if update_data.status is not None:
            return self.update_route_status(route_id, update_data.status, operator)
        
        if diff_before:
            history = RouteHistory(
                route_id=route.id,
                status_from=route.status.value,
                status_to=route.status.value,
                operator=operator,
                diff_before=json.dumps(diff_before),
                diff_after=json.dumps(diff_after),
                reason="Route updated manually"
            )
            self.db.add(history)
        
        self.db.commit()
        self.db.refresh(route)
        return route

    def get_route_detail(self, route_id: str) -> RouteDetail:
        route = self.get_route(route_id)
        
        tasks_detail = []
        for task in route.tasks:
            machine = self.db.query(Machine).filter(Machine.id == task.machine_id).first()
            items_detail = []
            for item in task.items:
                product = self.db.query(Product).filter(Product.id == item.product_id).first()
                items_detail.append({
                    "product_id": item.product_id,
                    "product_name": product.name if product else item.product_id,
                    "item_type": item.item_type,
                    "requested_quantity": item.requested_quantity,
                    "actual_quantity": item.actual_quantity
                })
            
            tasks_detail.append({
                "task_id": task.id,
                "machine_id": task.machine_id,
                "machine_name": machine.name if machine else task.machine_id,
                "machine_location": machine.location if machine else None,
                "status": task.status.value,
                "priority": task.priority,
                "items": items_detail,
                "history": [
                    {
                        "status_from": h.status_from,
                        "status_to": h.status_to,
                        "operator": h.operator,
                        "reason": h.reason,
                        "created_at": h.created_at
                    }
                    for h in task.history
                ]
            })
        
        return RouteDetail(
            route_id=route.id,
            route_name=route.name,
            status=route.status,
            total_capacity=route.total_capacity,
            used_capacity=route.used_capacity,
            remaining_capacity=route.total_capacity - route.used_capacity,
            operator=route.operator,
            scheduled_date=route.scheduled_date,
            tasks=tasks_detail
        )

    def _calculate_task_capacity(self, task: RestockTask) -> int:
        total = 0
        for item in task.items:
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            unit_volume = product.unit_volume if product else 1
            total += item.requested_quantity * unit_volume
        return total

    def _is_valid_status_transition(self, current: RouteStatus, new: RouteStatus) -> bool:
        valid_transitions = {
            RouteStatus.PLANNED: [RouteStatus.DISPATCHED, RouteStatus.CANCELLED],
            RouteStatus.DISPATCHED: [RouteStatus.IN_PROGRESS, RouteStatus.CANCELLED],
            RouteStatus.IN_PROGRESS: [RouteStatus.COMPLETED, RouteStatus.PARTIALLY_COMPLETED]
        }
        return new in valid_transitions.get(current, [])

    def get_routes_for_day(self, report_date: datetime) -> List[Route]:
        return self.db.query(Route).filter(
            and_(
                Route.scheduled_date >= report_date.replace(hour=0, minute=0, second=0),
                Route.scheduled_date <= report_date.replace(hour=23, minute=59, second=59)
            )
        ).all()
