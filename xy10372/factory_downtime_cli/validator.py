"""
数据验证模块
"""

from datetime import datetime, date
from typing import Dict, List, Any
from collections import defaultdict

from .models import (
    DataStore, ChangeoverRecord, AbnormalDowntime, ProductionRecord,
    ProductionPlan, RecordStatus
)
from .utils import is_overlap


class DataValidator:
    """数据验证器"""
    
    def __init__(self, store: DataStore):
        self.store = store
    
    def validate_all(self) -> Dict[str, Any]:
        """验证所有数据"""
        results = {
            "plans": self._validate_plans(),
            "changeovers": self._validate_changeovers(),
            "abnormal_downtimes": self._validate_abnormal_downtimes(),
            "productions": self._validate_productions()
        }
        return results
    
    def _validate_plans(self) -> Dict[str, Any]:
        """验证生产计划"""
        issues = []
        valid_count = 0
        total_count = len(self.store.plans)
        
        for plan_id, plan in self.store.plans.items():
            if plan.planned_end <= plan.planned_start:
                issues.append(f"计划[{plan_id}]结束时间早于或等于开始时间")
            else:
                valid_count += 1
        
        return {
            "total": total_count,
            "valid": valid_count,
            "issues": issues
        }
    
    def _validate_changeovers(self) -> Dict[str, Any]:
        """验证换模记录"""
        issues = []
        stats = defaultdict(int)
        total_count = len(self.store.changeovers)
        
        machine_records = defaultdict(list)
        for record in self.store.changeovers.values():
            machine_records[record.machine_id].append(record)
        
        for machine_id, records in machine_records.items():
            valid_records = [r for r in records if r.status == RecordStatus.VALID]
            stats[RecordStatus.VALID.value] += len(valid_records)
            
            for record in records:
                stats[record.status.value] += 1
                if record.status == RecordStatus.DUPLICATE:
                    issues.append(f"换模记录[{record.record_id}]是重复记录，已忽略")
                elif record.status == RecordStatus.INVALID_TIME:
                    issues.append(f"换模记录[{record.record_id}]结束时间早于开始时间，待复核")
                elif record.status == RecordStatus.OVERLAP:
                    issues.append(f"换模记录[{record.record_id}]与其他记录时间重叠，待复核")
        
        valid_count = stats.get(RecordStatus.VALID.value, 0)
        
        return {
            "total": total_count,
            "valid": valid_count,
            "status_stats": dict(stats),
            "issues": issues
        }
    
    def _validate_abnormal_downtimes(self) -> Dict[str, Any]:
        """验证异常停机记录"""
        issues = []
        stats = defaultdict(int)
        total_count = len(self.store.abnormal_downtimes)
        
        for record in self.store.abnormal_downtimes.values():
            stats[record.status.value] += 1
            if record.status == RecordStatus.DUPLICATE:
                issues.append(f"异常停机记录[{record.record_id}]是重复记录，已忽略")
            elif record.status == RecordStatus.INVALID_TIME:
                issues.append(f"异常停机记录[{record.record_id}]结束时间早于开始时间，待复核")
            elif record.status == RecordStatus.OVERLAP:
                issues.append(f"异常停机记录[{record.record_id}]与其他记录时间重叠，待复核")
        
        valid_count = stats.get(RecordStatus.VALID.value, 0)
        
        return {
            "total": total_count,
            "valid": valid_count,
            "status_stats": dict(stats),
            "issues": issues
        }
    
    def _validate_productions(self) -> Dict[str, Any]:
        """验证产量记录"""
        issues = []
        stats = defaultdict(int)
        total_count = len(self.store.productions)
        
        for record in self.store.productions.values():
            stats[record.status.value] += 1
            if record.status == RecordStatus.DUPLICATE:
                issues.append(f"产量记录[{record.record_id}]是重复记录，已忽略")
            elif record.status == RecordStatus.NO_PLAN:
                issues.append(f"产量记录[{record.record_id}]无对应生产计划，待复核")
        
        valid_count = stats.get(RecordStatus.VALID.value, 0)
        
        return {
            "total": total_count,
            "valid": valid_count,
            "status_stats": dict(stats),
            "issues": issues
        }
    
    def get_pending_review_records(self) -> Dict[str, List[Any]]:
        """获取所有待复核的记录"""
        pending = {
            "changeovers": [],
            "abnormal_downtimes": [],
            "productions": []
        }
        
        for record in self.store.changeovers.values():
            if record.status != RecordStatus.VALID:
                pending["changeovers"].append(record)
        
        for record in self.store.abnormal_downtimes.values():
            if record.status != RecordStatus.VALID:
                pending["abnormal_downtimes"].append(record)
        
        for record in self.store.productions.values():
            if record.status != RecordStatus.VALID:
                pending["productions"].append(record)
        
        return pending
    
    def check_cross_overlaps(self) -> List[str]:
        """检查换模和异常停机之间的交叉重叠"""
        overlaps = []
        
        changeovers = [r for r in self.store.changeovers.values() 
                      if r.status == RecordStatus.VALID]
        downtimes = [r for r in self.store.abnormal_downtimes.values()
                    if r.status == RecordStatus.VALID]
        
        for co in changeovers:
            for dt in downtimes:
                if co.machine_id == dt.machine_id:
                    if is_overlap(co.start_time, co.end_time, 
                                 dt.start_time, dt.end_time):
                        overlaps.append(
                            f"机台[{co.machine_id}]换模记录[{co.record_id}]与"
                            f"异常停机记录[{dt.record_id}]时间重叠，请核查"
                        )
        
        return overlaps
