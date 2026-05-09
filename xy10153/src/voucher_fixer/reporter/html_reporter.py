from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from ..analyzer import (
    DuplicateAnalysis,
    GapAnalysis,
    ReverseAnalysis,
)
from ..fixer import AuditLog, RepairPlan
from ..models.voucher import VoucherBatch, VoucherType


class HTMLReporter:
    def generate(
        self,
        batch: VoucherBatch,
        gap_analysis: GapAnalysis,
        dup_analysis: DuplicateAnalysis,
        reverse_analysis: ReverseAnalysis,
        repair_plan: RepairPlan,
        audit_log: AuditLog,
        output_path: str,
    ) -> str:
        data = self._collect_data(
            batch, gap_analysis, dup_analysis, reverse_analysis,
            repair_plan, audit_log,
        )
        html = self._render(data)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)
        return output_path

    def _collect_data(
        self,
        batch: VoucherBatch,
        gap_analysis: GapAnalysis,
        dup_analysis: DuplicateAnalysis,
        reverse_analysis: ReverseAnalysis,
        repair_plan: RepairPlan,
        audit_log: AuditLog,
    ) -> Dict[str, Any]:
        return {
            "generated_at": datetime.now().isoformat(),
            "batch": {
                "total_vouchers": len(batch.vouchers),
                "source_files": batch.source_files,
                "by_type": {
                    vtype.value: count
                    for vtype, count in self._count_by_type(batch).items()
                },
            },
            "gap": {
                "has_issues": gap_analysis.has_issues(),
                "issue_count": len(gap_analysis.issues),
                "issues": [
                    {
                        "voucher_type": i.voucher_type.value,
                        "missing_number": i.missing_number,
                        "detail": i.detail,
                    }
                    for i in gap_analysis.issues
                ],
                "stats": {
                    vt.value: stats for vt, stats in gap_analysis.type_stats.items()
                },
            },
            "duplicate": {
                "has_issues": dup_analysis.has_issues(),
                "issue_count": len(dup_analysis.issues),
                "total_duplicates": dup_analysis.total_duplicates,
                "issues": [
                    {
                        "voucher_type": i.voucher_type.value,
                        "voucher_number": i.voucher_number,
                        "count": i.count,
                        "sources": i.get_sources(),
                    }
                    for i in dup_analysis.issues
                ],
            },
            "reverse": {
                "pair_count": len(reverse_analysis.pairs),
                "unmatched_count": len(reverse_analysis.unmatched_reversals),
                "pairs": [
                    {
                        "original": {
                            "voucher_type": p.original.voucher_type.value,
                            "voucher_number": p.original.voucher_number,
                            "source": f"{p.original.source_file}:{p.original.line_number}",
                        },
                        "reversal": {
                            "voucher_type": p.reversal.voucher_type.value,
                            "voucher_number": p.reversal.voucher_number,
                            "source": f"{p.reversal.source_file}:{p.reversal.line_number}",
                        },
                        "confidence": p.confidence,
                        "matched_by": p.matched_by,
                        "date_diff_days": p.date_diff_days,
                    }
                    for p in reverse_analysis.pairs
                ],
                "unmatched": [
                    {
                        "voucher": {
                            "voucher_type": um.voucher.voucher_type.value,
                            "voucher_number": um.voucher.voucher_number,
                            "source": f"{um.voucher.source_file}:{um.voucher.line_number}",
                            "description": um.voucher.description,
                        },
                        "reason": um.reason,
                        "possible_matches": [
                            f"{p.voucher_type.value}{p.voucher_number} ({p.source_file}:{p.line_number})"
                            for p in um.possible_matches
                        ],
                    }
                    for um in reverse_analysis.unmatched_reversals
                ],
            },
            "repair_plan": {
                "has_actions": repair_plan.has_actions(),
                "can_auto_apply": repair_plan.can_auto_apply,
                "summary": repair_plan.summary,
                "actions": [
                    {
                        "id": a.id,
                        "action_type": a.action_type.value,
                        "title": a.title,
                        "description": a.description,
                        "impact": a.impact,
                        "source_reference": a.source_reference,
                        "can_auto_apply": a.can_auto_apply,
                        "risk_level": a.risk_level,
                        "details": a.details,
                    }
                    for a in repair_plan.actions
                ],
            },
            "audit": {
                "summary": audit_log.get_summary(),
                "entries": [e.to_dict() for e in audit_log.entries],
            },
        }

    def _count_by_type(self, batch: VoucherBatch) -> Dict[VoucherType, int]:
        result: Dict[VoucherType, int] = {}
        for v in batch.vouchers:
            result[v.voucher_type] = result.get(v.voucher_type, 0) + 1
        return result

    def _render(self, data: Dict[str, Any]) -> str:
        json_data = json.dumps(data, ensure_ascii=False)
        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>账套凭证断号修复报告</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f7fa;
            color: #1f2937;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        h1 {{ color: #111827; margin-bottom: 20px; }}
        h2 {{ color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }}
        h3 {{ color: #4b5563; }}
        .card {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .stat-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
        }}
        .stat {{
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
        }}
        .stat-label {{ color: #6b7280; font-size: 14px; }}
        .stat-value {{ font-size: 28px; font-weight: bold; color: #111827; }}
        .badge {{
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }}
        .badge-success {{ background: #d1fae5; color: #065f46; }}
        .badge-warning {{ background: #fef3c7; color: #92400e; }}
        .badge-danger {{ background: #fee2e2; color: #991b1b; }}
        .badge-info {{ background: #dbeafe; color: #1e40af; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }}
        th {{ background: #f9fafb; font-weight: 600; }}
        tr:hover {{ background: #f9fafb; }}
        .issue {{ margin: 12px 0; padding: 12px; border-left: 4px solid; }}
        .issue-gap {{ border-color: #f59e0b; background: #fffbeb; }}
        .issue-dup {{ border-color: #ef4444; background: #fef2f2; }}
        .issue-reverse {{ border-color: #3b82f6; background: #eff6ff; }}
        .pair {{ margin: 12px 0; padding: 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; }}
        .unmatched {{ margin: 12px 0; padding: 16px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; }}
        .action {{
            margin: 12px 0;
            padding: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #fafafa;
        }}
        .action-risk-high {{ border-left: 4px solid #ef4444; }}
        .action-risk-medium {{ border-left: 4px solid #f59e0b; }}
        .action-risk-low {{ border-left: 4px solid #10b981; }}
        .code {{
            font-family: ui-monospace, monospace;
            background: #1f2937;
            color: #e5e7eb;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 13px;
        }}
        .muted {{ color: #6b7280; }}
        .generated {{ color: #9ca3af; font-size: 14px; }}
        .section {{ margin-bottom: 24px; }}
        details {{
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin: 8px 0;
        }}
        summary {{
            cursor: pointer;
            padding: 12px;
            font-weight: 500;
        }}
        details[open] summary {{ border-bottom: 1px solid #e5e7eb; }}
        .details-content {{ padding: 12px; }}
    </style>
</head>
<body>
<div class="container">
    <h1>📊 账套凭证断号修复报告</h1>
    <p class="generated">生成时间: {data['generated_at']}</p>

    <div class="card">
        <h2>📁 数据概览</h2>
        <div class="stat-grid">
            <div class="stat">
                <div class="stat-label">凭证总数</div>
                <div class="stat-value">{data['batch']['total_vouchers']}</div>
            </div>
            <div class="stat">
                <div class="stat-label">源文件数</div>
                <div class="stat-value">{len(data['batch']['source_files'])}</div>
            </div>
            <div class="stat">
                <div class="stat-label">断号问题</div>
                <div class="stat-value">{data['gap']['issue_count']}</div>
            </div>
            <div class="stat">
                <div class="stat-label">重复凭证</div>
                <div class="stat-value">{data['duplicate']['total_duplicates']}</div>
            </div>
        </div>
        <details>
            <summary>按凭证字统计</summary>
            <div class="details-content">
                {self._render_type_stats(data)}
            </div>
        </details>
        <details>
            <summary>源文件列表</summary>
            <div class="details-content">
                <ul>
                    {''.join(f'<li>{f}</li>' for f in data['batch']['source_files'])}
                </ul>
            </div>
        </details>
    </div>

    <div class="card">
        <h2>🔍 断号分析</h2>
        {'<span class="badge badge-success">✅ 无断号</span>' if not data['gap']['has_issues'] else ''}
        {self._render_gaps(data)}
    </div>

    <div class="card">
        <h2>🔄 重复凭证分析</h2>
        {'<span class="badge badge-success">✅ 无重复</span>' if not data['duplicate']['has_issues'] else ''}
        {self._render_duplicates(data)}
    </div>

    <div class="card">
        <h2>📋 冲销配对分析</h2>
        <div style="margin: 12px 0;">
            <span class="badge badge-info">配对: {data['reverse']['pair_count']}</span>
            <span class="badge badge-warning" style="margin-left: 8px;">未配对: {data['reverse']['unmatched_count']}</span>
        </div>
        {self._render_reverses(data)}
    </div>

    <div class="card">
        <h2>🛠️ 修复建议</h2>
        {self._render_plan(data)}
    </div>

    <div class="card">
        <h2>📝 审计日志</h2>
        {self._render_audit(data)}
    </div>
</div>
</body>
</html>
"""

    def _render_type_stats(self, data: Dict[str, Any]) -> str:
        rows = []
        for vtype, stats in data["gap"]["stats"].items():
            rows.append(
                f"<tr><td>{vtype}</td>"
                f"<td>{stats.get('count', 0)}</td>"
                f"<td>{stats.get('min', '-')}</td>"
                f"<td>{stats.get('max', '-')}</td></tr>"
            )
        return (
            "<table><tr><th>凭证字</th><th>数量</th><th>最小号</th><th>最大号</th></tr>"
            + "".join(rows)
            + "</table>"
        )

    def _render_gaps(self, data: Dict[str, Any]) -> str:
        if not data["gap"]["has_issues"]:
            return ""
        html = []
        by_type: Dict[str, List] = {}
        for issue in data["gap"]["issues"]:
            by_type.setdefault(issue["voucher_type"], []).append(issue)
        for vtype, issues in by_type.items():
            numbers = sorted({i["missing_number"] for i in issues})
            ranges = self._to_ranges(numbers)
            first = issues[0]
            html.append(f"""
            <div class="issue issue-gap">
                <strong>{vtype}字凭证</strong> — 缺失编号: {', '.join(ranges)} (共 {len(numbers)} 个)
                <div class="muted" style="margin-top: 6px;">{first['detail']}</div>
            </div>
            """)
        return "".join(html)

    def _render_duplicates(self, data: Dict[str, Any]) -> str:
        if not data["duplicate"]["has_issues"]:
            return ""
        html = []
        for issue in data["duplicate"]["issues"]:
            sources = " | ".join(issue["sources"])
            html.append(f"""
            <div class="issue issue-dup">
                <strong>{issue['voucher_type']}{issue['voucher_number']}</strong> — 出现 {issue['count']} 次
                <div class="muted" style="margin-top: 6px;">来源: {sources}</div>
            </div>
            """)
        return "".join(html)

    def _render_reverses(self, data: Dict[str, Any]) -> str:
        html = []
        if data["reverse"]["pairs"]:
            html.append("<h3>✅ 已配对</h3>")
            for p in data["reverse"]["pairs"]:
                conf = p["confidence"]
                conf_class = (
                    "badge-success" if conf >= 0.9
                    else "badge-info" if conf >= 0.7
                    else "badge-warning"
                )
                html.append(f"""
                <div class="pair">
                    <div style="font-weight: 600; margin-bottom: 8px;">
                        <span class="badge {conf_class}">{conf:.0%} 置信</span>
                        <span style="margin-left: 8px;">{p['matched_by']}</span>
                        <span style="margin-left: 8px;" class="muted">日期差: {p['date_diff_days']} 天</span>
                    </div>
                    <div>原凭证: <strong>{p['original']['voucher_type']}{p['original']['voucher_number']}</strong>
                        <span class="muted">({p['original']['source']})</span></div>
                    <div>冲销凭证: <strong>{p['reversal']['voucher_type']}{p['reversal']['voucher_number']}</strong>
                        <span class="muted">({p['reversal']['source']})</span></div>
                </div>
                """)
        if data["reverse"]["unmatched"]:
            html.append("<h3>⚠️ 未配对</h3>")
            for um in data["reverse"]["unmatched"]:
                possible = (
                    "<br>可能匹配: " + ", ".join(um["possible_matches"])
                    if um["possible_matches"] else ""
                )
                html.append(f"""
                <div class="unmatched">
                    <div><strong>{um['voucher']['voucher_type']}{um['voucher']['voucher_number']}</strong>
                        <span class="muted">({um['voucher']['source']})</span></div>
                    <div class="muted" style="margin-top: 4px;">摘要: {um['voucher']['description'] or '无'}</div>
                    <div style="margin-top: 8px; color: #92400e;">{um['reason']}{possible}</div>
                </div>
                """)
        return "".join(html)

    def _render_plan(self, data: Dict[str, Any]) -> str:
        plan = data["repair_plan"]
        if not plan["has_actions"]:
            return '<span class="badge badge-success">✅ 无需要修复的问题</span>'
        html = [
            f"<p><strong>总计: {plan['summary']['total_issues']} 个动作</strong> — "
            f"可自动应用: {plan['summary']['auto_applicable']} — "
            f"高风险: {plan['summary']['high_risk']}</p>"
        ]
        for a in plan["actions"]:
            risk_class = {
                "high": "action-risk-high",
                "medium": "action-risk-medium",
                "low": "action-risk-low",
            }.get(a["risk_level"], "action-risk-medium")
            auto_badge = (
                '<span class="badge badge-success">可自动</span>'
                if a["can_auto_apply"]
                else '<span class="badge badge-warning">需人工</span>'
            )
            risk_badge = {
                "high": '<span class="badge badge-danger">高风险</span>',
                "medium": '<span class="badge badge-warning">中风险</span>',
                "low": '<span class="badge badge-info">低风险</span>',
            }.get(a["risk_level"], "")
            html.append(f"""
            <div class="action {risk_class}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>{a['id']}: {a['title']}</strong>
                    <div>{auto_badge} {risk_badge}</div>
                </div>
                <div class="muted" style="margin-top: 6px;">{a['description']}</div>
                <div style="margin-top: 6px;">影响: {a['impact']}</div>
                <div class="muted" style="margin-top: 6px; font-size: 13px;">来源: {a['source_reference']}</div>
            </div>
            """)
        return "".join(html)

    def _render_audit(self, data: Dict[str, Any]) -> str:
        audit = data["audit"]
        html = [
            f"<p>总计: {audit['summary']['total']} 条 — "
            f"成功: {audit['summary']['success']} — "
            f"错误: {audit['summary']['error']}</p>"
        ]
        html.append("<table><tr><th>时间</th><th>操作</th><th>状态</th><th>消息</th><th>来源</th><th>文件哈希</th></tr>")
        for e in audit["entries"]:
            status_badge = (
                '<span class="badge badge-success">✓</span>'
                if e["success"]
                else '<span class="badge badge-danger">✗</span>'
            )
            html.append(
                f"<tr><td>{e['timestamp'][:19]}</td>"
                f"<td>{e['operation']}</td><td>{status_badge}</td>"
                f"<td>{e['message']}</td><td>{e['source_ref']}</td>"
                f"<td><code>{e['file_hash']}</code></td></tr>"
            )
        html.append("</table>")
        return "".join(html)

    def _to_ranges(self, numbers: List[int]) -> List[str]:
        if not numbers:
            return []
        ranges = []
        start = numbers[0]
        end = numbers[0]
        for n in numbers[1:]:
            if n == end + 1:
                end = n
            else:
                ranges.append(f"{start}-{end}" if start != end else str(start))
                start = n
                end = n
        ranges.append(f"{start}-{end}" if start != end else str(start))
        return ranges
