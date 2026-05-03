import csv
from datetime import datetime
from typing import List, Dict, Any, Optional

from metro_power_analyzer.rules.event_chain import Event
from metro_power_analyzer.rules.evaluator import EvaluationResult, ProtectionStatus


def export_events_csv(file_path: str,
                      events: List[Event],
                      evaluation_results: List[EvaluationResult] = None) -> None:
    """
    导出事件到CSV文件
    
    字段包括：
    - 事件ID
    - 时间
    - 事件类型
    - 装置名称
    - 相别
    - 动作值
    - 定值
    - 评估状态
    - 详细信息
    """
    results_map = {}
    if evaluation_results:
        for result in evaluation_results:
            results_map[result.event_id] = result
    
    rows = []
    for event in events:
        result = results_map.get(event.id)
        
        row = {
            '事件ID': event.id,
            '时间': event.timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3] if event.timestamp else '',
            '事件类型': event.event_type.value if event.event_type else '',
            '装置名称': event.device_name,
            '相别': event.phase,
            '动作值': event.action_value,
            '定值': event.setting_value,
            '评估状态': result.status.value if result else '未评估',
            '详细信息': result.details if result else '',
            '是否乱序': '是' if event.out_of_order else '否',
            '备注': event.notes,
            '数据源': event.source,
        }
        rows.append(row)
    
    if not rows:
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['无数据'])
        return
    
    fieldnames = list(rows[0].keys())
    
    with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def export_raw_events_csv(file_path: str,
                         raw_actions: List[Dict[str, Any]]) -> None:
    """
    导出原始保护动作记录到CSV
    """
    if not raw_actions:
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['无数据'])
        return
    
    fieldnames = set()
    for action in raw_actions:
        for key in action.keys():
            if key != 'raw_data':
                fieldnames.add(key)
    
    fieldnames = sorted(list(fieldnames))
    
    rows = []
    for action in raw_actions:
        row = {}
        for key in fieldnames:
            value = action.get(key, '')
            if isinstance(value, datetime):
                row[key] = value.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            else:
                row[key] = value
        rows.append(row)
    
    with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
