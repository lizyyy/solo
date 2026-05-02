from typing import Dict
from datetime import datetime
from ..arbitration.arbitrator import ArbitrationResult, RunnerResult
from ..rules.engine import format_timedelta
from ..parsers.rules import RaceRules


def export_timeline_html(result: ArbitrationResult, rules: RaceRules, file_path: str):
    all_times = []
    for runner in result.runners.values():
        for mat_id, ts in runner.mat_times.items():
            all_times.append((ts, runner.bib, runner.name, mat_id))
    
    all_times.sort(key=lambda x: x[0])
    
    if all_times:
        min_time = all_times[0][0]
        max_time = all_times[-1][0]
        time_span = (max_time - min_time).total_seconds()
    else:
        min_time = datetime.now()
        time_span = 3600
    
    runners_list = sorted(result.runners.values(), key=lambda x: x.bib)
    max_name_len = max(len(r.name) for r in runners_list) if runners_list else 20
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write("""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Race Timeline</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .timeline-container { margin-top: 30px; }
        .runner-row { display: flex; margin-bottom: 8px; align-items: center; }
        .runner-label { width: 180px; padding-right: 10px; text-align: right; flex-shrink: 0; }
        .timeline-bar { flex-grow: 1; height: 24px; background: #eee; position: relative; border-radius: 4px; }
        .marker { position: absolute; top: 2px; width: 8px; height: 20px; border-radius: 2px; transform: translateX(-50%); }
        .start { background: #4CAF50; }
        .end { background: #f44336; }
        .segment { background: #2196F3; }
        .dnf .runner-label { color: #999; }
        .legend { margin-top: 20px; display: flex; gap: 20px; }
        .legend-item { display: flex; align-items: center; gap: 8px; }
        .legend-color { width: 16px; height: 16px; border-radius: 2px; }
        .tooltip { position: absolute; background: #333; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; z-index: 100; white-space: nowrap; display: none; }
        .marker:hover .tooltip { display: block; top: -30px; left: 50%; transform: translateX(-50%); }
    </style>
</head>
<body>
""")
        f.write(f"<h1>{rules.race_name} - Timeline</h1>\n")
        f.write(f"<p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>\n")
        
        f.write("""
    <div class="legend">
        <div class="legend-item">
            <div class="legend-color" style="background: #4CAF50;"></div>
            <span>Start</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #f44336;"></div>
            <span>End</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #2196F3;"></div>
            <span>Segment</span>
        </div>
    </div>
""")
        
        f.write('<div class="timeline-container">\n')
        
        start_norm = rules.start_mat
        end_norm = rules.end_mat
        
        for runner in runners_list:
            css_class = "dnf" if runner.is_dnf else ""
            f.write(f'  <div class="runner-row {css_class}">\n')
            net_time_str = format_timedelta(runner.net_time) if runner.net_time else "DNF"
            f.write(f'    <div class="runner-label">{runner.bib} - {runner.name} ({net_time_str})</div>\n')
            f.write('    <div class="timeline-bar">\n')
            
            for mat_id, ts in runner.mat_times.items():
                if time_span > 0:
                    pos = ((ts - min_time).total_seconds() / time_span) * 100
                else:
                    pos = 50
                
                cls = "start" if mat_id == start_norm else "end" if mat_id == end_norm else "segment"
                f.write(f'      <div class="marker {cls}" style="left: {pos:.2f}%;">')
                f.write(f'<div class="tooltip">{mat_id} - {ts.strftime("%H:%M:%S")}</div>')
                f.write('</div>\n')
            
            f.write('    </div>\n')
            f.write('  </div>\n')
        
        f.write('</div>\n')
        f.write('</body>\n</html>\n')
