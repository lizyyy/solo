import json
from datetime import datetime
from typing import List

from ..core.calculator import TidalPredictionResult
from ..core.data_processor import ProcessingSummary


class ReportGenerator:
    def __init__(self):
        pass

    def _result_to_dict(self, result: TidalPredictionResult) -> dict:
        return {
            "record_id": result.record_id,
            "timestamp": result.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "station_name": result.station_name,
            "tidal_range": result.input.tidal_range,
            "tidal_range_unit": result.input.tidal_range_unit,
            "flow_rate": result.input.flow_rate,
            "flow_rate_unit": result.input.flow_rate_unit,
            "efficiency": result.input.turbine_efficiency,
            "predicted_power": round(result.predicted_power, 2) if result.predicted_power else None,
            "power_unit": result.power_unit,
            "status": result.status,
            "status_text": self._get_status_text(result.status),
            "calculation_method": result.calculation_method,
            "confidence_score": round(result.confidence_score * 100, 1) if result.confidence_score else 0,
            "issues": [
                {
                    "level": issue.level,
                    "field": issue.field,
                    "message": issue.message,
                    "suggestion": issue.suggestion
                }
                for issue in result.issues
            ],
            "processing_notes": result.processing_notes,
            "original_notes": result.input.notes,
            "data_source": result.input.data_source
        }

    def _get_status_text(self, status: str) -> str:
        status_map = {
            "success": "计算成功",
            "needs_review": "待人工确认",
            "failed": "计算失败",
            "pending": "待处理"
        }
        return status_map.get(status, status)

    def _get_status_color(self, status: str) -> str:
        color_map = {
            "success": "#10b981",
            "needs_review": "#f59e0b",
            "failed": "#ef4444",
            "pending": "#6b7280"
        }
        return color_map.get(status, "#6b7280")

    def _get_status_icon(self, status: str) -> str:
        icon_map = {
            "success": "✓",
            "needs_review": "⚠",
            "failed": "✕",
            "pending": "◷"
        }
        return icon_map.get(status, "?")

    def generate_html_report(
        self,
        results: List[TidalPredictionResult],
        summary: ProcessingSummary,
        filepath: str
    ) -> None:
        results_data = [self._result_to_dict(r) for r in results]
        
        chart_data = [
            {
                "id": r["record_id"],
                "label": r["station_name"] if r["station_name"] else r["record_id"],
                "power": r["predicted_power"] or 0,
                "status": r["status"],
                "confidence": r["confidence_score"]
            }
            for r in results_data
        ]

        html_template = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>潮汐发电功率预测报告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        .header {{
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }}
        
        .header h1 {{
            font-size: 2.5rem;
            margin-bottom: 10px;
        }}
        
        .header p {{
            font-size: 1.1rem;
            opacity: 0.9;
        }}
        
        .summary-cards {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        
        .card {{
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            text-align: center;
        }}
        
        .card .value {{
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 5px;
        }}
        
        .card .label {{
            color: #6b7280;
            font-size: 0.9rem;
        }}
        
        .card.success .value {{ color: #10b981; }}
        .card.warning .value {{ color: #f59e0b; }}
        .card.danger .value {{ color: #ef4444; }}
        .card.info .value {{ color: #3b82f6; }}
        .card.power .value {{ color: #8b5cf6; font-size: 1.8rem; }}
        
        .main-content {{
            display: grid;
            grid-template-columns: 1fr;
            gap: 30px;
        }}
        
        @media (min-width: 1024px) {{
            .main-content {{
                grid-template-columns: 1fr 1fr;
            }}
        }}
        
        .panel {{
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        
        .panel h2 {{
            color: #1f2937;
            margin-bottom: 20px;
            font-size: 1.3rem;
            padding-bottom: 10px;
            border-bottom: 2px solid #f3f4f6;
        }}
        
        .chart-container {{
            position: relative;
            height: 350px;
        }}
        
        .bar-tooltip {{
            cursor: pointer;
            transition: all 0.2s;
        }}
        
        .bar-tooltip:hover {{
            filter: brightness(1.1);
        }}
        
        .detail-panel {{
            grid-column: 1 / -1;
        }}
        
        .detail-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }}
        
        .detail-header h2 {{
            margin-bottom: 0;
            border-bottom: none;
            padding-bottom: 0;
        }}
        
        .detail-subtitle {{
            color: #6b7280;
            font-size: 0.9rem;
        }}
        
        .table-wrapper {{
            overflow-x: auto;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }}
        
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #f3f4f6;
        }}
        
        th {{
            background: #f9fafb;
            font-weight: 600;
            color: #374151;
            position: sticky;
            top: 0;
        }}
        
        tr:hover {{
            background: #f9fafb;
        }}
        
        tr.selected {{
            background: #eff6ff;
        }}
        
        .status-badge {{
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 500;
        }}
        
        .status-badge.success {{
            background: #d1fae5;
            color: #065f46;
        }}
        
        .status-badge.needs_review {{
            background: #fef3c7;
            color: #92400e;
        }}
        
        .status-badge.failed {{
            background: #fee2e2;
            color: #991b1b;
        }}
        
        .issues-popup {{
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }}
        
        .issues-popup.show {{
            display: flex;
        }}
        
        .popup-content {{
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }}
        
        .popup-content h3 {{
            margin-bottom: 20px;
            color: #1f2937;
        }}
        
        .issue-item {{
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 10px;
        }}
        
        .issue-item.error {{
            background: #fee2e2;
            border-left: 4px solid #ef4444;
        }}
        
        .issue-item.warning {{
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
        }}
        
        .issue-field {{
            font-weight: 600;
            margin-bottom: 5px;
        }}
        
        .issue-message {{
            color: #4b5563;
            margin-bottom: 5px;
        }}
        
        .issue-suggestion {{
            color: #6b7280;
            font-size: 0.85rem;
            font-style: italic;
        }}
        
        .close-btn {{
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            margin-top: 20px;
            font-size: 1rem;
        }}
        
        .close-btn:hover {{
            background: #2563eb;
        }}
        
        .view-details-btn {{
            background: #3b82f6;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.8rem;
        }}
        
        .view-details-btn:hover {{
            background: #2563eb;
        }}
        
        .formula-box {{
            background: #f8fafc;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            border-radius: 0 8px 8px 0;
            margin-bottom: 15px;
        }}
        
        .formula-box h4 {{
            color: #1e40af;
            margin-bottom: 8px;
        }}
        
        .formula-box code {{
            background: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', monospace;
        }}
        
        .footer {{
            text-align: center;
            color: white;
            margin-top: 30px;
            opacity: 0.8;
        }}
        
        .legend {{
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            margin-bottom: 15px;
        }}
        
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 0.85rem;
        }}
        
        .legend-color {{
            width: 16px;
            height: 16px;
            border-radius: 3px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌊 潮汐发电功率预测报告</h1>
            <p>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | 让汇总和明细不再脱节</p>
        </div>
        
        <div class="summary-cards">
            <div class="card">
                <div class="value">{summary.total_records}</div>
                <div class="label">总记录数</div>
            </div>
            <div class="card success">
                <div class="value">{summary.success_count}</div>
                <div class="label">计算成功 ✓</div>
            </div>
            <div class="card warning">
                <div class="value">{summary.needs_review_count}</div>
                <div class="label">待人工确认 ⚠</div>
            </div>
            <div class="card danger">
                <div class="value">{summary.failed_count}</div>
                <div class="label">计算失败 ✕</div>
            </div>
            <div class="card info">
                <div class="value">{summary.old_portal_count}</div>
                <div class="label">旧口径数据 📜</div>
            </div>
            <div class="card power">
                <div class="value">{summary.total_power_kwh:.2f} kW</div>
                <div class="label">成功记录总功率</div>
            </div>
        </div>
        
        <div class="main-content">
            <div class="panel">
                <h2>📊 功率预测图表</h2>
                <div class="legend">
                    <div class="legend-item">
                        <div class="legend-color" style="background: #10b981;"></div>
                        <span>计算成功</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #f59e0b;"></div>
                        <span>待确认</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #ef4444;"></div>
                        <span>计算失败</span>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="powerChart"></canvas>
                </div>
                <p style="margin-top: 15px; color: #6b7280; font-size: 0.9rem;">
                    💡 点击柱状图可直接跳转到对应明细记录
                </p>
            </div>
            
            <div class="panel">
                <h2>📐 计算公式说明</h2>
                
                <div class="formula-box">
                    <h4>势能法（最常用）</h4>
                    <code>P = ρ × g × H × Q × η / 1000</code>
                    <p style="margin-top: 8px; font-size: 0.9rem; color: #4b5563;">
                        适用于有潮差和流量数据时，置信度约 85%
                    </p>
                </div>
                
                <div class="formula-box">
                    <h4>动能法</h4>
                    <code>P = 0.5 × ρ × A × v³ × η / 1000</code>
                    <p style="margin-top: 8px; font-size: 0.9rem; color: #4b5563;">
                        适用于有流速和过流面积数据时，置信度约 75%
                    </p>
                </div>
                
                <div class="formula-box">
                    <h4>简化估算法</h4>
                    <code>P = ρ × g × H × Q_typical × η / 1000</code>
                    <p style="margin-top: 8px; font-size: 0.9rem; color: #4b5563;">
                        只有潮差数据时凑合算，置信度约 60%
                    </p>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 8px;">
                    <strong>⚠️ 边界值提醒：</strong>
                    <ul style="margin-top: 8px; padding-left: 20px; font-size: 0.9rem;">
                        <li>经济潮差下限: <strong>0.5m</strong>，低于这个数基本不划算</li>
                        <li>常见潮差上限: <strong>15m</strong>，全球最大也就16m左右</li>
                        <li>效率正常范围: <strong>30% - 95%</strong>，超了就要怀疑数据</li>
                    </ul>
                </div>
            </div>
            
            <div class="panel detail-panel">
                <div class="detail-header">
                    <h2>📋 明细数据</h2>
                    <span class="detail-subtitle">点击图表中的柱子可定位到此表中的对应记录</span>
                </div>
                <div class="table-wrapper">
                    <table id="detailTable">
                        <thead>
                            <tr>
                                <th>记录ID</th>
                                <th>测站名称</th>
                                <th>时间</th>
                                <th>预测功率</th>
                                <th>计算方法</th>
                                <th>状态</th>
                                <th>置信度</th>
                                <th>问题</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>潮汐发电功率预测工具 v1.0 | 专为产品同事小岑打造 ❤️</p>
        </div>
    </div>
    
    <div class="issues-popup" id="issuesPopup">
        <div class="popup-content">
            <h3 id="popupTitle">记录详情</h3>
            <div id="popupBody"></div>
            <button class="close-btn" onclick="closePopup()">关闭</button>
        </div>
    </div>
    
    <script>
        const resultsData = {json.dumps(results_data, ensure_ascii=False)};
        const chartData = {json.dumps(chart_data, ensure_ascii=False)};
        
        function getStatusColor(status) {{
            const colors = {{
                'success': '#10b981',
                'needs_review': '#f59e0b',
                'failed': '#ef4444',
                'pending': '#6b7280'
            }};
            return colors[status] || '#6b7280';
        }}
        
        function getStatusIcon(status) {{
            const icons = {{
                'success': '✓',
                'needs_review': '⚠',
                'failed': '✕',
                'pending': '◷'
            }};
            return icons[status] || '?';
        }}
        
        const ctx = document.getElementById('powerChart').getContext('2d');
        const powerChart = new Chart(ctx, {{
            type: 'bar',
            data: {{
                labels: chartData.map(d => d.label),
                datasets: [{{
                    label: '预测功率 (kW)',
                    data: chartData.map(d => d.power),
                    backgroundColor: chartData.map(d => getStatusColor(d.status)),
                    borderColor: chartData.map(d => getStatusColor(d.status)),
                    borderWidth: 1,
                    borderRadius: 4,
                    classNames: 'bar-tooltip'
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                onClick: function(e, elements) {{
                    if (elements.length > 0) {{
                        const index = elements[0].index;
                        const recordId = chartData[index].id;
                        highlightTableRow(recordId);
                        showDetails(recordId);
                        document.getElementById('detailTable').scrollIntoView({{ behavior: 'smooth' }});
                    }}
                }},
                plugins: {{
                    legend: {{
                        display: false
                    }},
                    tooltip: {{
                        callbacks: {{
                            label: function(context) {{
                                const data = chartData[context.dataIndex];
                                return [
                                    `功率: ${{data.power.toFixed(2)}} kW`,
                                    `状态: ${{data.status === 'success' ? '计算成功' : data.status === 'needs_review' ? '待确认' : data.status === 'failed' ? '失败' : '待处理'}}`,
                                    `置信度: ${{data.confidence}}%`
                                ];
                            }}
                        }}
                    }}
                }},
                scales: {{
                    y: {{
                        beginAtZero: true,
                        title: {{
                            display: true,
                            text: '功率 (kW)'
                        }}
                    }}
                }}
            }}
        }});
        
        function populateTable() {{
            const tbody = document.querySelector('#detailTable tbody');
            tbody.innerHTML = '';
            
            resultsData.forEach(r => {{
                const tr = document.createElement('tr');
                tr.id = `row-${{r.record_id}}`;
                tr.innerHTML = `
                    <td><strong>${{r.record_id}}</strong></td>
                    <td>${{r.station_name || '-'}}</td>
                    <td>${{r.timestamp}}</td>
                    <td>${{r.predicted_power ? r.predicted_power.toFixed(2) + ' ' + r.power_unit : '-'}}</td>
                    <td>${{r.calculation_method || '-'}}</td>
                    <td>
                        <span class="status-badge ${{r.status}}">
                            ${{getStatusIcon(r.status)}} ${{r.status_text}}
                        </span>
                    </td>
                    <td>${{r.confidence_score > 0 ? r.confidence_score + '%' : '-'}}</td>
                    <td>
                        ${{r.issues.length > 0 
                            ? `<span style="color: ${{r.issues.some(i => i.level === 'error') ? '#ef4444' : '#f59e0b'}};">${{r.issues.length}} 项</span>`
                            : '-'
                        }}
                    </td>
                    <td>
                        <button class="view-details-btn" onclick="showDetails('${{r.record_id}}')">
                            查看详情
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            }});
        }}
        
        function highlightTableRow(recordId) {{
            document.querySelectorAll('#detailTable tr').forEach(tr => {{
                tr.classList.remove('selected');
            }});
            const row = document.getElementById(`row-${{recordId}}`);
            if (row) {{
                row.classList.add('selected');
            }}
        }}
        
        function showDetails(recordId) {{
            const record = resultsData.find(r => r.record_id === recordId);
            if (!record) return;
            
            const popup = document.getElementById('issuesPopup');
            const title = document.getElementById('popupTitle');
            const body = document.getElementById('popupBody');
            
            title.textContent = `${{record.record_id}} - ${{record.station_name || '未命名测站'}}`;
            
            let html = `
                <p><strong>时间:</strong> ${{record.timestamp}}</p>
                <p><strong>数据来源:</strong> ${{record.data_source === 'old_portal' ? '旧汇总页口径' : '手动录入'}}</p>
                ${{record.predicted_power ? `
                    <p><strong>预测功率:</strong> ${{record.predicted_power.toFixed(2)}} ${{record.power_unit}}</p>
                    <p><strong>计算方法:</strong> ${{record.calculation_method}}</p>
                    <p><strong>置信度:</strong> ${{record.confidence_score}}%</p>
                ` : ''}}
                ${{record.original_notes ? `<p><strong>原始备注:</strong> ${{record.original_notes}}</p>` : ''}}
                ${{record.processing_notes ? `<p><strong>处理备注:</strong> ${{record.processing_notes}}</p>` : ''}}
            `;
            
            if (record.issues.length > 0) {{
                html += '<h4 style="margin-top: 20px; margin-bottom: 10px;">问题列表</h4>';
                record.issues.forEach(issue => {{
                    html += `
                        <div class="issue-item ${{issue.level}}">
                            <div class="issue-field">[${{issue.level === 'error' ? '错误' : '警告'}}] ${{issue.field}}</div>
                            <div class="issue-message">${{issue.message}}</div>
                            ${{issue.suggestion ? `<div class="issue-suggestion">💡 建议: ${{issue.suggestion}}</div>` : ''}}
                        </div>
                    `;
                }});
            }} else {{
                html += '<p style="margin-top: 20px; color: #10b981;">✓ 无问题，数据质量良好</p>';
            }}
            
            body.innerHTML = html;
            popup.classList.add('show');
        }}
        
        function closePopup() {{
            document.getElementById('issuesPopup').classList.remove('show');
        }}
        
        document.getElementById('issuesPopup').addEventListener('click', function(e) {{
            if (e.target === this) {{
                closePopup();
            }}
        }});
        
        populateTable();
    </script>
</body>
</html>
"""

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_template)
