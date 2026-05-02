"""
规则引擎模块 - 执行所有校验规则
"""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Callable

from .models import (
    OrderCase, ValidationIssue, ValidationResult, OrderStatus,
    ModelFile, PostProcessingRecord
)


class ValidationRule(ABC):
    rule_name: str = ""
    description: str = ""
    severity: str = "warning"
    
    @abstractmethod
    def validate(self, case: OrderCase, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        pass


class ToothPositionFormatRule(ValidationRule):
    rule_name = "tooth_position_format"
    description = "校验牙位格式是否正确"
    severity = "critical"
    
    VALID_TOOTH_NUMBERS = set(str(i) for i in range(1, 33))
    VALID_FDI_POSITIONS = {
        f"{q}{t}" for q in ['1', '2', '3', '4'] for t in ['1', '2', '3', '4', '5', '6', '7', '8']
    }
    
    def validate(self, case: OrderCase, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        issues = []
        
        tooth_position = case.tooth_position
        
        if not tooth_position.raw_position:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity=self.severity,
                message="牙位信息为空",
                details={"case_id": case.case_id}
            ))
            return issues
        
        if not tooth_position.is_valid:
            for error in tooth_position.validation_errors:
                issues.append(ValidationIssue(
                    rule_name=self.rule_name,
                    severity=self.severity,
                    message=error,
                    details={
                        "case_id": case.case_id,
                        "raw_position": tooth_position.raw_position,
                        "error": error
                    }
                ))
        
        if not tooth_position.teeth:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity=self.severity,
                message="未解析出有效的牙位",
                details={
                    "case_id": case.case_id,
                    "raw_position": tooth_position.raw_position
                }
            ))
        
        for tooth in tooth_position.teeth:
            if tooth not in self.VALID_TOOTH_NUMBERS and tooth not in self.VALID_FDI_POSITIONS:
                issues.append(ValidationIssue(
                    rule_name=self.rule_name,
                    severity=self.severity,
                    message=f"无效的牙位编号: {tooth}",
                    details={
                        "case_id": case.case_id,
                        "tooth": tooth,
                        "raw_position": tooth_position.raw_position
                    }
                ))
        
        return issues


class FileHashRule(ValidationRule):
    rule_name = "file_hash_consistency"
    description = "校验模型文件哈希一致性"
    severity = "critical"
    
    def validate(self, case: OrderCase, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        issues = []
        
        if not case.model_files:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity="warning",
                message="未找到关联的模型文件",
                details={"case_id": case.case_id}
            ))
            return issues
        
        seen_hashes: Dict[str, List[str]] = {}
        
        for model_file in case.model_files:
            file_hash = model_file.hash_sha256
            if file_hash in seen_hashes:
                seen_hashes[file_hash].append(model_file.file_name)
            else:
                seen_hashes[file_hash] = [model_file.file_name]
        
        for file_hash, files in seen_hashes.items():
            if len(files) > 1:
                issues.append(ValidationIssue(
                    rule_name=self.rule_name,
                    severity="warning",
                    message=f"发现重复的模型文件 (相同哈希值)",
                    details={
                        "case_id": case.case_id,
                        "hash": file_hash,
                        "duplicate_files": files
                    }
                ))
        
        if context:
            expected_hashes = context.get('expected_hashes', {})
            for model_file in case.model_files:
                expected_hash = expected_hashes.get(model_file.file_name)
                if expected_hash and model_file.hash_sha256 != expected_hash:
                    issues.append(ValidationIssue(
                        rule_name=self.rule_name,
                        severity=self.severity,
                        message=f"模型文件哈希不匹配，文件可能被篡改",
                        details={
                            "case_id": case.case_id,
                            "file_name": model_file.file_name,
                            "expected_hash": expected_hash,
                            "actual_hash": model_file.hash_sha256
                        }
                    ))
        
        return issues


class MaterialColorMatchRule(ValidationRule):
    rule_name = "material_color_match"
    description = "校验材料与色号匹配"
    severity = "critical"
    
    VALID_COLORS_BY_MATERIAL = {
        "resin": ["A1", "A2", "A3", "A3.5", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D2", "D3", "D4"],
        "ceramic": ["A1", "A2", "A3", "A3.5", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D2", "D3", "D4", "BL1", "BL2", "BL3", "BL4"],
        "metal": ["NC", "原色", "金色", "银色"],
        "composite": ["A1", "A2", "A3", "A3.5", "A4", "B1", "B2", "C1", "C2", "D2", "D3"]
    }
    
    def validate(self, case: OrderCase, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        issues = []
        
        material = case.material
        material_type = material.material_type.value if material.material_type else "resin"
        color_shade = material.color_shade
        
        if not color_shade:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity="warning",
                message="色号未指定",
                details={
                    "case_id": case.case_id,
                    "material_type": material_type
                }
            ))
            return issues
        
        color_upper = color_shade.strip().upper()
        
        valid_colors = self.VALID_COLORS_BY_MATERIAL.get(material_type, [])
        valid_colors_upper = [c.upper() for c in valid_colors]
        
        if color_upper not in valid_colors_upper and valid_colors:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity=self.severity,
                message=f"色号 '{color_shade}' 与材料类型 '{material_type}' 不匹配",
                details={
                    "case_id": case.case_id,
                    "material_type": material_type,
                    "provided_color": color_shade,
                    "valid_colors": valid_colors
                }
            ))
        
        return issues


