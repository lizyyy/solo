import os
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from validator import FieldValidator, ValidationError


class FileParser:
    @staticmethod
    def is_csv_file(file_path: str) -> bool:
        return file_path.lower().endswith('.csv')

    @staticmethod
    def is_excel_file(file_path: str) -> bool:
        return file_path.lower().endswith(('.xlsx', '.xls'))

    @staticmethod
    def read_file(file_path: str) -> pd.DataFrame:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f'文件不存在: {file_path}')

        if FileParser.is_csv_file(file_path):
            try:
                df = pd.read_csv(file_path, encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding='gbk')
        elif FileParser.is_excel_file(file_path):
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f'不支持的文件格式: {os.path.splitext(file_path)[1]}')

        return df

    @staticmethod
    def data_to_rows(df: pd.DataFrame) -> List[Dict[str, Any]]:
        rows = []
        for _, row in df.iterrows():
            row_dict = {}
            for col in df.columns:
                value = row[col]
                if pd.isna(value):
                    row_dict[col] = None
                else:
                    row_dict[col] = value
            rows.append(row_dict)
        return rows

    @staticmethod
    def parse_and_validate(file_path: str, check_db_duplicate: bool = True) -> Dict[str, Any]:
        df = FileParser.read_file(file_path)
        rows = FileParser.data_to_rows(df)

        validation_results = {
            'total_rows': len(rows),
            'valid_rows': [],
            'invalid_rows': [],
            'product_codes_in_file': set()
        }

        for index, row in enumerate(rows):
            row_number = index + 2

            normalized_row = FieldValidator.normalize_fields(row)
            parsed_row = FieldValidator.parse_row(row)

            product_code = parsed_row.get('product_code')

            is_valid, errors = FieldValidator.validate_row(
                row,
                existing_codes_in_file=validation_results['product_codes_in_file'],
                check_db_duplicate=check_db_duplicate
            )

            if is_valid:
                if product_code:
                    validation_results['product_codes_in_file'].add(str(product_code).strip())
                validation_results['valid_rows'].append({
                    'row_number': row_number,
                    'original_data': row,
                    'parsed_data': parsed_row
                })
            else:
                for error in errors:
                    validation_results['invalid_rows'].append({
                        'row_number': row_number,
                        'original_data': row,
                        'parsed_data': parsed_row,
                        'error': error.to_dict()
                    })

        return validation_results

    @staticmethod
    def get_file_info(file_path: str) -> Dict[str, Any]:
        df = FileParser.read_file(file_path)
        rows = FileParser.data_to_rows(df)

        return {
            'file_name': os.path.basename(file_path),
            'file_path': file_path,
            'total_rows': len(rows),
            'columns': list(df.columns)
        }
