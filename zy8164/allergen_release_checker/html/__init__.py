import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List

from ..timeline import ProductionTimeline


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>产线时间线 - 过敏原清线放行复核</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f7fa;
            color: #333;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        
        header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        header .subtitle {
            opacity: 0.9;
            font-size: 14px;
        }
        
        .controls {
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
        }
        
        .control-group {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            align-items: center;
        }
        
        .control-group label {
            font-weight: 600;
            color: #555;
        }
        
        .control-group select,
        .control-group input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }
        
        .legend {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 4px;
        }
        
        .timeline-container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
        }
        
        .timeline-header {
            display: grid;
            grid-template-columns: 150px 1fr;
            background: #f8f9fa;
            border-bottom: 2px solid #e9ecef;
            font-weight: 600;
        }
        
        .timeline-header-cell {
            padding: 15px 20px;
            border-right: 1px solid #e9ecef;
        }
        
        .timeline-header-cell:last-child {
            border-right: none;
        }
        
        .timeline-row {
            display: grid;
            grid-template-columns: 150px 1fr;
            border-bottom: 1px solid #eee;
        }
        
        .timeline-row:hover {
            background-color: #fafbfc;
        }
        
        .timeline-label {
            padding: 20px;
            font-weight: 600;
            border-right: 1px solid #eee;
            display: flex;
            align-items: center;
            background: #fafbfc;
        }
        
        .timeline-track {
            position: relative;
            padding: 20px;
            min-height: 60px;
            overflow-x: auto;
        }
        
        .track-bg {
            position: relative;
            height: 40px;
            background: linear-gradient(90deg, #f0f4f8 0%, #f0f4f8 100%);
            border-radius: 8px;
            overflow: visible;
        }
        
        .midnight-line {
            position: absolute;
            top: -10px;
            bottom: -10px;
            width: 2px;
            background: repeating-linear-gradient(
                45deg,
                #ff6b6b,
                #ff6b6b 5px,
                transparent 5px,
                transparent 10px
            );
            z-index: 5;
        }
        
        .midnight-label {
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff6b6b;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
        }
        
        .batch-block {
            position: absolute;
            top: 5px;
            height: 30px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            color: white;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            z-index: 10;
            overflow: hidden;
        }
        
        .batch-block:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 20;
        }
        
        .batch-block.allergen-free {
            background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);
        }
        
        .batch-block.with-allergen {
            background: linear-gradient(135deg, #ffd43b 0%, #fab005 100%);
            color: #333;
        }
        
        .batch-block.high-risk {
            background: linear-gradient(135deg, #ff6b6b 0%, #f03e3e 100%);
        }
        
        .batch-block.conflict {
            background: linear-gradient(135deg, #845ef7 0%, #7048e8 100%);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .cleaning-marker {
            position: absolute;
            top: -15px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #339af0;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            z-index: 15;
            cursor: pointer;
        }
        
        .cleaning-marker::after {
            content: '';
            position: absolute;
            top: 12px;
            left: 5px;
            width: 2px;
            height: 25px;
            background: #339af0;
        }
        
        .cleaning-marker.pass {
            background: #51cf66;
        }
        
        .cleaning-marker.pass::after {
            background: #51cf66;
        }
        
        .cleaning-marker.fail {
            background: #ff6b6b;
        }
        
        .cleaning-marker.fail::after {
            background: #ff6b6b;
        }
        
        .time-marker {
            position: absolute;
            top: 45px;
            font-size: 10px;
            color: #888;
            transform: translateX(-50%);
            white-space: nowrap;
        }
        
        .tooltip {
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            max-width: 300px;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
        }
        
        .tooltip.visible {
            opacity: 1;
        }
        
        .tooltip-title {
            font-weight: 600;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .tooltip-row {
            margin: 4px 0;
        }
        
        .tooltip-label {
            color: #aaa;
        }
        
        .summary {
            background: white;
            border-radius: 12px;
            padding: 25px;
            margin-top: 30px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
        }
        
        .summary h3 {
            margin-bottom: 20px;
            color: #333;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        
        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        
        .summary-card .value {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .summary-card .label {
            color: #666;
            font-size: 14px;
        }
        
        .summary-card.pass .value { color: #51cf66; }
        .summary-card.warning .value { color: #fab005; }
        .summary-card.fail .value { color: #ff6b6b; }
        .summary-card.info .value { color: #339af0; }
        
        .risks-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .risks-table th,
        .risks-table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        
        .risks-table th {
            background: #f8f9fa;
            font-weight: 600;
        }
        
        .risks-table tr:hover {
            background: #fafbfc;
        }
        
        .risk-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .risk-badge.critical { background: #ff6b6b; color: white; }
        .risk-badge.high { background: #fab005; color: #333; }
        .risk-badge.medium { background: #4dabf7; color: white; }
        .risk-badge.low { background: #69db7c; color: white; }
        
        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🗓️ 产线时间线可视化</h1>
            <div class="subtitle">过敏原清线放行复核系统 | 生成时间: {{generation_time}}</div>
        </header>
        
        <div class="controls">
            <div class="control-group">
                <label>选择产线:</label>
                <select id="lineSelector">
                    <option value="all">所有产线</option>
                    {{line_options}}
                </select>
                <label>时间范围:</label>
                <input type="datetime-local" id="startTime">
                <span>至</span>
                <input type="datetime-local" id="endTime">
            </div>
            
            <div class="legend">
                <div class="legend-item">
                    <div class="legend-color" style="background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);"></div>
                    <span>无过敏原批次</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: linear-gradient(135deg, #ffd43b 0%, #fab005 100%);"></div>
                    <span>含过敏原批次</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: linear-gradient(135deg, #ff6b6b 0%, #f03e3e 100%);"></div>
                    <span>高风险过敏原</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: linear-gradient(135deg, #845ef7 0%, #7048e8 100%);"></div>
                    <span>设备冲突</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #51cf66; border-radius: 50%;"></div>
                    <span>清洁验证通过</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ff6b6b; border-radius: 50%;"></div>
                    <span>清洁验证失败</span>
                </div>
            </div>
        </div>
        
        <div class="timeline-container">
            <div class="timeline-header">
                <div class="timeline-header-cell">产线</div>
                <div class="timeline-header-cell">时间线</div>
            </div>
            <div id="timelineBody">
                {{timeline_rows}}
            </div>
        </div>
        
        <div class="summary">
            <h3>📊 执行摘要</h3>
            <div class="summary-grid">
                <div class="summary-card pass">
                    <div class="value">{{summary.total_batches}}</div>
                    <div class="label">总批次数</div>
                </div>
                <div class="summary-card info">
                    <div class="value">{{summary.total_transitions}}</div>
                    <div class="label">换产次数</div>
                </div>
                <div class="summary-card warning">
                    <div class="value">{{summary.midnight_transitions}}</div>
                    <div class="label">跨午夜批次</div>
                </div>
                <div class="summary-card fail">
                    <div class="value">{{summary.equipment_conflicts}}</div>
                    <div class="label">设备冲突</div>
                </div>
            </div>
            
            {{risks_table}}
        </div>
    </div>
    
    <div class="tooltip" id="tooltip"></div>
    
    <script>
        const timelineData = {{timeline_data}};
        const risksData = {{risks_data}};
        
        document.addEventListener('DOMContentLoaded', function() {
            const tooltip = document.getElementById('tooltip');
            const lineSelector = document.getElementById('lineSelector');
            const startTimeInput = document.getElementById('startTime');
            const endTimeInput = document.getElementById('endTime');
            
            const allTimes = [];
            timelineData.lines.forEach(line => {
                line.batches.forEach(batch => {
                    allTimes.push(new Date(batch.start_time));
                    allTimes.push(new Date(batch.end_time));
                });
            });
            
            if (allTimes.length > 0) {
                const minTime = new Date(Math.min(...allTimes));
                const maxTime = new Date(Math.max(...allTimes));
                
                minTime.setHours(minTime.getHours() - 1);
                maxTime.setHours(maxTime.getHours() + 1);
                
                startTimeInput.value = formatDateTimeLocal(minTime);
                endTimeInput.value = formatDateTimeLocal(maxTime);
            }
            
            lineSelector.addEventListener('change', renderTimeline);
            startTimeInput.addEventListener('change', renderTimeline);
            endTimeInput.addEventListener('change', renderTimeline);
            
            renderTimeline();
            
            document.addEventListener('mousemove', function(e) {
                tooltip.style.left = (e.clientX + 15) + 'px';
                tooltip.style.top = (e.clientY + 15) + 'px';
            });
        });
        
        function formatDateTimeLocal(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        
        function renderTimeline() {
            const lineSelector = document.getElementById('lineSelector');
            const startTimeInput = document.getElementById('startTime');
            const endTimeInput = document.getElementById('endTime');
            const timelineBody = document.getElementById('timelineBody');
            
            const selectedLine = lineSelector.value;
            const startTime = new Date(startTimeInput.value);
            const endTime = new Date(endTimeInput.value);
            
            let html = '';
            
            timelineData.lines.forEach(line => {
                if (selectedLine !== 'all' && line.name !== selectedLine) {
                    return;
                }
                
                const visibleBatches = line.batches.filter(batch => {
                    const batchStart = new Date(batch.start_time);
                    const batchEnd = new Date(batch.end_time);
                    return !(batchEnd < startTime || batchStart > endTime);
                });
                
                html += '<div class="timeline-row">';
                html += `<div class="timeline-label">${line.name}</div>`;
                html += '<div class="timeline-track">';
                html += '<div class="track-bg">';
                
                const totalDuration = (endTime - startTime) / 1000;
                
                const dayStart = new Date(startTime);
                dayStart.setHours(24, 0, 0, 0);
                while (dayStart < endTime) {
                    if (dayStart > startTime) {
                        const pos = ((dayStart - startTime) / 1000 / totalDuration) * 100;
                        html += `<div class="midnight-line" style="left: ${pos}%;">`;
                        html += '<div class="midnight-label">午夜 00:00</div>';
                        html += '</div>';
                    }
                    dayStart.setDate(dayStart.getDate() + 1);
                }
                
                visibleBatches.forEach(batch => {
                    const batchStart = new Date(batch.start_time);
                    const batchEnd = new Date(batch.end_time);
                    
                    const left = Math.max(0, ((batchStart - startTime) / 1000 / totalDuration) * 100);
                    const width = Math.min(100 - left, ((batchEnd - batchStart) / 1000 / totalDuration) * 100);
                    
                    let batchClass = 'allergen-free';
                    if (batch.has_high_risk_allergen) {
                        batchClass = 'high-risk';
                    } else if (batch.has_allergen) {
                        batchClass = 'with-allergen';
                    }
                    
                    if (batch.has_conflict) {
                        batchClass = 'conflict';
                    }
                    
                    const displayText = width > 5 ? batch.batch_id : '';
                    
                    html += `<div class="batch-block ${batchClass}" 
                        style="left: ${left}%; width: ${width}%;"
                        data-type="batch"
                        data-id="${batch.batch_id}"
                        data-product="${batch.product_name}"
                        data-start="${batch.start_time}"
                        data-end="${batch.end_time}"
                        data-allergens="${batch.allergens.join(', ')}"
                        data-equipment="${batch.equipment.join(', ')}"
                        data-crosses-midnight="${batch.crosses_midnight}"
                        onmouseenter="showTooltip(event, this)"
                        onmouseleave="hideTooltip()"
                    >${displayText}</div>`;
                });
                
                line.cleaning_records.forEach(record => {
                    const recordTime = new Date(record.cleaning_time);
                    if (recordTime >= startTime && recordTime <= endTime) {
                        const pos = ((recordTime - startTime) / 1000 / totalDuration) * 100;
                        let resultClass = '';
                        if (record.swab_result === 'pass') {
                            resultClass = 'pass';
                        } else if (record.swab_result === 'fail') {
                            resultClass = 'fail';
                        }
                        
                        html += `<div class="cleaning-marker ${resultClass}"
                            style="left: ${pos}%;"
                            data-type="cleaning"
                            data-id="${record.record_id}"
                            data-equipment="${record.equipment}"
                            data-time="${record.cleaning_time}"
                            data-swab-point="${record.swab_point || ''}"
                            data-result="${record.swab_result || ''}"
                            onmouseenter="showTooltip(event, this)"
                            onmouseleave="hideTooltip()"
                        ></div>`;
                    }
                });
                
                const hoursRange = (endTime - startTime) / (1000 * 60 * 60);
                const markerInterval = hoursRange <= 12 ? 1 : (hoursRange <= 48 ? 4 : 12);
                
                let markerTime = new Date(startTime);
                markerTime.setMinutes(0, 0, 0);
                if (markerTime < startTime) {
                    markerTime.setHours(markerTime.getHours() + 1);
                }
                
                while (markerTime <= endTime) {
                    const pos = ((markerTime - startTime) / 1000 / totalDuration) * 100;
                    const timeStr = markerTime.getHours().toString().padStart(2, '0') + ':' + 
                                   markerTime.getMinutes().toString().padStart(2, '0');
                    html += `<div class="time-marker" style="left: ${pos}%;">${timeStr}</div>`;
                    
                    markerTime.setHours(markerTime.getHours() + markerInterval);
                }
                
                html += '</div></div></div>';
            });
            
            timelineBody.innerHTML = html;
        }
        
        function showTooltip(event, element) {
            const tooltip = document.getElementById('tooltip');
            const type = element.dataset.type;
            
            let html = '';
            
            if (type === 'batch') {
                html = `<div class="tooltip-title">批次: ${element.dataset.id}</div>`;
                html += `<div class="tooltip-row"><span class="tooltip-label">产品:</span> ${element.dataset.product}</div>`;
                html += `<div class="tooltip-row"><span class="tooltip-label">开始:</span> ${element.dataset.start}</div>`;
                html += `<div class="tooltip-row"><span class="tooltip-label">结束:</span> ${element.dataset.end}</div>`;
                html += `<div class="tooltip-row"><span class="tooltip-label">过敏原:</span> ${element.dataset.allergens || '无'}</div>`;
                html += `<div class="tooltip-row"><span class="tooltip-label">设备:</span> ${element.dataset.equipment}</div>`;
                if (element.dataset.crossesMidnight === 'true') {
                    html += '<div class="tooltip-row" style="color: #ff6b6b;"><span class="tooltip-label">⚠️</span> 跨午夜批次</div>';
                }
            } else if (type === 'cleaning') {
                html = `<div class="tooltip-title">清洁记录: ${element.dataset.id}</div>`;
                html += `<div class="tooltip-row"><span class="tooltip-label">设备:</span> ${element.dataset.equipment}</div>`;
                html += `<div class="tooltip-row"><span class="tooltip-label">时间:</span> ${element.dataset.time}</div>`;
                if (element.dataset.swabPoint) {
                    html += `<div class="tooltip-row"><span class="tooltip-label">Swab点位:</span> ${element.dataset.swabPoint}</div>`;
                }
                if (element.dataset.result) {
                    const resultColor = element.dataset.result === 'pass' ? '#51cf66' : '#ff6b6b';
                    html += `<div class="tooltip-row"><span class="tooltip-label">结果:</span> <span style="color: ${resultColor}; font-weight: 600;">${element.dataset.result === 'pass' ? '通过' : '失败'}</span></div>`;
                }
            }
            
            tooltip.innerHTML = html;
            tooltip.classList.add('visible');
        }
        
        function hideTooltip() {
            const tooltip = document.getElementById('tooltip');
            tooltip.classList.remove('visible');
        }
    </script>
</body>
</html>
"""


class TimelineHTMLGenerator:
    """时间线 HTML 生成器"""

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate(
        self,
        timelines: Dict[str, ProductionTimeline],
        analysis_results: Dict[str, Any],
        rules_config: Dict[str, Any],
    ) -> str:
        """生成 timeline.html"""
        high_risk_allergens = set(rules_config.get("high_risk_allergens", []))
        
        lines_data = []
        for line_name, timeline in timelines.items():
            line_data = {
                "name": line_name,
                "batches": [],
                "cleaning_records": [],
            }

            conflict_batches = set()
            for conflict in timeline.check_equipment_conflicts():
                conflict_batches.add(conflict["batch_a"])
                conflict_batches.add(conflict["batch_b"])

            for batch in timeline.batches:
                has_allergen = len(batch.product_info.allergens) > 0
                has_high_risk = any(
                    a in high_risk_allergens for a in batch.product_info.allergens
                )
                
                line_data["batches"].append({
                    "batch_id": batch.batch_id,
                    "product_name": batch.product_info.product_name,
                    "start_time": batch.start_time.isoformat(),
                    "end_time": batch.end_time.isoformat(),
                    "allergens": batch.product_info.allergens,
                    "equipment": batch.equipment,
                    "has_allergen": has_allergen,
                    "has_high_risk_allergen": has_high_risk,
                    "crosses_midnight": batch.crosses_midnight(),
                    "has_conflict": batch.batch_id in conflict_batches,
                })

            for record in timeline.cleaning_records:
                line_data["cleaning_records"].append({
                    "record_id": record.record_id,
                    "equipment": record.equipment,
                    "cleaning_time": record.cleaning_time.isoformat(),
                    "swab_point": record.swab_point,
                    "swab_result": record.swab_result,
                })

            lines_data.append(line_data)

        line_options = "".join(
            f'<option value="{line["name"]}">{line["name"]}</option>'
            for line in lines_data
        )

        summary = analysis_results.get("summary", {})
        special_issues = analysis_results.get("special_issues", {})
        
        total_batches = sum(len(t.batches) for t in timelines.values())
        
        summary_data = {
            "total_batches": total_batches,
            "total_transitions": summary.get("total_transitions", 0),
            "midnight_transitions": len(special_issues.get("midnight_transitions", [])),
            "equipment_conflicts": len(special_issues.get("equipment_conflicts", [])),
        }

        all_risks = []
        for line_name, line_data in analysis_results.get("lines", {}).items():
            for risk in line_data.get("risks", []):
                all_risks.append({
                    "production_line": line_name,
                    "type": risk.get("type", "unknown"),
                    "message": risk.get("message", ""),
                    "recommendation": risk.get("recommendation", ""),
                })

        for conflict in special_issues.get("equipment_conflicts", []):
            all_risks.append({
                "production_line": conflict.get("production_line", "unknown"),
                "type": "critical",
                "message": conflict.get("message", "设备冲突"),
                "recommendation": "立即修正生产排程",
            })

        for mt in special_issues.get("midnight_transitions", []):
            all_risks.append({
                "production_line": mt.get("production_line", "unknown"),
                "type": "medium",
                "message": f"跨午夜批次: {mt.get('batch_id')}",
                "recommendation": "确认换班交接时的清洁记录完整性",
            })

        risks_table_html = ""
        if all_risks:
            risks_table_html = """
            <h3>⚠️ 风险清单</h3>
            <table class="risks-table">
                <thead>
                    <tr>
                        <th>产线</th>
                        <th>严重程度</th>
                        <th>描述</th>
                        <th>建议</th>
                    </tr>
                </thead>
                <tbody>
            """
            
            severity_map = {
                "critical": ("critical", "严重"),
                "equipment_conflict": ("critical", "严重"),
                "allergen_risk": ("high", "高"),
                "warning": ("medium", "中"),
                "medium": ("medium", "中"),
                "midnight_transition": ("low", "低"),
                "low": ("low", "低"),
            }
            
            for risk in all_risks:
                severity_class, severity_label = severity_map.get(
                    risk["type"], ("medium", "中")
                )
                risks_table_html += f"""
                    <tr>
                        <td>{risk['production_line']}</td>
                        <td><span class="risk-badge {severity_class}">{severity_label}</span></td>
                        <td>{risk['message']}</td>
                        <td>{risk['recommendation']}</td>
                    </tr>
                """
            
            risks_table_html += """
                </tbody>
            </table>
            """

        template_data = {
            "generation_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "line_options": line_options,
            "timeline_data": json.dumps({"lines": lines_data}),
            "risks_data": json.dumps(all_risks),
            "summary": summary_data,
            "risks_table": risks_table_html,
            "timeline_rows": "",
        }

        html_content = HTML_TEMPLATE
        for key, value in template_data.items():
            placeholder = "{{" + key + "}}"
            if isinstance(value, dict):
                continue
            html_content = html_content.replace(placeholder, str(value))

        output_path = self.output_dir / "timeline.html"
        output_path.write_text(html_content, encoding="utf-8")

        return str(output_path)
