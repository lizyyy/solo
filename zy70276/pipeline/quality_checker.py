from typing import List, Dict, Any, Optional
from datetime import datetime, date, time
from models.data_models import (
    SalesRecord,
    SampleQuality,
    QualityReport,
    RecordStatus
)
import uuid

class QualityChecker:
    def __init__(self):
        self.suspicious_sell_through_threshold_low = 0.95
        self.suspicious_sell_through_high = 0.05
        self.max_reasonable_suspicious_thresholds = {
            'units_sold_exceeds_stock': '销量大于库存',
            'negative_sell_through_too_high': '售罄率异常高（>95%）',
            'sell_through_too_low': '售罄率异常低（<5%）',
            'passenger_count_invalid': '客流数据异常',
            'time_inconsistent': '时间逻辑矛盾',
            'duplicate_record': '疑似重复记录',
            'extreme_outlier': '极端异常值',
            'missing_critical_fields': '关键字段缺失'
        }
        self.required_fields = [
            'train_id', 'train_number', 'meal_id', 'date',
            'passenger_count', 'units_sold', 'initial_stock'
        ]
    
    def check_single_record(self, record: SalesRecord) -> tuple:
        issues = []
        quality = SampleQuality.NORMAL
        
        if record.passenger_count <= 0 or record.passenger_count > 2000:
            issues.append('客流数据异常')
            quality = SampleQuality.SUSPICIOUS
        
        if record.units_sold < 0 or record.units_sold > 500:
            issues.append('销量数据异常')
            quality = SampleQuality.SUSPICIOUS
        
        if record.initial_stock <= 0 or record.initial_stock > 500:
            issues.append('库存数据异常')
            quality = SampleQuality.SUSPICIOUS
        
        if record.units_sold > record.initial_stock:
            issues.append('销量大于库存')
            quality = SampleQuality.SUSPICIOUS
        
        if record.initial_stock > 0:
            sell_through = record.units_sold / record.initial_stock
            
            if sell_through > 0.95 and not record.was_sold_out:
                issues.append('售罄率异常高（>95%）')
                quality = SampleQuality.SUSPICIOUS
            
            if sell_through < 0.05 and record.initial_stock >= 10:
                issues.append('售罄率异常低（<5%）')
                quality = SampleQuality.SUSPICIOUS
        
        if record.was_sold_out and record.sold_out_time is not None:
            if record.departure_time and record.sold_out_time < record.departure_time:
                issues.append('售罄时间早于发车时间')
                quality = SampleQuality.SUSPICIOUS
        
        return quality, issues
    
    def check_batch(self, records: List[SalesRecord]) -> QualityReport:
        normal = 0
        missing = 0
        suspicious = 0
        missing_details = []
        suspicious_details = []
        
        for record in records:
            if record.status == RecordStatus.WITHDRAWN:
                continue
                
            quality, issues = self.check_single_record(record)
            record.quality = quality
            record.quality_notes = issues
            
            if quality == SampleQuality.NORMAL:
                normal += 1
            elif quality == SampleQuality.MISSING:
                missing += 1
                missing_details.append({
                    'record_id': record.record_id,
                    'train_number': record.train_number,
                    'meal_name': record.meal_name,
                    'date': record.date,
                    'issues': issues
                })
            elif quality == SampleQuality.SUSPICIOUS:
                suspicious += 1
                suspicious_details.append({
                    'record_id': record.record_id,
                    'train_number': record.train_number,
                    'meal_name': record.meal_name,
                    'date': record.date,
                    'issues': issues
                })
        
        recommendations = []
        if missing > 0:
            recommendations.append(f"发现 {missing} 条缺失样本，建议补录关键信息")
        
        if suspicious > 0:
            recommendations.append(f"发现 {suspicious} 条疑似误录样本，建议人工复核")
        
        return QualityReport(
            report_id=str(uuid.uuid4())[:8],
            generated_at=datetime.now(),
            total_records=len(records),
            normal_samples=normal,
            missing_samples=missing,
            suspicious_samples=suspicious,
            missing_details=missing_details,
            suspicious_details=suspicious_details,
            recommendations=recommendations
        )

class DataPipeline:
    def __init__(self):
        self.quality_checker = QualityChecker()
    
    def process(self, records: List[SalesRecord]) -> Dict[str, Any]:
        quality_report = self.quality_checker.check_batch(records)
        
        normal_records = [r for r in records 
            if r.quality == SampleQuality.NORMAL 
            and r.status != RecordStatus.WITHDRAWN]
        missing_records = [r for r in records 
            if r.quality == SampleQuality.MISSING
            and r.status != RecordStatus.WITHDRAWN]
        suspicious_records = [r for r in records 
            if r.quality == SampleQuality.SUSPICIOUS
            and r.status != RecordStatus.WITHDRAWN]
        
        return {
            'quality_report': quality_report,
            'normal_records': normal_records,
            'missing_records': missing_records,
            'suspicious_records': suspicious_records
        }
