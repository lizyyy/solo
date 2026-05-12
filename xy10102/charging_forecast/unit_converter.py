import re
import pandas as pd
from typing import Tuple, Optional, Dict, Any, List
from dataclasses import dataclass
from .config import Config


@dataclass
class UnitConversionResult:
    value: Optional[float]
    original_value: str
    detected_unit: Optional[str]
    target_unit: str
    converted: bool
    conversion_factor: Optional[float]
    error: Optional[str] = None


@dataclass
class UnitDetectionResult:
    column: str
    original_unit: str
    detected_units: Dict[str, int]
    dominant_unit: str
    needs_conversion: bool
    conversion_map: Dict[str, float]


class UnitConverter:
    POWER_UNITS = {
        'kW': {
            'kw': 1.0, 'kW': 1.0, 'KW': 1.0, 'kWh': None,
            'w': 0.001, 'W': 0.001, '瓦特': 0.001, '瓦': 0.001,
            'mw': 1000.0, 'MW': 1000.0, '兆瓦': 1000.0,
            'gw': 1000000.0, 'GW': 1000000.0, '吉瓦': 1000000.0,
            '千瓦': 1.0, '千瓦时': None, 'kwatts': 1.0, 'KWATTS': 1.0,
            'k-w': 1.0, 'K-W': 1.0
        }
    }

    ENERGY_UNITS = {
        'kWh': {
            'kwh': 1.0, 'kWh': 1.0, 'KWH': 1.0, '度': 1.0,
            'wh': 0.001, 'Wh': 0.001, 'WH': 0.001, '瓦时': 0.001,
            'mwh': 1000.0, 'MWh': 1000.0, 'MWH': 1000.0, '兆瓦时': 1000.0,
            'gwh': 1000000.0, 'GWh': 1000000.0, '吉瓦时': 1000000.0,
            '千瓦时': 1.0, '千瓦时': 1.0
        }
    }

    TIME_UNITS = {
        'minutes': {
            'min': 1.0, 'minute': 1.0, 'minutes': 1.0,
            '分': 1.0, '分钟': 1.0, 'm': 1.0,
            's': 1/60, 'sec': 1/60, 'second': 1/60, 'seconds': 1/60,
            '秒': 1/60, '秒钟': 1/60,
            'h': 60.0, 'hr': 60.0, 'hour': 60.0, 'hours': 60.0,
            '小时': 60.0, '时': 60.0,
            'd': 1440.0, 'day': 1440.0, 'days': 1440.0,
            '天': 1440.0, '日': 1440.0
        }
    }

    PRICE_UNITS = {
        'yuan/kWh': {
            'yuan': 1.0, '元': 1.0, '人民币': 1.0,
            '￥': 1.0, '¥': 1.0
        }
    }

    def __init__(self, config: Config):
        self.config = config
        self.cols = config.columns
        self.unit_config = config.unit_conversion

    def detect_unit(self, value_str: str, target_unit: str) -> Tuple[Optional[float], Optional[str], Optional[str]]:
        """
        从字符串中检测数值和单位
        
        Returns:
            (数值, 检测到的单位, 错误信息)
        """
        if value_str is None or pd.isna(value_str):
            return None, None, None

        value_str = str(value_str).strip()

        if value_str == '' or value_str.lower() == 'nan':
            return None, None, "空值"

        unit_map = self._get_unit_map(target_unit)

        number_pattern = r'^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?'
        match = re.search(number_pattern, value_str)

        if not match:
            return None, None, f"无法解析数值: {value_str}"

        num_str = match.group()
        try:
            number = float(num_str)
        except ValueError:
            return None, None, f"数值解析失败: {num_str}"

        remaining = value_str[match.end():].strip()

        if not remaining:
            return number, None, None

        detected_unit = None
        best_match_len = 0

        for unit_key, factor in unit_map.items():
            if factor is None:
                continue
            if remaining.lower() == unit_key.lower():
                detected_unit = unit_key
                break
            if unit_key.lower() in remaining.lower():
                if len(unit_key) > best_match_len:
                    detected_unit = unit_key
                    best_match_len = len(unit_key)

        if detected_unit is None:
            return number, None, f"无法识别单位: {remaining} (目标单位: {target_unit})"

        return number, detected_unit, None

    def _get_unit_map(self, target_unit: str) -> Dict[str, float]:
        """根据目标单位获取单位映射表"""
        if target_unit in ['kW', 'kw', 'KW']:
            return self.POWER_UNITS['kW']
        elif target_unit in ['kWh', 'kwh', 'KWH', '度']:
            return self.ENERGY_UNITS['kWh']
        elif target_unit in ['minutes', 'minute', 'min', 'm']:
            return self.TIME_UNITS['minutes']
        elif target_unit in ['yuan/kWh', '元/kWh', '元/度']:
            return self.PRICE_UNITS['yuan/kWh']
        return {}

    def convert_value(self, value_str: str, target_unit: str) -> UnitConversionResult:
        """
        转换单个值到目标单位
        """
        number, detected_unit, error = self.detect_unit(value_str, target_unit)

        if error:
            return UnitConversionResult(
                value=None,
                original_value=str(value_str),
                detected_unit=detected_unit,
                target_unit=target_unit,
                converted=False,
                conversion_factor=None,
                error=error
            )

        if number is None:
            return UnitConversionResult(
                value=None,
                original_value=str(value_str),
                detected_unit=None,
                target_unit=target_unit,
                converted=False,
                conversion_factor=None,
                error=None
            )

        if detected_unit is None:
            return UnitConversionResult(
                value=number,
                original_value=str(value_str),
                detected_unit=None,
                target_unit=target_unit,
                converted=True,
                conversion_factor=1.0
            )

        unit_map = self._get_unit_map(target_unit)
        factor = unit_map.get(detected_unit.lower(), None)

        if factor is None:
            return UnitConversionResult(
                value=None,
                original_value=str(value_str),
                detected_unit=detected_unit,
                target_unit=target_unit,
                converted=False,
                conversion_factor=None,
                error=f"不支持的单位换算: {detected_unit} -> {target_unit}"
            )

        converted_value = number * factor

        return UnitConversionResult(
            value=converted_value,
            original_value=str(value_str),
            detected_unit=detected_unit,
            target_unit=target_unit,
            converted=True,
            conversion_factor=factor
        )

    def convert_series(self, series: pd.Series, column_name: str,
                       target_unit: str = None) -> Tuple[pd.Series, List[UnitConversionResult]]:
        """
        转换整个序列，并记录每个值的转换结果
        """
        if target_unit is None:
            if column_name == self.cols.charging_power:
                target_unit = self.config.quality_control.charging_power.get('unit', 'kW')
            elif column_name == self.cols.energy_consumed:
                target_unit = self.config.quality_control.energy_consumed.get('unit', 'kWh')
            elif column_name == self.cols.charging_duration:
                target_unit = self.config.quality_control.charging_duration.get('unit', 'minutes')
            elif column_name == self.cols.electricity_price:
                target_unit = self.config.quality_control.electricity_price.get('unit', 'yuan/kWh')

        conversion_results = []
        converted_values = []

        for idx, value in enumerate(series):
            if pd.isna(value):
                conversion_results.append(
                    UnitConversionResult(
                        value=None,
                        original_value=str(value),
                        detected_unit=None,
                        target_unit=target_unit,
                        converted=False,
                        conversion_factor=None,
                        error=None
                    )
                )
                converted_values.append(None)
                continue

            result = self.convert_value(value, target_unit)
            conversion_results.append(result)

            if result.converted and result.value is not None:
                converted_values.append(result.value)
            else:
                converted_values.append(None)

        return pd.Series(converted_values, index=series.index), conversion_results

    def analyze_column_units(self, series: pd.Series, column_name: str) -> UnitDetectionResult:
        """
        分析列中的单位分布
        """
        detected_units = {}
        target_unit = None

        if column_name == self.cols.charging_power:
            target_unit = self.config.quality_control.charging_power.get('unit', 'kW')
        elif column_name == self.cols.energy_consumed:
            target_unit = self.config.quality_control.energy_consumed.get('unit', 'kWh')
        elif column_name == self.cols.charging_duration:
            target_unit = self.config.quality_control.charging_duration.get('unit', 'minutes')
        elif column_name == self.cols.electricity_price:
            target_unit = self.config.quality_control.electricity_price.get('unit', 'yuan/kWh')

        for value in series:
            if pd.isna(value):
                continue

            value_str = str(value).strip()
            number, detected_unit, error = self.detect_unit(value_str, target_unit)

            if detected_unit:
                detected_units[detected_unit] = detected_units.get(detected_unit, 0) + 1
            else:
                detected_units['[未指定]'] = detected_units.get('[未指定]', 0) + 1

        dominant_unit = max(detected_units.items(), key=lambda x: x[1])[0] if detected_units else target_unit
        needs_conversion = len(detected_units) > 1 or (dominant_unit != '[未指定]' and dominant_unit.lower() != target_unit.lower())

        conversion_map = {}
        unit_map = self._get_unit_map(target_unit)

        for unit in detected_units.keys():
            if unit == '[未指定]':
                conversion_map[unit] = 1.0
            else:
                factor = unit_map.get(unit.lower(), None)
                if factor is not None:
                    conversion_map[unit] = factor

        return UnitDetectionResult(
            column=column_name,
            original_unit=target_unit,
            detected_units=detected_units,
            dominant_unit=dominant_unit,
            needs_conversion=needs_conversion,
            conversion_map=conversion_map
        )
