import math
from dataclasses import dataclass
from typing import Optional, Tuple, List


@dataclass
class SmokeCalculationResult:
    smoke_layer_thickness: float
    smoke_temperature: float
    smoke_velocity: float
    visibility: float
    co_concentration: float
    critical_time: float
    is_safe: bool
    risk_level: str
    warnings: List[str]


class UnitConverter:
    @staticmethod
    def celsius_to_kelvin(c: float) -> float:
        return c + 273.15

    @staticmethod
    def kelvin_to_celsius(k: float) -> float:
        return k - 273.15

    @staticmethod
    def m_s_to_km_h(v: float) -> float:
        return v * 3.6

    @staticmethod
    def km_h_to_m_s(v: float) -> float:
        return v / 3.6

    @staticmethod
    def m3_s_to_m3_h(q: float) -> float:
        return q * 3600

    @staticmethod
    def m3_h_to_m3_s(q: float) -> float:
        return q / 3600

    @staticmethod
    def ppm_to_mg_m3(ppm: float, molar_mass: float = 28.01, temp: float = 25.0) -> float:
        return ppm * molar_mass / 24.45 * (273.15 / (273.15 + temp))

    @staticmethod
    def mg_m3_to_ppm(mg_m3: float, molar_mass: float = 28.01, temp: float = 25.0) -> float:
        return mg_m3 * 24.45 / molar_mass * ((273.15 + temp) / 273.15)


class Thresholds:
    VISIBILITY_MIN = 10.0
    CO_MAX_PPM = 100.0
    TEMP_MAX = 60.0
    VELOCITY_MIN = 1.0
    VELOCITY_MAX = 10.0

    @staticmethod
    def get_thresholds() -> dict:
        return {
            'visibility': {'min': 10.0, 'unit': 'm', 'description': '最小可见度'},
            'co_ppm': {'max': 100.0, 'unit': 'ppm', 'description': 'CO最大允许浓度'},
            'temperature': {'max': 60.0, 'unit': '°C', 'description': '烟气最高温度'},
            'velocity': {'min': 1.0, 'max': 10.0, 'unit': 'm/s', 'description': '风速合理范围'}
        }


