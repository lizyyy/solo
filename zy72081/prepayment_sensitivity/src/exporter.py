import os
import csv
import json
from typing import List, Dict
from datetime import datetime
from .models import SensitivityResult, DataConflict, AnomalyFlag


class Exporter:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def export_results_csv(
        self,
        results: List[SensitivityResult],
        run_id: str,
    ) -> str:
        filename = f"sensitivity_results_{run_id}.csv"
        filepath = os.path.join(self.output_dir, filename)

        headers = [
            "样本ID",
            "敏感性得分",
            "风险等级",
            "是否需人工复核",
            "复核意见",
            "异常数量",
            "严重异常数量",
            "警告异常数量",
            "异常字段列表",
            "参数版本ID",
            "计算时间",
            "利率成分",
            "期限成分",
            "FICO成分",
            "DTI成分",
            "LTV成分",
            "年龄成分",
            "还款历史成分",
        ]

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for result in results:
                components = self._extract_components(result)
                anomalies = [a.field_name for a in result.anomalies]
                critical_count = sum(1 for a in result.anomalies if a.severity == "critical")
                warning_count = sum(1 for a in result.anomalies if a.severity == "warning")

                writer.writerow([
                    result.sample_id,
                    f"{result.sensitivity_score:.6f}",
                    self._risk_label(result.risk_level),
                    "是" if result.needs_manual_review else "否",
                    result.review_note,
                    len(result.anomalies),
                    critical_count,
                    warning_count,
                    ",".join(anomalies),
                    result.parameter_version_id,
                    result.calculated_at,
                    f"{components.get('rate', 0):.6f}",
                    f"{components.get('term', 0):.6f}",
                    f"{components.get('fico', 0):.6f}",
                    f"{components.get('dti', 0):.6f}",
                    f"{components.get('ltv', 0):.6f}",
                    f"{components.get('age', 0):.6f}",
                    f"{components.get('history', 0):.6f}",
                ])

        return filepath

    def export_anomalies_csv(
        self,
        results: List[SensitivityResult],
        run_id: str,
    ) -> str:
        filename = f"anomalies_{run_id}.csv"
        filepath = os.path.join(self.output_dir, filename)

        headers = [
            "样本ID",
            "异常字段",
            "期望值范围",
            "实际值",
            "严重程度",
            "异常说明",
        ]

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for result in results:
                for anomaly in result.anomalies:
                    writer.writerow([
                        result.sample_id,
                        anomaly.field_name,
                        anomaly.expected_range,
                        anomaly.actual_value,
                        "严重" if anomaly.severity == "critical" else "警告",
                        anomaly.description,
                    ])

        return filepath

    def export_conflicts_csv(
        self,
        conflicts: List[DataConflict],
        run_id: str,
    ) -> str:
        filename = f"data_conflicts_{run_id}.csv"
        filepath = os.path.join(self.output_dir, filename)

        headers = [
            "冲突ID",
            "贷款ID",
            "冲突字段",
            "系统计算值",
            "复盘图表值",
            "差异(%)",
            "系统数据来源",
            "图表数据来源",
            "建议动作",
            "是否已解决",
            "处理说明",
        ]

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for conflict in conflicts:
                writer.writerow([
                    conflict.conflict_id,
                    conflict.loan_id,
                    self._field_label(conflict.field_name),
                    conflict.sample_value,
                    conflict.chart_value,
                    f"{conflict.difference:.2f}" if conflict.difference > 0 else "等级差异",
                    conflict.sample_source,
                    conflict.chart_source,
                    conflict.suggested_action,
                    "是" if conflict.resolved else "否",
                    conflict.resolution_note,
                ])

        return filepath

    def export_calculation_trace_json(
        self,
        result: SensitivityResult,
    ) -> str:
        filename = f"calc_trace_{result.sample_id}.json"
        filepath = os.path.join(self.output_dir, filename)

        trace_data = {
            "sample_id": result.sample_id,
            "final_score": result.sensitivity_score,
            "risk_level": result.risk_level,
            "parameter_version": result.parameter_version_id,
            "calculation_steps": [],
        }

        for step in result.calculation_steps:
            trace_data["calculation_steps"].append({
                "step_name": step.step_name,
                "formula": step.formula,
                "input_values": step.input_values,
                "parameter_used": step.parameter_used,
                "result": step.result,
            })

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(trace_data, f, ensure_ascii=False, indent=2)

        return filepath

    def export_summary_csv(
        self,
        results: List[SensitivityResult],
        conflicts: List[DataConflict],
        run_id: str,
        anomaly_summary: Dict,
        conflict_summary: Dict,
    ) -> str:
        filename = f"run_summary_{run_id}.csv"
        filepath = os.path.join(self.output_dir, filename)

        high_risk = sum(1 for r in results if r.risk_level == "high")
        medium_risk = sum(1 for r in results if r.risk_level == "medium")
        low_risk = sum(1 for r in results if r.risk_level == "low")
        needs_review = sum(1 for r in results if r.needs_manual_review)

        rows = [
            ["统计项", "数值", "说明"],
            ["运行ID", run_id, ""],
            ["导出时间", datetime.now().isoformat(), ""],
            ["总样本数", len(results), ""],
            ["高风险样本数", high_risk, ">=0.70"],
            ["中风险样本数", medium_risk, "0.40-0.70"],
            ["低风险样本数", low_risk, "<0.40"],
            ["需人工复核数", needs_review, "含严重异常的样本"],
            ["异常样本数", anomaly_summary.get("samples_with_anomalies", 0), ""],
            ["异常率(%)", anomaly_summary.get("anomaly_rate", 0), ""],
            ["严重异常总数", anomaly_summary.get("critical_anomalies", 0), ""],
            ["警告异常总数", anomaly_summary.get("warning_anomalies", 0), ""],
            ["数据冲突总数", conflict_summary.get("total_conflicts", 0), ""],
            ["待解决冲突数", conflict_summary.get("unresolved_conflicts", 0), ""],
            ["已解决冲突数", conflict_summary.get("resolved_conflicts", 0), ""],
        ]

        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerows(rows)

        return filepath

    def export_all(
        self,
        results: List[SensitivityResult],
        conflicts: List[DataConflict],
        run_id: str,
        anomaly_summary: Dict,
        conflict_summary: Dict,
    ) -> Dict[str, str]:
        output_files = {}

        output_files["summary"] = self.export_summary_csv(
            results, conflicts, run_id, anomaly_summary, conflict_summary
        )
        output_files["results"] = self.export_results_csv(results, run_id)
        output_files["anomalies"] = self.export_anomalies_csv(results, run_id)
        output_files["conflicts"] = self.export_conflicts_csv(conflicts, run_id)

        for result in results:
            if result.needs_manual_review or len(result.anomalies) > 0:
                key = f"trace_{result.sample_id}"
                output_files[key] = self.export_calculation_trace_json(result)

        return output_files

    def _extract_components(self, result: SensitivityResult) -> Dict[str, float]:
        components = {}
        for step in result.calculation_steps:
            if step.step_name.endswith("_weighted"):
                comp = step.step_name.replace("_weighted", "")
                components[comp] = step.result
        return components

    def _risk_label(self, risk: str) -> str:
        return {"high": "高风险", "medium": "中风险", "low": "低风险"}.get(risk, risk)

    def _field_label(self, field: str) -> str:
        return {
            "sensitivity_score": "敏感性得分",
            "risk_level": "风险等级",
            "principal": "贷款本金",
        }.get(field, field)
