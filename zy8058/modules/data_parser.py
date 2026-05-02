import csv
import json
import yaml
import pandas as pd
from pathlib import Path
from typing import Dict, List, Any, Optional


class DataParser:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)

    def load_quadrat_csv(self, filename: str) -> pd.DataFrame:
        file_path = self.data_dir / filename
        df = pd.read_csv(file_path)
        df = self._clean_dataframe(df)
        return df

    def load_species_json(self, filename: str) -> Dict[str, Any]:
        file_path = self.data_dir / filename
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def load_quadrat_geojson(self, filename: str) -> Dict[str, Any]:
        file_path = self.data_dir / filename
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def load_rules_yaml(self, filename: str) -> Dict[str, Any]:
        file_path = self.data_dir / filename
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def _clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df.columns = [col.strip() for col in df.columns]
        return df

    def normalize_species_name(self, name: str, synonyms: Dict[str, str]) -> str:
        name = name.strip()
        if name in synonyms:
            return synonyms[name]
        return name

    def validate_coordinates(self, df: pd.DataFrame, lat_col: str = 'latitude', lng_col: str = 'longitude') -> pd.DataFrame:
        df = df.copy()
        df['has_valid_coords'] = (~df[lat_col].isna()) & (~df[lng_col].isna()) & (df[lat_col].between(-90, 90)) & (df[lng_col].between(-180, 180))
        return df
