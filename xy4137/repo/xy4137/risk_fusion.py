from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set
from enum import Enum

from config import RISK_LEVELS
from data_parser import TranscriptRecord, RiskTagRecord, CallbackRecord
from feature_extractor import TextFeatures
from text_classifier import ClassificationResult


class RiskSource(Enum):
    RULE = "规则判定"
    MODEL = "模型预测"
    ORIGINAL = "原始标签"
    FUSION = "融合结果"
    MANUAL = "人工改判"


@dataclass
class KeywordEvidence:
    keyword: str
    count: int
    category: str
    context: str = ""


@dataclass
class TimeConflict:
    call_id_1: str
    call_id_2: str
    time_1: datetime
    time_2: datetime
    volunteer: Optional[str]
    conflict_type: str


@dataclass
class FusionResult:
    call_id: str
    final_risk: str
    final_risk_level: int
    risk_source: RiskSource
    confidence: float
    
    keyword_evidences: List[KeywordEvidence] = field(default_factory=list)
    model_result: Optional[ClassificationResult] = None
    original_tag: Optional[RiskTagRecord] = None
    features: Optional[TextFeatures] = None
    callback: Optional[CallbackRecord] = None
    
    is_missed_high_risk: bool = False
    template_issue_score: float = 0.0
    has_template_issue: bool = False
    
    notes: str = ""
    manual_override: bool = False
    override_reason: str = ""


