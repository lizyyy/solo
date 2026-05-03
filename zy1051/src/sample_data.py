import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List

ROUTES = [
    '园区专线1号线（东向）',
    '园区专线1号线（西向）',
    '园区专线2号线（北向）',
    '园区专线2号线（南向）',
    '通勤快线A线',
    '通勤快线B线',
    '加班夜班车'
]

STATIONS = {
    '园区专线1号线（东向）': ['起点站A', '科技园西门', '研发中心', '人才公寓', '地铁站出口', '终点站B'],
    '园区专线1号线（西向）': ['终点站B', '地铁站出口', '人才公寓', '研发中心', '科技园西门', '起点站A'],
    '园区专线2号线（北向）': ['南站', '产业园', '生活区', '体育中心', '北门'],
    '园区专线2号线（南向）': ['北门', '体育中心', '生活区', '产业园', '南站'],
    '通勤快线A线': ['地铁口', '总部大厦', '研发园区', '宿舍区'],
    '通勤快线B线': ['高铁站', '商务中心', '科技城', '人才村'],
    '加班夜班车': ['产业园', '生活区', '地铁站', '市区方向']
}

DRIVER_REMARKS = [
    '正常', '正常', '正常',
    '早高峰堵车，迟到5分钟',
    '晚高峰拥堵',
    '站点临时调整',
    '车辆故障，延误10分钟',
    '天气恶劣，减速行驶',
    '部分乘客迟到',
    '道路施工绕行',
    '临时加站',
    '司机交班延误'
]

def generate_sample_data(start_date: datetime = None, days: int = 14) -> pd.DataFrame:
    if start_date is None:
        start_date = datetime.now() - timedelta(days=days + 1)
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    records = []
    
    for day in range(days):
        current_date = start_date + timedelta(days=day)
        date_str = current_date.strftime('%Y-%m-%d')
        is_weekend = current_date.weekday() >= 5
        
        for route in ROUTES:
            if route == '加班夜班车' and is_weekend:
                continue
            
            stations = STATIONS[route]
            
            if route == '加班夜班车':
                departures = [
                    ('21:00', '21:30'),
                    ('22:00', '22:30'),
                ]
            elif '快线' in route:
                departures = [
                    ('07:30', '07:50'),
                    ('08:00', '08:20'),
                    ('17:30', '17:50'),
                    ('18:00', '18:20'),
                ]
            else:
                departures = [
                    ('07:00', '07:20'),
                    ('07:30', '07:50'),
                    ('08:00', '08:20'),
                    ('08:30', '08:50'),
                    ('17:00', '17:20'),
                    ('17:30', '17:50'),
                    ('18:00', '18:20'),
                    ('18:30', '18:50'),
                ]
            
            for departure_time, arrival_time in departures:
                dep_hour = int(departure_time.split(':')[0])
                is_morning_peak = 7 <= dep_hour <= 9
                is_evening_peak = 17 <= dep_hour <= 19
                
                base_delay = 0
                base_passenger_ratio = 0.7
                
                if is_weekend:
                    base_passenger_ratio = 0.3
                
                if route == '园区专线1号线（东向）':
                    if is_morning_peak:
                        base_delay = np.random.randint(5, 15)
                        base_passenger_ratio = 0.95
                    else:
                        base_delay = np.random.randint(0, 5)
                
                if route == '园区专线2号线（南向）':
                    if is_evening_peak:
                        base_delay = np.random.randint(8, 20)
                        base_passenger_ratio = 0.98
                
                if route == '加班夜班车':
                    base_delay = np.random.randint(3, 10)
                    base_passenger_ratio = 0.6
                
                for station_idx, station in enumerate(stations):
                    station_delay = base_delay + np.random.randint(-2, 5)
                    station_delay = max(0, station_delay)
                    
                    seat_variation = np.random.choice([40, 45, 50, 55, 60])
                    
                    passenger_variation = base_passenger_ratio + np.random.uniform(-0.15, 0.2)
                    passenger_variation = max(0.1, min(1.3, passenger_variation))
                    
                    passengers = int(seat_variation * passenger_variation)
                    
                    planned_departure = datetime.strptime(departure_time, '%H:%M')
                    planned_departure = planned_departure + timedelta(minutes=station_idx * 5)
                    
                    actual_departure = planned_departure + timedelta(minutes=station_delay)
                    
                    planned_arrival = datetime.strptime(arrival_time, '%H:%M')
                    planned_arrival = planned_arrival + timedelta(minutes=station_idx * 5)
                    
                    actual_arrival = planned_arrival + timedelta(minutes=station_delay)
                    
                    remark = np.random.choice(DRIVER_REMARKS)
                    if station_delay > 10:
                        remark = np.random.choice([r for r in DRIVER_REMARKS if r != '正常'])
                    
                    record = {
                        '日期': date_str,
                        '线路': route,
                        '站点': station,
                        '计划发车时间': planned_departure.strftime('%H:%M'),
                        '实际发车时间': actual_departure.strftime('%H:%M'),
                        '计划到站时间': planned_arrival.strftime('%H:%M'),
                        '实际到站时间': actual_arrival.strftime('%H:%M'),
                        '座位数': seat_variation,
                        '签到人数': passengers,
                        '司机备注': remark
                    }
                    records.append(record)
    
    return pd.DataFrame(records)
