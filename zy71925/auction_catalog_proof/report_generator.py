"""
HTML报告生成器
==============

生成面向策展人和一线同事的校对报告、布展清单
"""

import os
import csv
from typing import Dict, List, Optional, Any
from datetime import datetime
import json

from .models import (
    CatalogProofSession,
    Artwork,
    WallLayout,
    Difference,
    LightingConflict,
    ProofRecord,
)
from .messages import (
    get_field_label,
    STATUS_LABELS,
    SEVERITY_LABELS,
)
from .proof_engine import (
    get_statistics,
    get_lot_history,
    format_history_for_display,
    find_lot_numbers,
)


LIGHTING_SOURCE_LABELS = {
    "works_list": "来自作品清单",
    "wall_layout": "来自展墙图",
    "manual": "人工调整",
}

STATUS_COLORS = {
    "confirmed": "#10b981",
    "pending": "#f59e0b",
    "needs_info": "#ef4444",
    "manual_edited": "#8b5cf6",
    "resolved": "#10b981",
}

SEVERITY_COLORS = {
    "critical": "#dc2626",
    "warning": "#f59e0b",
    "info": "#3b82f6",
}


def _escape_html(text: Optional[str]) -> str:
    if text is None:
        return ""
    text = str(text)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _format_value(value: Optional[str]) -> str:
    if value is None or str(value).strip() == "":
        return '<span class="text-gray-400 italic">（空）</span>'
    return _escape_html(str(value))


def _get_wall_layout_for_lot(
    session: CatalogProofSession, lot_number: str
) -> Optional[WallLayout]:
    for layout in session.wall_layouts.values():
        if layout.lot_number == lot_number:
            return layout
    return None


def _get_differences_for_lot(
    session: CatalogProofSession, lot_number: str
) -> List[Difference]:
    return [d for d in session.differences.values() if d.lot_number == lot_number]


def _get_lighting_for_lot(
    session: CatalogProofSession, lot_number: str
) -> Optional[LightingConflict]:
    return session.lighting_conflicts.get(lot_number)


def generate_html_report(
    session: CatalogProofSession,
    output_path: str,
    title: str = "拍卖图录校对报告",
) -> str:
    stats = get_statistics(session)
    all_lots = sorted(find_lot_numbers(session.artworks, session.wall_layouts))

    confirmed_lots = []
    pending_lots = []
    needs_info_lots = []
    manual_edited_lots = []

    for lot in all_lots:
        record = session.proof_records.get(lot)
        status = record.status if record else "pending"
        if status == "confirmed":
            confirmed_lots.append(lot)
        elif status == "pending":
            pending_lots.append(lot)
        elif status == "needs_info":
            needs_info_lots.append(lot)
        elif status == "manual_edited":
            manual_edited_lots.append(lot)

    html = _generate_html_header(title, stats)

    html += _generate_summary_section(stats)

    html += _generate_exhibition_list_section(
        session, all_lots, confirmed_lots, pending_lots, needs_info_lots, manual_edited_lots
    )

    html += _generate_differences_section(session)

    html += _generate_lighting_section(session)

    html += _generate_history_section(session)

    html += _generate_html_footer()

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    return output_path


