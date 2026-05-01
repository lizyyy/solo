#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
import os


@dataclass
class DataSet:
    filename: str
    source_headers: List[str]
    mapped_headers: Dict[str, str]
    time: List[float]
    current: List[float]
    voltage: List[float]
    raw_rows: List[Dict[str, Any]] = field(default_factory=list)
    units_info: Dict[str, str] = field(default_factory=dict)
    has_valid_data: bool = True
    parse_errors: List[str] = field(default_factory=list)
    
    @property
    def row_count(self) -> int:
        return len(self.time)
    
    @property
    def duration_seconds(self) -> float:
        if not self.time:
            return 0.0
        return self.time[-1] - self.time[0]


class CSVParser:
    TIME_PATTERNS = [
        r'^time$',
        r'^timestamp$',
        r'^时间$',
        r'^datetime$',
        r'^date.*time$',
        r'^记录时间$',
    ]
    
    CURRENT_PATTERNS = [
        r'^current$',
        r'^current_ma$',
        r'^current\(ma\)$',
        r'^current\(a\)$',
        r'^电流$',
        r'^电流\(ma\)$',
        r'^电流\(a\)$',
        r'^i$',
        r'^i_ma$',
        r'^i\(ma\)$',
    ]
    
    VOLTAGE_PATTERNS = [
        r'^voltage$',
        r'^voltage_v$',
        r'^voltage\(v\)$',
        r'^电压$',
        r'^电压\(v\)$',
        r'^u$',
        r'^u_v$',
        r'^v$',
    ]
    
    UNIT_SPECIFIERS = {
        'current': [
            (['ma', '毫安'], 'mA'),
            (['a', '安', '安培'], 'A'),
            (['ua', '微安'], 'uA'),
        ],
        'voltage': [
            (['v', '伏', '伏特'], 'V'),
            (['mv', '毫伏'], 'mV'),
        ],
    }
    
    def __init__(self):
        self.parsing_errors: List[str] = []
        
    def parse_file(self, filepath: str, encoding: str = 'utf-8') -> DataSet:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")
            
        source_headers = []
        rows = []
        
        encodings_to_try = [encoding, 'gbk', 'gb2312', 'utf-8-sig', 'latin-1']
        file_content = None
        used_encoding = None
        
        for enc in encodings_to_try:
            try:
                with open(filepath, 'r', encoding=enc, newline='') as f:
                    file_content = f.read()
                    used_encoding = enc
                break
            except UnicodeDecodeError:
                continue
        
        if file_content is None:
            raise ValueError(f"Cannot decode file: {filepath}")
        
        lines = file_content.splitlines()
        header_line = None
        data_start_idx = 0
        
        for i, line in enumerate(lines[:20]):
            line = line.strip()
            if line and ',' in line:
                header_line = line
                data_start_idx = i + 1
                break
        
        if header_line is None:
            raise ValueError(f"Cannot find CSV header in file: {filepath}")
        
        source_headers = [h.strip() for h in header_line.split(',')]
        mapped_headers = self._map_headers(source_headers)
        
        time_col = mapped_headers.get('time')
        current_col = mapped_headers.get('current')
        voltage_col = mapped_headers.get('voltage')
        
        raw_rows = []
        time_values: List[float] = []
        current_values: List[float] = []
        voltage_values: List[float] = []
        
        parse_errors = []
        
        for i, line in enumerate(lines[data_start_idx:]):
            line = line.strip()
            if not line:
                continue
            
            parts = line.split(',')
            row = {}
            for j, header in enumerate(source_headers):
                if j < len(parts):
                    row[header] = parts[j].strip()
                else:
                    row[header] = ''
            raw_rows.append(row)
            
            time_val = self._parse_time(row, time_col, i)
            if time_val is None:
                parse_errors.append(f"Row {i+2}: Cannot parse time value: {row.get(time_col, '')}")
                continue
            
            current_val = self._parse_numeric(row, current_col)
            if current_val is None:
                parse_errors.append(f"Row {i+2}: Cannot parse current value: {row.get(current_col, '')}")
                continue
            
            voltage_val = self._parse_numeric(row, voltage_col)
            if voltage_val is None:
                parse_errors.append(f"Row {i+2}: Cannot parse voltage value: {row.get(voltage_col, '')}")
                continue
            
            time_values.append(time_val)
            current_values.append(current_val)
            voltage_values.append(voltage_val)
        
        current_unit = self._detect_unit(source_headers, current_col, 'current') if current_col else 'mA'
        voltage_unit = self._detect_unit(source_headers, voltage_col, 'voltage') if voltage_col else 'V'
        
        current_values = self._normalize_current(current_values, current_unit)
        voltage_values = self._normalize_voltage(voltage_values, voltage_unit)
        
        if len(time_values) > 0 and time_values[0] > 1e12:
            time_values = [t - time_values[0] for t in time_values]
        
        return DataSet(
            filename=os.path.basename(filepath),
            source_headers=source_headers,
            mapped_headers=mapped_headers,
            time=time_values,
            current=current_values,
            voltage=voltage_values,
            raw_rows=raw_rows,
            units_info={
                'current': current_unit,
                'voltage': voltage_unit,
            },
            has_valid_data=len(time_values) > 0,
            parse_errors=parse_errors,
        )
    
    def _map_headers(self, headers: List[str]) -> Dict[str, str]:
        mapped = {}
        header_lower = {h.lower().strip(): h for h in headers}
        
        for category, patterns in [
            ('time', self.TIME_PATTERNS),
            ('current', self.CURRENT_PATTERNS),
            ('voltage', self.VOLTAGE_PATTERNS),
        ]:
            for pattern in patterns:
                for header_l, original_header in header_lower.items():
                    if re.match(pattern, header_l, re.IGNORECASE):
                        mapped[category] = original_header
                        break
                if category in mapped:
                    break
        
        if 'time' not in mapped:
            for original_header in headers:
                h_lower = original_header.lower()
                if 'time' in h_lower or '时间' in original_header:
                    mapped['time'] = original_header
                    break
        
        if 'current' not in mapped:
            for original_header in headers:
                h_lower = original_header.lower()
                if 'current' in h_lower or '电流' in original_header:
                    mapped['current'] = original_header
                    break
        
        if 'voltage' not in mapped:
            for original_header in headers:
                h_lower = original_header.lower()
                if 'voltage' in h_lower or '电压' in original_header:
                    mapped['voltage'] = original_header
                    break
        
        return mapped
    
    def _detect_unit(self, headers: List[str], column_name: str, category: str) -> str:
        if not column_name:
            return 'A' if category == 'current' else 'V'
        
        col_lower = column_name.lower()
        
        unit_specs = self.UNIT_SPECIFIERS.get(category, [])
        for patterns, unit in unit_specs:
            for pattern in patterns:
                if pattern in col_lower or f'({pattern})' in col_lower:
                    return unit
        
        return 'A' if category == 'current' else 'V'
    
    def _normalize_current(self, values: List[float], unit: str) -> List[float]:
        if unit == 'mA':
            return values
        elif unit == 'A':
            return [v * 1000 for v in values]
        elif unit == 'uA':
            return [v / 1000 for v in values]
        return values
    
    def _normalize_voltage(self, values: List[float], unit: str) -> List[float]:
        if unit == 'V':
            return values
        elif unit == 'mV':
            return [v / 1000 for v in values]
        return values
    
    def _parse_time(self, row: Dict[str, str], col_name: str, row_index: int) -> Optional[float]:
        if col_name is None:
            return float(row_index)
        
        value = row.get(col_name, '')
        if not value:
            return None
        
        try:
            num_val = float(value)
            if num_val > 1e12:
                return num_val / 1000
            return num_val
        except ValueError:
            pass
        
        time_formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y/%m/%d %H:%M',
            '%d/%m/%Y %H:%M:%S',
            '%m/%d/%Y %H:%M:%S',
            '%H:%M:%S',
            '%H:%M',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%SZ',
        ]
        
        for fmt in time_formats:
            try:
                dt = datetime.strptime(value, fmt)
                if dt.year < 1990:
                    dt = dt.replace(year=datetime.now().year)
                return dt.timestamp()
            except (ValueError, OSError):
                continue
        
        if re.match(r'^\d+:\d+:\d+(\.\d+)?$', value):
            parts = value.split(':')
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        
        return None
    
    def _parse_numeric(self, row: Dict[str, str], col_name: str) -> Optional[float]:
        if col_name is None:
            return None
        
        value = row.get(col_name, '')
        if not value:
            return None
        
        value = value.replace(' ', '')
        value = re.sub(r'[^\d.\-\+eE]', '', value)
        
        try:
            return float(value)
        except ValueError:
            return None
