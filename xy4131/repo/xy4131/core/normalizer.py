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


class DataNormalizer:
    def __init__(self, raw_data: Dict[str, pd.DataFrame]):
        self.raw_data = raw_data
        self.normalized_data: Dict[str, pd.DataFrame] = {}
        self.timeline_events: pd.DataFrame = pd.DataFrame()
        self.container_states: Dict[str, pd.DataFrame] = {}
        self.yard_inventory: pd.DataFrame = pd.DataFrame()
    
    def normalize_all(self) -> Dict[str, pd.DataFrame]:
        if 'power_records' in self.raw_data:
            self.normalized_data['power_records'] = self._normalize_power_records(
                self.raw_data['power_records']
            )
        
        if 'movement_logs' in self.raw_data:
            self.normalized_data['movement_logs'] = self._normalize_movement_logs(
                self.raw_data['movement_logs']
            )
        
        if 'gate_records' in self.raw_data:
            self.normalized_data['gate_records'] = self._normalize_gate_records(
                self.raw_data['gate_records']
            )
        
        if 'alarm_events' in self.raw_data:
            self.normalized_data['alarm_events'] = self._normalize_alarm_events(
                self.raw_data['alarm_events']
            )
        
        self._build_timeline()
        self._build_container_states()
        self._build_yard_inventory()
        
        return self.normalized_data
    
    def _normalize_power_records(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        
        if 'slot_id' not in df.columns:
            df['slot_id'] = np.nan
        
        if 'outlet_id' not in df.columns:
            df['outlet_id'] = df['slot_id']
        
        df['duration_hours'] = np.nan
        mask_valid = df['unplug_time'].notna() & df['plug_in_time'].notna()
        df.loc[mask_valid, 'duration_hours'] = (
            df.loc[mask_valid, 'unplug_time'] - df.loc[mask_valid, 'plug_in_time']
        ).dt.total_seconds() / 3600
        
        df['is_active'] = df['unplug_time'].isna()
        
        return df
    
    def _normalize_movement_logs(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        
        if 'move_type' not in df.columns:
            df['move_type'] = '移箱'
        
        move_type_mapping = {
            'RECEPTION': '进闸',
            'DELIVERY': '出闸',
            'SHIFT': '移箱',
            'STOW': '堆存',
            'PICKUP': '提箱',
            '进闸': '进闸',
            '出闸': '出闸',
            '移箱': '移箱',
        }
        df['move_type'] = df['move_type'].apply(
            lambda x: move_type_mapping.get(str(x).upper(), str(x))
        )
        
        df['is_gate_movement'] = df['move_type'].isin(['进闸', '出闸'])
        
        return df
    
    def _normalize_gate_records(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        
        df['stay_duration_hours'] = np.nan
        mask_valid = df['gate_out_time'].notna() & df['gate_in_time'].notna()
        df.loc[mask_valid, 'stay_duration_hours'] = (
            df.loc[mask_valid, 'gate_out_time'] - df.loc[mask_valid, 'gate_in_time']
        ).dt.total_seconds() / 3600
        
        df['is_in_yard'] = df['gate_out_time'].isna()
        
        return df
    
    def _normalize_alarm_events(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        
        if 'alarm_level' not in df.columns:
            df['alarm_level'] = '一般'
        
        alarm_level_mapping = {
            'CRITICAL': '紧急',
            'HIGH': '重要',
            'MEDIUM': '一般',
            'LOW': '提示',
            '紧急': '紧急',
            '重要': '重要',
            '一般': '一般',
            '提示': '提示',
        }
        df['alarm_level'] = df['alarm_level'].apply(
            lambda x: alarm_level_mapping.get(str(x).upper(), '一般')
        )
        
        if 'status' not in df.columns:
            df['status'] = '未处理'
        
        status_mapping = {
            'OPEN': '未处理',
            'IN_PROGRESS': '处理中',
            'RESOLVED': '已闭环',
            'CLOSED': '已关闭',
            '未处理': '未处理',
            '处理中': '处理中',
            '已闭环': '已闭环',
            '已关闭': '已关闭',
        }
        df['status'] = df['status'].apply(
            lambda x: status_mapping.get(str(x).upper(), '未处理')
        )
        
        df['is_resolved'] = df['status'].isin(['已闭环', '已关闭'])
        
        df['resolution_duration_hours'] = np.nan
        mask_valid = df['resolve_time'].notna() & df['alarm_time'].notna()
        df.loc[mask_valid, 'resolution_duration_hours'] = (
            df.loc[mask_valid, 'resolve_time'] - df.loc[mask_valid, 'alarm_time']
        ).dt.total_seconds() / 3600
        
        return df
    
    def _build_timeline(self) -> None:
        events = []
        
        if 'power_records' in self.normalized_data:
            df = self.normalized_data['power_records']
            for _, row in df.iterrows():
                events.append({
                    'event_time': row['plug_in_time'],
                    'event_type': '插电',
                    'container_no': row['container_no'],
                    'slot_id': row.get('slot_id', np.nan),
                    'outlet_id': row.get('outlet_id', np.nan),
                    'details': f"插电时间: {format_datetime(row['plug_in_time'])}",
                    'record_id': row['record_id'],
                })
                if pd.notna(row.get('unplug_time')):
                    events.append({
                        'event_time': row['unplug_time'],
                        'event_type': '断电',
                        'container_no': row['container_no'],
                        'slot_id': row.get('slot_id', np.nan),
                        'outlet_id': row.get('outlet_id', np.nan),
                        'details': f"断电时间: {format_datetime(row['unplug_time'])}, 通电时长: {row.get('duration_hours', 0):.2f}小时",
                        'record_id': row['record_id'],
                    })
        
        if 'movement_logs' in self.normalized_data:
            df = self.normalized_data['movement_logs']
            for _, row in df.iterrows():
                events.append({
                    'event_time': row['move_time'],
                    'event_type': row['move_type'],
                    'container_no': row['container_no'],
                    'slot_id': row.get('to_slot', np.nan),
                    'outlet_id': np.nan,
                    'details': f"从 {row.get('from_slot', '闸口')} 移至 {row.get('to_slot', '闸口')}",
                    'record_id': row['record_id'],
                })
        
        if 'alarm_events' in self.normalized_data:
            df = self.normalized_data['alarm_events']
            for _, row in df.iterrows():
                events.append({
                    'event_time': row['alarm_time'],
                    'event_type': f"报警-{row['alarm_level']}",
                    'container_no': row['container_no'],
                    'slot_id': row.get('slot_id', np.nan),
                    'outlet_id': np.nan,
                    'details': f"{row['alarm_type']}: {row.get('alarm_desc', '')} [状态: {row['status']}]",
                    'record_id': row['record_id'],
                })
        
        if events:
            self.timeline_events = pd.DataFrame(events)
            self.timeline_events = self.timeline_events.sort_values('event_time').reset_index(drop=True)
        else:
            self.timeline_events = pd.DataFrame(
                columns=['event_time', 'event_type', 'container_no', 'slot_id', 'outlet_id', 'details', 'record_id']
            )
    
    def _build_container_states(self) -> None:
        containers = set()
        
        for df in self.normalized_data.values():
            if 'container_no' in df.columns:
                containers.update(df['container_no'].dropna().unique())
        
        for container in sorted(containers):
            events = []
            
            if 'power_records' in self.normalized_data:
                pr = self.normalized_data['power_records']
                container_pr = pr[pr['container_no'] == container].copy()
                for _, row in container_pr.iterrows():
                    events.append({
                        'time': row['plug_in_time'],
                        'type': 'plug_in',
                        'slot_id': row.get('slot_id'),
                        'outlet_id': row.get('outlet_id'),
                        'details': row,
                    })
                    if pd.notna(row.get('unplug_time')):
                        events.append({
                            'time': row['unplug_time'],
                            'type': 'unplug',
                            'slot_id': row.get('slot_id'),
                            'outlet_id': row.get('outlet_id'),
                            'details': row,
                        })
            
            if 'movement_logs' in self.normalized_data:
                ml = self.normalized_data['movement_logs']
                container_ml = ml[ml['container_no'] == container].copy()
                for _, row in container_ml.iterrows():
                    events.append({
                        'time': row['move_time'],
                        'type': 'movement',
                        'slot_id': row.get('to_slot'),
                        'from_slot': row.get('from_slot'),
                        'move_type': row.get('move_type'),
                        'details': row,
                    })
            
            if 'alarm_events' in self.normalized_data:
                ae = self.normalized_data['alarm_events']
                container_ae = ae[ae['container_no'] == container].copy()
                for _, row in container_ae.iterrows():
                    events.append({
                        'time': row['alarm_time'],
                        'type': 'alarm',
                        'slot_id': row.get('slot_id'),
                        'alarm_type': row.get('alarm_type'),
                        'alarm_level': row.get('alarm_level'),
                        'status': row.get('status'),
                        'details': row,
                    })
            
            if events:
                events_df = pd.DataFrame(events)
                events_df = events_df.sort_values('time').reset_index(drop=True)
                self.container_states[container] = events_df
    
    def _build_yard_inventory(self) -> None:
        inventory_records = []
        
        latest_time = self._get_latest_time()
        
        if 'power_records' in self.normalized_data:
            pr = self.normalized_data['power_records']
            active_power = pr[pr['is_active'] == True].copy()
            for _, row in active_power.iterrows():
                inventory_records.append({
                    'container_no': row['container_no'],
                    'slot_id': row.get('slot_id'),
                    'outlet_id': row.get('outlet_id'),
                    'plug_in_time': row['plug_in_time'],
                    'is_powered': True,
                    'status': '通电中',
                    'last_update': latest_time,
                })
        
        if 'movement_logs' in self.normalized_data:
            ml = self.normalized_data['movement_logs']
            for container in ml['container_no'].unique():
                container_moves = ml[ml['container_no'] == container].sort_values('move_time')
                if len(container_moves) > 0:
                    last_move = container_moves.iloc[-1]
                    if last_move['move_type'] != '出闸':
                        existing = [r for r in inventory_records if r['container_no'] == container]
                        if not existing:
                            inventory_records.append({
                                'container_no': container,
                                'slot_id': last_move.get('to_slot'),
                                'outlet_id': None,
                                'plug_in_time': None,
                                'is_powered': False,
                                'status': '待通电',
                                'last_update': last_move['move_time'],
                            })
        
        if inventory_records:
            self.yard_inventory = pd.DataFrame(inventory_records)
        else:
            self.yard_inventory = pd.DataFrame(
                columns=['container_no', 'slot_id', 'outlet_id', 'plug_in_time', 
                         'is_powered', 'status', 'last_update']
            )
    
    def _get_latest_time(self) -> Optional[datetime]:
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
    
    def get_time_range(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        all_times = []
        
        for df in self.normalized_data.values():
            for col in df.columns:
                if 'time' in col.lower() or 'date' in col.lower():
                    valid_times = df[col].dropna()
                    if len(valid_times) > 0:
                        all_times.extend(valid_times.tolist())
        
        if not all_times:
            return (None, None)
        
        return (min(all_times), max(all_times))
    
    def get_container_timeline(self, container_no: str) -> pd.DataFrame:
        return self.container_states.get(container_no, pd.DataFrame())
    
    def get_all_normalized_data(self) -> Dict[str, pd.DataFrame]:
        return {
            **self.normalized_data,
            'timeline': self.timeline_events,
            'yard_inventory': self.yard_inventory,
        }
