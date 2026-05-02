from typing import Dict, List
from datetime import datetime
from ..state_machine.trip_reconstructor import Trip


def export_settlement_report(
    all_trips: Dict[str, List[Trip]],
    output_path: str,
) -> None:
    total_cards = len(all_trips)
    total_trips = 0
    total_fare = 0
    anomaly_counts = {}
    
    for card_id, trips in all_trips.items():
        for trip in trips:
            total_trips += 1
            total_fare += trip.calculated_fare
            
            for anomaly in trip.anomalies:
                if anomaly not in anomaly_counts:
                    anomaly_counts[anomaly] = 0
                anomaly_counts[anomaly] += 1
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# 地铁清分复核报告\n\n")
        f.write(f"生成时间: {datetime.now().isoformat()}\n\n")
        f.write("## 统计摘要\n\n")
        f.write(f"- 处理卡片数: {total_cards}\n")
        f.write(f"- 行程总数: {total_trips}\n")
        f.write(f"- 应收总金额: ¥{total_fare / 100:.2f}\n\n")
        
        f.write("## 异常统计\n\n")
        if anomaly_counts:
            for anomaly, count in anomaly_counts.items():
                f.write(f"- {anomaly}: {count} 次\n")
        else:
            f.write("无异常\n")
        
        f.write("\n## 详细行程\n\n")
        for card_id, trips in all_trips.items():
            f.write(f"### 卡片 {card_id}\n\n")
            for i, trip in enumerate(trips, 1):
                f.write(f"#### 行程 {i}\n\n")
                
                if trip.operating_day:
                    f.write(f"- 运营日: {trip.operating_day}\n")
                
                f.write(f"- 应收票价: ¥{trip.calculated_fare / 100:.2f}\n")
                
                if trip.anomalies:
                    f.write(f"- 异常: {', '.join(trip.anomalies)}\n")
                
                f.write("\n")
                for j, leg in enumerate(trip.legs, 1):
                    f.write(f"  段 {j}:\n")
                    if leg.tap_in:
                        f.write(f"    - 进站: {leg.tap_in.station_id} @ {leg.tap_in.timestamp}\n")
                    if leg.tap_out:
                        f.write(f"    - 出站: {leg.tap_out.station_id} @ {leg.tap_out.timestamp}\n")
                    f.write("\n")
