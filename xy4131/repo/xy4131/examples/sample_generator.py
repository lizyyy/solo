import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List
from datetime import datetime, timedelta
import random
import string
import pytz

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import Settings
from utils.helpers import normalize_slot_id


class SampleDataGenerator:
    def __init__(self):
        Settings.ensure_dirs()
        self.data_dir = Settings.DATA_DIR / "raw"
        self.tz = pytz.timezone(Settings.TIMEZONE)
    
    def generate_container_number(self) -> str:
        prefix = ''.join(random.choices(string.ascii_uppercase, k=4))
        suffix = ''.join(random.choices(string.digits, k=6))
        check_digit = random.choice(string.digits)
        return f"{prefix}{suffix}{check_digit}"
    
    def generate_slot_id(self) -> str:
        block = random.choice(Settings.YARD_BLOCKS)
        row = random.randint(1, Settings.YARD_ROWS)
        bay = random.randint(1, Settings.YARD_BAYS)
        tier = random.randint(1, Settings.YARD_TIERS)
        return normalize_slot_id(block, row, bay, tier)
    
    def generate_outlet_id(self, slot_id: str) -> str:
        return f"OUT-{slot_id}-{random.randint(1, 2)}"
    
    def generate_all(self, start_date: datetime = None, 
                     container_count: int = 20,
                     include_risks: bool = True) -> Dict[str, pd.DataFrame]:
        if start_date is None:
            start_date = datetime.now(self.tz) - timedelta(days=3)
        
        containers = [self.generate_container_number() for _ in range(container_count)]
        
        power_records = self._generate_power_records(containers, start_date, include_risks)
        movement_logs = self._generate_movement_logs(containers, start_date, include_risks)
        gate_records = self._generate_gate_records(containers, start_date)
        alarm_events = self._generate_alarm_events(containers, start_date, include_risks)
        
        return {
            'power_records': power_records,
            'movement_logs': movement_logs,
            'gate_records': gate_records,
            'alarm_events': alarm_events
        }
    
    def _generate_power_records(self, containers: List[str], 
                                start_date: datetime,
                                include_risks: bool) -> pd.DataFrame:
        records = []
        record_id = 0
        
        for container in containers:
            num_records = random.randint(1, 3)
            current_time = start_date + timedelta(hours=random.randint(0, 24))
            
            for i in range(num_records):
                slot_id = self.generate_slot_id()
                outlet_id = self.generate_outlet_id(slot_id)
                
                plug_in_time = current_time
                
                if i == num_records - 1 and random.random() > 0.3:
                    unplug_time = None
                else:
                    duration_hours = random.randint(6, 72)
                    unplug_time = plug_in_time + timedelta(hours=duration_hours)
                    
                    if include_risks and random.random() < 0.2:
                        outage_gap = timedelta(minutes=random.randint(45, 180))
                        current_time = unplug_time + outage_gap
                    else:
                        current_time = unplug_time + timedelta(minutes=random.randint(5, 20))
                
                records.append({
                    '箱号': container,
                    '插电时间': plug_in_time.strftime("%Y-%m-%d %H:%M:%S"),
                    '断电时间': unplug_time.strftime("%Y-%m-%d %H:%M:%S") if unplug_time else "",
                    '插座编号': outlet_id,
                    '堆位': slot_id,
                    '操作员': f"OP{random.randint(1001, 1020)}",
                })
                record_id += 1
        
        return pd.DataFrame(records)
    
    def _generate_movement_logs(self, containers: List[str],
                                start_date: datetime,
                                include_risks: bool) -> pd.DataFrame:
        records = []
        record_id = 0
        
        for container in containers:
            num_moves = random.randint(1, 4)
            current_time = start_date + timedelta(hours=random.randint(0, 12))
            current_slot = None
            
            for i in range(num_moves):
                if i == 0:
                    move_type = '进闸'
                    from_slot = "闸口"
                    to_slot = self.generate_slot_id()
                elif i == num_moves - 1 and random.random() < 0.2:
                    move_type = '出闸'
                    from_slot = current_slot or self.generate_slot_id()
                    to_slot = "闸口"
                else:
                    move_type = '移箱'
                    from_slot = current_slot or self.generate_slot_id()
                    to_slot = self.generate_slot_id()
                    while to_slot == from_slot:
                        to_slot = self.generate_slot_id()
                
                records.append({
                    '箱号': container,
                    '移动时间': current_time.strftime("%Y-%m-%d %H:%M:%S"),
                    '操作类型': move_type,
                    '来源堆位': from_slot,
                    '目标堆位': to_slot,
                    '设备号': f"RTG{random.randint(1, 8)}",
                    '操作员': f"OP{random.randint(1001, 1020)}",
                })
                record_id += 1
                
                current_slot = to_slot
                current_time += timedelta(hours=random.randint(2, 24))
        
        return pd.DataFrame(records)
    
    def _generate_gate_records(self, containers: List[str],
                               start_date: datetime) -> pd.DataFrame:
        records = []
        record_id = 0
        
        for container in containers:
            gate_in_time = start_date + timedelta(hours=random.randint(0, 48))
            
            if random.random() < 0.3:
                gate_out_time = gate_in_time + timedelta(hours=random.randint(24, 168))
            else:
                gate_out_time = None
            
            records.append({
                '箱号': container,
                '进闸时间': gate_in_time.strftime("%Y-%m-%d %H:%M:%S"),
                '出闸时间': gate_out_time.strftime("%Y-%m-%d %H:%M:%S") if gate_out_time else "",
                '运输方式': random.choice(['集卡', '铁路', '水路']),
                '车牌号': f"沪A{random.randint(10000, 99999)}" if random.random() > 0.5 else "",
                '提单号': f"BL{''.join(random.choices(string.digits, k=8))}",
            })
            record_id += 1
        
        return pd.DataFrame(records)
    
    def _generate_alarm_events(self, containers: List[str],
                               start_date: datetime,
                               include_risks: bool) -> pd.DataFrame:
        records = []
        record_id = 0
        
        if not include_risks:
            return pd.DataFrame(records)
        
        alarm_types = [
            ('温度异常', '紧急'),
            ('断电报警', '紧急'),
            ('电压异常', '重要'),
            ('电流异常', '重要'),
            ('通讯中断', '一般'),
            ('传感器故障', '一般'),
            ('门状态异常', '提示'),
        ]
        
        num_alarms = random.randint(3, 10)
        selected_containers = random.sample(containers, min(num_alarms, len(containers)))
        
        for container in selected_containers:
            alarm_type, alarm_level = random.choice(alarm_types)
            alarm_time = start_date + timedelta(hours=random.randint(6, 72))
            
            is_resolved = random.random() > 0.4
            if is_resolved:
                resolve_time = alarm_time + timedelta(minutes=random.randint(15, 120))
                status = '已闭环'
            else:
                resolve_time = None
                status = '未处理'
            
            records.append({
                '箱号': container,
                '报警时间': alarm_time.strftime("%Y-%m-%d %H:%M:%S"),
                '报警类型': alarm_type,
                '报警级别': alarm_level,
                '报警描述': f"检测到{alarm_type}，请及时处理",
                '堆位': self.generate_slot_id(),
                '处理状态': status,
                '处理时间': resolve_time.strftime("%Y-%m-%d %H:%M:%S") if resolve_time else "",
                '处理人': f"TECH{random.randint(1, 10)}" if is_resolved else "",
            })
            record_id += 1
        
        return pd.DataFrame(records)
    
    def save_to_csv(self, data: Dict[str, pd.DataFrame], 
                    output_dir: str = None) -> Dict[str, str]:
        if output_dir is None:
            output_dir = self.data_dir
        else:
            output_dir = Path(output_dir)
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        saved_files = {}
        
        if 'power_records' in data and not data['power_records'].empty:
            filepath = output_dir / "冷藏箱插电记录.csv"
            data['power_records'].to_csv(filepath, index=False, encoding='utf-8-sig')
            saved_files['power_records'] = str(filepath)
        
        if 'movement_logs' in data and not data['movement_logs'].empty:
            filepath = output_dir / "堆位移动日志.csv"
            data['movement_logs'].to_csv(filepath, index=False, encoding='utf-8-sig')
            saved_files['movement_logs'] = str(filepath)
        
        if 'gate_records' in data and not data['gate_records'].empty:
            filepath = output_dir / "闸口进出记录.csv"
            data['gate_records'].to_csv(filepath, index=False, encoding='utf-8-sig')
            saved_files['gate_records'] = str(filepath)
        
        if 'alarm_events' in data and not data['alarm_events'].empty:
            filepath = output_dir / "报警事件.csv"
            data['alarm_events'].to_csv(filepath, index=False, encoding='utf-8-sig')
            saved_files['alarm_events'] = str(filepath)
        
        return saved_files
    
    def generate_and_save(self, start_date: datetime = None,
                          container_count: int = 20,
                          include_risks: bool = True,
                          output_dir: str = None) -> Dict[str, str]:
        data = self.generate_all(start_date, container_count, include_risks)
        return self.save_to_csv(data, output_dir)
