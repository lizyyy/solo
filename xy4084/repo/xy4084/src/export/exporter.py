from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import io
import pandas as pd

from config import config, ensure_directories
from src.models import (
    SummaryMetrics,
    RiskAssessment,
    RiskLevel,
)


class ReportExporter:
    def __init__(self):
        ensure_directories()
        self.export_dir = config.EXPORT_DIR

    def generate_markdown_report(
        self,
        patient_info: Optional[Dict[str, Any]],
        metrics: Optional[SummaryMetrics],
        risk_assessment: Optional[RiskAssessment],
        report_type: str = "single_patient",
        additional_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        lines = []

        title_date = date.today().strftime("%Y年%m月%d日")

        if report_type == "single_patient":
            lines.append(f"# 患者训练随访周报 - {title_date}")
            lines.append("")

            if patient_info:
                lines.append("## 患者基本信息")
                lines.append("")
                lines.append(f"- **患者ID**: {patient_info.get('patient_id', 'N/A')}")
                lines.append(f"- **姓名**: {patient_info.get('name', 'N/A')}")
                lines.append(f"- **年龄**: {patient_info.get('age', 'N/A')}岁")
                lines.append(f"- **性别**: {patient_info.get('gender', 'N/A')}")
                lines.append(f"- **诊断**: {patient_info.get('primary_diagnosis', 'N/A')}")
                lines.append("")

            if metrics:
                lines.append("## 周期训练指标")
                lines.append("")
                lines.append(f"- **统计周期**: {metrics.period_start} 至 {metrics.period_end}")
                lines.append("")
                lines.append("### 训练依从性")
                lines.append(f"- **依从率**: {metrics.compliance_rate:.1%}")
                lines.append(f"- **训练天数**: {metrics.completed_training_days}/{metrics.total_training_days}天")
                lines.append(f"- **缺训天数**: {metrics.missed_days_count}天")
                lines.append(f"- **连续缺训**: {metrics.consecutive_missed_days}天")
                lines.append(f"- **平均训练时长**: {metrics.average_duration_minutes:.1f}分钟")
                lines.append("")

                lines.append("### 疼痛评分")
                lines.append(f"- **平均疼痛评分**: {metrics.average_pain_score:.1f}/10")
                lines.append(f"- **疼痛变化**: {metrics.pain_score_change:+.1f}")
                lines.append("")

                lines.append("### 动作完成质量")
                lines.append(f"- **平均完成分数**: {metrics.average_movement_score:.1f}")
                lines.append(f"- **动作稳定性**: {'良好' if metrics.movement_volatility < 0.25 else '需关注'} (变异系数 {metrics.movement_volatility:.2%})")
                lines.append("")

                if metrics.training_programs:
                    lines.append("### 参与训练项目")
                    for prog in metrics.training_programs:
                        lines.append(f"- {prog}")
                    lines.append("")

                if metrics.notes_history:
                    lines.append("### 备注记录")
                    for note in metrics.notes_history:
                        lines.append(f"- **{note['date']}** [{note['type']}]: {note['note']}")
                    lines.append("")

            if risk_assessment:
                lines.append("## 风险评估")
                lines.append("")
                
                risk_level_names = {
                    RiskLevel.LOW: "低风险",
                    RiskLevel.MEDIUM: "中风险",
                    RiskLevel.HIGH: "高风险",
                    RiskLevel.CRITICAL: "危急风险",
                }
                lines.append(f"- **风险等级**: {risk_level_names.get(risk_assessment.risk_level, '未知')}")
                lines.append(f"- **综合风险评分**: {risk_assessment.overall_score:.2f}")
                lines.append(f"- **随访优先级**: {'紧急' if risk_assessment.follow_up_priority == 'urgent' else ('高' if risk_assessment.follow_up_priority == 'high' else ('中' if risk_assessment.follow_up_priority == 'medium' else '正常'))}")
                lines.append("")

                if risk_assessment.risk_factors:
                    lines.append("### 风险因素")
                    for factor in risk_assessment.risk_factors:
                        lines.append(f"- **{factor['type']}**: {factor['details']} (风险分数: {factor['score']:.2f})")
                    lines.append("")

                lines.append("### 随访建议")
                for i, rec in enumerate(risk_assessment.recommendations, 1):
                    lines.append(f"{i}. {rec}")
                lines.append("")

        elif report_type == "risk_summary":
            lines.append(f"# 风险患者汇总报告 - {title_date}")
            lines.append("")

            if additional_data and "risk_distribution" in additional_data:
                dist = additional_data["risk_distribution"]
                lines.append("## 风险等级分布")
                lines.append("")
                lines.append(f"- **低风险**: {dist.get('low', 0)}人")
                lines.append(f"- **中风险**: {dist.get('medium', 0)}人")
                lines.append(f"- **高风险**: {dist.get('high', 0)}人")
                lines.append(f"- **危急风险**: {dist.get('critical', 0)}人")
                lines.append("")

            if additional_data and "high_risk_patients" in additional_data:
                patients = additional_data["high_risk_patients"]
                lines.append("## 需重点关注患者")
                lines.append("")

                for patient in patients:
                    patient_name = patient.get("patient_name", "N/A")
                    patient_id = patient.get("patient_id", "N/A")
                    risk_level = patient.get("risk_level", "N/A")
                    lines.append(f"### {patient_name} ({patient_id})")
                    lines.append(f"- **风险等级**: {risk_level}")

                    if "risk_details" in patient:
                        lines.append(f"- **风险详情**: {patient['risk_details']}")

                    if "main_factors" in patient:
                        for factor in patient["main_factors"]:
                            lines.append(f"  - {factor}")
                    lines.append("")

        lines.append("---")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        lines.append("")

        return "\n".join(lines)

    def generate_csv_report(
        self,
        data: List[Dict[str, Any]],
        report_type: str = "metrics_summary",
    ) -> str:
        if not data:
            return ""

        df = pd.DataFrame(data)

        output = io.StringIO()
        df.to_csv(output, index=False, encoding="utf-8-sig")
        return output.getvalue()

    def prepare_patient_metrics_csv_data(
        self,
        metrics_dict: Dict[str, SummaryMetrics],
        patient_info_dict: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        records = []

        for patient_id, metrics in metrics_dict.items():
            patient_name = "N/A"
            if patient_info_dict and patient_id in patient_info_dict:
                patient_name = patient_info_dict[patient_id].get("name", "N/A")

            record = {
                "患者ID": patient_id,
                "患者姓名": patient_name,
                "统计周期开始": str(metrics.period_start),
                "统计周期结束": str(metrics.period_end),
                "依从率": f"{metrics.compliance_rate:.2%}",
                "完成训练天数": metrics.completed_training_days,
                "总训练天数": metrics.total_training_days,
                "缺训天数": metrics.missed_days_count,
                "连续缺训天数": metrics.consecutive_missed_days,
                "平均训练时长(分钟)": metrics.average_duration_minutes,
                "平均疼痛评分": metrics.average_pain_score,
                "疼痛变化": metrics.pain_score_change,
                "平均动作分数": metrics.average_movement_score,
                "动作稳定性(变异系数)": metrics.movement_volatility,
                "训练项目": "、".join(metrics.training_programs) if metrics.training_programs else "",
            }
            records.append(record)

        return records

    def prepare_risk_csv_data(
        self,
        assessments_dict: Dict[str, RiskAssessment],
        patient_info_dict: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        records = []

        risk_level_names = {
            RiskLevel.LOW: "低风险",
            RiskLevel.MEDIUM: "中风险",
            RiskLevel.HIGH: "高风险",
            RiskLevel.CRITICAL: "危急风险",
        }

        for patient_id, assessment in assessments_dict.items():
            patient_name = "N/A"
            if patient_info_dict and patient_id in patient_info_dict:
                patient_name = patient_info_dict[patient_id].get("name", "N/A")

            risk_factors_text = " | ".join(
                [f"{f['type']}: {f['details']}" for f in assessment.risk_factors]
            ) if assessment.risk_factors else ""

            record = {
                "患者ID": patient_id,
                "患者姓名": patient_name,
                "评估日期": str(assessment.assessment_date),
                "风险等级": risk_level_names.get(assessment.risk_level, "未知"),
                "综合风险评分": assessment.overall_score,
                "依从性风险": "是" if assessment.compliance_risk else "否",
                "依从性风险详情": assessment.compliance_risk_details or "",
                "疼痛风险": "是" if assessment.pain_risk else "否",
                "疼痛风险详情": assessment.pain_risk_details or "",
                "动作稳定性风险": "是" if assessment.movement_risk else "否",
                "动作稳定性风险详情": assessment.movement_risk_details or "",
                "缺训风险": "是" if assessment.missed_days_risk else "否",
                "缺训风险详情": assessment.missed_days_risk_details or "",
                "风险因素汇总": risk_factors_text,
                "随访优先级": assessment.follow_up_priority,
                "是否需要紧急随访": "是" if assessment.needs_urgent_follow_up else "否",
                "随访建议": "；".join(assessment.recommendations) if assessment.recommendations else "",
            }
            records.append(record)

        return records

    def save_report_to_file(
        self,
        content: str,
        file_name: str,
        file_type: str = "markdown",
    ) -> Path:
        if file_type == "markdown":
            if not file_name.endswith(".md"):
                file_name = f"{file_name}.md"
        elif file_type == "csv":
            if not file_name.endswith(".csv"):
                file_name = f"{file_name}.csv"

        file_path = self.export_dir / file_name

        if file_type == "markdown":
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
        elif file_type == "csv":
            with open(file_path, "w", encoding="utf-8-sig") as f:
                f.write(content)

        return file_path

    def export_single_patient_report(
        self,
        patient_info: Dict[str, Any],
        metrics: SummaryMetrics,
        risk_assessment: RiskAssessment,
        save_to_file: bool = True,
    ) -> Tuple[str, Optional[Path]]:
        markdown_content = self.generate_markdown_report(
            patient_info=patient_info,
            metrics=metrics,
            risk_assessment=risk_assessment,
            report_type="single_patient",
        )

        file_path = None
        if save_to_file:
            patient_id = patient_info.get("patient_id", "unknown")
            patient_name = patient_info.get("name", "unknown")
            file_name = f"患者报告_{patient_name}_{patient_id}_{date.today().strftime('%Y%m%d')}"
            file_path = self.save_report_to_file(markdown_content, file_name, "markdown")

        return markdown_content, file_path

    def export_risk_summary_report(
        self,
        risk_distribution: Dict[str, int],
        high_risk_patients: List[Dict[str, Any]],
        save_to_file: bool = True,
    ) -> Tuple[str, Optional[Path]]:
        markdown_content = self.generate_markdown_report(
            patient_info=None,
            metrics=None,
            risk_assessment=None,
            report_type="risk_summary",
            additional_data={
                "risk_distribution": risk_distribution,
                "high_risk_patients": high_risk_patients,
            },
        )

        file_path = None
        if save_to_file:
            file_name = f"风险汇总报告_{date.today().strftime('%Y%m%d')}"
            file_path = self.save_report_to_file(markdown_content, file_name, "markdown")

        return markdown_content, file_path
