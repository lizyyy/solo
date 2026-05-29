import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import Commission
from .storage import StorageManager


class Exporter:
    def __init__(self, storage: StorageManager):
        self.storage = storage
    
    def _get_filename(self, commission_id: Optional[str], ext: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if commission_id:
            return f"report_{commission_id}_{timestamp}.{ext}"
        return f"report_all_{timestamp}.{ext}"
    
    def export_json(self, commissions: List[Commission], commission_id: Optional[str]) -> Path:
        data = [c.model_dump(mode="json") for c in commissions]
        if len(data) == 1:
            data = data[0]
        
        filename = self._get_filename(commission_id, "json")
        path = self.storage.get_export_path(filename)
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return path
    
    def export_markdown(self, commissions: List[Commission], commission_id: Optional[str]) -> Path:
        lines = []
        title = "委托进度报告" if not commission_id else f"委托详情 - {commissions[0].title}"
        lines.append(f"# {title}")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        for c in commissions:
            lines.append(f"## 📋 {c.title}")
            lines.append(f"- **ID**: `{c.id}`")
            lines.append(f"- **客户**: {c.client_name}")
            lines.append(f"- **状态**: {c.status.value}")
            lines.append(f"- **创建时间**: {c.created_at.strftime('%Y-%m-%d %H:%M')}")
            lines.append(f"- **最大修改轮次**: {c.max_revisions}")
            lines.append(f"- **累计修改**: {c.total_revisions}")
            
            warnings = []
            if c.is_over_revision_limit:
                warnings.append("🔴 修改轮次超限")
            if not c.has_final_paid and c.status.value == "completed":
                warnings.append("💰 尾款未付")
            if c.has_missing_screenshots:
                warnings.append(f"📷 缺少截图: {', '.join(c.has_missing_screenshots)}")
            
            if warnings:
                lines.append(f"- **⚠️ 告警**: {', '.join(warnings)}")
            lines.append("")
            
            if c.description:
                lines.append(f"> {c.description}")
                lines.append("")
            
            lines.append("### 🎨 草图版本")
            if c.sketches:
                for s in c.sketches:
                    desc = f" - {s.description}" if s.description else ""
                    lines.append(f"- **v{s.version}**{desc}")
                    lines.append(f"  - 文件: `{s.file_path}`")
                    lines.append(f"  - 创建: {s.created_at.strftime('%Y-%m-%d %H:%M')}")
                    
                    if s.revisions:
                        lines.append(f"  - 修改意见 ({len(s.revisions)}):")
                        for r in s.revisions:
                            status = "✅ 已解决" if r.is_resolved else "⏳ 待处理"
                            lines.append(f"    - [v{r.version}] {status} - {r.date.strftime('%Y-%m-%d')}")
                            lines.append(f"      > {r.feedback}")
            else:
                lines.append("- 暂无草图")
            lines.append("")
            
            lines.append("### 💳 付款节点")
            if c.payments:
                lines.append("| 节点 | 金额 | 状态 | 付款日期 |")
                lines.append("|------|------|------|----------|")
                for p in c.payments:
                    status = "✅ 已付" if p.paid else "⏳ 待付"
                    paid_date = p.paid_at.strftime("%Y-%m-%d") if p.paid_at else "-"
                    lines.append(f"| {p.node_type} | ¥{p.amount:.2f} | {status} | {paid_date} |")
                
                total_paid = sum(p.amount for p in c.payments if p.paid)
                total_amount = sum(p.amount for p in c.payments)
                lines.append(f"| **合计** | **¥{total_amount:.2f}** | 已付 ¥{total_paid:.2f} | |")
            else:
                lines.append("- 暂无付款节点")
            lines.append("")
            
            lines.append("### ✅ 客户确认")
            if c.confirmations:
                for conf in c.confirmations:
                    has_ss = "✅" if conf.screenshot_path else "❌ 缺少截图"
                    lines.append(f"- {has_ss} **{conf.stage}**")
                    lines.append(f"  - 确认时间: {conf.confirmed_at.strftime('%Y-%m-%d %H:%M')}")
                    if conf.screenshot_path:
                        lines.append(f"  - 截图: `{conf.screenshot_path}`")
                    if conf.notes:
                        lines.append(f"  - 备注: {conf.notes}")
            else:
                lines.append("- 暂无确认记录")
            lines.append("")
            
            lines.append("---")
            lines.append("")
        
        filename = self._get_filename(commission_id, "md")
        path = self.storage.get_export_path(filename)
        
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        return path
    
    def export_html(self, commissions: List[Commission], commission_id: Optional[str]) -> Path:
        status_colors = {
            "draft": "#6b7280",
            "sketch": "#3b82f6",
            "in_progress": "#06b6d4",
            "waiting_confirm": "#f59e0b",
            "revising": "#8b5cf6",
            "completed": "#10b981",
            "cancelled": "#ef4444",
        }
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>委托进度报告</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background: #f8fafc;
            color: #1e293b;
        }}
        h1 {{ color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }}
        h2 {{ color: #334155; margin-top: 30px; }}
        h3 {{ color: #475569; }}
        .commission-card {{
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            color: white;
        }}
        .alert {{
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 12px 16px;
            margin: 12px 0;
            border-radius: 4px;
        }}
        .alert-warning {{
            background: #fffbeb;
            border-left-color: #f59e0b;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }}
        th {{ background: #f1f5f9; font-weight: 600; }}
        .sketch-item {{
            background: #f8fafc;
            border-radius: 8px;
            padding: 16px;
            margin: 12px 0;
        }}
        .revision {{
            background: white;
            border-left: 3px solid #8b5cf6;
            padding: 8px 12px;
            margin: 8px 0;
            border-radius: 4px;
        }}
        .meta {{ color: #64748b; font-size: 14px; }}
        .footer {{ text-align: center; color: #94a3b8; margin-top: 40px; font-size: 14px; }}
    </style>
</head>
<body>
    <h1>🎨 插画委托进度看板</h1>
    <p class="meta">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
"""
        
        for c in commissions:
            color = status_colors.get(c.status.value, "#6b7280")
            warnings = []
            if c.is_over_revision_limit:
                warnings.append("🔴 修改轮次超限")
            if not c.has_final_paid and c.status.value == "completed":
                warnings.append("💰 尾款未付")
            if c.has_missing_screenshots:
                warnings.append(f"📷 缺少截图: {', '.join(c.has_missing_screenshots)}")
            
            html += f"""
    <div class="commission-card">
        <h2>{c.title}</h2>
        <p>
            <code>{c.id}</code> | 
            <strong>客户:</strong> {c.client_name} | 
            <span class="badge" style="background: {color}">{c.status.value}</span>
        </p>
"""
            
            if warnings:
                alert_class = "alert" if "超限" in str(warnings) else "alert alert-warning"
                html += f'<div class="{alert_class}"><strong>⚠️ 告警:</strong> {" | ".join(warnings)}</div>'
            
            if c.description:
                html += f"<p><em>{c.description}</em></p>"
            
            html += """
        <h3>🎨 草图版本</h3>
"""
            if c.sketches:
                for s in c.sketches:
                    desc = f" - {s.description}" if s.description else ""
                    html += f"""
        <div class="sketch-item">
            <strong>v{s.version}</strong>{desc}
            <div class="meta">
                文件: {s.file_path} | 创建: {s.created_at.strftime('%Y-%m-%d %H:%M')}
            </div>
"""
                    if s.revisions:
                        html += f"<p><strong>修改意见 ({len(s.revisions)})</strong></p>"
                        for r in s.revisions:
                            status = "✅ 已解决" if r.is_resolved else "⏳ 待处理"
                            html += f"""
            <div class="revision">
                <strong>v{r.version}</strong> {status} - {r.date.strftime('%Y-%m-%d')}<br>
                {r.feedback}
            </div>"""
                    html += "</div>"
            else:
                html += "<p class='meta'>暂无草图</p>"
            
            html += """
        <h3>💳 付款节点</h3>
"""
            if c.payments:
                html += """
        <table>
            <tr><th>节点</th><th>金额</th><th>状态</th><th>付款日期</th></tr>
"""
                for p in c.payments:
                    status = "✅ 已付" if p.paid else "⏳ 待付"
                    paid_date = p.paid_at.strftime("%Y-%m-%d") if p.paid_at else "-"
                    html += f"<tr><td>{p.node_type}</td><td>¥{p.amount:.2f}</td><td>{status}</td><td>{paid_date}</td>"
                
                total_paid = sum(p.amount for p in c.payments if p.paid)
                total_amount = sum(p.amount for p in c.payments)
                html += f"<tr><td><strong>合计</strong></td><td><strong>¥{total_amount:.2f}</strong></td><td>已付 ¥{total_paid:.2f}</td><td></td></tr>"
                html += "</table>"
            else:
                html += "<p class='meta'>暂无付款节点</p>"
            
            html += """
        <h3>✅ 客户确认</h3>
"""
            if c.confirmations:
                for conf in c.confirmations:
                    has_ss = "✅" if conf.screenshot_path else "❌ 缺少截图"
                    ss_note = f"<br>截图: {conf.screenshot_path}" if conf.screenshot_path else ""
                    html += f"""
        <div class="sketch-item">
            {has_ss} <strong>{conf.stage}</strong>
            <div class="meta">确认时间: {conf.confirmed_at.strftime('%Y-%m-%d %H:%M')}{ss_note}</div>
        </div>"""
            else:
                html += "<p class='meta'>暂无确认记录</p>"
            
            html += "</div>"
        
        html += f"""
    <div class="footer">
        插画委托进度看板 | 共 {len(commissions)} 个委托
    </div>
</body>
</html>
"""
        
        filename = self._get_filename(commission_id, "html")
        path = self.storage.get_export_path(filename)
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        
        return path
