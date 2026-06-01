from typing import List, Dict, Any
from .config import ParameterManager
from .estimator import HoleSample


METHOD_EXPLANATIONS = {
    "delaunay": "使用Delaunay三角剖分法计算3D网格表面积，通过逐个三角形求和得到孔洞的精确面积。",
    "statistical_approximation": "由于缺少精确几何数据，基于历史样本的正态分布统计模型进行面积估算。",
    "circle_from_diameter": "将孔洞近似为圆形，通过测量直径计算面积（面积=π*(直径/2)²）。",
    "bounding_box": "将孔洞近似为矩形，使用外接包围盒的宽高乘积估算面积。"
}


class ResultExplainer:
    def __init__(self, param_manager: ParameterManager):
        self.pm = param_manager

    def explain_sample(self, sample: HoleSample) -> Dict[str, Any]:
        explanation = {
            "sample_id": sample.sample_id,
            "final_area": sample.manual_override if sample.manual_override is not None else sample.estimated_area,
            "unit": self.pm.get("hole_area_estimation.area_unit", "mm2"),
            "has_manual_override": sample.manual_override is not None,
            "result_type": self._classify_result(sample),
            "summary": self._generate_summary(sample),
            "estimation_details": self._generate_estimation_details(sample),
            "confidence_assessment": self._assess_confidence(sample),
            "recommendation": self._generate_recommendation(sample),
            "audit_trail": self._generate_audit_trail(sample)
        }

        if sample.is_anomaly:
            explanation["anomaly_analysis"] = self._generate_anomaly_analysis(sample)

        return explanation

    def explain_batch(self, samples: List[HoleSample]) -> List[Dict[str, Any]]:
        return [self.explain_sample(s) for s in samples]

    def _classify_result(self, sample: HoleSample) -> str:
        if sample.manual_override is not None:
            return "人工修正"
        if sample.is_anomaly:
            return "异常样本"
        if sample.metadata.get("is_boundary"):
            return "边界样本"
        if sample.estimation_method == "statistical_approximation":
            return "统计估算"
        return "正常计算"

    def _generate_summary(self, sample: HoleSample) -> str:
        area = sample.estimated_area
        final = sample.manual_override if sample.manual_override is not None else area
        unit = self.pm.get("hole_area_estimation.area_unit", "mm2")

        if sample.manual_override is not None:
            return (f"样本 {sample.sample_id} 最终面积为 {final:.{self._get_decimals()}f} {unit}，"
                   f"原始估算值为 {area:.{self._get_decimals()}f} {unit}，"
                   f"已由 {sample.manual_operator or '未知操作员'} 人工修正。")
        else:
            return (f"样本 {sample.sample_id} 估算面积为 {area:.{self._get_decimals()}f} {unit}，"
                   f"使用 {self._translate_method(sample.estimation_method)} 方法计算。")

    def _generate_estimation_details(self, sample: HoleSample) -> Dict[str, Any]:
        method = sample.estimation_method or "unknown"
        details = {
            "method": method,
            "method_explanation": METHOD_EXPLANATIONS.get(method, "自定义估算方法"),
            "data_source": sample.source,
            "processed_at": sample.processed_at,
            "input_data_summary": self._summarize_input(sample.raw_data)
        }

        if "vertex_count" in sample.metadata:
            details["mesh_quality"] = {
                "vertices": sample.metadata["vertex_count"],
                "faces": sample.metadata.get("face_count", 0)
            }

        if sample.confidence_interval:
            details["confidence_interval"] = {
                "lower": sample.confidence_interval[0],
                "upper": sample.confidence_interval[1],
                "confidence_level": self.pm.get("hole_area_estimation.confidence_level")
            }

        if "warning" in sample.metadata:
            details["warning"] = sample.metadata["warning"]

        return details

    def _summarize_input(self, raw_data: Dict[str, Any]) -> str:
        parts = []
        if "vertices" in raw_data:
            parts.append(f"{len(raw_data['vertices'])}个顶点")
        if "faces" in raw_data:
            parts.append(f"{len(raw_data['faces'])}个三角面")
        if "contour_points" in raw_data:
            parts.append(f"{len(raw_data['contour_points'])}个轮廓点")
        if "measured_diameter" in raw_data:
            parts.append(f"测量直径={raw_data['measured_diameter']}")
        if "quality_score" in raw_data:
            parts.append(f"质量分={raw_data['quality_score']:.2f}")
        if not parts:
            parts.append("仅含元数据，无几何信息")
        return "，".join(parts)

    def _assess_confidence(self, sample: HoleSample) -> Dict[str, Any]:
        score = 1.0
        factors = []

        if sample.estimation_method == "statistical_approximation":
            score -= 0.3
            factors.append("无精确几何数据，使用统计近似")

        if sample.confidence_interval:
            ci_range = sample.confidence_interval[1] - sample.confidence_interval[0]
            area = sample.estimated_area or 1.0
            ci_ratio = ci_range / area if area > 0 else 1.0
            if ci_ratio > 0.3:
                score -= 0.2
                factors.append(f"置信区间较宽 (±{ci_ratio*100:.1f}%)")
            elif ci_ratio > 0.1:
                score -= 0.1
                factors.append(f"置信区间适度 (±{ci_ratio*100:.1f}%)")

        quality = sample.raw_data.get("quality_score", 1.0)
        if quality < 0.5:
            score -= 0.2
            factors.append(f"输入数据质量较低 ({quality:.2f})")
        elif quality < 0.8:
            score -= 0.1
            factors.append(f"输入数据质量一般 ({quality:.2f})")

        if sample.is_anomaly:
            score -= 0.2
            factors.append("被标记为异常样本")

        if sample.metadata.get("is_boundary"):
            score -= 0.15
            factors.append("样本量不足，属于边界样本")

        level = "高" if score >= 0.8 else ("中" if score >= 0.5 else "低")

        return {
            "confidence_score": max(0.0, min(1.0, score)),
            "confidence_level": level,
            "contributing_factors": factors if factors else ["所有评估指标正常"]
        }

    def _generate_recommendation(self, sample: HoleSample) -> Dict[str, Any]:
        recommendations = []
        priority = "正常"

        if sample.manual_override is not None:
            recommendations.append("已人工修正，建议记录修正原因并确认是否需要调整算法参数。")
            priority = "已处理"
            return {
                "priority": priority,
                "actions": recommendations,
                "needs_review": False
            }

        if sample.is_anomaly:
            recommendations.append("建议人工复核此样本，重点关注异常原因。")
            priority = "高"

        if sample.estimation_method == "statistical_approximation":
            recommendations.append("建议补充该样本的几何测量数据以提高估算精度。")
            priority = "中" if priority == "正常" else priority

        confidence = self._assess_confidence(sample)
        if confidence["confidence_level"] == "低":
            recommendations.append("置信度低，建议优先核实数据来源和测量方法。")
            priority = "高"

        if not recommendations:
            recommendations.append("结果正常，无需额外处理。")

        return {
            "priority": priority,
            "actions": recommendations,
            "needs_review": priority in ["高", "中"]
        }

    def _generate_anomaly_analysis(self, sample: HoleSample) -> Dict[str, Any]:
        return {
            "anomaly_count": len(sample.anomaly_reasons),
            "reasons": sample.anomaly_reasons,
            "suggested_actions": [
                self._suggest_action_for_reason(r) for r in sample.anomaly_reasons
            ],
            "statistics_context": sample.metadata.get("statistics_context", {})
        }

    def _suggest_action_for_reason(self, reason: str) -> str:
        if "Z分数" in reason or "IQR" in reason:
            return "检查该样本是否为真实异常，或调整异常检测阈值。"
        if "业务最小阈值" in reason:
            return "确认该孔洞是否过小需要特殊处理，或调整业务阈值。"
        if "业务最大阈值" in reason:
            return "确认是否存在测量误差或数据录入错误。"
        if "数据质量分数" in reason:
            return "建议重新扫描或测量该样本以提高数据质量。"
        if "样本量不足" in reason:
            return "建议补充更多样本，或手动确认边界样本的估算结果。"
        if "无法估算面积" in reason:
            return "检查原始数据是否包含必要的几何信息。"
        return "建议人工复核。"

    def _generate_audit_trail(self, sample: HoleSample) -> Dict[str, Any]:
        trail = {
            "source": sample.source,
            "processed_at": sample.processed_at,
            "algorithm_parameters_used": self._get_relevant_params(),
            "manual_override": None
        }

        if sample.manual_override is not None:
            trail["manual_override"] = {
                "old_value": sample.estimated_area,
                "new_value": sample.manual_override,
                "operator": sample.manual_operator,
                "note": sample.manual_note
            }

        return trail

    def _get_relevant_params(self) -> Dict[str, Any]:
        return {
            "min_hole_area": self.pm.get("hole_area_estimation.min_hole_area"),
            "max_hole_area": self.pm.get("hole_area_estimation.max_hole_area"),
            "outlier_z_score_threshold": self.pm.get("hole_area_estimation.outlier_z_score_threshold"),
            "iqr_multiplier": self.pm.get("anomaly_detection.iqr_multiplier"),
            "confidence_level": self.pm.get("hole_area_estimation.confidence_level")
        }

    def _get_decimals(self) -> int:
        return self.pm.get("reporting.decimal_places", 3)

    def _translate_method(self, method: str) -> str:
        translations = {
            "delaunay": "Delaunay三角剖分",
            "statistical_approximation": "统计近似",
            "circle_from_diameter": "直径法圆形近似",
            "bounding_box": "包围盒法矩形近似"
        }
        return translations.get(method, method)

    def generate_executive_summary(self, samples: List[HoleSample],
                                   anomaly_summary: Dict[str, Any]) -> str:
        lines = []
        lines.append("=== 3D网格孔洞面积估算 执行摘要 ===")
        lines.append(f"总样本数: {anomaly_summary['total_samples']}")
        lines.append(f"正常样本: {anomaly_summary['normal_count']} "
                    f"({anomaly_summary['normal_count']/anomaly_summary['total_samples']*100:.1f}%)")
        lines.append(f"异常样本: {anomaly_summary['anomaly_count']} "
                    f"({anomaly_summary['anomaly_rate']*100:.1f}%)")
        lines.append("")
        lines.append(f"面积范围: {anomaly_summary['areas']['min']:.{self._get_decimals()}f} ~ "
                    f"{anomaly_summary['areas']['max']:.{self._get_decimals()}f} "
                    f"{self.pm.get('hole_area_estimation.area_unit', 'mm2')}")
        lines.append(f"面积均值: {anomaly_summary['areas']['mean']:.{self._get_decimals()}f} "
                    f"{self.pm.get('hole_area_estimation.area_unit', 'mm2')}")
        lines.append("")

        manual_count = sum(1 for s in samples if s.manual_override is not None)
        if manual_count > 0:
            lines.append(f"人工修正样本: {manual_count} 个")
            lines.append("")

        if anomaly_summary["anomaly_count"] > 0:
            lines.append("异常原因分布:")
            for reason, count in sorted(anomaly_summary["reason_distribution"].items(),
                                       key=lambda x: -x[1]):
                lines.append(f"  - {count}次: {reason}")
            lines.append("")

        lines.append("建议处理优先级:")
        high = sum(1 for s in samples
                   if self._generate_recommendation(s)["priority"] == "高")
        medium = sum(1 for s in samples
                     if self._generate_recommendation(s)["priority"] == "中")
        lines.append(f"  高优先级: {high} 个样本需立即复核")
        lines.append(f"  中优先级: {medium} 个样本建议复核")
        lines.append(f"  正常: {anomaly_summary['total_samples'] - high - medium} 个样本")

        return "\n".join(lines)
