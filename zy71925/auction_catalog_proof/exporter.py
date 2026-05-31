"""
数据导出模块
============

支持导出布展清单、校对结果等多种格式
"""

import os
import csv
import json
from typing import Dict, List, Optional, Any
from datetime import datetime

from .models import CatalogProofSession, Artwork, WallLayout
from .messages import STATUS_LABELS, get_field_label
from .proof_engine import find_lot_numbers, get_statistics
from .report_generator import (
    _get_wall_layout_for_lot,
    LIGHTING_SOURCE_LABELS,
)


def export_corrected_works_list(
    session: CatalogProofSession,
    output_path: str,
) -> str:
    fieldnames = [
        "拍品编号",
        "中文名称",
        "英文名称",
        "艺术家",
        "艺术家（英文）",
        "创作年代",
        "材质工艺",
        "尺寸",
        "估价",
        "来源",
        "文献",
        "展览历史",
        "作品说明",
        "备注",
        "灯光方案",
        "校对状态",
        "处理备注",
    ]

    rows = []
    for lot, artwork in sorted(session.artworks.items()):
        record = session.proof_records.get(lot)
        layout = _get_wall_layout_for_lot(session, lot)
        conflict = session.lighting_conflicts.get(lot)

        status = record.status if record else "pending"
        manual_edited = record.manual_edited if record else False

        lighting = ""
        if conflict and conflict.status == "resolved":
            lighting = conflict.current_value or ""
        elif layout and layout.lighting_scheme:
            lighting = layout.lighting_scheme
        elif hasattr(artwork, "lighting_scheme") and artwork.lighting_scheme:
            lighting = artwork.lighting_scheme

        processing_note = ""
        if manual_edited:
            processing_note = "已人工修改：" + "、".join(
                [get_field_label(f) for f in (record.edited_fields if record else [])]
            )
        elif status == "needs_info":
            processing_note = "待补充信息"
        elif status == "confirmed":
            processing_note = "已确认无误"

        rows.append({
            "拍品编号": artwork.lot_number,
            "中文名称": artwork.title_cn,
            "英文名称": artwork.title_en or "",
            "艺术家": artwork.artist or "",
            "艺术家（英文）": artwork.artist_en or "",
            "创作年代": artwork.year or "",
            "材质工艺": artwork.medium or "",
            "尺寸": artwork.dimensions or "",
            "估价": artwork.estimate or "",
            "来源": artwork.provenance or "",
            "文献": artwork.literature or "",
            "展览历史": artwork.exhibition or "",
            "作品说明": artwork.description or "",
            "备注": artwork.notes or "",
            "灯光方案": lighting,
            "校对状态": STATUS_LABELS.get(status, status),
            "处理备注": processing_note,
        })

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return output_path


def export_wall_layout_with_proof(
    session: CatalogProofSession,
    output_path: str,
) -> str:
    fieldnames = [
        "展墙编号",
        "展墙名称",
        "拍品编号",
        "作品名称",
        "艺术家",
        "X坐标",
        "Y坐标",
        "宽度",
        "高度",
        "展示顺序",
        "灯光方案",
        "灯光来源",
        "校对状态",
        "备注",
    ]

    rows = []
    for key, layout in sorted(session.wall_layouts.items()):
        artwork = session.artworks.get(layout.lot_number)
        record = session.proof_records.get(layout.lot_number)
        conflict = session.lighting_conflicts.get(layout.lot_number)

        status = record.status if record else "pending"

        lighting = layout.lighting_scheme or ""
        lighting_source = LIGHTING_SOURCE_LABELS.get(layout.lighting_source, layout.lighting_source)
        if conflict and conflict.status == "resolved":
            lighting = conflict.current_value or lighting
            lighting_source = "已确认"

        rows.append({
            "展墙编号": layout.wall_id,
            "展墙名称": layout.wall_name,
            "拍品编号": layout.lot_number,
            "作品名称": artwork.title_cn if artwork else "",
            "艺术家": artwork.artist if artwork else "",
            "X坐标": layout.position_x or "",
            "Y坐标": layout.position_y or "",
            "宽度": layout.width or "",
            "高度": layout.height or "",
            "展示顺序": layout.display_sequence or "",
            "灯光方案": lighting,
            "灯光来源": lighting_source,
            "校对状态": STATUS_LABELS.get(status, status),
            "备注": layout.notes or "",
        })

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return output_path


