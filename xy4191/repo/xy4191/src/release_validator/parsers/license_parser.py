import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class LicenseEntry:
    component: str
    license_name: str
    version: Optional[str] = None
    license_url: Optional[str] = None
    notice: Optional[str] = None
    source_line: str = ""
    line_number: int = 0


class LicenseParser:
    SPDX_LICENSES = {
        "Apache-2.0", "MIT", "BSD-3-Clause", "BSD-2-Clause",
        "GPL-2.0-only", "GPL-2.0-or-later", "GPL-3.0-only", "GPL-3.0-or-later",
        "LGPL-2.1-only", "LGPL-2.1-or-later", "LGPL-3.0-only", "LGPL-3.0-or-later",
        "MPL-2.0", "AGPL-3.0-only", "AGPL-3.0-or-later",
        "Unlicense", "CC0-1.0", "CC-BY-4.0", "ISC",
    }
    
    def __init__(self):
        self.entries: List[LicenseEntry] = []
        self.component_to_licenses: Dict[str, List[LicenseEntry]] = {}
    
    def parse(self, file_path: Path) -> List[LicenseEntry]:
        self.entries = []
        self.component_to_licenses = {}
        
        lines = self._read_file(file_path)
        
        current_component = None
        block_lines: List[str] = []
        
        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()
            
            if self._is_component_start(stripped) or self._is_license_block_end(stripped, line_num):
                if current_component and block_lines:
                    self._process_license_block(current_component, block_lines, line_num - len(block_lines))
                
                if self._is_component_start(stripped):
                    current_component = self._extract_component_name(stripped)
                    block_lines = [line]
                else:
                    current_component = None
                    block_lines = []
            elif current_component:
                block_lines.append(line)
        
        if current_component and block_lines:
            self._process_license_block(current_component, block_lines, len(lines) - len(block_lines) + 1)
        
        return self.entries
    
    def _read_file(self, file_path: Path) -> List[str]:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read().splitlines()
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='latin-1') as f:
                return f.read().splitlines()
    
    def _is_component_start(self, line: str) -> bool:
        if re.match(r'^[-=*]+$', line):
            return False
        if re.match(r'^\d+\.', line):
            return True
        if re.match(r'^(\w+(?:[._-]\w+)*)\s+[vV]?\d+', line):
            return True
        if ':' in line and not line.startswith((' ', '\t')):
            return True
        return bool(re.match(r'^[A-Za-z_][A-Za-z0-9_.-]*$', line))
    
    def _is_license_block_end(self, line: str, line_num: int) -> bool:
        return bool(re.match(r'^[-=*_]+$', line))
    
    def _extract_component_name(self, line: str) -> str:
        line = line.strip()
        
        match = re.match(r'^(\w+(?:[._-]\w+)*)', line)
        if match:
            return match.group(1)
        
        if ':' in line:
            return line.split(':')[0].strip()
        
        return line
    
    def _process_license_block(self, component: str, lines: List[str], start_line: int):
        license_name = None
        version = None
        license_url = None
        notice = None
        
        full_text = '\n'.join(lines)
        
        for spdx_license in self.SPDX_LICENSES:
            if spdx_license in full_text or spdx_license.replace('-', ' ') in full_text:
                license_name = spdx_license
                break
        
        if not license_name:
            license_matches = re.findall(
                r'(?:Licensed?|License|licensed?|license):?\s*([^\n\r]+)',
                full_text,
                re.IGNORECASE
            )
            if license_matches:
                license_name = license_matches[0].strip()
        
        version_match = re.search(r'[vV]?(\d+\.\d+(?:\.\d+)?)', full_text)
        if version_match:
            version = version_match.group(1)
        
        url_match = re.search(r'(https?://[^\s\)]+)', full_text)
        if url_match:
            license_url = url_match.group(1)
        
        entry = LicenseEntry(
            component=component,
            license_name=license_name or "UNKNOWN",
            version=version,
            license_url=license_url,
            notice=full_text[:500] if len(full_text) > 500 else full_text,
            source_line='\n'.join(lines[:3]),
            line_number=start_line
        )
        
        self.entries.append(entry)
        
        if component not in self.component_to_licenses:
            self.component_to_licenses[component] = []
        self.component_to_licenses[component].append(entry)
    
    def get_for_component(self, component: str) -> List[LicenseEntry]:
        return self.component_to_licenses.get(component, [])
    
    def get_licenses_summary(self) -> Dict[str, int]:
        license_counts: Dict[str, int] = {}
        for entry in self.entries:
            license_counts[entry.license_name] = license_counts.get(entry.license_name, 0) + 1
        return license_counts
    
    def get_summary(self) -> dict:
        return {
            "total_entries": len(self.entries),
            "components": list(self.component_to_licenses.keys()),
            "licenses": self.get_licenses_summary()
        }
