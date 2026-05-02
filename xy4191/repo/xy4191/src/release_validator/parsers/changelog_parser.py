import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class ChangelogEntry:
    version: str
    date: Optional[str] = None
    date_parsed: Optional[datetime] = None
    changes: List[str] = None
    raw_section: str = ""
    line_number: int = 0


class ChangelogParser:
    VERSION_PATTERNS = [
        r'^##\s*\[?v?(\d+\.\d+\.\d+(?:-[\w\.]+)?)\]?',
        r'^#\s*\[?v?(\d+\.\d+\.\d+(?:-[\w\.]+)?)\]?',
        r'^v?(\d+\.\d+\.\d+(?:-[\w\.]+)?)\s*\(',
        r'^(\d+\.\d+\.\d+(?:-[\w\.]+)?)\s+',
    ]
    
    DATE_PATTERNS = [
        r'(\d{4}-\d{2}-\d{2})',
        r'(\d{2}/\d{2}/\d{4})',
        r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})',
    ]
    
    def __init__(self):
        self.entries: List[ChangelogEntry] = []
        self.version_to_entry: Dict[str, ChangelogEntry] = {}
        self.latest_version: Optional[str] = None
    
    def parse(self, file_path: Path) -> List[ChangelogEntry]:
        self.entries = []
        self.version_to_entry = {}
        
        lines = self._read_file(file_path)
        
        current_entry: Optional[ChangelogEntry] = None
        current_changes: List[str] = []
        current_raw: List[str] = []
        
        for line_num, line in enumerate(lines, 1):
            version_match = self._match_version_header(line)
            
            if version_match:
                if current_entry:
                    current_entry.changes = current_changes
                    current_entry.raw_section = '\n'.join(current_raw)
                    self.entries.append(current_entry)
                    self.version_to_entry[current_entry.version] = current_entry
                
                current_entry = ChangelogEntry(
                    version=version_match['version'],
                    date=version_match.get('date'),
                    date_parsed=version_match.get('date_parsed'),
                    line_number=line_num,
                    changes=[],
                    raw_section=""
                )
                current_changes = []
                current_raw = [line]
            elif current_entry:
                current_raw.append(line)
                
                change = self._extract_change(line)
                if change:
                    current_changes.append(change)
        
        if current_entry:
            current_entry.changes = current_changes
            current_entry.raw_section = '\n'.join(current_raw)
            self.entries.append(current_entry)
            self.version_to_entry[current_entry.version] = current_entry
        
        if self.entries:
            self.latest_version = self.entries[0].version
        
        return self.entries
    
    def _read_file(self, file_path: Path) -> List[str]:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read().splitlines()
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='latin-1') as f:
                return f.read().splitlines()
    
    def _match_version_header(self, line: str) -> Optional[Dict]:
        line = line.strip()
        if not line:
            return None
        
        for pattern in self.VERSION_PATTERNS:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                version = match.group(1)
                
                date_str = self._extract_date(line)
                date_parsed = None
                
                if date_str:
                    date_parsed = self._parse_date(date_str)
                
                return {
                    'version': version,
                    'date': date_str,
                    'date_parsed': date_parsed
                }
        
        return None
    
    def _extract_date(self, line: str) -> Optional[str]:
        for pattern in self.DATE_PATTERNS:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1)
        return None
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        formats = [
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%d %b %Y",
            "%d %B %Y",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except (ValueError, TypeError):
                continue
        
        return None
    
    def _extract_change(self, line: str) -> Optional[str]:
        line = line.strip()
        if not line:
            return None
        
        if line.startswith(('-', '*', '•')):
            return line.lstrip('-*• \t')
        
        if re.match(r'^\d+\.', line):
            return line
        
        return None
    
    def get_for_version(self, version: str) -> Optional[ChangelogEntry]:
        if version in self.version_to_entry:
            return self.version_to_entry[version]
        
        for entry_ver, entry in self.version_to_entry.items():
            if entry_ver.startswith(version) or version.startswith(entry_ver):
                return entry
        
        return None
    
    def has_version(self, version: str) -> bool:
        return self.get_for_version(version) is not None
    
    def get_summary(self) -> dict:
        return {
            "total_versions": len(self.entries),
            "latest_version": self.latest_version,
            "versions": [e.version for e in self.entries]
        }
