from datetime import date, datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import asdict

from config import config, RiskThresholds
from src.models import (
    SummaryMetrics,
    RiskAssessment,
    RiskLevel,
)


class RiskEngine:
    def __init__(self, thresholds: Optional[RiskThresholds] = None):
        self.thresholds = thresholds or config.DEFAULT_RISK_THRESHOLDS

    def update_thresholds(self, thresholds: RiskThresholds):
        self.thresholds = thresholds

    def assess_compliance_risk(self, metrics: SummaryMetrics) -> Tuple[bool, str, float]:
        compliance_rate = metrics.compliance_rate
        risk_score = 0.0
        is_risk = False
        details = ""

        if compliance_rate < self.thresholds.compliance_rate_low:
            risk_score = 1.0
            is_risk = True
            details = f"依从率极低 ({compliance_rate:.1%})，低于预警线 {self.thresholds.compliance_rate_low:.0%}"
        elif compliance_rate < self.thresholds.compliance_rate_warning:
            risk_score = 0.6
            is_risk = True
            details = f"依从率偏低 ({compliance_rate:.1%})，低于警戒线 {self.thresholds.compliance_rate_warning:.0%}"
        else:
            risk_score = 0.0
            is_risk = False
            details = f"依从率良好 ({compliance_rate:.1%})"

        return is_risk, details, risk_score

    def assess_pain_risk(self, metrics: SummaryMetrics) -> Tuple[bool, str, float]:
        average_pain = metrics.average_pain_score
        pain_change = metrics.pain_score_change
        risk_score = 0.0
        is_risk = False
        details = ""

        risk_conditions = []

        if average_pain >= self.thresholds.pain_high_level:
            risk_score += 0.5
            is_risk = True
            risk_conditions.append(f"平均疼痛评分较高 ({average_pain}/10)")

        if pain_change >= self.thresholds.pain_increase_threshold:
            risk_score += 0.5
            is_risk = True
            risk_conditions.append(f"疼痛评分上升明显 (+{pain_change})")

        if is_risk:
            details = " | ".join(risk_conditions)
        else:
            if pain_change < 0:
                details = f"疼痛有所缓解 (变化 {pain_change})，平均评分 {average_pain}/10"
            else:
                details = f"疼痛评分稳定，平均 {average_pain}/10"

        return is_risk, details, min(risk_score, 1.0)

    def assess_movement_risk(self, metrics: SummaryMetrics) -> Tuple[bool, str, float]:
        movement_volatility = metrics.movement_volatility
        average_score = metrics.average_movement_score
        risk_score = 0.0
        is_risk = False
        details = ""

        if movement_volatility >= self.thresholds.movement_volatility_threshold:
            risk_score = 0.7
            is_risk = True
            details = f"动作稳定性较差 (变异系数 {movement_volatility:.2%}，阈值 {self.thresholds.movement_volatility_threshold:.0%})"
        elif average_score > 0:
            risk_score = 0.0
            is_risk = False
            details = f"动作稳定性良好 (变异系数 {movement_volatility:.2%})，平均得分 {average_score:.1f}"
        else:
            risk_score = 0.0
            is_risk = False
            details = "无动作完成数据"

        return is_risk, details, risk_score

    def assess_missed_days_risk(self, metrics: SummaryMetrics) -> Tuple[bool, str, float]:
        consecutive_missed = metrics.consecutive_missed_days
        missed_count = metrics.missed_days_count
        risk_score = 0.0
        is_risk = False
        details = ""

        if consecutive_missed >= self.thresholds.missed_days_critical:
            risk_score = 1.0
            is_risk = True
            details = f"连续缺训风险极高 (已连续 {consecutive_missed} 天缺训)"
        elif consecutive_missed >= self.thresholds.missed_days_warning:
            risk_score = 0.6
            is_risk = True
            details = f"连续缺训风险 (已连续 {consecutive_missed} 天缺训)"
        elif missed_count > 0:
            risk_score = 0.3
            is_risk = False
            details = f"本期缺训 {missed_count} 天，无连续缺训"
        else:
            risk_score = 0.0
            is_risk = False
            details = "无缺训记录"

        return is_risk, details, risk_score

    def calculate_overall_risk(self, risk_scores: Dict[str, float]) -> Tuple[RiskLevel, float]:
        compliance_score = risk_scores.get("compliance", 0.0)
        pain_score = risk_scores.get("pain", 0.0)
        movement_score = risk_scores.get("movement", 0.0)
        missed_score = risk_scores.get("missed_days", 0.0)

        weights = {
            "compliance": 0.30,
            "pain": 0.25,
            "missed_days": 0.25,
            "movement": 0.20,
        }

        overall_score = (
            compliance_score * weights["compliance"] +
            pain_score * weights["pain"] +
            movement_score * weights["movement"] +
            missed_score * weights["missed_days"]
        )

        if any(score == 1.0 for score in [compliance_score, missed_score]):
            risk_level = RiskLevel.CRITICAL
        elif overall_score >= 0.6:
            risk_level = RiskLevel.HIGH
        elif overall_score >= 0.3:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        return risk_level, round(overall_score, 4)

    def generate_recommendations(
        self,
        risk_level: RiskLevel,
        compliance_risk: bool,
        compliance_details: str,
        pain_risk: bool,
        pain_details: str,
        movement_risk: bool,
        movement_details: str,
        missed_days_risk: bool,
        missed_days_details: str,
    ) -> List[str]:
        recommendations = []

        if risk_level == RiskLevel.CRITICAL:
            recommendations.append("【紧急】建议立即进行电话随访或上门探视")

        if compliance_risk:
            if "极低" in compliance_details:
                recommendations.append("建议检查患者训练环境和设备是否正常")
                recommendations.append("考虑调整训练计划难度，或增加激励机制")
            else:
                recommendations.append("建议关注患者训练动力，考虑增加随访频率")

        if pain_risk:
            recommendations.append(f"建议关注患者疼痛情况：{pain_details}")
            recommendations.append("考虑调整训练强度或咨询医生意见")

        if movement_risk:
            recommendations.append(f"建议关注动作稳定性：{movement_details}")
            recommendations.append("可能需要重新进行动作示范和指导")

        if missed_days_risk:
            recommendations.append(f"建议关注缺训情况：{missed_days_details}")
            recommendations.append("了解患者缺训原因，排除健康或生活障碍")

        if not recommendations:
            recommendations.append("患者状态良好，建议维持当前随访计划")
            recommendations.append("继续观察训练进展和疼痛变化")

        return recommendations

    def assess_risk(self, metrics: SummaryMetrics) -> RiskAssessment:
        compliance_risk, compliance_details, compliance_score = self.assess_compliance_risk(metrics)
        pain_risk, pain_details, pain_score = self.assess_pain_risk(metrics)
        movement_risk, movement_details, movement_score = self.assess_movement_risk(metrics)
        missed_days_risk, missed_days_details, missed_score = self.assess_missed_days_risk(metrics)

        risk_scores = {
            "compliance": compliance_score,
            "pain": pain_score,
            "movement": movement_score,
            "missed_days": missed_score,
        }

        risk_level, overall_score = self.calculate_overall_risk(risk_scores)

        risk_factors = []
        if compliance_risk:
            risk_factors.append({
                "type": "compliance",
                "details": compliance_details,
                "score": compliance_score,
            })
        if pain_risk:
            risk_factors.append({
                "type": "pain",
                "details": pain_details,
                "score": pain_score,
            })
        if movement_risk:
            risk_factors.append({
                "type": "movement",
                "details": movement_details,
                "score": movement_score,
            })
        if missed_days_risk:
            risk_factors.append({
                "type": "missed_days",
                "details": missed_days_details,
                "score": missed_score,
            })

        recommendations = self.generate_recommendations(
            risk_level=risk_level,
            compliance_risk=compliance_risk,
            compliance_details=compliance_details,
            pain_risk=pain_risk,
            pain_details=pain_details,
            movement_risk=movement_risk,
            movement_details=movement_details,
            missed_days_risk=missed_days_risk,
            missed_days_details=missed_days_details,
        )

        needs_urgent_follow_up = risk_level in [RiskLevel.CRITICAL, RiskLevel.HIGH]
        follow_up_priority = "urgent" if risk_level == RiskLevel.CRITICAL else (
            "high" if risk_level == RiskLevel.HIGH else (
                "medium" if risk_level == RiskLevel.MEDIUM else "normal"
            )
        )

        return RiskAssessment(
            patient_id=metrics.patient_id,
            assessment_date=date.today(),
            risk_level=risk_level,
            risk_factors=risk_factors,
            compliance_risk=compliance_risk,
            compliance_risk_details=compliance_details,
            pain_risk=pain_risk,
            pain_risk_details=pain_details,
            movement_risk=movement_risk,
            movement_risk_details=movement_details,
            missed_days_risk=missed_days_risk,
            missed_days_risk_details=missed_days_details,
            overall_score=overall_score,
            recommendations=recommendations,
            needs_urgent_follow_up=needs_urgent_follow_up,
            follow_up_priority=follow_up_priority,
            created_at=datetime.now(),
        )

    def assess_batch_risk(self, metrics_dict: Dict[str, SummaryMetrics]) -> Dict[str, RiskAssessment]:
        results = {}

        for patient_id, metrics in metrics_dict.items():
            assessment = self.assess_risk(metrics)
            results[patient_id] = assessment

        return results

    def get_risk_level_distribution(self, assessments: Dict[str, RiskAssessment]) -> Dict[str, int]:
        distribution = {
            RiskLevel.LOW.value: 0,
            RiskLevel.MEDIUM.value: 0,
            RiskLevel.HIGH.value: 0,
            RiskLevel.CRITICAL.value: 0,
        }

        for assessment in assessments.values():
            distribution[assessment.risk_level.value] += 1

        return distribution
