import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
import re

@dataclass
class BatchTimeWindow:
    batch_number: str
    dish: str
    store: str
    delivery_car: str
    
    production_time: Optional[datetime] = None
    outbound_time: Optional[datetime] = None
    signoff_time: Optional[datetime] = None
    
    temperature_records: List[Dict[str, Any]] = field(default_factory=list)
    sample_records: List[Dict[str, Any]] = field(default_factory=list)
    
    freezer_ids: List[str] = field(default_factory=list)
    status: str = "unknown"

def parse_datetime(value: Any) -> Optional[datetime]:
    if pd.isna(value) or value is None:
        return None
    
    value_str = str(value).strip()
    if value_str == '':
        return None
    
    formats = [
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y/%m/%d %H:%M:%S',
        '%Y/%m/%d %H:%M',
        '%Y-%m-%d',
        '%Y/%m/%d',
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(value_str, fmt)
        except (ValueError, TypeError):
            continue
    
    return None

def merge_by_time_window(data: Dict[str, pd.DataFrame]) -> Dict[str, BatchTimeWindow]:
    batches_df = data.get('batches', pd.DataFrame())
    temperatures_df = data.get('temperatures', pd.DataFrame())
    handover_df = data.get('handover', pd.DataFrame())
    samples_df = data.get('samples', pd.DataFrame())
    
    merged_batches: Dict[str, BatchTimeWindow] = {}
    
    for _, row in batches_df.iterrows():
        batch_number = str(row.get('批次号', ''))
        if not batch_number or batch_number == 'nan':
            continue
        
        batch = BatchTimeWindow(
            batch_number=batch_number,
            dish=str(row.get('菜品', '')),
            store=str(row.get('门店', '')),
            delivery_car=str(row.get('配送车', ''))
        )
        
        batch.production_time = parse_datetime(row.get('生产时间'))
        batch.outbound_time = parse_datetime(row.get('出库时间'))
        batch.status = str(row.get('状态', 'unknown'))
        
        merged_batches[batch_number] = batch
    
    if not temperatures_df.empty:
        for _, row in temperatures_df.iterrows():
            batch_number = str(row.get('批次号', ''))
            if batch_number not in merged_batches:
                continue
            
            temp_record = {
                '冷柜编号': str(row.get('冷柜编号', '')),
                '温度读数时间': parse_datetime(row.get('温度读数时间')),
                '温度值': float(row.get('温度值', 0)) if pd.notna(row.get('温度值')) else None
            }
            
            merged_batches[batch_number].temperature_records.append(temp_record)
            
            freezer_id = str(row.get('冷柜编号', ''))
            if freezer_id and freezer_id not in merged_batches[batch_number].freezer_ids:
                merged_batches[batch_number].freezer_ids.append(freezer_id)
    
    if not handover_df.empty:
        for _, row in handover_df.iterrows():
            batch_number = str(row.get('批次号', ''))
            if batch_number not in merged_batches:
                continue
            
            signoff_time = parse_datetime(row.get('交接签收时间'))
            if signoff_time:
                merged_batches[batch_number].signoff_time = signoff_time
    
    if not samples_df.empty:
        for _, row in samples_df.iterrows():
            batch_number = str(row.get('批次号', ''))
            if batch_number not in merged_batches:
                continue
            
            sample_record = {
                '留样编号': str(row.get('留样编号', '')),
                '留样时间': parse_datetime(row.get('留样时间')),
                '抽检时间': parse_datetime(row.get('抽检时间')),
                '抽检结论': str(row.get('抽检结论', ''))
            }
            
            merged_batches[batch_number].sample_records.append(sample_record)
    
    for batch in merged_batches.values():
        batch.temperature_records.sort(key=lambda x: x['温度读数时间'] or datetime.min)
        batch.sample_records.sort(key=lambda x: x['留样时间'] or datetime.min)
    
    return merged_batches

def get_batch_time_range(batch: BatchTimeWindow) -> Dict[str, Any]:
    times = []
    
    if batch.production_time:
        times.append(batch.production_time)
    if batch.outbound_time:
        times.append(batch.outbound_time)
    if batch.signoff_time:
        times.append(batch.signoff_time)
    
    for temp in batch.temperature_records:
        if temp['温度读数时间']:
            times.append(temp['温度读数时间'])
    
    for sample in batch.sample_records:
        if sample['留样时间']:
            times.append(sample['留样时间'])
        if sample['抽检时间']:
            times.append(sample['抽检时间'])
    
    if not times:
        return {'start': None, 'end': None, 'duration_hours': 0}
    
    start_time = min(times)
    end_time = max(times)
    duration_hours = (end_time - start_time).total_seconds() / 3600
    
    return {
        'start': start_time,
        'end': end_time,
        'duration_hours': round(duration_hours, 2)
    }

def get_temperature_statistics(batch: BatchTimeWindow) -> Dict[str, Any]:
    if not batch.temperature_records:
        return {
            'count': 0,
            'min': None,
            'max': None,
            'avg': None,
            'over_threshold_count': 0,
            'under_threshold_count': 0
        }
    
    temperatures = []
    for rec in batch.temperature_records:
        if rec['温度值'] is not None:
            temperatures.append(rec['温度值'])
    
    if not temperatures:
        return {
            'count': 0,
            'min': None,
            'max': None,
            'avg': None,
            'over_threshold_count': 0,
            'under_threshold_count': 0
        }
    
    threshold_high = 4.0
    threshold_low = -18.0
    
    return {
        'count': len(temperatures),
        'min': round(min(temperatures), 2),
        'max': round(max(temperatures), 2),
        'avg': round(sum(temperatures) / len(temperatures), 2),
        'over_threshold_count': sum(1 for t in temperatures if t > threshold_high),
        'under_threshold_count': sum(1 for t in temperatures if t < threshold_low)
    }

def group_batches_by_store(merged_batches: Dict[str, BatchTimeWindow]) -> Dict[str, List[BatchTimeWindow]]:
    store_groups: Dict[str, List[BatchTimeWindow]] = {}
    
    for batch in merged_batches.values():
        store = batch.store or '未知门店'
        if store not in store_groups:
            store_groups[store] = []
        store_groups[store].append(batch)
    
    return store_groups

def group_batches_by_delivery_car(merged_batches: Dict[str, BatchTimeWindow]) -> Dict[str, List[BatchTimeWindow]]:
    car_groups: Dict[str, List[BatchTimeWindow]] = {}
    
    for batch in merged_batches.values():
        car = batch.delivery_car or '未知配送车'
        if car not in car_groups:
            car_groups[car] = []
        car_groups[car].append(batch)
    
    return car_groups
