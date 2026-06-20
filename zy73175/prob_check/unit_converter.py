from typing import Tuple

UNIT_FACTORS = {
    "米": 1.0,
    "厘米": 0.01,
    "毫米": 0.001,
    "千米": 1000.0,
    "秒": 1.0,
    "分钟": 60.0,
    "小时": 3600.0,
    "千克": 1.0,
    "克": 0.001,
    "吨": 1000.0,
    "摄氏度": 1.0,
    "华氏度": "fahrenheit",
    "开尔文": "kelvin",
    "%": 0.01,
    "百分比": 0.01,
    "概率": 1.0,
    "小数概率": 1.0,
}

TEMPERATURE_UNITS = {"摄氏度", "华氏度", "开尔文"}


def convert_unit(value: float, from_unit: str, to_unit: str) -> Tuple[float, bool, str]:
    if from_unit == to_unit:
        return value, True, ""

    if from_unit not in UNIT_FACTORS or to_unit not in UNIT_FACTORS:
        return value, False, f"未知单位: {from_unit} 或 {to_unit}"

    from_is_temp = from_unit in TEMPERATURE_UNITS
    to_is_temp = to_unit in TEMPERATURE_UNITS

    if from_is_temp or to_is_temp:
        if not (from_is_temp and to_is_temp):
            return value, False, f"温度单位不能与非温度单位换算: {from_unit} -> {to_unit}"
        return _convert_temperature(value, from_unit, to_unit)

    from_factor = UNIT_FACTORS[from_unit]
    to_factor = UNIT_FACTORS[to_unit]

    if isinstance(from_factor, str) or isinstance(to_factor, str):
        return value, False, f"单位类型不兼容: {from_unit} -> {to_unit}"

    base_value = value * from_factor
    result = base_value / to_factor
    return round(result, 6), True, ""


def _convert_temperature(value: float, from_unit: str, to_unit: str) -> Tuple[float, bool, str]:
    try:
        if from_unit == "摄氏度":
            celsius = value
        elif from_unit == "华氏度":
            celsius = (value - 32) * 5 / 9
        elif from_unit == "开尔文":
            celsius = value - 273.15
        else:
            return value, False, f"未知温度单位: {from_unit}"

        if to_unit == "摄氏度":
            result = celsius
        elif to_unit == "华氏度":
            result = celsius * 9 / 5 + 32
        elif to_unit == "开尔文":
            result = celsius + 273.15
        else:
            return value, False, f"未知温度单位: {to_unit}"

        return round(result, 6), True, ""
    except Exception as e:
        return value, False, f"温度换算异常: {str(e)}"
