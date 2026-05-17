import pandas as pd
import os
from typing import Dict, List, Tuple, Any
from dataclasses import dataclass, field


@dataclass
class BadRow:
    file_path: str
    sheet_name: str
    row_number: int
    raw_data: str
    error_type: str
    error_message: str


@dataclass
class ParsedData:
    data: pd.DataFrame
    bad_rows: List[BadRow] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseParser:
    def __init__(self):
        self.supported_extensions = ['.xlsx', '.xls', '.csv']

    def parse(self, file_path: str, sheet_name: str = None) -> ParsedData:
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in ['.xlsx', '.xls']:
            return self._parse_excel(file_path, sheet_name)
        elif ext == '.csv':
            return self._parse_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def _parse_excel(self, file_path: str, sheet_name: str = None) -> ParsedData:
        bad_rows = []
        all_data = []
        metadata = {
            'file_path': file_path,
            'file_type': 'excel',
            'sheets': []
        }

        xl = pd.ExcelFile(file_path)
        sheets_to_parse = sheet_name.split(',') if sheet_name else xl.sheet_names

        for sheet in sheets_to_parse:
            sheet = sheet.strip()
            if sheet not in xl.sheet_names:
                continue
                
            metadata['sheets'].append(sheet)
            
            try:
                df = pd.read_excel(file_path, sheet_name=sheet, dtype=str, keep_default_na=False)
                df = self._normalize_columns(df)
                
                for idx, row in df.iterrows():
                    row_data = row.to_dict()
                    row_data['_source_file'] = file_path
                    row_data['_sheet_name'] = sheet
                    row_data['_row_number'] = idx + 2
                    all_data.append(row_data)
                    
            except Exception as e:
                bad_rows.append(BadRow(
                    file_path=file_path,
                    sheet_name=sheet,
                    row_number=0,
                    raw_data=str(e),
                    error_type='sheet_parse_error',
                    error_message=f"工作表解析失败: {str(e)}"
                ))

        result_df = pd.DataFrame(all_data) if all_data else pd.DataFrame()
        
        return ParsedData(
            data=result_df,
            bad_rows=bad_rows,
            metadata=metadata
        )

    def _parse_csv(self, file_path: str) -> ParsedData:
        bad_rows = []
        metadata = {
            'file_path': file_path,
            'file_type': 'csv'
        }

        try:
            df = pd.read_csv(file_path, dtype=str, keep_default_na=False, on_bad_lines='warn')
            df = self._normalize_columns(df)
            
            all_data = []
            for idx, row in df.iterrows():
                row_data = row.to_dict()
                row_data['_source_file'] = file_path
                row_data['_sheet_name'] = ''
                row_data['_row_number'] = idx + 2
                all_data.append(row_data)
                
            result_df = pd.DataFrame(all_data)
            
        except Exception as e:
            bad_rows.append(BadRow(
                file_path=file_path,
                sheet_name='',
                row_number=0,
                raw_data=str(e),
                error_type='file_parse_error',
                error_message=f"CSV解析失败: {str(e)}"
            ))
            result_df = pd.DataFrame()

        return ParsedData(
            data=result_df,
            bad_rows=bad_rows,
            metadata=metadata
        )

    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        df.columns = [str(col).strip() for col in df.columns]
        return df

    def validate_required_fields(self, df: pd.DataFrame, required_fields: List[str], 
                                 file_path: str, sheet_name: str = '') -> List[BadRow]:
        bad_rows = []
        
        for idx, row in df.iterrows():
            missing_fields = []
            for field in required_fields:
                if field not in df.columns or pd.isna(row.get(field)) or str(row.get(field, '')).strip() == '':
                    missing_fields.append(field)
            
            if missing_fields:
                bad_rows.append(BadRow(
                    file_path=file_path,
                    sheet_name=sheet_name,
                    row_number=row.get('_row_number', idx + 2),
                    raw_data=str(row.to_dict()),
                    error_type='missing_fields',
                    error_message=f"缺少必填字段: {', '.join(missing_fields)}"
                ))
        
        return bad_rows
