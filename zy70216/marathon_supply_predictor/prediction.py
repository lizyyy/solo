from typing import Dict, List, Tuple, Optional
from datetime import datetime
from .models import (
    MarathonEvent, Segment, SupplyStation, Weather, 
    SupplyItem, PredictionResult, ProcessingStatus
)


class WeatherFactors:
    @staticmethod
    def calculate_temperature_factor(temp: float) -> float:
        if temp < 5:
            return 0.8
        elif 5 <= temp < 15:
            return 0.9
        elif 15 <= temp < 25:
            return 1.0
        elif 25 <= temp < 30:
            return 1.3
        elif 30 <= temp < 35:
            return 1.6
        else:
            return 2.0

    @staticmethod
    def calculate_humidity_factor(humidity: float) -> float:
        if humidity < 40:
            return 1.1
        elif 40 <= humidity < 60:
            return 1.0
        elif 60 <= humidity < 80:
            return 1.15
        else:
            return 1.35

    @staticmethod
    def calculate_wind_factor(wind_speed: float) -> float:
        if wind_speed < 5:
            return 1.0
        elif 5 <= wind_speed < 15:
            return 1.05
        elif 15 <= wind_speed < 25:
            return 1.15
        else:
            return 1.25

    @staticmethod
    def calculate_precipitation_factor(prob: float) -> float:
        if prob < 20:
            return 1.0
        elif 20 <= prob < 50:
            return 1.1
        else:
            return 1.25

    @staticmethod
    def get_overall_factor(weather: Weather, supply_type: str) -> float:
        temp_factor = WeatherFactors.calculate_temperature_factor(weather.temperature)
        humidity_factor = WeatherFactors.calculate_humidity_factor(weather.humidity)
        wind_factor = WeatherFactors.calculate_wind_factor(weather.wind_speed)
        prec_factor = WeatherFactors.calculate_precipitation_factor(weather.precipitation_probability)

        base_factor = temp_factor * humidity_factor * wind_factor * prec_factor

        if supply_type == "water":
            return base_factor
        elif supply_type == "energy_gel":
            return base_factor * 0.9
        elif supply_type == "sports_drink":
            return base_factor * 1.05
        elif supply_type == "food":
            return base_factor * 0.85
        else:
            return base_factor


class DistanceFactors:
    @staticmethod
    def get_distance_factor(distance_km: float, supply_type: str) -> float:
        if supply_type == "water":
            if distance_km < 10:
                return 0.6
            elif 10 <= distance_km < 20:
                return 0.9
            elif 20 <= distance_km < 30:
                return 1.1
            elif 30 <= distance_km < 35:
                return 1.3
            else:
                return 1.5
        elif supply_type == "energy_gel":
            if distance_km < 15:
                return 0.5
            elif 15 <= distance_km < 25:
                return 0.8
            elif 25 <= distance_km < 35:
                return 1.2
            else:
                return 1.5
        elif supply_type == "sports_drink":
            if distance_km < 10:
                return 0.5
            elif 10 <= distance_km < 20:
                return 0.8
            elif 20 <= distance_km < 30:
                return 1.1
            else:
                return 1.3
        elif supply_type == "food":
            if distance_km < 20:
                return 0.0
            elif 20 <= distance_km < 30:
                return 0.7
            else:
                return 1.0
        return 1.0

    @staticmethod
    def get_difficulty_factor(difficulty_level: str) -> float:
        factors = {
            "easy": 0.85,
            "medium": 1.0,
            "hard": 1.25,
            "extreme": 1.5
        }
        return factors.get(difficulty_level.lower(), 1.0)


class SupplyRules:
    @staticmethod
    def get_segment_runners(segment: Segment, total_runners: int) -> int:
        return segment.estimated_runners

    @staticmethod
    def calculate_safety_margin(supply_type: str) -> float:
        margins = {
            "water": 0.20,
            "sports_drink": 0.15,
            "energy_gel": 0.15,
            "food": 0.10
        }
        return margins.get(supply_type, 0.15)

    @staticmethod
    def get_shortage_threshold(station_name: str, supply_type: str) -> float:
        if "30公里" in station_name or "35公里" in station_name or "40公里" in station_name:
            return 0.85
        elif "20公里" in station_name or "25公里" in station_name:
            return 0.80
        else:
            return 0.70


