import pandas as pd
import re
from typing import Dict, List, Any, Set
from difflib import get_close_matches


class DataValidator:
    def __init__(self, species_list: Dict[str, Any], rules: Dict[str, Any]):
        self.species_list = species_list
        self.rules = rules
        self.valid_species = set(species_list.get('valid_species', []))
        self.synonyms = species_list.get('synonyms', {})
        self.invasive_species = set(species_list.get('invasive_species', []))

    def detect_spelling_drift(self, df: pd.DataFrame, species_col: str = 'species_name') -> List[Dict[str, Any]]:
        anomalies = []
        recorded_species = df[species_col].unique()
        for species in recorded_species:
            if species not in self.valid_species and species not in self.synonyms:
                matches = get_close_matches(species, self.valid_species, n=3, cutoff=0.6)
                if matches:
                    anomalies.append({
                        'type': 'spelling_drift',
                        'species': species,
                        'suggestions': matches,
                        'severity': 'medium'
                    })
        return anomalies

    def detect_duplicates(self, df: pd.DataFrame, key_cols: List[str] = None) -> List[Dict[str, Any]]:
        if key_cols is None:
            key_cols = ['quadrat_id', 'species_name']
        duplicates = df.duplicated(subset=key_cols, keep=False)
        anomaly_list = []
        for idx, row in df[duplicates].iterrows():
            anomaly_list.append({
                'type': 'duplicate_record',
                'quadrat_id': row.get('quadrat_id', ''),
                'species_name': row.get('species_name', ''),
                'row_index': idx,
                'severity': 'low'
            })
        return anomaly_list

    def detect_area_inconsistency(self, df: pd.DataFrame, quadrat_col: str = 'quadrat_id', area_col: str = 'area') -> List[Dict[str, Any]]:
        anomalies = []
        quadrat_areas = df.groupby(quadrat_col)[area_col].nunique()
        for quadrat_id, count in quadrat_areas.items():
            if count > 1:
                areas = df[df[quadrat_col] == quadrat_id][area_col].unique()
                anomalies.append({
                    'type': 'area_inconsistency',
                    'quadrat_id': quadrat_id,
                    'areas': list(areas),
                    'severity': 'high'
                })
        return anomalies

    def detect_invasive_concentration(self, df: pd.DataFrame, quadrat_col: str = 'quadrat_id', species_col: str = 'species_name', count_col: str = 'count', threshold: float = None) -> List[Dict[str, Any]]:
        if threshold is None:
            threshold = self.rules.get('invasive_threshold', 0.3)
        anomalies = []
        for quadrat_id, group in df.groupby(quadrat_col):
            total_individuals = group[count_col].sum()
            if total_individuals == 0:
                continue
            invasive_individuals = group[group[species_col].isin(self.invasive_species)][count_col].sum()
            ratio = invasive_individuals / total_individuals
            if ratio >= threshold:
                anomalies.append({
                    'type': 'invasive_concentration',
                    'quadrat_id': quadrat_id,
                    'invasive_ratio': ratio,
                    'invasive_count': int(invasive_individuals),
                    'total_count': int(total_individuals),
                    'severity': 'medium'
                })
        return anomalies

    def detect_missing_coordinates(self, df: pd.DataFrame, lat_col: str = 'latitude', lng_col: str = 'longitude', quadrat_col: str = 'quadrat_id') -> List[Dict[str, Any]]:
        anomalies = []
        quadrat_coords = df.groupby(quadrat_col).agg({
            lat_col: lambda x: x.isna().all(),
            lng_col: lambda x: x.isna().all()
        })
        for quadrat_id, (lat_missing, lng_missing) in quadrat_coords.iterrows():
            if lat_missing or lng_missing:
                anomalies.append({
                    'type': 'missing_coordinates',
                    'quadrat_id': quadrat_id,
                    'severity': 'high'
                })
        return anomalies

    def validate_all(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        all_anomalies = []
        all_anomalies.extend(self.detect_spelling_drift(df))
        all_anomalies.extend(self.detect_duplicates(df))
        all_anomalies.extend(self.detect_area_inconsistency(df))
        all_anomalies.extend(self.detect_invasive_concentration(df))
        all_anomalies.extend(self.detect_missing_coordinates(df))
        return all_anomalies