def _generate_html_header(title: str, stats: Dict[str, int]) -> str:
    progress = 0
    if stats["total_lots"] > 0:
        progress = int(
            (stats["confirmed"] + stats["manual_edited"]) / stats["total_lots"] * 100
        )

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{_escape_html(title)}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; padding: 24px; }}
        .header {{
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
            color: white;
            padding: 32px;
            border-radius: 12px;
            margin-bottom: 24px;
        }}
        .header h1 {{ font-size: 28px; font-weight: 600; margin-bottom: 8px; }}
        .header p {{ opacity: 0.9; font-size: 14px; }}
        .progress-bar {{
            background: rgba(255,255,255,0.2);
            height: 8px;
            border-radius: 4px;
            margin-top: 16px;
            overflow: hidden;
        }}
        .progress-fill {{
            height: 100%;
            background: #10b981;
            width: {progress}%;
            transition: width 0.3s;
        }}
        .section {{
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .section-title {{
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .section-title .badge {{
            font-size: 12px;
            padding: 4px 12px;
            border-radius: 20px;
            background: #e0e7ff;
            color: #4338ca;
            font-weight: 500;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
        }}
        .stat-card {{
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }}
        .stat-card .number {{
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 4px;
        }}
        .stat-card .label {{
            font-size: 13px;
            color: #64748b;
        }}
        .stat-card.confirmed {{ background: #ecfdf5; }}
        .stat-card.confirmed .number {{ color: #059669; }}
        .stat-card.pending {{ background: #fffbeb; }}
        .stat-card.pending .number {{ color: #d97706; }}
        .stat-card.needs-info {{ background: #fef2f2; }}
        .stat-card.needs-info .number {{ color: #dc2626; }}
        .stat-card.manual {{ background: #f5f3ff; }}
        .stat-card.manual .number {{ color: #7c3aed; }}
        .status-badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
        }}
        .status-confirmed {{ background: #d1fae5; color: #065f46; }}
        .status-pending {{ background: #fef3c7; color: #92400e; }}
        .status-needs-info {{ background: #fee2e2; color: #991b1b; }}
        .status-manual {{ background: #ede9fe; color: #5b21b6; }}
        .severity-badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
        }}
        .severity-critical {{ background: #fee2e2; color: #991b1b; }}
        .severity-warning {{ background: #fef3c7; color: #92400e; }}
        .severity-info {{ background: #dbeafe; color: #1e40af; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
        th {{
            background: #f1f5f9;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #475569;
            border-bottom: 2px solid #e2e8f0;
        }}
        td {{
            padding: 12px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
        }}
        tr:hover {{ background: #f8fafc; }}
        .diff-card {{
            background: #fffbeb;
            border: 1px solid #fcd34d;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
        }}
        .diff-card.critical {{
            background: #fef2f2;
            border-color: #fca5a5;
        }}
        .diff-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }}
        .diff-title {{
            font-weight: 600;
            font-size: 15px;
        }}
        .diff-message {{
            color: #475569;
            margin-bottom: 12px;
            white-space: pre-wrap;
            line-height: 1.8;
        }}
        .diff-values {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 12px;
        }}
        .diff-value-box {{
            padding: 12px;
            border-radius: 6px;
            background: rgba(255,255,255,0.8);
        }}
        .diff-value-label {{
            font-size: 11px;
            color: #64748b;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .diff-value-text {{
            font-size: 14px;
            font-weight: 500;
        }}
        .diff-resolution {{
            padding: 12px;
            background: #d1fae5;
            border-radius: 6px;
            color: #065f46;
            font-size: 13px;
        }}
        .lighting-card {{
            background: #eff6ff;
            border: 1px solid #93c5fd;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
        }}
        .lighting-card.resolved {{
            background: #f0fdf4;
            border-color: #86efac;
        }}
        .lighting-source {{
            font-size: 12px;
            color: #64748b;
            margin-top: 8px;
        }}
        .next-step {{
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            margin-top: 12px;
            border-radius: 4px;
            font-size: 13px;
        }}
        .history-item {{
            padding: 12px;
            border-left: 3px solid #e2e8f0;
            margin-bottom: 8px;
            background: #f8fafc;
            border-radius: 0 6px 6px 0;
        }}
        .history-item.latest {{
            border-left-color: #10b981;
            background: #f0fdf4;
        }}
        .history-time {{
            font-size: 11px;
            color: #64748b;
            margin-bottom: 4px;
        }}
        .history-action {{
            font-weight: 500;
            font-size: 13px;
        }}
        .history-operator {{
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
        }}
        .history-notes {{
            font-size: 12px;
            color: #475569;
            margin-top: 4px;
        }}
        .processing-note {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            background: #e0e7ff;
            color: #4338ca;
            margin-left: 8px;
        }}
        .tabs {{
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            border-bottom: 2px solid #e2e8f0;
        }}
        .tab {{
            padding: 8px 16px;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            margin-bottom: -2px;
            font-weight: 500;
            color: #64748b;
            transition: all 0.2s;
        }}
        .tab.active {{
            color: #2563eb;
            border-bottom-color: #2563eb;
        }}
        .tab:hover {{ color: #2563eb; }}
        .tab-content {{ display: none; }}
        .tab-content.active {{ display: block; }}
        .lot-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }}
        .lot-title {{
            font-weight: 600;
            font-size: 15px;
        }}
        .lot-subtitle {{
            font-size: 13px;
            color: #64748b;
        }}
        .edit-marker {{
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #8b5cf6;
            margin-right: 6px;
        }}
        .footer {{
            text-align: center;
            padding: 24px;
            color: #94a3b8;
            font-size: 12px;
        }}
        .source-info {{
            background: #f1f5f9;
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 13px;
            color: #475569;
        }}
        .collapsible {{
            cursor: pointer;
            user-select: none;
        }}
        .collapsible::after {{
            content: ' ▼';
            font-size: 10px;
            transition: transform 0.2s;
        }}
        .collapsible.collapsed::after {{
            transform: rotate(-90deg);
        }}
        .collapsed-content {{
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }}
        .collapsed-content.open {{
            max-height: 2000px;
        }}
        .wall-group {{
            margin-bottom: 24px;
        }}
        .wall-group-title {{
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            padding: 8px 12px;
            background: #f1f5f9;
            border-radius: 6px;
        }}
    </style>
</head>
<body>
    <div class="container">
"""


def _generate_summary_section(stats: Dict[str, int]) -> str:
    return f"""
        <div class="section">
            <div class="section-title">
                校对概览
                <span class="badge">共 {stats['total_lots']} 件拍品</span>
            </div>
            <div class="stats-grid">
                <div class="stat-card confirmed">
                    <div class="number">{stats['confirmed']}</div>
                    <div class="label">已确认</div>
                </div>
                <div class="stat-card pending">
                    <div class="number">{stats['pending']}</div>
                    <div class="label">待处理</div>
                </div>
                <div class="stat-card needs-info">
                    <div class="number">{stats['needs_info']}</div>
                    <div class="label">待补充</div>
                </div>
                <div class="stat-card manual">
                    <div class="number">{stats['manual_edited']}</div>
                    <div class="label">人工修改</div>
                </div>
                <div class="stat-card pending">
                    <div class="number">{stats['pending_differences']}</div>
                    <div class="label">待处理差异</div>
                </div>
                <div class="stat-card needs-info">
                    <div class="number">{stats['critical_differences']}</div>
                    <div class="label">严重差异</div>
                </div>
            </div>
        </div>
"""


def _generate_exhibition_list_section(
    session: CatalogProofSession,
    all_lots: List[str],
    confirmed_lots: List[str],
    pending_lots: List[str],
    needs_info_lots: List[str],
    manual_edited_lots: List[str],
) -> str:
    html = """
        <div class="section">
            <div class="section-title">
                布展清单（给策展人）
                <span class="badge">含处理口径</span>
            </div>

            <div class="tabs">
                <div class="tab active" onclick="switchTab(this, 'all')">全部 ({len_all})</div>
                <div class="tab" onclick="switchTab(this, 'confirmed')">已确认 ({len_confirmed})</div>
                <div class="tab" onclick="switchTab(this, 'pending')">待处理 ({len_pending})</div>
                <div class="tab" onclick="switchTab(this, 'needs_info')">待补充 ({len_needs})</div>
                <div class="tab" onclick="switchTab(this, 'manual')">人工修改 ({len_manual})</div>
            </div>
""".format(
        len_all=len(all_lots),
        len_confirmed=len(confirmed_lots),
        len_pending=len(pending_lots),
        len_needs=len(needs_info_lots),
        len_manual=len(manual_edited_lots),
    )

    html += f"""
            <div id="tab-all" class="tab-content active">
                {_generate_lot_table(session, all_lots)}
            </div>
            <div id="tab-confirmed" class="tab-content">
                {_generate_lot_table(session, confirmed_lots)}
            </div>
            <div id="tab-pending" class="tab-content">
                {_generate_lot_table(session, pending_lots)}
            </div>
            <div id="tab-needs_info" class="tab-content">
                {_generate_lot_table(session, needs_info_lots)}
            </div>
            <div id="tab-manual" class="tab-content">
                {_generate_lot_table(session, manual_edited_lots)}
            </div>
        </div>
"""

    return html


def _generate_lot_table(session: CatalogProofSession, lots: List[str]) -> str:
    if not lots:
        return '<p class="text-gray-500 text-center py-8">暂无数据</p>'

    walls: Dict[str, List[str]] = {}
    for lot in lots:
        layout = _get_wall_layout_for_lot(session, lot)
        wall_id = layout.wall_id if layout else "未安排"
        wall_name = layout.wall_name if layout else "未安排展墙"
        key = f"{wall_id}|{wall_name}"
        if key not in walls:
            walls[key] = []
        walls[key].append(lot)

    html = ""
    for key in sorted(walls.keys()):
        wall_id, wall_name = key.split("|", 1)
        wall_lots = sorted(
            walls[key],
            key=lambda x: (
                _get_wall_layout_for_lot(session, x).display_sequence
                if _get_wall_layout_for_lot(session, x)
                else 999
            ),
        )

        html += f"""
            <div class="wall-group">
                <div class="wall-group-title collapsible" onclick="toggleSection(this)">
                    {_escape_html(wall_name)}（{wall_id}）- 共 {len(wall_lots)} 件
                </div>
                <div class="collapsed-content open">
                    <table>
                        <thead>
                            <tr>
                                <th>拍品编号</th>
                                <th>作品名称</th>
                                <th>艺术家</th>
                                <th>尺寸</th>
                                <th>估价</th>
                                <th>灯光方案</th>
                                <th>状态</th>
                                <th>处理口径</th>
                            </tr>
                        </thead>
                        <tbody>
"""

        for lot in wall_lots:
            artwork = session.artworks.get(lot)
            layout = _get_wall_layout_for_lot(session, lot)
            record = session.proof_records.get(lot)
            lighting_conflict = _get_lighting_for_lot(session, lot)

            status = record.status if record else "pending"
            status_class = f"status-{status}"
            status_label = STATUS_LABELS.get(status, status)

            lighting_value = ""
            lighting_note = ""
            if lighting_conflict:
                if lighting_conflict.status == "resolved":
                    lighting_value = lighting_conflict.current_value or ""
                    source = "作品清单" if lighting_conflict.resolution and "作品清单" in lighting_conflict.resolution else "展墙图"
                    lighting_note = f'<div class="lighting-source">来源：{source}（已确认）</div>'
                else:
                    lighting_value = lighting_conflict.wall_layout_lighting or "待确认"
                    lighting_note = '<div class="lighting-source">⚠️ 灯光方案有冲突</div>'
            elif layout and layout.lighting_scheme:
                lighting_value = layout.lighting_scheme
                source_label = LIGHTING_SOURCE_LABELS.get(layout.lighting_source, layout.lighting_source)
                lighting_note = f'<div class="lighting-source">来源：{source_label}</div>'
            elif artwork and hasattr(artwork, "lighting_scheme") and artwork.lighting_scheme:
                lighting_value = artwork.lighting_scheme
                lighting_note = '<div class="lighting-source">来源：作品清单</div>'

            processing_note = ""
            if status == "manual_edited":
                processing_note = '<span class="processing-note">已人工调整</span>'
            elif status == "needs_info":
                processing_note = '<span class="processing-note" style="background:#fee2e2;color:#991b1b;">待策展人确认</span>'
            elif status == "pending":
                processing_note = '<span class="processing-note" style="background:#fef3c7;color:#92400e;">需校对</span>'
            else:
                processing_note = '<span class="processing-note" style="background:#d1fae5;color:#065f46;">可直接使用</span>'

            html += f"""
                            <tr>
                                <td><strong>{_escape_html(lot)}</strong></td>
                                <td>
                                    {_format_value(artwork.title_cn if artwork else "")}
                                    <div class="lot-subtitle">{_format_value(artwork.title_en if artwork else "")}</div>
                                </td>
                                <td>{_format_value(artwork.artist if artwork else "")}</td>
                                <td>{_format_value(artwork.dimensions if artwork else "")}</td>
                                <td>{_format_value(artwork.estimate if artwork else "")}</td>
                                <td>
                                    {_format_value(lighting_value)}
                                    {lighting_note}
                                </td>
                                <td><span class="status-badge {status_class}">{status_label}</span></td>
                                <td>{processing_note}</td>
                            </tr>
"""

        html += """
                        </tbody>
                    </table>
                </div>
            </div>
"""

    return html


def _generate_differences_section(session: CatalogProofSession) -> str:
    differences = sorted(
        session.differences.values(),
        key=lambda d: (0 if d.severity == "critical" else 1, d.lot_number),
    )

    if not differences:
        return """
        <div class="section">
            <div class="section-title">
                差异详情
                <span class="badge">0 处</span>
            </div>
            <p class="text-center py-8 text-gray-500">🎉 没有发现差异，两边数据完全一致！</p>
        </div>
"""

    pending_count = sum(1 for d in differences if d.status == "pending")
    resolved_count = sum(1 for d in differences if d.status == "resolved")

    html = f"""
        <div class="section">
            <div class="section-title">
                差异详情
                <span class="badge">{len(differences)} 处差异 · {pending_count} 待处理 · {resolved_count} 已解决</span>
            </div>
"""

    for diff in differences:
        artwork = session.artworks.get(diff.lot_number)
        title = artwork.title_cn if artwork else diff.lot_number

        severity_class = "severity-" + diff.severity
        card_class = "diff-card" + (" critical" if diff.severity == "critical" else "")

        html += f"""
            <div class="{card_class}">
                <div class="diff-header">
                    <div>
                        <span class="diff-title">{_escape_html(diff.lot_number)} - {_escape_html(title)}</span>
                        <span class="severity-badge {severity_class}">{SEVERITY_LABELS.get(diff.severity, diff.severity)}</span>
                        <span class="status-badge status-{diff.status}">{STATUS_LABELS.get(diff.status, diff.status)}</span>
                    </div>
                    <div style="color:#64748b;font-size:12px;">字段：{_escape_html(diff.field_label)}</div>
                </div>
                <div class="diff-message">{_escape_html(diff.message)}</div>
"""

        if diff.status != "resolved":
            html += f"""
                <div class="diff-values">
                    <div class="diff-value-box">
                        <div class="diff-value-label">📋 作品清单</div>
                        <div class="diff-value-text">{_format_value(diff.works_list_value)}</div>
                    </div>
                    <div class="diff-value-box">
                        <div class="diff-value-label">🖼️ 展墙图</div>
                        <div class="diff-value-text">{_format_value(diff.wall_layout_value)}</div>
                    </div>
                </div>
"""
        else:
            html += f"""
                <div class="diff-resolution">
                    ✅ 已解决：{_escape_html(diff.resolution or "")}
                    {" | 最终值：" + _escape_html(diff.final_value) if diff.final_value else ""}
                    <div style="font-size:11px;margin-top:4px;opacity:0.8;">
                        处理人：{_escape_html(diff.resolved_by or "")} · {_escape_html(diff.resolved_at or "")}
                    </div>
                </div>
"""

        html += "</div>"

    html += "</div>"
    return html


def _generate_lighting_section(session: CatalogProofSession) -> str:
    conflicts = sorted(
        session.lighting_conflicts.values(),
        key=lambda c: (0 if c.status == "pending" else 1, c.lot_number),
    )

    if not conflicts:
        return """
        <div class="section">
            <div class="section-title">
                灯光方案追踪
                <span class="badge">0 个冲突</span>
            </div>
            <p class="text-center py-8 text-gray-500">💡 所有灯光方案都已对齐！</p>
        </div>
"""

    pending_count = sum(1 for c in conflicts if c.status == "pending")
    resolved_count = sum(1 for c in conflicts if c.status == "resolved")

    html = f"""
        <div class="section">
            <div class="section-title">
                灯光方案追踪
                <span class="badge">{len(conflicts)} 个冲突 · {pending_count} 待处理 · {resolved_count} 已解决</span>
            </div>
            <div class="source-info">
                ℹ️ 灯光方案来自两个渠道——作品清单（策展人要求）和展墙图（现场布置）。
                两者不一致时不会自动覆盖，会保留两边的值并提示下一步该找谁确认。
            </div>
"""

    for conflict in conflicts:
        artwork = session.artworks.get(conflict.lot_number)
        title = artwork.title_cn if artwork else conflict.lot_number

        card_class = "lighting-card" + (" resolved" if conflict.status == "resolved" else "")
        status_class = f"status-{conflict.status}"

        html += f"""
            <div class="{card_class}">
                <div class="diff-header">
                    <div>
                        <span class="diff-title">{_escape_html(conflict.lot_number)} - {_escape_html(title)}</span>
                        <span class="status-badge {status_class}">{STATUS_LABELS.get(conflict.status, conflict.status)}</span>
                    </div>
                </div>
                <div class="diff-message">{_escape_html(conflict.message)}</div>
"""

        if conflict.status != "resolved":
            html += f"""
                <div class="diff-values">
                    <div class="diff-value-box">
                        <div class="diff-value-label">📋 作品清单（策展人要求）</div>
                        <div class="diff-value-text">{_format_value(conflict.works_list_lighting)}</div>
                    </div>
                    <div class="diff-value-box">
                        <div class="diff-value-label">🖼️ 展墙图（现场布置）</div>
                        <div class="diff-value-text">{_format_value(conflict.wall_layout_lighting)}</div>
                    </div>
                </div>
                <div class="next-step">
                    ➡️ {_escape_html(conflict.next_contact or "")}
                </div>
"""
        else:
            html += f"""
                <div class="diff-resolution">
                    ✅ 已确定灯光方案：{_escape_html(conflict.current_value or "")}
                    <div style="margin-top:8px;">处理方式：{_escape_html(conflict.resolution or "")}</div>
                    <div style="font-size:11px;margin-top:4px;opacity:0.8;">
                        处理人：{_escape_html(conflict.resolved_by or "")} · {_escape_html(conflict.resolved_at or "")}
                    </div>
                </div>
"""

        html += "</div>"

    html += "</div>"
    return html


def _generate_history_section(session: CatalogProofSession) -> str:
    history = sorted(session.history, key=lambda h: h.timestamp, reverse=True)
    history_display = format_history_for_display(history[:50])

    html = f"""
        <div class="section">
            <div class="section-title">
                操作历史
                <span class="badge">最近 50 条</span>
            </div>
"""

    for i, entry in enumerate(history_display):
        is_latest = i == 0
        item_class = "history-item" + (" latest" if is_latest else "")

        html += f"""
            <div class="{item_class}">
                <div class="history-time">
                    {_escape_html(entry['timestamp'])}
                    {"🆕 最新" if is_latest else ""}
                </div>
                <div class="history-action">{_escape_html(entry['action'])}</div>
                {"<div class='history-notes'>📝 " + _escape_html(entry['notes']) + "</div>" if entry['notes'] else ""}
                {"<div class='history-operator'>👤 操作人：" + _escape_html(entry['operator']) + "</div>" if entry['operator'] else ""}
            </div>
"""

    html += "</div>"
    return html


def _generate_html_footer() -> str:
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return f"""
        <div class="footer">
            拍卖图录校对系统 · 报告生成于 {generated_at}
        </div>
    </div>

    <script>
        function switchTab(element, tabName) {{
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            element.classList.add('active');
            document.getElementById('tab-' + tabName).classList.add('active');
        }}

        function toggleSection(element) {{
            element.classList.toggle('collapsed');
            const content = element.nextElementSibling;
            content.classList.toggle('open');
        }}
    </script>
</body>
</html>
"""


def export_exhibition_list_csv(
    session: CatalogProofSession,
    output_path: str,
) -> str:
    all_lots = sorted(find_lot_numbers(session.artworks, session.wall_layouts))

    rows = []
    for lot in all_lots:
        artwork = session.artworks.get(lot)
        layout = _get_wall_layout_for_lot(session, lot)
        record = session.proof_records.get(lot)
        lighting_conflict = _get_lighting_for_lot(session, lot)

        status = record.status if record else "pending"
        manual_edited = record.manual_edited if record else False

        lighting_value = ""
        lighting_source = ""
        if lighting_conflict and lighting_conflict.status == "resolved":
            lighting_value = lighting_conflict.current_value or ""
            lighting_source = "已确认"
        elif layout and layout.lighting_scheme:
            lighting_value = layout.lighting_scheme
            lighting_source = LIGHTING_SOURCE_LABELS.get(layout.lighting_source, layout.lighting_source)
        elif artwork and hasattr(artwork, "lighting_scheme") and artwork.lighting_scheme:
            lighting_value = artwork.lighting_scheme
            lighting_source = "作品清单"

        processing_note = ""
        if status == "confirmed" and not manual_edited:
            processing_note = "已确认，可直接使用"
        elif status == "confirmed" and manual_edited:
            processing_note = "已人工调整，请注意核对"
        elif status == "manual_edited":
            processing_note = "已人工修改，已确认"
        elif status == "needs_info":
            processing_note = "待策展人补充信息"
        else:
            processing_note = "待校对确认"

        rows.append({
            "展墙编号": layout.wall_id if layout else "",
            "展墙名称": layout.wall_name if layout else "",
            "展示顺序": layout.display_sequence if layout else "",
            "拍品编号": lot,
            "中文名称": artwork.title_cn if artwork else "",
            "英文名称": artwork.title_en if artwork else "",
            "艺术家": artwork.artist if artwork else "",
            "创作年代": artwork.year if artwork else "",
            "材质工艺": artwork.medium if artwork else "",
            "尺寸": artwork.dimensions if artwork else "",
            "估价": artwork.estimate if artwork else "",
            "灯光方案": lighting_value,
            "灯光来源": lighting_source,
            "校对状态": STATUS_LABELS.get(status, status),
            "处理口径": processing_note,
            "是否人工修改": "是" if manual_edited else "否",
            "修改字段": ", ".join(record.edited_fields) if record and record.edited_fields else "",
            "修改备注": record.edit_notes if record else "",
        })

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys() if rows else [])
        writer.writeheader()
        writer.writerows(rows)

    return output_path


def export_session_json(session: CatalogProofSession, output_path: str) -> str:
    session.save(output_path)
    return output_path
