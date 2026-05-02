import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class CIEntry:
    timestamp: Optional[str] = None
    level: Optional[str] = None
    message: str = ""
    raw: str = ""
    line_number: int = 0


class CILogParser:
    LEVEL_PATTERNS = {
        'error': ['ERROR', 'Error', 'error', 'FAILED', 'Failed', 'failed'],
        'warning': ['WARNING', 'Warning', 'warning', 'WARN', 'Warn'],
        'info': ['INFO', 'Info', 'info'],
        'debug': ['DEBUG', 'Debug', 'debug'],
    }
    
    TIMESTAMP_PATTERNS = [
        r'^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:\d{2})?)',
        r'^\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[^\]]*)\]',
    ]
    
    KEY_MARKERS = [
        'version', 'release', 'publish', 'deploy', 'artifact',
        'build', 'test', 'checksum', 'sign', 'verify', 'success',
    ]
    
    def __init__(self):
        self.entries: List[CIEntry] = []
        self.errors: List[CIEntry] = []
        self.warnings: List[CIEntry] = []
        self.version_info: Dict[str, str] = {}
        self.release_info: Dict[str, List[str]] = {}
    
    def parse(self, file_path: Path) -> List[CIEntry]:
        self.entries = []
        self.errors = []
        self.warnings = []
        self.version_info = {}
        self.release_info = {'artifacts': [], 'versions': [], 'status': []}
        
        lines = self._read_file(file_path)
        
        for line_num, line in enumerate(lines, 1):
            entry = self._parse_line(line, line_num)
            if entry:
                self.entries.append(entry)
                
                if entry.level == 'error':
                    self.errors.append(entry)
                elif entry.level == 'warning':
                    self.warnings.append(entry)
                
                self._extract_release_info(entry)
        
        return self.entries
    
    def _read_file(self, file_path: Path) -> List[str]:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read().splitlines()
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='latin-1') as f:
                return f.read().splitlines()
    
    def _parse_line(self, line: str, line_num: int) -> Optional[CIEntry]:
        if not line.strip():
            return None
        
        timestamp = self._extract_timestamp(line)
        level = self._extract_level(line)
        
        return CIEntry(
            timestamp=timestamp,
            level=level,
            message=line.strip(),
            raw=line,
            line_number=line_num
        )
    
    def _extract_timestamp(self, line: str) -> Optional[str]:
        for pattern in self.TIMESTAMP_PATTERNS:
            match = re.match(pattern, line)
            if match:
                return match.group(1)
        return None
    
    def _extract_level(self, line: str) -> Optional[str]:
        for level, markers in self.LEVEL_PATTERNS.items():
            for marker in markers:
                if marker in line:
                    context_start = max(0, line.find(marker) - 5)
                    context_end = min(len(line), line.find(marker) + len(marker) + 5)
                    context = line[context_start:context_end]
                    
                    if not re.search(r'\w', context.replace(marker, '')):
                        return level
        
        return None
    
    def _extract_release_info(self, entry: CIEntry):
        line_lower = entry.message.lower()
        
        if 'version' in line_lower:
            version_match = re.search(r'v?(\d+\.\d+\.\d+(?:-[\w\.]+)?)', entry.message)
            if version_match:
                version = version_match.group(1)
                if version not in self.version_info:
                    self.version_info[version] = entry.message
                    if version not in self.release_info['versions']:
                        self.release_info['versions'].append(version)
        
        for marker in ['artifact', 'build', 'tar', 'zip', 'checksum', 'sha256']:
            if marker in line_lower:
                self.release_info['artifacts'].append(entry.message)
                break
        
        for marker in ['success', 'failed', 'passed', 'completed']:
            if marker in line_lower:
                self.release_info['status'].append(entry.message)
                break
    
    def get_errors(self) -> List[CIEntry]:
        return self.errors
    
    def get_warnings(self) -> List[CIEntry]:
        return self.warnings
    
    def has_errors(self) -> bool:
        return len(self.errors) > 0
    
    def get_summary(self) -> dict:
        return {
            "total_lines": len(self.entries),
            "errors": len(self.errors),
            "warnings": len(self.warnings),
            "versions_detected": list(self.version_info.keys()),
            "has_errors": self.has_errors()
        }
