from typing import Dict, Any, Optional
from config import settings


class ConcentrationChecker:
    @staticmethod
    def check_concentration(
        measured_concentration: float,
        target_concentration: Optional[float] = None,
        temperature: Optional[float] = None
    ) -> Dict[str, Any]:
        if target_concentration is None:
            target_concentration = ConcentrationChecker._get_target_concentration(temperature)
        
        deviation = measured_concentration - target_concentration
        deviation_percent = deviation / target_concentration * 100 if target_concentration > 0 else 0
        
        status = ConcentrationChecker._determine_concentration_status(
            measured_concentration, target_concentration, deviation
        )
        
        recommendations = ConcentrationChecker._get_recommendations(
            status, measured_concentration, target_concentration, deviation
        )
        
        return {
            "measured_concentration": measured_concentration,
            "target_concentration": target_concentration,
            "concentration_deviation": deviation,
            "deviation_percent": round(deviation_percent, 2),
            "concentration_status": status,
            "recommendations": recommendations
        }
    
    @staticmethod
    def _get_target_concentration(temperature: Optional[float]) -> float:
        if temperature is None:
            return 0.6
        
        if temperature <= -20:
            return 0.8
        elif temperature <= -10:
            return 0.7
        elif temperature <= -5:
            return 0.65
        else:
            return 0.6
    
    @staticmethod
    def _determine_concentration_status(
        measured: float,
        target: float,
        deviation: float
    ) -> str:
        deviation_abs = abs(deviation)
        
        if measured < settings.MIN_DEICE_CONCENTRATION:
            return "critical"
        
        if deviation_abs < 0.05:
            return "good"
        elif deviation_abs < 0.1:
            return "warning"
        else:
            return "critical"
    
    @staticmethod
    def _get_recommendations(
        status: str,
        measured: float,
        target: float,
        deviation: float
    ) -> list:
        recommendations = []
        
        if status == "critical":
            if measured < settings.MIN_DEICE_CONCENTRATION:
                recommendations.append({
                    "level": "critical",
                    "message": f"浓度过低 ({measured:.2f})，低于最低要求 ({settings.MIN_DEICE_CONCENTRATION:.2f})",
                    "action": "必须重新配制除冰液或补充浓缩液"
                })
            elif deviation > 0.1:
                recommendations.append({
                    "level": "warning",
                    "message": f"浓度过高 ({measured:.2f})，偏差超过 10%",
                    "action": "建议检查稀释比例，确认是否符合要求"
                })
            elif deviation < -0.1:
                recommendations.append({
                    "level": "critical",
                    "message": f"浓度过低 ({measured:.2f})，比目标值低超过 10%",
                    "action": "必须补充浓缩液，调整到目标浓度"
                })
        
        elif status == "warning":
            if deviation > 0:
                recommendations.append({
                    "level": "warning",
                    "message": f"浓度偏高 ({measured:.2f} vs 目标 {target:.2f})",
                    "action": "记录偏差，密切监控保持时间"
                })
            else:
                recommendations.append({
                    "level": "warning",
                    "message": f"浓度偏低 ({measured:.2f} vs 目标 {target:.2f})",
                    "action": "考虑缩短保持时间，增加监控频率"
                })
        
        else:
            recommendations.append({
                "level": "info",
                "message": f"浓度正常 ({measured:.2f})",
                "action": "按正常流程操作"
            })
        
        return recommendations
