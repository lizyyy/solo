import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import Counter

from ..models.ticket import Ticket, TicketStatus
from ..models.export import ExportRecord
from ..storage.store import DataStore
from ..utils.mask import mask_text


@dataclass
class DashboardData:
    total_tickets: int
    tickets_with_leaks: int
    leak_rate: float
    total_fields: int
    masked_fields: int
    leaked_fields: int
    by_status: Dict[str, int]
    by_leak_type: Dict[str, int]
    by_responsible: Dict[str, int]
    avg_ocr_confidence: float
    trend_data: List[Dict[str, Any]]


class ReportGenerator:
    def __init__(self, store: DataStore, output_dir: str = "output"):
        self.store = store
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_dashboard(self) -> DashboardData:
        tickets = self.store.list_tickets()
        exports = self.store.list_exports()

        total_tickets = len(tickets)
        tickets_with_leaks = sum(1 for t in tickets if t.has_leaks())
        leak_rate = round(tickets_with_leaks / total_tickets * 100, 2) if total_tickets > 0 else 0

        by_status = Counter(t.status.value for t in tickets)

        total_fields = 0
        masked_fields = 0
        leaked_fields = 0
        by_leak_type = Counter()
        by_responsible = Counter()
        ocr_scores = []

        for ticket in tickets:
            if ticket.ocr_confidence_score:
                ocr_scores.append(ticket.ocr_confidence_score)
            for field in ticket.fields:
                total_fields += 1
                if field.is_masked:
                    masked_fields += 1
                if field.leak_detected:
                    leaked_fields += 1
                    by_leak_type["phone"] += 1
                    if field.ocr_confidence and field.ocr_confidence < 0.7:
                        by_responsible["algorithm"] += 1
                    else:
                        by_responsible["operation"] += 1

        avg_ocr_confidence = round(sum(ocr_scores) / len(ocr_scores), 3) if ocr_scores else 0

        trend_data = self._build_trend_data(tickets)

        return DashboardData(
            total_tickets=total_tickets,
            tickets_with_leaks=tickets_with_leaks,
            leak_rate=leak_rate,
            total_fields=total_fields,
            masked_fields=masked_fields,
            leaked_fields=leaked_fields,
            by_status=dict(by_status),
            by_leak_type=dict(by_leak_type),
            by_responsible=dict(by_responsible),
            avg_ocr_confidence=avg_ocr_confidence,
            trend_data=trend_data,
        )

    def _build_trend_data(self, tickets: List[Ticket]) -> List[Dict[str, Any]]:
        daily_data = {}
        for ticket in tickets:
            day = ticket.created_at.strftime("%Y-%m-%d")
            if day not in daily_data:
                daily_data[day] = {"total": 0, "with_leaks": 0, "avg_confidence": []}
            daily_data[day]["total"] += 1
            if ticket.has_leaks():
                daily_data[day]["with_leaks"] += 1
            if ticket.ocr_confidence_score:
                daily_data[day]["avg_confidence"].append(ticket.ocr_confidence_score)

        trend = []
        for day in sorted(daily_data.keys()):
            data = daily_data[day]
            confs = data["avg_confidence"]
            trend.append({
                "date": day,
                "total": data["total"],
                "with_leaks": data["with_leaks"],
                "leak_rate": round(data["with_leaks"] / data["total"] * 100, 2) if data["total"] > 0 else 0,
                "avg_ocr_confidence": round(sum(confs) / len(confs), 3) if confs else None,
            })
        return trend

    def generate_html_report(self) -> str:
        dashboard = self.generate_dashboard()
        tickets = self.store.list_tickets()
        exports = self.store.list_exports()
        export_map = {}
        for e in exports:
            if e.ticket_id not in export_map:
                export_map[e.ticket_id] = []
            export_map[e.ticket_id].append(e)
        report_id = f"REPORT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        path = self.output_dir / f"{report_id}_dashboard.html"

        html = self._build_html(dashboard, tickets, export_map, report_id)

        with open(path, "w", encoding="utf-8") as f:
            f.write(html)

        return str(path)

    def _build_ticket_detail_json(self, tickets: List[Ticket], export_map: Dict[str, List]) -> str:
        result = {}
        for ticket in tickets:
            ticket_exports = export_map.get(ticket.ticket_id, [])
            ticket_export_info = []
            for e in sorted(ticket_exports, key=lambda x: x.generated_at, reverse=True):
                ticket_export_info.append({
                    "export_id": e.export_id,
                    "generated_at": e.generated_at.strftime('%Y-%m-%d %H:%M:%S'),
                    "summary": e.summary,
                    "report_file": f"{e.export_id}_report.txt",
                    "data_file": f"{e.export_id}_data.json",
                })
            fields_info = []
            for f in ticket.fields:
                display_value = f.get_display_value() if hasattr(f, "get_display_value") else (f.mask_pattern if f.is_masked and f.mask_pattern else f.field_value)
                has_sensitive, _ = hasattr(self, "_dummy") and (False, []) or (False, [])
                fields_info.append({
                    "field_name": f.field_name,
                    "value": mask_text(display_value),
                    "is_masked": f.is_masked,
                    "leak_detected": f.leak_detected,
                    "leak_risk": f.leak_detected and ("high" if not (f.last_reviewed_by) else "none") or "none",
                    "ocr_confidence": f.ocr_confidence,
                    "leak_note": mask_text(f.leak_note) if f.leak_note else None,
                    "missing_materials": list(getattr(f, "missing_materials", []) or []),
                    "last_reviewed_by": getattr(f, "last_reviewed_by", None),
                    "last_reviewed_at": getattr(f, "last_reviewed_at", None),
                })
            changes_info = []
            for log in ticket.change_logs:
                type_map = {
                    "status_changed": "状态变更",
                    "rule_note_added": "运营备注",
                    "algorithm_note_added": "算法备注",
                    "missing_materials_updated": "缺材料更新",
                    "leak_detected": "泄露检测",
                }
                changes_info.append({
                    "change_id": log.change_id,
                    "change_type": type_map.get(log.change_type, log.change_type),
                    "field_name": log.field_name,
                    "author": log.author,
                    "timestamp": log.timestamp,
                    "old_value": log.old_value_summary,
                    "new_value": log.new_value_summary,
                    "note": mask_text(log.note) if log.note else None,
                    "affected_exports": list(log.affected_exports),
                })
            result[ticket.ticket_id] = {
                "ticket_id": ticket.ticket_id,
                "title": mask_text(ticket.title),
                "source": ticket.source,
                "status": ticket.status.value,
                "assignee": ticket.assignee,
                "description": mask_text(ticket.description),
                "fields": fields_info,
                "rule_notes": [
                    {**n, "note": mask_text(n["note"])} for n in ticket.rule_notes
                ],
                "algorithm_notes": [
                    {**n, "note": mask_text(n["note"])} for n in ticket.algorithm_notes
                ],
                "change_logs": changes_info,
                "export_history": ticket_export_info,
            }
        return json.dumps(result, ensure_ascii=False)

    def _build_html(self, dashboard: DashboardData, tickets: List[Ticket], export_map: Dict[str, List], report_id: str) -> str:
        ticket_rows = []
        for ticket in tickets[:20]:
            leak_count = len(ticket.get_leaking_fields())
            status_color = {
                "imported": "#3b82f6",
                "detected_leak": "#ef4444",
                "review_pending": "#f59e0b",
                "reviewed_by_operation": "#8b5cf6",
                "reviewed_by_algorithm": "#06b6d4",
                "resolved": "#10b981",
                "closed": "#6b7280",
            }.get(ticket.status.value, "#6b7280")
            latest_exports = export_map.get(ticket.ticket_id, [])
            latest_export = sorted(latest_exports, key=lambda x: x.generated_at, reverse=True)[0] if latest_exports else None
            latest_export_link = f'<br><span class="text-xs text-blue-500 font-mono">→ {latest_export.export_id}</span>' if latest_export else ""

            ticket_rows.append(f"""
            <tr class="hover:bg-gray-50 cursor-pointer" onclick="showTicketDetail('{ticket.ticket_id}')">
                <td class="px-4 py-3 text-sm font-mono text-blue-600">{ticket.ticket_id}</td>
                <td class="px-4 py-3 text-sm">{mask_text(ticket.title)}{latest_export_link}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full text-white" style="background-color: {status_color}">
                        {ticket.status.value}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm text-center">
                    {leak_count > 0 and f'<span class="text-red-600 font-bold">{leak_count}</span>' or '0'}
                </td>
                <td class="px-4 py-3 text-sm">
                    {ticket.ocr_confidence_score and f"{ticket.ocr_confidence_score:.2f}" or "-"}
                </td>
                <td class="px-4 py-3 text-sm text-gray-500">{ticket.created_at.strftime('%m-%d %H:%M')}</td>
            </tr>
            """)

        status_chart_data = []
        for status, count in dashboard.by_status.items():
            status_chart_data.append({"name": status, "value": count})
        status_chart_json = json.dumps(status_chart_data, ensure_ascii=False)

        leak_chart_data = []
        for leak_type, count in dashboard.by_leak_type.items():
            leak_chart_data.append({"name": leak_type, "value": count})
        leak_chart_json = json.dumps(leak_chart_data, ensure_ascii=False)

        trend_dates = [d["date"] for d in dashboard.trend_data]
        trend_leak_rates = [d["leak_rate"] for d in dashboard.trend_data]
        trend_confidences = [d["avg_ocr_confidence"] or 0 for d in dashboard.trend_data]

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>发票 OCR 置信度复核 - 数据看板</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <style>
        .stat-card {{ transition: all 0.2s; }}
        .stat-card:hover {{ transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }}
        .chart-container {{ min-height: 300px; }}
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 py-4">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-xl font-bold text-gray-800">🔍 发票 OCR 置信度复核</h1>
                    <p class="text-sm text-gray-500">报告编号: {report_id} | 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.print()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">打印报告</button>
                </div>
            </div>
        </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 py-6">
        <!-- 统计卡片 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="stat-card bg-white rounded-lg shadow p-5">
                <div class="text-sm text-gray-500 mb-1">总工单数</div>
                <div class="text-3xl font-bold text-gray-800">{dashboard.total_tickets}</div>
                <div class="text-xs text-gray-400 mt-1">累计导入</div>
            </div>
            <div class="stat-card bg-white rounded-lg shadow p-5">
                <div class="text-sm text-gray-500 mb-1">泄露工单</div>
                <div class="text-3xl font-bold text-red-600">{dashboard.tickets_with_leaks}</div>
                <div class="text-xs text-red-400 mt-1">泄露率 {dashboard.leak_rate}%</div>
            </div>
            <div class="stat-card bg-white rounded-lg shadow p-5">
                <div class="text-sm text-gray-500 mb-1">泄露字段</div>
                <div class="text-3xl font-bold text-orange-600">{dashboard.leaked_fields}</div>
                <div class="text-xs text-gray-400 mt-1">共 {dashboard.total_fields} 个字段</div>
            </div>
            <div class="stat-card bg-white rounded-lg shadow p-5">
                <div class="text-sm text-gray-500 mb-1">平均OCR置信度</div>
                <div class="text-3xl font-bold text-blue-600">{dashboard.avg_ocr_confidence:.2f}</div>
                <div class="text-xs text-gray-400 mt-1">基于置信度评分</div>
            </div>
        </div>

        <!-- 图表区域 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-5">
                <h3 class="font-semibold text-gray-700 mb-3">📊 工单状态分布</h3>
                <div id="statusChart" class="chart-container"></div>
            </div>
            <div class="bg-white rounded-lg shadow p-5">
                <h3 class="font-semibold text-gray-700 mb-3">🔒 泄露类型分布</h3>
                <div id="leakChart" class="chart-container"></div>
            </div>
        </div>

        <!-- 趋势图 -->
        <div class="bg-white rounded-lg shadow p-5 mb-6">
            <h3 class="font-semibold text-gray-700 mb-3">📈 每日泄露趋势 & OCR置信度</h3>
            <div id="trendChart" style="height: 350px;"></div>
        </div>

        <!-- 工单列表 -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="px-5 py-4 border-b">
                <h3 class="font-semibold text-gray-700">📋 工单列表 (点击查看详情)</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">工单编号</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标题</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                            <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">泄露字段</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">OCR置信度</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        {''.join(ticket_rows)}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 说明区域 -->
        <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
            <h3 class="font-semibold text-blue-800 mb-2">📖 说明</h3>
            <ul class="text-sm text-blue-700 space-y-1">
                <li>• <strong>点到工单</strong>：点击任意工单可追溯到原始线上反馈工单和脱敏规则备注</li>
                <li>• <strong>点到字段</strong>：点击字段行可跳转对应的脱敏导出报告（EXPORT-xxxx）</li>
                <li>• <strong>泄露风险</strong>：手机号等敏感数据未脱敏时会被标记为高风险，不自动归为"正常"</li>
                <li>• <strong>还缺什么材料</strong>：未复核字段会明确列出缺失的补录项</li>
                <li>• <strong>变更追溯</strong>：可查看谁改了什么、影响了哪条导出</li>
                <li>• <strong>责任分工</strong>：OCR置信度低的找<strong>算法同事</strong>，规则配置问题找<strong>运营老唐</strong></li>
                <li>• <strong>脱敏复查</strong>：本报告所有输出均已自动脱敏，不会留存原始手机号</li>
            </ul>
        </div>
    </main>

    <!-- 工单详情模态框 -->
    <div id="ticketModal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div class="px-6 py-4 border-b flex items-center justify-between">
                <h2 id="modalTitle" class="text-lg font-bold text-gray-800">工单详情</h2>
                <button onclick="closeTicketDetail()" class="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
            </div>
            <div id="modalBody" class="overflow-y-auto p-6 flex-1"></div>
        </div>
    </div>

    <script>
        var ALL_TICKET_DATA = {self._build_ticket_detail_json(tickets, export_map)};
        // 状态饼图
        var statusChart = echarts.init(document.getElementById('statusChart'));
        statusChart.setOption({{
            tooltip: {{ trigger: 'item' }},
            legend: {{ bottom: 0 }},
            series: [{{
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {{ borderRadius: 10, borderColor: '#fff', borderWidth: 2 }},
                label: {{ show: false }},
                emphasis: {{ label: {{ show: true, fontSize: 14, fontWeight: 'bold' }} }},
                data: {status_chart_json}
            }}]
        }});

        // 泄露类型饼图
        var leakChart = echarts.init(document.getElementById('leakChart'));
        leakChart.setOption({{
            tooltip: {{ trigger: 'item' }},
            legend: {{ bottom: 0 }},
            series: [{{
                type: 'pie',
                radius: ['40%', '70%'],
                itemStyle: {{ borderRadius: 10, borderColor: '#fff', borderWidth: 2 }},
                data: {leak_chart_json}
            }}]
        }});

        // 趋势图
        var trendChart = echarts.init(document.getElementById('trendChart'));
        trendChart.setOption({{
            tooltip: {{ trigger: 'axis' }},
            legend: {{ data: ['泄露率(%)', 'OCR置信度'], top: 0 }},
            grid: {{ left: '3%', right: '4%', bottom: '3%', containLabel: true }},
            xAxis: {{ type: 'category', data: {json.dumps(trend_dates, ensure_ascii=False)} }},
            yAxis: [
                {{ type: 'value', name: '泄露率(%)', min: 0, max: 100 }},
                {{ type: 'value', name: '置信度', min: 0, max: 1 }}
            ],
            series: [
                {{
                    name: '泄露率(%)',
                    type: 'line',
                    smooth: true,
                    itemStyle: {{ color: '#ef4444' }},
                    areaStyle: {{ opacity: 0.1 }},
                    data: {json.dumps(trend_leak_rates)}
                }},
                {{
                    name: 'OCR置信度',
                    type: 'line',
                    smooth: true,
                    yAxisIndex: 1,
                    itemStyle: {{ color: '#3b82f6' }},
                    areaStyle: {{ opacity: 0.1 }},
                    data: {json.dumps(trend_confidences)}
                }}
            ]
        }});

        function closeTicketDetail() {{
            document.getElementById('ticketModal').classList.add('hidden');
        }}

        function showTicketDetail(ticketId) {{
            var t = ALL_TICKET_DATA[ticketId];
            if (!t) {{
                alert('未找到工单: ' + ticketId);
                return;
            }}
            document.getElementById('modalTitle').textContent = t.ticket_id + ' - ' + t.title;

            var html = '';
            html += '<div class="mb-4">';
            html += '<div class="text-sm text-gray-600">来源: <strong>' + t.source + '</strong> | 状态: <strong>' + t.status + '</strong> | 指派人: <strong>' + (t.assignee || '未指定') + '</strong></div>';
            if (t.description) {{
                html += '<div class="mt-2 text-sm bg-gray-50 p-3 rounded">' + t.description + '</div>';
            }}
            html += '</div>';

            html += '<h3 class="font-semibold text-gray-800 mb-2 mt-4">📋 字段明细（点击跳转到最新导出报告）</h3>';
            html += '<div class="overflow-x-auto border rounded-lg mb-4">';
            html += '<table class="w-full text-sm"><thead class="bg-gray-100"><tr>';
            html += '<th class="px-3 py-2 text-left">字段</th><th class="px-3 py-2 text-left">导出值</th>';
            html += '<th class="px-3 py-2 text-left">泄露</th><th class="px-3 py-2 text-left">OCR置信度</th>';
            html += '<th class="px-3 py-2 text-left">还缺什么材料</th><th class="px-3 py-2 text-left">复核人</th>';
            html += '</tr></thead><tbody>';
            t.fields.forEach(function(f) {{
                var riskColor = f.leak_risk === 'high' ? '#dc2626' : (f.leak_risk === 'medium' ? '#f59e0b' : '#16a34a');
                var riskTxt = f.leak_risk === 'none' ? '无' : (f.leak_risk || '无');
                var missingHtml = (f.missing_materials && f.missing_materials.length > 0)
                    ? '<span class="text-orange-600 text-xs">' + f.missing_materials.join('<br>') + '</span>'
                    : '<span class="text-green-600 text-xs">齐全</span>';
                html += '<tr class="border-t hover:bg-blue-50 cursor-pointer" onclick="jumpToLatestExport(\\'' + ticketId + '\\', \\'' + f.field_name + '\\')">';
                html += '<td class="px-3 py-2 font-mono text-blue-600">' + f.field_name + '</td>';
                html += '<td class="px-3 py-2">' + f.value + '</td>';
                html += '<td class="px-3 py-2"><span style="color:' + riskColor + '">' + riskTxt + '</span></td>';
                html += '<td class="px-3 py-2">' + (f.ocr_confidence != null ? f.ocr_confidence.toFixed(2) : '-') + '</td>';
                html += '<td class="px-3 py-2">' + missingHtml + '</td>';
                html += '<td class="px-3 py-2">' + (f.last_reviewed_by || '<span class="text-gray-400">未复核</span>') + '</td>';
                html += '</tr>';
            }});
            html += '</tbody></table></div>';

            if (t.rule_notes && t.rule_notes.length > 0) {{
                html += '<h3 class="font-semibold text-gray-800 mb-2">📝 运营老唐的备注</h3>';
                t.rule_notes.forEach(function(n) {{
                    html += '<div class="bg-purple-50 border-l-4 border-purple-500 p-3 mb-2 text-sm">';
                    html += '<div class="text-xs text-purple-700 mb-1">' + n.timestamp + ' · ' + n.author + (n.field_name ? ' · 字段: ' + n.field_name : '') + '</div>';
                    html += '<div>' + n.note + '</div></div>';
                }});
            }}

            if (t.change_logs && t.change_logs.length > 0) {{
                html += '<h3 class="font-semibold text-gray-800 mb-2 mt-4">📜 变更历史（谁改了什么 / 影响了哪条导出）</h3>';
                html += '<div class="space-y-2">';
                t.change_logs.forEach(function(c) {{
                    html += '<div class="border rounded-lg p-3 text-sm">';
                    html += '<div class="flex items-center justify-between mb-1">';
                    html += '<span class="font-semibold text-gray-800">[' + c.change_id + '] ' + c.change_type + '</span>';
                    html += '<span class="text-xs text-gray-500">' + c.timestamp + ' · ' + c.author + '</span>';
                    html += '</div>';
                    if (c.field_name) html += '<div class="text-xs text-blue-600 mb-1">字段: ' + c.field_name + '</div>';
                    html += '<div class="text-gray-700">变化: <span class="text-red-600">' + c.old_value + '</span> → <span class="text-green-600">' + c.new_value + '</span></div>';
                    if (c.note) html += '<div class="text-gray-600 mt-1">备注: ' + c.note + '</div>';
                    if (c.affected_exports && c.affected_exports.length > 0) {{
                        html += '<div class="text-xs text-purple-600 mt-1">影响导出: ' + c.affected_exports.map(function(e) {{ return '<span class="font-mono">' + e + '</span>'; }}).join(', ') + '</div>';
                    }}
                    html += '</div>';
                }});
                html += '</div>';
            }}

            if (t.export_history && t.export_history.length > 0) {{
                html += '<h3 class="font-semibold text-gray-800 mb-2 mt-4">📤 导出历史（点击查看对应报告）</h3>';
                html += '<div class="overflow-x-auto border rounded-lg">';
                html += '<table class="w-full text-sm"><thead class="bg-gray-100"><tr>';
                html += '<th class="px-3 py-2 text-left">导出ID</th><th class="px-3 py-2 text-left">时间</th>';
                html += '<th class="px-3 py-2 text-left">泄露字段</th><th class="px-3 py-2 text-left">报告文件</th>';
                html += '</tr></thead><tbody>';
                t.export_history.forEach(function(e) {{
                    var leakCount = (e.summary && e.summary.leak_fields != null) ? e.summary.leak_fields : '-';
                    html += '<tr class="border-t hover:bg-blue-50 cursor-pointer" onclick="openExportReport(\\'' + e.report_file + '\\')">';
                    html += '<td class="px-3 py-2 font-mono text-blue-600">' + e.export_id + '</td>';
                    html += '<td class="px-3 py-2">' + e.generated_at + '</td>';
                    html += '<td class="px-3 py-2">' + (leakCount > 0 ? '<span class="text-red-600 font-bold">' + leakCount + '</span>' : leakCount) + '</td>';
                    html += '<td class="px-3 py-2 text-xs font-mono">' + e.report_file + '</td>';
                    html += '</tr>';
                }});
                html += '</tbody></table></div>';
            }}

            document.getElementById('modalBody').innerHTML = html;
            document.getElementById('ticketModal').classList.remove('hidden');
        }}

        function jumpToLatestExport(ticketId, fieldName) {{
            var t = ALL_TICKET_DATA[ticketId];
            if (!t || !t.export_history || t.export_history.length === 0) {{
                alert('该工单暂无导出记录，请先生成导出。\\n字段: ' + fieldName);
                return;
            }}
            var latest = t.export_history[0];
            alert('字段 ' + fieldName + ' 对应的最新导出报告为:\\n\\n' + latest.report_file + '\\n\\n请在 output 目录下打开该文件，或使用命令:\\ncat output/' + latest.report_file);
        }}

        function openExportReport(fileName) {{
            alert('请在 output 目录下打开报告文件:\\n\\noutput/' + fileName);
        }}

        window.addEventListener('resize', function() {{
            statusChart.resize();
            leakChart.resize();
            trendChart.resize();
        }});
    </script>
</body>
</html>"""
        return html

    def generate_text_summary(self) -> str:
        dashboard = self.generate_dashboard()
        lines = []
        lines.append("=" * 60)
        lines.append("发票 OCR 置信度复核 - 综合摘要报告")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append(f"📊 概览:")
        lines.append(f"   总工单数: {dashboard.total_tickets}")
        lines.append(f"   泄露工单: {dashboard.tickets_with_leaks} ({dashboard.leak_rate}%)")
        lines.append(f"   总字段数: {dashboard.total_fields}")
        lines.append(f"   泄露字段: {dashboard.leaked_fields}")
        lines.append(f"   平均OCR置信度: {dashboard.avg_ocr_confidence:.3f}")
        lines.append("")
        lines.append(f"📋 工单状态:")
        for status, count in dashboard.by_status.items():
            lines.append(f"   {status}: {count}")
        lines.append("")
        lines.append(f"👥 责任分布:")
        for role, count in dashboard.by_responsible.items():
            role_name = "算法同事" if role == "algorithm" else "运营老唐"
            lines.append(f"   {role_name}: {count} 个字段待处理")
        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
