"""
输入解析模块：支持JSON场景文件和CSV衣物清单
"""
import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from .models import (
    ClothingItem,
    WeatherPeriod,
    DryingScenario,
    FabricType,
)


class InputParserError(Exception):
    """输入解析错误"""
    pass


class InputParser:
    """输入解析器"""
    
    FABRIC_TYPE_MAP = {
        "棉": FabricType.COTTON,
        "棉花": FabricType.COTTON,
        "cotton": FabricType.COTTON,
        "COTTON": FabricType.COTTON,
        "羊毛": FabricType.WOOL,
        "wool": FabricType.WOOL,
        "WOOL": FabricType.WOOL,
        "丝绸": FabricType.SILK,
        "真丝": FabricType.SILK,
        "silk": FabricType.SILK,
        "SILK": FabricType.SILK,
        "亚麻": FabricType.LINEN,
        "linen": FabricType.LINEN,
        "LINEN": FabricType.LINEN,
        "聚酯纤维": FabricType.POLYESTER,
        "涤纶": FabricType.POLYESTER,
        "polyester": FabricType.POLYESTER,
        "POLYESTER": FabricType.POLYESTER,
        "尼龙": FabricType.NYLON,
        "锦纶": FabricType.NYLON,
        "nylon": FabricType.NYLON,
        "NYLON": FabricType.NYLON,
        "牛仔": FabricType.DENIM,
        "牛仔布": FabricType.DENIM,
        "denim": FabricType.DENIM,
        "DENIM": FabricType.DENIM,
        "毛衣": FabricType.SWEATER,
        "针织": FabricType.SWEATER,
        "sweater": FabricType.SWEATER,
        "SWEATER": FabricType.SWEATER,
    }
    
    @classmethod
    def parse_fabric_type(cls, fabric_str: str) -> FabricType:
        """解析布料类型字符串"""
        fabric_str = fabric_str.strip()
        if fabric_str in cls.FABRIC_TYPE_MAP:
            return cls.FABRIC_TYPE_MAP[fabric_str]
        
        try:
            return FabricType(fabric_str.lower())
        except ValueError:
            raise InputParserError(
                f"未知的布料类型: '{fabric_str}'。"
                f"支持的类型: {[f.value for f in FabricType]}"
            )
    
    @classmethod
    def parse_clothing_item(cls, data: Dict[str, Any]) -> ClothingItem:
        """解析单个衣物项"""
        try:
            fabric_type = cls.parse_fabric_type(data.get("fabric_type", data.get("布料类型", "cotton")))
            
            return ClothingItem(
                name=str(data.get("name", data.get("名称", "未命名衣物"))),
                fabric_type=fabric_type,
                weight_kg=float(data.get("weight_kg", data.get("重量_kg", 0.5))),
                moisture_content_pct=float(data.get("moisture_content_pct", data.get("含水量_%", 50.0))),
                drying_location=str(data.get("drying_location", data.get("晾晒位置", "阳台"))),
                hanger_spacing_cm=float(data.get("hanger_spacing_cm", data.get("衣架间距_cm", 15.0))),
                custom_drying_rate=data.get("custom_drying_rate", data.get("自定义干燥率", None)),
            )
        except KeyError as e:
            raise InputParserError(f"衣物项缺少必需字段: {e}")
        except (TypeError, ValueError) as e:
            raise InputParserError(f"衣物项数值无效: {e}")
    
    @classmethod
    def parse_weather_period(cls, data: Dict[str, Any]) -> WeatherPeriod:
        """解析天气时段"""
        try:
            is_sunny = data.get("is_sunny", data.get("晴天", False))
            if isinstance(is_sunny, str):
                is_sunny = is_sunny.lower() in ["true", "是", "yes", "y", "1"]
            
            return WeatherPeriod(
                start_hour=int(data.get("start_hour", data.get("开始小时", 0))),
                duration_hours=int(data.get("duration_hours", data.get("持续小时", 1))),
                temperature_c=float(data.get("temperature_c", data.get("温度_℃", 25.0))),
                humidity_pct=float(data.get("humidity_pct", data.get("湿度_%", 60.0))),
                wind_speed_kph=float(data.get("wind_speed_kph", data.get("风速_kmh", 5.0))),
                is_sunny=bool(is_sunny),
                uv_index=float(data.get("uv_index", data.get("紫外线指数", 0.0))),
            )
        except KeyError as e:
            raise InputParserError(f"天气时段缺少必需字段: {e}")
        except (TypeError, ValueError) as e:
            raise InputParserError(f"天气时段数值无效: {e}")
    
    @classmethod
    def parse_json_scenario(cls, file_path: str) -> DryingScenario:
        """解析JSON场景文件"""
        path = Path(file_path)
        if not path.exists():
            raise InputParserError(f"场景文件不存在: {file_path}")
        
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise InputParserError(f"JSON格式错误: {e}")
        
        clothing_items = []
        for item in data.get("clothing_items", data.get("衣物列表", [])):
            clothing_items.append(cls.parse_clothing_item(item))
        
        weather_periods = []
        for period in data.get("weather_periods", data.get("天气时段", [])):
            weather_periods.append(cls.parse_weather_period(period))
        
        start_time_str = data.get("start_time", data.get("开始时间", datetime.now().isoformat()))
        try:
            start_time = datetime.fromisoformat(start_time_str)
        except ValueError:
            try:
                start_time = datetime.strptime(start_time_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                start_time = datetime.now()
        
        avg_temp = data.get("average_temp_c", data.get("平均温度_℃", 
            cls._calculate_average_temp(weather_periods)))
        avg_humidity = data.get("average_humidity_pct", data.get("平均湿度_%",
            cls._calculate_average_humidity(weather_periods)))
        avg_wind = data.get("average_wind_kph", data.get("平均风速_kmh",
            cls._calculate_average_wind(weather_periods)))
        
        return DryingScenario(
            name=str(data.get("name", data.get("场景名称", "未命名场景"))),
            description=str(data.get("description", data.get("描述", ""))),
            start_time=start_time,
            clothing_items=clothing_items,
            weather_periods=weather_periods,
            average_temp_c=float(avg_temp),
            average_humidity_pct=float(avg_humidity),
            average_wind_kph=float(avg_wind),
        )
    
    @classmethod
    def parse_csv_clothing(cls, file_path: str, default_weather: Optional[Dict] = None) -> Tuple[List[ClothingItem], List[WeatherPeriod]]:
        """解析CSV衣物清单"""
        path = Path(file_path)
        if not path.exists():
            raise InputParserError(f"CSV文件不存在: {file_path}")
        
        clothing_items = []
        weather_periods = []
        
        try:
            with open(path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    item = cls.parse_clothing_item(row)
                    clothing_items.append(item)
                    
                    if "天气时段" in row or "weather_period" in row:
                        pass
        except csv.Error as e:
            raise InputParserError(f"CSV解析错误: {e}")
        
        if default_weather is None:
            default_weather = {
                "start_hour": 8,
                "duration_hours": 12,
                "temperature_c": 25.0,
                "humidity_pct": 70.0,
                "wind_speed_kph": 5.0,
                "is_sunny": False,
            }
        
        weather_periods.append(cls.parse_weather_period(default_weather))
        
        return clothing_items, weather_periods
    
    @staticmethod
    def _calculate_average_temp(periods: List[WeatherPeriod]) -> float:
        """计算平均温度"""
        if not periods:
            return 25.0
        total = sum(p.temperature_c * p.duration_hours for p in periods)
        total_hours = sum(p.duration_hours for p in periods)
        return total / total_hours if total_hours > 0 else 25.0
    
    @staticmethod
    def _calculate_average_humidity(periods: List[WeatherPeriod]) -> float:
        """计算平均湿度"""
        if not periods:
            return 60.0
        total = sum(p.humidity_pct * p.duration_hours for p in periods)
        total_hours = sum(p.duration_hours for p in periods)
        return total / total_hours if total_hours > 0 else 60.0
    
    @staticmethod
    def _calculate_average_wind(periods: List[WeatherPeriod]) -> float:
        """计算平均风速"""
        if not periods:
            return 5.0
        total = sum(p.wind_speed_kph * p.duration_hours for p in periods)
        total_hours = sum(p.duration_hours for p in periods)
        return total / total_hours if total_hours > 0 else 5.0