class RiskFusionEngine:
    RISK_ORDER = ["低风险", "中风险", "高风险", "极高风险"]
    
    def __init__(self):
        self.results: Dict[str, FusionResult] = {}
        self.time_conflicts: List[TimeConflict] = []
        
    def fuse(
        self,
        call_id: str,
        transcript: Optional[TranscriptRecord],
        original_tag: Optional[RiskTagRecord],
        callback: Optional[CallbackRecord],
        features: Optional[TextFeatures],
        model_result: Optional[ClassificationResult]
    ) -> FusionResult:
        
        final_risk = "低风险"
        risk_source = RiskSource.FUSION
        confidence = 0.5
        
        keyword_evidences = self._extract_evidences(features)
        
        rule_based_risk = self._calculate_rule_based_risk(features, keyword_evidences)
        
        model_risk = model_result.predicted_risk if model_result else "低风险"
        model_confidence = model_result.confidence if model_result else 0.0
        
        original_risk = original_tag.risk_level if original_tag else "低风险"
        
        risks_to_compare = [rule_based_risk]
        if model_result:
            risks_to_compare.append(model_risk)
        
        final_risk = self._get_highest_risk(risks_to_compare)
        
        is_missed_high_risk = False
        final_risk_level = self._risk_to_level(final_risk)
        original_risk_level = self._risk_to_level(original_risk)
        
        if final_risk_level >= 3 and original_risk_level < 3:
            is_missed_high_risk = True
        
        confidence = self._calculate_confidence(
            rule_based_risk,
            model_risk,
            model_confidence,
            features
        )
        
        template_score = features.template_ratio if features else 0.0
        has_template_issue = template_score > 0.1
        
        result = FusionResult(
            call_id=call_id,
            final_risk=final_risk,
            final_risk_level=final_risk_level,
            risk_source=risk_source,
            confidence=round(confidence, 4),
            keyword_evidences=keyword_evidences,
            model_result=model_result,
            original_tag=original_tag,
            features=features,
            callback=callback,
            is_missed_high_risk=is_missed_high_risk,
            template_issue_score=round(template_score, 4),
            has_template_issue=has_template_issue
        )
        
        self.results[call_id] = result
        return result
    
    def detect_time_conflicts(self, callbacks: Dict[str, CallbackRecord]) -> List[TimeConflict]:
        self.time_conflicts = []
        
        if not callbacks:
            return []
        
        volunteer_callbacks: Dict[str, List[Tuple[str, CallbackRecord]]] = {}
        all_callbacks: List[Tuple[str, CallbackRecord]] = []
        
        for call_id, cb in callbacks.items():
            if cb.callback_time:
                all_callbacks.append((call_id, cb))
                
                volunteer = cb.assigned_volunteer or "unassigned"
                if volunteer not in volunteer_callbacks:
                    volunteer_callbacks[volunteer] = []
                volunteer_callbacks[volunteer].append((call_id, cb))
        
        for volunteer, cb_list in volunteer_callbacks.items():
            if len(cb_list) < 2:
                continue
            
            cb_list_sorted = sorted(cb_list, key=lambda x: x[1].callback_time)
            
            for i in range(len(cb_list_sorted) - 1):
                call_id_1, cb1 = cb_list_sorted[i]
                call_id_2, cb2 = cb_list_sorted[i + 1]
                
                time_diff = cb2.callback_time - cb1.callback_time
                
                if time_diff < timedelta(minutes=30):
                    conflict = TimeConflict(
                        call_id_1=call_id_1,
                        call_id_2=call_id_2,
                        time_1=cb1.callback_time,
                        time_2=cb2.callback_time,
                        volunteer=volunteer if volunteer != "unassigned" else None,
                        conflict_type="时间冲突（间隔<30分钟）"
                    )
                    self.time_conflicts.append(conflict)
        
        return self.time_conflicts
    
    def get_pending_callback_list(self) -> List[Dict]:
        pending_list = []
        
        for call_id, result in self.results.items():
            if not result.callback:
                continue
            
            cb = result.callback
            if cb.status != "待回访":
                continue
            
            priority_order = {"紧急": 0, "高": 1, "正常": 2, "低": 3}
            priority_num = priority_order.get(cb.priority, 2)
            
            risk_priority = 4 - result.final_risk_level
            
            pending_list.append({
                "call_id": call_id,
                "risk_level": result.final_risk,
                "risk_score": result.final_risk_level,
                "callback_time": cb.callback_time,
                "assigned_volunteer": cb.assigned_volunteer,
                "priority": cb.priority,
                "sort_priority": risk_priority * 10 + priority_num,
                "is_high_risk_missed": result.is_missed_high_risk,
                "notes": cb.notes
            })
        
        pending_list.sort(key=lambda x: x["sort_priority"])
        return pending_list
    
    def manual_override(
        self,
        call_id: str,
        new_risk: str,
        reason: str
    ) -> Optional[FusionResult]:
        if call_id not in self.results:
            return None
        
        result = self.results[call_id]
        result.final_risk = new_risk
        result.final_risk_level = self._risk_to_level(new_risk)
        result.risk_source = RiskSource.MANUAL
        result.manual_override = True
        result.override_reason = reason
        
        return result
    
    def _extract_evidences(self, features: Optional[TextFeatures]) -> List[KeywordEvidence]:
        evidences = []
        
        if not features:
            return evidences
        
        for keyword, count in features.high_risk_keywords:
            evidences.append(KeywordEvidence(
                keyword=keyword,
                count=count,
                category="高风险关键词"
            ))
        
        for keyword, count in features.medium_risk_keywords:
            evidences.append(KeywordEvidence(
                keyword=keyword,
                count=count,
                category="中风险关键词"
            ))
        
        for keyword, count in features.template_phrases:
            evidences.append(KeywordEvidence(
                keyword=keyword,
                count=count,
                category="模板话术"
            ))
        
        return evidences
    
    def _calculate_rule_based_risk(
        self,
        features: Optional[TextFeatures],
        evidences: List[KeywordEvidence]
    ) -> str:
        if not features:
            return "低风险"
        
        high_risk_count = sum(e.count for e in evidences if e.category == "高风险关键词")
        medium_risk_count = sum(e.count for e in evidences if e.category == "中风险关键词")
        
        if high_risk_count >= 2:
            return "极高风险"
        elif high_risk_count >= 1:
            return "高风险"
        
        keyword_score = features.keyword_risk_score
        negative_score = features.negative_emotion_score
        urgency_score = features.urgency_score
        
        combined_score = keyword_score * 0.5 + negative_score * 0.3 + urgency_score * 0.2
        
        if medium_risk_count >= 3 or combined_score > 0.6:
            return "高风险"
        elif medium_risk_count >= 1 or combined_score > 0.3:
            return "中风险"
        
        return "低风险"
    
    def _get_highest_risk(self, risks: List[str]) -> str:
        if not risks:
            return "低风险"
        
        max_level = -1
        highest_risk = "低风险"
        
        for risk in risks:
            level = self._risk_to_level(risk)
            if level > max_level:
                max_level = level
                highest_risk = risk
        
        return highest_risk
    
    def _risk_to_level(self, risk: str) -> int:
        if risk in self.RISK_ORDER:
            return self.RISK_ORDER.index(risk) + 1
        return 1
    
    def _calculate_confidence(
        self,
        rule_risk: str,
        model_risk: str,
        model_confidence: float,
        features: Optional[TextFeatures]
    ) -> float:
        rule_level = self._risk_to_level(rule_risk)
        model_level = self._risk_to_level(model_risk)
        
        if features:
            keyword_count = len(features.high_risk_keywords) + len(features.medium_risk_keywords)
            has_keywords = keyword_count > 0
        else:
            has_keywords = False
        
        if has_keywords:
            rule_confidence = 0.8
        else:
            rule_confidence = 0.5
        
        if rule_level == model_level:
            confidence = max(rule_confidence, model_confidence) * 1.1
        elif abs(rule_level - model_level) == 1:
            if has_keywords:
                confidence = rule_confidence * 0.9
            else:
                confidence = (rule_confidence + model_confidence) / 2
        else:
            if has_keywords:
                confidence = rule_confidence * 0.8
            else:
                confidence = 0.5
        
        return min(confidence, 1.0)
    
    def get_all_results(self) -> Dict[str, FusionResult]:
        return self.results
    
    def get_high_risk_cases(self) -> List[FusionResult]:
        return [
            result for result in self.results.values()
            if result.final_risk_level >= 3
        ]
    
    def get_missed_high_risk_cases(self) -> List[FusionResult]:
        return [
            result for result in self.results.values()
            if result.is_missed_high_risk
        ]
    
    def get_template_issue_cases(self) -> List[FusionResult]:
        return [
            result for result in self.results.values()
            if result.has_template_issue
        ]
