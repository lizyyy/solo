"""数据导入模块 - 处理 CSV、YAML、JSON 文件读取"""

import csv
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import yaml


class DataLoadError(Exception):
    """数据加载异常"""
    pass


def load_water_quality_csv(filepath: Union[str, Path]) -> List[Dict[str, Any]]:
    """读取池塘水质时序 CSV

    CSV 格式: timestamp, pond_id, dissolved_oxygen, ammonia_nitrogen, temperature, ph
    处理:
    - 传感器缺测 (空值或 NA)
    - 跨午夜时间戳
    - 同一池塘重复记录
    """
    path = Path(filepath)
    if not path.exists():
        raise DataLoadError(f"水质数据文件不存在: {filepath}")

    records = {}
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            ts_str = row.get('timestamp', '').strip()
            pond_id = row.get('pond_id', '').strip()

            if not ts_str or not pond_id:
                continue

            try:
                ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            except ValueError:
                try:
                    ts = datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    continue

            do_val = row.get('dissolved_oxygen', '').strip()
            ammonia_val = row.get('ammonia_nitrogen', '').strip()
            temp_val = row.get('temperature', '').strip()
            ph_val = row.get('ph', '').strip()

            key = (ts.isoformat(), pond_id)
            if key in records:
                continue

            record = {
                'timestamp': ts,
                'pond_id': pond_id,
                'dissolved_oxygen': _parse_float(do_val),
                'ammonia_nitrogen': _parse_float(ammonia_val),
                'temperature': _parse_float(temp_val),
                'ph': _parse_float(ph_val),
            }
            records[key] = record

    return list(records.values())


def load_feed_plan_yaml(filepath: Union[str, Path]) -> Dict[str, Any]:
    """读取投喂计划 YAML"""
    path = Path(filepath)
    if not path.exists():
        raise DataLoadError(f"投喂计划文件不存在: {filepath}")

    with open(path, encoding='utf-8') as f:
        data = yaml.safe_load(f)

    if not data:
        raise DataLoadError(f"投喂计划文件为空: {filepath}")

    return data


def load_weather_forecast_json(filepath: Union[str, Path]) -> Dict[str, Any]:
    """读取天气预报 JSON，处理跨午夜情况"""
    path = Path(filepath)
    if not path.exists():
        raise DataLoadError(f"天气预报文件不存在: {filepath}")

    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    if 'forecast' not in data:
        raise DataLoadError(f"天气预报 JSON 缺少 forecast 字段: {filepath}")

    return data


def load_pond_thresholds(filepath: Union[str, Path]) -> Dict[str, Dict[str, float]]:
    """读取池塘阈值配置 JSON"""
    path = Path(filepath)
    if not path.exists():
        raise DataLoadError(f"阈值配置文件不存在: {filepath}")

    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    thresholds = {}
    for pond_id, config in data.items():
        thresholds[pond_id] = {
            'do_min': config.get('do_min', 5.0),
            'do_max': config.get('do_max', 15.0),
            'ammonia_max': config.get('ammonia_max', 0.1),
            'temp_min': config.get('temp_min', 18.0),
            'temp_max': config.get('temp_max', 32.0),
        }

    return thresholds


def _parse_float(value: str) -> Optional[float]:
    """解析浮点数，缺测返回 None"""
    if not value or value.upper() in ('NA', 'N/A', 'NULL', '', '-'):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def merge_pond_data(
    water_records: List[Dict[str, Any]],
    feed_plan: Dict[str, Any],
    forecast: Dict[str, Any],
    thresholds: Dict[str, Dict[str, float]]
) -> Dict[str, Any]:
    """合并所有数据源，返回结构化数据"""
    ponds = {}

    for record in water_records:
        pid = record['pond_id']
        if pid not in ponds:
            ponds[pid] = {
                'water_quality': [],
                'feed_plan': feed_plan.get(pid, feed_plan.get('default', {})),
                'thresholds': thresholds.get(pid, thresholds.get('default', {})),
                'pond_id': pid,
            }
        ponds[pid]['water_quality'].append(record)

    for pid in ponds:
        ponds[pid]['water_quality'].sort(key=lambda x: x['timestamp'])

    return {
        'ponds': ponds,
        'forecast': forecast,
        'generated_at': datetime.now(),
    }