class ConsumptionPredictor:
    def __init__(self, event: MarathonEvent):
        self.event = event
        self.weather_factor_cache: Dict[str, float] = {}

    def get_segment_by_id(self, segment_id: str) -> Optional[Segment]:
        for seg in self.event.segments:
            if seg.segment_id == segment_id:
                return seg
        return None

    def get_supply_item_by_type(self, supply_type: str) -> Optional[SupplyItem]:
        for item in self.event.supply_items:
            if item.supply_type == supply_type:
                return item
        return None

    def predict_for_station(self, station: SupplyStation) -> PredictionResult:
        segment = self.get_segment_by_id(station.segment_id)
        if not segment:
            return PredictionResult(
                station_id=station.station_id,
                station_name=station.name,
                segment_id=station.segment_id,
                runners_in_segment=0,
                distance_km=station.distance_km,
                predicted_consumption={},
                prepared_supplies=station.prepared_supplies,
                gap={},
                gap_percentage={},
                shortage_risk={},
                status="error",
                warnings=[f"未找到分段 {station.segment_id}"]
            )

        runners_in_segment = SupplyRules.get_segment_runners(
            segment, self.event.total_estimated_runners
        )

        predicted_consumption: Dict[str, float] = {}
        gap: Dict[str, float] = {}
        gap_percentage: Dict[str, float] = {}
        shortage_risk: Dict[str, bool] = {}
        warnings: List[str] = []

        difficulty_factor = DistanceFactors.get_difficulty_factor(segment.difficulty_level)

        for supply_type, prepared in station.prepared_supplies.items():
            supply_item = self.get_supply_item_by_type(supply_type)
            if not supply_item:
                warnings.append(f"物资类型 {supply_type} 未在物资清单中定义")
                continue

            base_rate = supply_item.base_consumption_rate
            distance_factor = DistanceFactors.get_distance_factor(
                station.distance_km, supply_type
            )

            if self.event.weather:
                weather_factor = WeatherFactors.get_overall_factor(
                    self.event.weather, supply_type
                )
            else:
                weather_factor = 1.0

            safety_margin = SupplyRules.calculate_safety_margin(supply_type)

            predicted = (
                base_rate * runners_in_segment * 
                distance_factor * difficulty_factor * 
                weather_factor * (1 + safety_margin)
            )
            predicted = round(predicted, 2)

            predicted_consumption[supply_type] = predicted

            gap_val = prepared - predicted
            gap[supply_type] = round(gap_val, 2)

            if predicted > 0:
                gap_pct = (gap_val / predicted) * 100
            else:
                gap_pct = 100.0
            gap_percentage[supply_type] = round(gap_pct, 2)

            threshold = SupplyRules.get_shortage_threshold(station.name, supply_type)
            shortage_risk[supply_type] = prepared < predicted * threshold

            if shortage_risk[supply_type]:
                warnings.append(
                    f"{supply_item.name} 备量不足! "
                    f"预测消耗: {predicted:.1f}{supply_item.unit}, "
                    f"现有备量: {prepared}{supply_item.unit}, "
                    f"缺口: {abs(gap_val):.1f}{supply_item.unit}"
                )

        has_shortage = any(shortage_risk.values())
        status = "warning" if has_shortage else "ok"

        return PredictionResult(
            station_id=station.station_id,
            station_name=station.name,
            segment_id=station.segment_id,
            runners_in_segment=runners_in_segment,
            distance_km=station.distance_km,
            predicted_consumption=predicted_consumption,
            prepared_supplies=station.prepared_supplies,
            gap=gap,
            gap_percentage=gap_percentage,
            shortage_risk=shortage_risk,
            status=status,
            warnings=warnings
        )

    def predict_all(self) -> List[PredictionResult]:
        results = []
        for station in self.event.stations:
            result = self.predict_for_station(station)
            results.append(result)
        return results


class ValidationChecker:
    @staticmethod
    def validate_event(event: MarathonEvent) -> Tuple[bool, List[str]]:
        errors = []

        if not event.segments:
            errors.append("未定义任何分段")
        else:
            first_segment = min(event.segments, key=lambda s: s.start_km)
            last_segment = max(event.segments, key=lambda s: s.end_km)
            
            if first_segment.estimated_runners < event.total_estimated_runners:
                errors.append(
                    f"起始分段人数({first_segment.estimated_runners})不应少于总人数({event.total_estimated_runners})"
                )
            
            if last_segment.estimated_runners > event.total_estimated_runners:
                errors.append(
                    f"末段分段人数({last_segment.estimated_runners})不应多于总人数({event.total_estimated_runners})"
                )

        if not event.stations:
            errors.append("未定义任何补给站")

        for station in event.stations:
            segment_ids = {s.segment_id for s in event.segments}
            if station.segment_id not in segment_ids:
                errors.append(f"补给站 {station.name} 引用了不存在的分段 {station.segment_id}")
            if not station.prepared_supplies:
                errors.append(f"补给站 {station.name} 未设置任何物资备量")

        if not event.weather:
            errors.append("未设置天气信息")

        if not event.supply_items:
            errors.append("未定义物资清单")

        return len(errors) == 0, errors

    @staticmethod
    def check_interception_conditions(event: MarathonEvent, results: List[PredictionResult]) -> Tuple[bool, List[str]]:
        intercept_reasons = []

        high_risk_stations = []
        for result in results:
            if any(result.shortage_risk.values()):
                high_risk_stations.append(result.station_name)

        if len(high_risk_stations) >= 2:
            intercept_reasons.append(
                f"有 {len(high_risk_stations)} 个补给站存在短缺风险: {', '.join(high_risk_stations)}"
            )

        critical_segments = ["seg_30_35", "seg_35_40", "seg_30_40", "seg_35_42"]
        for result in results:
            if result.segment_id in critical_segments and any(result.shortage_risk.values()):
                intercept_reasons.append(
                    f"关键分段({result.segment_id})的补给站 {result.station_name} 存在短缺风险"
                )

        if event.weather:
            if event.weather.temperature >= 32:
                intercept_reasons.append(
                    f"高温预警: {event.weather.temperature}°C, 可能增加物资消耗"
                )
            if event.weather.humidity >= 85:
                intercept_reasons.append(
                    f"高湿预警: 湿度{event.weather.humidity}%, 可能增加物资消耗"
                )

        return len(intercept_reasons) > 0, intercept_reasons
