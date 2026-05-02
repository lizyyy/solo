import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import pytz

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import Settings
from utils.helpers import parse_datetime, format_datetime, normalize_slot_id, parse_slot_id


class RiskAnalyzer:
    def __init__(self, normalized_data: Dict[str, pd.DataFrame], 
                 container_states: Dict[str, pd.DataFrame] = None):
        self.normalized_data = normalized_data
        self.container_states = container_states or {}
        self.risks: pd.DataFrame = pd.DataFrame()
        self.risk_summary: Dict = {}
    
    def analyze_all(self) -> pd.DataFrame:
        all_risks = []
        
        power_outage_risks = self._analyze_power_outage_timeout()
        all_risks.extend(power_outage_risks)
        
        outlet_conflict_risks = self._analyze_outlet_conflicts()
        all_risks.extend(outlet_conflict_risks)
        
        missing_replug_risks = self._analyze_missing_replug_after_move()
        all_risks.extend(missing_replug_risks)
        
        unresolved_alarm_risks = self._analyze_unresolved_alarms()
        all_risks.extend(unresolved_alarm_risks)
        
        if all_risks:
            self.risks = pd.DataFrame(all_risks)
            self.risks = self.risks.sort_values(['severity', 'risk_time'], 
                                                  ascending=[False, True]).reset_index(drop=True)
        else:
            self.risks = pd.DataFrame(
                columns=['risk_id', 'risk_type', 'severity', 'container_no', 
                         'slot_id', 'outlet_id', 'risk_time', 'description', 
                         'duration_minutes', 'related_records']
            )
        
        self._build_risk_summary()
        
        return self.risks
    
    def _analyze_power_outage_timeout(self) -> List[Dict]:
        risks = []
        risk_id_counter = 1
        
        if 'power_records' not in self.normalized_data:
            return risks
        
        pr = self.normalized_data['power_records']
        
        for container in pr['container_no'].unique():
            container_records = pr[pr['container_no'] == container].sort_values('plug_in_time')
            
            for i in range(len(container_records)):
                current_record = container_records.iloc[i]
                
                if pd.notna(current_record.get('unplug_time')):
                    next_plug_in = None
                    if i + 1 < len(container_records):
                        next_record = container_records.iloc[i + 1]
                        next_plug_in = next_record.get('plug_in_time')
                    
                    if next_plug_in is not None:
                        outage_duration = next_plug_in - current_record['unplug_time']
                        outage_minutes = outage_duration.total_seconds() / 60
                        
                        if outage_minutes > Settings.POWER_OUTAGE_THRESHOLD_MINUTES:
                            severity = self._calculate_severity(outage_minutes)
                            risks.append({
                                'risk_id': f"R-{risk_id_counter:04d}",
                                'risk_type': '断电超时',
                                'severity': severity,
                                'container_no': container,
                                'slot_id': current_record.get('slot_id'),
                                'outlet_id': current_record.get('outlet_id'),
                                'risk_time': current_record['unplug_time'],
                                'description': f"集装箱 {container} 断电后 {outage_minutes:.1f} 分钟未复插",
                                'duration_minutes': round(outage_minutes, 1),
                                'related_records': [current_record['record_id'], 
                                                   container_records.iloc[i + 1]['record_id']],
                            })
                            risk_id_counter += 1
                else:
                    latest_time = self._get_latest_time()
                    if latest_time and current_record['plug_in_time'] < latest_time:
                        pass
        
        return risks
    
    def _analyze_outlet_conflicts(self) -> List[Dict]:
        risks = []
        risk_id_counter = len(risks) + 1
        
        if 'power_records' not in self.normalized_data:
            return risks
        
        pr = self.normalized_data['power_records']
        
        outlets = pr['outlet_id'].dropna().unique()
        
        for outlet in outlets:
            outlet_records = pr[pr['outlet_id'] == outlet].sort_values('plug_in_time')
            
            for i in range(len(outlet_records)):
                current = outlet_records.iloc[i]
                
                for j in range(i + 1, len(outlet_records)):
                    other = outlet_records.iloc[j]
                    
                    current_end = current.get('unplug_time') or self._get_latest_time()
                    other_start = other.get('plug_in_time')
                    
                    if other_start < current_end:
                        conflict_start = max(current['plug_in_time'], other_start)
                        conflict_end = min(current_end, other.get('unplug_time') or self._get_latest_time())
                        conflict_duration = (conflict_end - conflict_start).total_seconds() / 60
                        
                        risks.append({
                            'risk_id': f"R-{risk_id_counter:04d}",
                            'risk_type': '插座冲突',
                            'severity': '紧急',
                            'container_no': f"{current['container_no']}, {other['container_no']}",
                            'slot_id': current.get('slot_id'),
                            'outlet_id': outlet,
                            'risk_time': conflict_start,
                            'description': f"插座 {outlet} 同时被 {current['container_no']} 和 {other['container_no']} 占用",
                            'duration_minutes': round(conflict_duration, 1),
                            'related_records': [current['record_id'], other['record_id']],
                        })
                        risk_id_counter += 1
        
        return risks
    
    def _analyze_missing_replug_after_move(self) -> List[Dict]:
        risks = []
        risk_id_counter = len(risks) + 1
        
        if 'movement_logs' not in self.normalized_data:
            return risks
        
        ml = self.normalized_data['movement_logs']
        pr = self.normalized_data.get('power_records', pd.DataFrame())
        
        for container in ml['container_no'].unique():
            container_moves = ml[ml['container_no'] == container].sort_values('move_time')
            container_power = pd.DataFrame()
            if not pr.empty and 'container_no' in pr.columns:
                container_power = pr[pr['container_no'] == container].sort_values('plug_in_time')
            
            for _, move_row in container_moves.iterrows():
                if move_row['move_type'] == '出闸':
                    continue
                
                move_time = move_row['move_time']
                to_slot = move_row.get('to_slot')
                
                found_replug = False
                replug_time = None
                
                if not container_power.empty:
                    for _, power_row in container_power.iterrows():
                        plug_in_time = power_row['plug_in_time']
                        power_slot = power_row.get('slot_id')
                        
                        time_diff = (plug_in_time - move_time).total_seconds() / 60
                        
                        if 0 <= time_diff < Settings.POWER_OUTAGE_THRESHOLD_MINUTES:
                            if pd.isna(power_slot) or power_slot == to_slot:
                                found_replug = True
                                replug_time = plug_in_time
                                break
                        
                        if time_diff > Settings.POWER_OUTAGE_THRESHOLD_MINUTES:
                            break
                
                if not found_replug:
                    latest_time = self._get_latest_time()
                    outage_duration = (latest_time - move_time).total_seconds() / 60
                    
                    if outage_duration > Settings.POWER_OUTAGE_THRESHOLD_MINUTES:
                        severity = self._calculate_severity(outage_duration)
                        risks.append({
                            'risk_id': f"R-{risk_id_counter:04d}",
                            'risk_type': '移动未复插',
                            'severity': severity,
                            'container_no': container,
                            'slot_id': to_slot,
                            'outlet_id': None,
                            'risk_time': move_time,
                            'description': f"集装箱 {container} 移动到 {to_slot} 后 {outage_duration:.1f} 分钟未复插",
                            'duration_minutes': round(outage_duration, 1),
                            'related_records': [move_row['record_id']],
                        })
                        risk_id_counter += 1
        
        return risks
    
    def _analyze_unresolved_alarms(self) -> List[Dict]:
        risks = []
        risk_id_counter = len(risks) + 1
        
        if 'alarm_events' not in self.normalized_data:
            return risks
        
        ae = self.normalized_data['alarm_events']
        
        unresolved = ae[~ae['is_resolved']]
        
        for _, row in unresolved.iterrows():
            latest_time = self._get_latest_time()
            alarm_duration = (latest_time - row['alarm_time']).total_seconds() / 60
            
            severity_mapping = {
                '紧急': '紧急',
                '重要': '重要',
                '一般': '一般',
                '提示': '提示',
            }
            base_severity = severity_mapping.get(row.get('alarm_level', '一般'), '一般')
            
            if alarm_duration > 1440:
                severity = '紧急'
            elif alarm_duration > 480:
                severity = '重要'
            else:
                severity = base_severity
            
            risks.append({
                'risk_id': f"R-{risk_id_counter:04d}",
                'risk_type': '报警未闭环',
                'severity': severity,
                'container_no': row['container_no'],
                'slot_id': row.get('slot_id'),
                'outlet_id': None,
                'risk_time': row['alarm_time'],
                'description': f"报警未处理: {row['alarm_type']} - {row.get('alarm_desc', '')} [状态: {row['status']}]",
                'duration_minutes': round(alarm_duration, 1),
                'related_records': [row['record_id']],
            })
            risk_id_counter += 1
        
        return risks
    
    def _calculate_severity(self, minutes: float) -> str:
        if minutes > 240:
            return '紧急'
        elif minutes > 120:
            return '重要'
        elif minutes > Settings.POWER_OUTAGE_THRESHOLD_MINUTES:
            return '一般'
        else:
            return '提示'
    
    def _get_latest_time(self) -> datetime:
        all_times = []
        
        for df in self.normalized_data.values():
            for col in df.columns:
                if 'time' in col.lower() or 'date' in col.lower():
                    valid_times = df[col].dropna()
                    if len(valid_times) > 0:
                        all_times.append(valid_times.max())
        
        if all_times:
            return max(all_times)
        return datetime.now(pytz.timezone(Settings.TIMEZONE))
    
    def _build_risk_summary(self) -> None:
        if self.risks.empty:
            self.risk_summary = {
                'total_risks': 0,
                'by_type': {},
                'by_severity': {
                    '紧急': 0,
                    '重要': 0,
                    '一般': 0,
                    '提示': 0,
                }
            }
            return
        
        self.risk_summary = {
            'total_risks': len(self.risks),
            'by_type': self.risks.groupby('risk_type').size().to_dict(),
            'by_severity': {
                '紧急': len(self.risks[self.risks['severity'] == '紧急']),
                '重要': len(self.risks[self.risks['severity'] == '重要']),
                '一般': len(self.risks[self.risks['severity'] == '一般']),
                '提示': len(self.risks[self.risks['severity'] == '提示']),
            }
        }
    
    def get_risks_by_type(self, risk_type: str) -> pd.DataFrame:
        if self.risks.empty:
            return pd.DataFrame()
        return self.risks[self.risks['risk_type'] == risk_type].reset_index(drop=True)
    
    def get_risks_by_severity(self, severity: str) -> pd.DataFrame:
        if self.risks.empty:
            return pd.DataFrame()
        return self.risks[self.risks['severity'] == severity].reset_index(drop=True)
    
    def get_risks_by_container(self, container_no: str) -> pd.DataFrame:
        if self.risks.empty:
            return pd.DataFrame()
        return self.risks[self.risks['container_no'].str.contains(container_no, na=False)].reset_index(drop=True)
    
    def get_risk_summary(self) -> Dict:
        return self.risk_summary.copy()
