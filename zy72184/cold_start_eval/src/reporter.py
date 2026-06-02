import json
import os
from typing import List, Dict, Any
from datetime import datetime
from collections import defaultdict
from .schemas import (
    EvaluationReport, EvaluationRecord, AnomalyRecord, AnomalyType,
    ReviewStatus
)


class ReportGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_report(
        self,
        model_version: str,
        records: List[EvaluationRecord],
        metrics: Dict[str, float],
        anomalies: List[AnomalyRecord]
    ) -> EvaluationReport:
        total = len(records)
        valid = len([r for r in records if not self._has_critical_anomaly(r)])
        report = EvaluationReport(
            model_version=model_version,
            total_samples=total,
            valid_samples=valid,
            metrics_summary=metrics,
            anomalies=anomalies,
            evaluations=records
        )
        return report

    def save_report(self, report: EvaluationReport) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"eval_report_{report.model_version}_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
        return filepath

    def save_summary(self, report: EvaluationReport) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"eval_summary_{report.model_version}_{timestamp}.md"
        filepath = os.path.join(self.output_dir, filename)
        content = self._generate_markdown_summary(report)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return filepath

    def save_anomaly_list(self, report: EvaluationReport) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"anomalies_{report.model_version}_{timestamp}.md"
        filepath = os.path.join(self.output_dir, filename)
        content = self._generate_anomaly_markdown(report.anomalies, report.evaluations)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return filepath

    def _generate_markdown_summary(self, report: EvaluationReport) -> str:
        lines = []
        lines.append(f"# 推荐系统冷启动解释 - 评测报告")
        lines.append("")
        lines.append(f"**模型版本**: {report.model_version}")
        lines.append(f"**生成时间**: {report.generated_at.isoformat()}")
        lines.append(f"**数据源**: {report.source}")
        lines.append("")
        lines.append("## 一、概览")
        lines.append("")
        lines.append(f"- 总样本数: {report.total_samples}")
        lines.append(f"- 有效样本数: {report.valid_samples}")
        lines.append(f"- 异常样本数: {len(report.anomalies)}")
        lines.append("")
        lines.append("## 二、指标汇总")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        for key, value in sorted(report.metrics_summary.items()):
            lines.append(f"| {key} | {value:.4f} |")
        lines.append("")
        lines.append("## 三、异常分类统计")
        lines.append("")
        anomaly_stats = defaultdict(int)
        for anomaly in report.anomalies:
            anomaly_stats[anomaly.anomaly_type.value] += 1
        lines.append("| 异常类型 | 数量 |")
        lines.append("|----------|------|")
        for atype, count in sorted(anomaly_stats.items()):
            lines.append(f"| {atype} | {count} |")
        lines.append("")
        lines.append("## 四、样本处理详情")
        lines.append("")
        lines.append("| 样本ID | 来源 | 创建时间 | 处理时间 | 状态 | 复核轮次 | 异常数 |")
        lines.append("|--------|------|----------|----------|------|----------|--------|")
        for eval_rec in report.evaluations:
            status = eval_rec.review.review_status.value if eval_rec.review else "pending"
            review_round = eval_rec.review.review_round if eval_rec.review else 0
            created = eval_rec.sample.created_at.strftime("%Y-%m-%d %H:%M")
            processed = eval_rec.sample.processed_at.strftime("%Y-%m-%d %H:%M") if eval_rec.sample.processed_at else "-"
            lines.append(
                f"| {eval_rec.sample_id} | {eval_rec.sample.source} | {created} | "
                f"{processed} | {status} | {review_round} | {len(eval_rec.anomalies)} |"
            )
        lines.append("")
        lines.append("## 五、关键异常提示")
        lines.append("")
        critical = [a for a in report.anomalies if a.severity in ["critical", "error"]]
        if critical:
            lines.append("### ⚠️ 严重异常")
            lines.append("")
            for a in critical:
                lines.append(f"- **{a.anomaly_type.value}** (样本 {a.sample_id}): {a.description}")
                lines.append(f"  - 来源: {a.details.get('source', 'unknown')}")
                lines.append(f"  - 检测时间: {a.detected_at.isoformat()}")
                lines.append("")
        warnings = [a for a in report.anomalies if a.severity == "warning"]
        if warnings:
            lines.append("### ⚡ 警告")
            lines.append("")
            for a in warnings:
                lines.append(f"- **{a.anomaly_type.value}** (样本 {a.sample_id}): {a.description}")
        return "\n".join(lines)

    def _generate_anomaly_markdown(
        self, anomalies: List[AnomalyRecord], evaluations: List[EvaluationRecord]
    ) -> str:
        lines = []
        lines.append(f"# 异常清单")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().isoformat()}")
        lines.append("")
        lines.append("> 注意: 标签冲突和样本泄漏已单独列出，不参与平均指标计算。")
        lines.append("")
        eval_map = {e.sample_id: e for e in evaluations}
        by_type = defaultdict(list)
        for a in anomalies:
            by_type[a.anomaly_type].append(a)
        for atype in [
            AnomalyType.SAMPLE_LEAKAGE,
            AnomalyType.LABEL_CONFLICT,
            AnomalyType.DUPLICATE,
            AnomalyType.NULL_VALUE,
            AnomalyType.BOUNDARY
        ]:
            if atype not in by_type:
                continue
            lines.append(f"## {atype.value}")
            lines.append("")
            lines.append(f"共 {len(by_type[atype])} 条记录")
            lines.append("")
            for a in by_type[atype]:
                eval_rec = eval_map.get(a.sample_id)
                lines.append(f"### 样本 {a.sample_id}")
                lines.append(f"- **严重程度**: {a.severity}")
                lines.append(f"- **描述**: {a.description}")
                lines.append(f"- **检测时间**: {a.detected_at.isoformat()}")
                lines.append(f"- **原始来源**: {a.details.get('source', 'unknown')}")
                if eval_rec and eval_rec.sample.created_at:
                    lines.append(f"- **样本创建时间**: {eval_rec.sample.created_at.isoformat()}")
                if eval_rec and eval_rec.sample.processed_at:
                    lines.append(f"- **样本处理时间**: {eval_rec.sample.processed_at.isoformat()}")
                if eval_rec and eval_rec.review:
                    lines.append(f"- **复核人**: {eval_rec.review.reviewer}")
                    lines.append(f"- **复核状态**: {eval_rec.review.review_status.value}")
                    lines.append(f"- **复核轮次**: {eval_rec.review.review_round}")
                    if eval_rec.review.review_comment:
                        lines.append(f"- **复核意见**: {eval_rec.review.review_comment}")
                if a.details:
                    lines.append("- **详情**:")
                    for k, v in a.details.items():
                        if k != "source":
                            lines.append(f"  - {k}: {v}")
                lines.append("")
        return "\n".join(lines)

    def _has_critical_anomaly(self, record: EvaluationRecord) -> bool:
        return any(
            a.severity in ["critical", "error"]
            and a.anomaly_type in [AnomalyType.SAMPLE_LEAKAGE, AnomalyType.DUPLICATE]
            for a in record.anomalies
        )
