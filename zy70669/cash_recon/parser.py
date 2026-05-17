import pandas as pd
from pathlib import Path
from typing import Tuple, List, Dict, Any, Optional
from dataclasses import dataclass
import re


@dataclass
class BadRow:
    file_name: str
    sheet_name: Optional[str]
    row_number: int
    original_data: Dict[str, Any]
    error: str


@dataclass
class ParsedResult:
    valid_data: pd.DataFrame
    bad_rows: List[BadRow]
    file_name: str
    sheet_name: Optional[str] = None


class TableParser:
    def __init__(self, required_columns: List[str]):
        self.required_columns = required_columns
        self.numeric_columns = ["账面金额", "盘点金额", "备用金余额"]

    def parse_file(self, file_path: str, sheet_name: Optional[str] = None) -> ParsedResult:
        path = Path(file_path)
        suffix = path.suffix.lower()

        if suffix in ['.xlsx', '.xls']:
            return self._parse_excel(path, sheet_name)
        elif suffix == '.csv':
            return self._parse_csv(path)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _parse_excel(self, path: Path, sheet_name: Optional[str] = None) -> ParsedResult:
        bad_rows: List[BadRow] = []
        all_data: List[Dict[str, Any]] = []
        
        excel_file = pd.ExcelFile(path)
        sheets = [sheet_name] if sheet_name else excel_file.sheet_names
        
        for sheet in sheets:
            df = pd.read_excel(excel_file, sheet_name=sheet, dtype=str)
            df.columns = df.columns.str.strip()
            valid_rows, bad = self._process_dataframe(df, path.name, sheet)
            all_data.extend(valid_rows)
            bad_rows.extend(bad)
        
        valid_df = pd.DataFrame(all_data)
        if not valid_df.empty:
            valid_df = self._convert_numeric_columns(valid_df)
            
        return ParsedResult(
            valid_data=valid_df,
            bad_rows=bad_rows,
            file_name=path.name,
            sheet_name=sheet_name
        )

    def _parse_csv(self, path: Path) -> ParsedResult:
        df = pd.read_csv(path, dtype=str, encoding='utf-8-sig')
        df.columns = df.columns.str.strip()
        
        valid_rows, bad_rows = self._process_dataframe(df, path.name, None)
        
        valid_df = pd.DataFrame(valid_rows)
        if not valid_df.empty:
            valid_df = self._convert_numeric_columns(valid_df)
            
        return ParsedResult(
            valid_data=valid_df,
            bad_rows=bad_rows,
            file_name=path.name
        )

    def _process_dataframe(
        self, 
        df: pd.DataFrame, 
        file_name: str, 
        sheet_name: Optional[str]
    ) -> Tuple[List[Dict[str, Any]], List[BadRow]]:
        valid_rows: List[Dict[str, Any]] = []
        bad_rows: List[BadRow] = []
        
        col_mapping = self._normalize_columns(df.columns.tolist())
        missing_cols = [c for c in self.required_columns if c not in col_mapping.values()]
        
        for idx, row in df.iterrows():
            original_row = row.to_dict()
            original_row_number = idx + 2
            
            try:
                normalized_row = {}
                for orig_col, norm_col in col_mapping.items():
                    value = str(row.get(orig_col, '')).strip()
                    normalized_row[norm_col] = value
                
                if missing_cols:
                    raise ValueError(f"缺少必要列: {', '.join(missing_cols)}")
                
                for col in self.numeric_columns:
                    if normalized_row.get(col):
                        normalized_row[col] = self._parse_amount(normalized_row[col])
                
                normalized_row['_original_row'] = original_row_number
                normalized_row['_source_file'] = file_name
                if sheet_name:
                    normalized_row['_source_sheet'] = sheet_name
                    
                valid_rows.append(normalized_row)
                
            except Exception as e:
                bad_rows.append(BadRow(
                    file_name=file_name,
                    sheet_name=sheet_name,
                    row_number=original_row_number,
                    original_data=original_row,
                    error=str(e)
                ))
        
        return valid_rows, bad_rows

    def _normalize_columns(self, columns: List[str]) -> Dict[str, str]:
        mapping = {}
        patterns = {
            '网点编号': r'网点编号|网点ID|门店编号|店号',
            '网点名称': r'网点名称|门店名称|店名',
            '日期': r'日期|盘点日期|业务日期',
            '账面金额': r'账面金额|账面余额|系统金额',
            '盘点金额': r'盘点金额|实盘金额|现金金额',
            '备用金余额': r'备用金余额|备用金|周转金',
            '备注': r'备注|说明|原因'
        }
        
        for col in columns:
            col_clean = str(col).strip()
            matched = False
            for norm_col, pattern in patterns.items():
                if re.search(pattern, col_clean, re.IGNORECASE):
                    mapping[col_clean] = norm_col
                    matched = True
                    break
            if not matched:
                mapping[col_clean] = col_clean
                
        return mapping

    def _parse_amount(self, value: str) -> float:
        if not value or pd.isna(value):
            return 0.0
        cleaned = re.sub(r'[^\d.-]', '', str(value))
        return float(cleaned) if cleaned else 0.0

    def _convert_numeric_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        for col in self.numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
        return df
