"""
输入数据校验模块
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from .models import (
    ClothingItem,
    WeatherPeriod,
    DryingScenario,
    FabricType,
)


class ValidationError(Exception):
    """数据校验错误"""
    
    def __init__(self, message: str, field: Optional[str] = None, 
                 value: Optional[Any] = None):
        self.message = message
        self.field = field
        self.value = value
        super().__init__(self._format_message())
    
    def _format_message(self) -> str:
        if self.field and self.value is not None:
            return f"[{self.field}] {self.message} (值: {self.value})"
        elif self.field:
            return f"[{self.field}] {self.message}"
        return self.message


class Validator:
    """数据校验器"""
    
    MIN_WEIGHT_KG = 0.01
    MAX_WEIGHT_KG = 50.0
    MIN_MOISTURE_PCT = 0.0
    MAX_MOISTURE_PCT = 200.0
    MIN_SPACING_CM = 0.0
    MAX_SPACING_CM = 100.0
    
    MIN_TEMP_C = -10.0
    MAX_TEMP_C = 50.0
    MIN_HUMIDITY_PCT = 0.0
    MAX_HUMIDITY_PCT = 100.0
    MIN_WIND_KPH = 0.0
    MAX_WIND_KPH = 200.0
    
    VALID_LOCATIONS = [
        "阳台", "balcony",
        "室内", "indoor",
        "室外", "outdoor",
        "卫生间", "bathroom",
        "衣帽间", "closet",
        "走廊", "hallway",
        "车库", "garage",
    ]
    
    @classmethod
    def validate_clothing_item(cls, item: ClothingItem) -> List[ValidationError]:
        """校验单个衣物项"""
        errors = []
        
        if not item.name or not item.name.strip():
            errors.append(ValidationError(
                "衣物名称不能为空",
                field="name"
            ))
        
        if not isinstance(item.fabric_type, FabricType):
            errors.append(ValidationError(
                f"布料类型无效，应为FabricType枚举",
                field="fabric_type",
                value=item.fabric_type
            ))
        
        if item.weight_kg < cls.MIN_WEIGHT_KG:
            errors.append(ValidationError(
                f"衣物重量不能小于 {cls.MIN_WEIGHT_KG} kg",
                field="weight_kg",
                value=item.weight_kg
            ))
        elif item.weight_kg > cls.MAX_WEIGHT_KG:
            errors.append(ValidationError(
                f"衣物重量不能大于 {cls.MAX_WEIGHT_KG} kg",
                field="weight_kg",
                value=item.weight_kg
            ))
        
        if item.moisture_content_pct < cls.MIN_MOISTURE_PCT:
            errors.append(ValidationError(
                f"含水量不能小于 {cls.MIN_MOISTURE_PCT}%",
                field="moisture_content_pct",
                value=item.moisture_content_pct
            ))
        elif item.moisture_content_pct > cls.MAX_MOISTURE_PCT:
            errors.append(ValidationError(
                f"含水量不能大于 {cls.MAX_MOISTURE_PCT}%",
                field="moisture_content_pct",
                value=item.moisture_content_pct
            ))
        
        if item.hanger_spacing_cm < cls.MIN_SPACING_CM:
            errors.append(ValidationError(
                f"衣架间距不能小于 {cls.MIN_SPACING_CM} cm",
                field="hanger_spacing_cm",
                value=item.hanger_spacing_cm
            ))
        elif item.hanger_spacing_cm > cls.MAX_SPACING_CM:
            errors.append(ValidationError(
                f"衣架间距不能大于 {cls.MAX_SPACING_CM} cm",
                field="hanger_spacing_cm",
                value=item.hanger_spacing_cm
            ))
        
        if item.custom_drying_rate is not None:
            if item.custom_drying_rate <= 0:
                errors.append(ValidationError(
                    "自定义干燥率必须大于0",
                    field="custom_drying_rate",
                    value=item.custom_drying_rate
                ))
        
        return errors
    
    @classmethod
    def validate_weather_period(cls, period: WeatherPeriod) -> List[ValidationError]:
        """校验单个天气时段"""
        errors = []
        
        if period.start_hour < 0 or period.start_hour > 23:
            errors.append(ValidationError(
                "开始小时必须在0-23之间",
                field="start_hour",
                value=period.start_hour
            ))
        
        if period.duration_hours < 1:
            errors.append(ValidationError(
                "持续小时数至少为1",
                field="duration_hours",
                value=period.duration_hours
            ))
        elif period.duration_hours > 24:
            errors.append(ValidationError(
                "持续小时数不能超过24",
                field="duration_hours",
                value=period.duration_hours
            ))
        
        if period.temperature_c < cls.MIN_TEMP_C:
            errors.append(ValidationError(
                f"温度不能小于 {cls.MIN_TEMP_C} ℃",
                field="temperature_c",
                value=period.temperature_c
            ))
        elif period.temperature_c > cls.MAX_TEMP_C:
            errors.append(ValidationError(
                f"温度不能大于 {cls.MAX_TEMP_C} ℃",
                field="temperature_c",
                value=period.temperature_c
            ))
        
        if period.humidity_pct < cls.MIN_HUMIDITY_PCT:
            errors.append(ValidationError(
                f"湿度不能小于 {cls.MIN_HUMIDITY_PCT}%",
                field="humidity_pct",
                value=period.humidity_pct
            ))
        elif period.humidity_pct > cls.MAX_HUMIDITY_PCT:
            errors.append(ValidationError(
                f"湿度不能大于 {cls.MAX_HUMIDITY_PCT}%",
                field="humidity_pct",
                value=period.humidity_pct
            ))
        
        if period.wind_speed_kph < cls.MIN_WIND_KPH:
            errors.append(ValidationError(
                f"风速不能小于 {cls.MIN_WIND_KPH} km/h",
                field="wind_speed_kph",
                value=period.wind_speed_kph
            ))
        elif period.wind_speed_kph > cls.MAX_WIND_KPH:
            errors.append(ValidationError(
                f"风速不能大于 {cls.MAX_WIND_KPH} km/h",
                field="wind_speed_kph",
                value=period.wind_speed_kph
            ))
        
        if period.uv_index < 0 or period.uv_index > 11:
            errors.append(ValidationError(
                "紫外线指数必须在0-11之间",
                field="uv_index",
                value=period.uv_index
            ))
        
        return errors
    
    @classmethod
    def validate_scenario(cls, scenario: DryingScenario) -> List[ValidationError]:
        """校验完整场景"""
        errors = []
        
        if not scenario.name or not scenario.name.strip():
            errors.append(ValidationError(
                "场景名称不能为空",
                field="name"
            ))
        
        if not isinstance(scenario.start_time, datetime):
            errors.append(ValidationError(
                "开始时间必须是datetime对象",
                field="start_time",
                value=type(scenario.start_time)
            ))
        
        if not scenario.clothing_items:
            errors.append(ValidationError(
                "场景至少需要包含一件衣物",
                field="clothing_items"
            ))
        else:
            for i, item in enumerate(scenario.clothing_items):
                item_errors = cls.validate_clothing_item(item)
                for err in item_errors:
                    if err.field:
                        err.field = f"clothing_items[{i}].{err.field}"
                errors.extend(item_errors)
        
        if not scenario.weather_periods:
            errors.append(ValidationError(
                "场景至少需要包含一个天气时段",
                field="weather_periods"
            ))
        else:
            for i, period in enumerate(scenario.weather_periods):
                period_errors = cls.validate_weather_period(period)
                for err in period_errors:
                    if err.field:
                        err.field = f"weather_periods[{i}].{err.field}"
                errors.extend(period_errors)
            
            total_hours = sum(p.duration_hours for p in scenario.weather_periods)
            if total_hours < 1:
                errors.append(ValidationError(
                    "天气时段总时长至少需要1小时",
                    field="weather_periods",
                    value=total_hours
                ))
            
            sorted_periods = sorted(scenario.weather_periods, key=lambda p: p.start_hour)
            current_end = 0
            for period in sorted_periods:
                if period.start_hour < current_end:
                    errors.append(ValidationError(
                        f"天气时段重叠: 时段从 {period.start_hour} 时开始，"
                        f"但前一个时段到 {current_end} 时才结束",
                        field="weather_periods"
                    ))
                current_end = period.start_hour + period.duration_hours
        
        if scenario.average_temp_c < cls.MIN_TEMP_C:
            errors.append(ValidationError(
                f"平均温度不能小于 {cls.MIN_TEMP_C} ℃",
                field="average_temp_c",
                value=scenario.average_temp_c
            ))
        elif scenario.average_temp_c > cls.MAX_TEMP_C:
            errors.append(ValidationError(
                f"平均温度不能大于 {cls.MAX_TEMP_C} ℃",
                field="average_temp_c",
                value=scenario.average_temp_c
            ))
        
        if scenario.average_humidity_pct < cls.MIN_HUMIDITY_PCT:
            errors.append(ValidationError(
                f"平均湿度不能小于 {cls.MIN_HUMIDITY_PCT}%",
                field="average_humidity_pct",
                value=scenario.average_humidity_pct
            ))
        elif scenario.average_humidity_pct > cls.MAX_HUMIDITY_PCT:
            errors.append(ValidationError(
                f"平均湿度不能大于 {cls.MAX_HUMIDITY_PCT}%",
                field="average_humidity_pct",
                value=scenario.average_humidity_pct
            ))
        
        return errors
    
    @classmethod
    def validate_and_raise(cls, scenario: DryingScenario) -> None:
        """校验并抛出首个错误"""
        errors = cls.validate_scenario(scenario)
        if errors:
            raise errors[0]
    
    @classmethod
    def format_errors(cls, errors: List[ValidationError]) -> str:
        """格式化错误列表为可读字符串"""
        if not errors:
            return "无错误"
        
        lines = []
        for i, err in enumerate(errors, 1):
            lines.append(f"{i}. {str(err)}")
        
        return "\n".join(lines)
