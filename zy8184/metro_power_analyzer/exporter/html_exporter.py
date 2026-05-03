from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from metro_power_analyzer.rules.event_chain import Event, EventType
from metro_power_analyzer.rules.evaluator import EvaluationResult, ProtectionStatus


def export_timeline_html(file_path: str,
                         events: List[Event],
                         evaluation_results: List[EvaluationResult] = None,
                         sampling_data: Dict[str, Any] = None) -> None:
    """
    导出时间线到HTML文件
    """
    results_map = {}
    if evaluation_results:
        for result in evaluation_results:
            results_map[result.event_id] = result
    
    events_json = _events_to_json(events, results_map)
    sampling_json = _sampling_to_json(sampling_data) if sampling_data else "null"
    
    html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>保护动作事件时间线</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        
        .header {{
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }}
        
        .header h1 {{
            color: #1a1a2e;
            font-size: 28px;
            margin-bottom: 8px;
        }}
        
        .header .subtitle {{
            color: #666;
            font-size: 14px;
        }}
        
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        
        .stat-card {{
            background: rgba(255, 255, 255, 0.95);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }}
        
        .stat-card .value {{
            font-size: 32px;
            font-weight: bold;
            color: #1a1a2e;
        }}
        
        .stat-card .label {{
            font-size: 14px;
            color: #666;
            margin-top: 4px;
        }}
        
        .stat-card.compliant .value {{ color: #10b981; }}
        .stat-card.non-compliant .value {{ color: #ef4444; }}
        .stat-card.warning .value {{ color: #f59e0b; }}
        
        .timeline-container {{
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }}
        
        .timeline-title {{
            font-size: 20px;
            color: #1a1a2e;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #e5e7eb;
        }}
        
        .timeline {{
            position: relative;
            padding-left: 40px;
        }}
        
        .timeline::before {{
            content: '';
            position: absolute;
            left: 15px;
            top: 0;
            bottom: 0;
            width: 4px;
            background: linear-gradient(to bottom, #667eea, #764ba2);
            border-radius: 2px;
        }}
        
        .timeline-item {{
            position: relative;
            margin-bottom: 24px;
            padding: 16px 20px;
            background: #f9fafb;
            border-radius: 12px;
            border-left: 4px solid #667eea;
            transition: all 0.3s ease;
        }}
        
        .timeline-item:hover {{
            transform: translateX(8px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }}
        
        .timeline-item::before {{
            content: '';
            position: absolute;
            left: -33px;
            top: 24px;
            width: 16px;
            height: 16px;
            background: #667eea;
            border-radius: 50%;
            border: 3px solid #fff;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.5);
        }}
        
        .timeline-item.compliant {{
            border-left-color: #10b981;
        }}
        
        .timeline-item.compliant::before {{
            background: #10b981;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.5);
        }}
        
        .timeline-item.non-compliant {{
            border-left-color: #ef4444;
            background: #fef2f2;
        }}
        
        .timeline-item.non-compliant::before {{
            background: #ef4444;
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.5);
        }}
        
        .timeline-item.warning {{
            border-left-color: #f59e0b;
            background: #fffbeb;
        }}
        
        .timeline-item.warning::before {{
            background: #f59e0b;
            box-shadow: 0 2px 8px rgba(245, 158, 11, 0.5);
        }}
        
        .timeline-item.out-of-order {{
            border-style: dashed;
        }}
        
        .event-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
        }}
        
        .event-time {{
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 14px;
            color: #667eea;
            background: rgba(102, 126, 234, 0.1);
            padding: 4px 12px;
            border-radius: 20px;
        }}
        
        .event-type-badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }}
        
        .badge-start {{ background: #dbeafe; color: #1d4ed8; }}
        .badge-action {{ background: #fce7f3; color: #be185d; }}
        .badge-trip {{ background: #fee2e2; color: #b91c1c; }}
        .badge-return {{ background: #dcfce7; color: #15803d; }}
        .badge-bus-tie {{ background: #fef3c7; color: #b45309; }}
        .badge-unknown {{ background: #f3f4f6; color: #6b7280; }}
        
        .event-content {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
        }}
        
        .event-field {{
            background: #fff;
            padding: 12px;
            border-radius: 8px;
        }}
        
        .event-field-label {{
            font-size: 12px;
            color: #9ca3af;
            margin-bottom: 4px;
        }}
        
        .event-field-value {{
            font-size: 15px;
            font-weight: 600;
            color: #1a1a2e;
        }}
        
        .event-status {{
            margin-top: 12px;
            padding: 12px;
            background: #fff;
            border-radius: 8px;
        }}
        
        .status-icon {{
            display: inline-block;
            width: 20px;
            height: 20px;
            text-align: center;
            line-height: 20px;
            border-radius: 50%;
            margin-right: 8px;
            font-weight: bold;
        }}
        
        .status-compliant {{ background: #d1fae5; color: #065f46; }}
        .status-non-compliant {{ background: #fee2e2; color: #7f1d1d; }}
        .status-warning {{ background: #fef3c7; color: #78350f; }}
        
        .sampling-chart {{
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }}
        
        .no-data {{
            text-align: center;
            padding: 60px 20px;
            color: #9ca3af;
            font-size: 16px;
        }}
        
        .footer {{
            text-align: center;
            color: rgba(255, 255, 255, 0.8);
            font-size: 14px;
            padding: 20px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ 保护动作事件时间线</h1>
            <div class="subtitle">牵引变电所跳闸事件分析 · 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
        </div>
        
        <div class="stats" id="stats-container">
        </div>
        
        <div class="timeline-container">
            <h2 class="timeline-title">📊 事件时间线</h2>
            <div class="timeline" id="timeline-content">
            </div>
        </div>
        
        <div class="sampling-chart" id="sampling-container" style="display: none;">
            <h2 class="timeline-title">📈 录波采样数据</h2>
            <div id="sampling-content">
            </div>
        </div>
        
        <div class="footer">
            Metro Power Analyzer v1.0.0
        </div>
    </div>
    
    <script>
        const eventsData = {events_json};
        const samplingData = {sampling_json};
        
        function initStats() {{
            const container = document.getElementById('stats-container');
            
            let total = eventsData.length;
            let compliant = 0;
            let nonCompliant = 0;
            let warning = 0;
            
            eventsData.forEach(event => {{
                if (event.evaluationStatus === 'compliant') {{
                    compliant++;
                }} else if (event.evaluationStatus === 'non_compliant') {{
                    nonCompliant++;
                }} else if (event.evaluationStatus === 'no_setting' || event.evaluationStatus === 'uncertain') {{
                    warning++;
                }}
            }});
            
            container.innerHTML = `
                <div class="stat-card">
                    <div class="value">${{total}}</div>
                    <div class="label">事件总数</div>
                </div>
                <div class="stat-card compliant">
                    <div class="value">${{compliant}}</div>
                    <div class="label">符合定值</div>
                </div>
                <div class="stat-card non-compliant">
                    <div class="value">${{nonCompliant}}</div>
                    <div class="label">不符合定值</div>
                </div>
                <div class="stat-card warning">
                    <div class="value">${{warning}}</div>
                    <div class="label">需关注</div>
                </div>
            `;
        }}
        
        function getBadgeClass(eventType) {{
            const mapping = {{
                '保护启动': 'badge-start',
                '保护动作': 'badge-action',
                '断路器跳闸': 'badge-trip',
                '母联联跳': 'badge-bus-tie',
                '保护返回': 'badge-return',
            }};
            return mapping[eventType] || 'badge-unknown';
        }}
        
        function getTimelineClass(evaluationStatus, isOutOfOrder) {{
            let classes = 'timeline-item';
            
            if (evaluationStatus === 'compliant') {{
                classes += ' compliant';
            }} else if (evaluationStatus === 'non_compliant') {{
                classes += ' non-compliant';
            }} else if (evaluationStatus === 'no_setting' || evaluationStatus === 'uncertain') {{
                classes += ' warning';
            }}
            
            if (isOutOfOrder) {{
                classes += ' out-of-order';
            }}
            
            return classes;
        }}
        
        function getStatusIcon(evaluationStatus) {{
            if (evaluationStatus === 'compliant') {{
                return '<span class="status-icon status-compliant">✓</span>符合定值';
            }} else if (evaluationStatus === 'non_compliant') {{
                return '<span class="status-icon status-non-compliant">✗</span>不符合定值';
            }} else if (evaluationStatus === 'no_setting') {{
                return '<span class="status-icon status-warning">?</span>无对应定值';
            }} else {{
                return '<span class="status-icon status-warning">?</span>待确认';
            }}
        }}
        
        function initTimeline() {{
            const container = document.getElementById('timeline-content');
            
            if (eventsData.length === 0) {{
                container.innerHTML = '<div class="no-data">暂无事件数据</div>';
                return;
            }}
            
            let html = '';
            
            eventsData.forEach((event, index) => {{
                const timelineClass = getTimelineClass(event.evaluationStatus, event.isOutOfOrder);
                const badgeClass = getBadgeClass(event.eventType);
                const outOfOrderBadge = event.isOutOfOrder ? 
                    '<span style="color: #ef4444; margin-left: 8px;">⚠ 乱序</span>' : '';
                
                html += `
                    <div class="${{timelineClass}}">
                        <div class="event-header">
                            <div>
                                <span class="event-type-badge ${{badgeClass}}">${{event.eventType}}</span>
                                ${{outOfOrderBadge}}
                            </div>
                            <span class="event-time">${{event.time}}</span>
                        </div>
                        
                        <div class="event-content">
                            <div class="event-field">
                                <div class="event-field-label">装置名称</div>
                                <div class="event-field-value">${{event.deviceName || '-'}}</div>
                            </div>
                            <div class="event-field">
                                <div class="event-field-label">相别</div>
                                <div class="event-field-value">${{event.phase || '-'}}</div>
                            </div>
                            <div class="event-field">
                                <div class="event-field-label">动作值</div>
                                <div class="event-field-value">${{event.actionValue}}</div>
                            </div>
                            <div class="event-field">
                                <div class="event-field-label">定值</div>
                                <div class="event-field-value">${{event.settingValue}}</div>
                            </div>
                        </div>
                        
                        <div class="event-status">
                            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                ${{getStatusIcon(event.evaluationStatus)}}
                            </div>
                            ${{event.evaluationDetails ? `<div style="color: #666; font-size: 14px;">${{event.evaluationDetails}}</div>` : ''}}
                            ${{event.notes ? `<div style="color: #666; font-size: 14px; margin-top: 4px;">备注: ${{event.notes}}</div>` : ''}}
                        </div>
                    </div>
                `;
            }});
            
            container.innerHTML = html;
        }}
        
        function initSampling() {{
            if (!samplingData || !samplingData.metadata) {{
                return;
            }}
            
            const container = document.getElementById('sampling-container');
            const content = document.getElementById('sampling-content');
            
            container.style.display = 'block';
            
            const metadata = samplingData.metadata;
            const gaps = metadata.gaps || [];
            
            let html = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">采样点数</div>
                        <div style="font-size: 24px; font-weight: bold; color: #1a1a2e;">${{metadata.sampleCount}}</div>
                    </div>
                    <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">通道数</div>
                        <div style="font-size: 24px; font-weight: bold; color: #1a1a2e;">${{metadata.channels ? metadata.channels.length : 0}}</div>
                    </div>
                    <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">采样缺口</div>
                        <div style="font-size: 24px; font-weight: bold; color: ${{gaps.length > 0 ? '#ef4444' : '#10b981'}};">${{gaps.length}}</div>
                    </div>
                </div>
                
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px;">
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">通道列表</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${{(metadata.channels || []).map(ch => 
                            `<span style="background: #667eea; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${{ch}}</span>`
                        ).join('')}}
                    </div>
                </div>
            `;
            
            if (gaps.length > 0) {{
                html += `
                    <div style="margin-top: 16px; background: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <div style="font-size: 14px; font-weight: 600; color: #991b1b; margin-bottom: 8px;">
                            ⚠️ 采样缺口警告
                        </div>
                        <div style="color: #666; font-size: 13px;">
                            检测到 ${{gaps.length}} 个采样缺口，可能影响分析准确性。
                        </div>
                    </div>
                `;
            }}
            
            content.innerHTML = html;
        }}
        
        initStats();
        initTimeline();
        initSampling();
    </script>
</body>
</html>
"""
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(html_content)


def _events_to_json(events: List[Event], results_map: Dict[str, EvaluationResult]) -> str:
    """将事件转换为JSON格式字符串"""
    import json
    
    event_list = []
    
    for event in events:
        result = results_map.get(event.id)
        
        evaluation_status = 'unknown'
        evaluation_details = ''
        
        if result:
            if result.status.value == '符合定值':
                evaluation_status = 'compliant'
            elif result.status.value == '不符合定值':
                evaluation_status = 'non_compliant'
            elif result.status.value == '无对应定值':
                evaluation_status = 'no_setting'
            elif result.status.value == '无法判断':
                evaluation_status = 'uncertain'
            
            evaluation_details = result.details
        
        event_dict = {
            'id': event.id,
            'time': event.timestamp.strftime('%H:%M:%S.%f')[:-3] if event.timestamp else '',
            'fullTime': event.timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3] if event.timestamp else '',
            'eventType': event.event_type.value if event.event_type else '未知',
            'deviceName': event.device_name,
            'phase': event.phase,
            'actionValue': event.action_value,
            'settingValue': event.setting_value,
            'isOutOfOrder': event.out_of_order,
            'notes': event.notes,
            'evaluationStatus': evaluation_status,
            'evaluationDetails': evaluation_details,
        }
        
        event_list.append(event_dict)
    
    return json.dumps(event_list, ensure_ascii=False)


def _sampling_to_json(sampling_data: Dict[str, Any]) -> str:
    """将采样数据转换为JSON格式字符串"""
    import json
    
    metadata = sampling_data.get('metadata', {})
    
    sampling_dict = {
        'metadata': {
            'sampleCount': metadata.get('sample_count', 0),
            'channels': metadata.get('channels', []),
            'gaps': [{
                'gapMs': g.get('gap_ms', 0),
                'expectedMs': g.get('expected_ms', 0),
            } for g in metadata.get('gaps', [])],
        }
    }
    
    return json.dumps(sampling_dict, ensure_ascii=False)
