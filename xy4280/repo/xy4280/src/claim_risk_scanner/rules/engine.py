import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional, Callable, Set
from collections import defaultdict

from claim_risk_scanner.data_parser import InvoiceData, ClaimData, RiskSample
from claim_risk_scanner.features import FeatureSet


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RuleResult:
    rule_id: str
    rule_name: str
    matched: bool
    risk_level: RiskLevel
    score: float
    evidence: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RiskRule:
    rule_id: str
    name: str
    description: str
    risk_level: RiskLevel
    weight: float
    condition: Callable[[FeatureSet, Dict[str, Any]], bool]
    evidence_template: str
    
    def evaluate(
        self, 
        feature_set: FeatureSet, 
        context: Dict[str, Any]
    ) -> Optional[RuleResult]:
        matched = self.condition(feature_set, context)
        
        if matched:
            evidence = self.evidence_template.format(
                invoice_number=feature_set.invoice_data.invoice_number,
                vendor_name=feature_set.invoice_data.vendor_name,
                amount=feature_set.invoice_data.total_amount,
                **{k: v for k, v in feature_set.to_feature_vector().items()}
            )
            
            return RuleResult(
                rule_id=self.rule_id,
                rule_name=self.name,
                matched=True,
                risk_level=self.risk_level,
                score=self.weight,
                evidence=evidence,
                details={
                    'invoice_number': feature_set.invoice_data.invoice_number,
                    'vendor_name': feature_set.invoice_data.vendor_name,
                    'total_amount': feature_set.invoice_data.total_amount,
                    'features': feature_set.to_feature_vector(),
                }
            )
        
        return None


