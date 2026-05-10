import sys
from pathlib import Path
from datetime import datetime, timedelta
import math

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd


def generate_linear_trajectory(start_lat: float, start_lng: float, 
                               end_lat: float, end_lng: float,
                               start_time: datetime, duration_seconds: int,
                               num_points: int = 100,
                               driver_id: str = "D001",
                               order_id: str = "ORD001") -> pd.DataFrame:
    points = []
    for i in range(num_points):
        ratio = i / (num_points - 1)
        lat = start_lat + (end_lat - start_lat) * ratio
        lng = start_lng + (end_lng - start_lng) * ratio
        
        noise_lat = (0.00005 * (math.sin(i * 0.5) + math.cos(i * 0.3)))
        noise_lng = (0.00005 * (math.cos(i * 0.5) + math.sin(i * 0.3)))
        
        point_time = start_time + timedelta(seconds=int(duration_seconds * ratio))
        
        points.append({
            "timestamp": point_time.strftime("%Y-%m-%d %H:%M:%S"),
            "latitude": round(lat + noise_lat, 6),
            "longitude": round(lng + noise_lng, 6),
            "speed": 40 + 10 * math.sin(i * 0.2),
            "accuracy": 5.0 + 3 * math.sin(i * 0.3),
            "driver_id": driver_id,
            "order_id": order_id
        })
    
    return pd.DataFrame(points)


def generate_detour_trajectory(start_lat: float, start_lng: float,
                               end_lat: float, end_lng: float,
                               start_time: datetime, duration_seconds: int,
                               detour_points: list = None,
                               stationary_points: list = None,
                               num_points: int = 150,
                               driver_id: str = "D001",
                               order_id: str = "ORD001") -> pd.DataFrame:
    if detour_points is None:
        mid_lat = (start_lat + end_lat) / 2
        mid_lng = (start_lng + end_lng) / 2
        detour_points = [
            (mid_lat + 0.005, mid_lng - 0.005),
            (mid_lat + 0.008, mid_lng + 0.002),
        ]
    
    if stationary_points is None:
        stationary_points = []
    
    all_points = [(start_lat, start_lng)] + detour_points + [(end_lat, end_lng)]
    
    segment_duration = duration_seconds // len(all_points)
    
    full_df = pd.DataFrame()
    current_time = start_time
    
    for i in range(len(all_points) - 1):
        s_lat, s_lng = all_points[i]
        e_lat, e_lng = all_points[i + 1]
        
        seg_points = 30
        
        is_stationary = any(sp == i for sp, _ in stationary_points)
        
        if is_stationary:
            seg_time = segment_duration
            for sp_idx, sp_dur in stationary_points:
                if sp_idx == i:
                    seg_time += sp_dur
                    break
            
            seg_df = generate_linear_trajectory(
                s_lat, s_lng, e_lat, e_lng,
                current_time, segment_duration,
                num_points=seg_points,
                driver_id=driver_id,
                order_id=order_id
            )
            
            last_point = seg_df.iloc[-1]
            stationary_start = datetime.strptime(last_point["timestamp"], "%Y-%m-%d %H:%M:%S")
            
            for j in range(10):
                ratio = j / 10
                noise_lat = 0.00002 * math.sin(j)
                noise_lng = 0.00002 * math.cos(j)
                
                points = []
                for _ in range(3):
                    st = stationary_start + timedelta(seconds=int(sp_dur * ratio + _ * 5))
                    points.append({
                        "timestamp": st.strftime("%Y-%m-%d %H:%M:%S"),
                        "latitude": round(e_lat + noise_lat, 6),
                        "longitude": round(e_lng + noise_lng, 6),
                        "speed": 0.0,
                        "accuracy": 8.0,
                        "driver_id": driver_id,
                        "order_id": order_id
                    })
                
                stationary_df = pd.DataFrame(points)
                seg_df = pd.concat([seg_df, stationary_df], ignore_index=True)
            
            full_df = pd.concat([full_df, seg_df], ignore_index=True)
            current_time = datetime.strptime(full_df.iloc[-1]["timestamp"], "%Y-%m-%d %H:%M:%S")
        else:
            seg_df = generate_linear_trajectory(
                s_lat, s_lng, e_lat, e_lng,
                current_time, segment_duration,
                num_points=seg_points,
                driver_id=driver_id,
                order_id=order_id
            )
            full_df = pd.concat([full_df, seg_df], ignore_index=True)
            current_time = datetime.strptime(full_df.iloc[-1]["timestamp"], "%Y-%m-%d %H:%M:%S")
    
    return full_df


