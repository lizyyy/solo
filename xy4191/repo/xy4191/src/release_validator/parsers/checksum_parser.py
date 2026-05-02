import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class ChecksumEntry:
    filename: str
    algorithm: str
    hash_value: str
    source_line: str
    line_number: int = 0


class ChecksumParser:
    SUPPORTED_ALGORITHMS = {
        "sha256": r'^[a-f0-9]{64}$',
        "sha512": r'^[a-f0-9]{128}$',
        "md5": r'^[a-f0-9]{32}$',
        "sha1": r'^[a-f0-9]{40}$',
    }
    
    def __init__(self):
        self.entries: List[ChecksumEntry] = []
        self.filename_to_entry: Dict[str, ChecksumEntry] = {}
        self.algorithm_used: Optional[str] = None
    
    def parse(self, file_path: Path) -> List[ChecksumEntry]:
        self.entries = []
        self.filename_to_entry = {}
        
        lines = self._read_file(file_path)
        
        for line_num, line in enumerate(lines, 1):
            entry = self._parse_line(line, line_num)
            if entry:
                self.entries.append(entry)
                self.filename_to_entry[entry.filename] = entry
                
                if not self.algorithm_used:
                    self.algorithm_used = entry.algorithm
        
        return self.entries
    
    def _read_file(self, file_path: Path) -> List[str]:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read().splitlines()
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='latin-1') as f:
                return f.read().splitlines()
    
    def _parse_line(self, line: str, line_num: int) -> Optional[ChecksumEntry]:
        line = line.strip()
        if not line or line.startswith('#') or line.startswith(';'):
            return None
        
        algorithm = self._detect_algorithm(line)
        if not algorithm:
            return None
        
        pattern = self._get_pattern(algorithm)
        match = re.match(pattern, line)
        
        if match:
            hash_value = match.group(1)
            filename = match.group(2).strip()
            
            if filename.startswith('*'):
                filename = filename[1:]
            
            return ChecksumEntry(
                filename=filename,
                algorithm=algorithm,
                hash_value=hash_value,
                source_line=line,
                line_number=line_num
            )
        
        return None
    
    def _detect_algorithm(self, line: str) -> Optional[str]:
        for algo, pattern in self.SUPPORTED_ALGORITHMS.items():
            if re.match(pattern, line[:len(line.split()[0])].strip()):
                return algo
        return None
    
    def _get_pattern(self, algorithm: str) -> str:
        if algorithm == "sha256":
            return r'^([a-f0-9]{64})\s+[*]?(.+)$'
        elif algorithm == "sha512":
            return r'^([a-f0-9]{128})\s+[*]?(.+)$'
        elif algorithm == "md5":
            return r'^([a-f0-9]{32})\s+[*]?(.+)$'
        elif algorithm == "sha1":
            return r'^([a-f0-9]{40})\s+[*]?(.+)$'
        return r'^([a-f0-9]+)\s+[*]?(.+)$'
    
    def get_for_file(self, filename: str) -> Optional[ChecksumEntry]:
        return self.filename_to_entry.get(filename)
    
    def get_summary(self) -> dict:
        return {
            "total_entries": len(self.entries),
            "algorithm": self.algorithm_used,
            "filenames": list(self.filename_to_entry.keys())
        }
