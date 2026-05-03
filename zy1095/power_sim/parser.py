import json
import csv
from pathlib import Path
from datetime import time
from typing import List, Optional, Dict, Any, Tuple
from pydantic import ValidationError

from .models import (
    BatterySpec, BatteryChemistry, Load, DeviceType, LoadPriority,
    SolarPanel, Plan, WeatherProfile, WeatherCondition, WEATHER_FACTORS
)


class ParseError(Exception):
    """解析错误"""
    pass


def parse_time_str(time_str: str) -> time:
    """解析时间字符串，支持 'HH:MM' 或 'HH:MM:SS' 格式"""
    time_str = time_str.strip()
    try:
        parts = time_str.split(':')
        if len(parts) == 2:
            return time(hour=int(parts[0]), minute=int(parts[1]))
        elif len(parts) == 3:
            return time(hour=int(parts[0]), minute=int(parts[1]), second=int(parts[2]))
        else:
            raise ValueError(f"无效的时间格式: {time_str}")
    except ValueError as e:
        raise ParseError(f"时间格式错误: {time_str} - {str(e)}")


def parse_power_value(value_str: str) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    """解析功率/电流电压值，支持 '100W', '5A', '12V', '5A@12V' 格式"""
    value_str = value_str.strip().lower()
    power_w = None
    current_a = None
    voltage = None
    
    if '@' in value_str:
        current_part, voltage_part = value_str.split('@', 1)
        current_a = float(current_part.replace('a', '').strip())
        voltage = float(voltage_part.replace('v', '').strip())
    elif 'w' in value_str:
        power_w = float(value_str.replace('w', '').strip())
    elif 'a' in value_str:
        current_a = float(value_str.replace('a', '').strip())
    elif 'v' in value_str:
        voltage = float(value_str.replace('v', '').strip())
    
    return power_w, current_a, voltage


