import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config import WARNING_MESSAGES


@dataclass
class ConflictRecord:
    conflict_type: str
    data_source: str
    wechat_record: str
    data_value: float
    wechat_value: float
    discrepancy: float
    discrepancy_percent: float
    timestamp: str
    suggestion: str
    severity: str


class ConflictDetector:
    def __init__(self):
        self.conflicts = []
        self.wechat_records = []
        
    def add_wechat_record(self, timestamp: str, content: str, 
                          distance: float = None, direction: str = None,
                          operator: str = None):
        self.wechat_records.append({
            'timestamp': timestamp,
            'content': content,
            'distance': distance,
            'direction': direction,
            'operator': operator
        })
    
    def parse_wechat_text(self, wechat_text: str) -> List[Dict]:
        records = []
        lines = wechat_text.strip().split('\n')
        
        current_record = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                if current_record:
                    records.append(current_record)
                    current_record = {}
                continue
                
            if any(key in line for key in ['距离', 'mm', 'cm', 'm', '误差', '偏差']):
                import re
                numbers = re.findall(r'[-+]?\d*\.?\d+', line)
                if numbers:
                    current_record['distance'] = float(numbers[0])
                    if 'mm' in line:
                        current_record['unit'] = 'mm'
                    elif 'cm' in line:
                        current_record['unit'] = 'cm'
                    elif 'm' in line:
                        current_record['unit'] = 'm'
                        
            if '正向' in line or '反向' in line or '+' in line or '-' in line:
                if '正向' in line or '+' in line:
                    current_record['direction'] = '正向'
                else:
                    current_record['direction'] = '反向'
                    
            if ':' in line and any(char.isdigit() for char in line.split(':')[0]):
                current_record['timestamp'] = line.split(' ')[0] if ' ' in line else line
                
            current_record['content'] = current_record.get('content', '') + line + '\n'
            
        if current_record:
            records.append(current_record)
            
        return records
    
    def compare_distance(self, data_df: pd.DataFrame, 
                          data_value_col: str,
                          data_time_col: str = None,
                          threshold_percent: float = 5.0,
                          threshold_absolute: float = 1.0) -> List[ConflictRecord]:
        conflicts = []
        
        for wechat_rec in self.wechat_records:
            if 'distance' not in wechat_rec:
                continue
                
            wechat_distance = wechat_rec['distance']
            unit = wechat_rec.get('unit', 'mm')
            
            if unit == 'cm':
                wechat_distance *= 10
            elif unit == 'm':
                wechat_distance *= 1000
                
            if data_time_col and data_time_col in data_df.columns and 'timestamp' in wechat_rec:
                try:
                    data_times = pd.to_datetime(data_df[data_time_col])
                    wechat_time = pd.to_datetime(wechat_rec['timestamp'])
                    time_diff = abs((data_times - wechat_time).dt.total_seconds())
                    closest_idx = time_diff.idxmin()
                    
                    if time_diff[closest_idx] < 300:
                        data_value = data_df.iloc[closest_idx][data_value_col]
                        discrepancy = abs(data_value - wechat_distance)
                        discrepancy_pct = (discrepancy / abs(wechat_distance)) * 100 if wechat_distance != 0 else 0
                        
                        if discrepancy_pct > threshold_percent or discrepancy > threshold_absolute:
                            severity = 'high' if discrepancy_pct > 20 or discrepancy > 10 else 'medium'
                            
                            conflicts.append(ConflictRecord(
                                conflict_type='数值差异',
                                data_source='实验数据',
                                wechat_record=wechat_rec['content'],
                                data_value=float(data_value),
                                wechat_value=float(wechat_distance),
                                discrepancy=float(discrepancy),
                                discrepancy_percent=float(discrepancy_pct),
                                timestamp=wechat_rec.get('timestamp', ''),
                                suggestion=f'建议核对测量条件，实验数据值: {data_value:.2f} mm，微信群记录: {wechat_distance:.2f} mm',
                                severity=severity
                            ))
                except:
                    pass
            else:
                data_values = pd.to_numeric(data_df[data_value_col], errors='coerce').dropna()
                if len(data_values) > 0:
                    mean_data = data_values.mean()
                    discrepancy = abs(mean_data - wechat_distance)
                    discrepancy_pct = (discrepancy / abs(wechat_distance)) * 100 if wechat_distance != 0 else 0
                    
                    if discrepancy_pct > threshold_percent * 2 or discrepancy > threshold_absolute * 2:
                        conflicts.append(ConflictRecord(
                            conflict_type='数值差异(概略)',
                            data_source='实验数据',
                            wechat_record=wechat_rec['content'],
                            data_value=float(mean_data),
                            wechat_value=float(wechat_distance),
                            discrepancy=float(discrepancy),
                            discrepancy_percent=float(discrepancy_pct),
                            timestamp=wechat_rec.get('timestamp', ''),
                            suggestion='时间不匹配，建议核对微信群记录对应的具体测量点',
                            severity='medium'
                        ))
                        
        self.conflicts.extend(conflicts)
        return conflicts
    
    def compare_direction(self, data_df: pd.DataFrame, 
                           data_direction_col: str,
                           data_time_col: str = None) -> List[ConflictRecord]:
        conflicts = []
        
        for wechat_rec in self.wechat_records:
            if 'direction' not in wechat_rec:
                continue
                
            wechat_direction = wechat_rec['direction']
            
            if data_time_col and data_time_col in data_df.columns and 'timestamp' in wechat_rec:
                try:
                    data_times = pd.to_datetime(data_df[data_time_col])
                    wechat_time = pd.to_datetime(wechat_rec['timestamp'])
                    time_diff = abs((data_times - wechat_time).dt.total_seconds())
                    closest_idx = time_diff.idxmin()
                    
                    if time_diff[closest_idx] < 300:
                        data_direction = str(data_df.iloc[closest_idx][data_direction_col]).strip()
                        
                        data_is_positive = data_direction in ['正向', '正', '+']
                        data_is_negative = data_direction in ['反向', '反', '-']
                        wechat_is_positive = wechat_direction in ['正向', '正', '+']
                        
                        if (data_is_positive or data_is_negative) and (data_is_positive != wechat_is_positive):
                            conflicts.append(ConflictRecord(
                                conflict_type='方向冲突',
                                data_source='实验数据',
                                wechat_record=wechat_rec['content'],
                                data_value=0,
                                wechat_value=0,
                                discrepancy=0,
                                discrepancy_percent=0,
                                timestamp=wechat_rec.get('timestamp', ''),
                                suggestion=f'方向不一致，实验数据: {data_direction}，微信群记录: {wechat_direction}',
                                severity='high'
                            ))
                except:
                    pass
                    
        self.conflicts.extend(conflicts)
        return conflicts
    
    def get_conflict_summary(self) -> Dict:
        summary = {
            'total_conflicts': len(self.conflicts),
            'by_type': {},
            'by_severity': {'high': 0, 'medium': 0, 'low': 0},
            'conflicts': self.conflicts
        }
        
        for conflict in self.conflicts:
            if conflict.conflict_type not in summary['by_type']:
                summary['by_type'][conflict.conflict_type] = 0
            summary['by_type'][conflict.conflict_type] += 1
            
            summary['by_severity'][conflict.severity] += 1
            
        return summary
    
    def get_suggested_actions(self) -> List[str]:
        actions = []
        
        high_conflicts = [c for c in self.conflicts if c.severity == 'high']
        medium_conflicts = [c for c in self.conflicts if c.severity == 'medium']
        
        if high_conflicts:
            actions.append(f"【紧急】存在 {len(high_conflicts)} 个严重冲突，需要优先核对：")
            for c in high_conflicts[:3]:
                actions.append(f"  - {c.conflict_type}: {c.suggestion}")
                
        if medium_conflicts:
            actions.append(f"【建议】存在 {len(medium_conflicts)} 个中等程度冲突：")
            for c in medium_conflicts[:2]:
                actions.append(f"  - {c.conflict_type}: {c.suggestion}")
                
        if not self.conflicts:
            actions.append("未检测到数据冲突，可以继续校准流程")
            
        return actions
    
    def clear_conflicts(self):
        self.conflicts = []
        self.wechat_records = []
