"""DLI (日光积分) 计算器"""

from typing import Dict, List, Optional
import uuid
from datetime import datetime

from ..models import (
    CropZone, LEDSpectrum, SensorData, ElectricityPrice,
    LightPlan, SupplementInterval,
    ZoneResult, CalculationResult
)


class DLICalculator:
    
    PPFD_TO_DLI_FACTOR = 0.0036
    
    def __init__(self):
        pass
    
    def calculate_natural_dli_from_sensor(
        self,
        sensor_data: SensorData,
        photoperiod_start_hour: int = 6,
        photoperiod_end_hour: int = 18
    ) -> float:
        
        hourly_ppfd = sensor_data.get_daily_ppfd_profile()
        
        total_dli = 0.0
        for hour in range(photoperiod_start_hour, photoperiod_end_hour):
            ppfd = hourly_ppfd.get(hour, 0)
            dli_contribution = ppfd * 1.0 * self.PPFD_TO_DLI_FACTOR
            total_dli += dli_contribution
        
        return total_dli
    
    def calculate_hourly_natural_dli(
        self,
        sensor_data: SensorData,
        hour: int
    ) -> float:
        
        hourly_ppfd = sensor_data.get_daily_ppfd_profile()
        ppfd = hourly_ppfd.get(hour, 0)
        return ppfd * 1.0 * self.PPFD_TO_DLI_FACTOR
    
    def calculate_supplemental_dli(
        self,
        zone: CropZone,
        spectrum: LEDSpectrum,
        intervals: List[SupplementInterval]
    ) -> float:
        
        total_dli = 0.0
        
        for interval in intervals:
            if interval.zone_id != zone.zone_id:
                continue
            
            power_factor = interval.power_percentage / 100.0
            ppfd = spectrum.photon_flux_density * power_factor
            duration_hours = interval.duration_hours
            
            dli_contribution = ppfd * duration_hours * self.PPFD_TO_DLI_FACTOR
            total_dli += dli_contribution
        
        return total_dli
    
    def calculate_supplemental_ppfd(
        self,
        spectrum: LEDSpectrum,
        power_percentage: float
    ) -> float:
        
        return spectrum.photon_flux_density * (power_percentage / 100.0)
    
    def calculate_dli_from_ppfd(
        self,
        ppfd: float,
        duration_hours: float
    ) -> float:
        
        return ppfd * duration_hours * self.PPFD_TO_DLI_FACTOR
    
    def calculate_required_ppfd_for_dli(
        self,
        target_dli: float,
        available_hours: float
    ) -> float:
        
        if available_hours <= 0:
            return 0.0
        
        return target_dli / (available_hours * self.PPFD_TO_DLI_FACTOR)
    
    def calculate_light_hours(
        self,
        hourly_ppfd: Dict[int, float],
        threshold_ppfd: float = 10.0
    ) -> float:
        
        hours = 0.0
        for hour, ppfd in hourly_ppfd.items():
            if ppfd >= threshold_ppfd:
                hours += 1.0
        return hours


