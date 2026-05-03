import json
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime, date


@dataclass
class WeatherCondition:
    date: date
    hour: Optional[int]
    temperature: float
    humidity: float
    wind_speed: float
    wind_direction: str
    precipitation_probability: float
    precipitation_amount: float
    condition: str
    visibility: float
    uv_index: float


@dataclass
class WaterCrossingPoint:
    name: str
    lat: float
    lon: float
    current_depth: float
    warning_depth: float
    danger_depth: float
    flow_rate: float


class WeatherParser:
    def __init__(self):
        self.forecasts: List[WeatherCondition] = []
        self.water_crossings: List[WaterCrossingPoint] = []
        self.metadata: Dict = {}

    def parse(self, file_path: str) -> None:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if 'forecasts' in data:
            for fc in data['forecasts']:
                forecast = WeatherCondition(
                    date=datetime.strptime(fc['date'], '%Y-%m-%d').date(),
                    hour=fc.get('hour'),
                    temperature=float(fc['temperature']),
                    humidity=float(fc['humidity']),
                    wind_speed=float(fc['wind_speed']),
                    wind_direction=fc.get('wind_direction', '未知'),
                    precipitation_probability=float(fc.get('precipitation_probability', 0)),
                    precipitation_amount=float(fc.get('precipitation_amount', 0)),
                    condition=fc.get('condition', '晴朗'),
                    visibility=float(fc.get('visibility', 10000)),
                    uv_index=float(fc.get('uv_index', 0))
                )
                self.forecasts.append(forecast)

        if 'water_crossings' in data:
            for wc in data['water_crossings']:
                crossing = WaterCrossingPoint(
                    name=wc['name'],
                    lat=float(wc['lat']),
                    lon=float(wc['lon']),
                    current_depth=float(wc['current_depth']),
                    warning_depth=float(wc.get('warning_depth', 0.5)),
                    danger_depth=float(wc.get('danger_depth', 0.8)),
                    flow_rate=float(wc.get('flow_rate', 0.5))
                )
                self.water_crossings.append(crossing)

        self.metadata = {
            'forecast_days': len(set(f.date for f in self.forecasts)),
            'water_crossing_count': len(self.water_crossings),
            'min_temp': min(f.temperature for f in self.forecasts) if self.forecasts else None,
            'max_temp': max(f.temperature for f in self.forecasts) if self.forecasts else None
        }

    def get_dangerous_crossings(self) -> List[WaterCrossingPoint]:
        return [
            crossing for crossing in self.water_crossings
            if crossing.current_depth >= crossing.warning_depth
        ]

    def get_extreme_conditions(self, target_date: date = None) -> Dict[str, List[WeatherCondition]]:
        conditions = self.forecasts
        if target_date:
            conditions = [f for f in conditions if f.date == target_date]

        extreme = {
            'high_wind': [f for f in conditions if f.wind_speed >= 15],
            'heavy_rain': [f for f in conditions if f.precipitation_amount >= 10],
            'high_temp': [f for f in conditions if f.temperature >= 35],
            'low_temp': [f for f in conditions if f.temperature <= 0],
            'low_visibility': [f for f in conditions if f.visibility < 1000],
            'high_uv': [f for f in conditions if f.uv_index >= 10]
        }
        return extreme

    def validate(self) -> List[str]:
        errors = []

        if not self.forecasts:
            errors.append("天气预报数据为空")

        for i, fc in enumerate(self.forecasts):
            if fc.temperature < -50 or fc.temperature > 55:
                errors.append(f"第 {i+1} 个预报温度异常: {fc.temperature}°C")

            if fc.humidity < 0 or fc.humidity > 100:
                errors.append(f"第 {i+1} 个预报湿度异常: {fc.humidity}%")

            if fc.wind_speed < 0 or fc.wind_speed > 100:
                errors.append(f"第 {i+1} 个预报风速异常: {fc.wind_speed} m/s")

        for i, wc in enumerate(self.water_crossings):
            if wc.current_depth < 0:
                errors.append(f"涉水点 {wc.name} 深度异常: {wc.current_depth}m")

            if wc.warning_depth <= 0:
                errors.append(f"涉水点 {wc.name} 警戒深度异常: {wc.warning_depth}m")

            if wc.danger_depth <= wc.warning_depth:
                errors.append(f"涉水点 {wc.name} 危险深度不大于警戒深度")

        return errors
