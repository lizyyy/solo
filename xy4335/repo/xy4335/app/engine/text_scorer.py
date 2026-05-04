from typing import Dict, List, Tuple, Set
from datetime import datetime, timedelta
from app.config import KEYWORDS, RISK_FLAGS, RISK_LEVELS, FOLLOWUP_REQUIRED_HOURS, REFERRAL_TIMEOUT_HOURS


class LightweightTextScorer:
    def __init__(self):
        self.keywords = KEYWORDS

    def score_text(self, text: str) -> Tuple[float, List[str], Dict[str, int]]:
        if not text or not text.strip():
            return 0.0, [], {}
        
        text_lower = text.lower()
        total_score = 0.0
        triggered_flags = []
        category_hits = {}

        for category, keywords in self.keywords.items():
            hits = 0
            for keyword in keywords:
                if keyword.lower() in text_lower:
                    hits += 1
            
            if hits > 0:
                category_hits[category] = hits
                weight = RISK_FLAGS.get(category, {"weight": 10})["weight"]
                score_contribution = min(weight * hits * 0.5, weight * 2)
                total_score += score_contribution
                
                if category == "self_harm":
                    triggered_flags.append("self_harm")
                elif category == "suicide_ideation":
                    triggered_flags.append("suicide_ideation")
                elif category == "suicide_plan":
                    triggered_flags.append("suicide_plan")
                elif category == "suicide_attempt":
                    triggered_flags.append("suicide_attempt")

        context_boost = self._analyze_context(text_lower)
        total_score += context_boost

        total_score = min(total_score, 100.0)
        
        return total_score, triggered_flags, category_hits

    def _analyze_context(self, text_lower: str) -> float:
        boost = 0.0
        
        urgency_indicators = [
            "现在", "马上", "立刻", "今天", "今晚", "现在就",
            "now", "right now", "immediately", "today", "tonight"
        ]
        for indicator in urgency_indicators:
            if indicator in text_lower:
                boost += 5.0
                break
        
        certainty_indicators = [
            "肯定", "一定", "确定", "决定", "已经",
            "definitely", "certainly", "already", "decided"
        ]
        for indicator in certainty_indicators:
            if indicator in text_lower:
                boost += 3.0
                break
        
        method_indicators = [
            "刀片", "刀子", "刀", "绳子", "农药", "安眠药", "药",
            "跳楼", "跳河", "跳桥", "割腕", "上吊", "煤气",
            "blade", "knife", "rope", "pills", "jump", "hang"
        ]
        method_count = sum(1 for m in method_indicators if m in text_lower)
        boost += method_count * 8.0
        
        return min(boost, 30.0)

    def determine_risk_level(self, score: float) -> str:
        if score >= RISK_LEVELS["red"]["score_min"]:
            return "red"
        elif score >= RISK_LEVELS["orange"]["score_min"]:
            return "orange"
        elif score >= RISK_LEVELS["yellow"]["score_min"]:
            return "yellow"
        return "green"


class RiskRuleEngine:
    def __init__(self):
        self.text_scorer = LightweightTextScorer()

    def assess_call(
        self, 
        call_data: Dict,
        caller_history: List[Dict] = None,
        follow_ups: List[Dict] = None,
        current_time: datetime = None
    ) -> Dict:
        current_time = current_time or datetime.now()
        caller_history = caller_history or []
        follow_ups = follow_ups or []
        
        text_score, text_flags, category_hits = self.text_scorer.score_text(
            call_data.get("summary_text", "")
        )
        
        all_flags = text_flags.copy()
        total_score = text_score
        
        initial_level = call_data.get("initial_risk_level", "green")
        history_escalation = self._check_risk_escalation(
            call_data, caller_history, initial_level
        )
        if history_escalation:
            all_flags.append("escalation")
            total_score += RISK_FLAGS["escalation"]["weight"]
        
        repeat_count = self._check_repeat_caller(call_data, caller_history)
        if repeat_count >= 2:
            all_flags.append("repeat_caller")
            repeat_weight = RISK_FLAGS["repeat_caller"]["weight"] * min(repeat_count - 1, 3)
            total_score += repeat_weight
        
        if self._check_missed_followup(call_data, follow_ups, current_time):
            all_flags.append("missed_followup")
            total_score += RISK_FLAGS["missed_followup"]["weight"]
        
        if self._check_referral_timeout(call_data, current_time):
            all_flags.append("referral_timeout")
            total_score += RISK_FLAGS["referral_timeout"]["weight"]
        
        all_flags = list(set(all_flags))
        
        final_level = self.text_scorer.determine_risk_level(total_score)
        
        if "suicide_attempt" in all_flags:
            final_level = "red"
            total_score = max(total_score, 90)
        elif "suicide_plan" in all_flags and final_level != "red":
            final_level = "orange" if final_level == "yellow" else final_level
            total_score = max(total_score, 70)
        
        return {
            "risk_level": final_level,
            "risk_score": round(total_score, 1),
            "flags": all_flags,
            "text_score": round(text_score, 1),
            "text_flags": text_flags,
            "category_hits": category_hits,
            "repeat_count": repeat_count,
        }

    def _check_risk_escalation(
        self, 
        current_call: Dict, 
        history: List[Dict], 
        current_initial_level: str
    ) -> bool:
        if not history:
            return False
        
        level_order = {"green": 0, "yellow": 1, "orange": 2, "red": 3}
        
        recent_history = sorted(
            history, 
            key=lambda x: x.get("call_time", datetime.min),
            reverse=True
        )[:5]
        
        for prev_call in recent_history:
            prev_level = prev_call.get("initial_risk_level", "green")
            if level_order.get(current_initial_level, 0) > level_order.get(prev_level, 0):
                return True
        
        return False

    def _check_repeat_caller(self, current_call: Dict, history: List[Dict]) -> int:
        caller_id = current_call.get("caller_id")
        if not caller_id:
            return 0
        
        count = 1
        current_time = current_call.get("call_time", datetime.now())
        seven_days_ago = current_time - timedelta(days=7)
        
        for call in history:
            if call.get("caller_id") == caller_id:
                call_time = call.get("call_time")
                if call_time and seven_days_ago <= call_time < current_time:
                    count += 1
        
        return count

    def _check_missed_followup(
        self, 
        call_data: Dict, 
        follow_ups: List[Dict], 
        current_time: datetime
    ) -> bool:
        if not follow_ups:
            return False
        
        for fu in follow_ups:
            if fu.get("is_completed", False):
                continue
            
            scheduled = fu.get("scheduled_time")
            if scheduled and scheduled < current_time:
                return True
        
        return False

    def _check_referral_timeout(
        self, 
        call_data: Dict, 
        current_time: datetime
    ) -> bool:
        if not call_data.get("has_referral", False):
            return False
        
        referral_time = call_data.get("referral_time")
        if not referral_time:
            return False
        
        time_diff = current_time - referral_time
        return time_diff.total_seconds() > REFERRAL_TIMEOUT_HOURS * 3600

    def get_risk_queue_priority(self, assessment: Dict) -> int:
        level_priority = {"red": 4, "orange": 3, "yellow": 2, "green": 1}
        base_priority = level_priority.get(assessment.get("risk_level", "green"), 1)
        
        flags = assessment.get("flags", [])
        flag_boost = 0
        
        if "suicide_attempt" in flags:
            flag_boost += 10
        if "suicide_plan" in flags:
            flag_boost += 5
        if "escalation" in flags:
            flag_boost += 3
        if "missed_followup" in flags:
            flag_boost += 3
        
        return base_priority * 100 + flag_boost
