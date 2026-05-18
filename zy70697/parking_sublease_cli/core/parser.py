import csv
import os
from datetime import datetime
from typing import List, Tuple, Optional
import pandas as pd

from .models import SubleaseRecord, BadRecord, SourceInfo


class DataParser:
    REQUIRED_COLUMNS = [
        'record_id', 'space_id', 'owner_id', 'owner_name',
        'tenant_id', 'tenant_name', 'tenant_phone',
        'start_date', 'end_date', 'monthly_fee'
    ]
    
    OPTIONAL_COLUMNS = [
        'actual_terminate_date', 'access_grant_date', 'access_revoke_date'
    ]
    
    def __init__(self):
        self.bad_records: List[BadRecord] = []
        self.records: List[SubleaseRecord] = []
    
    def parse_date(self, date_str: str) -> Optional[datetime]:
        if not date_str or pd.isna(date_str):
            return None
        date_str = str(date_str).strip()
        formats = ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d', '%d-%m-%Y', '%d/%m/%Y']
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return None
    
    def parse_file(self, file_path: str) -> Tuple[List[SubleaseRecord], List[BadRecord]]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.csv':
            return self._parse_csv(file_path)
        elif ext in ['.xlsx', '.xls']:
            return self._parse_excel(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")
    
    def _parse_csv(self, file_path: str) -> Tuple[List[SubleaseRecord], List[BadRecord]]:
        self.records = []
        self.bad_records = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        if not rows:
            return [], []
        
        header = [h.strip() for h in rows[0]]
        header_map = {h.lower(): idx for idx, h in enumerate(header)}
        
        for row_num in range(1, len(rows)):
            row_data = rows[row_num]
            original_line = ','.join(row_data)
            actual_row_num = row_num + 1
            
            try:
                record = self._parse_row(row_data, header_map, file_path, actual_row_num, original_line)
                if record:
                    self.records.append(record)
            except Exception as e:
                self.bad_records.append(BadRecord(
                    file_path=file_path,
                    sheet_name=None,
                    row_number=actual_row_num,
                    original_data=original_line,
                    error_message=str(e)
                ))
        
        return self.records, self.bad_records
    
    def _parse_excel(self, file_path: str) -> Tuple[List[SubleaseRecord], List[BadRecord]]:
        self.records = []
        self.bad_records = []
        
        xls = pd.ExcelFile(file_path)
        
        for sheet_name in xls.sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            header = [str(h).strip() for h in df.columns]
            header_map = {h.lower(): idx for idx, h in enumerate(header)}
            
            for row_idx in range(len(df)):
                row_data = df.iloc[row_idx].tolist()
                original_line = ','.join([str(v) for v in row_data])
                actual_row_num = row_idx + 2
                
                try:
                    record = self._parse_row(row_data, header_map, file_path, actual_row_num, original_line, sheet_name)
                    if record:
                        self.records.append(record)
                except Exception as e:
                    self.bad_records.append(BadRecord(
                        file_path=file_path,
                        sheet_name=sheet_name,
                        row_number=actual_row_num,
                        original_data=original_line,
                        error_message=str(e)
                    ))
        
        return self.records, self.bad_records
    
    def _parse_row(self, row_data: list, header_map: dict, file_path: str, 
                   row_num: int, original_line: str, sheet_name: Optional[str] = None) -> Optional[SubleaseRecord]:
        
        def get_value(col_name: str, required: bool = True) -> str:
            col_key = col_name.lower()
            if col_key not in header_map:
                if required:
                    raise ValueError(f"缺少必需列: {col_name}")
                return ""
            idx = header_map[col_key]
            if idx >= len(row_data):
                if required:
                    raise ValueError(f"列 {col_name} 数据缺失")
                return ""
            val = row_data[idx]
            if val is None or pd.isna(val):
                return ""
            return str(val).strip()
        
        for col in self.REQUIRED_COLUMNS:
            if not get_value(col, required=True):
                raise ValueError(f"字段 {col} 不能为空")
        
        record_id = get_value('record_id')
        space_id = get_value('space_id')
        owner_id = get_value('owner_id')
        owner_name = get_value('owner_name')
        tenant_id = get_value('tenant_id')
        tenant_name = get_value('tenant_name')
        tenant_phone = get_value('tenant_phone')
        
        start_date = self.parse_date(get_value('start_date'))
        if not start_date:
            raise ValueError(f"开始日期格式无效")
        
        end_date = self.parse_date(get_value('end_date'))
        if not end_date:
            raise ValueError(f"结束日期格式无效")
        
        try:
            monthly_fee = float(get_value('monthly_fee'))
            if monthly_fee < 0:
                raise ValueError("月租金不能为负数")
        except ValueError as e:
            if "cannot" in str(e):
                raise ValueError(f"月租金格式无效")
            raise
        
        actual_terminate_date = self.parse_date(get_value('actual_terminate_date', required=False))
        access_grant_date = self.parse_date(get_value('access_grant_date', required=False))
        access_revoke_date = self.parse_date(get_value('access_revoke_date', required=False))
        
        source = SourceInfo(
            file_path=file_path,
            sheet_name=sheet_name,
            row_number=row_num,
            original_data=original_line
        )
        
        record = SubleaseRecord(
            record_id=record_id,
            space_id=space_id,
            owner_id=owner_id,
            owner_name=owner_name,
            tenant_id=tenant_id,
            tenant_name=tenant_name,
            tenant_phone=tenant_phone,
            start_date=start_date,
            end_date=end_date,
            monthly_fee=monthly_fee,
            actual_terminate_date=actual_terminate_date,
            source=source
        )
        
        if access_grant_date:
            record.access_grant_date = access_grant_date
        if access_revoke_date:
            record.access_revoke_date = access_revoke_date
        
        return record
