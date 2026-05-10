"""
数据导入模块
"""

import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from .models import (
    ProductionPlan, ChangeoverRecord, AbnormalDowntime, ProductionRecord,
    RecordStatus, DataStore
)
from .utils import parse_datetime, generate_hash, is_overlap


class DataImporter:
    """数据导入器"""
    
    def __init__(self, store: DataStore):
        self.store = store
    
    def import_production_plans(self, file_path: Path) -> Dict[str, Any]:
        """导入生产计划"""
        results = {"total": 0, "imported": 0, "duplicates": 0, "errors": []}
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                results["total"] += 1
                try:
                    plan = ProductionPlan(
                        plan_id=row["plan_id"].strip(),
                        machine_id=row["machine_id"].strip(),
                        product_code=row["product_code"].strip(),
                        planned_start=parse_datetime(row["planned_start"]),
                        planned_end=parse_datetime(row["planned_end"]),
                        planned_quantity=int(row["planned_quantity"])
                    )
                    
                    if plan.plan_id in self.store.plans:
                        results["duplicates"] += 1
                        continue
                    
                    self.store.plans[plan.plan_id] = plan
                    results["imported"] += 1
                    
                except Exception as e:
                    results["errors"].append(f"行{reader.line_num}: {str(e)}")
        
        return results
    
    def import_changeover_records(self, file_path: Path) -> Dict[str, Any]:
        """导入换模记录"""
        results = {"total": 0, "imported": 0, "duplicates": 0, "invalid_time": 0, 
                   "overlaps": 0, "errors": []}
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                results["total"] += 1
                try:
                    start_time = parse_datetime(row["start_time"])
                    end_time = parse_datetime(row["end_time"])
                    
                    record_hash = generate_hash(
                        row["machine_id"], row["from_product"],
                        row["to_product"], start_time, end_time
                    )
                    
                    record = ChangeoverRecord(
                        record_id=f"CO{len(self.store.changeovers) + 1:04d}",
                        machine_id=row["machine_id"].strip(),
                        from_product=row["from_product"].strip(),
                        to_product=row["to_product"].strip(),
                        start_time=start_time,
                        end_time=end_time,
                        operator=row.get("operator", "").strip() or None,
                        source_hash=record_hash
                    )
                    
                    if end_time <= start_time:
                        record.status = RecordStatus.INVALID_TIME
                        results["invalid_time"] += 1
                    
                    elif record_hash in self.store.changeover_hashes:
                        record.status = RecordStatus.DUPLICATE
                        results["duplicates"] += 1
                    
                    else:
                        if self._check_overlap_with_existing(
                            record.machine_id, start_time, end_time, "changeover"
                        ):
                            record.status = RecordStatus.OVERLAP
                            results["overlaps"] += 1
                        
                        self.store.changeover_hashes[record_hash] = record.record_id
                    
                    self.store.changeovers[record.record_id] = record
                    results["imported"] += 1
                    
                except Exception as e:
                    results["errors"].append(f"行{reader.line_num}: {str(e)}")
        
        return results
    
    def import_abnormal_downtimes(self, file_path: Path) -> Dict[str, Any]:
        """导入异常停机记录"""
        results = {"total": 0, "imported": 0, "duplicates": 0, "invalid_time": 0,
                   "overlaps": 0, "errors": []}
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                results["total"] += 1
                try:
                    start_time = parse_datetime(row["start_time"])
                    end_time = parse_datetime(row["end_time"])
                    
                    record_hash = generate_hash(
                        row["machine_id"], row["downtime_type"],
                        start_time, end_time
                    )
                    
                    record = AbnormalDowntime(
                        record_id=f"AD{len(self.store.abnormal_downtimes) + 1:04d}",
                        machine_id=row["machine_id"].strip(),
                        downtime_type=row["downtime_type"].strip(),
                        start_time=start_time,
                        end_time=end_time,
                        reason=row.get("reason", "").strip(),
                        operator=row.get("operator", "").strip() or None,
                        source_hash=record_hash
                    )
                    
                    if end_time <= start_time:
                        record.status = RecordStatus.INVALID_TIME
                        results["invalid_time"] += 1
                    
                    elif record_hash in self.store.downtime_hashes:
                        record.status = RecordStatus.DUPLICATE
                        results["duplicates"] += 1
                    
                    else:
                        if self._check_overlap_with_existing(
                            record.machine_id, start_time, end_time, "downtime"
                        ):
                            record.status = RecordStatus.OVERLAP
                            results["overlaps"] += 1
                        
                        self.store.downtime_hashes[record_hash] = record.record_id
                    
                    self.store.abnormal_downtimes[record.record_id] = record
                    results["imported"] += 1
                    
                except Exception as e:
                    results["errors"].append(f"行{reader.line_num}: {str(e)}")
        
        return results
    
    def import_production_records(self, file_path: Path) -> Dict[str, Any]:
        """导入产量记录"""
        results = {"total": 0, "imported": 0, "duplicates": 0, "no_plan": 0, "errors": []}
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                results["total"] += 1
                try:
                    production_time = parse_datetime(row["production_time"])
                    
                    record_hash = generate_hash(
                        row["machine_id"], row["product_code"],
                        row["quantity"], production_time
                    )
                    
                    record = ProductionRecord(
                        record_id=f"PR{len(self.store.productions) + 1:04d}",
                        machine_id=row["machine_id"].strip(),
                        product_code=row["product_code"].strip(),
                        quantity=int(row["quantity"]),
                        production_time=production_time,
                        plan_id=row.get("plan_id", "").strip() or None,
                        source_hash=record_hash
                    )
                    
                    if record_hash in self.store.production_hashes:
                        record.status = RecordStatus.DUPLICATE
                        results["duplicates"] += 1
                    else:
                        matching_plan = self._find_matching_plan(record)
                        if not matching_plan:
                            record.status = RecordStatus.NO_PLAN
                            results["no_plan"] += 1
                        else:
                            record.plan_id = matching_plan.plan_id
                        
                        self.store.production_hashes[record_hash] = record.record_id
                    
                    self.store.productions[record.record_id] = record
                    results["imported"] += 1
                    
                except Exception as e:
                    results["errors"].append(f"行{reader.line_num}: {str(e)}")
        
        return results
    
    def _check_overlap_with_existing(self, machine_id: str, start: datetime, 
                                     end: datetime, record_type: str) -> bool:
        """检查与现有记录是否重叠"""
        if record_type == "changeover":
            for existing in self.store.changeovers.values():
                if (existing.machine_id == machine_id and 
                    existing.status == RecordStatus.VALID and
                    is_overlap(start, end, existing.start_time, existing.end_time)):
                    return True
        elif record_type == "downtime":
            for existing in self.store.abnormal_downtimes.values():
                if (existing.machine_id == machine_id and 
                    existing.status == RecordStatus.VALID and
                    is_overlap(start, end, existing.start_time, existing.end_time)):
                    return True
        return False
    
    def _find_matching_plan(self, record: ProductionRecord) -> ProductionPlan:
        """查找匹配的生产计划"""
        for plan in self.store.plans.values():
            if (plan.machine_id == record.machine_id and
                plan.product_code == record.product_code and
                plan.planned_start <= record.production_time <= plan.planned_end):
                return plan
        return None
