"""JSON 环境音标注解析器"""
import json
from datetime import timedelta
from typing import List, Dict, Any
import os

from src.models.models import AudioAnnotation, parse_srt_time


class JSONParser:
    """JSON 文件解析器"""
    
    @classmethod
    def parse_audio_annotations(cls, file_path: str, encoding: str = 'utf-8') -> List[AudioAnnotation]:
        """解析环境音标注 JSON 文件"""
        with open(file_path, 'r', encoding=encoding) as f:
            data = json.load(f)
        
        annotations = []
        
        # 支持多种 JSON 结构
        entries = []
        if isinstance(data, list):
            entries = data
        elif isinstance(data, dict):
            # 尝试查找常见的键名
            for key in ['annotations', 'entries', 'items', 'sound_effects', 'audio', '声音标注']:
                if key in data and isinstance(data[key], list):
                    entries = data[key]
                    break
        
        for index, entry in enumerate(entries, start=1):
            if not isinstance(entry, dict):
                continue
            
            # 解析开始时间
            start_time = None
            for key in ['start_time', 'start', 'begin', '开始时间', '起始时间', 'timecode']:
                if key in entry:
                    try:
                        start_time = parse_srt_time(str(entry[key]))
                        break
                    except ValueError:
                        continue
            
            # 解析结束时间
            end_time = None
            for key in ['end_time', 'end', 'finish', '结束时间', 'duration']:
                if key in entry:
                    try:
                        if key == 'duration' and start_time:
                            # 持续时间
                            duration = float(entry[key])
                            end_time = start_time + timedelta(seconds=duration)
                        else:
                            end_time = parse_srt_time(str(entry[key]))
                        break
                    except ValueError:
                        continue
            
            if start_time is None:
                continue
            
            # 如果没有结束时间，默认设为开始时间后1秒
            if end_time is None:
                end_time = start_time + timedelta(seconds=1)
            
            # 解析声音类型
            sound_type = "effect"
            for key in ['type', 'sound_type', '类型', '声音类型', 'category']:
                if key in entry:
                    sound_type = str(entry[key]).strip().lower()
                    break
            
            # 解析描述
            description = ""
            for key in ['description', 'desc', '描述', '内容', 'name', '名称']:
                if key in entry:
                    description = str(entry[key]).strip()
                    break
            
            # 解析音量
            volume = "normal"
            for key in ['volume', '音量', 'loudness']:
                if key in entry:
                    volume = str(entry[key]).strip().lower()
                    break
            
            annotation = AudioAnnotation(
                index=index,
                start_time=start_time,
                end_time=end_time,
                sound_type=sound_type,
                description=description,
                volume=volume
            )
            annotations.append(annotation)
        
        # 按开始时间排序
        annotations.sort(key=lambda a: a.start_time)
        
        return annotations
    
    @classmethod
    def write_audio_annotations(cls, annotations: List[AudioAnnotation], file_path: str, encoding: str = 'utf-8'):
        """将环境音标注写入 JSON 文件"""
        data = []
        for ann in annotations:
            data.append({
                'index': ann.index,
                'start_time': str(ann.start_time),
                'end_time': str(ann.end_time),
                'sound_type': ann.sound_type,
                'description': ann.description,
                'volume': ann.volume
            })
        
        with open(file_path, 'w', encoding=encoding) as f:
            json.dump({'annotations': data}, f, ensure_ascii=False, indent=2)
