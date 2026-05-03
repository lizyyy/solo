import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import namedtuple


SamplingPoint = namedtuple('SamplingPoint', ['timestamp', 'values', 'valid'])


def parse_sampling_jsonl(file_path: str) -> Dict[str, Any]:
    """
    解析录波采样JSONL文件
    
    JSONL格式示例:
    {"timestamp": "2024-01-15T10:23:44.000Z", "channels": {"Ia": 1.2, "Ib": 1.1, "Ic": 1.3, "Ua": 220.5}}
    {"timestamp": "2024-01-15T10:23:44.001Z", "channels": {"Ia": 1.5, "Ib": 1.4, "Ic": 1.6, "Ua": 219.8}}
    """
    samples = []
    channels = set()
    metadata = {
        'sample_count': 0,
        'start_time': None,
        'end_time': None,
        'channels': [],
        'gaps': [],
    }
    
    last_timestamp: Optional[datetime] = None
    expected_interval: Optional[float] = None
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            
            try:
                record = json.loads(line)
                
                timestamp = parse_iso_datetime(record.get('timestamp', record.get('time', '')))
                
                channels_data = record.get('channels', record.get('values', {}))
                for ch in channels_data.keys():
                    channels.add(ch)
                
                point = SamplingPoint(
                    timestamp=timestamp,
                    values=channels_data,
                    valid=True
                )
                samples.append(point)
                
                if last_timestamp is not None:
                    interval = (timestamp - last_timestamp).total_seconds() * 1000
                    
                    if expected_interval is None:
                        expected_interval = interval
                    else:
                        if abs(interval - expected_interval) > expected_interval * 0.5:
                            metadata['gaps'].append({
                                'line_num': line_num,
                                'start_time': last_timestamp,
                                'end_time': timestamp,
                                'gap_ms': interval,
                                'expected_ms': expected_interval,
                            })
                
                last_timestamp = timestamp
                
                if metadata['start_time'] is None or timestamp < metadata['start_time']:
                    metadata['start_time'] = timestamp
                if metadata['end_time'] is None or timestamp > metadata['end_time']:
                    metadata['end_time'] = timestamp
                
            except Exception as e:
                print(f"警告: 解析第 {line_num} 行时出错: {e}")
                continue
    
    metadata['sample_count'] = len(samples)
    metadata['channels'] = sorted(list(channels))
    
    samples.sort(key=lambda p: p.timestamp)
    
    return {
        'metadata': metadata,
        'samples': samples,
    }


def parse_iso_datetime(time_str: str) -> datetime:
    """解析ISO格式时间字符串"""
    time_str = time_str.strip()
    
    if time_str.endswith('Z'):
        time_str = time_str[:-1] + '+00:00'
    
    for fmt in [
        '%Y-%m-%dT%H:%M:%S.%f%z',
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%d %H:%M:%S.%f',
        '%Y-%m-%d %H:%M:%S',
    ]:
        try:
            dt = datetime.strptime(time_str, fmt)
            return dt
        except ValueError:
            continue
    
    raise ValueError(f"无法解析ISO时间格式: {time_str}")


def get_channel_samples(sampling_data: Dict[str, Any], channel_name: str) -> List[Dict[str, Any]]:
    """
    获取特定通道的采样数据列表
    """
    samples = sampling_data.get('samples', [])
    result = []
    
    for point in samples:
        if channel_name in point.values:
            result.append({
                'timestamp': point.timestamp,
                'value': point.values[channel_name],
            })
    
    return result
