from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import math

from models import (
    ElderlyPerson,
    CoolingStation,
    HeatForecast,
    TravelTime,
    RiskLevel,
)
from config import RISK_CONFIG, WEIGHTS_CONFIG


@dataclass
class RiskFactors:
    age_score: float
    health_score: float
    living_alone_score: float
    mobility_score: float
    heat_exposure_score: float
    total_score: float
    risk_level: str


class RiskCalculator:
    def __init__(self):
        self.config = RISK_CONFIG
        self.weights = WEIGHTS_CONFIG

    def calculate_age_score(self, age: int) -> float:
        if age >= self.config["AGE_CRITICAL"]:
            return 1.0
        elif age >= self.config["AGE_HIGH_RISK"]:
            return 0.5 + (age - self.config["AGE_HIGH_RISK"]) / (
                self.config["AGE_CRITICAL"] - self.config["AGE_HIGH_RISK"]
            ) * 0.5
        elif age >= 65:
            return 0.2 + (age - 65) / (self.config["AGE_HIGH_RISK"] - 65) * 0.3
        else:
            return 0.0

    def calculate_health_score(self, health_conditions: List[str]) -> float:
        high_risk_conditions = {
            "高血压",
            "糖尿病",
            "心脏病",
            "心脑血管疾病",
            "慢性肺病",
            "肾病",
        }
        medium_risk_conditions = {
            "关节炎",
            "视力障碍",
            "听力障碍",
            "骨质疏松",
        }

        high_count = sum(1 for cond in health_conditions if cond in high_risk_conditions)
        medium_count = sum(1 for cond in health_conditions if cond in medium_risk_conditions)

        score = min(1.0, high_count * 0.3 + medium_count * 0.15)
        return score

    def calculate_living_alone_score(self, living_alone: bool, needs_special_care: bool) -> float:
        if living_alone and needs_special_care:
            return 1.0
        elif living_alone:
            return 0.6
        elif needs_special_care:
            return 0.4
        else:
            return 0.0

    def calculate_mobility_score(self, mobility: str) -> float:
        mobility_scores = {
            "正常": 0.0,
            "行动不便": 0.4,
            "轮椅": 0.7,
            "卧床": 1.0,
        }
        return mobility_scores.get(mobility, 0.0)

    def calculate_heat_exposure_score(
        self,
        has_air_conditioning: bool,
        hourly_forecasts: List[Dict],
        walking_time_to_nearest_station: int = 30,
    ) -> float:
        max_feels_like = max(f.get("feels_like", 30) for f in hourly_forecasts) if hourly_forecasts else 35
        
        temp_factor = 0.0
        if max_feels_like >= self.config["CRITICAL_HEAT_THRESHOLD"]:
            temp_factor = 1.0
        elif max_feels_like >= self.config["HEAT_THRESHOLD"]:
            temp_factor = 0.5 + (max_feels_like - self.config["HEAT_THRESHOLD"]) / (
                self.config["CRITICAL_HEAT_THRESHOLD"] - self.config["HEAT_THRESHOLD"]
            ) * 0.5
        else:
            temp_factor = max(0.0, (max_feels_like - 30) / 5 * 0.3)

        ac_factor = 0.0 if has_air_conditioning else 0.4

        time_factor = 0.0
        if walking_time_to_nearest_station > self.config["BUS_TIME_THRESHOLD"]:
            time_factor = 0.3
        elif walking_time_to_nearest_station > self.config["WALKING_TIME_THRESHOLD"]:
            time_factor = 0.15

        exposure_score = min(1.0, temp_factor * 0.5 + ac_factor + time_factor)
        return exposure_score

    def calculate_person_risk(
        self,
        person: ElderlyPerson,
        heat_forecast: Optional[HeatForecast] = None,
        travel_time: Optional[TravelTime] = None,
    ) -> RiskFactors:
        hourly_forecasts = []
        if heat_forecast:
            hourly_forecasts = [hf.to_dict() for hf in heat_forecast.hourly_forecasts]

        walking_time = travel_time.walking_minutes if travel_time else 30

        age_score = self.calculate_age_score(person.age)
        health_score = self.calculate_health_score(person.health_conditions)
        living_alone_score = self.calculate_living_alone_score(
            person.living_alone, person.needs_special_care
        )
        mobility_score = self.calculate_mobility_score(person.mobility)
        heat_exposure_score = self.calculate_heat_exposure_score(
            person.has_air_conditioning, hourly_forecasts, walking_time
        )

        total_score = (
            age_score * self.weights["age"]
            + health_score * self.weights["health"]
            + living_alone_score * self.weights["living_alone"]
            + mobility_score * self.weights["mobility"]
            + heat_exposure_score * self.weights["heat_exposure"]
        )

        risk_level = self._score_to_risk_level(total_score)

        return RiskFactors(
            age_score=age_score,
            health_score=health_score,
            living_alone_score=living_alone_score,
            mobility_score=mobility_score,
            heat_exposure_score=heat_exposure_score,
            total_score=total_score,
            risk_level=risk_level,
        )

    def _score_to_risk_level(self, score: float) -> str:
        if score >= 0.75:
            return RiskLevel.CRITICAL.value
        elif score >= 0.5:
            return RiskLevel.HIGH.value
        elif score >= 0.25:
            return RiskLevel.MEDIUM.value
        else:
            return RiskLevel.LOW.value

    def update_person_risk(
        self,
        person: ElderlyPerson,
        heat_forecast: Optional[HeatForecast] = None,
        travel_time: Optional[TravelTime] = None,
    ) -> ElderlyPerson:
        risk_factors = self.calculate_person_risk(person, heat_forecast, travel_time)
        person.risk_score = risk_factors.total_score
        person.risk_level = risk_factors.risk_level
        return person

    def calculate_community_risk_stats(
        self,
        persons: List[ElderlyPerson],
    ) -> Dict[str, Dict]:
        risk_distribution = {
            RiskLevel.LOW.value: 0,
            RiskLevel.MEDIUM.value: 0,
            RiskLevel.HIGH.value: 0,
            RiskLevel.CRITICAL.value: 0,
        }

        community_stats: Dict[str, Dict] = {}

        for person in persons:
            risk_distribution[person.risk_level] += 1
            community = person.community
            if community not in community_stats:
                community_stats[community] = {
                    "total": 0,
                    RiskLevel.LOW.value: 0,
                    RiskLevel.MEDIUM.value: 0,
                    RiskLevel.HIGH.value: 0,
                    RiskLevel.CRITICAL.value: 0,
                    "avg_risk_score": 0.0,
                    "high_risk_count": 0,
                }
            community_stats[community]["total"] += 1
            community_stats[community][person.risk_level] += 1
            if person.risk_level in [RiskLevel.HIGH.value, RiskLevel.CRITICAL.value]:
                community_stats[community]["high_risk_count"] += 1

        for community, stats in community_stats.items():
            high_risk = stats[RiskLevel.HIGH.value] + stats[RiskLevel.CRITICAL.value]
            if stats["total"] > 0:
                stats["high_risk_ratio"] = high_risk / stats["total"]
            else:
                stats["high_risk_ratio"] = 0

        return {
            "risk_distribution": risk_distribution,
            "community_stats": community_stats,
            "total_persons": len(persons),
        }