class RuleEngine:
    def __init__(self):
        self.rules: List[RiskRule] = []
        self._register_default_rules()
    
    def _register_default_rules(self):
        self.add_rule(RiskRule(
            rule_id="R001",
            name="精确重复发票",
            description="检测同一发票号码出现多次的情况",
            risk_level=RiskLevel.HIGH,
            weight=0.8,
            condition=lambda fs, ctx: fs.duplicate_features.exact_duplicate_count > 1,
            evidence_template="发票号 {invoice_number} 出现 {exact_duplicate_count} 次，存在重复报销风险"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R002",
            name="发票金额不一致",
            description="同一发票号码但金额不同",
            risk_level=RiskLevel.CRITICAL,
            weight=1.0,
            condition=lambda fs, ctx: fs.duplicate_features.amount_variation_score > 0,
            evidence_template="发票号 {invoice_number} 金额存在差异，变化比例 {amount_variation_score:.1%}"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R003",
            name="高风险商户匹配",
            description="商户名称与历史风险样本匹配",
            risk_level=RiskLevel.HIGH,
            weight=0.9,
            condition=lambda fs, ctx: fs.vendor_features.risk_sample_match_score >= 0.85,
            evidence_template="商户 {vendor_name} 与历史风险样本匹配，匹配度 {risk_sample_match_score:.0%}"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R004",
            name="金额异常",
            description="金额偏离整体分布",
            risk_level=RiskLevel.MEDIUM,
            weight=0.4,
            condition=lambda fs, ctx: fs.invoice_features.amount_anomaly_score > 0.5,
            evidence_template="金额 {amount} 偏离平均值，异常分数 {amount_anomaly_score:.2f}"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R005",
            name="金额凑整",
            description="金额呈现明显凑整特征",
            risk_level=RiskLevel.MEDIUM,
            weight=0.5,
            condition=lambda fs, ctx: fs.invoice_features.amount_roundness_score > 0.6,
            evidence_template="金额 {amount} 呈现凑整特征，分数 {amount_roundness_score:.2f}"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R006",
            name="明细金额与合计不符",
            description="发票条目金额合计与总金额不一致",
            risk_level=RiskLevel.HIGH,
            weight=0.7,
            condition=lambda fs, ctx: fs.invoice_features.item_amount_mismatch_score > 0,
            evidence_template="发票明细金额与总金额不符，差异比例 {item_amount_mismatch_score:.1%}"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R007",
            name="OCR低置信度",
            description="OCR识别置信度过低，可能存在篡改",
            risk_level=RiskLevel.MEDIUM,
            weight=0.4,
            condition=lambda fs, ctx: fs.invoice_features.ocr_confidence_score > 0.3,
            evidence_template="OCR置信度较低，风险分数 {ocr_confidence_score:.2f}"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R008",
            name="税率比例异常",
            description="税额比例不符合常见税率",
            risk_level=RiskLevel.LOW,
            weight=0.2,
            condition=lambda fs, ctx: fs.invoice_features.tax_ratio_anomaly_score > 0.3,
            evidence_template="税额比例异常，分数 {tax_ratio_anomaly_score:.2f}"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R009",
            name="日期异常",
            description="发票日期为未来或过期太久",
            risk_level=RiskLevel.MEDIUM,
            weight=0.3,
            condition=lambda fs, ctx: fs.invoice_features.date_anomaly_score > 0.3,
            evidence_template="发票日期存在异常，分数 {date_anomaly_score:.2f}"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R010",
            name="商户频繁出现",
            description="同一商户短期内频繁出现",
            risk_level=RiskLevel.LOW,
            weight=0.2,
            condition=lambda fs, ctx: fs.vendor_features.vendor_appearance_frequency > 5,
            evidence_template="商户 {vendor_name} 出现 {vendor_appearance_frequency} 次，较为频繁"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R011",
            name="商户名称变体",
            description="同一商户存在多种名称变体",
            risk_level=RiskLevel.MEDIUM,
            weight=0.5,
            condition=lambda fs, ctx: fs.vendor_features.name_variation_count > 2,
            evidence_template="商户 {vendor_name} 存在 {name_variation_count} 种名称变体"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R012",
            name="税号不一致",
            description="同一商户使用不同税号",
            risk_level=RiskLevel.HIGH,
            weight=0.8,
            condition=lambda fs, ctx: fs.vendor_features.tax_id_mismatch_score > 0,
            evidence_template="商户 {vendor_name} 存在税号不一致情况，分数 {tax_id_mismatch_score:.2f}"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R013",
            name="部分重复发票",
            description="存在内容高度相似的其他发票",
            risk_level=RiskLevel.MEDIUM,
            weight=0.5,
            condition=lambda fs, ctx: fs.duplicate_features.partial_duplicate_count > 0,
            evidence_template="存在 {partial_duplicate_count} 张内容相似的发票"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R014",
            name="多理赔单关联",
            description="同一发票关联多份理赔申请",
            risk_level=RiskLevel.HIGH,
            weight=0.9,
            condition=lambda fs, ctx: fs.duplicate_features.duplicate_claim_count > 1,
            evidence_template="发票号 {invoice_number} 关联 {duplicate_claim_count} 份理赔申请"
        ))
        
        self.add_rule(RiskRule(
            rule_id="R015",
            name="日期不一致",
            description="同一发票号码但日期不同",
            risk_level=RiskLevel.HIGH,
            weight=0.7,
            condition=lambda fs, ctx: fs.duplicate_features.date_variation_score > 0,
            evidence_template="发票号 {invoice_number} 存在日期不一致情况"
        ))
    
    def add_rule(self, rule: RiskRule):
        self.rules.append(rule)
    
    def evaluate(
        self, 
        feature_set: FeatureSet, 
        context: Optional[Dict[str, Any]] = None
    ) -> List[RuleResult]:
        context = context or {}
        results = []
        
        for rule in self.rules:
            result = rule.evaluate(feature_set, context)
            if result:
                results.append(result)
        
        return results
    
    def evaluate_batch(
        self, 
        feature_sets: List[FeatureSet],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, List[RuleResult]]:
        results: Dict[str, List[RuleResult]] = {}
        
        for feature_set in feature_sets:
            invoice_number = feature_set.invoice_data.invoice_number
            if not invoice_number:
                invoice_number = f"unknown_{id(feature_set)}"
            
            results[invoice_number] = self.evaluate(feature_set, context)
        
        return results
    
    def calculate_risk_score(
        self, 
        rule_results: List[RuleResult],
        feature_vector: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        if not rule_results:
            return {
                'total_score': 0.0,
                'max_risk_level': RiskLevel.LOW,
                'rule_count': 0,
                'breakdown': {}
            }
        
        total_score = sum(r.score for r in rule_results)
        
        level_order = {
            RiskLevel.LOW: 0,
            RiskLevel.MEDIUM: 1,
            RiskLevel.HIGH: 2,
            RiskLevel.CRITICAL: 3,
        }
        
        max_risk_level = max(
            rule_results, 
            key=lambda r: level_order[r.risk_level]
        ).risk_level
        
        breakdown = defaultdict(float)
        for result in rule_results:
            breakdown[result.risk_level.value] += result.score
        
        if feature_vector:
            model_contribution = sum(v for v in feature_vector.values() if v > 0) / 10.0
            total_score = min(1.0, total_score + model_contribution)
        
        return {
            'total_score': min(1.0, total_score),
            'max_risk_level': max_risk_level,
            'rule_count': len(rule_results),
            'breakdown': dict(breakdown),
            'critical_rules': [r.rule_name for r in rule_results if r.risk_level == RiskLevel.CRITICAL],
            'high_rules': [r.rule_name for r in rule_results if r.risk_level == RiskLevel.HIGH],
        }