class SpectrumAnalyzer:
    
    def __init__(self):
        pass
    
    def analyze_spectrum(
        self,
        spectrum: LEDSpectrum
    ) -> Dict[str, float]:
        
        analysis = {
            "total_power": spectrum.total_power,
            "photon_flux_density": spectrum.photon_flux_density,
            "blue_ratio": spectrum.blue_ratio,
            "red_ratio": spectrum.red_ratio,
            "far_red_ratio": spectrum.far_red_ratio,
            "blue_red_ratio": spectrum.blue_red_ratio,
        }
        
        wavelength_ranges = {
            "UV": (300, 400),
            "blue": (400, 500),
            "green": (500, 600),
            "red": (600, 700),
            "far_red": (700, 800),
            "IR": (800, 1100),
        }
        
        for channel in spectrum.channels:
            for range_name, (min_wl, max_wl) in wavelength_ranges.items():
                if min_wl <= channel.wavelength_nm < max_wl:
                    analysis[f"{range_name}_ratio"] = channel.intensity_ratio
                    break
        
        return analysis
    
    def check_spectrum_requirements(
        self,
        spectrum: LEDSpectrum,
        requirements: Dict[str, float]
    ) -> Dict[str, dict]:
        
        results = {}
        
        for req_name, target_ratio in requirements.items():
            actual_ratio = 0.0
            
            req_name_lower = req_name.lower()
            if "blue" in req_name_lower:
                actual_ratio = spectrum.blue_ratio
            elif "red" in req_name_lower and "far" not in req_name_lower:
                actual_ratio = spectrum.red_ratio
            elif "far_red" in req_name_lower or "far-red" in req_name_lower:
                actual_ratio = spectrum.far_red_ratio
            else:
                for channel in spectrum.channels:
                    if req_name.lower() in channel.wavelength_range.lower():
                        actual_ratio = channel.intensity_ratio
                        break
            
            ratio_diff = actual_ratio - target_ratio
            within_tolerance = abs(ratio_diff) <= 0.05
            
            results[req_name] = {
                "target": target_ratio,
                "actual": actual_ratio,
                "difference": ratio_diff,
                "within_tolerance": within_tolerance,
                "status": "ok" if within_tolerance else ("too_high" if ratio_diff > 0 else "too_low")
            }
        
        return results
    
    def get_recommended_spectrum(
        self,
        crop_type: str
    ) -> Dict[str, float]:
        
        recommendations = {
            "leafy_lettuce": {
                "blue_ratio": 0.25,
                "red_ratio": 0.65,
                "far_red_ratio": 0.10,
                "blue_red_ratio": 0.38
            },
            "tomato": {
                "blue_ratio": 0.20,
                "red_ratio": 0.70,
                "far_red_ratio": 0.10,
                "blue_red_ratio": 0.29
            },
            "strawberry": {
                "blue_ratio": 0.30,
                "red_ratio": 0.60,
                "far_red_ratio": 0.10,
                "blue_red_ratio": 0.50
            },
            "herb": {
                "blue_ratio": 0.20,
                "red_ratio": 0.70,
                "far_red_ratio": 0.10,
                "blue_red_ratio": 0.29
            },
            "general": {
                "blue_ratio": 0.20,
                "red_ratio": 0.70,
                "far_red_ratio": 0.10,
                "blue_red_ratio": 0.29
            }
        }
        
        return recommendations.get(crop_type.lower(), recommendations["general"])


