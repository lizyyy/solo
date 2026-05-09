import yaml
import csv
from typing import List, Dict, Any, Optional
from datetime import datetime
from .models import Route, Order, Stop, Segment, SensorReading


class DataImporter:
    @staticmethod
    def parse_datetime(dt_str: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(dt_str.strip(), fmt)
            except (ValueError, AttributeError):
                continue
        raise ValueError(f"无法解析时间格式: {dt_str}")

    @staticmethod
    def import_route(yaml_path: str) -> Route:
        with open(yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        orders = [
            Order(
                order_id=o['order_id'],
                order_type=o['order_type'],
                min_temp=float(o['min_temp']),
                max_temp=float(o['max_temp']),
                route_id=data['route_id']
            )
            for o in data['orders']
        ]

        stops = [
            Stop(
                stop_id=s['stop_id'],
                stop_name=s['stop_name'],
                arrival_time=DataImporter.parse_datetime(s['arrival_time']),
                departure_time=DataImporter.parse_datetime(s['departure_time']),
                is_door_open=s.get('is_door_open', False),
                door_open_duration_min=int(s.get('door_open_duration_min', 0))
            )
            for s in data['stops']
        ]

        segments = [
            Segment(
                segment_id=seg['segment_id'],
                from_stop=seg['from_stop'],
                to_stop=seg['to_stop'],
                compartment=seg['compartment'],
                start_time=DataImporter.parse_datetime(seg['start_time']),
                end_time=DataImporter.parse_datetime(seg['end_time']),
                orders=seg.get('orders', [])
            )
            for seg in data['segments']
        ]

        return Route(
            route_id=data['route_id'],
            vehicle_id=data['vehicle_id'],
            compartments=data['compartments'],
            stops=stops,
            segments=segments,
            orders=orders
        )

    @staticmethod
    def import_sensor_data(csv_path: str) -> List[SensorReading]:
        readings = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                temp_str = row.get('temperature', '').strip()
                is_missing = False
                temperature = None
                
                if temp_str == '' or temp_str.lower() in ['null', 'none', 'nan', 'na']:
                    is_missing = True
                else:
                    try:
                        temperature = float(temp_str)
                    except ValueError:
                        is_missing = True
                
                readings.append(SensorReading(
                    timestamp=DataImporter.parse_datetime(row['timestamp']),
                    compartment=row['compartment'],
                    temperature=temperature,
                    is_missing=is_missing
                ))
        
        readings.sort(key=lambda x: x.timestamp)
        return readings
