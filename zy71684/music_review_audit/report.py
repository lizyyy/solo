import csv
import json
import os
from collections import defaultdict
from datetime import datetime
from typing import Dict, List

from .models import (
    AuditEntry,
    AuditStatus,
    ImportResult,
    RiskType,
)


def _status_icon(status: str) -> str:
    if status == AuditStatus.PROCESSED.value:
        return "✓"
    elif status == AuditStatus.PENDING.value:
        return "◎"
    elif status == AuditStatus.RETURNED.value:
        return "✗"
    return "?"


def _severity_icon(severity: str) -> str:
    if severity == "高":
        return "🔴"
    elif severity == "中":
        return "🟡"
    elif severity == "低":
        return "🟢"
    return "⚪"


def print_terminal_report(
    entries: List[AuditEntry],
    stats: dict,
    risk_summary: dict,
    import_results: Dict[str, ImportResult],
    dedup_log: list,
):
    print("=" * 72)
    print("  乐评情绪标签复核报告")
    print(f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 72)

    print("\n── 导入概况 ──")
    for data_type, result in import_results.items():
        status = "✓" if result.skipped_rows == 0 else "⚠"
        print(f"  {status} {data_type}: 成功{result.success_rows}条, 跳过{result.skipped_rows}条, 共{result.total_rows}条")
        if result.errors:
            for err in result.errors[:5]:
                print(f"    ↳ {err}")
            if len(result.errors) > 5:
                print(f"    ↳ ...还有{len(result.errors) - 5}条错误")

    if dedup_log:
        print(f"\n── 去重记录 ({len(dedup_log)}条) ──")
        for item in dedup_log[:10]:
            print(f"  · {item['type']} ID={item['id']}: {item['reason']}")
            if item["source"]:
                print(f"    ↳ 来源: {item['source']}")
        if len(dedup_log) > 10:
            print(f"  ...还有{len(dedup_log) - 10}条去重记录")

    print(f"\n── 复核统计 ──")
    print(f"  总条目: {stats['total']}")
    by_status = stats.get("by_status", {})
    for status in [AuditStatus.PROCESSED.value, AuditStatus.PENDING.value, AuditStatus.RETURNED.value]:
        count = by_status.get(status, 0)
        icon = _status_icon(status)
        print(f"  {icon} {status}: {count}")

    print(f"\n── 风险概览 ──")
    print(f"  总风险: {risk_summary.get('total_risks', 0)}")
    for risk_type, count in risk_summary.get("by_type", {}).items():
        print(f"  · {risk_type}: {count}")
    for sev, count in risk_summary.get("by_severity", {}).items():
        print(f"  · {sev}风险: {count}")

    status_groups = defaultdict(list)
    for entry in entries:
        status_groups[entry.audit_status].append(entry)

    for status in [AuditStatus.PROCESSED.value, AuditStatus.PENDING.value, AuditStatus.RETURNED.value]:
        group = status_groups.get(status, [])
        if not group:
            continue

        icon = _status_icon(status)
        print(f"\n{'─' * 72}")
        print(f"  {icon} {status} ({len(group)}条)")
        print(f"{'─' * 72}")

        for entry in group:
            text_preview = entry.review_text[:40].replace("\n", " ") + ("..." if len(entry.review_text) > 40 else "")
            print(f"\n  乐评ID: {entry.review_id}")
            print(f"  文本: {text_preview}")
            print(f"  歌曲: {entry.song_title} (ID:{entry.song_id}, 状态:{entry.song_status})")
            print(f"  当前标签: {entry.current_tag}")

            if entry.tag_version_chain:
                chain_str = " → ".join(
                    f"{v.tag}[{v.source_type}:{v.version}]" for v in entry.tag_version_chain
                )
                print(f"  标签版本链: {chain_str}")

            if entry.manual_correction:
                mc = entry.manual_correction
                print(f"  人工修正: {mc.original_tag}→{mc.corrected_tag} (修正人:{mc.reviewer_id})")
                if mc.note:
                    print(f"  修正备注: {mc.note}")

            if entry.risks:
                print(f"  风险:")
                for risk in entry.risks:
                    sev_icon = _severity_icon(risk.severity)
                    print(f"    {sev_icon} [{risk.risk_type.value}] {risk.description}")
                    if risk.evidence:
                        print(f"       证据: {risk.evidence[:80]}")
                    if risk.source:
                        print(f"       来源: {risk.source}")

            if entry.audit_note:
                print(f"  处理说明: {entry.audit_note}")

            if entry.source_traces:
                traces = [str(s) for s in entry.source_traces[:3]]
                print(f"  来源追溯: {' | '.join(traces)}")

            if entry.report_records:
                print(f"  举报记录: {len(entry.report_records)}条")
                for r in entry.report_records[:2]:
                    print(f"    · {r.report_id}: {r.reason} (状态:{r.status})")

    print(f"\n{'=' * 72}")
    print("  报告结束")
    print(f"{'=' * 72}")


