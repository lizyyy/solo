import csv
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass

from .models import Fixture, PatchEntry
from .config import ConfigManager


@dataclass
class ColumnMapping:
    required_columns: List[str]
    optional_columns: List[str]
    column_aliases: Dict[str, List[str]]


FIXTURE_MAPPING = ColumnMapping(
    required_columns=['id'],
    optional_columns=[
        'name', 'manufacturer', 'model', 'mode', 'position',
        'universe', 'start_address', 'channel_count', 'note'
    ],
    column_aliases={
        'id': ['id', '编号', '灯具id', 'fixture_id', 'fixture id'],
        'name': ['name', '名称', '灯具名', 'fixture_name'],
        'manufacturer': ['manufacturer', '制造商', '品牌', 'brand'],
        'model': ['model', '型号', '型号名'],
        'mode': ['mode', '模式', '灯具模式'],
        'position': ['position', '位置', '吊杆', 'truss', 'rig'],
        'universe': ['universe', '宇宙', '宇宙号', 'univ'],
        'start_address': ['start_address', '起始地址', '地址', 'address'],
        'channel_count': ['channel_count', '通道数', '通道数量', 'channels'],
        'note': ['note', '备注', '说明'],
    }
)


PATCH_MAPPING = ColumnMapping(
    required_columns=['universe', 'start_address'],
    optional_columns=[
        'id', 'fixture_id', 'fixture_name', 'mode',
        'channel_count', 'position', 'note'
    ],
    column_aliases={
        'id': ['id', '编号', 'patch_id'],
        'universe': ['universe', '宇宙', '宇宙号', 'univ'],
        'start_address': ['start_address', '起始地址', '地址', 'address'],
        'fixture_id': ['fixture_id', '灯具id', 'fixture id'],
        'fixture_name': ['fixture_name', '灯具名称', '名称', 'name'],
        'mode': ['mode', '模式', '灯具模式'],
        'channel_count': ['channel_count', '通道数', '通道数量', 'channels'],
        'position': ['position', '位置', '吊杆', 'truss'],
        'note': ['note', '备注', '说明'],
    }
)


class CSVParser:
    def __init__(self, config_manager: Optional[ConfigManager] = None):
        self.config_manager = config_manager

    def _normalize_column(self, column: str) -> str:
        return column.strip().lower().replace(' ', '_')

    def _map_columns(self, header: List[str], mapping: ColumnMapping) -> Dict[str, str]:
        header_lower = [self._normalize_column(h) for h in header]
        result = {}
        
        for target_name, aliases in mapping.column_aliases.items():
            for alias in aliases:
                alias_normalized = self._normalize_column(alias)
                if alias_normalized in header_lower:
                    idx = header_lower.index(alias_normalized)
                    result[target_name] = header[idx]
                    break
        
        return result

    def _parse_int(self, value: Any, default: Optional[int] = None) -> Optional[int]:
        if value is None or value == '':
            return default
        try:
            return int(float(str(value).strip()))
        except (ValueError, TypeError):
            return default

    def parse_fixtures(self, file_path: str) -> List[Fixture]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"灯具清单文件不存在: {file_path}")
        
        fixtures = []
        row_count = 0
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                raise ValueError("CSV文件没有表头")
            
            column_map = self._map_columns(list(reader.fieldnames), FIXTURE_MAPPING)
            
            for row in reader:
                row_count += 1
                
                fixture_id = row.get(column_map.get('id', '')) or row.get('id')
                if not fixture_id:
                    fixture_id = f"auto_{row_count}"
                
                universe = self._parse_int(row.get(column_map.get('universe', '')), default=1)
                start_address = self._parse_int(row.get(column_map.get('start_address', '')), default=1)
                channel_count = self._parse_int(row.get(column_map.get('channel_count', '')))
                
                fixture = Fixture(
                    id=str(fixture_id).strip(),
                    name=row.get(column_map.get('name', '')) or None,
                    manufacturer=row.get(column_map.get('manufacturer', '')) or "Unknown",
                    model=row.get(column_map.get('model', '')) or "Unknown",
                    mode=row.get(column_map.get('mode', '')) or "Default",
                    position=row.get(column_map.get('position', '')) or None,
                    universe=universe or 1,
                    start_address=start_address or 1,
                    custom_channel_count=channel_count,
                    note=row.get(column_map.get('note', '')) or None,
                )
                fixtures.append(fixture)
        
        return fixtures

    def parse_patch(self, file_path: str) -> List[PatchEntry]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Patch表文件不存在: {file_path}")
        
        entries = []
        row_count = 0
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                raise ValueError("CSV文件没有表头")
            
            column_map = self._map_columns(list(reader.fieldnames), PATCH_MAPPING)
            
            for row in reader:
                row_count += 1
                
                universe = self._parse_int(row.get(column_map.get('universe', '')))
                start_address = self._parse_int(row.get(column_map.get('start_address', '')))
                
                if universe is None or start_address is None:
                    continue
                
                entry_id = row.get(column_map.get('id', '')) or f"patch_{row_count}"
                channel_count = self._parse_int(row.get(column_map.get('channel_count', '')), default=1)
                
                entry = PatchEntry(
                    id=str(entry_id).strip(),
                    universe=universe,
                    start_address=start_address,
                    fixture_id=row.get(column_map.get('fixture_id', '')) or None,
                    fixture_name=row.get(column_map.get('fixture_name', '')) or None,
                    mode=row.get(column_map.get('mode', '')) or None,
                    channel_count=channel_count or 1,
                    position=row.get(column_map.get('position', '')) or None,
                    note=row.get(column_map.get('note', '')) or None,
                )
                entries.append(entry)
        
        return entries
