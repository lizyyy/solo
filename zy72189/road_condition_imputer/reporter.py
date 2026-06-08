from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    ImputationResult,
    MetricSnapshot,
    MetricDiff,
    ValidationIssue,
    ReviewDecision,
    RecordStatus,
    RoadConditionRecord,
    AuditEntry,
)


class Reporter:
    def __init__(self):
        pass

    def generate_report(
        self,
        run_id: str,
        results: List[ImputationResult],
        validation_issues: List[ValidationIssue],
        snapshot: MetricSnapshot,
        diffs: List[MetricDiff],
        reviews: Optional[List[ReviewDecision]] = None,
        audit_trail: Optional[object] = None,
        rejected: Optional[List[RoadConditionRecord]] = None,
    ) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("  路况预测缺失值修补报告")
        lines.append(f"  运行编号: {run_id}")
        lines.append(f"  生成时间: {datetime.now().isoformat()}")
        lines.append("=" * 60)

        lines.append("")
        lines.append("── 一、数据校验概要 ──")
        error_issues = [i for i in validation_issues if i.severity.value == "error"]
        warning_issues = [i for i in validation_issues if i.severity.value == "warning"]
        info_issues = [i for i in validation_issues if i.severity.value == "info"]
        lines.append(f"  错误: {len(error_issues)}  警告: {len(warning_issues)}  提示: {len(info_issues)}")
        if error_issues:
            lines.append("  【错误详情】")
            for issue in error_issues:
                lines.append(f"    - {issue.record_id}: {issue.description}")
                if issue.suggestion:
                    lines.append(f"      建议: {issue.suggestion}")
        if warning_issues:
            lines.append("  【警告详情】")
            for issue in warning_issues:
                lines.append(f"    - {issue.record_id}: {issue.description}")
                if issue.suggestion:
                    lines.append(f"      建议: {issue.suggestion}")

        lines.append("")
        lines.append("── 二、修补指标 ──")
        lines.append(f"  总记录数: {snapshot.total_records}")
        lines.append(f"  被拒绝记录数: {snapshot.rejected_count}")
        lines.append(f"  含缺失记录数: {snapshot.missing_count}")
        lines.append(f"  修补成功数: {snapshot.imputed_count}")
        lines.append(f"  平均置信度: {snapshot.avg_confidence:.2%}")
        if snapshot.fields_imputed:
            lines.append("  各字段修补次数:")
            for field_name, count in sorted(snapshot.fields_imputed.items()):
                lines.append(f"    - {field_name}: {count} 次")
        if snapshot.by_missing_type:
            lines.append("  缺失类型分布:")
            for mt, count in sorted(snapshot.by_missing_type.items()):
                lines.append(f"    - {mt}: {count} 条")

        lines.append("")
        lines.append("── 三、各记录修补详情 ──")
        status_counts = {}
        for r in results:
            status_counts[r.status.value] = status_counts.get(r.status.value, 0) + 1
        lines.append(f"  状态分布: {dict(sorted(status_counts.items()))}")

        for r in results:
            lines.append(f"")
            lines.append(f"  记录: {r.record_id}  状态: {r.status.value}  处理时间: {r.processed_at}")
            lines.append(f"    原始来源: {r.original_record.source}  加载时间: {r.original_record.loaded_at}")

            if r.evidences:
                lines.append("    修补证据链:")
                for e in r.evidences:
                    lines.append(f"      - 字段: {e.field_name}")
                    lines.append(f"        修补方法: {e.imputation_method}")
                    lines.append(f"        置信度: {e.confidence:.0%}")
                    lines.append(f"        参考记录: {e.reference_record_ids}")
                    lines.append(f"        推理过程: {e.reasoning}")
                    lines.append(f"        修补值: {e.imputed_value}")
            else:
                lines.append("    无缺失字段，无需修补")

            if r.suggestions:
                lines.append("    处理建议:")
                for s in r.suggestions:
                    lines.append(f"      - [{s.priority}] {s.field_name}: {s.suggestion_text}")

        if diffs:
            lines.append("")
            lines.append("── 四、与上次运行对比 ──")
            for d in diffs:
                lines.append(f"  {d.metric_name}: {d.previous_value} → {d.current_value}  (Δ={d.delta})")
                lines.append(f"    原因: {d.cause}")

        if reviews:
            lines.append("")
            lines.append("── 五、人工复核记录 ──")
            for rev in reviews:
                lines.append(f"  记录: {rev.record_id}  复核人: {rev.reviewer}  决定: {rev.decision}")
                if rev.corrections:
                    lines.append(f"    修正: {rev.corrections}")
                if rev.comment:
                    lines.append(f"    意见: {rev.comment}")
                lines.append(f"    时间: {rev.reviewed_at}")

        if rejected:
            lines.append("")
            lines.append("── 六、被拒绝记录 ──")
            lines.append(f"  共 {len(rejected)} 条记录因校验不通过被拒绝，未进入修补流程:")
            for rec in rejected:
                rid = rec.record_id if rec.record_id else "(空ID)"
                lines.append(f"  - {rid}  来源: {rec.source}  加载时间: {rec.loaded_at}")
                matched_issues = [i for i in validation_issues if i.record_id == (rec.record_id if rec.record_id else "UNKNOWN")]
                for iss in matched_issues:
                    lines.append(f"    [{iss.severity.value}] {iss.description}")
                    if iss.suggestion:
                        lines.append(f"    建议: {iss.suggestion}")

        if audit_trail is not None:
            lines.append("")
            section_label = "七" if rejected else "六"
            lines.append(f"── {section_label}、审计追踪摘要 ──")
            audit_record_ids = set(r.record_id for r in results)
            if rejected:
                for rec in rejected:
                    if rec.record_id:
                        audit_record_ids.add(rec.record_id)
                audit_record_ids.add("UNKNOWN")
            for rid in sorted(audit_record_ids):
                trail = audit_trail.format_audit_for_record(rid)
                for line in trail.split("\n"):
                    lines.append(f"  {line}")

        lines.append("")
        lines.append("=" * 60)
        lines.append("  报告结束")
        lines.append("=" * 60)

        return "\n".join(lines)

    def export_results_table(self, results: List[ImputationResult], rejected: Optional[List[RoadConditionRecord]] = None, validation_issues: Optional[List[ValidationIssue]] = None) -> List[Dict]:
        rows = []
        for r in results:
            row = {
                "record_id": r.record_id,
                "status": r.status.value,
                "source": r.original_record.source,
                "loaded_at": r.original_record.loaded_at,
                "processed_at": r.processed_at,
            }
            imputed = r.imputed_record
            for field_name in ("timestamp", "road_segment", "congestion_level", "weather",
                              "temperature", "surface_condition", "traffic_volume"):
                row[f"imputed_{field_name}"] = getattr(imputed, field_name)
                row[f"original_{field_name}"] = getattr(r.original_record, field_name)

            row["evidence_summary"] = "; ".join(
                f"{e.field_name}={e.imputed_value}(置信度{e.confidence:.0%},方法{e.imputation_method})"
                for e in r.evidences
            )
            row["suggestion_summary"] = "; ".join(
                f"[{s.priority}]{s.field_name}:{s.suggestion_text}"
                for s in r.suggestions
            )
            rows.append(row)

        if rejected:
            for rec in rejected:
                rid = rec.record_id if rec.record_id else "(空ID)"
                row = {
                    "record_id": rid,
                    "status": "rejected",
                    "source": rec.source,
                    "loaded_at": rec.loaded_at,
                    "processed_at": "",
                }
                for field_name in ("timestamp", "road_segment", "congestion_level", "weather",
                                  "temperature", "surface_condition", "traffic_volume"):
                    row[f"imputed_{field_name}"] = None
                    row[f"original_{field_name}"] = getattr(rec, field_name)
                issue_key = rec.record_id if rec.record_id else "UNKNOWN"
                matched = [i for i in (validation_issues or []) if i.record_id == issue_key]
                row["evidence_summary"] = ""
                row["suggestion_summary"] = "; ".join(
                    f"[{i.severity.value}]{i.issue_type}:{i.suggestion}"
                    for i in matched
                )
                rows.append(row)

        return rows
