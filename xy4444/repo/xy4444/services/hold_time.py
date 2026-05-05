from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from config import settings


class HoldTimeCalculator:
    @staticmethod
    def calculate_hold_time(
        concentration: float,
        temperature: float,
        precipitation_type: Optional[str] = None,
        precipitation_intensity: Optional[str] = None,
        wind_speed: Optional[float] = None,
        deice_type: str = "Type I"
    ) -> Dict[str, Any]:
        base_hold_time = HoldTimeCalculator._get_base_hold_time(
            concentration, temperature, deice_type
        )
        
        adjustment_factor = HoldTimeCalculator._calculate_adjustment_factor(
            precipitation_type, precipitation_intensity, wind_speed
        )
        
        adjusted_hold_time = int(base_hold_time * adjustment_factor)
        adjusted_hold_time = max(5, adjusted_hold_time)
        
        expiry_time = datetime.utcnow() + timedelta(minutes=adjusted_hold_time)
        
        status = HoldTimeCalculator._determine_status(adjusted_hold_time)
        
        return {
            "hold_time_minutes": adjusted_hold_time,
            "hold_time_expiry": expiry_time,
            "hold_time_status": status,
            "base_hold_time": base_hold_time,
            "adjustment_factor": adjustment_factor
        }
    
    @staticmethod
    def _get_base_hold_time(
        concentration: float, 
        temperature: float, 
        deice_type: str
    ) -> int:
        type_i_table = {
            0.5: {0: 15, -5: 12, -10: 10, -15: 8, -20: 6},
            0.6: {0: 20, -5: 18, -10: 15, -15: 12, -20: 10},
            0.7: {0: 25, -5: 22, -10: 20, -15: 18, -20: 15},
            0.8: {0: 30, -5: 28, -10: 25, -15: 22, -20: 20}
        }
        
        type_ii_table = {
            0.5: {0: 20, -5: 18, -10: 15, -15: 12, -20: 10},
            0.6: {0: 30, -5: 25, -10: 22, -15: 18, -20: 15},
            0.7: {0: 40, -5: 35, -10: 30, -15: 25, -20: 20},
            0.8: {0: 50, -5: 45, -10: 40, -15: 35, -20: 30}
        }
        
        table = type_ii_table if deice_type == "Type II" else type_i_table
        
        nearest_conc = min(table.keys(), key=lambda x: abs(x - concentration))
        temp_keys = sorted(table[nearest_conc].keys())
        nearest_temp = min(temp_keys, key=lambda x: abs(x - temperature))
        
        return table[nearest_conc][nearest_temp]
    
    @staticmethod
    def _calculate_adjustment_factor(
        precipitation_type: Optional[str],
        precipitation_intensity: Optional[str],
        wind_speed: Optional[float]
    ) -> float:
        factor = 1.0
        
        if precipitation_type == "freezing_rain":
            factor *= 0.6 if precipitation_intensity == "heavy" else 0.8
        elif precipitation_type == "snow":
            factor *= 0.7 if precipitation_intensity == "heavy" else 0.9
        elif precipitation_type == "rain":
            factor *= 0.8 if precipitation_intensity == "heavy" else 0.95
        
        if wind_speed and wind_speed > 15:
            wind_factor = max(0.7, 1.0 - (wind_speed - 15) * 0.01)
            factor *= wind_factor
        
        return factor
    
    @staticmethod
    def _determine_status(hold_time: int) -> str:
        if hold_time >= 30:
            return "good"
        elif hold_time >= 15:
            return "warning"
        else:
            return "critical"
    
    @staticmethod
    def is_hold_time_expired(expiry_time: datetime) -> bool:
        return datetime.utcnow() >= expiry_time
