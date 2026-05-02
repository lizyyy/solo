import os
import csv
import re
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field


@dataclass
class IndexRecord:
    box_number: Optional[str] = None
    case_number: Optional[str] = None
    page_number: Optional[int] = None
    expected_filename: Optional[str] = None
    original_row: Dict[str, str] = field(default_factory=dict)


class IndexParser:
    COMMON_FIELD_NAMES = {
        '盒号': ['盒号', 'box', 'box_number', '盒', 'H', 'h'],
        '案卷号': ['案卷号', 'case', 'case_number', '案', 'A', 'a', '案卷'],
        '页码': ['页码', 'page', 'page_number', '页', 'P', 'p'],
        '文件名': ['文件名', 'filename', 'file_name', '文件', '名称']
    }
    
    def __init__(self, csv_path: str, config: Dict = None):
        self.csv_path = csv_path
        self.config = config or {}
        self.field_mappings = self.config.get('field_mappings', {})
    
    def parse(self) -> List[IndexRecord]:
        if not os.path.exists(self.csv_path):
            raise ValueError(f"索引文件不存在: {self.csv_path}")
        
        records = []
        
        with open(self.csv_path, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        
        if '\0' in content:
            content = content.replace('\0', '')
        
        lines = content.splitlines()
        if not lines:
            return records
        
        delimiter = self._detect_delimiter(lines[0])
        
        reader = csv.DictReader(lines, delimiter=delimiter)
        
        actual_mappings = self._resolve_field_mappings(reader.fieldnames)
        
        for row in reader:
            record = self._parse_row(row, actual_mappings)
            if record.case_number or record.page_number is not None:
                records.append(record)
        
        return records
    
    def _detect_delimiter(self, first_line: str) -> str:
        comma_count = first_line.count(',')
        tab_count = first_line.count('\t')
        semicolon_count = first_line.count(';')
        
        if tab_count > comma_count and tab_count > semicolon_count:
            return '\t'
        elif semicolon_count > comma_count and semicolon_count > tab_count:
            return ';'
        return ','
    
    def _resolve_field_mappings(self, fieldnames: List[str]) -> Dict[str, str]:
        mappings = {}
        
        if fieldnames is None:
            return mappings
        
        fieldnames_lower = {fn.lower().strip(): fn for fn in fieldnames}
        
        for standard_name, alternatives in self.COMMON_FIELD_NAMES.items():
            if standard_name in self.field_mappings:
                custom_mapping = self.field_mappings[standard_name]
                if custom_mapping in fieldnames:
                    mappings[standard_name] = custom_mapping
                continue
            
            for alt in alternatives:
                alt_lower = alt.lower().strip()
                if alt_lower in fieldnames_lower:
                    mappings[standard_name] = fieldnames_lower[alt_lower]
                    break
        
        return mappings
    
    def _parse_row(self, row: Dict[str, str], mappings: Dict[str, str]) -> IndexRecord:
        record = IndexRecord()
        record.original_row = dict(row)
        
        box_key = mappings.get('盒号')
        if box_key and box_key in row:
            record.box_number = self._clean_text(row[box_key])
        
        case_key = mappings.get('案卷号')
        if case_key and case_key in row:
            record.case_number = self._clean_text(row[case_key])
        
        page_key = mappings.get('页码')
        if page_key and page_key in row:
            record.page_number = self._parse_page_number(row[page_key])
        
        filename_key = mappings.get('文件名')
        if filename_key and filename_key in row:
            record.expected_filename = row[filename_key].strip()
        
        if not record.case_number or record.page_number is None:
            record = self._extract_from_row_text(row, record)
        
        return record
    
    def _clean_text(self, text: str) -> str:
        if not text:
            return ''
        text = str(text).strip()
        text = re.sub(r'[\'"]', '', text)
        return text
    
    def _parse_page_number(self, text: str) -> Optional[int]:
        if not text:
            return None
        text = str(text).strip()
        
        match = re.search(r'(\d+)', text)
        if match:
            return int(match.group(1))
        
        return None
    
    def _extract_from_row_text(self, row: Dict[str, str], record: IndexRecord) -> IndexRecord:
        combined_text = ' '.join(str(v) for v in row.values())
        
        patterns = [
            r'(?:盒|H|h)(\d+)[_-]?(?:案|A|a)(\d+)[_-]?(\d+)',
            r'(\d+)[_-](\d+)[_-](\d+)',
            r'(\d+)-(\d+)-(\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, combined_text)
            if match:
                groups = match.groups()
                if len(groups) >= 3:
                    if not record.box_number:
                        record.box_number = groups[0]
                    if not record.case_number:
                        record.case_number = groups[1]
                    if record.page_number is None:
                        try:
                            record.page_number = int(groups[2])
                        except ValueError:
                            pass
                    return record
        
        return record


def parse_index_csv(csv_path: str, config: Dict = None) -> List[Dict]:
    parser = IndexParser(csv_path, config)
    records = parser.parse()
    
    result = []
    for record in records:
        result.append({
            'box_number': record.box_number,
            'case_number': record.case_number,
            'page_number': record.page_number,
            'expected_filename': record.expected_filename,
            'original_row': record.original_row
        })
    
    return result