def main():
    samples_dir = Path(__file__).parent
    
    origin = (31.2304, 121.4737)
    dest = (31.2504, 121.5037)
    
    start_time = datetime(2024, 5, 15, 14, 30, 0)
    normal_duration = 1200
    
    normal_trajectory = generate_linear_trajectory(
        origin[0], origin[1], dest[0], dest[1],
        start_time, normal_duration,
        num_points=120,
        driver_id="D001",
        order_id="ORD001"
    )
    normal_trajectory.to_csv(samples_dir / "normal_trajectory.csv", index=False, encoding="utf-8-sig")
    
    detour_start = datetime(2024, 5, 15, 14, 0, 0)
    anomaly_trajectory = generate_detour_trajectory(
        origin[0], origin[1], dest[0], dest[1],
        detour_start, 900,
        detour_points=[
            (31.2450, 121.4500),
            (31.2600, 121.4700),
            (31.2550, 121.4900),
        ],
        stationary_points=[(1, 600)],
        num_points=200,
        driver_id="D002",
        order_id="ORD002"
    )
    anomaly_trajectory.to_csv(samples_dir / "anomaly_trajectory.csv", index=False, encoding="utf-8-sig")
    
    orders = pd.DataFrame([{
        "order_id": "ORD001",
        "driver_id": "D001",
        "origin_lat": 31.2304,
        "origin_lng": 121.4737,
        "dest_lat": 31.2504,
        "dest_lng": 121.5037,
        "planned_distance": 4.5,
        "expected_duration": 1200,
        "pickup_time": "2024-05-15 14:30:00",
        "delivery_time": "2024-05-15 14:50:00",
        "status": "completed",
        "assigned_vehicle": "沪A12345",
        "cargo_type": "生鲜"
    }, {
        "order_id": "ORD002",
        "driver_id": "D002",
        "origin_lat": 31.2304,
        "origin_lng": 121.4737,
        "dest_lat": 31.2504,
        "dest_lng": 121.5037,
        "planned_distance": 4.5,
        "expected_duration": 1200,
        "pickup_time": "2024-05-15 14:00:00",
        "delivery_time": "2024-05-15 14:20:00",
        "status": "completed",
        "assigned_vehicle": "沪B67890",
        "cargo_type": "普通"
    }, {
        "order_id": "ORD003",
        "driver_id": "D001",
        "origin_lat": 31.2000,
        "origin_lng": 121.4000,
        "dest_lat": 31.2200,
        "dest_lng": 121.4200,
        "planned_distance": 3.0,
        "expected_duration": 900,
        "pickup_time": "2024-05-15 15:00:00",
        "delivery_time": "2024-05-15 15:15:00",
        "status": "completed",
        "assigned_vehicle": "沪A12345",
        "cargo_type": "易碎品"
    }])
    orders.to_csv(samples_dir / "orders.csv", index=False, encoding="utf-8-sig")
    
    print(f"样例数据已生成到: {samples_dir}")
    print(f"- normal_trajectory.csv: 正常轨迹 (ORD001)")
    print(f"- anomaly_trajectory.csv: 异常轨迹 (ORD002) - 包含绕行和停留")
    print(f"- orders.csv: 订单信息 (ORD001, ORD002, ORD003)")


if __name__ == "__main__":
    main()
