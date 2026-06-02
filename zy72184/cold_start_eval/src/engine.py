import os
from typing import List, Optional
from .data_loader import DataLoader
from .anomaly_detector import AnomalyDetector
from .metrics import MetricsCalculator
from .reporter import ReportGenerator
from .schemas import EvaluationRecord, EvaluationReport, AnomalyType


class EvaluationEngine:
    def __init__(
        self,
        data_dir: str,
        output_dir: Optional[str] = None,
        boundary_threshold: float = 0.95,
        null_threshold: float = 0.3
    ):
        self.data_dir = data_dir
        self.output_dir = output_dir or os.path.join(data_dir, "reports")
        self.data_loader = DataLoader(data_dir)
        self.anomaly_detector = AnomalyDetector(
            boundary_threshold=boundary_threshold,
            null_threshold=null_threshold
        )
        self.metrics_calculator = MetricsCalculator()
        self.reporter = ReportGenerator(self.output_dir)

    def list_versions(self) -> List[str]:
        return self.data_loader.list_model_versions()

    def evaluate(
        self,
        model_version: str,
        save_reports: bool = True
    ) -> EvaluationReport:
        samples, predictions, reviews, feedback = self.data_loader.load_evaluation_data(
            model_version
        )
        records = self.data_loader.build_evaluation_records(
            samples, predictions, reviews, feedback
        )
        anomalies = self.anomaly_detector.detect_all(records)
        for record in records:
            record.metrics = self.metrics_calculator.calculate_single(record)
        metrics = self.metrics_calculator.calculate_all(records)
        report = self.reporter.generate_report(
            model_version, records, metrics, anomalies
        )
        if save_reports:
            self._save_all_reports(report)
        return report

    def compare_versions(
        self,
        version_a: str,
        version_b: str,
        save_reports: bool = True
    ) -> dict:
        report_a = self.evaluate(version_a, save_reports=False)
        report_b = self.evaluate(version_b, save_reports=False)
        comparison = {
            "version_a": version_a,
            "version_b": version_b,
            "metrics_comparison": {},
            "anomaly_comparison": {}
        }
        all_metrics = set(report_a.metrics_summary.keys()) | set(report_b.metrics_summary.keys())
        for metric in all_metrics:
            val_a = report_a.metrics_summary.get(metric, 0.0)
            val_b = report_b.metrics_summary.get(metric, 0.0)
            comparison["metrics_comparison"][metric] = {
                version_a: val_a,
                version_b: val_b,
                "delta": val_b - val_a,
                "change_pct": ((val_b - val_a) / val_a * 100) if val_a != 0 else float("inf")
            }
        from collections import Counter
        anomalies_a = Counter(a.anomaly_type.value for a in report_a.anomalies)
        anomalies_b = Counter(a.anomaly_type.value for a in report_b.anomalies)
        all_types = set(anomalies_a.keys()) | set(anomalies_b.keys())
        for atype in all_types:
            count_a = anomalies_a.get(atype, 0)
            count_b = anomalies_b.get(atype, 0)
            comparison["anomaly_comparison"][atype] = {
                version_a: count_a,
                version_b: count_b,
                "delta": count_b - count_a
            }
        comparison["report_a"] = report_a.to_dict()
        comparison["report_b"] = report_b.to_dict()
        if save_reports:
            self._save_comparison(comparison)
        return comparison

    def get_anomalies_by_type(
        self,
        model_version: str,
        anomaly_type: Optional[AnomalyType] = None
    ) -> List[dict]:
        report = self.evaluate(model_version, save_reports=False)
        anomalies = report.anomalies
        if anomaly_type:
            anomalies = [a for a in anomalies if a.anomaly_type == anomaly_type]
        return [a.to_dict() for a in anomalies]

    def get_evaluation_by_sample_id(
        self,
        model_version: str,
        sample_id: str
    ) -> Optional[dict]:
        report = self.evaluate(model_version, save_reports=False)
        for eval_rec in report.evaluations:
            if eval_rec.sample_id == sample_id:
                return eval_rec.to_dict()
        return None

    def _save_all_reports(self, report: EvaluationReport) -> None:
        self.reporter.save_report(report)
        self.reporter.save_summary(report)
        self.reporter.save_anomaly_list(report)

    def _save_comparison(self, comparison: dict) -> None:
        import json
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"comparison_{comparison['version_a']}_vs_{comparison['version_b']}_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(comparison, f, ensure_ascii=False, indent=2)
        self._save_comparison_markdown(comparison, timestamp)

    def _save_comparison_markdown(self, comparison: dict, timestamp: str) -> None:
        lines = []
        va, vb = comparison["version_a"], comparison["version_b"]
        lines.append(f"# 模型版本对比: {va} vs {vb}")
        lines.append("")
        lines.append(f"**生成时间**: {timestamp}")
        lines.append("")
        lines.append("## 指标对比")
        lines.append("")
        lines.append(f"| 指标 | {va} | {vb} | 变化 | 变化率 |")
        lines.append("|------|------|------|------|--------|")
        for metric, vals in sorted(comparison["metrics_comparison"].items()):
            delta = vals["delta"]
            sign = "+" if delta >= 0 else ""
            pct = vals["change_pct"]
            pct_str = f"{sign}{pct:.2f}%" if pct != float("inf") else "N/A"
            lines.append(
                f"| {metric} | {vals[va]:.4f} | {vals[vb]:.4f} | {sign}{delta:.4f} | {pct_str} |"
            )
        lines.append("")
        lines.append("## 异常对比")
        lines.append("")
        lines.append(f"| 异常类型 | {va} | {vb} | 变化 |")
        lines.append("|----------|------|------|------|")
        for atype, vals in sorted(comparison["anomaly_comparison"].items()):
            delta = vals["delta"]
            sign = "+" if delta >= 0 else ""
            lines.append(f"| {atype} | {vals[va]} | {vals[vb]} | {sign}{delta} |")
        filepath = os.path.join(
            self.output_dir,
            f"comparison_{va}_vs_{vb}_{timestamp}.md"
        )
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
