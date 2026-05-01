import math
import pandas as pd
from typing import Dict, List, Tuple
from collections import Counter


class DiversityMetrics:
    @staticmethod
    def shannon_index(counts: List[int]) -> float:
        total = sum(counts)
        if total == 0:
            return 0.0
        shannon = 0.0
        for count in counts:
            if count > 0:
                p = count / total
                shannon -= p * math.log(p)
        return shannon

    @staticmethod
    def simpson_index(counts: List[int]) -> float:
        total = sum(counts)
        if total == 0:
            return 0.0
        simpson = 0.0
        for count in counts:
            p = count / total
            simpson += p * p
        return 1 - simpson

    @staticmethod
    def calculate_quadrat_diversity(df: pd.DataFrame, quadrat_col: str = 'quadrat_id', species_col: str = 'species_name', count_col: str = 'count') -> pd.DataFrame:
        results = []
        for quadrat_id, group in df.groupby(quadrat_col):
            species_counts = group.groupby(species_col)[count_col].sum().tolist()
            shannon = DiversityMetrics.shannon_index(species_counts)
            simpson = DiversityMetrics.simpson_index(species_counts)
            richness = len(species_counts)
            total_individuals = sum(species_counts)
            results.append({
                quadrat_col: quadrat_id,
                'shannon': shannon,
                'simpson': simpson,
                'species_richness': richness,
                'total_individuals': total_individuals
            })
        return pd.DataFrame(results)

    @staticmethod
    def calculate_site_diversity(df: pd.DataFrame, site_col: str = 'site_id', quadrat_col: str = 'quadrat_id', species_col: str = 'species_name', count_col: str = 'count') -> pd.DataFrame:
        results = []
        for site_id, site_group in df.groupby(site_col):
            species_counts = site_group.groupby(species_col)[count_col].sum().tolist()
            shannon = DiversityMetrics.shannon_index(species_counts)
            simpson = DiversityMetrics.simpson_index(species_counts)
            richness = len(species_counts)
            quadrat_count = site_group[quadrat_col].nunique()
            results.append({
                site_col: site_id,
                'shannon': shannon,
                'simpson': simpson,
                'species_richness': richness,
                'quadrat_count': quadrat_count
            })
        return pd.DataFrame(results)
