import pandas as pd
import os
from typing import Dict, List, Optional, Any
import re


class TableReader:
    SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv']
    
    COLUMN_MAPPINGS = {
        '供应商': ['供应商', '供应商名称', '供方', 'vendor', 'supplier', '公司名称'],
        '报价': ['报价', '单价', '价格', '总价', 'amount', 'price', '报价金额'],
        '税率': ['税率', 'tax', 'tax_rate', '增值税率', '税点'],
        '交期': ['交期', '交货期', 'delivery', 'lead_time', '交付时间', '到货时间'],
        '采购品类': ['采购品类', '品类', '物料类别', 'category', '产品类型', '物料名称'],
        '附件来源': ['附件来源', '来源', '邮件', 'email', '文件名称', 'filename'],
    }
    
    def __init__(self):
        self.raw_data = None
        self.normalized_data = None
        self.warnings = []
    
    def read_file(self, file_path: str) -> pd.DataFrame:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"不支持的文件格式: {ext}，支持格式: {self.SUPPORTED_EXTENSIONS}")
        
        try:
            if ext in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path, dtype=str)
            else:
                df = pd.read_csv(file_path, dtype=str, encoding_errors='ignore')
            
            self.raw_data = df
            self.warnings.append(f"成功读取文件，原始数据: {len(df)}行 x {len(df.columns)}列")
            return df
        except Exception as e:
            raise RuntimeError(f"读取文件失败: {str(e)}")
    
    def normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        normalized = pd.DataFrame()
        column_matches = {}
        
        for std_col, possible_names in self.COLUMN_MAPPINGS.items():
            matched = None
            for col in df.columns:
                col_lower = str(col).lower().strip()
                for name in possible_names:
                    if name.lower() in col_lower or col_lower in name.lower():
                        matched = col
                        break
                if matched:
                    break
            
            if matched:
                column_matches[std_col] = matched
                normalized[std_col] = df[matched]
            else:
                self.warnings.append(f"未找到匹配的列: {std_col}")
                normalized[std_col] = None
        
        normalized['原始行号'] = df.index + 2
        return normalized
    
    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        cleaned = df.copy()
        
        for col in ['报价', '税率']:
            if col in cleaned.columns:
                cleaned[col] = cleaned[col].apply(self._clean_numeric)
        
        if '交期' in cleaned.columns:
            cleaned['交期'] = cleaned['交期'].apply(self._clean_date)
        
        for col in ['供应商', '采购品类', '附件来源']:
            if col in cleaned.columns:
                cleaned[col] = cleaned[col].astype(str).str.strip()
                cleaned[col] = cleaned[col].replace({'nan': None, 'None': None})
        
        return cleaned
    
    def _clean_numeric(self, value: Any) -> Optional[float]:
        if pd.isna(value) or value is None:
            return None
        
        s = str(value).strip()
        s = re.sub(r'[^\d.-]', '', s)
        
        if not s or s == '.':
            return None
        
        try:
            return float(s)
        except (ValueError, TypeError):
            return None
    
    def _clean_date(self, value: Any) -> Optional[str]:
        if pd.isna(value) or value is None:
            return None
        
        s = str(value).strip()
        
        date_patterns = [
            r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})',
            r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})',
            r'(\d{8})',
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, s)
            if match:
                date_str = match.group(1)
                try:
                    if len(date_str) == 8:
                        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
                    date_str = date_str.replace('/', '-')
                    parts = date_str.split('-')
                    if len(parts[0]) == 4:
                        return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                    else:
                        return f"{parts[2]}-{parts[0].zfill(2)}-{parts[1].zfill(2)}"
                except:
                    pass
        
        days_match = re.search(r'(\d+)\s*(天|日|day)', s.lower())
        if days_match:
            return f"_{days_match.group(1)}days"
        
        return s if s else None
    
    def process(self, file_path: str) -> Dict[str, Any]:
        df = self.read_file(file_path)
        normalized = self.normalize_columns(df)
        cleaned = self.clean_data(normalized)
        self.normalized_data = cleaned
        
        return {
            'raw_rows': len(df),
            'cleaned_rows': len(cleaned),
            'columns': list(cleaned.columns),
            'data': cleaned.to_dict('records'),
            'warnings': self.warnings,
        }
