"""风险报告生成器"""

from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict
import uuid

from .models import (
    RiskAssessment, RiskReport, RiskLevel, RiskType,
    CustomerProfile, APIKey, AccessLog
)


class ReportGenerator:
    """风险报告生成器"""

    def generate_customer_report(self,
                                  customer: CustomerProfile,
                                  assessments: List[RiskAssessment],
                                  logs: List[AccessLog]) -> RiskReport:
        all_evidences = []
        for assessment in assessments:
            all_evidences.extend(assessment.evidences)

        overall_score = self._aggregate_score(assessments)
        risk_level = self._determine_aggregated_level(assessments)

        return RiskReport(
            report_id=str(uuid.uuid4()),
            dimension="customer",
            dimension_value=f"{customer.customer_id} ({customer.customer_name})",
            risk_level=risk_level,
            total_calls=len(logs),
            evidences=all_evidences,
            recommendations=self._generate_customer_recommendations(assessments, risk_level),
            generate_time=datetime.now()
        )

    def generate_key_report(self,
                            api_key: APIKey,
                            assessment: RiskAssessment,
                            logs: List[AccessLog]) -> RiskReport:
        return RiskReport(
            report_id=str(uuid.uuid4()),
            dimension="key",
            dimension_value=f"{api_key.key_id}",
            risk_level=assessment.risk_level,
            total_calls=len(logs),
            evidences=assessment.evidences,
            recommendations=assessment.recommendations,
            generate_time=datetime.now()
        )

    def generate_api_report(self,
                            endpoint: str,
                            assessments: List[RiskAssessment],
                            logs: List[AccessLog]) -> RiskReport:
        all_evidences = []
        for assessment in assessments:
            for evidence in assessment.evidences:
                if self._evidence_related_to_endpoint(evidence, endpoint):
                    all_evidences.append(evidence)

        risk_level = self._determine_aggregated_level(assessments)

        return RiskReport(
            report_id=str(uuid.uuid4()),
            dimension="api",
            dimension_value=endpoint,
            risk_level=risk_level,
            total_calls=len(logs),
            evidences=all_evidences,
            recommendations=self._generate_api_recommendations(all_evidences, risk_level),
            generate_time=datetime.now()
        )

    def format_report_text(self, report: RiskReport, detailed: bool = True) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append(f"风险报告 - {report.dimension.upper()} 维度")
        lines.append("=" * 60)
        lines.append(f"报告ID: {report.report_id}")
        lines.append(f"分析对象: {report.dimension_value}")
        lines.append(f"生成时间: {report.generate_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总调用次数: {report.total_calls}")
        lines.append(f"风险等级: {self._format_risk_level(report.risk_level)}")
        lines.append("")

        lines.append("-" * 60)
        lines.append("风险证据:")
        lines.append("-" * 60)

        if not report.evidences:
            lines.append("  未发现风险证据，状态正常")
        else:
            evidence_groups = defaultdict(list)
            for evidence in report.evidences:
                evidence_groups[evidence.risk_type].append(evidence)

            for risk_type, evidences in evidence_groups.items():
                lines.append(f"")
                lines.append(f"  [{self._format_risk_type(risk_type)}]")
                for i, evidence in enumerate(evidences, 1):
                    lines.append(f"    {i}. {evidence.description}")
                    lines.append(f"       严重度: {evidence.severity:.2%}")
                    if detailed:
                        lines.append(f"       支持数据: {self._format_supporting_data(evidence.supporting_data)}")

        lines.append("")
        lines.append("-" * 60)
        lines.append("建议动作:")
        lines.append("-" * 60)

        for i, rec in enumerate(report.recommendations, 1):
            lines.append(f"  {i}. {rec}")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)

    def _aggregate_score(self, assessments: List[RiskAssessment]) -> float:
        if not assessments:
            return 0.0
        return max(a.overall_score for a in assessments)

    def _determine_aggregated_level(self, assessments: List[RiskAssessment]) -> RiskLevel:
        if not assessments:
            return RiskLevel.LOW

        level_order = [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]
        for level in level_order:
            if any(a.risk_level == level for a in assessments):
                return level
        return RiskLevel.LOW

    def _evidence_related_to_endpoint(self, evidence, endpoint: str) -> bool:
        data = evidence.supporting_data
        if "sensitive_endpoints" in data:
            return endpoint in data["sensitive_endpoints"]
        return True

    def _generate_customer_recommendations(self,
                                             assessments: List[RiskAssessment],
                                             risk_level: RiskLevel) -> List[str]:
        all_recommendations = set()
        for assessment in assessments:
            for rec in assessment.recommendations:
                all_recommendations.add(rec)
        return list(all_recommendations)

    def _generate_api_recommendations(self,
                                       evidences,
                                       risk_level: RiskLevel) -> List[str]:
        recommendations = []

        if risk_level == RiskLevel.CRITICAL:
            recommendations.append("立即暂停该接口的异常访问密钥")
            recommendations.append("启动接口级别的安全调查")
        elif risk_level == RiskLevel.HIGH:
            recommendations.append("限制该接口的访问频率")
            recommendations.append("监控异常密钥的行为")

        risk_types = {e.risk_type for e in evidences}
        if RiskType.SENSITIVE_API in risk_types:
            recommendations.append("收紧该接口的访问权限配置")
        if RiskType.FAILURE_RATE in risk_types:
            recommendations.append("检查是否存在针对该接口的攻击")

        if not recommendations:
            recommendations.append("继续常规监控")

        return recommendations

    def _format_risk_level(self, level: RiskLevel) -> str:
        level_map = {
            RiskLevel.LOW: "低风险",
            RiskLevel.MEDIUM: "中风险",
            RiskLevel.HIGH: "高风险",
            RiskLevel.CRITICAL: "严重风险",
        }
        return level_map.get(level, "未知")

    def _format_risk_type(self, risk_type: RiskType) -> str:
        type_map = {
            RiskType.VOLUME_SPIKE: "调用量突增",
            RiskType.UNUSUAL_REGION: "非常用地区访问",
            RiskType.SENSITIVE_API: "敏感接口异常",
            RiskType.FAILURE_RATE: "失败率异常",
            RiskType.MULTI_IP: "多IP分散访问",
        }
        return type_map.get(risk_type, "未知风险")

    def _format_supporting_data(self, data: Dict) -> str:
        formatted = []
        for key, value in data.items():
            if isinstance(value, float):
                formatted.append(f"{key}: {value:.2f}")
            elif isinstance(value, dict):
                formatted.append(f"{key}: {dict(value)}")
            elif isinstance(value, list):
                formatted.append(f"{key}: {list(value)}")
            else:
                formatted.append(f"{key}: {value}")
        return "; ".join(formatted)
