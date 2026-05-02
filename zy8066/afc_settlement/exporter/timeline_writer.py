from typing import Dict, List
from datetime import datetime
from ..state_machine.trip_reconstructor import Trip


def export_trip_timeline(
    all_trips: Dict[str, List[Trip]],
    output_path: str,
) -> None:
    html_content = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>地铁行程时间线</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .card-section { margin: 30px 0; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
        .trip { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #4CAF50; }
        .trip.anomaly { border-left-color: #f44336; }
        .leg { margin: 10px 0; padding: 10px; background: #fff; border: 1px solid #eee; }
        .event { padding: 5px; margin: 5px 0; }
        .entry { color: #2196F3; }
        .exit { color: #4CAF50; }
        .anomaly-tag { display: inline-block; padding: 3px 8px; background: #ffeb3b; border-radius: 4px; font-size: 12px; margin-right: 5px; }
        .fare { font-size: 1.2em; font-weight: bold; color: #333; }
    </style>
</head>
<body>
    <h1>地铁行程时间线</h1>
    <p>生成时间: """ + datetime.now().isoformat() + """</p>
"""
    
    for card_id, trips in all_trips.items():
        html_content += f'<div class="card-section"><h2>卡片: {card_id}</h2>'
        
        for i, trip in enumerate(trips, 1):
            has_anomaly = len(trip.anomalies) > 0
            anomaly_class = ' anomaly' if has_anomaly else ''
            
            html_content += f'<div class="trip{anomaly_class}">'
            html_content += f'<h3>行程 {i}</h3>'
            
            if trip.operating_day:
                html_content += f'<p>运营日: {trip.operating_day}</p>'
            
            html_content += f'<p class="fare">应收票价: ¥{trip.calculated_fare / 100:.2f}</p>'
            
            if trip.anomalies:
                html_content += '<p>异常: '
                for anomaly in trip.anomalies:
                    html_content += f'<span class="anomaly-tag">{anomaly}</span>'
                html_content += '</p>'
            
            for j, leg in enumerate(trip.legs, 1):
                html_content += f'<div class="leg"><h4>段 {j}</h4>'
                
                if leg.tap_in:
                    html_content += f'<div class="event entry">进站: {leg.tap_in.station_id} @ {leg.tap_in.timestamp}</div>'
                
                if leg.tap_out:
                    html_content += f'<div class="event exit">出站: {leg.tap_out.station_id} @ {leg.tap_out.timestamp}</div>'
                
                html_content += '</div>'
            
            html_content += '</div>'
        
        html_content += '</div>'
    
    html_content += """
</body>
</html>
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
