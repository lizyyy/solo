import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime
import json

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.helpers import parse_datetime, normalize_slot_id


class DataParser:
    def __init__(self):
        self.raw_data: Dict[str, pd.DataFrame] = {}
    
    def parse_power_records(self, file_path: str) -> pd.DataFrame:
        df = pd.read_csv(file_path, encoding='utf-8')
        df.columns = [col.strip() for col in df.columns]
        
        column_mapping = {
            '箱号': 'container_no',
            '集装箱号': 'container_no',
            'CONTAINER_NO': 'container_no',
            '插电时间': 'plug_in_time',
            '断电时间': 'unplug_time',
            '插座编号': 'outlet_id',
            'OUTLET_ID': 'outlet_id',
            '堆位': 'slot_id',
            'SLOT': 'slot_id',
            '区块': 'block',
            'BLOCK': 'block',
            '行': 'row',
            'ROW': 'row',
            '贝': 'bay',
            'BAY': 'bay',
            '层': 'tier',
            'TIER': 'tier',
            '操作员': 'operator',
            'OPERATOR': 'operator',
        }
        
        df = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})
        
        required_cols = ['container_no', 'plug_in_time']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"缺少必要列: {missing}")
        
        df['plug_in_time'] = df['plug_in_time'].apply(parse_datetime)
        if 'unplug_time' in df.columns:
            df['unplug_time'] = df['unplug_time'].apply(parse_datetime)
        
        if 'slot_id' not in df.columns and all(c in df.columns for c in ['block', 'row', 'bay', 'tier']):
            df['slot_id'] = df.apply(
                lambda x: normalize_slot_id(x['block'], x['row'], x['bay'], x['tier']),
                axis=1
            )
        
        df['source_type'] = 'power_record'
        df['record_id'] = df.index.astype(str).apply(lambda x: f"PR-{x.zfill(6)}")
        
        self.raw_data['power_records'] = df
        return df
    
    def parse_movement_logs(self, file_path: str) -> pd.DataFrame:
        df = pd.read_csv(file_path, encoding='utf-8')
        df.columns = [col.strip() for col in df.columns]
        
        column_mapping = {
            '箱号': 'container_no',
            '集装箱号': 'container_no',
            'CONTAINER_NO': 'container_no',
            '移动时间': 'move_time',
            'MOVE_TIME': 'move_time',
            '操作类型': 'move_type',
            'MOVE_TYPE': 'move_type',
            '来源堆位': 'from_slot',
            'FROM_SLOT': 'from_slot',
            '目标堆位': 'to_slot',
            'TO_SLOT': 'to_slot',
            '来源区块': 'from_block',
            'FROM_BLOCK': 'from_block',
            '来源行': 'from_row',
            'FROM_ROW': 'from_row',
            '来源贝': 'from_bay',
            'FROM_BAY': 'from_bay',
            '来源层': 'from_tier',
            'FROM_TIER': 'from_tier',
            '目标区块': 'to_block',
            'TO_BLOCK': 'to_block',
            '目标行': 'to_row',
            'TO_ROW': 'to_row',
            '目标贝': 'to_bay',
            'TO_BAY': 'to_bay',
            '目标层': 'to_tier',
            'TO_TIER': 'to_tier',
            '设备号': 'equipment_id',
            'EQUIPMENT_ID': 'equipment_id',
            '操作员': 'operator',
            'OPERATOR': 'operator',
        }
        
        df = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})
        
        required_cols = ['container_no', 'move_time']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"缺少必要列: {missing}")
        
        df['move_time'] = df['move_time'].apply(parse_datetime)
        
        if 'from_slot' not in df.columns and all(c in df.columns for c in ['from_block', 'from_row', 'from_bay', 'from_tier']):
            df['from_slot'] = df.apply(
                lambda x: normalize_slot_id(x['from_block'], x['from_row'], x['from_bay'], x['from_tier']),
                axis=1
            )
        
        if 'to_slot' not in df.columns and all(c in df.columns for c in ['to_block', 'to_row', 'to_bay', 'to_tier']):
            df['to_slot'] = df.apply(
                lambda x: normalize_slot_id(x['to_block'], x['to_row'], x['to_bay'], x['to_tier']),
                axis=1
            )
        
        df['source_type'] = 'movement_log'
        df['record_id'] = df.index.astype(str).apply(lambda x: f"ML-{x.zfill(6)}")
        
        self.raw_data['movement_logs'] = df
        return df
    
    def parse_gate_records(self, file_path: str) -> pd.DataFrame:
        df = pd.read_csv(file_path, encoding='utf-8')
        df.columns = [col.strip() for col in df.columns]
        
        column_mapping = {
            '箱号': 'container_no',
            '集装箱号': 'container_no',
            'CONTAINER_NO': 'container_no',
            '进闸时间': 'gate_in_time',
            'GATE_IN_TIME': 'gate_in_time',
            '出闸时间': 'gate_out_time',
            'GATE_OUT_TIME': 'gate_out_time',
            '运输方式': 'transport_mode',
            'TRANSPORT_MODE': 'transport_mode',
            '车牌号': 'vehicle_no',
            'VEHICLE_NO': 'vehicle_no',
            '提单号': 'bl_no',
            'BL_NO': 'bl_no',
        }
        
        df = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})
        
        required_cols = ['container_no']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"缺少必要列: {missing}")
        
        if 'gate_in_time' in df.columns:
            df['gate_in_time'] = df['gate_in_time'].apply(parse_datetime)
        if 'gate_out_time' in df.columns:
            df['gate_out_time'] = df['gate_out_time'].apply(parse_datetime)
        
        df['source_type'] = 'gate_record'
        df['record_id'] = df.index.astype(str).apply(lambda x: f"GR-{x.zfill(6)}")
        
        self.raw_data['gate_records'] = df
        return df
    
    def parse_alarm_events(self, file_path: str) -> pd.DataFrame:
        df = pd.read_csv(file_path, encoding='utf-8')
        df.columns = [col.strip() for col in df.columns]
        
        column_mapping = {
            '箱号': 'container_no',
            '集装箱号': 'container_no',
            'CONTAINER_NO': 'container_no',
            '报警时间': 'alarm_time',
            'ALARM_TIME': 'alarm_time',
            '报警类型': 'alarm_type',
            'ALARM_TYPE': 'alarm_type',
            '报警级别': 'alarm_level',
            'ALARM_LEVEL': 'alarm_level',
            '报警描述': 'alarm_desc',
            'ALARM_DESC': 'alarm_desc',
            '堆位': 'slot_id',
            'SLOT': 'slot_id',
            '处理状态': 'status',
            'STATUS': 'status',
            '处理时间': 'resolve_time',
            'RESOLVE_TIME': 'resolve_time',
            '处理人': 'resolved_by',
            'RESOLVED_BY': 'resolved_by',
        }
        
        df = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})
        
        required_cols = ['container_no', 'alarm_time', 'alarm_type']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"缺少必要列: {missing}")
        
        df['alarm_time'] = df['alarm_time'].apply(parse_datetime)
        if 'resolve_time' in df.columns:
            df['resolve_time'] = df['resolve_time'].apply(parse_datetime)
        
        if 'status' not in df.columns:
            df['status'] = '未处理'
        
        df['source_type'] = 'alarm_event'
        df['record_id'] = df.index.astype(str).apply(lambda x: f"AE-{x.zfill(6)}")
        
        self.raw_data['alarm_events'] = df
        return df
    
    def get_all_data(self) -> Dict[str, pd.DataFrame]:
        return self.raw_data.copy()
    
    def get_container_list(self) -> List[str]:
        containers = set()
        for df in self.raw_data.values():
            if 'container_no' in df.columns:
                containers.update(df['container_no'].dropna().unique())
        return sorted(list(containers))
    
    def parse_file(self, file_path: str, file_type: str) -> pd.DataFrame:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        parsers = {
            'power': self.parse_power_records,
            'power_records': self.parse_power_records,
            'movement': self.parse_movement_logs,
            'movement_logs': self.parse_movement_logs,
            'gate': self.parse_gate_records,
            'gate_records': self.parse_gate_records,
            'alarm': self.parse_alarm_events,
            'alarm_events': self.parse_alarm_events,
        }
        
        if file_type not in parsers:
            raise ValueError(f"不支持的文件类型: {file_type}")
        
        return parsers[file_type](file_path)