class ResinBatchExpirationRule(ValidationRule):
    rule_name = "resin_batch_expiration"
    description = "校验树脂批号有效期"
    severity = "critical"
    
    WARNING_DAYS_BEFORE_EXPIRY = 30
    
    def validate(self, case: OrderCase, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        issues = []
        
        resin_batch = case.resin_batch
        
        if not resin_batch:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity="warning",
                message="未提供树脂批号信息",
                details={"case_id": case.case_id}
            ))
            return issues
        
        if not resin_batch.batch_number:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity="warning",
                message="树脂批号为空",
                details={"case_id": case.case_id}
            ))
        
        if not resin_batch.expiration_date or resin_batch.expiration_date == datetime.max:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity="warning",
                message="树脂有效期未指定",
                details={
                    "case_id": case.case_id,
                    "batch_number": resin_batch.batch_number
                }
            ))
            return issues
        
        today = datetime.now()
        days_until_expiry = (resin_batch.expiration_date - today).days
        
        if resin_batch.is_expired:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity=self.severity,
                message=f"树脂批号已过期 (过期 {abs(days_until_expiry)} 天)",
                details={
                    "case_id": case.case_id,
                    "batch_number": resin_batch.batch_number,
                    "expiration_date": resin_batch.expiration_date.isoformat(),
                    "days_expired": abs(days_until_expiry)
                }
            ))
        elif days_until_expiry <= self.WARNING_DAYS_BEFORE_EXPIRY:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity="warning",
                message=f"树脂批号即将过期 (剩余 {days_until_expiry} 天)",
                details={
                    "case_id": case.case_id,
                    "batch_number": resin_batch.batch_number,
                    "expiration_date": resin_batch.expiration_date.isoformat(),
                    "days_remaining": days_until_expiry
                }
            ))
        
        return issues


class PostProcessingDurationRule(ValidationRule):
    rule_name = "post_processing_duration"
    description = "校验后处理时长是否符合要求"
    severity = "warning"
    
    MIN_RECOMMENDED_DURATION = {
        "清洗": 10,
        "清洗固化": 20,
        "固化": 15,
        "抛光": 30,
        "染色": 20,
        "后处理": 30,
        "post_processing": 30,
        "cleaning": 10,
        "curing": 15,
        "polishing": 30,
    }
    
    MAX_RECOMMENDED_DURATION = {
        "清洗": 30,
        "清洗固化": 60,
        "固化": 45,
        "抛光": 120,
        "染色": 60,
        "后处理": 180,
        "post_processing": 180,
        "cleaning": 30,
        "curing": 45,
        "polishing": 120,
    }
    
    def validate(self, case: OrderCase, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        issues = []
        
        post_processing = case.post_processing
        
        if not post_processing:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity="info",
                message="未找到后处理记录",
                details={"case_id": case.case_id}
            ))
            return issues
        
        processing_type = post_processing.processing_type or "后处理"
        duration = post_processing.duration_minutes
        
        if duration <= 0:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity="warning",
                message="后处理时长为0或无效",
                details={
                    "case_id": case.case_id,
                    "processing_type": processing_type,
                    "start_time": post_processing.start_time.isoformat() if post_processing.start_time else None,
                    "end_time": post_processing.end_time.isoformat() if post_processing.end_time else None
                }
            ))
            return issues
        
        min_duration = self.MIN_RECOMMENDED_DURATION.get(
            processing_type, 
            self.MIN_RECOMMENDED_DURATION.get("后处理", 30)
        )
        max_duration = self.MAX_RECOMMENDED_DURATION.get(
            processing_type,
            self.MAX_RECOMMENDED_DURATION.get("后处理", 180)
        )
        
        if duration < min_duration:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity="warning",
                message=f"后处理时长较短 (建议至少 {min_duration} 分钟)",
                details={
                    "case_id": case.case_id,
                    "processing_type": processing_type,
                    "actual_duration": duration,
                    "recommended_min": min_duration
                }
            ))
        
        if duration > max_duration:
            issues.append(ValidationIssue(
                rule_name=self.rule_name,
                severity="warning",
                message=f"后处理时长较长 (建议不超过 {max_duration} 分钟)",
                details={
                    "case_id": case.case_id,
                    "processing_type": processing_type,
                    "actual_duration": duration,
                    "recommended_max": max_duration
                }
            ))
        
        return issues


