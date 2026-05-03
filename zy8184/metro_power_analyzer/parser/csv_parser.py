import csv
import re
from datetime import datetime
from typing import List, Dict, Any, Optional


def parse_datetime(time_str: str) -> datetime:
    """解析时间字符串，支持多种格式"""
    formats = [
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M:%S.%f',
        '%Y/%m/%d %H:%M:%S',
        '%Y/%m/%d %H:%M:%S.%f',
        '%d/%m/%Y %H:%M:%S',
        '%d/%m/%Y %H:%M:%S.%f',
    ]
    
    time_str = time_str.strip()
    for fmt in formats:
        try:
            return datetime.strptime(time_str, fmt)
        except ValueError:
            continue
    
    raise ValueError(f"无法解析时间格式: {time_str}")


def parse_protection_csv(file_path: str) -> List[Dict[str, Any]]:
    """
    解析牵引变电所保护动作CSV文件
    
    CSV格式示例:
    时间,装置名称,保护类型,动作类型,动作值,定值,相别,状态
    2024-01-15 10:23:45.123,1#牵引变过流保护,过流保护I段,动作,8.5,5.0,ABC,动作
    """
    actions = []
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, 2):
            try:
                action = {
                    'id': f"act-{row_num-1}",
                    'timestamp': parse_datetime(row.get('时间', row.get('timestamp', ''))),
                    'device_name': row.get('装置名称', row.get('device_name', row.get('device', ''))).strip(),
                    'protection_type': row.get('保护类型', row.get('protection_type', row.get('type', ''))).strip(),
                    'action_type': row.get('动作类型', row.get('action_type', '动作')).strip(),
                    'action_value': _parse_float(row.get('动作值', row.get('action_value', '0'))),
                    'setting_value': _parse_float(row.get('定值', row.get('setting_value', '0'))),
                    'phase': row.get('相别', row.get('phase', 'ABC')).strip(),
                    'status': row.get('状态', row.get('status', '动作')).strip(),
                    'raw_data': dict(row),
                    'source': 'protection_csv',
                }
                actions.append(action)
            except Exception as e:
                print(f"警告: 解析第 {row_num} 行时出错: {e}")
                continue
    
    return actions


def _parse_float(value_str: str) -> float:
    """解析浮点数值，处理各种格式"""
    if not value_str:
        return 0.0
    
    value_str = str(value_str).strip()
    
    match = re.search(r'[\d.]+', value_str)
    if match:
        try:
            return float(match.group())
        except ValueError:
            pass
    
    return 0.0