def parse_battery_json(file_path: Path) -> BatterySpec:
    """解析电池配置 JSON 文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'chemistry' in data:
            data['chemistry'] = BatteryChemistry(data['chemistry'].lower())
        
        return BatterySpec(**data)
    
    except json.JSONDecodeError as e:
        raise ParseError(f"JSON 解析错误 ({file_path}): {str(e)}")
    except ValidationError as e:
        error_messages = []
        for error in e.errors():
            field = '.'.join(str(loc) for loc in error['loc'])
            error_messages.append(f"字段 '{field}': {error['msg']}")
        raise ParseError(f"电池配置验证失败 ({file_path}):\n" + "\n".join(error_messages))
    except Exception as e:
        raise ParseError(f"读取电池配置失败 ({file_path}): {str(e)}")


def parse_loads_csv(file_path: Path) -> List[Load]:
    """解析负载 CSV 文件"""
    loads = []
    errors = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    name = row.get('name', '').strip()
                    if not name:
                        errors.append(f"第 {row_num} 行: 设备名称不能为空")
                        continue
                    
                    device_type_str = row.get('device_type', 'dc').strip().lower()
                    try:
                        device_type = DeviceType(device_type_str)
                    except ValueError:
                        errors.append(f"第 {row_num} 行: 无效的设备类型 '{device_type_str}'，应为 'dc' 或 'ac'")
                        continue
                    
                    power_str = row.get('power', '').strip()
                    current_str = row.get('current', '').strip()
                    voltage_str = row.get('voltage', '').strip()
                    
                    power_w = None
                    current_a = None
                    voltage = None
                    
                    if power_str:
                        try:
                            power_w, _, _ = parse_power_value(power_str)
                        except ParseError as e:
                            errors.append(f"第 {row_num} 行: 功率值格式错误: {str(e)}")
                            continue
                    
                    if current_str:
                        try:
                            current_a = float(current_str.replace('a', '').strip().lower())
                        except ValueError:
                            errors.append(f"第 {row_num} 行: 电流值格式错误: {current_str}")
                            continue
                    
                    if voltage_str:
                        try:
                            voltage = float(voltage_str.replace('v', '').strip().lower())
                        except ValueError:
                            errors.append(f"第 {row_num} 行: 电压值格式错误: {voltage_str}")
                            continue
                    
                    priority_str = row.get('priority', 'medium').strip().lower()
                    try:
                        priority = LoadPriority(priority_str)
                    except ValueError:
                        errors.append(f"第 {row_num} 行: 无效的优先级 '{priority_str}'")
                        continue
                    
                    start_time_str = row.get('start_time', '').strip()
                    end_time_str = row.get('end_time', '').strip()
                    
                    if not start_time_str or not end_time_str:
                        errors.append(f"第 {row_num} 行: 开始时间和结束时间不能为空")
                        continue
                    
                    try:
                        start_time = parse_time_str(start_time_str)
                        end_time = parse_time_str(end_time_str)
                    except ParseError as e:
                        errors.append(f"第 {row_num} 行: {str(e)}")
                        continue
                    
                    duty_cycle_str = row.get('duty_cycle', '100').strip().lower().replace('%', '')
                    try:
                        duty_cycle = float(duty_cycle_str)
                        if not (0 <= duty_cycle <= 100):
                            errors.append(f"第 {row_num} 行: 占空比必须在 0-100% 之间")
                            continue
                    except ValueError:
                        errors.append(f"第 {row_num} 行: 占空比格式错误: {duty_cycle_str}")
                        continue
                    
                    load = Load(
                        name=name,
                        device_type=device_type,
                        power_w=power_w,
                        current_a=current_a,
                        voltage=voltage,
                        priority=priority,
                        start_time=start_time,
                        end_time=end_time,
                        duty_cycle_percent=duty_cycle
                    )
                    loads.append(load)
                
                except Exception as e:
                    errors.append(f"第 {row_num} 行: 解析错误 - {str(e)}")
    
    except FileNotFoundError:
        raise ParseError(f"负载文件不存在: {file_path}")
    except csv.Error as e:
        raise ParseError(f"CSV 解析错误 ({file_path}): {str(e)}")
    
    if errors:
        raise ParseError("负载 CSV 解析错误:\n" + "\n".join(errors))
    
    if not loads:
        raise ParseError("负载 CSV 中没有有效的负载数据")
    
    return loads


def parse_solar_csv(file_path: Path) -> List[SolarPanel]:
    """解析太阳能 CSV 文件"""
    panels = []
    errors = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    name = row.get('name', '').strip()
                    if not name:
                        errors.append(f"第 {row_num} 行: 太阳能板名称不能为空")
                        continue
                    
                    max_power_str = row.get('max_power', '').strip().lower().replace('w', '')
                    try:
                        max_power_w = float(max_power_str)
                        if max_power_w <= 0:
                            errors.append(f"第 {row_num} 行: 最大功率必须大于 0")
                            continue
                    except ValueError:
                        errors.append(f"第 {row_num} 行: 功率值格式错误: {row.get('max_power', '')}")
                        continue
                    
                    efficiency_str = row.get('efficiency', '100').strip().lower().replace('%', '')
                    try:
                        efficiency = float(efficiency_str)
                        if not (0 <= efficiency <= 100):
                            errors.append(f"第 {row_num} 行: 效率必须在 0-100% 之间")
                            continue
                    except ValueError:
                        errors.append(f"第 {row_num} 行: 效率格式错误: {efficiency_str}")
                        continue
                    
                    start_time_str = row.get('start_time', '').strip()
                    end_time_str = row.get('end_time', '').strip()
                    
                    if not start_time_str or not end_time_str:
                        errors.append(f"第 {row_num} 行: 开始发电时间和结束发电时间不能为空")
                        continue
                    
                    try:
                        start_time = parse_time_str(start_time_str)
                        end_time = parse_time_str(end_time_str)
                    except ParseError as e:
                        errors.append(f"第 {row_num} 行: {str(e)}")
                        continue
                    
                    power_profile = {}
                    for hour in range(24):
                        key = f"hour_{hour}"
                        if key in row and row[key].strip():
                            try:
                                profile_value = float(row[key].strip())
                                if 0 <= profile_value <= 1:
                                    power_profile[hour] = profile_value
                            except ValueError:
                                pass
                    
                    panel = SolarPanel(
                        name=name,
                        max_power_w=max_power_w,
                        efficiency_percent=efficiency,
                        start_time=start_time,
                        end_time=end_time,
                        power_profile=power_profile
                    )
                    panels.append(panel)
                
                except Exception as e:
                    errors.append(f"第 {row_num} 行: 解析错误 - {str(e)}")
    
    except FileNotFoundError:
        raise ParseError(f"太阳能文件不存在: {file_path}")
    except csv.Error as e:
        raise ParseError(f"CSV 解析错误 ({file_path}): {str(e)}")
    
    if errors:
        raise ParseError("太阳能 CSV 解析错误:\n" + "\n".join(errors))
    
    return panels


def parse_plan_json(file_path: Path) -> Plan:
    """解析计划 JSON 文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'weather' in data:
            weather_data = data['weather']
            if 'condition' in weather_data:
                try:
                    condition = WeatherCondition(weather_data['condition'].lower())
                    weather_data['condition'] = condition
                    if 'factor_percent' not in weather_data:
                        weather_data['factor_percent'] = WEATHER_FACTORS[condition]
                except ValueError:
                    raise ParseError(f"无效的天气条件: {weather_data['condition']}")
            data['weather'] = WeatherProfile(**weather_data)
        
        return Plan(**data)
    
    except json.JSONDecodeError as e:
        raise ParseError(f"JSON 解析错误 ({file_path}): {str(e)}")
    except ValidationError as e:
        error_messages = []
        for error in e.errors():
            field = '.'.join(str(loc) for loc in error['loc'])
            error_messages.append(f"字段 '{field}': {error['msg']}")
        raise ParseError(f"计划配置验证失败 ({file_path}):\n" + "\n".join(error_messages))
    except Exception as e:
        raise ParseError(f"读取计划配置失败 ({file_path}): {str(e)}")


def parse_all_configs(
    battery_path: Path,
    loads_path: Path,
    solar_path: Optional[Path] = None,
    plan_path: Optional[Path] = None
) -> Tuple[BatterySpec, List[Load], List[SolarPanel], Plan]:
    """解析所有配置文件"""
    battery = parse_battery_json(battery_path)
    loads = parse_loads_csv(loads_path)
    
    solar_panels = []
    if solar_path and solar_path.exists():
        solar_panels = parse_solar_csv(solar_path)
    
    plan = None
    if plan_path and plan_path.exists():
        plan = parse_plan_json(plan_path)
    
    if plan is None:
        plan = Plan(name="默认方案")
    
    return battery, loads, solar_panels, plan
