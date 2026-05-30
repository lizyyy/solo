"""
数据导入模块

支持从多种来源导入数据，保留数据出处（邮件、群消息、旧表格等）。
支持格式：CSV、JSON、Excel、纯文本（从群消息/邮件中提取）
"""

import csv
import json
import os
import re
from typing import List, Dict, Any, Optional
from pathlib import Path

from .core import SonarRecord


class DataImporter:
    """数据导入器，负责从各种格式文件中读取声呐实验记录"""
    
    # 字段别名映射，处理不同来源的字段命名差异
    FIELD_ALIASES = {
        'temperature': ['temperature', 'temp', '水温', '温度'],
        'echo_time': ['echo_time', 'time', '回波时间', '时间', 'echo', 't_echo', 'te'],
        'measured_distance': ['distance', 'measured_distance', '目标距离', '距离', 'd', 'range', 'dist'],
        'device_id': ['device_id', 'device', '设备编号', '设备', 'dev', 'sn'],
        'team': ['team', 'group', '实验小组', '小组', 'team_id'],
        'raw_notes': ['notes', 'note', '备注', '说明', 'comments', 'comment'],
    }
    
    def __init__(self):
        self.records: List[SonarRecord] = []
        self.source_stats: Dict[str, int] = {}
    
    def _normalize_field(self, field_name: str) -> Optional[str]:
        """将字段名标准化为内部字段名"""
        field_lower = field_name.strip().lower()
        for standard_name, aliases in self.FIELD_ALIASES.items():
            if field_lower in [a.lower() for a in aliases]:
                return standard_name
        return None
    
    def _safe_float(self, value: Any) -> Optional[float]:
        """安全转换为浮点数，处理各种无效值"""
        if value is None or value == '':
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            value = value.strip()
            # 处理常见的单位后缀
            value = re.sub(r'[℃°Cmsm]$', '', value, flags=re.IGNORECASE)
            value = value.strip()
            if value in ['', 'N/A', 'n/a', 'NA', 'null', 'None', '-', '--']:
                return None
            try:
                return float(value)
            except ValueError:
                return None
        return None
    
    def _create_record(self, data: Dict[str, Any], source: str, record_idx: int) -> SonarRecord:
        """从字典创建SonarRecord，保留所有原始字段"""
        record_id = f"{source}_{record_idx:04d}"
        
        record = SonarRecord(
            record_id=record_id,
            source=source,
            device_id=str(data.get('device_id', '')).strip() or None,
            team=str(data.get('team', '')).strip() or None,
            temperature=self._safe_float(data.get('temperature')),
            echo_time=self._safe_float(data.get('echo_time')),
            measured_distance=self._safe_float(data.get('measured_distance')),
            raw_notes=str(data.get('raw_notes', '')).strip() or None,
        )
        record.add_step(f"导入: 从 {source} 导入")
        return record
    
    def import_csv(self, file_path: str, source_name: Optional[str] = None) -> List[SonarRecord]:
        """从CSV文件导入数据"""
        path = Path(file_path)
        source = source_name or f"CSV:{path.name}"
        records = []
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            # 标准化字段名
            field_mapping = {}
            for field in reader.fieldnames or []:
                norm_field = self._normalize_field(field)
                if norm_field:
                    field_mapping[field] = norm_field
            
            for idx, row in enumerate(reader, 1):
                normalized_data = {}
                for original_field, value in row.items():
                    norm_field = field_mapping.get(original_field)
                    if norm_field:
                        normalized_data[norm_field] = value
                
                record = self._create_record(normalized_data, source, idx)
                records.append(record)
        
        self.records.extend(records)
        self.source_stats[source] = self.source_stats.get(source, 0) + len(records)
        return records
    
    def import_json(self, file_path: str, source_name: Optional[str] = None) -> List[SonarRecord]:
        """从JSON文件导入数据"""
        path = Path(file_path)
        source = source_name or f"JSON:{path.name}"
        records = []
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            data_list = [data]
        else:
            data_list = data
        
        for idx, item in enumerate(data_list, 1):
            normalized_data = {}
            for key, value in item.items():
                norm_key = self._normalize_field(key)
                if norm_key:
                    normalized_data[norm_key] = value
            
            record = self._create_record(normalized_data, source, idx)
            records.append(record)
        
        self.records.extend(records)
        self.source_stats[source] = self.source_stats.get(source, 0) + len(records)
        return records
    
    def import_excel(self, file_path: str, source_name: Optional[str] = None, 
                     sheet_name: Optional[str] = None) -> List[SonarRecord]:
        """从Excel文件导入数据（需要openpyxl）"""
        try:
            import openpyxl
        except ImportError:
            raise ImportError("需要安装 openpyxl 才能导入Excel文件: pip install openpyxl")
        
        path = Path(file_path)
        source = source_name or f"Excel:{path.name}"
        records = []
        
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb[sheet_name] if sheet_name else wb.active
        
        # 读取表头
        headers = []
        for cell in ws[1]:
            headers.append(cell.value)
        
        # 标准化字段名
        field_mapping = {}
        for i, header in enumerate(headers):
            if header:
                norm_field = self._normalize_field(str(header))
                if norm_field:
                    field_mapping[i] = norm_field
        
        # 读取数据行
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 1):
            normalized_data = {}
            for col_idx, value in enumerate(row):
                norm_field = field_mapping.get(col_idx)
                if norm_field:
                    normalized_data[norm_field] = value
            
            record = self._create_record(normalized_data, source, row_idx)
            records.append(record)
        
        self.records.extend(records)
        self.source_stats[source] = self.source_stats.get(source, 0) + len(records)
        return records
    
    def import_text(self, file_path: str, source_name: Optional[str] = None) -> List[SonarRecord]:
        """
        从纯文本文件导入（邮件、群消息等）
        支持格式：每行一条记录，字段用冒号或等号分隔
        例如：
            水温:20℃ 回波时间:0.5s 距离:350m 设备:SONAR-01 小组:A组
            temp=25 time=0.3 dist=210 dev=SONAR-02 team=B
        """
        path = Path(file_path)
        source = source_name or f"Text:{path.name}"
        records = []
        
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # 提取数字的正则模式
        num_pattern = r'([-+]?\d*\.?\d+)'
        
        for idx, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            normalized_data = {}
            
            # 尝试匹配各种字段模式
            for field_name, aliases in self.FIELD_ALIASES.items():
                for alias in aliases:
                    escaped = re.escape(alias)
                    patterns = [
                        rf'\b{escaped}\s*[:=：]\s*{num_pattern}',
                        rf'\b{escaped}\s+{num_pattern}',
                    ]
                    for pattern in patterns:
                        match = re.search(pattern, line, flags=re.IGNORECASE)
                        if match:
                            if field_name not in normalized_data:
                                normalized_data[field_name] = match.group(1)
                            break
                if field_name not in normalized_data:
                    # 尝试匹配中文字段
                    cn_aliases = [a for a in aliases if '\u4e00' <= a <= '\u9fff']
                    for alias in cn_aliases:
                        pattern = rf'{alias}\s*[:：]?\s*{num_pattern}'
                        match = re.search(pattern, line)
                        if match:
                            normalized_data[field_name] = match.group(1)
                            break
            
            # 提取设备编号和小组（可能不含数字）
            dev_match = re.search(r'(?:设备|dev|sn)[:：]?\s*([\w\-]+)', line, flags=re.IGNORECASE)
            if dev_match:
                normalized_data['device_id'] = dev_match.group(1)
            
            team_match = re.search(r'(?:小组|team|group)[:：]?\s*([\w\u4e00-\u9fff]+)', line, flags=re.IGNORECASE)
            if team_match:
                normalized_data['team'] = team_match.group(1)
            
            normalized_data['raw_notes'] = line
            
            record = self._create_record(normalized_data, source, idx)
            records.append(record)
        
        self.records.extend(records)
        self.source_stats[source] = self.source_stats.get(source, 0) + len(records)
        return records
    
    def auto_import(self, file_path: str, source_name: Optional[str] = None) -> List[SonarRecord]:
        """根据文件扩展名自动选择导入方式"""
        ext = Path(file_path).suffix.lower()
        if ext == '.csv':
            return self.import_csv(file_path, source_name)
        elif ext == '.json':
            return self.import_json(file_path, source_name)
        elif ext in ['.xlsx', '.xls']:
            return self.import_excel(file_path, source_name)
        elif ext in ['.txt', '.md', '.log']:
            return self.import_text(file_path, source_name)
        else:
            # 默认尝试文本导入
            return self.import_text(file_path, source_name)
    
    def get_all_records(self) -> List[SonarRecord]:
        """获取所有已导入的记录"""
        return self.records.copy()
    
    def get_import_stats(self) -> Dict[str, Any]:
        """获取导入统计信息"""
        return {
            'total_records': len(self.records),
            'sources': self.source_stats.copy()
        }
