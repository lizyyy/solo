from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from config import settings


class SecondDeiceChecker:
    @staticmethod
    def check_second_deice(
        first_deice_time: datetime,
        current_time: datetime,
        hold_time_minutes: int,
        concentration_status: str,
        weather_conditions: Optional[Dict] = None,
        precipitation_occurred: bool = False,
        previous_deice_rounds: int = 0
    ) -> Dict[str, Any]:
        reasons = []
        is_required = False
        
        elapsed_minutes = (current_time - first_deice_time).total_seconds() / 60
        remaining_minutes = hold_time_minutes - elapsed_minutes
        
        if elapsed_minutes >= hold_time_minutes:
            is_required = True
            reasons.append({
                "code": "HOLD_TIME_EXPIRED",
                "reason": "保持时间已过期",
                "details": f"已过 {elapsed_minutes:.1f} 分钟，超出保持时间 {hold_time_minutes} 分钟"
            })
        
        elif remaining_minutes < 10:
            is_required = True
            reasons.append({
                "code": "HOLD_TIME_LOW",
                "reason": "保持时间不足",
                "details": f"剩余保持时间 {remaining_minutes:.1f} 分钟，建议二次除冰"
            })
        
        if concentration_status == "critical":
            is_required = True
            reasons.append({
                "code": "CONCENTRATION_CRITICAL",
                "reason": "浓度严重偏差",
                "details": "除冰液浓度严重偏离标准，建议二次除冰"
            })
        
        if weather_conditions:
            is_required = SecondDeiceChecker._check_weather_conditions(
                weather_conditions, reasons, is_required
            )
        
        if precipitation_occurred:
            is_required = True
            reasons.append({
                "code": "PRECIPITATION_OCCURRED",
                "reason": "期间有降水",
                "details": "首次除冰后有降水发生，建议二次除冰"
            })
        
        if previous_deice_rounds >= 2:
            is_required = True
            reasons.append({
                "code": "MULTIPLE_DEICE_ROUNDS",
                "reason": "已多次除冰",
                "details": f"已进行 {previous_deice_rounds} 次除冰，建议评估是否需要重新除冰"
            })
        
        overall_reason = "; ".join([r["reason"] for r in reasons]) if reasons else None
        
        return {
            "is_second_deicing_required": is_required,
            "second_deicing_reason": overall_reason,
            "deice_rounds": previous_deice_rounds + (1 if is_required else 0),
            "elapsed_minutes": round(elapsed_minutes, 1),
            "remaining_hold_time": round(remaining_minutes, 1),
            "reasons": reasons
        }
    
    @staticmethod
    def _check_weather_conditions(
        weather: Dict,
        reasons: List,
        current_is_required: bool
    ) -> bool:
        is_required = current_is_required
        
        temp = weather.get("temperature")
        wind_speed = weather.get("wind_speed")
        is_freezing_rain = weather.get("is_freezing_rain", False)
        is_snow = weather.get("is_snow", False)
        precipitation_intensity = weather.get("precipitation_intensity")
        
        if is_freezing_rain:
            intensity_desc = "强" if precipitation_intensity == "heavy" else ""
            is_required = True
            reasons.append({
                "code": "FREEZING_RAIN",
                "reason": f"{intensity_desc}冻雨",
                "details": f"当前有{intensity_desc}冻雨，严重影响防冰效果，必须二次除冰"
            })
        
        if is_snow and precipitation_intensity == "heavy":
            is_required = True
            reasons.append({
                "code": "HEAVY_SNOW",
                "reason": "强降雪",
                "details": "当前强降雪，建议二次除冰"
            })
        
        if wind_speed and wind_speed > 25:
            is_required = True
            reasons.append({
                "code": "HIGH_WIND",
                "reason": "大风",
                "details": f"风速 {wind_speed} 节，加速除冰液流失，建议检查是否需要二次除冰"
            })
        
        if temp and temp < -15:
            reasons.append({
                "code": "EXTREME_COLD",
                "reason": "极寒天气",
                "details": f"温度 {temp}°C，建议缩短保持时间间隔",
                "requires_second_deice": False
            })
        
        return is_required
    
    @staticmethod
    def get_deice_interval_recommendation(
        temperature: float,
        precipitation_type: Optional[str] = None
    ) -> int:
        base_interval = 30
        
        if temperature <= -20:
            base_interval = 20
        elif temperature <= -10:
            base_interval = 25
        
        if precipitation_type == "freezing_rain":
            base_interval = max(10, base_interval - 10)
        elif precipitation_type == "snow":
            base_interval = max(15, base_interval - 5)
        
        return base_interval
