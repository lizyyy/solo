"""
配置管理模块
包含阈值配置、告警等级等
"""

from dataclasses import dataclass
from typing import Dict


@dataclass
class ThresholdConfig:
    """阈值配置"""
    temp_min: float = 18.0
    temp_max: float = 28.0
    humidity_min: float = 30.0
    humidity_max: float = 60.0
    temp_unit_allowed: tuple = ("C", "c", "℃")
    humidity_unit_allowed: tuple = ("%", "RH", "rh")


@dataclass
class UPSConfig:
    """UPS配置"""
    battery_voltage_normal: float = 48.0
    battery_voltage_min: float = 45.0
    load_normal_max: float = 80.0


@dataclass
class ACConfig:
    """空调配置"""
    alarm_handled_statuses: tuple = ("已处理", "已恢复", "已关闭")


DEFAULT_THRESHOLD = ThresholdConfig()
DEFAULT_UPS_CONFIG = UPSConfig()
DEFAULT_AC_CONFIG = ACConfig()

RISK_LEVELS = {
    "high": {"name": "高危", "priority": 1},
    "medium": {"name": "中危", "priority": 2},
    "low": {"name": "低危", "priority": 3}
}

RISK_TYPES: Dict[str, Dict] = {
    "TEMPERATURE_EXCEED": {
        "code": "T001",
        "name": "温度超标",
        "level": "medium",
        "suggestion": "检查空调运行状态，必要时调整温度设定或增加制冷设备"
    },
    "HUMIDITY_EXCEED": {
        "code": "H001",
        "name": "湿度超标",
        "level": "medium",
        "suggestion": "检查除湿/加湿设备，湿度过高可能导致设备短路，过低可能产生静电"
    },
    "TEMPERATURE_UNIT_ERROR": {
        "code": "T002",
        "name": "温度单位错误",
        "level": "high",
        "suggestion": "巡检数据单位错误，必须重新确认并更正，使用正确的摄氏度(℃)"
    },
    "HUMIDITY_UNIT_ERROR": {
        "code": "H002",
        "name": "湿度单位错误",
        "level": "high",
        "suggestion": "巡检数据单位错误，必须重新确认并更正，使用正确的百分比(%)或相对湿度(RH)"
    },
    "UPS_BATTERY_LOW": {
        "code": "U001",
        "name": "UPS电池电压过低",
        "level": "high",
        "suggestion": "UPS电池存在故障风险，请立即检查电池状态，必要时更换电池"
    },
    "UPS_LOAD_HIGH": {
        "code": "U002",
        "name": "UPS负载过高",
        "level": "medium",
        "suggestion": "UPS负载超过80%，请评估是否需要增加UPS容量或减少负载"
    },
    "AC_ALARM_UNHANDLED": {
        "code": "A001",
        "name": "空调告警未处理",
        "level": "high",
        "suggestion": "存在未处理的空调告警，请立即安排技术人员处理，防止机房温度失控"
    },
    "MISSING_REVIEW": {
        "code": "R001",
        "name": "缺少人工复核",
        "level": "low",
        "suggestion": "当日巡检数据尚未完成人工复核，请值班主管完成复核流程"
    }
}
