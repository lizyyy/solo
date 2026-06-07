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
        report_id = f"REPORT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        path = self.output_dir / f"{report_id}_dashboard.html"

        html = self._build_html(dashboard, tickets, report_id)

        with open(path, "w", encoding="utf-8") as f:
            f.write(html)

        return str(path)

    def _build_html(self, dashboard: DashboardData, tickets: List[Ticket], report_id: str) -> str:
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

            ticket_rows.append(f"""
            <tr class="hover:bg-gray-50 cursor-pointer" onclick="showTicketDetail('{ticket.ticket_id}')">
                <td class="px-4 py-3 text-sm font-mono text-blue-600">{ticket.ticket_id}</td>
                <td class="px-4 py-3 text-sm">{mask_text(ticket.title)}</td>
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
                <li>• <strong>泄露风险</strong>：手机号等敏感数据未脱敏时会被标记为高风险，不自动归为"正常"</li>
                <li>• <strong>责任分工</strong>：OCR置信度低的找<strong>算法同事</strong>，规则配置问题找<strong>运营老唐</strong></li>
                <li>• <strong>脱敏复查</strong>：本报告所有输出均已自动脱敏，不会留存原始手机号</li>
            </ul>
        </div>
    </main>

    <script>
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

        function showTicketDetail(ticketId) {{
            alert('正在打开工单: ' + ticketId + '\\n\\n实际场景中会跳转到: 线上反馈工单系统 / 脱敏规则配置页面');
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
