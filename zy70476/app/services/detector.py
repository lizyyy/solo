import uuid
import time
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional
from app.models.schemas import (
    LakePartition, DetectionRule, DetectionResult, DetectionStatus,
    BatchRecord, FailedItem, RuleType, ComparisonItem, ReportData
)
from app.models.store import store


class PartitionDetector:
    def __init__(self):
        pass
    
    def detect_partition(self, partition: LakePartition, rule: DetectionRule) -> Tuple[DetectionStatus, Dict[str, Any], List[str]]:
        try:
            conditions = rule.conditions
            details = {}
            suggestions = []
            
            details["partition_id"] = partition.id
            details["rule_applied"] = rule.rule_id
            details["rule_version"] = rule.version
            
            record_check = self._check_record_count(partition, conditions, details, suggestions)
            size_check = self._check_file_size(partition, conditions, details, suggestions)
            date_check = self._check_data_date(partition, conditions, details, suggestions)
            
            all_checks = [record_check, size_check, date_check]
            
            if all(all_checks):
                status = DetectionStatus.PASS
            elif any(c == False for c in all_checks):
                status = DetectionStatus.FAIL
            else:
                status = DetectionStatus.WARNING
            
            details["check_results"] = {
                "record_count": record_check,
                "file_size": size_check,
                "data_date": date_check
            }
            
            return status, details, suggestions
            
        except Exception as e:
            raise Exception(f"检测分区时出错: {str(e)}")
    
    def _check_record_count(self, partition: LakePartition, conditions: Dict, details: Dict, suggestions: List[str]) -> Optional[bool]:
        min_count = conditions.get("min_record_count")
        max_count = conditions.get("max_record_count")
        
        details["record_count"] = partition.record_count
        
        if partition.record_count == 0:
            suggestions.append("分区记录数为0，请检查数据同步是否正常")
            return False
        
        if max_count and partition.record_count > max_count:
            suggestions.append(f"记录数({partition.record_count})超过最大值阈值({max_count})")
            return None
        
        if min_count and partition.record_count < min_count:
            suggestions.append(f"记录数({partition.record_count})低于最小值阈值({min_count})")
            return None
        
        return True
    
    def _check_file_size(self, partition: LakePartition, conditions: Dict, details: Dict, suggestions: List[str]) -> Optional[bool]:
        min_size = conditions.get("min_file_size_mb")
        max_size = conditions.get("max_file_size_mb")
        
        details["file_size_mb"] = partition.file_size
        
        if max_size and partition.file_size > max_size:
            suggestions.append(f"文件大小({partition.file_size}MB)超过最大值阈值({max_size}MB)")
            return None
        
        if min_size and partition.file_size < min_size:
            suggestions.append(f"文件大小({partition.file_size}MB)低于最小值阈值({min_size}MB)")
            return None
        
        return True
    
    def _check_data_date(self, partition: LakePartition, conditions: Dict, details: Dict, suggestions: List[str]) -> Optional[bool]:
        date_tolerance = conditions.get("date_tolerance_days")
        
        if date_tolerance:
            try:
                data_date = datetime.strptime(partition.data_date, "%Y-%m-%d")
                days_diff = (datetime.now() - data_date).days
                
                details["data_date"] = partition.data_date
                details["days_since_data_date"] = days_diff
                
                if days_diff > date_tolerance:
                    suggestions.append(f"数据日期({partition.data_date})距今{days_diff}天，超过容忍阈值({date_tolerance}天)")
                    return None
            except:
                suggestions.append(f"数据日期格式错误: {partition.data_date}")
                return False
        
        return True
    
    def run_batch_detection(self, rule_type: RuleType = RuleType.NORMAL, executed_by: str = "system") -> str:
        batch_id = str(uuid.uuid4())
        start_time = time.time()
        
        rule = store.get_latest_rule(rule_type)
        if not rule:
            raise Exception(f"未找到类型为{rule_type}的启用规则")
        
        partitions = store.get_partitions()
        
        batch = BatchRecord(
            batch_id=batch_id,
            rule_version=rule.version,
            rule_type=rule_type,
            start_time=datetime.now(),
            total_count=len(partitions),
            executed_by=executed_by
        )
        store.save_batch(batch)
        
        pass_count = 0
        fail_count = 0
        warning_count = 0
        
        for partition in partitions:
            try:
                status, details, suggestions = self.detect_partition(partition, rule)
                
                result = DetectionResult(
                    batch_id=batch_id,
                    partition_id=partition.id,
                    status=status,
                    rule_id=rule.rule_id,
                    rule_version=rule.version,
                    details=details,
                    suggestions=suggestions
                )
                store.save_result(result)
                
                if status == DetectionStatus.PASS:
                    pass_count += 1
                elif status == DetectionStatus.FAIL:
                    failed_item = FailedItem(
                        batch_id=batch_id,
                        item_id=partition.id,
                        item_type="partition",
                        error_message="; ".join(suggestions) if suggestions else "检测不通过",
                        error_type="business_check_failed",
                        original_data=partition.model_dump(),
                        rule_version=rule.version
                    )
                    store.save_failed_item(failed_item)
                    fail_count += 1
                else:
                    warning_count += 1
                    
            except Exception as e:
                failed_item = FailedItem(
                    batch_id=batch_id,
                    item_id=partition.id,
                    item_type="partition",
                    error_message=str(e),
                    error_type="detection_exception",
                    original_data=partition.model_dump(),
                    rule_version=rule.version
                )
                store.save_failed_item(failed_item)
                fail_count += 1
        
        end_time = time.time()
        
        batch.end_time = datetime.now()
        batch.pass_count = pass_count
        batch.fail_count = fail_count
        batch.warning_count = warning_count
        batch.status = "completed"
        store.update_batch(batch)
        
        return batch_id


detector = PartitionDetector()
