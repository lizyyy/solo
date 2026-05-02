import re
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class TranscriptRecord:
    call_id: str
    timestamp: Optional[datetime] = None
    caller_id: Optional[str] = None
    volunteer_id: Optional[str] = None
    content: str = ""
    duration_seconds: Optional[int] = None
    raw_text: str = ""


@dataclass
class RiskTagRecord:
    call_id: str
    tag_id: Optional[str] = None
    risk_level: str = "低风险"
    tags: List[str] = field(default_factory=list)
    confidence: float = 1.0
    notes: str = ""
    tagged_by: Optional[str] = None
    tagged_at: Optional[datetime] = None


@dataclass
class CallbackRecord:
    call_id: str
    callback_id: Optional[str] = None
    caller_name: Optional[str] = None
    callback_time: Optional[datetime] = None
    assigned_volunteer: Optional[str] = None
    priority: str = "正常"
    status: str = "待回访"
    notes: str = ""


class DataParser:
    def __init__(self):
        self.transcripts: Dict[str, TranscriptRecord] = {}
        self.risk_tags: Dict[str, RiskTagRecord] = {}
        self.callbacks: Dict[str, CallbackRecord] = {}
        
    def parse_transcript(self, file_path: Union[str, Path]) -> TranscriptRecord:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"转写文件不存在: {file_path}")
            
        with open(file_path, 'r', encoding='utf-8') as f:
            raw_text = f.read()
            
        call_id = self._extract_call_id(raw_text, file_path.stem)
        timestamp = self._extract_timestamp(raw_text)
        caller_id = self._extract_caller_id(raw_text)
        volunteer_id = self._extract_volunteer_id(raw_text)
        content = self._extract_content(raw_text)
        duration = self._extract_duration(raw_text)
        
        record = TranscriptRecord(
            call_id=call_id,
            timestamp=timestamp,
            caller_id=caller_id,
            volunteer_id=volunteer_id,
            content=content,
            duration_seconds=duration,
            raw_text=raw_text
        )
        
        self.transcripts[call_id] = record
        return record
    
    def parse_risk_tags(self, file_path: Union[str, Path]) -> List[RiskTagRecord]:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"风险标签文件不存在: {file_path}")
            
        df = pd.read_csv(file_path, encoding='utf-8')
        records = []
        
        for _, row in df.iterrows():
            call_id = str(row.get('call_id', row.get('通话ID', ''))).strip()
            if not call_id:
                continue
                
            risk_level = str(row.get('risk_level', row.get('风险等级', '低风险'))).strip()
            tags_str = str(row.get('tags', row.get('标签', ''))).strip()
            tags = [t.strip() for t in tags_str.split(',') if t.strip()] if tags_str else []
            
            confidence = float(row.get('confidence', row.get('置信度', 1.0)))
            notes = str(row.get('notes', row.get('备注', ''))).strip()
            tagged_by = str(row.get('tagged_by', row.get('标注人', ''))).strip() or None
            
            tagged_at = None
            tagged_at_str = str(row.get('tagged_at', row.get('标注时间', ''))).strip()
            if tagged_at_str:
                tagged_at = self._parse_datetime(tagged_at_str)
            
            record = RiskTagRecord(
                call_id=call_id,
                tag_id=str(row.get('tag_id', row.get('标签ID', ''))).strip() or None,
                risk_level=risk_level,
                tags=tags,
                confidence=confidence,
                notes=notes,
                tagged_by=tagged_by,
                tagged_at=tagged_at
            )
            
            self.risk_tags[call_id] = record
            records.append(record)
            
        return records
    
    def parse_callback_schedule(self, file_path: Union[str, Path]) -> List[CallbackRecord]:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"回访安排表不存在: {file_path}")
            
        df = pd.read_csv(file_path, encoding='utf-8')
        records = []
        
        for _, row in df.iterrows():
            call_id = str(row.get('call_id', row.get('通话ID', ''))).strip()
            if not call_id:
                continue
                
            callback_time = None
            callback_time_str = str(row.get('callback_time', row.get('回访时间', ''))).strip()
            if callback_time_str:
                callback_time = self._parse_datetime(callback_time_str)
            
            priority = str(row.get('priority', row.get('优先级', '正常'))).strip()
            status = str(row.get('status', row.get('状态', '待回访'))).strip()
            
            record = CallbackRecord(
                call_id=call_id,
                callback_id=str(row.get('callback_id', row.get('回访ID', ''))).strip() or None,
                caller_name=str(row.get('caller_name', row.get('来电人姓名', ''))).strip() or None,
                callback_time=callback_time,
                assigned_volunteer=str(row.get('assigned_volunteer', row.get('分配志愿者', ''))).strip() or None,
                priority=priority,
                status=status,
                notes=str(row.get('notes', row.get('备注', ''))).strip()
            )
            
            self.callbacks[call_id] = record
            records.append(record)
            
        return records
    
    def _extract_call_id(self, text: str, default: str) -> str:
        patterns = [
            r'(?:通话ID|Call\s*ID|call_id)[:：\s]+([A-Za-z0-9_\-]+)',
            r'^([A-Za-z0-9_\-]{8,})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return default
    
    def _extract_timestamp(self, text: str) -> Optional[datetime]:
        patterns = [
            r'(?:时间|Time|Timestamp)[:：\s]+(.+?)(?:\n|$)',
            r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日\s]*\d{1,2}[:：时]\d{2}[:：分]?\d{0,2})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.MULTILINE)
            if match:
                return self._parse_datetime(match.group(1).strip())
        
        return None
    
    def _extract_caller_id(self, text: str) -> Optional[str]:
        patterns = [
            r'(?:来电人ID|来电人|Caller|caller_id)[:：\s]+(.+?)(?:\n|$)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None
    
    def _extract_volunteer_id(self, text: str) -> Optional[str]:
        patterns = [
            r'(?:志愿者ID|志愿者|Volunteer|volunteer_id)[:：\s]+(.+?)(?:\n|$)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None
    
    def _extract_duration(self, text: str) -> Optional[int]:
        patterns = [
            r'(?:时长|Duration)[:：\s]+(\d+)\s*(?:秒|s|sec)',
            r'(?:时长|Duration)[:：\s]+(\d+):(\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
            if match:
                if len(match.groups()) == 2:
                    minutes = int(match.group(1))
                    seconds = int(match.group(2))
                    return minutes * 60 + seconds
                else:
                    return int(match.group(1))
        
        return None
    
    def _extract_content(self, text: str) -> str:
        lines = text.split('\n')
        content_lines = []
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            
            if re.match(r'^(通话ID|时间|来电人|志愿者|时长|Call\s*ID|Time|Caller|Volunteer|Duration)[:：]', 
                       stripped, re.IGNORECASE):
                continue
            
            if re.match(r'^-+$', stripped):
                continue
            
            content_lines.append(stripped)
        
        return '\n'.join(content_lines)
    
    def _parse_datetime(self, text: str) -> Optional[datetime]:
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%Y年%m月%d日 %H:%M:%S',
            '%Y年%m月%d日 %H:%M',
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%Y年%m月%d日',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(text.strip(), fmt)
            except (ValueError, TypeError):
                continue
        
        return None
    
    def get_call_ids(self) -> List[str]:
        all_call_ids = set()
        all_call_ids.update(self.transcripts.keys())
        all_call_ids.update(self.risk_tags.keys())
        all_call_ids.update(self.callbacks.keys())
        return sorted(all_call_ids)
    
    def get_call_data(self, call_id: str) -> Dict:
        return {
            'call_id': call_id,
            'transcript': self.transcripts.get(call_id),
            'risk_tag': self.risk_tags.get(call_id),
            'callback': self.callbacks.get(call_id)
        }
