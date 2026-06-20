from __future__ import annotations

from typing import List, Dict, Any, Optional
from datetime import datetime

from .models import ResampleRecord, ResampleSession, RecordStatus


class ExplanationGenerator:
    def generate_summary(self, record: ResampleRecord) -> str:
        snapshot = record.snapshot
        parts = []

        if snapshot.used_default_score and snapshot.has_missing_features:
            parts.append(
                f"特征缺失({len(snapshot.missing_features)}个)使用默认分"
            )
        elif snapshot.has_missing_features:
            parts.append(f"存在特征缺失({len(snapshot.missing_features)}个)")

        if record.current_status == RecordStatus.SUSPICIOUS_DEFAULT_SCORE:
            parts.append("状态异常，待复核")
        elif record.current_status == RecordStatus.NEEDS_RECHECK:
            parts.append("阿越已标注，待推荐负责人确认")
        elif record.current_status == RecordStatus.CONFIRMED_NORMAL:
            parts.append("推荐负责人已确认正常")
        elif record.current_status == RecordStatus.EXCLUDED:
            parts.append("已排除")

        if record.ayue_review_note:
            parts.append(f"阿越备注: {record.ayue_review_note[:30]}...")

        if not parts:
            parts.append("记录正常")

        return " | ".join(parts)

    def generate_detail(self, record: ResampleRecord) -> str:
        snapshot = record.snapshot
        lines = []

        lines.append("=" * 60)
        lines.append(f"记录ID: {record.record_id}")
        lines.append(f"特征快照: {snapshot.snapshot_id}")
        lines.append(f"原始行号: {snapshot.original_line_number}")
        lines.append(f"当前状态: {record.current_status.value}")
        lines.append(f"模型分: {snapshot.model_score}")
        lines.append("-" * 60)

        if snapshot.has_missing_features:
            lines.append("【特征缺失信息】")
            lines.append(f"  缺失特征数量: {len(snapshot.missing_features)}")
            lines.append(f"  缺失特征列表: {', '.join(snapshot.missing_features)}")
            if snapshot.used_default_score:
                lines.append(f"  是否使用默认分: 是")
                lines.append(f"  默认分原因: {snapshot.default_score_reason}")
            else:
                lines.append(f"  是否使用默认分: 否")
            lines.append("")

        if record.ayue_review_note:
            lines.append("【阿越审查意见】")
            lines.append(f"  训练日志曲线检查: {'通过' if record.training_log_curve_check else '未通过/未检查'}")
            lines.append(f"  备注: {record.ayue_review_note}")
            lines.append("")

        if record.explanation_summary:
            lines.append("【可解释摘要】")
            lines.append(f"  {record.explanation_summary}")
            lines.append("")

        if record.manual_edits:
            lines.append("【人工改动记录】")
            for field, value in record.manual_edits.items():
                lines.append(f"  {field}: {value}")
            lines.append("")

        lines.append("【审计日志】")
        for i, entry in enumerate(record.audit_log):
            ts = entry.timestamp
            if isinstance(ts, datetime):
                ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
            else:
                ts_str = str(ts)
            lines.append(
                f"  [{i}] {ts_str} | {entry.action.value} | {entry.operator}"
            )
            if entry.comment:
                lines.append(f"      备注: {entry.comment}")
            if entry.field_name:
                lines.append(f"      字段: {entry.field_name}")
                if entry.old_value is not None or entry.new_value is not None:
                    lines.append(f"      {entry.old_value} → {entry.new_value}")

        lines.append("=" * 60)

        return "\n".join(lines)

    def generate_overview(self, session: ResampleSession) -> Dict[str, Any]:
        total = len(session.records)
        by_status = {}
        for rec in session.records:
            s = rec.current_status.value
            by_status[s] = by_status.get(s, 0) + 1

        suspicious = [
            r for r in session.records
            if r.snapshot.used_default_score and r.snapshot.has_missing_features
        ]

        return {
            "session_id": session.session_id,
            "total_records": total,
            "status_distribution": by_status,
            "suspicious_default_score": {
                "count": len(suspicious),
                "record_ids": [r.record_id for r in suspicious],
            },
            "needs_recheck_count": len(
                [r for r in session.records if r.current_status == RecordStatus.NEEDS_RECHECK]
            ),
        }

    def get_suspicious_record_details(
        self, session: ResampleSession
    ) -> List[Dict[str, Any]]:
        suspicious = [
            r for r in session.records
            if r.snapshot.used_default_score and r.snapshot.has_missing_features
        ]

        details = []
        for rec in suspicious:
            details.append({
                "record_id": rec.record_id,
                "original_line_number": rec.snapshot.original_line_number,
                "snapshot_id": rec.snapshot.snapshot_id,
                "model_score": rec.snapshot.model_score,
                "missing_features": rec.snapshot.missing_features,
                "current_status": rec.current_status.value,
                "ayue_review_note": rec.ayue_review_note,
                "summary": self.generate_summary(rec),
            })

        return details
