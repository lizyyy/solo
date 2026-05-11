from typing import List, Dict, Any, Optional
from datetime import datetime, date, time
from models.data_models import (
    SalesRecord,
    TrainInfo,
    MealItem,
    RecordHistory,
    RecordStatus
)
import uuid
import copy

class DataProcessor:
    def __init__(self):
        self.trains: Dict[str, TrainInfo] = {}
        self.meals: Dict[str, MealItem] = {}
        self.sales_records: Dict[str, SalesRecord] = {}
        self.history: Dict[str, List[RecordHistory]] = {}
    
    def register_train(self, train: TrainInfo) -> None:
        self.trains[train.train_id] = train
    
    def register_meal(self, meal: MealItem) -> None:
        self.meals[meal.meal_id] = meal
    
    def add_sales_record(self, record: SalesRecord, actor: str = "system", reason: Optional[str] = None) -> None:
        existing = self.sales_records.get(record.record_id)
        if existing:
            self._record_history(
                record_id=record.record_id,
                action="update",
                actor=actor,
                before=copy.deepcopy(existing.__dict__),
                after=copy.deepcopy(record.__dict__),
                reason=reason or "更新销售记录"
            )
        
        self.sales_records[record.record_id] = record
        self._ensure_history(record.record_id)
        self._record_history(
            record_id=record.record_id,
            action="create" if not existing else "update",
            actor=actor,
            before=copy.deepcopy(record.__dict__),
            reason=reason or "创建销售记录"
        )
    
    def withdraw_record(self, record_id: str, actor: str, reason: str) -> Optional[SalesRecord]:
        if record_id not in self.sales_records:
            return None
        
        record = self.sales_records[record_id]
        before = copy.deepcopy(record.__dict__)
        
        record.status = RecordStatus.WITHDRAWN
        record.recorded_at = datetime.now()
        record.recorded_by = actor
        record.notes = f"撤回原因: {reason}"
        
        self._ensure_history(record_id)
        self._record_history(
            record_id=record_id,
            action="withdraw",
            actor=actor,
            before=before,
            after=copy.deepcopy(record.__dict__),
            reason=reason
        )
        
        return record
    
    def supplement_record(self, record_id: str, updates: Dict[str, Any], actor: str, reason: str) -> Optional[SalesRecord]:
        if record_id not in self.sales_records:
            return None
        
        record = self.sales_records[record_id]
        before = copy.deepcopy(record.__dict__)
        
        for key, value in updates.items():
            if hasattr(record, key):
                setattr(record, key, value)
        
        record.status = RecordStatus.SUPPLEMENTED
        record.version += 1
        record.recorded_at = datetime.now()
        record.recorded_by = actor
        
        self._ensure_history(record_id)
        self._record_history(
            record_id=record_id,
            action="supplement",
            actor=actor,
            before=before,
            after=copy.deepcopy(record.__dict__),
            reason=reason
        )
        
        return record
    
    def modify_record(self, record_id: str, updates: Dict[str, Any], actor: str, reason: str) -> Optional[SalesRecord]:
        if record_id not in self.sales_records:
            return None
        
        record = self.sales_records[record_id]
        before = copy.deepcopy(record.__dict__)
        
        for key, value in updates.items():
            if hasattr(record, key):
                setattr(record, key, value)
        
        record.status = RecordStatus.MODIFIED
        record.version += 1
        record.recorded_at = datetime.now()
        record.recorded_by = actor
        
        self._ensure_history(record_id)
        self._record_history(
            record_id=record_id,
            action="modify",
            actor=actor,
            before=before,
            after=copy.deepcopy(record.__dict__),
            reason=reason
        )
        
        return record
    
    def get_record_history(self, record_id: str) -> List[RecordHistory]:
        return self.history.get(record_id, [])
    
    def get_all_records(self, include_withdrawn: bool = False) -> List[SalesRecord]:
        if include_withdrawn:
            return list(self.sales_records.values())
        return [r for r in self.sales_records.values() if r.status != RecordStatus.WITHDRAWN]
    
    def get_records_by_train(self, train_id: str) -> List[SalesRecord]:
        return [r for r in self.sales_records.values() 
            if r.train_id == train_id and r.status != RecordStatus.WITHDRAWN]
    
    def get_records_by_meal(self, meal_id: str) -> List[SalesRecord]:
        return [r for r in self.sales_records.values() 
            if r.meal_id == meal_id and r.status != RecordStatus.WITHDRAWN]
    
    def _ensure_history(self, record_id: str) -> None:
        if record_id not in self.history:
            self.history[record_id] = []
    
    def _record_history(
        self,
        record_id: str,
        action: str,
        actor: str,
        before: Optional[Dict[str, Any]],
        after: Optional[Dict[str, Any]] = None,
        reason: Optional[str] = None
    ) -> None:
        history_entry = RecordHistory(
            history_id=str(uuid.uuid4())[:8],
            record_id=record_id,
            action=action,
            timestamp=datetime.now(),
            actor=actor,
            before=before,
            after=after,
            reason=reason
        )
        self.history[record_id].append(history_entry)
