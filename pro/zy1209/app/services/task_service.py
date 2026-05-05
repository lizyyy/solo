from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import (
    AnalysisTask, InputSnapshot, DiagnosisResult, ExportRecord,
    TaskStatus, AnalysisType, SeverityLevel
)
from ..exceptions import (
    TaskNotFoundException, TaskAlreadyRunningException,
    InvalidInputException, SnapshotNotFoundException
)
from ..schemas import TaskCreate, TaskUpdate, InputSnapshotCreate


class TaskService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_task(self, task_data: TaskCreate) -> AnalysisTask:
        task = AnalysisTask(
            name=task_data.name,
            description=task_data.description,
            status=TaskStatus.PENDING,
            config=task_data.config
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task
    
    def get_task(self, task_id: int) -> AnalysisTask:
        task = self.db.query(AnalysisTask).filter(AnalysisTask.id == task_id).first()
        if not task:
            raise TaskNotFoundException(task_id)
        return task
    
    def list_tasks(
        self,
        skip: int = 0,
        limit: int = 100,
        status: Optional[TaskStatus] = None
    ) -> tuple[List[AnalysisTask], int]:
        query = self.db.query(AnalysisTask)
        if status:
            query = query.filter(AnalysisTask.status == status)
        
        total = query.count()
        tasks = query.order_by(AnalysisTask.created_at.desc()).offset(skip).limit(limit).all()
        return tasks, total
    
    def update_task(self, task_id: int, task_data: TaskUpdate) -> AnalysisTask:
        task = self.get_task(task_id)
        
        update_data = task_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(task, key, value)
        
        task.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(task)
        return task
    
    def delete_task(self, task_id: int) -> bool:
        task = self.get_task(task_id)
        self.db.delete(task)
        self.db.commit()
        return True
    
    def add_snapshot(self, task_id: int, snapshot_data: InputSnapshotCreate) -> InputSnapshot:
        task = self.get_task(task_id)
        
        valid_types = ["db_profile", "schema_sql", "slow_sql_log", "batch_write_sample"]
        if snapshot_data.snapshot_type not in valid_types:
            raise InvalidInputException(
                f"无效的快照类型: {snapshot_data.snapshot_type}，有效值: {valid_types}"
            )
        
        snapshot = InputSnapshot(
            task_id=task_id,
            snapshot_type=snapshot_data.snapshot_type,
            content=snapshot_data.content,
            snapshot_metadata=snapshot_data.metadata
        )
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot
    
    def get_snapshots(self, task_id: int) -> List[InputSnapshot]:
        task = self.get_task(task_id)
        return task.input_snapshots
    
    def get_snapshot(self, snapshot_id: int) -> InputSnapshot:
        snapshot = self.db.query(InputSnapshot).filter(InputSnapshot.id == snapshot_id).first()
        if not snapshot:
            raise SnapshotNotFoundException(snapshot_id)
        return snapshot
    
    def update_task_status(
        self,
        task_id: int,
        status: TaskStatus,
        error_message: Optional[str] = None
    ) -> AnalysisTask:
        task = self.get_task(task_id)
        
        if status == TaskStatus.RUNNING and task.status == TaskStatus.RUNNING:
            raise TaskAlreadyRunningException(task_id)
        
        task.status = status
        
        if status == TaskStatus.RUNNING:
            task.started_at = datetime.utcnow()
        
        if status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
            task.completed_at = datetime.utcnow()
            if error_message:
                task.error_message = error_message
        
        task.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(task)
        return task
    
    def get_task_results(self, task_id: int) -> List[DiagnosisResult]:
        task = self.get_task(task_id)
        return task.results
    
    def get_task_exports(self, task_id: int) -> List[ExportRecord]:
        task = self.get_task(task_id)
        return task.export_records
    
    def get_task_inputs(self, task_id: int) -> Dict[str, Any]:
        task = self.get_task(task_id)
        snapshots = task.input_snapshots
        
        inputs = {}
        for snapshot in snapshots:
            inputs[snapshot.snapshot_type] = {
                "content": snapshot.content,
                "metadata": snapshot.snapshot_metadata,
                "file_path": snapshot.file_path
            }
        
        return inputs
