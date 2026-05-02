"""
干燥曲线计算模型

核心逻辑：
1. 基于布料类型的基础干燥率
2. 环境因素修正（温度、湿度、风速、日照）
3. 衣架间距影响
4. 分时段干燥曲线计算
"""
import math
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta

from .models import (
    ClothingItem,
    WeatherPeriod,
    DryingScenario,
    FabricType,
)


class DryingModel:
    """干燥计算模型"""
    
    FABRIC_BASE_DRYING_RATE = {
        FabricType.COTTON: 0.08,
        FabricType.WOOL: 0.04,
        FabricType.SILK: 0.10,
        FabricType.LINEN: 0.09,
        FabricType.POLYESTER: 0.12,
        FabricType.NYLON: 0.11,
        FabricType.DENIM: 0.05,
        FabricType.SWEATER: 0.03,
    }
    
    FABRIC_WATER_RETENTION = {
        FabricType.COTTON: 2.5,
        FabricType.WOOL: 1.8,
        FabricType.SILK: 1.2,
        FabricType.LINEN: 2.2,
        FabricType.POLYESTER: 0.5,
        FabricType.NYLON: 0.6,
        FabricType.DENIM: 3.0,
        FabricType.SWEATER: 2.0,
    }
    
    LOCATION_EFFECT = {
        "阳台": 1.2,
        "balcony": 1.2,
        "室内": 0.6,
        "indoor": 0.6,
        "室外": 1.5,
        "outdoor": 1.5,
        "卫生间": 0.4,
        "bathroom": 0.4,
        "衣帽间": 0.3,
        "closet": 0.3,
        "走廊": 0.5,
        "hallway": 0.5,
        "车库": 0.35,
        "garage": 0.35,
    }
    
    OPTIMAL_SPACING_CM = 20.0
    MIN_DRYING_THRESHOLD = 5.0
    
    @classmethod
    def get_base_drying_rate(cls, fabric: FabricType) -> float:
        """获取基础干燥率（每小时含水量减少百分比）"""
        return cls.FABRIC_BASE_DRYING_RATE.get(fabric, 0.08)
    
    @classmethod
    def get_water_retention_factor(cls, fabric: FabricType) -> float:
        """获取布料保水系数"""
        return cls.FABRIC_WATER_RETENTION.get(fabric, 1.0)
    
    @classmethod
    def calculate_temperature_factor(cls, temp_c: float) -> float:
        """计算温度修正因子
        
        温度越高，干燥越快，但过高温度（>35℃）可能损伤布料
        参考：每升高10℃，干燥速度约增加1倍
        """
        base_temp = 20.0
        if temp_c <= 0:
            return 0.1
        elif temp_c < 10:
            return 0.5
        elif temp_c < 20:
            return 0.7 + (temp_c - 10) * 0.03
        elif temp_c < 35:
            return 1.0 + (temp_c - 20) * 0.05
        else:
            return 1.75
    
    @classmethod
    def calculate_humidity_factor(cls, humidity_pct: float) -> float:
        """计算湿度修正因子
        
        湿度越高，干燥越慢
        当湿度>90%时，几乎无法干燥
        """
        if humidity_pct >= 95:
            return 0.05
        elif humidity_pct >= 90:
            return 0.1 + (95 - humidity_pct) * 0.03
        elif humidity_pct >= 70:
            return 0.3 + (90 - humidity_pct) * 0.015
        elif humidity_pct >= 50:
            return 0.7 + (70 - humidity_pct) * 0.015
        else:
            return 1.0 + (50 - humidity_pct) * 0.005
    
    @classmethod
    def calculate_wind_factor(cls, wind_speed_kph: float) -> float:
        """计算风速修正因子
        
        风速越高，干燥越快
        风速>20 km/h后增益递减
        """
        if wind_speed_kph <= 0:
            return 0.3
        elif wind_speed_kph < 5:
            return 0.5 + wind_speed_kph * 0.04
        elif wind_speed_kph < 15:
            return 0.7 + (wind_speed_kph - 5) * 0.05
        elif wind_speed_kph < 30:
            return 1.2 + (wind_speed_kph - 15) * 0.02
        else:
            return 1.5
    
    @classmethod
    def calculate_sunlight_factor(cls, is_sunny: bool, uv_index: float = 0.0) -> float:
        """计算日照修正因子
        
        有阳光时干燥更快
        """
        if not is_sunny:
            return 1.0
        
        base_factor = 1.5
        if uv_index > 0:
            uv_bonus = min(uv_index * 0.05, 0.5)
            return base_factor + uv_bonus
        return base_factor
    
    @classmethod
    def calculate_spacing_factor(cls, spacing_cm: float) -> float:
        """计算衣架间距修正因子
        
        间距越近，干燥越慢（空气流通差）
        最优间距约为20cm
        """
        if spacing_cm <= 0:
            return 0.3
        
        optimal = cls.OPTIMAL_SPACING_CM
        if spacing_cm >= optimal:
            return 1.0
        
        ratio = spacing_cm / optimal
        if ratio > 0.5:
            return 0.7 + (ratio - 0.5) * 0.6
        elif ratio > 0.25:
            return 0.5 + (ratio - 0.25) * 0.8
        else:
            return 0.3 + ratio * 0.8
    
    @classmethod
    def calculate_location_factor(cls, location: str) -> float:
        """计算晾晒位置修正因子"""
        return cls.LOCATION_EFFECT.get(location.lower(), 0.8)
    
    @classmethod
    def calculate_hourly_drying_rate(
        cls,
        item: ClothingItem,
        weather: WeatherPeriod,
        current_moisture_pct: float
    ) -> float:
        """计算每小时干燥率（含水量减少的百分比）
        
        基于指数衰减模型：干燥速度与当前含水量成正比
        """
        base_rate = cls.get_base_drying_rate(item.fabric_type)
        
        if item.custom_drying_rate:
            base_rate = item.custom_drying_rate
        
        temp_factor = cls.calculate_temperature_factor(weather.temperature_c)
        humidity_factor = cls.calculate_humidity_factor(weather.humidity_pct)
        wind_factor = cls.calculate_wind_factor(weather.wind_speed_kph)
        sunlight_factor = cls.calculate_sunlight_factor(weather.is_sunny, weather.uv_index)
        spacing_factor = cls.calculate_spacing_factor(item.hanger_spacing_cm)
        location_factor = cls.calculate_location_factor(item.drying_location)
        
        moisture_factor = 1.0
        if current_moisture_pct > 50:
            moisture_factor = 1.2
        elif current_moisture_pct < 20:
            moisture_factor = 0.6
        
        hourly_rate = (
            base_rate
            * temp_factor
            * humidity_factor
            * wind_factor
            * sunlight_factor
            * spacing_factor
            * location_factor
            * moisture_factor
        )
        
        return hourly_rate
    
    @classmethod
    def simulate_drying_curve(
        cls,
        item: ClothingItem,
        weather_periods: List[WeatherPeriod],
        start_hour: int = 8,
    ) -> Tuple[List[Dict], float]:
        """模拟干燥曲线
        
        返回：(每小时干燥数据列表, 总干燥时间_小时)
        """
        curve = []
        current_moisture = item.moisture_content_pct
        total_hours = 0
        dry_time_hours = None
        
        sorted_periods = sorted(weather_periods, key=lambda p: p.start_hour)
        
        for period in sorted_periods:
            period_start_hour = period.start_hour
            period_duration = period.duration_hours
            
            for hour_in_period in range(period_duration):
                actual_hour = (period_start_hour + hour_in_period) % 24
                
                hourly_rate = cls.calculate_hourly_drying_rate(
                    item, period, current_moisture
                )
                
                moisture_reduction = current_moisture * hourly_rate
                new_moisture = max(0, current_moisture - moisture_reduction)
                
                is_dry = new_moisture <= cls.MIN_DRYING_THRESHOLD
                
                curve.append({
                    "hour": total_hours,
                    "clock_hour": actual_hour,
                    "moisture_pct": round(current_moisture, 2),
                    "moisture_after_hour": round(new_moisture, 2),
                    "drying_rate": round(hourly_rate, 4),
                    "temperature_c": period.temperature_c,
                    "humidity_pct": period.humidity_pct,
                    "wind_speed_kph": period.wind_speed_kph,
                    "is_sunny": period.is_sunny,
                    "is_dry": is_dry,
                })
                
                current_moisture = new_moisture
                total_hours += 1
                
                if is_dry and dry_time_hours is None:
                    dry_time_hours = total_hours
        
        if dry_time_hours is None:
            if current_moisture <= cls.MIN_DRYING_THRESHOLD:
                dry_time_hours = total_hours
            else:
                dry_time_hours = total_hours + cls._estimate_remaining_time(
                    item, current_moisture, sorted_periods
                )
        
        return curve, dry_time_hours
    
    @classmethod
    def _estimate_remaining_time(
        cls,
        item: ClothingItem,
        current_moisture: float,
        weather_periods: List[WeatherPeriod]
    ) -> float:
        """估算剩余干燥时间"""
        if current_moisture <= cls.MIN_DRYING_THRESHOLD:
            return 0
        
        avg_temp = sum(p.temperature_c for p in weather_periods) / len(weather_periods)
        avg_humidity = sum(p.humidity_pct for p in weather_periods) / len(weather_periods)
        avg_wind = sum(p.wind_speed_kph for p in weather_periods) / len(weather_periods)
        avg_sunny = any(p.is_sunny for p in weather_periods)
        
        avg_weather = WeatherPeriod(
            start_hour=0,
            duration_hours=1,
            temperature_c=avg_temp,
            humidity_pct=avg_humidity,
            wind_speed_kph=avg_wind,
            is_sunny=avg_sunny,
        )
        
        remaining_hours = 0.0
        moisture = current_moisture
        
        while moisture > cls.MIN_DRYING_THRESHOLD and remaining_hours < 100:
            rate = cls.calculate_hourly_drying_rate(item, avg_weather, moisture)
            reduction = moisture * rate
            moisture -= reduction
            remaining_hours += 1
        
        return remaining_hours
    
    @classmethod
    def calculate_dry_time_for_item(
        cls,
        item: ClothingItem,
        weather_periods: List[WeatherPeriod]
    ) -> Tuple[timedelta, List[Dict]]:
        """计算单件衣物的干燥时间和曲线"""
        curve, dry_hours = cls.simulate_drying_curve(item, weather_periods)
        dry_time = timedelta(hours=dry_hours)
        return dry_time, curve
    
    @classmethod
    def process_scenario(
        cls,
        scenario: DryingScenario
    ) -> Dict:
        """处理整个场景，计算所有衣物的干燥时间"""
        results = {
            "scenario_name": scenario.name,
            "start_time": scenario.start_time,
            "clothing_results": [],
            "weather_summary": {
                "average_temp_c": scenario.average_temp_c,
                "average_humidity_pct": scenario.average_humidity_pct,
                "average_wind_kph": scenario.average_wind_kph,
                "total_hours": sum(p.duration_hours for p in scenario.weather_periods),
            }
        }
        
        for item in scenario.clothing_items:
            dry_time, curve = cls.calculate_dry_time_for_item(
                item, scenario.weather_periods
            )
            
            item.estimated_dry_time = dry_time
            item.dry_curve = curve
            
            final_moisture = curve[-1]["moisture_after_hour"] if curve else item.moisture_content_pct
            
            results["clothing_results"].append({
                "name": item.name,
                "fabric_type": item.fabric_type.value,
                "dry_time_hours": dry_time.total_seconds() / 3600,
                "dry_time_formatted": cls._format_timedelta(dry_time),
                "final_moisture_pct": final_moisture,
                "is_fully_dry": final_moisture <= cls.MIN_DRYING_THRESHOLD,
                "weight_kg": item.weight_kg,
                "moisture_content_pct": item.moisture_content_pct,
                "drying_location": item.drying_location,
                "hanger_spacing_cm": item.hanger_spacing_cm,
                "dry_curve": curve,
            })
        
        return results
    
    @staticmethod
    def _format_timedelta(td: timedelta) -> str:
        """格式化时间差"""
        total_seconds = td.total_seconds()
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        
        if hours > 24:
            days = hours // 24
            remaining_hours = hours % 24
            if minutes > 0:
                return f"{days}天{remaining_hours}小时{minutes}分钟"
            return f"{days}天{remaining_hours}小时"
        elif minutes > 0:
            return f"{hours}小时{minutes}分钟"
        else:
            return f"{hours}小时"
