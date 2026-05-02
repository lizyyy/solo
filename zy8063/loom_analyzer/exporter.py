import pandas as pd
from jinja2 import Template
from typing import Dict, Any
from datetime import datetime


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>织机停台时间线</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 20px; border-bottom: 3px solid #4a90d9; padding-bottom: 10px; }
        .summary { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
        .summary-item { display: inline-block; margin-right: 30px; font-size: 16px; }
        .summary-value { font-weight: bold; color: #4a90d9; font-size: 20px; }
        .timeline-container { overflow-x: auto; }
        .timeline { display: flex; flex-direction: column; gap: 10px; min-width: 800px; }
        .machine-row { display: flex; align-items: center; border-bottom: 1px solid #eee; padding: 10px 0; }
        .machine-label { width: 100px; font-weight: bold; color: #333; flex-shrink: 0; }
        .timeline-bar { flex: 1; height: 50px; background: #e9ecef; position: relative; border-radius: 4px; overflow: hidden; }
        .event-block { position: absolute; height: 100%; top: 0; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3); cursor: pointer; transition: transform 0.2s; }
        .event-block:hover { transform: scaleY(1.1); z-index: 10; }
        .cause-断经 { background: #e74c3c; }
        .cause-纬停 { background: #f39c12; }
        .cause-换轴 { background: #9b59b6; }
        .cause-传感器误报 { background: #3498db; }
        .cause-机械 { background: #2c3e50; }
        .cause-其他 { background: #95a5a6; }
        .legend { display: flex; gap: 15px; margin-top: 20px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 8px; }
        .legend-color { width: 20px; height: 20px; border-radius: 3px; }
        .tooltip { position: absolute; background: rgba(0,0,0,0.85); color: white; padding: 10px; border-radius: 4px; font-size: 13px; z-index: 100; pointer-events: none; display: none; }
        .time-axis { height: 30px; margin-left: 100px; position: relative; border-top: 2px solid #ddd; }
        .time-mark { position: absolute; top: 5px; font-size: 12px; color: #666; transform: translateX(-50%); }
    </style>
</head>
<body>
    <div class="container">
        <h1>织机停台时间线</h1>
        <div class="summary">
            <div class="summary-item">总停台次数: <span class="summary-value">{{ summary.total_events }}</span></div>
            <div class="summary-item">总停台时间: <span class="summary-value">{{ summary.total_downtime_min }} 分钟</span></div>
        </div>
        <div class="timeline-container">
            <div class="timeline">
                <div class="time-axis" id="timeAxis"></div>
                {% for machine_id, events in machines.items() %}
                <div class="machine-row">
                    <div class="machine-label">{{ machine_id }}</div>
                    <div class="timeline-bar">
                        {% for event in events %}
                        <div class="event-block cause-{{ event.category }}" 
                             style="left: {{ event.left }}%; width: {{ event.width }}%;"
                             data-tooltip="{{ event.tooltip }}">
                            {{ event.short_label }}
                        </div>
                        {% endfor %}
                    </div>
                </div>
                {% endfor %}
            </div>
        </div>
        <div class="legend">
            <div class="legend-item"><div class="legend-color cause-断经"></div>断经</div>
            <div class="legend-item"><div class="legend-color cause-纬停"></div>纬停</div>
            <div class="legend-item"><div class="legend-color cause-换轴"></div>换轴</div>
            <div class="legend-item"><div class="legend-color cause-传感器误报"></div>传感器误报</div>
            <div class="legend-item"><div class="legend-color cause-机械"></div>机械</div>
            <div class="legend-item"><div class="legend-color cause-其他"></div>其他</div>
        </div>
        <div class="tooltip" id="tooltip"></div>
    </div>
    <script>
        const tooltip = document.getElementById('tooltip');
        const blocks = document.querySelectorAll('.event-block');
        
        blocks.forEach(block => {
            block.addEventListener('mouseenter', (e) => {
                tooltip.textContent = block.dataset.tooltip;
                tooltip.style.display = 'block';
                updateTooltipPosition(e);
            });
            
            block.addEventListener('mousemove', updateTooltipPosition);
            
            block.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });
        
        function updateTooltipPosition(e) {
            tooltip.style.left = e.pageX + 10 + 'px';
            tooltip.style.top = e.pageY - 30 + 'px';
        }
        
        function renderTimeAxis() {
            const axis = document.getElementById('timeAxis');
            const startTime = new Date('{{ start_time }}');
            const endTime = new Date('{{ end_time }}');
            const totalDuration = endTime - startTime;
            
            for (let i = 0; i <= 8; i++) {
                const mark = document.createElement('div');
                mark.className = 'time-mark';
                const time = new Date(startTime.getTime() + (totalDuration * i / 8));
                mark.textContent = time.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                mark.style.left = (i * 12.5) + '%';
                axis.appendChild(mark);
            }
        }
        renderTimeAxis();
    </script>
</body>
</html>
"""


def export_downtime_summary(df: pd.DataFrame, output_path: str):
    df.to_csv(output_path, index=False, encoding='utf-8-sig')


def export_root_cause_report(stats: Dict[str, Any], output_path: str):
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# 织机停台根因分析报告\n\n")
        f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## 总览\n\n")
        f.write(f"- 总停台次数: {stats['total_events']}\n")
        f.write(f"- 总停台时间: {stats['total_downtime_min']} 分钟\n\n")
        
        f.write("## 按织机统计\n\n")
        f.write("| 织机ID | 总停台时间(分钟) | 停台次数 |\n")
        f.write("|--------|-----------------|---------|\n")
        for machine_id, data in stats['by_machine'].items():
            f.write(f"| {machine_id} | {data['total_downtime_min']} | {data['event_count']} |\n")
        f.write("\n")
        
        f.write("## 按根因统计\n\n")
        f.write("| 根因分类 | 具体原因 | 总停台时间(分钟) | 停台次数 |\n")
        f.write("|---------|---------|-----------------|---------|\n")
        for (category, cause), data in stats['by_cause'].items():
            f.write(f"| {category} | {cause} | {data['total_downtime_min']} | {data['event_count']} |\n")
        f.write("\n")
        
        f.write("## 按班次统计\n\n")
        f.write("| 日期 | 班次 | 总停台时间(分钟) | 停台次数 |\n")
        f.write("|------|------|-----------------|---------|\n")
        for (date, shift), data in stats['by_shift'].items():
            f.write(f"| {date} | {shift} | {data['total_downtime_min']} | {data['event_count']} |\n")


def export_machine_timeline(events_df: pd.DataFrame, output_path: str):
    if events_df.empty:
        return
    
    all_times = pd.concat([events_df['start_time'], events_df['end_time']])
    min_time = all_times.min()
    max_time = all_times.max()
    total_duration = (max_time - min_time).total_seconds()
    
    machines = {}
    for machine_id in events_df['machine_id'].unique():
        machine_events = events_df[events_df['machine_id'] == machine_id].sort_values('start_time')
        events_list = []
        
        for _, event in machine_events.iterrows():
            start_sec = (event['start_time'] - min_time).total_seconds()
            end_sec = (event['end_time'] - min_time).total_seconds()
            
            left = (start_sec / total_duration) * 100
            width = ((end_sec - start_sec) / total_duration) * 100
            width = max(width, 0.5)
            
            category = event.get('root_cause_category', '其他')
            cause = event.get('root_cause', '其他原因')
            duration = round(event['duration_minutes'], 1)
            
            tooltip = f"{machine_id} | {category} | {cause}\n"
            tooltip += f"开始: {event['start_time'].strftime('%H:%M')}\n"
            tooltip += f"结束: {event['end_time'].strftime('%H:%M')}\n"
            tooltip += f"持续: {duration} 分钟"
            
            short_label = f"{duration}m"
            
            events_list.append({
                'left': left,
                'width': width,
                'category': category,
                'tooltip': tooltip,
                'short_label': short_label
            })
        
        machines[machine_id] = events_list
    
    summary = {
        'total_events': len(events_df),
        'total_downtime_min': round(events_df['duration_minutes'].sum(), 2)
    }
    
    template = Template(HTML_TEMPLATE)
    html_content = template.render(
        machines=machines,
        summary=summary,
        start_time=min_time.isoformat(),
        end_time=max_time.isoformat()
    )
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
