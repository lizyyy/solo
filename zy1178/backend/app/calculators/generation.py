import math
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np

class GenerationCalculator:
    def __init__(self):
        self.performance_ratio = 0.75
        self.system_losses = 0.14
    
    def calculate_effective_irradiance(self,
                                        global_irradiance: float,
                                        shading_ratio: float = 0.0,
                                        inclination: float = 0.0) -> float:
        inclination_factor = math.cos(math.radians(inclination))
        effective = global_irradiance * inclination_factor * (1 - shading_ratio)
        return max(0, effective)
    
    def calculate_panel_temperature(self,
                                      ambient_temp: float,
                                      irradiance: float,
                                      wind_speed: float = 2.0) -> float:
        if irradiance <= 0:
            return ambient_temp
        
        temp_coefficient = 0.035
        wind_cooling = max(0, (wind_speed - 2) * 0.01)
        
        panel_temp = ambient_temp + irradiance * temp_coefficient * (1 - wind_cooling)
        return panel_temp
    
    def calculate_power_output(self,
                                rated_power: float,
                                efficiency: float,
                                irradiance: float,
                                panel_temp: float,
                                temperature_coefficient: float = -0.38,
                                shading_ratio: float = 0.0) -> float:
        if irradiance <= 0:
            return 0.0
        
        stc_irradiance = 1000
        stc_temp = 25
        
        irradiance_factor = irradiance / stc_irradiance
        
        temp_diff = panel_temp - stc_temp
        temp_factor = 1 + (temperature_coefficient / 100) * temp_diff
        
        power = rated_power * irradiance_factor * temp_factor * (1 - shading_ratio)
        power = power * (1 - self.system_losses)
        
        return max(0, power)
    
    def calculate_hourly_generation(self,
                                      hourly_data: List[Dict[str, Any]],
                                      panel_params: Dict[str, Any],
                                      shading_ratios: Optional[Dict[int, float]] = None,
                                      roof_inclination: float = 0.0) -> Dict[str, Any]:
        panel_power = panel_params.get('power', 300)
        panel_efficiency = panel_params.get('efficiency', 0.2)
        temperature_coefficient = panel_params.get('temperature_coefficient', -0.38)
        panel_count = panel_params.get('count', 1)
        
        total_kwh = 0.0
        monthly_generation = [0.0] * 12
        hourly_details = []
        
        for i, data in enumerate(hourly_data):
            try:
                timestamp = data.get('timestamp')
                if isinstance(timestamp, str):
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                
                irradiance = data.get('global_irradiance', 0)
                ambient_temp = data.get('temperature', 25)
                wind_speed = data.get('wind_speed', 2)
                
                shading_ratio = 0.0
                if shading_ratios and i in shading_ratios:
                    shading_ratio = shading_ratios[i]
                
                effective_irradiance = self.calculate_effective_irradiance(
                    irradiance, shading_ratio, roof_inclination
                )
                
                panel_temp = self.calculate_panel_temperature(
                    ambient_temp, effective_irradiance, wind_speed
                )
                
                power = self.calculate_power_output(
                    panel_power,
                    panel_efficiency,
                    effective_irradiance,
                    panel_temp,
                    temperature_coefficient,
                    shading_ratio
                )
                
                kwh = power * panel_count * self.performance_ratio / 1000
                total_kwh += kwh
                
                if timestamp:
                    month = timestamp.month - 1
                    monthly_generation[month] += kwh
                
                hourly_details.append({
                    'timestamp': data.get('timestamp'),
                    'irradiance': irradiance,
                    'effective_irradiance': effective_irradiance,
                    'panel_temp': panel_temp,
                    'power': power,
                    'kwh': kwh,
                    'shading_ratio': shading_ratio
                })
                
            except Exception as e:
                continue
        
        return {
            'total_kwh': total_kwh,
            'monthly_generation': monthly_generation,
            'hourly_details': hourly_details,
            'performance_ratio': self.performance_ratio,
            'system_losses': self.system_losses
        }
    
    def calculate_installable_capacity(self,
                                         roof_area: float,
                                         panel_width: float,
                                         panel_height: float,
                                         panel_power: float,
                                         spacing_ratio: float = 0.1) -> Dict[str, Any]:
        panel_area = panel_width * panel_height
        effective_area = roof_area * (1 - spacing_ratio)
        
        max_panels = int(effective_area / panel_area)
        installable_capacity = max_panels * panel_power / 1000
        
        return {
            'max_panels': max_panels,
            'installable_capacity_kw': installable_capacity,
            'panel_area': panel_area,
            'effective_roof_area': effective_area,
            'spacing_ratio': spacing_ratio
        }
