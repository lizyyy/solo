import csv
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

class RetentionRecord:
    def __init__(self, box_number: str, product_name: str, production_date: str, 
                 batch_number: str, operator: str, remarks: str = ""):
        self.box_number = box_number.strip()
        self.product_name = product_name.strip()
        self.production_date = production_date.strip()
        self.batch_number = batch_number.strip()
        self.operator = operator.strip()
        self.remarks = remarks.strip()
        self.parsed_date: Optional[datetime] = None
        self.parse_errors: List[str] = []
    
    def to_dict(self) -> Dict:
        return {
            'box_number': self.box_number,
            'product_name': self.product_name,
            'production_date': self.production_date,
            'batch_number': self.batch_number,
            'operator': self.operator,
            'remarks': self.remarks,
            'parse_errors': self.parse_errors
        }

class RetentionParser:
    REQUIRED_FIELDS = ['盒号', '产品名称', '生产日期', '批次号', '操作员']
    
    def __init__(self, config: Dict):
        self.config = config
        self.box_prefix = config.get('box_number_prefix', 'GD')
    
    def parse_file(self, file_path: str) -> Dict:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        records: List[RetentionRecord] = []
        parse_errors: List[Dict] = []
        raw_rows_count = 0
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            self._validate_header(reader.fieldnames, file_path)
            
            for row_num, row in enumerate(reader, start=2):
                raw_rows_count += 1
                try:
                    record = self._parse_row(row, row_num)
                    records.append(record)
                except Exception as e:
                    parse_errors.append({
                        'row': row_num,
                        'error': str(e),
                        'data': str(row)
                    })
        
        return {
            'records': records,
            'parse_errors': parse_errors,
            'raw_rows_count': raw_rows_count,
            'file_path': file_path
        }
    
    def _validate_header(self, fieldnames: List[str], file_path: str):
        missing_fields = []
        for required in self.REQUIRED_FIELDS:
            if required not in fieldnames:
                missing_fields.append(required)
        
        if missing_fields:
            raise ValueError(f"文件 {file_path} 缺少必填列: {', '.join(missing_fields)}")
    
    def _parse_row(self, row: Dict, row_num: int) -> RetentionRecord:
        record = RetentionRecord(
            box_number=row.get('盒号', ''),
            product_name=row.get('产品名称', ''),
            production_date=row.get('生产日期', ''),
            batch_number=row.get('批次号', ''),
            operator=row.get('操作员', ''),
            remarks=row.get('备注', '')
        )
        
        if not record.box_number:
            record.parse_errors.append("盒号不能为空")
        elif not record.box_number.startswith(self.box_prefix):
            record.parse_errors.append(f"盒号 '{record.box_number}' 不符合前缀规则，应为 {self.box_prefix} 开头")
        
        if not record.product_name:
            record.parse_errors.append("产品名称不能为空")
        
        if record.production_date:
            try:
                record.parsed_date = self._parse_date(record.production_date)
            except ValueError as e:
                record.parse_errors.append(f"生产日期格式错误: {e}")
        else:
            record.parse_errors.append("生产日期不能为空")
        
        if not record.batch_number:
            record.parse_errors.append("批次号不能为空")
        
        if not record.operator:
            record.parse_errors.append("操作员不能为空")
        
        return record
    
    def _parse_date(self, date_str: str) -> datetime:
        date_formats = [
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%Y年%m月%d日',
            '%Y%m%d'
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析日期: {date_str}，支持格式: YYYY-MM-DD, YYYY/MM/DD, YYYY年MM月DD日, YYYYMMDD")
