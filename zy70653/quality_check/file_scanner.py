import os
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import hashlib


@dataclass
class RecordingFile:
    file_path: str
    file_name: str
    file_size: int
    extension: str
    parsed_ticket_id: Optional[str] = None
    parsed_agent_id: Optional[str] = None
    duration_seconds: Optional[int] = None
    parse_status: str = "pending"
    parse_error: Optional[str] = None


class RecordingScanner:
    SUPPORTED_EXTENSIONS = {'.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.amr'}
    
    TICKET_ID_PATTERNS = [
        r'(?:GD|KD|HD|OD|RD)\d{8,12}',
        r'\d{10,16}',
        r'(?:ticket|order|work)[_-]?(\d{6,12})',
    ]
    
    AGENT_ID_PATTERNS = [
        r'(?:agent|坐席|cs|op)[_-]?(\d{4,8})',
        r'(?:^|[_-])(\d{4,8})(?:[_-]|$)',
    ]
    
    DURATION_PATTERNS = [
        r'(\d{1,3})m(\d{1,2})s',
        r'(\d{1,3})_(\d{1,2})_duration',
        r'dur[_-]?(\d+)',
    ]

    def __init__(self, recording_dir: str):
        self.recording_dir = Path(recording_dir)
        if not self.recording_dir.exists():
            raise FileNotFoundError(f"录音目录不存在: {recording_dir}")
        
        self.recordings: List[RecordingFile] = []
        self.scan_hash: str = ""

    def scan(self) -> List[RecordingFile]:
        all_files = []
        for ext in self.SUPPORTED_EXTENSIONS:
            all_files.extend(self.recording_dir.rglob(f"*{ext}"))
            all_files.extend(self.recording_dir.rglob(f"*{ext.upper()}"))
        
        all_files = sorted(set(all_files), key=lambda x: str(x))
        
        self.recordings = []
        for file_path in all_files:
            recording = self._process_file(file_path)
            self.recordings.append(recording)
        
        self._generate_scan_hash()
        return self.recordings

    def _process_file(self, file_path: Path) -> RecordingFile:
        stat = file_path.stat()
        recording = RecordingFile(
            file_path=str(file_path),
            file_name=file_path.name,
            file_size=stat.st_size,
            extension=file_path.suffix.lower()
        )
        
        self._parse_file_name(recording)
        return recording

    def _parse_file_name(self, recording: RecordingFile) -> None:
        file_name = recording.file_name
        
        ticket_id = self._extract_ticket_id(file_name)
        agent_id = self._extract_agent_id(file_name)
        duration = self._extract_duration(file_name)
        
        recording.parsed_ticket_id = ticket_id
        recording.parsed_agent_id = agent_id
        recording.duration_seconds = duration
        
        if not ticket_id:
            recording.parse_status = "warning"
            recording.parse_error = "未能解析工单号"
        else:
            recording.parse_status = "success"

    def _extract_ticket_id(self, file_name: str) -> Optional[str]:
        for pattern in self.TICKET_ID_PATTERNS:
            match = re.search(pattern, file_name, re.IGNORECASE)
            if match:
                return match.group(0) if match.lastindex is None else match.group(1)
        return None

    def _extract_agent_id(self, file_name: str) -> Optional[str]:
        for pattern in self.AGENT_ID_PATTERNS:
            match = re.search(pattern, file_name, re.IGNORECASE)
            if match:
                return match.group(1) if match.lastindex else match.group(0)
        return None

    def _extract_duration(self, file_name: str) -> Optional[int]:
        for pattern in self.DURATION_PATTERNS:
            match = re.search(pattern, file_name, re.IGNORECASE)
            if match:
                if len(match.groups()) == 2:
                    minutes = int(match.group(1))
                    seconds = int(match.group(2))
                    return minutes * 60 + seconds
                elif len(match.groups()) == 1:
                    return int(match.group(1))
        return None

    def _generate_scan_hash(self) -> None:
        content = "|".join(sorted(r.file_path + ":" + str(r.file_size) for r in self.recordings))
        self.scan_hash = hashlib.md5(content.encode()).hexdigest()

    def get_recordings_by_ticket_id(self, ticket_id: str) -> List[RecordingFile]:
        normalized = ticket_id.strip().upper()
        return [r for r in self.recordings if r.parsed_ticket_id and r.parsed_ticket_id.upper() == normalized]

    def get_recordings_by_agent_id(self, agent_id: str) -> List[RecordingFile]:
        normalized = agent_id.strip()
        return [r for r in self.recordings if r.parsed_agent_id == normalized]