def export_csv_report(entries: List[AuditEntry], output_path: str):
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "乐评ID", "乐评文本(前100字)", "用户ID", "歌曲ID", "歌曲名",
            "歌曲状态", "当前标签", "标签版本链", "算法标签", "人工修正",
            "风险类型", "风险等级", "风险描述", "复核状态", "处理说明",
            "来源追溯", "举报数",
        ])

        for entry in entries:
            version_chain = " → ".join(
                f"{v.tag}[{v.source_type}:{v.version}]" for v in entry.tag_version_chain
            )
            algo_tags = "; ".join(f"{t.tag}({t.algorithm_version},conf={t.confidence})" for t in entry.algorithm_tags)
            correction = ""
            if entry.manual_correction:
                mc = entry.manual_correction
                correction = f"{mc.original_tag}→{mc.corrected_tag} by {mc.reviewer_id}"
                if mc.note:
                    correction += f" ({mc.note})"
            risk_types = "; ".join(r.risk_type.value for r in entry.risks)
            risk_sevs = "; ".join(r.severity for r in entry.risks)
            risk_descs = " | ".join(r.description for r in entry.risks)
            traces = " | ".join(str(s) for s in entry.source_traces)

            writer.writerow([
                entry.review_id,
                entry.review_text[:100],
                entry.user_id,
                entry.song_id,
                entry.song_title,
                entry.song_status,
                entry.current_tag,
                version_chain,
                algo_tags,
                correction,
                risk_types,
                risk_sevs,
                risk_descs,
                entry.audit_status,
                entry.audit_note,
                traces,
                len(entry.report_records),
            ])


def export_json_report(entries: List[AuditEntry], stats: dict, risk_summary: dict, output_path: str):
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    report = {
        "report_title": "乐评情绪标签复核报告",
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "statistics": stats,
        "risk_summary": risk_summary,
        "entries": [e.to_dict() for e in entries],
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)


def export_detail_csv(entries: List[AuditEntry], output_dir: str):
    os.makedirs(output_dir, exist_ok=True)

    status_files = {
        AuditStatus.PROCESSED.value: "已处理.csv",
        AuditStatus.PENDING.value: "待确认.csv",
        AuditStatus.RETURNED.value: "退回补材料.csv",
    }

    for status, filename in status_files.items():
        filtered = [e for e in entries if e.audit_status == status]
        if not filtered:
            continue

        filepath = os.path.join(output_dir, filename)
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "乐评ID", "乐评文本", "用户ID", "歌曲ID", "歌曲名",
                "歌曲状态", "当前标签", "标签版本链", "风险", "处理说明",
                "来源追溯",
            ])

            for entry in filtered:
                version_chain = " → ".join(
                    f"{v.tag}[{v.source_type}:{v.version}]" for v in entry.tag_version_chain
                )
                risks = " | ".join(
                    f"[{r.risk_type.value}/{r.severity}] {r.description}" for r in entry.risks
                )
                traces = " | ".join(str(s) for s in entry.source_traces)

                writer.writerow([
                    entry.review_id,
                    entry.review_text[:200],
                    entry.user_id,
                    entry.song_id,
                    entry.song_title,
                    entry.song_status,
                    entry.current_tag,
                    version_chain,
                    risks,
                    entry.audit_note,
                    traces,
                ])


def export_risk_csv(entries: List[AuditEntry], output_path: str):
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "乐评ID", "风险类型", "风险等级", "风险描述", "证据", "来源", "复核状态",
        ])

        for entry in entries:
            for risk in entry.risks:
                writer.writerow([
                    entry.review_id,
                    risk.risk_type.value,
                    risk.severity,
                    risk.description,
                    risk.evidence[:150],
                    str(risk.source) if risk.source else "",
                    entry.audit_status,
                ])
