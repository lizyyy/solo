from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set
from pathlib import Path
import difflib
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import DUPLICATE_DETECTION_CONFIG


@dataclass
class DuplicateCandidate:
    event_id_1: Optional[int] = None
    event_id_2: Optional[int] = None
    event_1: Dict = field(default_factory=dict)
    event_2: Dict = field(default_factory=dict)
    similarity_score: float = 0.0
    time_difference_seconds: float = 0.0
    area_match: bool = False
    event_type_match: bool = False
    description_similarity: float = 0.0
    is_manual: bool = False
    notes: str = ""
    
    def to_dict(self) -> Dict:
        return {
            'event_id_1': self.event_id_1,
            'event_id_2': self.event_id_2,
            'event_1': self.event_1,
            'event_2': self.event_2,
            'similarity_score': self.similarity_score,
            'time_difference_seconds': self.time_difference_seconds,
            'area_match': self.area_match,
            'event_type_match': self.event_type_match,
            'description_similarity': self.description_similarity,
            'is_manual': self.is_manual,
            'notes': self.notes,
        }


class DuplicateDetector:
    def __init__(
        self,
        time_threshold_seconds: int = None,
        area_match_required: bool = None,
        event_type_match_required: bool = None,
        description_similarity_threshold: float = None,
    ):
        config = DUPLICATE_DETECTION_CONFIG
        self.time_threshold_seconds = time_threshold_seconds or config.get('time_threshold_seconds', 30)
        self.area_match_required = area_match_required if area_match_required is not None else config.get('area_match_required', True)
        self.event_type_match_required = event_type_match_required if event_type_match_required is not None else config.get('event_type_match_required', True)
        self.description_similarity_threshold = description_similarity_threshold or config.get('description_similarity_threshold', 0.7)
    
    def calculate_description_similarity(self, desc1: str, desc2: str) -> float:
        if not desc1 or not desc2:
            return 0.0
        
        desc1 = str(desc1).strip().lower()
        desc2 = str(desc2).strip().lower()
        
        if desc1 == desc2:
            return 1.0
        
        return difflib.SequenceMatcher(None, desc1, desc2).ratio()
    
    def get_event_time(self, event) -> Optional[datetime]:
        if hasattr(event, 'unified_time') and event.unified_time:
            return event.unified_time
        if hasattr(event, 'original_time') and event.original_time:
            return event.original_time
        return None
    
    def get_event_area(self, event) -> str:
        return getattr(event, 'area_code', '') or getattr(event, 'area', '') or ''
    
    def get_event_type(self, event) -> str:
        return getattr(event, 'event_type_code', '') or getattr(event, 'event_type', '') or ''
    
    def get_event_description(self, event) -> str:
        return getattr(event, 'description', '') or ''
    
    def get_event_id(self, event) -> Optional[int]:
        return getattr(event, 'id', None)
    
    def get_event_source(self, event) -> str:
        return getattr(event, 'source', '') or ''
    
    def are_similar(
        self,
        event1,
        event2,
    ) -> Tuple[bool, DuplicateCandidate]:
        time1 = self.get_event_time(event1)
        time2 = self.get_event_time(event2)
        
        candidate = DuplicateCandidate(
            event_id_1=self.get_event_id(event1),
            event_id_2=self.get_event_id(event2),
            event_1={
                'source': self.get_event_source(event1),
                'area': self.get_event_area(event1),
                'event_type': self.get_event_type(event1),
                'description': self.get_event_description(event1),
            },
            event_2={
                'source': self.get_event_source(event2),
                'area': self.get_event_area(event2),
                'event_type': self.get_event_type(event2),
                'description': self.get_event_description(event2),
            },
        )
        
        if time1 and time2:
            candidate.time_difference_seconds = abs((time1 - time2).total_seconds())
        else:
            candidate.time_difference_seconds = float('inf')
        
        area1 = self.get_event_area(event1)
        area2 = self.get_event_area(event2)
        candidate.area_match = (area1 == area2) if area1 and area2 else False
        
        type1 = self.get_event_type(event1)
        type2 = self.get_event_type(event2)
        candidate.event_type_match = (type1 == type2) if type1 and type2 else False
        
        desc1 = self.get_event_description(event1)
        desc2 = self.get_event_description(event2)
        candidate.description_similarity = self.calculate_description_similarity(desc1, desc2)
        
        score_components = []
        
        if candidate.time_difference_seconds <= self.time_threshold_seconds:
            time_score = 1.0 - (candidate.time_difference_seconds / self.time_threshold_seconds)
            score_components.append(time_score * 0.4)
        else:
            score_components.append(0.0)
        
        if self.area_match_required:
            if candidate.area_match:
                score_components.append(0.2)
            else:
                return False, candidate
        else:
            area_score = 0.2 if candidate.area_match else 0.1
            score_components.append(area_score)
        
        if self.event_type_match_required:
            if candidate.event_type_match:
                score_components.append(0.2)
            else:
                return False, candidate
        else:
            type_score = 0.2 if candidate.event_type_match else 0.05
            score_components.append(type_score)
        
        if candidate.description_similarity >= self.description_similarity_threshold:
            score_components.append(candidate.description_similarity * 0.2)
        else:
            desc_score = candidate.description_similarity * 0.15
            score_components.append(desc_score)
        
        candidate.similarity_score = sum(score_components)
        
        is_duplicate = (
            candidate.similarity_score >= 0.6 and
            candidate.time_difference_seconds <= self.time_threshold_seconds
        )
        
        return is_duplicate, candidate
    
    def detect_duplicates(
        self,
        events: List,
        group_by_area: bool = True,
        group_by_event_type: bool = True,
    ) -> List[DuplicateCandidate]:
        if len(events) < 2:
            return []
        
        candidates: List[DuplicateCandidate] = []
        
        groups: Dict[str, List] = {}
        if group_by_area and group_by_event_type:
            for event in events:
                key = f"{self.get_event_area(event)}|{self.get_event_type(event)}"
                if key not in groups:
                    groups[key] = []
                groups[key].append(event)
        elif group_by_area:
            for event in events:
                key = self.get_event_area(event)
                if key not in groups:
                    groups[key] = []
                groups[key].append(event)
        elif group_by_event_type:
            for event in events:
                key = self.get_event_type(event)
                if key not in groups:
                    groups[key] = []
                groups[key].append(event)
        else:
            groups['all'] = events
        
        for group_events in groups.values():
            if len(group_events) < 2:
                continue
            
            sorted_events = sorted(
                group_events,
                key=lambda e: self.get_event_time(e) or datetime.min
            )
            
            for i in range(len(sorted_events)):
                for j in range(i + 1, len(sorted_events)):
                    event1 = sorted_events[i]
                    event2 = sorted_events[j]
                    
                    time1 = self.get_event_time(event1)
                    time2 = self.get_event_time(event2)
                    if time1 and time2:
                        time_diff = (time2 - time1).total_seconds()
                        if time_diff > self.time_threshold_seconds:
                            break
                    
                    is_dup, candidate = self.are_similar(event1, event2)
                    if is_dup:
                        candidates.append(candidate)
        
        candidates.sort(key=lambda c: c.similarity_score, reverse=True)
        
        return candidates
    
    def find_potential_duplicates_for_event(
        self,
        target_event,
        other_events: List,
    ) -> List[DuplicateCandidate]:
        candidates = []
        
        for other_event in other_events:
            if self.get_event_id(target_event) == self.get_event_id(other_event):
                continue
            
            is_dup, candidate = self.are_similar(target_event, other_event)
            if is_dup:
                candidates.append(candidate)
        
        candidates.sort(key=lambda c: c.similarity_score, reverse=True)
        
        return candidates
