"""
霉味/回潮风险评估模块

核心规则：
1. 高湿度 + 低温度 + 低风速 = 高回潮风险
2. 含水量高 + 长时间未干 = 霉味风险
3. 夜间湿度上升 = 回潮风险增加
4. 衣架间距过小 = 空气流通差 = 风险增加
5. 晾晒位置在高湿度区域（卫生间）= 风险增加
"""
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta

from .models import (
    ClothingItem,
    WeatherPeriod,
    DryingScenario,
    RiskAssessment,
    FabricType,
)
from .drying_model import DryingModel


class RiskLevel:
    LOW = "低风险"
    MEDIUM = "中风险"
    HIGH = "高风险"
    CRITICAL = "极高风险"


class RiskAssessor:
    """风险评估器"""
    
    MOLD_RISK_THRESHOLDS = {
        "low": 30,
        "medium": 60,
        "high": 80,
    }
    
    DAMP_RISK_THRESHOLDS = {
        "low": 25,
        "medium": 50,
        "high": 75,
    }
    
    FABRIC_MOLD_SENSITIVITY = {
        FabricType.COTTON: 1.5,
        FabricType.WOOL: 1.2,
        FabricType.SILK: 0.8,
        FabricType.LINEN: 1.3,
        FabricType.POLYESTER: 0.5,
        FabricType.NYLON: 0.6,
        FabricType.DENIM: 1.4,
        FabricType.SWEATER: 1.6,
    }
    
    LOCATION_RISK_FACTOR = {
        "阳台": 1.0,
        "balcony": 1.0,
        "室内": 1.3,
        "indoor": 1.3,
        "室外": 0.8,
        "outdoor": 0.8,
        "卫生间": 2.0,
        "bathroom": 2.0,
        "衣帽间": 1.8,
        "closet": 1.8,
        "走廊": 1.5,
        "hallway": 1.5,
        "车库": 1.6,
        "garage": 1.6,
    }
    
    @classmethod
    def calculate_mold_risk_score(
        cls,
        item: ClothingItem,
        dry_curve: List[Dict],
        weather_periods: List[WeatherPeriod],
        dry_time_hours: float,
    ) -> Tuple[float, List[str], List[int]]:
        """计算霉味风险评分
        
        评分范围：0-100
        - 考虑因素：湿度、温度、干燥时间、布料类型、位置、含水量
        """
        score = 0.0
        warnings = []
        critical_hours = []
        
        fabric_sensitivity = cls.FABRIC_MOLD_SENSITIVITY.get(item.fabric_type, 1.0)
        location_factor = cls.LOCATION_RISK_FACTOR.get(item.drying_location.lower(), 1.0)
        
        if dry_time_hours > 24:
            score += 20
            warnings.append(f"干燥时间超过24小时（{dry_time_hours:.1f}小时），增加霉味风险")
        elif dry_time_hours > 12:
            score += 10
        
        if item.moisture_content_pct > 60:
            score += 15
            warnings.append(f"初始含水量较高（{item.moisture_content_pct:.0f}%）")
        elif item.moisture_content_pct > 40:
            score += 8
        
        for hour_data in dry_curve:
            hour = hour_data["hour"]
            humidity = hour_data["humidity_pct"]
            temp = hour_data["temperature_c"]
            moisture = hour_data["moisture_pct"]
            
            if humidity >= 90 and moisture > 20:
                score += 3
                if hour not in critical_hours:
                    critical_hours.append(hour)
                    warnings.append(f"第{hour}小时湿度{humidity:.0f}%，含水量{moisture:.1f}%，存在回潮风险")
            elif humidity >= 80 and moisture > 30:
                score += 1.5
                if hour not in critical_hours:
                    critical_hours.append(hour)
            
            if temp < 15 and moisture > 25:
                score += 2
                if hour not in critical_hours:
                    critical_hours.append(hour)
                    warnings.append(f"第{hour}小时温度{temp:.1f}℃较低，干燥缓慢")
        
        has_night_period = any(
            (p.start_hour >= 20 or p.start_hour + p.duration_hours <= 6)
            for p in weather_periods
        )
        if has_night_period and dry_time_hours > 8:
            score += 10
            warnings.append("夜间晾晒，湿度通常上升，增加回潮风险")
        
        if item.hanger_spacing_cm < 10:
            score += 10
            warnings.append(f"衣架间距过小（{item.hanger_spacing_cm:.0f}cm），空气流通差")
        elif item.hanger_spacing_cm < 15:
            score += 5
        
        score = score * fabric_sensitivity * location_factor
        
        score = min(100, max(0, score))
        
        return score, warnings, critical_hours
    
    @classmethod
    def calculate_damp_risk_score(
        cls,
        item: ClothingItem,
        dry_curve: List[Dict],
        weather_periods: List[WeatherPeriod],
    ) -> float:
        """计算回潮风险评分
        
        评分范围：0-100
        - 考虑因素：湿度波动、夜间湿度、干燥未完成
        """
        score = 0.0
        
        for period in weather_periods:
            is_night = period.start_hour >= 20 or period.start_hour + period.duration_hours <= 6
            if is_night and period.humidity_pct > 80:
                score += 15
            elif period.humidity_pct > 90:
                score += 10
        
        if dry_curve:
            final_moisture = dry_curve[-1]["moisture_after_hour"]
            if final_moisture > 20:
                score += 20
            elif final_moisture > 10:
                score += 10
        
        humidity_values = [p.humidity_pct for p in weather_periods]
        if humidity_values:
            humidity_range = max(humidity_values) - min(humidity_values)
            if humidity_range > 30:
                score += 10
        
        score = min(100, max(0, score))
        
        return score
    
    @classmethod
    def determine_risk_level(cls, mold_score: float, damp_score: float) -> str:
        """根据评分确定风险等级"""
        combined = (mold_score * 0.6 + damp_score * 0.4)
        
        if combined >= cls.MOLD_RISK_THRESHOLDS["high"]:
            return RiskLevel.CRITICAL
        elif combined >= cls.MOLD_RISK_THRESHOLDS["medium"]:
            return RiskLevel.HIGH
        elif combined >= cls.MOLD_RISK_THRESHOLDS["low"]:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW
    
    @classmethod
    def assess_item(
        cls,
        item: ClothingItem,
        dry_curve: List[Dict],
        weather_periods: List[WeatherPeriod],
        dry_time_hours: float,
    ) -> RiskAssessment:
        """评估单件衣物的风险"""
        mold_score, warnings, critical_hours = cls.calculate_mold_risk_score(
            item, dry_curve, weather_periods, dry_time_hours
        )
        damp_score = cls.calculate_damp_risk_score(item, dry_curve, weather_periods)
        
        risk_level = cls.determine_risk_level(mold_score, damp_score)
        
        return RiskAssessment(
            clothing_name=item.name,
            mold_risk_score=round(mold_score, 1),
            damp_risk_score=round(damp_score, 1),
            risk_level=risk_level,
            warning_messages=warnings,
            critical_hours=sorted(critical_hours),
        )
    
    @classmethod
    def assess_all_items(
        cls,
        scenario: DryingScenario,
        processing_results: Dict,
    ) -> Tuple[List[RiskAssessment], str]:
        """评估所有衣物的风险
        
        返回：(风险评估列表, 整体风险等级)
        """
        assessments = []
        
        for item_result in processing_results["clothing_results"]:
            item_name = item_result["name"]
            
            item = next(
                (i for i in scenario.clothing_items if i.name == item_name),
                None
            )
            
            if item is None:
                continue
            
            assessment = cls.assess_item(
                item,
                item_result["dry_curve"],
                scenario.weather_periods,
                item_result["dry_time_hours"],
            )
            assessments.append(assessment)
        
        if assessments:
            avg_mold = sum(a.mold_risk_score for a in assessments) / len(assessments)
            avg_damp = sum(a.damp_risk_score for a in assessments) / len(assessments)
            overall_risk = cls.determine_risk_level(avg_mold, avg_damp)
        else:
            overall_risk = RiskLevel.LOW
        
        return assessments, overall_risk
    
    @classmethod
    def generate_recommendations(
        cls,
        scenario: DryingScenario,
        processing_results: Dict,
        risk_assessments: List[RiskAssessment],
        overall_risk: str,
    ) -> List[str]:
        """生成优化建议"""
        recommendations = []
        
        high_risk_items = [
            a for a in risk_assessments 
            if a.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        ]
        if high_risk_items:
            item_names = ", ".join(a.clothing_name for a in high_risk_items)
            recommendations.append(
                f"⚠️ 高风险衣物需要关注: {item_names}"
            )
        
        for item_result in processing_results["clothing_results"]:
            if item_result["hanger_spacing_cm"] < 15:
                recommendations.append(
                    f"💡 建议增加衣架间距，目前{item_result['name']}间距为{item_result['hanger_spacing_cm']:.0f}cm"
                )
                break
        
        avg_humidity = processing_results["weather_summary"]["average_humidity_pct"]
        if avg_humidity > 80:
            recommendations.append(
                "💨 环境湿度较高，建议使用风扇或除湿机加速干燥"
            )
        
        avg_wind = processing_results["weather_summary"]["average_wind_kph"]
        if avg_wind < 5:
            recommendations.append(
                "🌬️ 风速较低，建议选择通风更好的位置或使用风扇"
            )
        
        for item_result in processing_results["clothing_results"]:
            if item_result["dry_time_hours"] > 24:
                recommendations.append(
                    f"⏰ {item_result['name']}预计需要{item_result['dry_time_formatted']}才能干燥，建议分批晾晒或使用烘干设备"
                )
                break
        
        has_night = any(
            p.start_hour >= 20 or p.start_hour + p.duration_hours <= 6
            for p in scenario.weather_periods
        )
        if has_night and overall_risk in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            recommendations.append(
                "🌙 夜间晾晒湿度较高，建议将衣物移至室内干燥环境"
            )
        
        slow_items = sorted(
            processing_results["clothing_results"],
            key=lambda x: x["dry_time_hours"],
            reverse=True
        )[:2]
        if slow_items and len(scenario.clothing_items) > 2:
            recommendations.append(
                f"📋 建议将干燥较慢的衣物（{slow_items[0]['name']}等）与快速干燥的衣物分开晾晒"
            )
        
        if not recommendations:
            recommendations.append("✅ 当前晾晒条件良好，继续保持即可")
        
        return recommendations
