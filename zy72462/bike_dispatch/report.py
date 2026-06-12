from datetime import datetime
from typing import Optional
from .models import DispatchCase, ReviewStatus, ResponsibleRole


def generate_report(case: DispatchCase, output_format: str = "text") -> str:
    if output_format == "html":
        return _generate_html_report(case)
    return _generate_text_report(case)


def _generate_text_report(case: DispatchCase) -> str:
    lines = []
    
    lines.append("=" * 60)
    lines.append(f"共享单车潮汐调度报告")
    lines.append(f"案件编号：{case.id}")
    lines.append(f"案件标题：{case.title}")
    lines.append(f"生成时间：{case.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("=" * 60)
    lines.append("")
    
    lines.append("一、证据汇总（网格员巡查 + 施工告示 + 坡道补录）")
    lines.append("-" * 40)
    lines.append("【追溯说明】以下每条证据均可在整改建议中通过「证据#N」编号追回原始来源")
    lines.append("")
    for i, evidence in enumerate(case.evidences, 1):
        lines.append(f"  证据#{i}. [{evidence.source.value}]")
        lines.append(f"     记录人：{evidence.recorded_by}")
        lines.append(f"     时间：{evidence.recorded_at.strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"     内容：{evidence.description}")
        lines.append("")
    
    lines.append("二、坡道情况一览（先服务复核优先展示）")
    lines.append("-" * 40)
    escalated_ramps = [r for r in case.ramps if r.review_status == ReviewStatus.ESCALATED]
    other_ramps = [r for r in case.ramps if r.review_status != ReviewStatus.ESCALATED]
    ordered_ramps = escalated_ramps + other_ramps
    
    for ramp in ordered_ramps:
        status_icon = "⚠️" if ramp.review_status == ReviewStatus.ESCALATED else "✓" if ramp.review_status == ReviewStatus.CONFIRMED else "🔍"
        esc_tag = "【先服务复核→交通协管优先】" if ramp.review_status == ReviewStatus.ESCALATED else "【先服务复核→网格员/书记跟进】" if ramp.review_status == ReviewStatus.PENDING else "【已确认】"
        lines.append(f"  {status_icon} 坡道：{ramp.location} {esc_tag}")
        lines.append(f"     评分变化：{ramp.score_before:.1f} → {ramp.score_after:.1f} {'✅' if ramp.score_changed else '❌ 无变化（触发优先复核）'}")
        lines.append(f"     复核状态：{ramp.review_status.value}")
        if ramp.issues:
            lines.append(f"     存在问题：{', '.join(ramp.issues)}")
        if ramp.supplementary_note:
            lines.append(f"     补录备注：{ramp.supplementary_note}")
        if ramp.provided_materials:
            lines.append(f"     ✅ 已提供材料：{', '.join(ramp.provided_materials)}")
        
        suggestion = next((s for s in case.suggestions if s.ramp_id == ramp.id), None)
        if suggestion:
            if suggestion.missing_materials:
                lines.append(f"     ❌ 还缺材料：{', '.join(suggestion.missing_materials)}")
            if hasattr(suggestion, "provided_materials") and suggestion.provided_materials and not ramp.provided_materials:
                lines.append(f"     ✅ 已提供材料（对账）：{', '.join(suggestion.provided_materials)}")
        lines.append("")
    
    lines.append("三、整改建议（含材料对账 + 原始证据追溯）")
    lines.append("-" * 40)
    for i, suggestion in enumerate(case.suggestions, 1):
        role_color = {
            ResponsibleRole.TRAFFIC_ASSISTANT: "👮",
            ResponsibleRole.COMMUNITY_SECRETARY: "👩‍💼",
            ResponsibleRole.GRID_INSPECTOR: "🧑‍🔧"
        }.get(suggestion.responsible_role, "📋")
        
        esc_header = ""
        if "先服务复核" in suggestion.why_kept:
            esc_header = "【先服务复核 · 高优先级】"
        elif suggestion.priority == 1:
            esc_header = "【高优先级】"
        else:
            esc_header = "【常规跟进】"
        
        lines.append(f"  ╔═══════════════════════════════════════╗")
        lines.append(f"  ║ 建议 #{i} {esc_header}")
        lines.append(f"  ╚═══════════════════════════════════════╝")
        lines.append(f"  问题：{suggestion.issue_description}")
        lines.append("")
        lines.append(f"  💡 为什么这条被留下：")
        lines.append(f"     {suggestion.why_kept}")
        lines.append("")
        
        lines.append(f"  📦 材料对账：")
        provided = getattr(suggestion, "provided_materials", [])
        missing = suggestion.missing_materials
        if provided:
            lines.append(f"     ✅ 已提供（{len(provided)}项）：")
            for p in provided:
                lines.append(f"       · {p}")
        else:
            lines.append(f"     ⚪ 尚未提供任何材料")
        if missing:
            lines.append(f"     ❌ 还缺什么（{len(missing)}项）：")
            for m in missing:
                lines.append(f"       · {m}")
        else:
            lines.append(f"     ✅ 材料已齐全，等待下一步操作")
        lines.append("")
        
        evidence_trace = getattr(suggestion, "evidence_trace", [])
        if evidence_trace:
            lines.append(f"  🔗 原始证据追溯（触发本建议的依据，点击对应证据编号可追回）：")
            for t in evidence_trace:
                lines.append(f"     {t}")
            lines.append("")
        
        lines.append(f"  {role_color} 下一步该找谁：{suggestion.responsible_role.value}")
        lines.append(f"     具体行动：{suggestion.next_step}")
        lines.append(f"     更新时间：{suggestion.updated_at.strftime('%Y-%m-%d %H:%M')}")
        lines.append("")
        lines.append("  · · · · · · · · · · · · · · · · · · · ·")
        lines.append("")
    
    lines.append("四、统计与对账小结（不只报总数）")
    lines.append("-" * 40)
    lines.append("  这份报告不是冷冰冰的系统日志。")
    lines.append("  每一条记录背后都是街坊邻居的日常出行，")
    lines.append("  每一次整改都是为了更安全、更便利的社区环境。")
    lines.append("")
    lines.append(f"  本报告共涉及 {len(case.ramps)} 处坡道：")
    lines.append(f"    · ⚠️  需交通协管紧急复核（先服务）：{len(escalated_ramps)} 处")
    lines.append(f"    · 🔍 待网格员/社区书记跟进：{len([r for r in case.ramps if r.review_status == ReviewStatus.PENDING])} 处")
    lines.append(f"    · ✓ 已确认正常：{len([r for r in case.ramps if r.review_status == ReviewStatus.CONFIRMED])} 处")
    lines.append("")
    lines.append(f"  共 {len(case.suggestions)} 条整改建议：")
    total_provided = sum(len(getattr(s, "provided_materials", [])) for s in case.suggestions)
    total_missing = sum(len(s.missing_materials) for s in case.suggestions)
    lines.append(f"    · ✅ 累计已提供材料项数：{total_provided}")
    lines.append(f"    · ❌ 累计还缺材料项数：{total_missing}")
    
    traffic_count = len([s for s in case.suggestions if s.responsible_role == ResponsibleRole.TRAFFIC_ASSISTANT])
    sec_count = len([s for s in case.suggestions if s.responsible_role == ResponsibleRole.COMMUNITY_SECRETARY])
    grid_count = len([s for s in case.suggestions if s.responsible_role == ResponsibleRole.GRID_INSPECTOR])
    lines.append(f"    · 👮 交通协管负责：{traffic_count} 条")
    lines.append(f"    · 👩‍💼 社区书记周姐负责：{sec_count} 条")
    lines.append(f"    · 🧑‍🔧 网格员负责：{grid_count} 条")
    lines.append("")
    lines.append("  辛苦了，我们一起把社区变得更好！💪")
    lines.append("")
    lines.append("=" * 60)
    
    return "\n".join(lines)


def _generate_html_report(case: DispatchCase) -> str:
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>共享单车潮汐调度报告 - {case.title}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; background: #f5f7fa; color: #333; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }}
        .header h1 {{ margin: 0 0 10px 0; font-size: 24px; }}
        .header .meta {{ opacity: 0.9; font-size: 14px; }}
        .section {{ background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }}
        .section h2 {{ margin: 0 0 16px 0; font-size: 18px; color: #2c3e50; border-bottom: 2px solid #667eea; padding-bottom: 8px; display: inline-block; }}
        .evidence-card {{ background: #f8f9fa; border-left: 4px solid #667eea; padding: 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0; }}
        .evidence-source {{ font-weight: 600; color: #667eea; margin-bottom: 4px; }}
        .evidence-meta {{ font-size: 12px; color: #888; margin-bottom: 8px; }}
        .ramp-card {{ background: #f8f9fa; padding: 16px; margin-bottom: 12px; border-radius: 8px; }}
        .ramp-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }}
        .ramp-location {{ font-weight: 600; font-size: 16px; }}
        .status-badge {{ padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }}
        .status-escalated {{ background: #ffe0e0; color: #c0392b; }}
        .status-confirmed {{ background: #e0f5e0; color: #27ae60; }}
        .status-pending {{ background: #fff3cd; color: #856404; }}
        .score-change {{ font-size: 14px; color: #555; margin-bottom: 8px; }}
        .score-no-change {{ color: #e74c3c; font-weight: 600; }}
        .issues {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }}
        .issue-tag {{ background: #ffeaa7; color: #856404; padding: 4px 10px; border-radius: 12px; font-size: 12px; }}
        .suggestion-card {{ background: #f0f4ff; border-radius: 8px; padding: 20px; margin-bottom: 16px; }}
        .suggestion-title {{ font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #2c3e50; }}
        .suggestion-section {{ margin-bottom: 12px; }}
        .suggestion-label {{ font-weight: 600; color: #667eea; margin-bottom: 4px; font-size: 14px; }}
        .suggestion-content {{ color: #555; line-height: 1.6; }}
        .missing-list {{ margin: 0; padding-left: 20px; }}
        .missing-list li {{ margin-bottom: 4px; }}
        .role-tag {{ display: inline-block; background: #667eea; color: white; padding: 4px 12px; border-radius: 12px; font-size: 13px; margin-top: 8px; }}
        .footer {{ text-align: center; padding: 20px; color: #888; font-size: 14px; line-height: 1.8; }}
        .footer .emoji {{ font-size: 20px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🚲 共享单车潮汐调度报告</h1>
        <div class="meta">
            案件编号：{case.id} | 案件标题：{case.title}<br>
            生成时间：{case.created_at.strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>

    <div class="section">
        <h2>📋 证据汇总</h2>
        <p style="color: #666; margin-top: 0;">整合网格员巡查表与施工告示的现场说法，让每一条证据都有迹可循</p>
"""
    
    for evidence in case.evidences:
        html += f"""
        <div class="evidence-card">
            <div class="evidence-source">{evidence.source.value}</div>
            <div class="evidence-meta">记录人：{evidence.recorded_by} | 时间：{evidence.recorded_at.strftime('%Y-%m-%d %H:%M')}</div>
            <div>{evidence.description}</div>
        </div>
"""
    
    html += """
    </div>

    <div class="section">
        <h2>🛤️ 坡道情况一览</h2>
        <p style="color: #666; margin-top: 0;">点击坡道可返回巡查表或施工告示查看原始证据，不只是漂亮画面</p>
"""
    
    for ramp in case.ramps:
        status_class = {
            ReviewStatus.ESCALATED: "status-escalated",
            ReviewStatus.CONFIRMED: "status-confirmed",
            ReviewStatus.PENDING: "status-pending",
            ReviewStatus.NEEDS_SUPPLEMENT: "status-pending"
        }.get(ramp.review_status, "status-pending")
        
        score_html = f"<span class='score-no-change'>{ramp.score_before:.1f} → {ramp.score_after:.1f} 无变化 ⚠️</span>" if not ramp.score_changed else f"{ramp.score_before:.1f} → {ramp.score_after:.1f} ✓"
        
        issues_html = ""
        if ramp.issues:
            issues_html = '<div class="issues">'
            for issue in ramp.issues:
                issues_html += f'<span class="issue-tag">{issue}</span>'
            issues_html += '</div>'
        
        supplement_html = f'<div style="margin-top: 8px; color: #666; font-style: italic;">补录备注：{ramp.supplementary_note}</div>' if ramp.supplementary_note else ""
        
        html += f"""
        <div class="ramp-card">
            <div class="ramp-header">
                <span class="ramp-location">📍 {ramp.location}</span>
                <span class="status-badge {status_class}">{ramp.review_status.value}</span>
            </div>
            <div class="score-change">评分变化：{score_html}</div>
            {issues_html}
            {supplement_html}
        </div>
"""
    
    html += """
    </div>

    <div class="section">
        <h2>💡 整改建议</h2>
        <p style="color: #666; margin-top: 0;">不是冷冰冰的系统日志，告诉你为什么、缺什么、该找谁</p>
"""
    
    for i, suggestion in enumerate(case.suggestions, 1):
        role_emoji = {
            ResponsibleRole.TRAFFIC_ASSISTANT: "👮",
            ResponsibleRole.COMMUNITY_SECRETARY: "👩‍💼",
            ResponsibleRole.GRID_INSPECTOR: "🧑‍🔧"
        }.get(suggestion.responsible_role, "📋")
        
        missing_items = "".join([f"<li>{mat}</li>" for mat in suggestion.missing_materials])
        
        html += f"""
        <div class="suggestion-card">
            <div class="suggestion-title">建议 #{i}：{suggestion.issue_description}</div>
            
            <div class="suggestion-section">
                <div class="suggestion-label">💭 这条为什么被留下</div>
                <div class="suggestion-content">{suggestion.why_kept}</div>
            </div>
            
            <div class="suggestion-section">
                <div class="suggestion-label">📦 还缺什么材料</div>
                <ul class="missing-list">{missing_items}</ul>
            </div>
            
            <div class="suggestion-section">
                <div class="suggestion-label">{role_emoji} 下一步该找谁</div>
                <div class="suggestion-content">{suggestion.next_step}</div>
                <span class="role-tag">责任人：{suggestion.responsible_role.value}</span>
                <div style="font-size: 12px; color: #999; margin-top: 4px;">更新于 {suggestion.updated_at.strftime('%Y-%m-%d %H:%M')}</div>
            </div>
        </div>
"""
    
    escalated_count = len([r for r in case.ramps if r.review_status == ReviewStatus.ESCALATED])
    
    html += f"""
    </div>

    <div class="footer">
        <p class="emoji">💪</p>
        <p>这份报告不是冷冰冰的系统日志</p>
        <p>每一条记录背后都是街坊邻居的日常出行</p>
        <p>每一次整改都是为了更安全、更便利的社区环境</p>
        <p style="margin-top: 16px;">
            本报告共涉及 <strong>{len(case.ramps)}</strong> 处坡道，
            其中 <strong style="color: #e74c3c;">{escalated_count}</strong> 处需交通协管紧急复核，
            <strong>{len(case.suggestions)}</strong> 条整改建议等待落实
        </p>
        <p>辛苦了，我们一起把社区变得更好！</p>
    </div>
</body>
</html>
"""
    
    return html
