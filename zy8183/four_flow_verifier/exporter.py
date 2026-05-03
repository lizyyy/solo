import csv
import json
from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from .models import (
    Invoice, PurchaseOrderLine, Receipt, Payment,
    MatchResult, Issue, IssueSeverity, IssueType, DocumentType
)


class ReportExporter:
    def __init__(self,
                 invoices: List[Invoice],
                 po_lines: List[PurchaseOrderLine],
                 receipts: List[Receipt],
                 payments: List[Payment],
                 match_results: List[MatchResult],
                 issues: List[Issue]):
        self.invoices = invoices
        self.po_lines = po_lines
        self.receipts = receipts
        self.payments = payments
        self.match_results = match_results
        self.issues = issues
        
        self.invoice_map = {inv.doc_id: inv for inv in invoices}
        self.po_map = {po.doc_id: po for po in po_lines}
        self.receipt_map = {rec.doc_id: rec for rec in receipts}
        self.payment_map = {pay.doc_id: pay for pay in payments}

    def export_issues_csv(self, output_path: str):
        fieldnames = [
            "issue_id", "issue_type", "severity", "description",
            "primary_doc_id", "primary_doc_type",
            "related_doc_ids", "related_doc_types",
            "expected_value", "actual_value", "difference"
        ]
        
        rows = [issue.to_dict() for issue in self.issues]
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    def export_mismatch_report(self, output_path: str):
        report_lines = []
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        report_lines.append("# 四流一致性复核报告")
        report_lines.append(f"\n生成时间: {now}")
        report_lines.append("\n---")
        
        report_lines.append("\n## 一、概览")
        
        total_docs = (len(self.invoices) + len(self.po_lines) + 
                      len(self.receipts) + len(self.payments))
        matched_groups = sum(1 for mr in self.match_results if mr.is_matched)
        total_groups = len(self.match_results)
        
        critical_issues = sum(1 for i in self.issues if i.severity == IssueSeverity.CRITICAL)
        warning_issues = sum(1 for i in self.issues if i.severity == IssueSeverity.WARNING)
        info_issues = sum(1 for i in self.issues if i.severity == IssueSeverity.INFO)
        
        report_lines.append(f"\n- 总单据数: {total_docs}")
        report_lines.append(f"  - 发票: {len(self.invoices)}")
        report_lines.append(f"  - 采购订单行: {len(self.po_lines)}")
        report_lines.append(f"  - 收货单: {len(self.receipts)}")
        report_lines.append(f"  - 付款单: {len(self.payments)}")
        report_lines.append(f"\n- 匹配组统计:")
        report_lines.append(f"  - 完全匹配组: {matched_groups}/{total_groups}")
        report_lines.append(f"  - 部分匹配组: {total_groups - matched_groups}/{total_groups}")
        report_lines.append(f"\n- 问题统计:")
        report_lines.append(f"  - 严重问题 (CRITICAL): {critical_issues}")
        report_lines.append(f"  - 警告问题 (WARNING): {warning_issues}")
        report_lines.append(f"  - 提示信息 (INFO): {info_issues}")
        
        report_lines.append("\n---")
        
        report_lines.append("\n## 二、详细问题列表")
        
        if critical_issues > 0:
            report_lines.append("\n### 2.1 严重问题 (CRITICAL)")
            critical_list = [i for i in self.issues if i.severity == IssueSeverity.CRITICAL]
            for idx, issue in enumerate(critical_list, 1):
                report_lines.append(f"\n**问题 {idx}: {issue.issue_type.value}**")
                report_lines.append(f"- 描述: {issue.description}")
                report_lines.append(f"- 主要单据: {issue.primary_doc_id} ({issue.primary_doc_type.value})")
                if issue.related_doc_ids:
                    report_lines.append(f"- 相关单据: {', '.join(issue.related_doc_ids)}")
                if issue.expected_value is not None:
                    report_lines.append(f"- 期望值: {issue.expected_value}")
                if issue.actual_value is not None:
                    report_lines.append(f"- 实际值: {issue.actual_value}")
                if issue.difference is not None:
                    report_lines.append(f"- 差异: {issue.difference}")
        
        if warning_issues > 0:
            report_lines.append("\n### 2.2 警告问题 (WARNING)")
            warning_list = [i for i in self.issues if i.severity == IssueSeverity.WARNING]
            for idx, issue in enumerate(warning_list, 1):
                report_lines.append(f"\n**问题 {idx}: {issue.issue_type.value}**")
                report_lines.append(f"- 描述: {issue.description}")
                report_lines.append(f"- 主要单据: {issue.primary_doc_id} ({issue.primary_doc_type.value})")
                if issue.related_doc_ids:
                    report_lines.append(f"- 相关单据: {', '.join(issue.related_doc_ids)}")
        
        if info_issues > 0:
            report_lines.append("\n### 2.3 提示信息 (INFO)")
            info_list = [i for i in self.issues if i.severity == IssueSeverity.INFO]
            for idx, issue in enumerate(info_list, 1):
                report_lines.append(f"\n**问题 {idx}: {issue.issue_type.value}**")
                report_lines.append(f"- 描述: {issue.description}")
                report_lines.append(f"- 主要单据: {issue.primary_doc_id} ({issue.primary_doc_type.value})")
        
        report_lines.append("\n---")
        
        report_lines.append("\n## 三、匹配组详情")
        
        for mr in self.match_results:
            status = "✅ 完全匹配" if mr.is_matched else "⚠️ 部分匹配"
            report_lines.append(f"\n### 匹配组: {mr.group_id}")
            report_lines.append(f"- 状态: {status}")
            report_lines.append(f"- 匹配分数: {mr.match_score}%")
            
            if mr.invoice_ids:
                inv_list = [self.invoice_map.get(iid) for iid in mr.invoice_ids if self.invoice_map.get(iid)]
                report_lines.append(f"- 发票 ({len(mr.invoice_ids)}): {', '.join(mr.invoice_ids)}")
                for inv in inv_list:
                    report_lines.append(f"  - {inv.doc_id}: {inv.vendor_name}, 金额: {inv.total_amount}, 日期: {inv.date}")
            
            if mr.po_line_ids:
                po_list = [self.po_map.get(pid) for pid in mr.po_line_ids if self.po_map.get(pid)]
                report_lines.append(f"- 采购订单 ({len(mr.po_line_ids)}): {', '.join(mr.po_line_ids)}")
                for po in po_list:
                    report_lines.append(f"  - {po.doc_id}: {po.item_description}, 数量: {po.quantity}, 单价: {po.unit_price}")
            
            if mr.receipt_ids:
                rec_list = [self.receipt_map.get(rid) for rid in mr.receipt_ids if self.receipt_map.get(rid)]
                report_lines.append(f"- 收货单 ({len(mr.receipt_ids)}): {', '.join(mr.receipt_ids)}")
                for rec in rec_list:
                    report_lines.append(f"  - {rec.doc_id}: 收货数量: {rec.received_quantity}, 日期: {rec.date}")
            
            if mr.payment_ids:
                pay_list = [self.payment_map.get(pid) for pid in mr.payment_ids if self.payment_map.get(pid)]
                report_lines.append(f"- 付款单 ({len(mr.payment_ids)}): {', '.join(mr.payment_ids)}")
                for pay in pay_list:
                    report_lines.append(f"  - {pay.doc_id}: 金额: {pay.total_amount}, 日期: {pay.date}, 方式: {pay.payment_method}")
            
            if mr.issues:
                report_lines.append(f"- 关联问题数: {len(mr.issues)}")
                for issue in mr.issues[:5]:
                    severity_icon = "🔴" if issue.severity == IssueSeverity.CRITICAL else "🟡" if issue.severity == IssueSeverity.WARNING else "ℹ️"
                    report_lines.append(f"  {severity_icon} {issue.description}")
                if len(mr.issues) > 5:
                    report_lines.append(f"  ... 还有 {len(mr.issues) - 5} 个问题")
        
        report_lines.append("\n---")
        report_lines.append("\n## 四、建议行动")
        
        if critical_issues > 0:
            report_lines.append(f"\n1. **立即处理**: 有 {critical_issues} 个严重问题需要优先处理，涉及金额或供应商不一致")
        if warning_issues > 0:
            report_lines.append(f"2. **尽快核查**: 有 {warning_issues} 个警告问题需要核实，可能涉及数据录入错误")
        if info_issues > 0:
            report_lines.append(f"3. **知晓即可**: 有 {info_issues} 个提示信息，包括发票拆分/合并、跨月付款等特殊业务场景")
        
        if matched_groups < total_groups:
            report_lines.append(f"4. **补全单据**: 有 {total_groups - matched_groups} 个匹配组缺少部分单据，请确认是否遗漏或滞后")
        
        report_lines.append("\n---")
        report_lines.append("\n*报告由 Four Flow Verifier 自动生成*")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_lines))

    def export_timeline_html(self, output_path: str):
        events = self._build_timeline_events()
        nodes, edges = self._build_graph_data()
        
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>四流一致性复核 - 时间线与关系图</title>
    <script src="https://cdn.jsdelivr.net/npm/vis-network@9.1.6/standalone/umd/vis-network.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vis-timeline@7.7.2/standalone/umd/vis-timeline-graph2d.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/vis-timeline@7.7.2/styles/vis-timeline-graph2d.min.css" rel="stylesheet" type="text/css" />
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        .container {{
            max-width: 1600px;
            margin: 0 auto;
        }}
        .header {{
            background: rgba(255,255,255,0.95);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }}
        .header h1 {{
            color: #1a1a2e;
            font-size: 28px;
            margin-bottom: 8px;
        }}
        .header p {{ color: #666; font-size: 14px; }}
        .stats {{
            display: flex;
            gap: 16px;
            margin-top: 16px;
            flex-wrap: wrap;
        }}
        .stat-card {{
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
            padding: 16px 24px;
            border-radius: 12px;
            min-width: 140px;
        }}
        .stat-card .number {{
            font-size: 28px;
            font-weight: bold;
            color: #1a1a2e;
        }}
        .stat-card .label {{
            font-size: 12px;
            color: #666;
            margin-top: 4px;
        }}
        .tabs {{
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
        }}
        .tab {{
            background: rgba(255,255,255,0.8);
            border: none;
            padding: 12px 24px;
            border-radius: 8px 8px 0 0;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
        }}
        .tab.active {{
            background: rgba(255,255,255,0.95);
            color: #667eea;
        }}
        .tab:hover {{ background: rgba(255,255,255,0.9); }}
        .panel {{
            background: rgba(255,255,255,0.95);
            border-radius: 0 16px 16px 16px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            display: none;
        }}
        .panel.active {{ display: block; }}
        #timeline {{
            height: 400px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
        }}
        #network {{
            height: 500px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
        }}
        .legend {{
            margin-top: 16px;
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #666;
        }}
        .legend-color {{
            width: 16px;
            height: 16px;
            border-radius: 50%;
        }}
        .filters {{
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }}
        .filter-btn {{
            padding: 8px 16px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fff;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }}
        .filter-btn:hover {{ background: #f5f5f5; }}
        .filter-btn.active {{
            background: #667eea;
            color: #fff;
            border-color: #667eea;
        }}
        .issue-badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            margin-left: 8px;
        }}
        .critical {{ background: #ff4444; color: #fff; }}
        .warning {{ background: #ffbb33; color: #333; }}
        .info {{ background: #33b5e5; color: #fff; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>四流一致性复核可视化</h1>
            <p>增值税电子发票、采购订单、收货单、付款流水 关系分析</p>
            <div class="stats">
                <div class="stat-card">
                    <div class="number">{len(self.invoices)}</div>
                    <div class="label">发票</div>
                </div>
                <div class="stat-card">
                    <div class="number">{len(self.po_lines)}</div>
                    <div class="label">采购订单行</div>
                </div>
                <div class="stat-card">
                    <div class="number">{len(self.receipts)}</div>
                    <div class="label">收货单</div>
                </div>
                <div class="stat-card">
                    <div class="number">{len(self.payments)}</div>
                    <div class="label">付款单</div>
                </div>
                <div class="stat-card">
                    <div class="number">{len(self.match_results)}</div>
                    <div class="label">匹配组</div>
                </div>
                <div class="stat-card">
                    <div class="number">{len(self.issues)}</div>
                    <div class="label">问题</div>
                </div>
            </div>
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="switchTab('timeline')">时间线视图</button>
            <button class="tab" onclick="switchTab('network')">关系图视图</button>
        </div>
        
        <div id="timeline-panel" class="panel active">
            <div class="filters">
                <button class="filter-btn active" data-filter="all">全部</button>
                <button class="filter-btn" data-filter="invoice">发票</button>
                <button class="filter-btn" data-filter="po">采购订单</button>
                <button class="filter-btn" data-filter="receipt">收货单</button>
                <button class="filter-btn" data-filter="payment">付款单</button>
            </div>
            <div id="timeline"></div>
            <div class="legend">
                <div class="legend-item"><div class="legend-color" style="background: #4CAF50;"></div>采购订单</div>
                <div class="legend-item"><div class="legend-color" style="background: #2196F3;"></div>收货单</div>
                <div class="legend-item"><div class="legend-color" style="background: #FF9800;"></div>发票</div>
                <div class="legend-item"><div class="legend-color" style="background: #9C27B0;"></div>付款单</div>
            </div>
        </div>
        
        <div id="network-panel" class="panel">
            <div id="network"></div>
            <div class="legend">
                <div class="legend-item"><div class="legend-color" style="background: #4CAF50;"></div>采购订单</div>
                <div class="legend-item"><div class="legend-color" style="background: #2196F3;"></div>收货单</div>
                <div class="legend-item"><div class="legend-color" style="background: #FF9800;"></div>发票</div>
                <div class="legend-item"><div class="legend-color" style="background: #9C27B0;"></div>付款单</div>
                <div class="legend-item"><div class="legend-color" style="background: #ff4444;"></div>有严重问题</div>
                <div class="legend-item"><div class="legend-color" style="background: #ffbb33;"></div>有警告问题</div>
            </div>
        </div>
    </div>

    <script>
        const events = {json.dumps(events, default=str)};
        const nodes = {json.dumps(nodes, default=str)};
        const edges = {json.dumps(edges, default=str)};

        function switchTab(tabName) {{
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.querySelector(`[onclick="switchTab('${{tabName}}')"]`).classList.add('active');
            document.getElementById(tabName + '-panel').classList.add('active');
        }}

        let timeline;
        let currentFilter = 'all';

        function initTimeline() {{
            const container = document.getElementById('timeline');
            const items = new vis.DataSet(events);
            
            const options = {{
                orientation: 'top',
                height: '400px',
                groupOrder: 'content',
                editable: false,
                margin: {{
                    item: 10,
                    axis: 5
                }}
            }};
            
            timeline = new vis.Timeline(container, items, options);
        }}

        function filterTimeline(type) {{
            currentFilter = type;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            document.querySelector(`[data-filter="${{type}}"]`).classList.add('active');
            
            const filteredEvents = type === 'all' 
                ? events 
                : events.filter(e => e.group === getGroupLabel(type));
            
            timeline.setItems(new vis.DataSet(filteredEvents));
        }}

        function getGroupLabel(type) {{
            const labels = {{
                'po': '采购订单',
                'receipt': '收货单',
                'invoice': '发票',
                'payment': '付款单'
            }};
            return labels[type] || type;
        }}

        function initNetwork() {{
            const container = document.getElementById('network');
            const data = {{
                nodes: new vis.DataSet(nodes),
                edges: new vis.DataSet(edges)
            }};
            
            const options = {{
                nodes: {{
                    shape: 'dot',
                    size: 25,
                    font: {{
                        size: 14,
                        color: '#333'
                    }},
                    borderWidth: 2,
                    borderWidthSelected: 4
                }},
                edges: {{
                    width: 2,
                    color: {{
                        color: '#848484',
                        highlight: '#84B6F4'
                    }},
                    smooth: {{
                        type: 'continuous'
                    }}
                }},
                physics: {{
                    stabilization: {{
                        iterations: 1000
                    }},
                    barnesHut: {{
                        gravitationalConstant: -3000,
                        centralGravity: 0.3,
                        springLength: 120
                    }}
                }},
                interaction: {{
                    hover: true,
                    tooltipDelay: 200,
                    hideEdgesOnDrag: true
                }}
            }};
            
            new vis.Network(container, data, options);
        }}

        document.addEventListener('DOMContentLoaded', function() {{
            initTimeline();
            initNetwork();
            
            document.querySelectorAll('.filter-btn').forEach(btn => {{
                btn.addEventListener('click', function() {{
                    filterTimeline(this.dataset.filter);
                }});
            }});
        }});
    </script>
</body>
</html>
"""
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

    def _build_timeline_events(self) -> List[Dict[str, Any]]:
        events = []
        
        for po in self.po_lines:
            if po.date:
                events.append({
                    "id": f"po-{po.doc_id}",
                    "content": f"<div style='font-weight:bold'>PO: {po.doc_id}</div><div>{po.item_description}</div><div>¥{po.total_amount}</div>",
                    "start": po.date.isoformat(),
                    "group": "采购订单",
                    "style": "background-color: #4CAF50; border-color: #388E3C; color: white;"
                })
        
        for rec in self.receipts:
            if rec.date:
                events.append({
                    "id": f"rec-{rec.doc_id}",
                    "content": f"<div style='font-weight:bold'>REC: {rec.doc_id}</div><div>数量: {rec.received_quantity}</div>",
                    "start": rec.date.isoformat(),
                    "group": "收货单",
                    "style": "background-color: #2196F3; border-color: #1976D2; color: white;"
                })
        
        for inv in self.invoices:
            if inv.date:
                issues_for_inv = [i for i in self.issues if i.primary_doc_id == inv.doc_id]
                badge = ""
                if any(i.severity == IssueSeverity.CRITICAL for i in issues_for_inv):
                    badge = '<span class="issue-badge critical">严重</span>'
                elif any(i.severity == IssueSeverity.WARNING for i in issues_for_inv):
                    badge = '<span class="issue-badge warning">警告</span>'
                
                events.append({
                    "id": f"inv-{inv.doc_id}",
                    "content": f"<div style='font-weight:bold'>INV: {inv.doc_id}</div><div>{inv.vendor_name}</div><div>¥{inv.total_amount}</div>{badge}",
                    "start": inv.date.isoformat(),
                    "group": "发票",
                    "style": "background-color: #FF9800; border-color: #F57C00; color: white;"
                })
        
        for pay in self.payments:
            if pay.date:
                badge = '<span class="issue-badge info">跨月</span>' if pay.is_cross_month else ""
                events.append({
                    "id": f"pay-{pay.doc_id}",
                    "content": f"<div style='font-weight:bold'>PAY: {pay.doc_id}</div><div>¥{pay.total_amount}</div>{badge}",
                    "start": pay.date.isoformat(),
                    "group": "付款单",
                    "style": "background-color: #9C27B0; border-color: #7B1FA2; color: white;"
                })
        
        return events

    def _build_graph_data(self) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        nodes = []
        edges = []
        
        doc_issues = defaultdict(list)
        for issue in self.issues:
            doc_issues[issue.primary_doc_id].append(issue)
        
        for po in self.po_lines:
            issues = doc_issues.get(po.doc_id, [])
            color = "#4CAF50"
            border_color = "#388E3C"
            if any(i.severity == IssueSeverity.CRITICAL for i in issues):
                color = "#ff4444"
                border_color = "#cc0000"
            elif any(i.severity == IssueSeverity.WARNING for i in issues):
                color = "#ffbb33"
                border_color = "#ff9900"
            
            nodes.append({
                "id": f"po_{po.doc_id}",
                "label": f"PO\n{po.doc_id}",
                "title": f"采购订单: {po.doc_id}\n物料: {po.item_description}\n数量: {po.quantity}\n金额: ¥{po.total_amount}",
                "color": {"background": color, "border": border_color}
            })
        
        for rec in self.receipts:
            issues = doc_issues.get(rec.doc_id, [])
            color = "#2196F3"
            border_color = "#1976D2"
            if any(i.severity == IssueSeverity.CRITICAL for i in issues):
                color = "#ff4444"
                border_color = "#cc0000"
            elif any(i.severity == IssueSeverity.WARNING for i in issues):
                color = "#ffbb33"
                border_color = "#ff9900"
            
            nodes.append({
                "id": f"rec_{rec.doc_id}",
                "label": f"REC\n{rec.doc_id}",
                "title": f"收货单: {rec.doc_id}\n收货数量: {rec.received_quantity}\n仓库: {rec.warehouse}",
                "color": {"background": color, "border": border_color}
            })
            
            if rec.po_number:
                for po in self.po_lines:
                    if po.po_number == rec.po_number:
                        edges.append({
                            "from": f"po_{po.doc_id}",
                            "to": f"rec_{rec.doc_id}",
                            "title": "订单->收货"
                        })
        
        for inv in self.invoices:
            issues = doc_issues.get(inv.doc_id, [])
            color = "#FF9800"
            border_color = "#F57C00"
            if any(i.severity == IssueSeverity.CRITICAL for i in issues):
                color = "#ff4444"
                border_color = "#cc0000"
            elif any(i.severity == IssueSeverity.WARNING for i in issues):
                color = "#ffbb33"
                border_color = "#ff9900"
            
            special_labels = []
            if inv.is_split:
                special_labels.append("拆分")
            if inv.is_merged:
                special_labels.append("合并")
            special_str = f"\n[{','.join(special_labels)}]" if special_labels else ""
            
            nodes.append({
                "id": f"inv_{inv.doc_id}",
                "label": f"INV\n{inv.doc_id}{special_str}",
                "title": f"发票: {inv.doc_id}\n供应商: {inv.vendor_name}\n金额: ¥{inv.total_amount}\n税率: {inv.tax_rate*100 if inv.tax_rate else 'N/A'}%",
                "color": {"background": color, "border": border_color}
            })
            
            if inv.po_number:
                for po in self.po_lines:
                    if po.po_number == inv.po_number:
                        edges.append({
                            "from": f"po_{po.doc_id}",
                            "to": f"inv_{inv.doc_id}",
                            "title": "订单->发票"
                        })
        
        for pay in self.payments:
            issues = doc_issues.get(pay.doc_id, [])
            color = "#9C27B0"
            border_color = "#7B1FA2"
            if any(i.severity == IssueSeverity.CRITICAL for i in issues):
                color = "#ff4444"
                border_color = "#cc0000"
            elif any(i.severity == IssueSeverity.WARNING for i in issues):
                color = "#ffbb33"
                border_color = "#ff9900"
            
            special_str = "\n[跨月]" if pay.is_cross_month else ""
            
            nodes.append({
                "id": f"pay_{pay.doc_id}",
                "label": f"PAY\n{pay.doc_id}{special_str}",
                "title": f"付款单: {pay.doc_id}\n金额: ¥{pay.total_amount}\n方式: {pay.payment_method}",
                "color": {"background": color, "border": border_color}
            })
            
            if pay.invoice_number:
                edges.append({
                    "from": f"inv_{pay.invoice_number}",
                    "to": f"pay_{pay.doc_id}",
                    "title": "发票->付款"
                })
        
        return nodes, edges
