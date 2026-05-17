import pandas as pd
import os
from typing import Dict, List, Optional
from .base_parser import BaseParser, ParsedData, BadRow
from ..utils.constants import REQUIRED_FIELDS


class DataManager:
    def __init__(self):
        self.parser = BaseParser()
        self.residents: pd.DataFrame = pd.DataFrame()
        self.visits: pd.DataFrame = pd.DataFrame()
        self.materials: pd.DataFrame = pd.DataFrame()
        self.bad_rows: List[BadRow] = []
        self.source_files: Dict[str, Dict] = {}

    def load_residents(self, file_path: str, sheet_name: str = None) -> int:
        return self._load_data(file_path, 'resident', sheet_name)

    def load_visits(self, file_path: str, sheet_name: str = None) -> int:
        return self._load_data(file_path, 'visit', sheet_name)

    def load_materials(self, file_path: str, sheet_name: str = None) -> int:
        return self._load_data(file_path, 'material', sheet_name)

    def _load_data(self, file_path: str, data_type: str, sheet_name: str = None) -> int:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        parsed = self.parser.parse(file_path, sheet_name)
        self.source_files[file_path] = parsed.metadata

        if data_type == 'resident':
            required = REQUIRED_FIELDS['resident']
            target_df = self.residents
        elif data_type == 'visit':
            required = REQUIRED_FIELDS['visit']
            target_df = self.visits
        elif data_type == 'material':
            required = REQUIRED_FIELDS['material']
            target_df = self.materials
        else:
            raise ValueError(f"未知数据类型: {data_type}")

        validation_errors = self.parser.validate_required_fields(
            parsed.data, required, file_path, sheet_name or ''
        )
        self.bad_rows.extend(parsed.bad_rows)
        self.bad_rows.extend(validation_errors)

        valid_data = self._filter_valid_rows(parsed.data, required)
        
        if len(target_df) == 0:
            if data_type == 'resident':
                self.residents = valid_data
            elif data_type == 'visit':
                self.visits = valid_data
            elif data_type == 'material':
                self.materials = valid_data
        else:
            if data_type == 'resident':
                self.residents = pd.concat([target_df, valid_data], ignore_index=True)
            elif data_type == 'visit':
                self.visits = pd.concat([target_df, valid_data], ignore_index=True)
            elif data_type == 'material':
                self.materials = pd.concat([target_df, valid_data], ignore_index=True)

        return len(valid_data)

    def _filter_valid_rows(self, df: pd.DataFrame, required_fields: List[str]) -> pd.DataFrame:
        if df.empty:
            return df

        mask = pd.Series([True] * len(df), index=df.index)
        
        for field in required_fields:
            if field in df.columns:
                field_mask = df[field].notna() & (df[field].astype(str).str.strip() != '')
                mask = mask & field_mask
            else:
                return pd.DataFrame()

        return df[mask].reset_index(drop=True)

    def get_resident_by_id(self, id_card: str) -> Optional[pd.Series]:
        if self.residents.empty:
            return None
        
        matches = self.residents[self.residents['身份证号'] == id_card]
        if len(matches) > 0:
            return matches.iloc[0]
        return None

    def get_visits_by_resident(self, id_card: str) -> pd.DataFrame:
        if self.visits.empty:
            return pd.DataFrame()
        return self.visits[self.visits['居民身份证号'] == id_card].copy()

    def get_materials_by_resident(self, id_card: str) -> pd.DataFrame:
        if self.materials.empty:
            return pd.DataFrame()
        return self.materials[self.materials['居民身份证号'] == id_card].copy()

    def get_all_residents(self) -> pd.DataFrame:
        return self.residents.copy()

    def get_all_visits(self) -> pd.DataFrame:
        return self.visits.copy()

    def get_all_materials(self) -> pd.DataFrame:
        return self.materials.copy()

    def get_bad_rows(self) -> List[BadRow]:
        return self.bad_rows

    def get_statistics(self) -> Dict:
        return {
            'total_residents': len(self.residents),
            'total_visits': len(self.visits),
            'total_materials': len(self.materials),
            'total_bad_rows': len(self.bad_rows),
            'source_files': list(self.source_files.keys())
        }

    def clear(self):
        self.residents = pd.DataFrame()
        self.visits = pd.DataFrame()
        self.materials = pd.DataFrame()
        self.bad_rows = []
        self.source_files = {}
