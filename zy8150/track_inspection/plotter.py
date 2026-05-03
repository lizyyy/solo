from typing import Dict, List, Any
from datetime import datetime

from .models import SampledPoint, DefectSegment


def indicator_name(indicator: str) -> str:
    """指标中文名称映射"""
    names = {
        'track_gauge': '轨距',
        'level': '水平',
        'alignment': '轨向',
        'profile': '高低'
    }
    return names.get(indicator, indicator)


def generate_track_chart(
    sampled_points: List[SampledPoint],
    defects: List[DefectSegment],
    sections: List[Any],
    output_path: str
):
    """
    生成交互式HTML里程图
    
    图表内容:
    1. 轨距、水平、轨向、高低四个指标随里程变化的曲线
    2. 用不同颜色标记病害段位置
    3. 用背景色区分直线段和曲线段
    """
    mileages = [p.mileage for p in sampled_points]
    track_gauges = [p.track_gauge for p in sampled_points]
    levels = [p.level for p in sampled_points]
    alignments = [p.alignment for p in sampled_points]
    profiles = [p.profile for p in sampled_points]
    
    json_mileages = '[' + ','.join(f'{m:.3f}' for m in mileages) + ']'
    json_track_gauge = '[' + ','.join(f'{v:.3f}' for v in track_gauges) + ']'
    json_level = '[' + ','.join(f'{v:.3f}' for v in levels) + ']'
    json_alignment = '[' + ','.join(f'{v:.3f}' for v in alignments) + ']'
    json_profile = '[' + ','.join(f'{v:.3f}' for v in profiles) + ']'
    
    defect_segments_json = []
    for defect in defects:
        color = {
            '紧急': '#ff4444',
            '高': '#ff8800',
            '中': '#ffcc00',
            '低': '#88ccff'
        }.get(defect.priority, '#888888')
        
        defect_segments_json.append(f"""
            {{
                start: {defect.start_mileage},
                end: {defect.end_mileage},
                priority: '{defect.priority}',
                level: '{defect.level}',
                score: {defect.total_score},
                color: '{color}',
                indicators: [{', '.join(f"'{indicator_name(i)}'" for i in defect.indicators)}]
            }}
        """)
    
    json_defects = '[' + ','.join(defect_segments_json) + ']'
    
    section_ranges_json = []
    for section in sections:
        color = '#e8f5e8' if section.section_type == 'straight' else '#fff3e0'
        section_ranges_json.append(f"""
            {{
                start: {section.start_km},
                end: {section.end_km},
                type: '{section.section_type}',
                color: '{color}'
            }}
        """)
    
    json_sections = '[' + ','.join(section_ranges_json) + ']'
    
    html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>轨检车数据里程图</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        h1 {{
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }}
        .chart-container {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .chart-wrapper {{
            position: relative;
            height: 300px;
            margin-bottom: 20px;
        }}
        .legend {{
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 15px;
            flex-wrap: wrap;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }}
        .legend-color {{
            width: 20px;
            height: 12px;
            border-radius: 3px;
        }}
        .stats-panel {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }}
        .stat-item {{
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
        }}
        .stat-value {{
            font-size: 28px;
            font-weight: bold;
            color: #2c3e50;
        }}
        .stat-label {{
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }}
        .defects-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }}
        .defects-table th,
        .defects-table td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }}
        .defects-table th {{
            background-color: #f8f9fa;
            font-weight: 600;
            color: #333;
        }}
        .defects-table tr:hover {{
            background-color: #f5f5f5;
        }}
        .priority-紧急 {{ background-color: #ffebee; }}
        .priority-高 {{ background-color: #fff3e0; }}
        .priority-中 {{ background-color: #fffde7; }}
        .priority-低 {{ background-color: #e3f2fd; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>轨检车数据里程图</h1>
        
        <div class="stats-panel">
            <h3>检测基本信息</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">{len(sampled_points)}</div>
                    <div class="stat-label">采样点数</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{mileages[-1] - mileages[0]:.2f}km</div>
                    <div class="stat-label">检测里程</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{len(defects)}</div>
                    <div class="stat-label">病害段数</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{datetime.now().strftime('%Y-%m-%d')}</div>
                    <div class="stat-label">分析日期</div>
                </div>
            </div>
        </div>
        
        <div class="chart-container">
            <h3>轨距 (mm)</h3>
            <div class="chart-wrapper">
                <canvas id="gaugeChart"></canvas>
            </div>
        </div>
        
        <div class="chart-container">
            <h3>水平 (mm)</h3>
            <div class="chart-wrapper">
                <canvas id="levelChart"></canvas>
            </div>
        </div>
        
        <div class="chart-container">
            <h3>轨向 (mm)</h3>
            <div class="chart-wrapper">
                <canvas id="alignmentChart"></canvas>
            </div>
        </div>
        
        <div class="chart-container">
            <h3>高低 (mm)</h3>
            <div class="chart-wrapper">
                <canvas id="profileChart"></canvas>
            </div>
        </div>
        
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: #e8f5e8;"></div>
                <span>直线段</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #fff3e0;"></div>
                <span>曲线段</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ff4444;"></div>
                <span>紧急病害</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ff8800;"></div>
                <span>高优先级</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #ffcc00;"></div>
                <span>中优先级</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #88ccff;"></div>
                <span>低优先级</span>
            </div>
        </div>
        
        <div class="stats-panel">
            <h3>病害段详情</h3>
            <table class="defects-table">
                <thead>
                    <tr>
                        <th>优先级</th>
                        <th>等级</th>
                        <th>起始里程(km)</th>
                        <th>结束里程(km)</th>
                        <th>长度(m)</th>
                        <th>涉及指标</th>
                        <th>总扣分</th>
                    </tr>
                </thead>
                <tbody>
"""
    
    for defect in defects:
        indicator_names = [indicator_name(i) for i in defect.indicators]
        html_content += f"""
                    <tr class="priority-{defect.priority}">
                        <td><strong>{defect.priority}</strong></td>
                        <td>{defect.level}</td>
                        <td>{defect.start_mileage:.3f}</td>
                        <td>{defect.end_mileage:.3f}</td>
                        <td>{defect.length * 1000:.1f}</td>
                        <td>{', '.join(indicator_names)}</td>
                        <td>{defect.total_score}</td>
                    </tr>
"""
    
    if not defects:
        html_content += """
                    <tr>
                        <td colspan="7" style="text-align: center; color: #666;">
                            无超限病害段
                        </td>
                    </tr>
"""
    
    html_content += f"""
                </tbody>
            </table>
        </div>
    </div>
    
    <script>
        const mileages = {json_mileages};
        const defects = {json_defects};
        const sections = {json_sections};
        
        function createAnnotations() {{
            const annotations = {{}};
            
            sections.forEach((section, idx) => {{
                annotations['section_' + idx] = {{
                    type: 'box',
                    xMin: section.start,
                    xMax: section.end,
                    backgroundColor: section.color,
                    borderWidth: 0
                }};
            }});
            
            defects.forEach((defect, idx) => {{
                annotations['defect_' + idx] = {{
                    type: 'box',
                    xMin: defect.start,
                    xMax: defect.end,
                    backgroundColor: defect.color,
                    opacity: 0.3,
                    borderWidth: 2,
                    borderColor: defect.color,
                    drawTime: 'beforeDatasetsDraw'
                }};
            }});
            
            return annotations;
        }}
        
        const commonOptions = {{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {{
                annotation: {{
                    annotations: createAnnotations()
                }},
                tooltip: {{
                    mode: 'index',
                    intersect: false,
                    callbacks: {{
                        title: function(items) {{
                            return '里程: ' + items[0].label + ' km';
                        }}
                    }}
                }}
            }},
            scales: {{
                x: {{
                    title: {{
                        display: true,
                        text: '里程 (km)'
                    }},
                    ticks: {{
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10
                    }}
                }},
                y: {{
                    title: {{
                        display: true,
                        text: '值 (mm)'
                    }}
                }}
            }},
            interaction: {{
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }}
        }};
        
        new Chart(document.getElementById('gaugeChart'), {{
            type: 'line',
            data: {{
                labels: mileages.map(m => m.toFixed(3)),
                datasets: [{{
                    label: '轨距',
                    data: {json_track_gauge},
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }}]
            }},
            options: {{
                ...commonOptions,
                plugins: {{
                    ...commonOptions.plugins,
                    annotation: createAnnotations()
                }}
            }}
        }});
        
        new Chart(document.getElementById('levelChart'), {{
            type: 'line',
            data: {{
                labels: mileages.map(m => m.toFixed(3)),
                datasets: [{{
                    label: '水平',
                    data: {json_level},
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }}]
            }},
            options: {{
                ...commonOptions,
                plugins: {{
                    ...commonOptions.plugins,
                    annotation: createAnnotations()
                }}
            }}
        }});
        
        new Chart(document.getElementById('alignmentChart'), {{
            type: 'line',
            data: {{
                labels: mileages.map(m => m.toFixed(3)),
                datasets: [{{
                    label: '轨向',
                    data: {json_alignment},
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }}]
            }},
            options: {{
                ...commonOptions,
                plugins: {{
                    ...commonOptions.plugins,
                    annotation: createAnnotations()
                }}
            }}
        }});
        
        new Chart(document.getElementById('profileChart'), {{
            type: 'line',
            data: {{
                labels: mileages.map(m => m.toFixed(3)),
                datasets: [{{
                    label: '高低',
                    data: {json_profile},
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }}]
            }},
            options: {{
                ...commonOptions,
                plugins: {{
                    ...commonOptions.plugins,
                    annotation: createAnnotations()
                }}
            }}
        }});
    </script>
</body>
</html>
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