class EnergyCostCalculator:
    
    def __init__(self):
        pass
    
    def calculate_interval_energy(
        self,
        zone: CropZone,
        interval: SupplementInterval
    ) -> float:
        
        power_kw = zone.installed_power / 1000.0
        power_factor = interval.power_percentage / 100.0
        duration_hours = interval.duration_hours
        
        energy_kwh = power_kw * power_factor * duration_hours
        return energy_kwh
    
    def calculate_interval_cost(
        self,
        energy_kwh: float,
        start_hour: int,
        electricity_price: ElectricityPrice
    ) -> float:
        
        price_per_kwh = electricity_price.get_price_for_hour(start_hour)
        return energy_kwh * price_per_kwh
    
    def calculate_zone_energy(
        self,
        zone: CropZone,
        intervals: List[SupplementInterval]
    ) -> float:
        
        total_energy = 0.0
        
        for interval in intervals:
            if interval.zone_id == zone.zone_id:
                total_energy += self.calculate_interval_energy(zone, interval)
        
        return total_energy
    
    def calculate_zone_cost(
        self,
        zone: CropZone,
        intervals: List[SupplementInterval],
        electricity_price: ElectricityPrice
    ) -> float:
        
        total_cost = 0.0
        
        for interval in intervals:
            if interval.zone_id == zone.zone_id:
                energy = self.calculate_interval_energy(zone, interval)
                cost = self.calculate_interval_cost(
                    energy,
                    interval.start_hour,
                    electricity_price
                )
                total_cost += cost
        
        return total_cost
    
    def calculate_total_energy(
        self,
        zones: List[CropZone],
        intervals: List[SupplementInterval]
    ) -> float:
        
        total_energy = 0.0
        
        zone_map = {z.zone_id: z for z in zones}
        
        for interval in intervals:
            zone = zone_map.get(interval.zone_id)
            if zone:
                total_energy += self.calculate_interval_energy(zone, interval)
        
        return total_energy
    
    def calculate_total_cost(
        self,
        zones: List[CropZone],
        intervals: List[SupplementInterval],
        electricity_price: ElectricityPrice
    ) -> float:
        
        total_cost = 0.0
        
        zone_map = {z.zone_id: z for z in zones}
        
        for interval in intervals:
            zone = zone_map.get(interval.zone_id)
            if zone:
                energy = self.calculate_interval_energy(zone, interval)
                cost = self.calculate_interval_cost(
                    energy,
                    interval.start_hour,
                    electricity_price
                )
                total_cost += cost
        
        return total_cost
    
    def calculate_hourly_energy_cost(
        self,
        zones: List[CropZone],
        light_plan: LightPlan,
        electricity_price: ElectricityPrice
    ) -> Dict[int, Dict]:
        
        hourly_data = {}
        
        for hour in range(24):
            hourly_data[hour] = {
                "hour": hour,
                "active_zones": [],
                "total_power_kw": 0.0,
                "energy_kwh": 0.0,
                "price_per_kwh": electricity_price.get_price_for_hour(hour),
                "cost": 0.0
            }
        
        zone_map = {z.zone_id: z for z in zones}
        
        for interval in light_plan.intervals:
            zone = zone_map.get(interval.zone_id)
            if not zone:
                continue
            
            power_kw = zone.installed_power / 1000.0
            power_factor = interval.power_percentage / 100.0
            actual_power_kw = power_kw * power_factor
            
            hours = []
            if interval.end_hour >= interval.start_hour:
                hours = range(interval.start_hour, interval.end_hour)
            else:
                hours = list(range(interval.start_hour, 24)) + list(range(0, interval.end_hour))
            
            for hour in hours:
                if hour in hourly_data:
                    hourly_data[hour]["active_zones"].append(zone.zone_id)
                    hourly_data[hour]["total_power_kw"] += actual_power_kw
                    hourly_data[hour]["energy_kwh"] = hourly_data[hour]["total_power_kw"]
                    hourly_data[hour]["cost"] = (
                        hourly_data[hour]["energy_kwh"] * hourly_data[hour]["price_per_kwh"]
                    )
        
        return hourly_data