class TunnelVentilationPhysics:
    GRAVITY = 9.81
    AMBIENT_TEMP = 20.0
    SMOKE_DENSITY_REF = 0.85

    def __init__(self, tunnel_params: dict):
        self.tunnel_width = tunnel_params.get('width', 10.0)
        self.tunnel_height = tunnel_params.get('height', 6.0)
        self.tunnel_length = tunnel_params.get('length', 1000.0)
        self.tunnel_area = self.tunnel_width * self.tunnel_height
        self.hydraulic_diameter = 4 * self.tunnel_area / (2 * (self.tunnel_width + self.tunnel_height))

    def calculate_smoke_layer_thickness(self, heat_release_rate: float, time: float, 
                                         distance_from_source: float) -> float:
        if time <= 0 or heat_release_rate <= 0:
            return 0.0

        Q_star = heat_release_rate / (1.2 * 1005 * self.AMBIENT_TEMP * 
                                      math.sqrt(self.GRAVITY * self.tunnel_height) * 
                                      self.tunnel_height ** 2)

        if Q_star < 0.15:
            delta_h = 0.037 * time ** (2 / 5) * (heat_release_rate / 1000) ** (1 / 3)
        else:
            delta_h = 0.54 * (heat_release_rate / 1000) ** (1 / 3) * time ** (1 / 2)

        delta_h = min(delta_h, self.tunnel_height * 0.8)
        distance_factor = max(0.3, 1 - 0.001 * distance_from_source)

        return delta_h * distance_factor

    def calculate_smoke_temperature(self, heat_release_rate: float, smoke_thickness: float,
                                     ventilation_velocity: float, distance_from_source: float) -> float:
        if smoke_thickness <= 0:
            return self.AMBIENT_TEMP

        mass_flow_rate = 1.2 * self.tunnel_area * ventilation_velocity
        heat_capacity = 1005.0

        if mass_flow_rate > 0:
            temp_rise = heat_release_rate / (mass_flow_rate * heat_capacity)
        else:
            temp_rise = heat_release_rate / (smoke_thickness * self.tunnel_width * 1.2 * heat_capacity)

        distance_decay = math.exp(-0.002 * distance_from_source)
        final_temp = self.AMBIENT_TEMP + temp_rise * distance_decay

        return min(final_temp, 800.0)

    def calculate_smoke_velocity(self, ventilation_velocity: float, smoke_thickness: float,
                                  heat_release_rate: float) -> float:
        buoyancy_velocity = math.sqrt(2 * self.GRAVITY * smoke_thickness * 
                                       (1 - self.SMOKE_DENSITY_REF))

        combined_velocity = math.sqrt(ventilation_velocity ** 2 + buoyancy_velocity ** 2)

        return min(combined_velocity, 15.0)

    def calculate_visibility(self, smoke_thickness: float, heat_release_rate: float,
                              distance_from_source: float) -> float:
        if smoke_thickness <= 0:
            return 100.0

        soot_concentration = 0.01 * (heat_release_rate / 1000) / max(smoke_thickness, 0.1)
        distance_effect = math.exp(-0.005 * distance_from_source)
        extinction_coefficient = 3.0 * soot_concentration * distance_effect

        if extinction_coefficient > 0:
            visibility = 3.0 / extinction_coefficient
        else:
            visibility = 100.0

        return min(visibility, 100.0)

    def calculate_co_concentration(self, heat_release_rate: float, ventilation_velocity: float,
                                    distance_from_source: float, time: float) -> float:
        if ventilation_velocity <= 0 or time <= 0:
            return 200.0

        co_yield = 0.005
        co_production = co_yield * heat_release_rate / 1000

        volume_flow_rate = self.tunnel_area * ventilation_velocity
        dilution_factor = volume_flow_rate * time / (self.tunnel_length * self.tunnel_area)
        distance_decay = math.exp(-0.003 * distance_from_source)

        co_ppm = (co_production / max(volume_flow_rate, 0.1)) * 1e6 * distance_decay / max(dilution_factor, 1.0)

        return min(co_ppm, 2000.0)

    def calculate_critical_time(self, heat_release_rate: float, ventilation_velocity: float) -> float:
        if ventilation_velocity < 0.5:
            return 60.0
        elif ventilation_velocity < 1.0:
            return 180.0
        elif ventilation_velocity < 2.0:
            return 300.0
        else:
            return 600.0

    def evaluate_safety(self, visibility: float, co_ppm: float, temp: float, 
                         velocity: float) -> Tuple[bool, str, List[str]]:
        warnings = []
        risk_score = 0
        any_critical = False

        if visibility < Thresholds.VISIBILITY_MIN:
            warnings.append(f"[危险] 可见度过低: {visibility:.1f}m (阈值: {Thresholds.VISIBILITY_MIN}m)")
            risk_score += 3
            any_critical = True

        if co_ppm > Thresholds.CO_MAX_PPM:
            warnings.append(f"[危险] CO浓度超标: {co_ppm:.1f}ppm (阈值: {Thresholds.CO_MAX_PPM}ppm)")
            risk_score += 3
            any_critical = True

        if temp > Thresholds.TEMP_MAX:
            warnings.append(f"[警告] 烟气温度过高: {temp:.1f}°C (阈值: {Thresholds.TEMP_MAX}°C)")
            risk_score += 2

        if velocity < Thresholds.VELOCITY_MIN:
            warnings.append(f"[警告] 通风风速不足: {velocity:.2f}m/s (最小值: {Thresholds.VELOCITY_MIN}m/s)")
            risk_score += 1
        elif velocity > Thresholds.VELOCITY_MAX:
            warnings.append(f"[注意] 风速过高: {velocity:.2f}m/s (最大值: {Thresholds.VELOCITY_MAX}m/s)")
            risk_score += 1

        if risk_score >= 6:
            return False, "极高风险", warnings
        elif risk_score >= 4:
            return False, "高风险", warnings
        elif any_critical:
            return False, "中风险", warnings
        elif risk_score >= 1:
            return True, "低风险(注意)", warnings
        else:
            return True, "低风险", warnings

    def calculate(self, sensor_data: dict, time_point: float) -> SmokeCalculationResult:
        hrr = sensor_data.get('heat_release_rate', 500.0)
        vent_velocity = sensor_data.get('ventilation_velocity', 2.0)
        distance = sensor_data.get('distance_from_source', 100.0)

        smoke_thickness = self.calculate_smoke_layer_thickness(hrr, time_point, distance)
        smoke_temp = self.calculate_smoke_temperature(hrr, smoke_thickness, vent_velocity, distance)
        smoke_velocity = self.calculate_smoke_velocity(vent_velocity, smoke_thickness, hrr)
        visibility = self.calculate_visibility(smoke_thickness, hrr, distance)
        co_ppm = self.calculate_co_concentration(hrr, vent_velocity, distance, time_point)
        critical_time = self.calculate_critical_time(hrr, vent_velocity)

        is_safe, risk_level, warnings = self.evaluate_safety(visibility, co_ppm, smoke_temp, smoke_velocity)

        return SmokeCalculationResult(
            smoke_layer_thickness=smoke_thickness,
            smoke_temperature=smoke_temp,
            smoke_velocity=smoke_velocity,
            visibility=visibility,
            co_concentration=co_ppm,
            critical_time=critical_time,
            is_safe=is_safe,
            risk_level=risk_level,
            warnings=warnings
        )
