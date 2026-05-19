from sqlalchemy.orm import Session
from app.models import ChargingTask, Forklift, ChargingPile
from app.schemas import ChargingTaskCreate, BatchResult
from app.services.rules_engine import RulesEngine
from app.services.log_service import LogService
from typing import List
import json


class TaskService:
    def __init__(self, db: Session):
        self.db = db
        self.rules_engine = RulesEngine(db)
        self.log_service = LogService(db)

    def create_task(self, task_data: ChargingTaskCreate, operator: str):
        forklift = self.db.query(Forklift).filter(Forklift.id == task_data.forklift_id).first()
        if not forklift:
            return None, "叉车不存在"
        
        pile = self.db.query(ChargingPile).filter(ChargingPile.id == task_data.charging_pile_id).first()
        if not pile:
            return None, "充电桩不存在"

        passed, rule_results = self.rules_engine.check_all_rules(task_data)
        rules_summary = self.rules_engine.get_rules_summary(rule_results)

        if not passed:
            db_task = ChargingTask(
                **task_data.dict(),
                status="rejected",
                reason=rules_summary
            )
            self.db.add(db_task)
            self.db.commit()
            self.db.refresh(db_task)
            
            self.log_service.log_task_operation(
                operation_type="create_task",
                operator=operator,
                task_id=db_task.id,
                status="rejected",
                reason=rules_summary
            )
            
            return db_task, rules_summary

        db_task = ChargingTask(
            **task_data.dict(),
            status="approved",
            reason=rules_summary
        )
        self.db.add(db_task)
        self.db.commit()
        self.db.refresh(db_task)

        self.log_service.log_task_operation(
            operation_type="create_task",
            operator=operator,
            task_id=db_task.id,
            status="approved",
            reason=rules_summary
        )

        return db_task, None

    def batch_create_tasks(self, tasks_data: List[ChargingTaskCreate], operator: str) -> BatchResult:
        successful = []
        failed = []

        for idx, task_data in enumerate(tasks_data):
            try:
                self.db.begin_nested()
                
                task, error = self.create_task(task_data, operator)
                
                if error:
                    failed.append({
                        "index": idx,
                        "forklift_id": task_data.forklift_id,
                        "charging_pile_id": task_data.charging_pile_id,
                        "error": error
                    })
                    self.db.rollback()
                else:
                    successful.append(task.id)
                    self.db.commit()
                    
            except Exception as e:
                self.db.rollback()
                failed.append({
                    "index": idx,
                    "forklift_id": task_data.forklift_id,
                    "charging_pile_id": task_data.charging_pile_id,
                    "error": str(e)
                })

        return BatchResult(
            success_count=len(successful),
            failed_count=len(failed),
            total_count=len(tasks_data),
            successful=successful,
            failed=failed
        )

    def get_tasks(
        self,
        requested_by: str = None,
        status: str = None,
        shift: str = None,
        skip: int = 0,
        limit: int = 100
    ):
        query = self.db.query(ChargingTask)
        
        if requested_by:
            query = query.filter(ChargingTask.requested_by == requested_by)
        if status:
            query = query.filter(ChargingTask.status == status)
        if shift:
            query = query.filter(ChargingTask.shift == shift)
        
        return query.order_by(ChargingTask.created_at.desc()).offset(skip).limit(limit).all()

    def get_task_by_id(self, task_id: int):
        return self.db.query(ChargingTask).filter(ChargingTask.id == task_id).first()
