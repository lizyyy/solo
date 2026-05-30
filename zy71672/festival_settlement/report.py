import json
import csv
import os
from datetime import datetime
from typing import List, Optional
import decimal

from .models import (
    SettlementLine, AnomalyItem, NoteEntry,
    SettlementSummary, RecordStatus,
)
from .db import Database


def export_reports(
    output_dir: str,
    settlements: List[SettlementLine],
    anomalies: List[AnomalyItem],
    notes: List[NoteEntry],
    db: Database,
) -> dict:
    os.makedirs(output_dir, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    json_path = os.path.join(output_dir, f"settlement_{ts}.json")
    csv_path = os.path.join(output_dir, f"settlement_{ts}.csv")
    anomaly_path = os.path.join(output_dir, f"anomalies_{ts}.json")
    notes_path = os.path.join(output_dir, f"notes_{ts}.json")
    summary_path = os.path.join(output_dir, f"summary_{ts}.json")

    _export_settlement_json(json_path, settlements, anomalies, notes)
    _export_settlement_csv(csv_path, settlements)
    _export_anomalies_json(anomaly_path, anomalies)
    _export_notes_json(notes_path, notes)

    summary = build_summary(settlements, anomalies)
    _export_summary_json(summary_path, summary)

    return {
        "settlement_json": json_path,
        "settlement_csv": csv_path,
        "anomalies_json": anomaly_path,
        "notes_json": notes_path,
        "summary_json": summary_path,
        "summary": summary,
    }


def build_summary(
    settlements: List[SettlementLine],
    anomalies: List[AnomalyItem],
) -> SettlementSummary:
    confirmed = sum(1 for s in settlements if s.status == RecordStatus.CONFIRMED)
    rejected = sum(1 for s in settlements if s.status == RecordStatus.REJECTED)
    pending = sum(1 for s in settlements if s.status == RecordStatus.PENDING)

    return SettlementSummary(
        total_artists=len(settlements),
        total_guarantee=sum(s.guarantee_amount for s in settlements),
        total_box_office_share=sum(s.box_office_share for s in settlements),
        total_sponsor_deduction=sum(s.sponsor_deduction for s in settlements),
        total_due=sum(s.total_due for s in settlements),
        total_paid=sum(s.total_paid for s in settlements),
        total_variance=sum(s.variance for s in settlements),
        anomaly_count=len(anomalies),
        confirmed_count=confirmed,
        rejected_count=rejected,
        pending_count=pending,
    )


def format_terminal_summary(summary: SettlementSummary) -> str:
    lines = [
        "=" * 60,
        "  音乐节艺人分账表 - 结算摘要",
        "=" * 60,
        f"  艺人总数:       {summary.total_artists}",
        f"  保底总额:       ¥{summary.total_guarantee:,.2f}",
        f"  票房分成总额:   ¥{summary.total_box_office_share:,.2f}",
        f"  赞助扣款总额:   ¥{summary.total_sponsor_deduction:,.2f}",
        f"  应付总额:       ¥{summary.total_due:,.2f}",
        f"  已付总额:       ¥{summary.total_paid:,.2f}",
        f"  差异总额:       ¥{summary.total_variance:,.2f}",
        "-" * 60,
        f"  异常数:         {summary.anomaly_count}",
        f"  已确认:         {summary.confirmed_count}",
        f"  已退回:         {summary.rejected_count}",
        f"  待处理:         {summary.pending_count}",
        "=" * 60,
    ]
    return "\n".join(lines)


def format_terminal_detail(settlements: List[SettlementLine]) -> str:
    lines = [
        "-" * 80,
        "  艺人分账明细",
        "-" * 80,
        f"  {'艺人ID':<12} {'姓名':<10} {'保底':>12} {'票房分成':>12} "
        f"{'赞助扣款':>12} {'应付':>12} {'已付':>12} {'差异':>12} {'状态':<8}",
        "-" * 80,
    ]
    for s in settlements:
        lines.append(
            f"  {s.artist_id:<12} {s.artist_name:<10} "
            f"¥{s.guarantee_amount:>10,.2f} ¥{s.box_office_share:>10,.2f} "
            f"¥{s.sponsor_deduction:>10,.2f} ¥{s.total_due:>10,.2f} "
            f"¥{s.total_paid:>10,.2f} ¥{s.variance:>10,.2f} {s.status.value:<8}"
        )
    lines.append("-" * 80)
    return "\n".join(lines)


def _export_settlement_json(path: str, settlements, anomalies, notes):
    data = {
        "export_time": datetime.now().isoformat(),
        "settlements": [_settlement_to_dict(s) for s in settlements],
        "anomalies": [_anomaly_to_dict(a) for a in anomalies],
        "notes": [_note_to_dict(n) for n in notes],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=_json_default)


def _export_settlement_csv(path: str, settlements):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "艺人ID", "姓名", "保底金额", "票房分成", "赞助扣款",
            "应付金额", "已付金额", "差异", "状态", "备注",
        ])
        for s in settlements:
            writer.writerow([
                s.artist_id, s.artist_name, s.guarantee_amount,
                s.box_office_share, s.sponsor_deduction,
                s.total_due, s.total_paid, s.variance,
                s.status.value, s.notes,
            ])


def _export_anomalies_json(path: str, anomalies):
    data = {
        "export_time": datetime.now().isoformat(),
        "anomalies": [_anomaly_to_dict(a) for a in anomalies],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=_json_default)


def _export_notes_json(path: str, notes):
    data = {
        "export_time": datetime.now().isoformat(),
        "notes": [_note_to_dict(n) for n in notes],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=_json_default)


def _export_summary_json(path: str, summary: SettlementSummary):
    data = {
        "export_time": datetime.now().isoformat(),
        "summary": {
            "total_artists": summary.total_artists,
            "total_guarantee": str(summary.total_guarantee),
            "total_box_office_share": str(summary.total_box_office_share),
            "total_sponsor_deduction": str(summary.total_sponsor_deduction),
            "total_due": str(summary.total_due),
            "total_paid": str(summary.total_paid),
            "total_variance": str(summary.total_variance),
            "anomaly_count": summary.anomaly_count,
            "confirmed_count": summary.confirmed_count,
            "rejected_count": summary.rejected_count,
            "pending_count": summary.pending_count,
        },
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _settlement_to_dict(s: SettlementLine) -> dict:
    return {
        "settlement_id": s.settlement_id,
        "artist_id": s.artist_id,
        "artist_name": s.artist_name,
        "guarantee_amount": str(s.guarantee_amount),
        "box_office_share": str(s.box_office_share),
        "sponsor_deduction": str(s.sponsor_deduction),
        "total_due": str(s.total_due),
        "total_paid": str(s.total_paid),
        "variance": str(s.variance),
        "notes": s.notes,
        "status": s.status.value,
        "created_at": s.created_at,
        "updated_at": s.updated_at,
    }


def _anomaly_to_dict(a: AnomalyItem) -> dict:
    return {
        "anomaly_id": a.anomaly_id,
        "anomaly_type": a.anomaly_type,
        "entity_type": a.entity_type,
        "entity_id": a.entity_id,
        "description": a.description,
        "severity": a.severity,
        "resolved": a.resolved,
        "resolution_note": a.resolution_note,
    }


def _note_to_dict(n: NoteEntry) -> dict:
    return {
        "note_id": n.note_id,
        "entity_type": n.entity_type,
        "entity_id": n.entity_id,
        "content": n.content,
        "created_at": n.created_at,
        "author": n.author,
    }


def _json_default(obj):
    if isinstance(obj, decimal.Decimal):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
