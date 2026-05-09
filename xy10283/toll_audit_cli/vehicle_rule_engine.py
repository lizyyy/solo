from typing import List, Dict, Any, Tuple
from datetime import datetime

from .models import TollRecord, VehicleType, VehicleRule, AuditResult


class VehicleRuleEngine:
    DEFAULT_RULES = [
        VehicleRule(
            rule_id="VR_001",
            rule_name="1型客车载重校验",
            description="1型客车（小轿车）最大载重不应超过2.5吨",
            vehicle_type=VehicleType.TYPE_1,
            min_weight=0.5,
            max_weight=2.5
        ),
        VehicleRule(
            rule_id="VR_002",
            rule_name="2型客车载重校验",
            description="2型客车最大载重不应超过3.5吨",
            vehicle_type=VehicleType.TYPE_2,
            min_weight=1.5,
            max_weight=3.5
        ),
        VehicleRule(
            rule_id="VR_003",
            rule_name="3型客车载重校验",
            description="3型客车最大载重不应超过5吨",
            vehicle_type=VehicleType.TYPE_3,
            min_weight=2.0,
            max_weight=5.0
        ),
        VehicleRule(
            rule_id="VR_004",
            rule_name="4型客车载重校验",
            description="4型客车最大载重不应超过7吨",
            vehicle_type=VehicleType.TYPE_4,
            min_weight=3.0,
            max_weight=7.0
        ),
        VehicleRule(
            rule_id="VR_005",
            rule_name="1型货车载重校验",
            description="1型货车最大载重不应超过4.5吨",
            vehicle_type=VehicleType.TYPE_5,
            min_weight=1.0,
            max_weight=4.5
        ),
        VehicleRule(
            rule_id="VR_006",
            rule_name="2型货车载重校验",
            description="2型货车最大载重不应超过12吨",
            vehicle_type=VehicleType.TYPE_6,
            min_weight=4.0,
            max_weight=12.0
        ),
        VehicleRule(
            rule_id="VR_007",
            rule_name="3型货车载重校验",
            description="3型货车最大载重不应超过25吨",
            vehicle_type=VehicleType.TYPE_7,
            min_weight=10.0,
            max_weight=25.0
        ),
        VehicleRule(
            rule_id="VR_008",
            rule_name="4型货车载重校验",
            description="4型货车最大载重不应超过35吨",
            vehicle_type=VehicleType.TYPE_8,
            min_weight=20.0,
            max_weight=35.0
        ),
        VehicleRule(
            rule_id="VR_009",
            rule_name="5型货车载重校验",
            description="5型货车最大载重不应超过49吨",
            vehicle_type=VehicleType.TYPE_9,
            min_weight=30.0,
            max_weight=49.0
        ),
        VehicleRule(
            rule_id="VR_010",
            rule_name="6型货车载重校验",
            description="6型货车（大件运输）最大载重不应超过55吨",
            vehicle_type=VehicleType.TYPE_10,
            min_weight=40.0,
            max_weight=55.0
        )
    ]
    
    def __init__(self, custom_rules: List[VehicleRule] = None):
        self.rules = custom_rules if custom_rules else self.DEFAULT_RULES
    
    def validate(self, records: List[TollRecord]) -> List[AuditResult]:
        results = []
        
        for record in records:
            result = self._validate_single(record)
            results.append(result)
        
        return results
    
    def _validate_single(self, record: TollRecord) -> AuditResult:
        result = AuditResult(
            record_id=record.record_id,
            plate_number=record.plate_number,
            vehicle_type=record.vehicle_type.value
        )
        
        if record.vehicle_type == VehicleType.UNKNOWN:
            result.vehicle_type_issue = True
            result.vehicle_type_evidence = f"车型识别失败，无法确定车型类别"
            result.needs_manual_review = True
            result.review_notes.append("车型未知，需要人工确认")
            return result
        
        applicable_rule = self._get_applicable_rule(record.vehicle_type)
        if not applicable_rule:
            result.needs_manual_review = True
            result.review_notes.append(f"未找到{record.vehicle_type.value}的校验规则")
            return result
        
        violations = []
        
        if applicable_rule.min_weight is not None and record.weight < applicable_rule.min_weight:
            violations.append(
                f"实际载重 {record.weight:.2f}吨 低于 {applicable_rule.vehicle_type.value} 最低标准 {applicable_rule.min_weight}吨"
            )
        
        if applicable_rule.max_weight is not None and record.weight > applicable_rule.max_weight:
            violations.append(
                f"实际载重 {record.weight:.2f}吨 超过 {applicable_rule.vehicle_type.value} 最大标准 {applicable_rule.max_weight}吨"
            )
        
        if violations:
            result.vehicle_type_issue = True
            result.vehicle_type_evidence = "；".join(violations)
            result.needs_manual_review = True
            result.review_notes.extend(violations)
        
        return result
    
    def _get_applicable_rule(self, vehicle_type: VehicleType) -> VehicleRule:
        for rule in self.rules:
            if rule.vehicle_type == vehicle_type and rule.is_active:
                return rule
        return None
    
    def get_stats(self, results: List[AuditResult]) -> Dict[str, Any]:
        total = len(results)
        vehicle_type_issues = sum(1 for r in results if r.vehicle_type_issue)
        
        return {
            "total_records": total,
            "vehicle_type_issues": vehicle_type_issues,
            "vehicle_type_pass_rate": (total - vehicle_type_issues) / total * 100 if total > 0 else 0
        }
