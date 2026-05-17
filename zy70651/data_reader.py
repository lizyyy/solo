import pandas as pd
from datetime import datetime, date
from typing import List, Tuple, Optional
from models import MedicineBatch, FreezeStatus
import re


class ExcelDataReader:
    REQUIRED_COLUMNS = {
        '批号': ['batch_no', '批号', '批次号', 'batch'],
        '药品名称': ['medicine_name', '药品名称', '品名', '药品', 'medicine'],
        '门店': ['store_name', '门店', '门店名称', '店铺', 'store'],
        '库存数量': ['quantity', '库存数量', '数量', '库存量', 'qty'],
        '效期日期': ['expiry_date', '效期日期', '有效期', '到期日', '效期', 'expiry'],
        '冻结状态': ['freeze_status', '冻结状态', '状态', '冻结', 'status']
    }
    
    def __init__(self):
        self.warnings = []
        self.errors = []
    
    def read_excel(self, file_path: str) -> Tuple[List[MedicineBatch], List[str], List[str]]:
        self.warnings = []
        self.errors = []
        batches = []
        
        try:
            df = pd.read_excel(file_path, engine='openpyxl')
        except Exception as e:
            self.errors.append(f"无法读取Excel文件: {str(e)}")
            return [], self.warnings, self.errors
        
        column_mapping = self._map_columns(df.columns)
        missing_columns = [k for k, v in column_mapping.items() if v is None]
        
        if missing_columns:
            self.errors.append(f"缺少必要列: {', '.join(missing_columns)}")
            return [], self.warnings, self.errors
        
        for idx, row in df.iterrows():
            try:
                batch = self._parse_row(row, column_mapping, idx + 2)
                if batch:
                    batches.append(batch)
            except Exception as e:
                self.errors.append(f"第{idx + 2}行解析失败: {str(e)}")
        
        return batches, self.warnings, self.errors
    
    def _map_columns(self, columns: List[str]) -> dict:
        mapping = {}
        for standard_name, possible_names in self.REQUIRED_COLUMNS.items():
            found = None
            for col in columns:
                col_normalized = str(col).strip().lower()
                for possible in possible_names:
                    if possible.lower() in col_normalized or col_normalized in possible.lower():
                        found = col
                        break
                if found:
                    break
            mapping[standard_name] = found
        return mapping
    
    def _parse_row(self, row: pd.Series, column_mapping: dict, row_num: int) -> Optional[MedicineBatch]:
        issues = []
        
        batch_no = str(row[column_mapping['批号']]).strip() if pd.notna(row[column_mapping['批号']]) else ''
        if not batch_no or batch_no in ['nan', 'None']:
            issues.append("批号为空")
            batch_no = f"未知批次_{row_num}"
        
        medicine_name = str(row[column_mapping['药品名称']]).strip() if pd.notna(row[column_mapping['药品名称']]) else ''
        if not medicine_name or medicine_name in ['nan', 'None']:
            issues.append("药品名称为空")
            medicine_name = "未知药品"
        
        store_name = str(row[column_mapping['门店']]).strip() if pd.notna(row[column_mapping['门店']]) else ''
        if not store_name or store_name in ['nan', 'None']:
            issues.append("门店名称为空")
            store_name = "未知门店"
        
        quantity = self._parse_quantity(row[column_mapping['库存数量']], row_num, issues)
        
        expiry_date = self._parse_date(row[column_mapping['效期日期']], row_num, issues)
        
        freeze_status = self._parse_freeze_status(row[column_mapping['冻结状态']], row_num, issues)
        
        if issues:
            self.warnings.append(f"第{row_num}行存在问题: {'; '.join(issues)}")
        
        batch = MedicineBatch(
            batch_no=batch_no,
            medicine_name=medicine_name,
            store_name=store_name,
            quantity=quantity,
            expiry_date=expiry_date,
            freeze_status=freeze_status,
            issues=issues if issues else None
        )
        
        return batch
    
    def _parse_quantity(self, value, row_num: int, issues: List[str]) -> int:
        if pd.isna(value):
            issues.append("库存数量为空，默认设为0")
            return 0
        
        try:
            if isinstance(value, str):
                value = re.sub(r'[^\d.-]', '', value)
            quantity = int(float(value))
            if quantity < 0:
                issues.append(f"库存数量为负数: {quantity}")
                quantity = max(0, quantity)
            return quantity
        except (ValueError, TypeError):
            issues.append(f"库存数量格式错误: {value}，默认设为0")
            return 0
    
    def _parse_date(self, value, row_num: int, issues: List[str]) -> date:
        if pd.isna(value):
            issues.append("效期日期为空，设为今天")
            return date.today()
        
        try:
            if isinstance(value, datetime):
                return value.date()
            if isinstance(value, date):
                return value
            
            date_str = str(value).strip()
            
            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%d/%m/%Y', '%Y%m%d', '%Y-%m']:
                try:
                    return datetime.strptime(date_str, fmt).date()
                except ValueError:
                    continue
            
            match = re.search(r'(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})', date_str)
            if match:
                y, m, d = map(int, match.groups())
                return date(y, m, d)
            
            issues.append(f"效期日期格式无法解析: {date_str}，设为今天")
            return date.today()
            
        except Exception as e:
            issues.append(f"效期日期解析错误: {value} - {str(e)}")
            return date.today()
    
    def _parse_freeze_status(self, value, row_num: int, issues: List[str]) -> FreezeStatus:
        if pd.isna(value):
            issues.append("冻结状态为空，默认设为未冻结")
            return FreezeStatus.NOT_FROZEN
        
        status_str = str(value).strip()
        
        if any(status_str == k or status_str.startswith(k) for k in ['未冻结', '否', '正常', 'NOT', 'not', '0']):
            return FreezeStatus.NOT_FROZEN
        elif any(status_str == k or status_str.startswith(k) for k in ['冻结', '是', '已冻结', 'FROZEN', 'frozen', '1']):
            return FreezeStatus.FROZEN
        elif any(status_str == k or status_str.startswith(k) for k in ['待审核', '待确认', 'PENDING', 'pending', '审核中']):
            return FreezeStatus.PENDING
        else:
            issues.append(f"未知冻结状态: {status_str}，默认设为未冻结")
            return FreezeStatus.NOT_FROZEN