def export_proof_summary(
    session: CatalogProofSession,
    output_path: str,
) -> str:
    stats = get_statistics(session)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    summary = {
        "session_name": session.session_name,
        "generated_at": generated_at,
        "works_list_source": session.works_list_source,
        "wall_layout_source": session.wall_layout_source,
        "statistics": stats,
        "summary_text": _generate_summary_text(stats),
        "pending_items": _get_pending_items_summary(session),
        "lighting_issues": _get_lighting_issues_summary(session),
    }

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    return output_path


def _generate_summary_text(stats: Dict[str, int]) -> str:
    lines = [
        f"本次校对共处理 {stats['total_lots']} 件拍品：",
        f"  • 已确认无误：{stats['confirmed']} 件",
        f"  • 待处理差异：{stats['pending']} 件",
        f"  • 待补充信息：{stats['needs_info']} 件",
        f"  • 已人工修改：{stats['manual_edited']} 件",
        "",
        f"发现差异 {stats['total_differences']} 处，其中：",
        f"  • 严重差异：{stats['critical_differences']} 处",
        f"  • 已解决：{stats['resolved_differences']} 处",
        f"  • 待处理：{stats['pending_differences']} 处",
        "",
        f"灯光方案冲突 {stats['lighting_conflicts']} 个：",
        f"  • 已解决：{stats['resolved_lighting_conflicts']} 个",
        f"  • 待处理：{stats['pending_lighting_conflicts']} 个",
    ]

    if stats['pending_differences'] == 0 and stats['pending_lighting_conflicts'] == 0:
        lines.append("")
        lines.append("✅ 所有问题都已处理完毕，可以直接出图录！")
    else:
        lines.append("")
        lines.append(
            f"⚠️ 还有 {stats['pending_differences'] + stats['pending_lighting_conflicts']} "
            f"个问题需要处理，建议处理完再出最终版。"
        )

    return "\n".join(lines)


def _get_pending_items_summary(session: CatalogProofSession) -> List[Dict[str, Any]]:
    items = []
    for diff in session.differences.values():
        if diff.status == "pending":
            artwork = session.artworks.get(diff.lot_number)
            items.append({
                "lot_number": diff.lot_number,
                "title": artwork.title_cn if artwork else "",
                "field": diff.field_label,
                "severity": diff.severity,
                "message": diff.message.split("\n")[0],
                "works_list_value": diff.works_list_value,
                "wall_layout_value": diff.wall_layout_value,
            })

    items.sort(key=lambda x: (0 if x["severity"] == "critical" else 1, x["lot_number"]))
    return items


def _get_lighting_issues_summary(session: CatalogProofSession) -> List[Dict[str, Any]]:
    issues = []
    for conflict in session.lighting_conflicts.values():
        if conflict.status == "pending":
            artwork = session.artworks.get(conflict.lot_number)
            issues.append({
                "lot_number": conflict.lot_number,
                "title": artwork.title_cn if artwork else "",
                "works_list_lighting": conflict.works_list_lighting,
                "wall_layout_lighting": conflict.wall_layout_lighting,
                "next_step": conflict.next_contact,
            })
    return issues


def print_summary(session: CatalogProofSession) -> None:
    stats = get_statistics(session)
    summary = _generate_summary_text(stats)
    print("\n" + "=" * 60)
    print("📋 拍卖图录校对 - 校对摘要")
    print("=" * 60)
    print(summary)
    print("=" * 60 + "\n")

    if stats["pending_differences"] > 0:
        print("🔍 待处理差异：")
        for item in _get_pending_items_summary(session)[:10]:
            severity_icon = "🔴" if item["severity"] == "critical" else "🟡"
            print(f"  {severity_icon} {item['lot_number']} {item['title']} - {item['field']}")
            print(f"     {item['message']}")
        print()

    if stats["pending_lighting_conflicts"] > 0:
        print("💡 待处理灯光冲突：")
        for issue in _get_lighting_issues_summary(session):
            print(f"  ⚡ {issue['lot_number']} {issue['title']}")
            print(f"     作品清单：{issue['works_list_lighting']}")
            print(f"     展墙图：{issue['wall_layout_lighting']}")
            print(f"     下一步：{issue['next_step']}")
        print()
