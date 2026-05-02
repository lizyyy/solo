import yaml
from dataclasses import dataclass
from typing import List, Dict


@dataclass
class Segment:
    id: str
    name: str
    order: int
    from_mat: str
    to_mat: str


@dataclass
class Cutoff:
    segment_id: str
    time_limit: str
    mat: str


@dataclass
class RaceRules:
    race_name: str
    start_mat: str
    end_mat: str
    segments: List[Segment]
    cutoffs: List[Cutoff]
    mat_alias: Dict[str, str] = None
    cross_day: bool = False


def parse_rules_yaml(file_path: str) -> RaceRules:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    segments = []
    for seg_data in data.get('segments', []):
        segments.append(Segment(**seg_data))
    
    cutoffs = []
    for co_data in data.get('cutoffs', []):
        cutoffs.append(Cutoff(**co_data))
    
    return RaceRules(
        race_name=data['race_name'],
        start_mat=data['start_mat'],
        end_mat=data['end_mat'],
        segments=segments,
        cutoffs=cutoffs,
        mat_alias=data.get('mat_alias', {}),
        cross_day=data.get('cross_day', False)
    )