class DuplicateCaseRule(ValidationRule):
    rule_name = "duplicate_case_detection"
    description = "检测重复病例"
    severity = "warning"
    
    def validate(self, case: OrderCase, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        issues = []
        
        if not context:
            return issues
        
        all_cases: List[OrderCase] = context.get('all_cases', [])
        
        if len(all_cases) <= 1:
            return issues
        
        patient_id = case.patient.patient_id
        tooth_positions = set(case.tooth_position.teeth)
        case_id = case.case_id
        
        for other_case in all_cases:
            if other_case.case_id == case_id:
                continue
            
            if other_case.patient.patient_id == patient_id:
                other_teeth = set(other_case.tooth_position.teeth)
                common_teeth = tooth_positions.intersection(other_teeth)
                
                if common_teeth:
                    issues.append(ValidationIssue(
                        rule_name=self.rule_name,
                        severity=self.severity,
                        message=f"发现潜在重复病例: 相同患者 {patient_id} 的相同牙位 {common_teeth}",
                        details={
                            "case_id": case_id,
                            "other_case_id": other_case.case_id,
                            "patient_id": patient_id,
                            "common_teeth": list(common_teeth),
                            "case_tooth_position": case.tooth_position.raw_position,
                            "other_tooth_position": other_case.tooth_position.raw_position
                        }
                    ))
        
        return issues


class PatientIdConsistencyRule(ValidationRule):
    rule_name = "patient_id_consistency"
    description = "校验患者ID在所有关联文件中的一致性"
    severity = "critical"
    
    def validate(self, case: OrderCase, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        issues = []
        
        patient_id = case.patient.patient_id
        
        if not case.model_files:
            return issues
        
        for model_file in case.model_files:
            extracted_id = model_file.extracted_patient_id
            if extracted_id and extracted_id != patient_id:
                issues.append(ValidationIssue(
                    rule_name=self.rule_name,
                    severity=self.severity,
                    message=f"模型文件中提取的患者ID与订单不匹配",
                    details={
                        "case_id": case.case_id,
                        "expected_patient_id": patient_id,
                        "extracted_patient_id": extracted_id,
                        "file_name": model_file.file_name
                    }
                ))
        
        return issues


class RulesEngine:
    def __init__(self):
        self.rules: List[ValidationRule] = [
            ToothPositionFormatRule(),
            FileHashRule(),
            MaterialColorMatchRule(),
            ResinBatchExpirationRule(),
            PostProcessingDurationRule(),
            DuplicateCaseRule(),
            PatientIdConsistencyRule(),
        ]
        self.custom_rules: List[ValidationRule] = []
    
    def add_custom_rule(self, rule: ValidationRule):
        self.custom_rules.append(rule)
    
    def validate_case(self, case: OrderCase, context: Dict[str, Any] = None) -> List[ValidationIssue]:
        all_issues = []
        
        all_rules = self.rules + self.custom_rules
        
        for rule in all_rules:
            try:
                issues = rule.validate(case, context)
                all_issues.extend(issues)
            except Exception as e:
                all_issues.append(ValidationIssue(
                    rule_name=rule.rule_name,
                    severity="warning",
                    message=f"规则执行出错: {str(e)}",
                    details={"error": str(e)}
                ))
        
        return all_issues
    
    def validate_all_cases(self, cases: List[OrderCase], context: Dict[str, Any] = None) -> Tuple[List[OrderCase], ValidationResult]:
        validated_cases = []
        total_issues = 0
        passed_count = 0
        quarantined_count = 0
        
        issues_by_severity = {"critical": 0, "warning": 0, "info": 0}
        issues_by_rule: Dict[str, int] = {}
        
        for case in cases:
            full_context = context.copy() if context else {}
            full_context['all_cases'] = cases
            
            issues = self.validate_case(case, full_context)
            
            for issue in issues:
                case.add_validation_issue(issue)
                
                if issue.severity in issues_by_severity:
                    issues_by_severity[issue.severity] += 1
                else:
                    issues_by_severity[issue.severity] = 1
                
                if issue.rule_name in issues_by_rule:
                    issues_by_rule[issue.rule_name] += 1
                else:
                    issues_by_rule[issue.rule_name] = 1
            
            total_issues += len(issues)
            
            if case.has_critical_issues():
                case.status = OrderStatus.QUARANTINED
                quarantined_count += 1
            else:
                case.status = OrderStatus.PASSED
                passed_count += 1
            
            validated_cases.append(case)
        
        result = ValidationResult(
            total_cases=len(cases),
            passed_cases=passed_count,
            quarantined_cases=quarantined_count,
            issues_by_severity=issues_by_severity,
            issues_by_rule=issues_by_rule
        )
        
        return validated_cases, result
    
    def get_rules_summary(self) -> List[Dict[str, Any]]:
        all_rules = self.rules + self.custom_rules
        return [
            {
                "rule_name": rule.rule_name,
                "description": rule.description,
                "severity": rule.severity
            }
            for rule in all_rules
        ]
