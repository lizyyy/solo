import pandas as pd
from pathlib import Path
from typing import Dict, List, Any, Tuple


class DataParser:
    def __init__(self, phone_col: str, consultant_col: str, 
                 channel_col: str, status_col: str):
        self.phone_col = phone_col
        self.consultant_col = consultant_col
        self.channel_col = channel_col
        self.status_col = status_col

    def _detect_format(self, filepath: str) -> str:
        suffix = Path(filepath).suffix.lower()
        if suffix in ['.xlsx', '.xls']:
            return 'excel'
        elif suffix == '.csv':
            return 'csv'
        raise ValueError(f"不支持的文件格式: {suffix}")

    def _read_file(self, filepath: str, sheet_name: str = None) -> Tuple[pd.DataFrame, List[Dict]]:
        file_format = self._detect_format(filepath)
        invalid_rows = []

        if file_format == 'excel':
            df = pd.read_excel(filepath, sheet_name=sheet_name, dtype=str)
            if isinstance(df, dict):
                df = list(df.values())[0]
        else:
            try:
                df = pd.read_csv(filepath, dtype=str, encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(filepath, dtype=str, encoding='gbk')

        df = df.reset_index(drop=True)
        df['_source_row'] = df.index + 2
        df['_source_file'] = str(filepath)

        for idx, row in df.iterrows():
            row_errors = self._validate_row(row, filepath)
            if row_errors:
                invalid_rows.append({
                    'source_file': filepath,
                    'source_row': idx + 2,
                    'original_data': row.to_dict(),
                    'errors': row_errors
                })

        return df, invalid_rows

    def _validate_row(self, row: pd.Series, filepath: str) -> List[str]:
        errors = []
        if self.phone_col not in row or pd.isna(row[self.phone_col]) or str(row[self.phone_col]).strip() == '':
            errors.append('客户电话为空')
        return errors

    def parse_visit(self, filepath: str, sheet_name: str = None) -> Dict[str, Any]:
        df, invalid_rows = self._read_file(filepath, sheet_name)
        
        valid_rows = []
        for idx, row in df.iterrows():
            if self.phone_col in row and not pd.isna(row[self.phone_col]) and str(row[self.phone_col]).strip() != '':
                row_dict = row.to_dict()
                row_dict['_source_type'] = 'visit'
                valid_rows.append(row_dict)

        return {
            'valid': valid_rows,
            'invalid': invalid_rows,
            'columns': df.columns.tolist()
        }

    def parse_channel(self, filepath: str, sheet_name: str = None) -> Dict[str, Any]:
        df, invalid_rows = self._read_file(filepath, sheet_name)
        
        valid_rows = []
        for idx, row in df.iterrows():
            if self.phone_col in row and not pd.isna(row[self.phone_col]) and str(row[self.phone_col]).strip() != '':
                row_dict = row.to_dict()
                row_dict['_source_type'] = 'channel'
                valid_rows.append(row_dict)

        return {
            'valid': valid_rows,
            'invalid': invalid_rows,
            'columns': df.columns.tolist()
        }
