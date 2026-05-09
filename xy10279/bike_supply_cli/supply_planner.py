from typing import List, Dict, Any, Tuple
from .models import (
    GPXPoint, RouteProfile, Weather, ParticipantGroup, SupplyStation, ClimbSegment
)


class SupplyPlanner:
    BASE_INTERVAL_KM = 25.0
    BEGINNER_FACTOR = 1.4
    INTERMEDIATE_FACTOR = 1.0
    ADVANCED_FACTOR = 0.7
    HOT_WEATHER_THRESHOLD = 28.0
    HIGH_HUMIDITY_THRESHOLD = 75.0
    CLIMB_STRESS_THRESHOLD = 300.0

    def __init__(
        self,
        points: List[GPXPoint],
        profile: RouteProfile,
        weather: Weather,
        participants: ParticipantGroup
    ):
        self.points = points
        self.profile = profile
        self.weather = weather
        self.participants = participants

    def plan(self) -> Tuple[List[SupplyStation], Dict[str, Any]]:
        stations = []
        station_id = 1
        
        candidate_positions = self._generate_candidates()
        visited = set()

        for pos, reason, station_type in candidate_positions:
            pos_key = round(pos, 1)
            if pos_key in visited:
                continue
            visited.add(pos_key)
            
            station = self._create_station(station_id, pos, station_type, reason)
            stations.append(station)
            station_id += 1

        stations = self._merge_close_stations(stations)
        stations.sort(key=lambda s: s.distance_km)
        
        for i, s in enumerate(stations):
            s.id = f"S{i+1:02d}"

        totals = self._calculate_totals(stations)
        return stations, totals

    def _generate_candidates(self) -> List[Tuple[float, str, str]]:
        candidates = []
        
        level_factor = self._get_level_factor()
        adjusted_interval = self.BASE_INTERVAL_KM * level_factor
        heat_factor = self._get_heat_factor()
        
        total_dist = self.profile.total_distance_km
        pos = adjusted_interval
        
        while pos < total_dist:
            candidates.append((pos, "定时补给", "regular"))
            pos += adjusted_interval
        
        for i, climb in enumerate(self.profile.climbs):
            climb_mid = self.points[climb.start_index].distance
            if climb_mid > 0:
                candidates.append((climb_mid, f"爬坡前补给 (C{i+1}: +{climb.elevation_gain:.0f}m, {climb.avg_gradient:.1f}%)", "climb_start"))
            
            if climb.elevation_gain >= self.CLIMB_STRESS_THRESHOLD:
                mid_point_idx = (climb.start_index + climb.end_index) // 2
                mid_dist = self.points[mid_point_idx].distance
                candidates.append((mid_dist, f"爬坡中途补给 (C{i+1}: 高强度)", "climb_mid"))
            
            climb_end_dist = self.points[climb.end_index].distance
            candidates.append((climb_end_dist, f"爬坡后恢复 (C{i+1})", "recovery"))
        
        if heat_factor > 1.1:
            extra_interval = adjusted_interval / 2
            pos = extra_interval
            while pos < total_dist:
                candidates.append((pos, "高温补水", "heat"))
                pos += adjusted_interval

        return candidates

    def _get_level_factor(self) -> float:
        level = self.participants.level.lower()
        if level in ("beginner", "入门"):
            return self.BEGINNER_FACTOR
        elif level in ("advanced", "pro", "精英", "进阶"):
            return self.ADVANCED_FACTOR
        return self.INTERMEDIATE_FACTOR

    def _get_heat_factor(self) -> float:
        factor = 1.0
        if self.weather.temperature >= self.HOT_WEATHER_THRESHOLD:
            factor += 0.15
        if self.weather.humidity >= self.HIGH_HUMIDITY_THRESHOLD:
            factor += 0.10
        if self.weather.uv_index >= 8:
            factor += 0.05
        return factor

    def _create_station(
        self, station_id: int, distance_km: float, station_type: str, reason: str
    ) -> SupplyStation:
        closest_point = self._find_closest_point(distance_km)
        elevation = closest_point.elevation if closest_point else 0.0
        
        materials = self._calculate_materials(distance_km, station_type)
        name = self._generate_name(distance_km, station_type)
        
        return SupplyStation(
            id=f"S{station_id:02d}",
            name=name,
            distance_km=round(distance_km, 2),
            elevation=round(elevation, 1),
            type=station_type,
            materials=materials,
            reason=reason
        )

    def _find_closest_point(self, target_km: float) -> GPXPoint:
        if not self.points:
            return GPXPoint(lat=0, lon=0, elevation=0, distance=target_km)
        
        closest = self.points[0]
        min_diff = abs(closest.distance - target_km)
        
        for p in self.points:
            diff = abs(p.distance - target_km)
            if diff < min_diff:
                min_diff = diff
                closest = p
        
        return closest

    def _calculate_materials(self, distance_km: float, station_type: str) -> Dict[str, float]:
        level_factor = self._get_level_factor()
        heat_factor = self._get_heat_factor()
        
        avg_speed = self.participants.avg_speed_kmh
        hours_so_far = distance_km / avg_speed if avg_speed > 0 else 0
        hours_since_start = max(hours_so_far, 0.5)
        
        water_base = self.participants.water_per_person_per_hour
        food_base = self.participants.food_per_person_per_hour
        
        water_per = water_base * heat_factor * 1.2
        food_per = food_base * level_factor * 1.2
        
        count = self.participants.count
        
        if station_type in ("climb_start", "climb_mid"):
            water_per *= 1.3
            food_per *= 1.25
        elif station_type == "heat":
            water_per *= 1.4
        elif station_type == "recovery":
            food_per *= 1.3
        
        water_total = round(water_per * count, 1)
        food_total = round(food_per * count, 1)
        electrolytes = round(count * 0.5, 1)
        gels = round(count * 0.8, 0)
        
        return {
            "water_liters": water_total,
            "food_kg": food_total,
            "electrolytes_packs": electrolytes,
            "energy_gels": int(gels)
        }

    def _generate_name(self, distance_km: float, station_type: str) -> str:
        type_names = {
            "regular": "补给站",
            "climb_start": "爬坡补给",
            "climb_mid": "爬坡中续",
            "recovery": "恢复补给",
            "heat": "降温补水"
        }
        type_name = type_names.get(station_type, "补给站")
        return f"K{int(distance_km)}km{type_name}"

    def _merge_close_stations(self, stations: List[SupplyStation]) -> List[SupplyStation]:
        if len(stations) < 2:
            return stations
        
        stations.sort(key=lambda s: s.distance_km)
        merged = []
        threshold_km = 2.0
        
        for station in stations:
            if not merged:
                merged.append(station)
                continue
            
            last = merged[-1]
            if station.distance_km - last.distance_km < threshold_km:
                merged_materials = {
                    k: max(last.materials.get(k, 0), station.materials.get(k, 0))
                    for k in set(last.materials.keys()) | set(station.materials.keys())
                }
                
                last.name = f"K{int(last.distance_km)}km综合补给"
                last.materials = merged_materials
                last.reason = f"{last.reason} + {station.reason}"
                last.type = "combined"
            else:
                merged.append(station)
        
        return merged

    def _calculate_totals(self, stations: List[SupplyStation]) -> Dict[str, Any]:
        totals = {
            "total_water_liters": 0.0,
            "total_food_kg": 0.0,
            "total_electrolytes_packs": 0.0,
            "total_energy_gels": 0,
            "station_count": len(stations),
            "participant_count": self.participants.count,
            "participant_level": self.participants.level,
            "weather_temperature": self.weather.temperature,
            "weather_humidity": self.weather.humidity
        }
        
        for station in stations:
            totals["total_water_liters"] += station.materials.get("water_liters", 0)
            totals["total_food_kg"] += station.materials.get("food_kg", 0)
            totals["total_electrolytes_packs"] += station.materials.get("electrolytes_packs", 0)
            totals["total_energy_gels"] += station.materials.get("energy_gels", 0)
        
        for k in ["total_water_liters", "total_food_kg", "total_electrolytes_packs"]:
            totals[k] = round(totals[k], 1)
        
        return totals
