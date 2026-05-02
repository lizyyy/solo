"""规则校验器模块"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set, Tuple
from collections import defaultdict

from .config import Config
from .store import (
    InspectionRecord, TreatmentRecord, HarvestRecord, 
    QuarantineRecord, DataStore
)


@dataclass
class ValidationError:
    """校验错误"""
    error_code: str
    error_message: str
    record_data: Dict[str, Any]
    severity: str = "error"


@dataclass
class ValidationResult:
    """校验结果"""
    record_id: str
    is_valid: bool
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)


class RecordValidator:
    """记录校验器"""
    
    def __init__(self, config: Config, data_store: DataStore):
        self.config = config
        self.data_store = data_store
        
    def validate_inspection(self, record: InspectionRecord) -> ValidationResult:
        """校验巡检记录"""
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []
        
        if not self.config.hive_exists(record.hive_number):
            errors.append(ValidationError(
                error_code="HIVE_NOT_FOUND",
                error_message=f"箱号 '{record.hive_number}' 未在配置中登记",
                record_data=record.to_dict(),
                severity="error"
            ))
        
        if self.data_store.inspection_exists(record.record_id):
            errors.append(ValidationError(
                error_code="DUPLICATE_RECORD",
                error_message=f"巡检记录已存在 (record_id: {record.record_id})",
                record_data=record.to_dict(),
                severity="error"
            ))
        
        return ValidationResult(
            record_id=record.record_id,
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def validate_treatment(self, record: TreatmentRecord) -> ValidationResult:
        """校验用药/饲喂记录"""
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []
        
        if not self.config.hive_exists(record.hive_number):
            errors.append(ValidationError(
                error_code="HIVE_NOT_FOUND",
                error_message=f"箱号 '{record.hive_number}' 未在配置中登记",
                record_data=record.to_dict(),
                severity="error"
            ))
        
        if record.treatment_type == "用药":
            if not self.config.drug_exists(record.product_name):
                errors.append(ValidationError(
                    error_code="DRUG_NOT_REGISTERED",
                    error_message=f"药物 '{record.product_name}' 未在配置中登记",
                    record_data=record.to_dict(),
                    severity="error"
                ))
        
        if self.data_store.treatment_exists(record.record_id):
            errors.append(ValidationError(
                error_code="DUPLICATE_RECORD",
                error_message=f"用药记录已存在 (record_id: {record.record_id})",
                record_data=record.to_dict(),
                severity="error"
            ))
        
        return ValidationResult(
            record_id=record.record_id,
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def validate_harvest(self, record: HarvestRecord) -> ValidationResult:
        """校验摇蜜记录"""
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []
        
        if not self.config.hive_exists(record.hive_number):
            errors.append(ValidationError(
                error_code="HIVE_NOT_FOUND",
                error_message=f"箱号 '{record.hive_number}' 未在配置中登记",
                record_data=record.to_dict(),
                severity="error"
            ))
        
        if self.data_store.harvest_exists(record.record_id):
            errors.append(ValidationError(
                error_code="DUPLICATE_RECORD",
                error_message=f"摇蜜记录已存在 (record_id: {record.record_id})",
                record_data=record.to_dict(),
                severity="error"
            ))
        
        if record.moisture_content is not None:
            if record.moisture_content > self.config.moisture_threshold:
                warnings.append(ValidationError(
                    error_code="MOISTURE_HIGH",
                    error_message=f"含水率 {record.moisture_content}% 超过阈值 {self.config.moisture_threshold}%",
                    record_data=record.to_dict(),
                    severity="warning"
                ))
        
        safety_error = self._check_safety_interval(record)
        if safety_error:
            errors.append(safety_error)
        
        return ValidationResult(
            record_id=record.record_id,
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def _check_safety_interval(self, harvest: HarvestRecord) -> Optional[ValidationError]:
        """检查安全间隔"""
        harvest_date = datetime.strptime(harvest.date, "%Y-%m-%d")
        
        treatments = self.data_store.get_treatments_by_hive(harvest.hive_number)
        
        for treatment in treatments:
            if treatment.treatment_type != "用药":
                continue
            
            drug = self.config.get_drug(treatment.product_name)
            if not drug:
                continue
            
            treatment_date = datetime.strptime(treatment.date, "%Y-%m-%d")
            safety_end_date = treatment_date + timedelta(days=drug.safety_interval_days)
            
            if harvest_date < safety_end_date:
                days_remaining = (safety_end_date - harvest_date).days
                return ValidationError(
                    error_code="SAFETY_INTERVAL_VIOLATION",
                    error_message=f"用药后安全间隔未过: 药物 '{treatment.product_name}' "
                                 f"安全间隔 {drug.safety_interval_days} 天, "
                                 f"应在 {safety_end_date.strftime('%Y-%m-%d')} 后才能采蜜, "
                                 f"提前了 {days_remaining} 天",
                    record_data=harvest.to_dict(),
                    severity="error"
                )
        
        return None


class BatchValidator:
    """批量校验器"""
    
    def __init__(self, config: Config, data_store: DataStore):
        self.config = config
        self.data_store = data_store
        self.record_validator = RecordValidator(config, data_store)
    
    def validate_inspections(
        self, 
        records: List[InspectionRecord],
        check_date_order: bool = True
    ) -> Tuple[List[InspectionRecord], List[ValidationError]]:
        """批量校验巡检记录"""
        valid_records: List[InspectionRecord] = []
        all_errors: List[ValidationError] = []
        
        if check_date_order and records:
            order_errors = self._check_date_order([r.date for r in records], "巡检")
            all_errors.extend(order_errors)
        
        for record in records:
            result = self.record_validator.validate_inspection(record)
            if result.is_valid:
                valid_records.append(record)
            else:
                all_errors.extend(result.errors)
        
        return valid_records, all_errors
    
    def validate_treatments(
        self, 
        records: List[TreatmentRecord],
        check_date_order: bool = True
    ) -> Tuple[List[TreatmentRecord], List[ValidationError]]:
        """批量校验用药记录"""
        valid_records: List[TreatmentRecord] = []
        all_errors: List[ValidationError] = []
        
        if check_date_order and records:
            order_errors = self._check_date_order([r.date for r in records], "用药")
            all_errors.extend(order_errors)
        
        for record in records:
            result = self.record_validator.validate_treatment(record)
            if result.is_valid:
                valid_records.append(record)
            else:
                all_errors.extend(result.errors)
        
        return valid_records, all_errors
    
    def validate_harvests(
        self, 
        records: List[HarvestRecord],
        check_date_order: bool = True,
        check_batch_moisture: bool = True
    ) -> Tuple[List[HarvestRecord], List[ValidationError]]:
        """批量校验摇蜜记录"""
        valid_records: List[HarvestRecord] = []
        all_errors: List[ValidationError] = []
        
        if check_date_order and records:
            order_errors = self._check_date_order([r.date for r in records], "摇蜜")
            all_errors.extend(order_errors)
        
        if check_batch_moisture and records:
            batch_errors = self._check_batch_moisture_consistency(records)
            all_errors.extend(batch_errors)
        
        for record in records:
            result = self.record_validator.validate_harvest(record)
            if result.is_valid:
                valid_records.append(record)
            else:
                all_errors.extend(result.errors)
        
        return valid_records, all_errors
    
    def _check_date_order(self, dates: List[str], record_type: str) -> List[ValidationError]:
        """检查日期是否按时间顺序（非倒序）"""
        errors: List[ValidationError] = []
        
        for i in range(1, len(dates)):
            current = datetime.strptime(dates[i], "%Y-%m-%d")
            previous = datetime.strptime(dates[i-1], "%Y-%m-%d")
            
            if current < previous:
                errors.append(ValidationError(
                    error_code="DATE_OUT_OF_ORDER",
                    error_message=f"{record_type}记录日期倒序: 第 {i+1} 行日期 {dates[i]} "
                                 f"早于第 {i} 行日期 {dates[i-1]}",
                    record_data={"dates": dates},
                    severity="warning"
                ))
        
        return errors
    
    def _check_batch_moisture_consistency(self, records: List[HarvestRecord]) -> List[ValidationError]:
        """检查同批次含水率一致性"""
        errors: List[ValidationError] = []
        
        batch_records: Dict[str, List[HarvestRecord]] = defaultdict(list)
        for record in records:
            if record.moisture_content is not None:
                batch_records[record.batch_number].append(record)
        
        existing_harvests = self.data_store.get_all_harvests()
        for harvest in existing_harvests:
            if harvest.moisture_content is not None:
                batch_records[harvest.batch_number].append(harvest)
        
        for batch_number, batch_list in batch_records.items():
            if len(batch_list) < 2:
                continue
            
            moistures = [r.moisture_content for r in batch_list if r.moisture_content is not None]
            if not moistures:
                continue
            
            avg_moisture = sum(moistures) / len(moistures)
            max_deviation = max(abs(m - avg_moisture) for m in moistures)
            
            if max_deviation > 2.0:
                errors.append(ValidationError(
                    error_code="BATCH_MOISTURE_INCONSISTENT",
                    error_message=f"批次 '{batch_number}' 含水率差异过大: "
                                 f"平均 {avg_moisture:.1f}%, 最大偏差 {max_deviation:.1f}%",
                    record_data={
                        "batch_number": batch_number,
                        "moistures": moistures,
                        "average": avg_moisture,
                        "max_deviation": max_deviation
                    },
                    severity="warning"
                ))
        
        return errors


def create_quarantine_record(
    original_data: Dict[str, Any],
    error_message: str,
    record_type: str,
    import_source: Optional[str] = None
) -> QuarantineRecord:
    """创建隔离记录"""
    import uuid
    return QuarantineRecord(
        quarantine_id=f"q_{uuid.uuid4().hex[:12]}",
        original_data=original_data,
        error_reason=error_message,
        record_type=record_type,
        import_source=import_source,
    )
