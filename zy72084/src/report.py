import os
import re
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from .config import ParameterManager
from .estimator import HoleSample
from .explainer import ResultExplainer
from .anomaly import AnomalyDetector


MANUAL_NOTES_MARKER = "<!-- MANUAL_NOTES_START -->"
MANUAL_NOTES_END_MARKER = "<!-- MANUAL_NOTES_END -->"
AUTO_SECTION_MARKER = "<!-- AUTO_GENERATED_START -->"
AUTO_SECTION_END_MARKER = "<!-- AUTO_GENERATED_END -->"


class ReportGenerator:
    def __init__(self, param_manager: ParameterManager,
                 explainer: ResultExplainer,
                 anomaly_detector: AnomalyDetector):
        self.pm = param_manager
        self.explainer = explainer
        self.anomaly_detector = anomaly_detector

    def generate_executive_report(self, samples: List[HoleSample],
                                 output_path: str,
                                 manual_notes_path: Optional[str] = None,
                                 previous_report_path: Optional[str] = None) -> str:
        anomaly_summary = self.anomaly_detector.get_anomaly_summary(samples)

        manual_notes = self._load_manual_notes(manual_notes_path, previous_report_path)
        auto_content = self._generate_auto_section(samples, anomaly_summary)

        if previous_report_path and os.path.exists(previous_report_path):
            previous_manual_notes = self._extract_manual_notes(previous_report_path)
            if previous_manual_notes and previous_manual_notes != manual_notes:
                manual_notes = self._merge_manual_notes(manual_notes, previous_manual_notes)

        full_report = self._assemble_report(manual_notes, auto_content, anomaly_summary)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(full_report)

        return full_report

    def _load_manual_notes(self, notes_path: Optional[str],
                           previous_report_path: Optional[str]) -> str:
        if notes_path and os.path.exists(notes_path):
            with open(notes_path, "r", encoding="utf-8") as f:
                return f.read().strip()

        if previous_report_path and os.path.exists(previous_report_path):
            extracted = self._extract_manual_notes(previous_report_path)
            if extracted:
                return extracted

        return (
            "> **人工备注区**：老板在此处添加的备注不会被自动生成覆盖\n"
            "> \n"
            "> 请在此处记录需要特别说明的内容..."
        )

    def _extract_manual_notes(self, report_path: str) -> Optional[str]:
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()

            pattern = f"{re.escape(MANUAL_NOTES_MARKER)}(.*?){re.escape(MANUAL_NOTES_END_MARKER)}"
            match = re.search(pattern, content, re.DOTALL)
            if match:
                return match.group(1).strip()
        except Exception:
            pass
        return None

    def _merge_manual_notes(self, new_notes: str, old_notes: str) -> str:
        if not old_notes:
            return new_notes
        if not new_notes or new_notes.startswith("> **人工备注区**"):
            return old_notes

        merged_parts = [
            "---",
            f"**[历史备注 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 前]**",
            old_notes,
            "",
            "---",
            f"**[本次备注]**",
            new_notes
        ]
        return "\n".join(merged_parts)

    def _generate_auto_section(self, samples: List[HoleSample],
                               anomaly_summary: Dict[str, Any]) -> str:
        lines = []

        lines.append("## 📊 3D网格孔洞面积估算结果")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**样本总数**: {anomaly_summary['total_samples']}")
        lines.append(f"**异常样本**: {anomaly_summary['anomaly_count']} "
                    f"({anomaly_summary['anomaly_rate']*100:.1f}%)")
        lines.append("")

        lines.append(self.explainer.generate_executive_summary(samples, anomaly_summary))
        lines.append("")

        lines.append("---")
        lines.append("### 📋 详细结果表")
        lines.append("")

        decimals = self.pm.get("reporting.decimal_places", 3)
        unit = self.pm.get("hole_area_estimation.area_unit", "mm2")

        header = (
            "| 样本ID | 最终面积 | 估算值 | 人工修正 | 结果类型 | "
            "置信度 | 异常状态 | 处理时间 | 来源 |"
        )
        separator = (
            "|--------|---------|-------|---------|---------|"
            "-------|---------|---------|------|"
        )
        lines.append(header)
        lines.append(separator)

        for sample in sorted(samples, key=lambda s: s.sample_id):
            final = sample.manual_override if sample.manual_override is not None else sample.estimated_area
            estimated = sample.estimated_area
            override = sample.manual_override if sample.manual_override is not None else "-"
            result_type = self.explainer._classify_result(sample)
            confidence = self.explainer._assess_confidence(sample)
            anomaly = "❌ 异常" if sample.is_anomaly else "✅ 正常"
            processed_at = sample.processed_at or "-"
            source = sample.source

            anomaly_flag = "⚠️ " if sample.is_anomaly else ""
            manual_flag = "✏️ " if sample.manual_override is not None else ""

            if final is not None:
                final_str = f"{final:.{decimals}f}"
            else:
                final_str = "N/A"
            if estimated is not None:
                est_str = f"{estimated:.{decimals}f}"
            else:
                est_str = "N/A"

            lines.append(
                f"| {anomaly_flag}{manual_flag}{sample.sample_id} | "
                f"{final_str} {unit} | "
                f"{est_str} {unit} | "
                f"{override} | "
                f"{result_type} | "
                f"{confidence['confidence_level']} ({confidence['confidence_score']:.0%}) | "
                f"{anomaly} | "
                f"{processed_at} | "
                f"{source} |"
            )

        lines.append("")
        lines.append("---")

        if anomaly_summary["anomaly_count"] > 0:
            lines.append("### ⚠️ 异常清单")
            lines.append("")
            for idx, anomaly in enumerate(anomaly_summary["anomaly_samples"], 1):
                lines.append(f"#### {idx}. {anomaly['sample_id']}")
                lines.append(f"- **估算面积**: {anomaly['estimated_area']:.{decimals}f} {unit}")
                if anomaly["manual_override"] is not None:
                    lines.append(f"- **人工修正**: {anomaly['manual_override']:.{decimals}f} {unit}")
                lines.append(f"- **最终面积**: {anomaly['final_area']:.{decimals}f} {unit}")
                lines.append(f"- **来源**: {anomaly['source']}")
                lines.append(f"- **处理时间**: {anomaly['processed_at']}")
                lines.append("- **异常原因**:")
                for reason in anomaly["reasons"]:
                    lines.append(f"  - {reason}")
                lines.append("")

        lines.append("---")
        lines.append("### 🔍 参数与审计信息")
        lines.append("")

        param_diff = self.pm.diff_from_default()
        if param_diff:
            lines.append(f"⚠️ **警告**: 共有 {len(param_diff)} 个参数被人工调整")
            lines.append("")
            for key, info in param_diff.items():
                lines.append(f"- `{key}`: {info['default']} → **{info['current']}**")
        else:
            lines.append("✅ 所有参数使用默认值")
        lines.append("")

        lines.append("---")
        lines.append("### 📝 单样本详细解释")
        lines.append("> 点击展开查看每个样本的详细判断依据和建议")
        lines.append("")

        for sample in sorted(samples, key=lambda s: s.sample_id):
            explanation = self.explainer.explain_sample(sample)
            lines.append(f"<details>")
            lines.append(f"<summary><b>{sample.sample_id}</b> - {explanation['summary']}</summary>")
            lines.append("")
            lines.append(f"**结果类型**: {explanation['result_type']}  ")
            lines.append(f"**置信度**: {explanation['confidence_assessment']['confidence_level']} "
                        f"({explanation['confidence_assessment']['confidence_score']:.0%})  ")
            lines.append("")

            lines.append("**估算详情**:")
            ed = explanation['estimation_details']
            lines.append(f"- 方法: {ed['method']} - {ed['method_explanation']}")
            lines.append(f"- 输入数据: {ed['input_data_summary']}")
            if 'confidence_interval' in ed:
                ci = ed['confidence_interval']
                lines.append(f"- 置信区间: [{ci['lower']:.{decimals}f}, {ci['upper']:.{decimals}f}] {unit} "
                            f"(置信度 {ci['confidence_level']:.0%})")
            if 'warning' in ed:
                lines.append(f"- ⚠️ {ed['warning']}")
            lines.append("")

            lines.append("**置信度影响因素**:")
            for factor in explanation['confidence_assessment']['contributing_factors']:
                lines.append(f"- {factor}")
            lines.append("")

            if 'anomaly_analysis' in explanation:
                aa = explanation['anomaly_analysis']
                lines.append("**异常分析**:")
                for reason in aa['reasons']:
                    lines.append(f"- ❌ {reason}")
                lines.append("")
                lines.append("**建议行动**:")
                for action in aa['suggested_actions']:
                    lines.append(f"- 💡 {action}")
                lines.append("")

            rec = explanation['recommendation']
            lines.append(f"**处理优先级**: {rec['priority']}")
            lines.append("**建议**:")
            for action in rec['actions']:
                lines.append(f"- {action}")
            lines.append("")

            lines.append("**审计追踪**:")
            at = explanation['audit_trail']
            lines.append(f"- 数据来源: {at['source']}")
            lines.append(f"- 处理时间: {at['processed_at']}")
            if at['manual_override']:
                mo = at['manual_override']
                lines.append(f"- 人工修正: {mo['old_value']:.{decimals}f} → {mo['new_value']:.{decimals}f}")
                lines.append(f"  操作员: {mo['operator']}")
                if mo['note']:
                    lines.append(f"  备注: {mo['note']}")
            lines.append("")

            lines.append(f"</details>")
            lines.append("")

        return "\n".join(lines)

    def _assemble_report(self, manual_notes: str, auto_content: str,
                         anomaly_summary: Dict[str, Any]) -> str:
        decimals = self.pm.get("reporting.decimal_places", 3)
        unit = self.pm.get("hole_area_estimation.area_unit", "mm2")

        parts = []

        parts.append("# 📄 3D网格孔洞面积估算 汇总报告")
        parts.append("")
        parts.append("> **⚠️ 重要说明**: 此报告分为两部分")
        parts.append("> - 顶部 **人工备注区** 的内容 **不会** 被自动生成覆盖")
        parts.append("> - 下方 **自动生成区** 的内容会在每次运行时更新")
        parts.append("")

        parts.append("---")
        parts.append("")
        parts.append("## ✏️ 人工备注区")
        parts.append(MANUAL_NOTES_MARKER)
        parts.append(manual_notes)
        parts.append(MANUAL_NOTES_END_MARKER)
        parts.append("")
        parts.append("---")
        parts.append("")

        parts.append(AUTO_SECTION_MARKER)
        parts.append(auto_content)
        parts.append(AUTO_SECTION_END_MARKER)

        parts.append("")
        parts.append("---")
        parts.append("")
        parts.append("> 📌 **数据溯源信息**")
        parts.append(f"> - 报告生成时间: {datetime.now().isoformat()}")
        parts.append(f"> - 面积单位: {unit}")
        parts.append(f"> - 小数精度: {decimals} 位")
        parts.append(f"> - 异常检测阈值: Z-score > "
                    f"{self.pm.get('hole_area_estimation.outlier_z_score_threshold')}, "
                    f"IQR 乘数 > {self.pm.get('anomaly_detection.iqr_multiplier')}")

        return "\n".join(parts)

    def generate_json_export(self, samples: List[HoleSample],
                           output_path: str,
                           include_explanations: bool = True) -> None:
        result = {
            "exported_at": datetime.now().isoformat(),
            "unit": self.pm.get("hole_area_estimation.area_unit", "mm2"),
            "decimal_places": self.pm.get("reporting.decimal_places", 3),
            "parameters": self.pm.get_all(),
            "user_modified_params": self.pm.get_user_modified(),
            "param_diff_from_default": self.pm.diff_from_default(),
            "summary": self.anomaly_detector.get_anomaly_summary(samples),
            "samples": []
        }

        for sample in samples:
            sample_data = sample.to_dict()
            if include_explanations:
                sample_data["explanation"] = self.explainer.explain_sample(sample)
            result["samples"].append(sample_data)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

    def generate_anomaly_report(self, samples: List[HoleSample],
                               output_path: str) -> None:
        anomaly_summary = self.anomaly_detector.get_anomaly_summary(samples)
        anomalies = [s for s in samples if s.is_anomaly]

        lines = []
        lines.append("# ⚠️ 3D网格孔洞面积估算 异常清单")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**总样本数**: {anomaly_summary['total_samples']}")
        lines.append(f"**异常数**: {anomaly_summary['anomaly_count']}")
        lines.append(f"**异常率**: {anomaly_summary['anomaly_rate']*100:.1f}%")
        lines.append("")

        if anomaly_summary["reason_distribution"]:
            lines.append("## 📊 异常原因分布")
            lines.append("")
            for reason, count in sorted(anomaly_summary["reason_distribution"].items(),
                                       key=lambda x: -x[1]):
                pct = count / anomaly_summary['anomaly_count'] * 100
                lines.append(f"- [{count}次 ({pct:.1f}%)] {reason}")
            lines.append("")

        lines.append("## 📋 异常样本明细")
        lines.append("")

        decimals = self.pm.get("reporting.decimal_places", 3)
        unit = self.pm.get("hole_area_estimation.area_unit", "mm2")

        for idx, sample in enumerate(sorted(anomalies, key=lambda s: s.sample_id), 1):
            explanation = self.explainer.explain_sample(sample)
            lines.append(f"### {idx}. {sample.sample_id}")
            lines.append("")
            lines.append(f"| 字段 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 估算面积 | {sample.estimated_area:.{decimals}f} {unit} |")
            if sample.manual_override is not None:
                lines.append(f"| 人工修正 | {sample.manual_override:.{decimals}f} {unit} |")
                lines.append(f"| 修正人员 | {sample.manual_operator} |")
                lines.append(f"| 修正备注 | {sample.manual_note} |")
            lines.append(f"| 最终面积 | {explanation['final_area']:.{decimals}f} {unit} |")
            lines.append(f"| 置信度 | {explanation['confidence_assessment']['confidence_level']} "
                        f"({explanation['confidence_assessment']['confidence_score']:.0%}) |")
            lines.append(f"| 数据来源 | {sample.source} |")
            lines.append(f"| 处理时间 | {sample.processed_at} |")
            lines.append("")

            lines.append("**异常原因**:")
            for reason in sample.anomaly_reasons:
                lines.append(f"- ❌ {reason}")
            lines.append("")

            lines.append("**建议行动**:")
            if 'anomaly_analysis' in explanation:
                for action in explanation['anomaly_analysis']['suggested_actions']:
                    lines.append(f"- 💡 {action}")
            lines.append("")

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def generate_simple_csv(self, samples: List[HoleSample],
                           output_path: str) -> None:
        import csv

        decimals = self.pm.get("reporting.decimal_places", 3)
        unit = self.pm.get("hole_area_estimation.area_unit", "mm2")

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "样本ID",
                f"最终面积({unit})",
                f"估算面积({unit})",
                f"人工修正({unit})",
                "结果类型",
                "置信度",
                "是否异常",
                "异常原因",
                "处理时间",
                "来源"
            ])

            for sample in sorted(samples, key=lambda s: s.sample_id):
                final = sample.manual_override if sample.manual_override is not None else sample.estimated_area
                writer.writerow([
                    sample.sample_id,
                    f"{final:.{decimals}f}" if final is not None else "",
                    f"{sample.estimated_area:.{decimals}f}" if sample.estimated_area is not None else "",
                    f"{sample.manual_override:.{decimals}f}" if sample.manual_override is not None else "",
                    self.explainer._classify_result(sample),
                    self.explainer._assess_confidence(sample)["confidence_level"],
                    "是" if sample.is_anomaly else "否",
                    "; ".join(sample.anomaly_reasons),
                    sample.processed_at or "",
                    sample.source
                ])
