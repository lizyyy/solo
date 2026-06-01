from dataclasses import dataclass, field
from typing import List, Dict, Optional, Callable
from collections import defaultdict
from datetime import datetime
import json

from .queue_model import QueueResult, MMcQueueModel
from .data_validator import ValidationResult, ValidationIssue


@dataclass
class CalculationRecord:
    record_id: str
    input_params: Dict
    result: Optional[QueueResult]
    validation_issues: List[ValidationIssue] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)
    filter_applied: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            'record_id': self.record_id,
            'input_params': self.input_params,
            'result': {
                'success': self.result.success if self.result else False,
                'error_reason': self.result.error_reason if self.result else None,
                'rho': self.result.rho if self.result else None,
                'Lq': self.result.Lq if self.result else None,
                'L': self.result.L if self.result else None,
                'Wq': self.result.Wq if self.result else None,
                'W': self.result.W if self.result else None,
                'P_wait': self.result.P_wait if self.result else None,
                'requires_manual_review': self.result.requires_manual_review if self.result else False,
                'review_notes': self.result.review_notes if self.result else None,
                'legacy_calculation': self.result.legacy_calculation if self.result else False,
                'source': self.result.source if self.result else None,
                'calculation_method': self.result.calculation_method if self.result else None
            } if self.result else None,
            'validation_issues': [
                {
                    'issue_type': i.issue_type,
                    'severity': i.severity,
                    'message': i.message,
                    'field_name': i.field_name
                } for i in self.validation_issues
            ],
            'timestamp': self.timestamp.isoformat(),
            'filter_applied': self.filter_applied
        }


class ResultTracker:
    """
    结果追溯和异常记录系统
    确保每条记录都能追到来源，算不出来的记录留下原因
    """
    
    def __init__(self):
        self.records: Dict[str, CalculationRecord] = {}
        self.calculation_log: List[CalculationRecord] = []
        self.exception_records: List[str] = []
        self.manual_review_records: List[str] = []
        self.legacy_records: List[str] = []
    
    def process_records(self, input_records: List[Dict], 
                        validation_result: ValidationResult,
                        filter_condition: Optional[str] = None) -> List[QueueResult]:
        """
        处理一批记录，执行计算并跟踪结果
        """
        results = []
        
        for input_record in input_records:
            record_id = input_record.get('record_id', 'UNKNOWN')
            calc_record = self._process_single_record(
                input_record, 
                validation_result,
                filter_condition
            )
            self.records[record_id] = calc_record
            self.calculation_log.append(calc_record)
            
            if calc_record.result:
                results.append(calc_record.result)
                
                if not calc_record.result.success:
                    if record_id not in self.exception_records:
                        self.exception_records.append(record_id)
                if calc_record.result.requires_manual_review:
                    if record_id not in self.manual_review_records:
                        self.manual_review_records.append(record_id)
                if calc_record.result.legacy_calculation:
                    if record_id not in self.legacy_records:
                        self.legacy_records.append(record_id)
        
        return results
    
    def _process_single_record(self, input_record: Dict,
                               validation_result: ValidationResult,
                               filter_condition: Optional[str]) -> CalculationRecord:
        """
        处理单条记录
        """
        record_id = input_record.get('record_id', 'UNKNOWN')
        source = input_record.get('source', '未知来源')
        legacy_mode_raw = input_record.get('legacy_mode', False)
        legacy_mode = str(legacy_mode_raw).lower() in ('true', '1', 'yes')
        
        record_issues = [i for i in validation_result.issues if i.record_id == record_id]
        
        has_errors = any(i.severity == 'error' for i in record_issues)
        
        if has_errors:
            result = QueueResult(
                record_id=record_id,
                source=source,
                calculation_method='M/M/c排队模型',
                success=False,
                error_reason='; '.join([i.message for i in record_issues if i.severity == 'error'])
            )
        else:
            try:
                arrival_rate = float(input_record['arrival_rate'])
                service_rate = float(input_record['service_rate'])
                num_servers = int(input_record['num_servers'])
                
                result = MMcQueueModel.calculate(
                    record_id=record_id,
                    source=source,
                    arrival_rate=arrival_rate,
                    service_rate=service_rate,
                    num_servers=num_servers,
                    legacy_mode=legacy_mode
                )
            except Exception as e:
                result = QueueResult(
                    record_id=record_id,
                    source=source,
                    calculation_method='M/M/c排队模型',
                    success=False,
                    error_reason=f'参数解析或计算异常: {str(e)}'
                )
        
        return CalculationRecord(
            record_id=record_id,
            input_params=input_record,
            result=result,
            validation_issues=record_issues,
            filter_applied=filter_condition
        )
    
    def get_statistics(self) -> Dict:
        """
        获取统计信息
        """
        total = len(self.calculation_log)
        success = sum(1 for r in self.records.values() if r.result and r.result.success)
        failed = total - success
        
        return {
            'total_records': total,
            'success_count': success,
            'failed_count': failed,
            'exception_count': len(self.exception_records),
            'manual_review_count': len(self.manual_review_records),
            'legacy_count': len(self.legacy_records),
            'exception_records': self.exception_records,
            'manual_review_records': self.manual_review_records,
            'legacy_records': self.legacy_records
        }
    
    def get_record_trace(self, record_id: str) -> Optional[Dict]:
        """
        获取单条记录的完整追溯信息
        """
        if record_id not in self.records:
            return None
        
        record = self.records[record_id]
        return {
            'record_id': record_id,
            'input_params': record.input_params,
            'source': record.result.source if record.result else '未知',
            'calculation_method': record.result.calculation_method if record.result else '未知',
            'success': record.result.success if record.result else False,
            'error_reason': record.result.error_reason if record.result else None,
            'validation_issues': [i.message for i in record.validation_issues],
            'timestamp': record.timestamp.isoformat(),
            'filter_applied': record.filter_applied
        }
    
    def export_to_json(self, filepath: str) -> None:
        """导出完整追溯信息到JSON"""
        export_data = {
            'export_time': datetime.now().isoformat(),
            'statistics': self.get_statistics(),
            'records': [r.to_dict() for r in self.records.values()]
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
    
    def filter_records(self, condition: Callable[[CalculationRecord], bool]) -> List[CalculationRecord]:
        """
        按条件筛选记录
        """
        return [r for r in self.records.values() if condition(r)]
    
    def clear(self) -> None:
        """清空所有记录"""
        self.records.clear()
        self.calculation_log.clear()
        self.exception_records.clear()
        self.manual_review_records.clear()
        self.legacy_records.clear()