class CalculationEngine:
    
    def __init__(self):
        self.dli_calculator = DLICalculator()
        self.spectrum_analyzer = SpectrumAnalyzer()
        self.energy_calculator = EnergyCostCalculator()
    
    def calculate_all(
        self,
        zones: List[CropZone],
        spectra: List[LEDSpectrum],
        sensors: List[SensorData],
        electricity_price: ElectricityPrice,
        light_plan: LightPlan,
        budget_limit: Optional[float] = None,
        base_date: str = ""
    ) -> CalculationResult:
        
        result_id = str(uuid.uuid4())
        calculated_at = datetime.now().isoformat()
        
        zone_results = []
        
        spectrum_map = {s.spectrum_id: s for s in spectra}
        sensor_map = {s.sensor_id: s for s in sensors}
        
        total_natural_dli = 0.0
        total_supplemental_dli = 0.0
        total_dli = 0.0
        
        for zone in zones:
            zone_result = self._calculate_zone_result(
                zone,
                spectrum_map,
                sensor_map,
                light_plan,
                electricity_price
            )
            zone_results.append(zone_result)
            
            total_natural_dli += zone_result.natural_dli
            total_supplemental_dli += zone_result.supplemental_dli
            total_dli += zone_result.total_dli
        
        total_estimated_energy = self.energy_calculator.calculate_total_energy(
            zones, light_plan.intervals
        )
        
        total_estimated_cost = self.energy_calculator.calculate_total_cost(
            zones, light_plan.intervals, electricity_price
        )
        
        budget_utilization = 0.0
        if budget_limit is not None and budget_limit > 0:
            budget_utilization = total_estimated_cost / budget_limit
        
        overall_risk_level = self._determine_overall_risk(zone_results)
        all_warnings = []
        for zr in zone_results:
            all_warnings.extend(zr.warnings)
        
        return CalculationResult(
            result_id=result_id,
            calculated_at=calculated_at,
            base_date=base_date,
            zone_results=zone_results,
            total_natural_dli=total_natural_dli,
            total_supplemental_dli=total_supplemental_dli,
            total_dli=total_dli,
            total_estimated_energy=total_estimated_energy,
            total_estimated_cost=total_estimated_cost,
            budget_limit=budget_limit,
            budget_utilization=budget_utilization,
            overall_risk_level=overall_risk_level,
            all_warnings=all_warnings
        )
    
    def _calculate_zone_result(
        self,
        zone: CropZone,
        spectrum_map: Dict[str, LEDSpectrum],
        sensor_map: Dict[str, SensorData],
        light_plan: LightPlan,
        electricity_price: ElectricityPrice
    ) -> ZoneResult:
        
        threshold = zone.light_threshold
        
        sensor = sensor_map.get(zone.sensor_id)
        natural_dli = 0.0
        natural_light_hours = 0.0
        
        if sensor:
            natural_dli = self.dli_calculator.calculate_natural_dli_from_sensor(
                sensor,
                photoperiod_start_hour=zone.photoperiod_start.hour,
                photoperiod_end_hour=zone.photoperiod_end.hour
            )
            
            hourly_ppfd = sensor.get_daily_ppfd_profile()
            natural_light_hours = self.dli_calculator.calculate_light_hours(hourly_ppfd)
        
        spectrum = spectrum_map.get(zone.led_spectrum_id)
        supplemental_dli = 0.0
        blue_red_ratio = 0.0
        spectrum_analysis = {}
        
        if spectrum:
            supplemental_dli = self.dli_calculator.calculate_supplemental_dli(
                zone, spectrum, light_plan.intervals
            )
            blue_red_ratio = spectrum.blue_red_ratio
            spectrum_analysis = self.spectrum_analyzer.analyze_spectrum(spectrum)
        
        zone_intervals = light_plan.get_intervals_for_zone(zone.zone_id)
        supplemental_light_hours = sum(i.duration_hours for i in zone_intervals)
        
        estimated_energy = self.energy_calculator.calculate_zone_energy(
            zone, light_plan.intervals
        )
        
        estimated_cost = self.energy_calculator.calculate_zone_cost(
            zone, light_plan.intervals, electricity_price
        )
        
        total_dli = natural_dli + supplemental_dli
        
        warnings = []
        risk_level = "low"
        
        if total_dli < threshold.min_dli:
            warnings.append(
                f"DLI不足: {total_dli:.1f} < 最小阈值 {threshold.min_dli:.1f}"
            )
            risk_level = "high"
        elif total_dli > threshold.max_dli:
            warnings.append(
                f"DLI过量: {total_dli:.1f} > 最大阈值 {threshold.max_dli:.1f} (烧苗风险)"
            )
            risk_level = "high"
        
        if total_dli < threshold.target_dli * 0.9:
            warnings.append(
                f"DLI未达目标: {total_dli:.1f} < 目标 {threshold.target_dli:.1f}"
            )
            if risk_level == "low":
                risk_level = "medium"
        
        hourly_analysis = self._calculate_hourly_analysis(
            zone, sensor, spectrum, zone_intervals, electricity_price
        )
        
        return ZoneResult(
            zone_id=zone.zone_id,
            zone_name=zone.zone_name,
            crop_type=zone.crop_type,
            natural_dli=natural_dli,
            supplemental_dli=supplemental_dli,
            total_dli=total_dli,
            target_dli=threshold.target_dli,
            min_dli=threshold.min_dli,
            max_dli=threshold.max_dli,
            natural_light_hours=natural_light_hours,
            supplemental_light_hours=supplemental_light_hours,
            blue_red_ratio=blue_red_ratio,
            spectrum_analysis=spectrum_analysis,
            estimated_energy=estimated_energy,
            estimated_cost=estimated_cost,
            risk_level=risk_level,
            warnings=warnings,
            hourly_analysis=hourly_analysis
        )
    
    def _calculate_hourly_analysis(
        self,
        zone: CropZone,
        sensor: SensorData,
        spectrum: LEDSpectrum,
        intervals: List[SupplementInterval],
        electricity_price: ElectricityPrice
    ) -> Dict[int, Dict]:
        
        hourly_data = {}
        
        for hour in range(24):
            hourly_data[hour] = {
                "hour": hour,
                "natural_ppfd": 0.0,
                "supplemental_ppfd": 0.0,
                "total_ppfd": 0.0,
                "natural_dli": 0.0,
                "supplemental_dli": 0.0,
                "total_dli": 0.0,
                "power_percentage": 0.0,
                "price_per_kwh": electricity_price.get_price_for_hour(hour),
                "in_photoperiod": self._is_in_photoperiod(hour, zone)
            }
        
        if sensor:
            hourly_ppfd = sensor.get_daily_ppfd_profile()
            for hour, ppfd in hourly_ppfd.items():
                if hour in hourly_data:
                    hourly_data[hour]["natural_ppfd"] = ppfd
                    hourly_data[hour]["natural_dli"] = self.dli_calculator.calculate_hourly_natural_dli(
                        sensor, hour
                    )
        
        if spectrum:
            for interval in intervals:
                hours = []
                if interval.end_hour >= interval.start_hour:
                    hours = range(interval.start_hour, interval.end_hour)
                else:
                    hours = list(range(interval.start_hour, 24)) + list(range(0, interval.end_hour))
                
                supplemental_ppfd = self.dli_calculator.calculate_supplemental_ppfd(
                    spectrum, interval.power_percentage
                )
                supplemental_dli = self.dli_calculator.calculate_dli_from_ppfd(
                    supplemental_ppfd, 1.0
                )
                
                for hour in hours:
                    if hour in hourly_data:
                        hourly_data[hour]["supplemental_ppfd"] = supplemental_ppfd
                        hourly_data[hour]["supplemental_dli"] = supplemental_dli
                        hourly_data[hour]["power_percentage"] = interval.power_percentage
                        hourly_data[hour]["total_ppfd"] = (
                            hourly_data[hour]["natural_ppfd"] + supplemental_ppfd
                        )
                        hourly_data[hour]["total_dli"] = (
                            hourly_data[hour]["natural_dli"] + supplemental_dli
                        )
        
        return hourly_data
    
    def _is_in_photoperiod(
        self,
        hour: int,
        zone: CropZone
    ) -> bool:
        
        start_hour = zone.photoperiod_start.hour
        end_hour = zone.photoperiod_end.hour
        
        if start_hour <= end_hour:
            return start_hour <= hour < end_hour
        else:
            return hour >= start_hour or hour < end_hour
    
    def _determine_overall_risk(
        self,
        zone_results: List[ZoneResult]
    ) -> str:
        
        has_high_risk = any(zr.risk_level == "high" for zr in zone_results)
        has_medium_risk = any(zr.risk_level == "medium" for zr in zone_results)
        
        if has_high_risk:
            return "high"
        elif has_medium_risk:
            return "medium"
        else:
            return "low"
