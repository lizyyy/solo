"""
导出模块 - 导出 Markdown、CSV 和 JSON 审计包
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from .models import (
    AuditResult,
    ImportValidationResult,
    ReviewRecord,
)


class MarkdownExporter:
    @staticmethod
    def generate_audit_report(
        audit_result: AuditResult,
        validation_result: Optional[ImportValidationResult] = None,
        reviews: Optional[List[ReviewRecord]] = None,
    ) -> str:
        lines = []

        lines.append("# 标注漂移审计报告")
        lines.append("")
        lines.append(f"**审计ID**: {audit_result.audit_id}")
        lines.append(f"**标签版本**: {audit_result.schema_version}")
        lines.append(f"**审计时间**: {audit_result.audit_timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 一、数据概览")
        lines.append("")
        summary = audit_result.summary
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 总标注数 | {summary.get('total_annotations', 0)} |")
        lines.append(f"| 标注员数量 | {summary.get('unique_annotators', 0)} |")
        lines.append(f"| 会话数量 | {summary.get('unique_sessions', 0)} |")
        lines.append(f"| 整体一致率 | {summary.get('overall_agreement', 0):.2%} |")
        lines.append(f"| 数据泄漏数 | {summary.get('data_leakage_count', 0)} |")
        lines.append(f"| 高风险样本数 | {summary.get('high_risk_sample_count', 0)} |")
        lines.append(f"| 漂移标注员数 | {summary.get('annotator_drift_count', 0)} |")
        lines.append("")

        if audit_result.warnings:
            lines.append("## 二、警告信息")
            lines.append("")
            for i, warning in enumerate(audit_result.warnings, 1):
                lines.append(f"{i}. ⚠️ {warning}")
            lines.append("")

        lines.append("## 三、一致率分析")
        lines.append("")
        cm = audit_result.consistency_metrics
        lines.append(f"**整体一致率**: {cm.overall_agreement:.2%}")
        if cm.cohen_kappa is not None:
            lines.append(f"**Cohen's Kappa**: {cm.cohen_kappa:.4f}")
        lines.append("")

        if cm.per_label_agreement:
            lines.append("### 3.1 各标签一致率")
            lines.append("")
            lines.append("| 标签 | 一致率 |")
            lines.append("|------|--------|")
            for label, agreement in sorted(cm.per_label_agreement.items(), key=lambda x: x[1]):
                lines.append(f"| {label} | {agreement:.2%} |")
            lines.append("")

        if cm.per_annotator_agreement:
            lines.append("### 3.2 各标注员一致率")
            lines.append("")
            lines.append("| 标注员ID | 一致率 |")
            lines.append("|----------|--------|")
            for aid, agreement in sorted(cm.per_annotator_agreement.items(), key=lambda x: x[1]):
                lines.append(f"| {aid} | {agreement:.2%} |")
            lines.append("")

        if audit_result.annotator_drifts:
            lines.append("## 四、标注员漂移分析")
            lines.append("")
            lines.append("| 标注员ID | 漂移分数 | JS散度 | 异常标签 |")
            lines.append("|----------|----------|---------|----------|")
            for drift in audit_result.annotator_drifts:
                unusual = ", ".join(drift["unusual_labels"]) if drift["unusual_labels"] else "-"
                lines.append(
                    f"| {drift['annotator_id']} | {drift['drift_score']:.4f} | "
                    f"{drift['js_divergence']:.4f} | {unusual} |"
                )
            lines.append("")

        if audit_result.data_leakages:
            lines.append("## 五、数据泄漏检测")
            lines.append("")
            lines.append("| 会话ID | 涉及分割集 | 严重程度 | 详情 |")
            lines.append("|--------|----------|----------|------|")
            for leak in audit_result.data_leakages:
                splits = ", ".join(leak["splits"])
                lines.append(
                    f"| {leak['session_id']} | {splits} | "
                    f"{leak['severity']} | {leak['details']} |"
                )
            lines.append("")

        if audit_result.high_risk_samples:
            lines.append("## 六、高风险样本")
            lines.append("")
            lines.append(f"共发现 {len(audit_result.high_risk_samples)} 个高风险样本")
            lines.append("")

            top_samples = audit_result.high_risk_samples[:10]
            lines.append("### 6.1 风险最高的 10 个样本")
            lines.append("")
            for i, sample in enumerate(top_samples, 1):
                lines.append(f"#### 样本 {i}: {sample['record_id']}")
                lines.append("")
                lines.append(f"- **会话ID**: {sample['session_id']}")
                lines.append(f"- **风险分数**: {sample['risk_score']:.2f}")
                lines.append(f"- **文本**: {sample['text'][:100]}...")
                lines.append("")
                lines.append("**风险因素**:")
                for factor in sample["risk_factors"]:
                    lines.append(f"- {factor}")
                lines.append("")

        if reviews:
            lines.append("## 七、复核记录")
            lines.append("")
            from collections import Counter
            status_counts = Counter(r.decision.value for r in reviews)
            lines.append(f"**总复核数**: {len(reviews)}")
            lines.append("")
            lines.append("| 状态 | 数量 |")
            lines.append("|------|------|")
            for status, count in status_counts.items():
                lines.append(f"| {status} | {count} |")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*报告由 标注漂移体检员 自动生成*")

        return "\n".join(lines)


class CSVExporter:
    @staticmethod
    def export_confusion_matrix(audit_result: AuditResult, output_path: Path) -> None:
        cm_data = audit_result.confusion_matrix
        if not cm_data.get("matrix"):
            return

        labels = cm_data.get("labels", [])
        matrix = cm_data.get("matrix", [])

        df = pd.DataFrame(matrix, index=labels, columns=labels)
        df.index.name = "实际标签"
        df.columns.name = "预测标签"
        df.to_csv(output_path, encoding="utf-8-sig")

    @staticmethod
    def export_high_risk_samples(audit_result: AuditResult, output_path: Path) -> None:
        samples = audit_result.high_risk_samples
        if not samples:
            return

        records = []
        for sample in samples:
            records.append({
                "record_id": sample["record_id"],
                "session_id": sample["session_id"],
                "turn_id": sample.get("turn_id", ""),
                "text": sample["text"],
                "risk_score": sample["risk_score"],
                "risk_factors": "; ".join(sample["risk_factors"]),
                "annotation_label": sample.get("annotation", {}).get("label", "") if sample.get("annotation") else "",
                "prediction_label": sample.get("prediction", {}).get("predicted_label", "") if sample.get("prediction") else "",
            })

        df = pd.DataFrame(records)
        df.to_csv(output_path, index=False, encoding="utf-8-sig")

    @staticmethod
    def export_data_leakages(audit_result: AuditResult, output_path: Path) -> None:
        leakages = audit_result.data_leakages
        if not leakages:
            return

        records = []
        for leak in leakages:
            records.append({
                "session_id": leak["session_id"],
                "turn_ids": ", ".join(leak["turn_ids"]) if leak.get("turn_ids") else "",
                "splits": ", ".join(leak["splits"]),
                "severity": leak["severity"],
                "details": leak["details"],
            })

        df = pd.DataFrame(records)
        df.to_csv(output_path, index=False, encoding="utf-8-sig")

    @staticmethod
    def export_annotator_drifts(audit_result: AuditResult, output_path: Path) -> None:
        drifts = audit_result.annotator_drifts
        if not drifts:
            return

        records = []
        for drift in drifts:
            records.append({
                "annotator_id": drift["annotator_id"],
                "drift_score": drift["drift_score"],
                "kl_divergence": drift["kl_divergence"],
                "js_divergence": drift["js_divergence"],
                "total_annotations": drift["total_annotations"],
                "unusual_labels": ", ".join(drift["unusual_labels"]) if drift.get("unusual_labels") else "",
            })

        df = pd.DataFrame(records)
        df.to_csv(output_path, index=False, encoding="utf-8-sig")

    @staticmethod
    def export_label_stats(audit_result: AuditResult, output_path: Path) -> None:
        stats = audit_result.confusion_matrix.get("statistics", {})
        if not stats:
            return

        records = []
        for label, metrics in stats.items():
            records.append({
                "label": label,
                "precision": metrics.get("precision", 0),
                "recall": metrics.get("recall", 0),
                "f1": metrics.get("f1", 0),
                "support": metrics.get("support", 0),
                "true_positive": metrics.get("true_positive", 0),
                "false_positive": metrics.get("false_positive", 0),
                "false_negative": metrics.get("false_negative", 0),
            })

        df = pd.DataFrame(records)
        df.to_csv(output_path, index=False, encoding="utf-8-sig")


class JSONExporter:
    @staticmethod
    def export_audit_result(audit_result: AuditResult, output_path: Path) -> None:
        data = {
            "audit_id": audit_result.audit_id,
            "schema_version": audit_result.schema_version,
            "audit_timestamp": audit_result.audit_timestamp.isoformat(),
            "summary": audit_result.summary,
            "warnings": audit_result.warnings,
            "consistency_metrics": {
                "overall_agreement": audit_result.consistency_metrics.overall_agreement,
                "cohen_kappa": audit_result.consistency_metrics.cohen_kappa,
                "per_label_agreement": audit_result.consistency_metrics.per_label_agreement,
                "per_annotator_agreement": audit_result.consistency_metrics.per_annotator_agreement,
            },
            "confusion_matrix": audit_result.confusion_matrix,
            "annotator_drifts": audit_result.annotator_drifts,
            "data_leakages": audit_result.data_leakages,
            "high_risk_samples": audit_result.high_risk_samples,
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @staticmethod
    def export_reviews(reviews: List[ReviewRecord], output_path: Path) -> None:
        data = {
            "version": "1.0",
            "exported_at": "",
            "reviews": [r.to_dict() for r in reviews],
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


class AuditPackageExporter:
    @staticmethod
    def export_package(
        audit_result: AuditResult,
        output_dir: Path,
        validation_result: Optional[ImportValidationResult] = None,
        reviews: Optional[List[ReviewRecord]] = None,
    ) -> Dict[str, Path]:
        output_dir.mkdir(parents=True, exist_ok=True)
        exported_files = {}

        md_path = output_dir / f"audit_report_{audit_result.audit_id}.md"
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(MarkdownExporter.generate_audit_report(audit_result, validation_result, reviews))
        exported_files["report_md"] = md_path

        json_path = output_dir / f"audit_detail_{audit_result.audit_id}.json"
        JSONExporter.export_audit_result(audit_result, json_path)
        exported_files["detail_json"] = json_path

        cm_path = output_dir / "confusion_matrix.csv"
        CSVExporter.export_confusion_matrix(audit_result, cm_path)
        if cm_path.exists():
            exported_files["confusion_matrix_csv"] = cm_path

        hr_path = output_dir / "high_risk_samples.csv"
        CSVExporter.export_high_risk_samples(audit_result, hr_path)
        if hr_path.exists():
            exported_files["high_risk_csv"] = hr_path

        dl_path = output_dir / "data_leakages.csv"
        CSVExporter.export_data_leakages(audit_result, dl_path)
        if dl_path.exists():
            exported_files["data_leakages_csv"] = dl_path

        ad_path = output_dir / "annotator_drifts.csv"
        CSVExporter.export_annotator_drifts(audit_result, ad_path)
        if ad_path.exists():
            exported_files["annotator_drifts_csv"] = ad_path

        ls_path = output_dir / "label_statistics.csv"
        CSVExporter.export_label_stats(audit_result, ls_path)
        if ls_path.exists():
            exported_files["label_stats_csv"] = ls_path

        if reviews:
            rev_path = output_dir / "review_records.json"
            JSONExporter.export_reviews(reviews, rev_path)
            exported_files["reviews_json"] = rev_path

        return exported_files
