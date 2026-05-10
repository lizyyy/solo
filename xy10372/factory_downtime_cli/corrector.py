"""
人工修正模块
"""

from typing import Optional
from datetime import datetime

from .models import (
    DataStore, RecordStatus, ChangeoverRecord, AbnormalDowntime, ProductionRecord
)


class RecordCorrector:
    """记录修正器"""
    
    def __init__(self, store: DataStore):
        self.store = store
    
    def correct_changeover_status(self, record_id: str, 
                                 new_status: RecordStatus) -> bool:
        """修正换模记录状态"""
        if record_id not in self.store.changeovers:
            return False
        
        record = self.store.changeovers[record_id]
        record.status = new_status
        return True
    
    def correct_changeover_time(self, record_id: str,
                             start_time: Optional[datetime] = None,
                             end_time: Optional[datetime] = None) -> bool:
        """修正换模记录时间"""
        if record_id not in self.store.changeovers:
            return False
        
        record = self.store.changeovers[record_id]
        
        if start_time:
            record.start_time = start_time
        if end_time:
            record.end_time = end_time
        
        if record.end_time > record.start_time:
            record.status = RecordStatus.VALID
        
        return True
    
    def correct_downtime_status(self, record_id: str,
                                  new_status: RecordStatus) -> bool:
        """修正异常停机记录状态"""
        if record_id not in self.store.abnormal_downtimes:
            return False
        
        record = self.store.abnormal_downtimes[record_id]
        record.status = new_status
        return True
    
    def correct_downtime_time(self, record_id: str,
                               start_time: Optional[datetime] = None,
                               end_time: Optional[datetime] = None) -> bool:
        """修正异常停机记录时间"""
        if record_id not in self.store.abnormal_downtimes:
            return False
        
        record = self.store.abnormal_downtimes[record_id]
        
        if start_time:
            record.start_time = start_time
        if end_time:
            record.end_time = end_time
        
        if record.end_time > record.start_time:
            record.status = RecordStatus.VALID
        
        return True
    
    def correct_production_status(self, record_id: str,
                                  new_status: RecordStatus) -> bool:
        """修正产量记录状态"""
        if record_id not in self.store.productions:
            return False
        
        record = self.store.productions[record_id]
        record.status = new_status
        return True
    
    def correct_production_plan(self, record_id: str, plan_id: str) -> bool:
        """修正产量记录关联的计划"""
        if record_id not in self.store.productions:
            return False
        
        if plan_id not in self.store.plans:
            return False
        
        record = self.store.productions[record_id]
        record.plan_id = plan_id
        record.status = RecordStatus.VALID
        return True
    
    def delete_changeover(self, record_id: str) -> bool:
        """删除换模记录"""
        if record_id not in self.store.changeovers:
            return False
        
        record = self.store.changeovers[record_id]
        if record.source_hash in self.store.changeover_hashes:
            del self.store.changeover_hashes[record.source_hash]
        del self.store.changeovers[record_id]
        return True
    
    def delete_downtime(self, record_id: str) -> bool:
        """删除异常停机记录"""
        if record_id not in self.store.abnormal_downtimes:
            return False
        
        record = self.store.abnormal_downtimes[record_id]
        if record.source_hash in self.store.downtime_hashes:
            del self.store.downtime_hashes[record.source_hash]
        del self.store.abnormal_downtimes[record_id]
        return True
    
    def delete_production(self, record_id: str) -> bool:
        """删除产量记录"""
        if record_id not in self.store.productions:
            return False
        
        record = self.store.productions[record_id]
        if record.source_hash in self.store.production_hashes:
            del self.store.production_hashes[record.source_hash]
        del self.store.productions[record_id]
        return True