class HeatIndexCalculator:
    @staticmethod
    def calculate_heat_index(temperature: float, humidity: float) -> float:
        if temperature < 27:
            return temperature

        c1 = -8.78469475556
        c2 = 1.61139411
        c3 = 2.33854883889
        c4 = -0.14611605
        c5 = -0.012308094
        c6 = -0.0164248277778
        c7 = 0.002211732
        c8 = 0.00072546
        c9 = -0.000003582

        hi = (
            c1
            + c2 * temperature
            + c3 * humidity
            + c4 * temperature * humidity
            + c5 * temperature**2
            + c6 * humidity**2
            + c7 * temperature**2 * humidity
            + c8 * temperature * humidity**2
            + c9 * temperature**2 * humidity**2
        )
        return round(hi, 1)

    @staticmethod
    def feels_like_to_risk(feels_like: float) -> str:
        if feels_like >= 54:
            return "极端危险"
        elif feels_like >= 41:
            return "危险"
        elif feels_like >= 32:
            return "警告"
        elif feels_like >= 27:
            return "注意"
        else:
            return "安全"


def identify_risk_hotspots(
    persons: List[ElderlyPerson],
    stations: List[CoolingStation],
    grid_size: float = 0.01,
) -> List[Dict]:
    from collections import defaultdict

    def create_grid_key(lat: float, lon: float) -> Tuple[int, int]:
        return (int(lat / grid_size), int(lon / grid_size))

    grid_stats = defaultdict(lambda: {
        "count": 0,
        "high_risk_count": 0,
        "critical_risk_count": 0,
        "lat_sum": 0.0,
        "lon_sum": 0.0,
        "risk_score_sum": 0.0,
    })

    for person in persons:
        key = create_grid_key(person.latitude, person.longitude)
        stats = grid_stats[key]
        stats["count"] += 1
        stats["lat_sum"] += person.latitude
        stats["lon_sum"] += person.longitude
        stats["risk_score_sum"] += person.risk_score
        if person.risk_level == RiskLevel.HIGH.value:
            stats["high_risk_count"] += 1
        elif person.risk_level == RiskLevel.CRITICAL.value:
            stats["critical_risk_count"] += 1

    hotspots = []
    for key, stats in grid_stats.items():
        if stats["count"] > 0:
            avg_lat = stats["lat_sum"] / stats["count"]
            avg_lon = stats["lon_sum"] / stats["count"]
            avg_risk_score = stats["risk_score_sum"] / stats["count"]
            high_risk_total = stats["high_risk_count"] + stats["critical_risk_count"]

            nearest_station_dist = float("inf")
            for station in stations:
                dist = math.sqrt(
                    (station.latitude - avg_lat) ** 2
                    + (station.longitude - avg_lon) ** 2
                ) * 111
                if dist < nearest_station_dist:
                    nearest_station_dist = dist

            hotspot_severity = "低"
            if stats["critical_risk_count"] >= 3 or high_risk_total >= 5:
                hotspot_severity = "高"
            elif stats["critical_risk_count"] >= 1 or high_risk_total >= 3:
                hotspot_severity = "中"

            hotspots.append({
                "grid_key": key,
                "center_lat": avg_lat,
                "center_lon": avg_lon,
                "total_count": stats["count"],
                "high_risk_count": stats["high_risk_count"],
                "critical_risk_count": stats["critical_risk_count"],
                "high_risk_total": high_risk_total,
                "avg_risk_score": avg_risk_score,
                "nearest_station_km": round(nearest_station_dist, 2),
                "severity": hotspot_severity,
            })

    return sorted(hotspots, key=lambda x: x["high_risk_total"], reverse=True)
