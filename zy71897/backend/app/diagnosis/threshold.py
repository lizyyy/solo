from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import json


@dataclass
class ThresholdLevel:
    level: str
    min_value: Optional[float]
    max_value: Optional[float]
    description: str


@dataclass
class ThresholdCheckResult:
    parameter: str
    actual_value: float
    level: str
    min_value: Optional[float]
    max_value: Optional[float]
    deviation: float
    severity: str
    is_abnormal: bool
    description: str
    recommendation: str


class ThresholdManager:
    def __init__(self):
        self._thresholds: Dict[str, List[ThresholdLevel]] = {}
        self._init_default_thresholds()

    def _init_default_thresholds(self):
        self._thresholds = {
            "power": [
                ThresholdLevel("normal", 0, 90, "正常运行范围"),
                ThresholdLevel("warning", 90, 100, "功率偏高，注意负载情况"),
                ThresholdLevel("critical", 100, None, "功率过载，需立即检查"),
            ],
            "current": [
                ThresholdLevel("normal", 0, 85, "正常运行范围"),
                ThresholdLevel("warning", 85, 95, "电流偏高，检查电压平衡"),
                ThresholdLevel("critical", 95, None, "电流过载，存在烧机风险"),
            ],
            "temperature": [
                ThresholdLevel("normal", 0, 85, "正常运行温度"),
                ThresholdLevel("warning", 85, 95, "温度偏高，检查冷却系统"),
                ThresholdLevel("critical", 95, None, "温度过高，需停机检查"),
            ],
            "pressure": [
                ThresholdLevel("normal", 0.6, 0.8, "正常工作压力"),
                ThresholdLevel("warning", 0.5, 0.6, "压力偏低，检查泄漏"),
                ThresholdLevel("warning", 0.8, 0.9, "压力偏高，检查调节阀"),
                ThresholdLevel("critical", None, 0.5, "压力过低，需紧急处理"),
                ThresholdLevel("critical", 0.9, None, "压力过高，存在安全隐患"),
            ],
            "load_rate": [
                ThresholdLevel("normal", 30, 80, "负载率正常"),
                ThresholdLevel("warning", 20, 30, "负载率偏低，存在空载浪费"),
                ThresholdLevel("warning", 80, 95, "负载率偏高，接近满载"),
                ThresholdLevel("critical", None, 20, "负载率过低，严重浪费能源"),
                ThresholdLevel("critical", 95, None, "负载率过高，设备过载运行"),
            ],
            "overall_vibration": [
                ThresholdLevel("normal", 0, 2.8, "振动正常"),
                ThresholdLevel("warning", 2.8, 4.5, "振动偏大，检查轴承和对中"),
                ThresholdLevel("critical", 4.5, 7.1, "振动超标，需安排维修"),
                ThresholdLevel("critical", 7.1, None, "振动严重超标，立即停机"),
            ],
            "x_vibration": [
                ThresholdLevel("normal", 0, 2.3, "X向振动正常"),
                ThresholdLevel("warning", 2.3, 3.8, "X向振动偏大"),
                ThresholdLevel("critical", 3.8, None, "X向振动超标"),
            ],
            "y_vibration": [
                ThresholdLevel("normal", 0, 2.3, "Y向振动正常"),
                ThresholdLevel("warning", 2.3, 3.8, "Y向振动偏大"),
                ThresholdLevel("critical", 3.8, None, "Y向振动超标"),
            ],
            "z_vibration": [
                ThresholdLevel("normal", 0, 2.3, "Z向振动正常"),
                ThresholdLevel("warning", 2.3, 3.8, "Z向振动偏大"),
                ThresholdLevel("critical", 3.8, None, "Z向振动超标"),
            ],
            "energy_efficiency": [
                ThresholdLevel("normal", 85, None, "能效优秀"),
                ThresholdLevel("warning", 75, 85, "能效良好"),
                ThresholdLevel("warning", 65, 75, "能效偏低，建议优化"),
                ThresholdLevel("critical", None, 65, "能效差，需诊断整改"),
            ],
        }

    def get_thresholds(self, parameter: str) -> List[ThresholdLevel]:
        return self._thresholds.get(parameter, [])

    def set_threshold(self, parameter: str, levels: List[ThresholdLevel]):
        self._thresholds[parameter] = levels

    def check_value(self, parameter: str, value: float) -> ThresholdCheckResult:
        levels = self._thresholds.get(parameter, [])
        if not levels:
            return ThresholdCheckResult(
                parameter=parameter,
                actual_value=value,
                level="normal",
                min_value=None,
                max_value=None,
                deviation=0.0,
                severity="normal",
                is_abnormal=False,
                description="无阈值配置",
                recommendation="无需处理",
            )

        matched_level = None
        is_abnormal = False
        severity = "normal"

        for level in levels:
            if self._value_in_range(value, level.min_value, level.max_value):
                matched_level = level
                if level.level == "warning":
                    is_abnormal = True
                    severity = "warning"
                elif level.level == "critical":
                    is_abnormal = True
                    severity = "critical"
                break

        if matched_level is None:
            matched_level = levels[0]

        deviation = self._calculate_deviation(value, matched_level, levels)
        description = self._generate_description(parameter, value, matched_level)
        recommendation = self._generate_recommendation(parameter, matched_level, severity)

        return ThresholdCheckResult(
            parameter=parameter,
            actual_value=value,
            level=matched_level.level,
            min_value=matched_level.min_value,
            max_value=matched_level.max_value,
            deviation=deviation,
            severity=severity,
            is_abnormal=is_abnormal,
            description=description,
            recommendation=recommendation,
        )

    def _value_in_range(self, value: float, min_val: Optional[float], max_val: Optional[float]) -> bool:
        if min_val is None and max_val is None:
            return True
        if min_val is None:
            return value < max_val
        if max_val is None:
            return value >= min_val
        return min_val <= value < max_val

    def _calculate_deviation(self, value: float, matched: ThresholdLevel, all_levels: List[ThresholdLevel]) -> float:
        normal_levels = [l for l in all_levels if l.level == "normal"]
        if not normal_levels:
            return 0.0

        normal = normal_levels[0]
        if normal.min_value is not None and normal.max_value is not None:
            normal_range = normal.max_value - normal.min_value
            if normal_range > 0:
                if value < normal.min_value:
                    return (normal.min_value - value) / normal_range * 100
                elif value >= normal.max_value:
                    return (value - normal.max_value) / normal_range * 100
        return 0.0

    def _generate_description(self, parameter: str, value: float, level: ThresholdLevel) -> str:
        param_names = {
            "power": "功率",
            "current": "电流",
            "temperature": "温度",
            "pressure": "压力",
            "load_rate": "负载率",
            "overall_vibration": "总振动",
            "x_vibration": "X向振动",
            "y_vibration": "Y向振动",
            "z_vibration": "Z向振动",
            "energy_efficiency": "能效",
        }
        pname = param_names.get(parameter, parameter)
        return f"{pname}{value:.2f}{self._get_unit(parameter)}，{level.description}"

    def _generate_recommendation(self, parameter: str, level: ThresholdLevel, severity: str) -> str:
        if severity == "normal":
            return "继续保持正常巡检"

        rec_map = {
            "power": "检查空压机加载率，排查用气端泄漏，必要时调整运行压力",
            "current": "检查三相电压平衡，清理电机散热片，检查轴承润滑",
            "temperature": "检查冷却器散热情况，清理空气过滤器，检查润滑油油位",
            "pressure": "检查气管路泄漏，调整压力设定值，检查进气阀工作状态",
            "load_rate": "优化用气调度，考虑配置储气罐，检查加载卸载周期",
            "overall_vibration": "检查轴承磨损，重新校准轴对中，检查基础螺栓紧固",
            "x_vibration": "检查水平方向轴承，校准电机对中",
            "y_vibration": "检查垂直方向轴承，检查基础松动",
            "z_vibration": "检查轴向窜动，检查联轴器磨损",
            "energy_efficiency": "安排全面能耗审计，检查设备老化情况，考虑节能改造",
        }

        base_rec = rec_map.get(parameter, "请安排技术人员现场检查")

        if severity == "warning":
            return f"[{level.level.upper()}] {base_rec}，并加强监测频率"
        elif severity == "critical":
            return f"[{level.level.upper()}] {base_rec}，必要时停机检修避免故障扩大"

        return base_rec

    def _get_unit(self, parameter: str) -> str:
        units = {
            "power": "kW",
            "current": "A",
            "temperature": "℃",
            "pressure": "MPa",
            "load_rate": "%",
            "overall_vibration": "mm/s",
            "x_vibration": "mm/s",
            "y_vibration": "mm/s",
            "z_vibration": "mm/s",
            "energy_efficiency": "%",
        }
        return units.get(parameter, "")

    def get_all_thresholds_dict(self) -> Dict:
        result = {}
        for param, levels in self._thresholds.items():
            result[param] = [
                {
                    "level": l.level,
                    "min_value": l.min_value,
                    "max_value": l.max_value,
                    "description": l.description,
                }
                for l in levels
            ]
        return result


threshold_manager = ThresholdManager()
