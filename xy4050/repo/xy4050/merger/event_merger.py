from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set, Any
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import DUPLICATE_DETECTION_CONFIG
from merger.time_offset import TimeOffsetManager
from merger.duplicate_detector import DuplicateDetector, DuplicateCandidate


@dataclass
class MergeGroup:
    group_id: int = 0
    events: List = field(default_factory=list)
    unified_time: Optional[datetime] = None
    area_code: str = ""
    event_type_code: str = ""
    risk_level: Any = None
    description: str = ""
    person_count: Optional[int] = None
    photo_numbers: List[str] = field(default_factory=list)
    notes: str = ""
    sources: List[str] = field(default_factory=list)
    confidence: float = 1.0
    is_manual: bool = False
    is_confirmed: bool = False
    review_tags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        def serialize_dt(dt: Optional[datetime]) -> Optional[str]:
            return dt.isoformat() if dt else None
        
        return {
            'group_id': self.group_id,
            'event_count': len(self.events),
            'unified_time': serialize_dt(self.unified_time),
            'area_code': self.area_code,
            'event_type_code': self.event_type_code,
            'risk_level': str(self.risk_level) if self.risk_level else None,
            'description': self.description,
            'person_count': self.person_count,
            'photo_numbers': self.photo_numbers,
            'notes': self.notes,
            'sources': self.sources,
            'confidence': self.confidence,
            'is_manual': self.is_manual,
            'is_confirmed': self.is_confirmed,
            'review_tags': self.review_tags,
        }


@dataclass
class MergeResult:
    total_events: int = 0
    merged_groups: int = 0
    duplicate_candidates: List[DuplicateCandidate] = field(default_factory=list)
    groups: List[MergeGroup] = field(default_factory=list)
    events_by_source: Dict[str, List] = field(default_factory=dict)
    time_offsets: Dict[str, int] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            'total_events': self.total_events,
            'merged_groups': self.merged_groups,
            'duplicate_count': len(self.duplicate_candidates),
            'groups_count': len(self.groups),
            'sources': list(self.events_by_source.keys()),
            'time_offsets': self.time_offsets,
        }


class EventMerger:
    def __init__(
        self,
        time_offset_manager: Optional[TimeOffsetManager] = None,
        duplicate_detector: Optional[DuplicateDetector] = None,
    ):
        self.time_offset_manager = time_offset_manager or TimeOffsetManager()
        self.duplicate_detector = duplicate_detector or DuplicateDetector()
        self._next_group_id = 1
    
    def merge_events(
        self,
        events: List,
        auto_detect_duplicates: bool = True,
        group_by_source: bool = False,
    ) -> MergeResult:
        result = MergeResult()
        result.total_events = len(events)
        
        if not events:
            return result
        
        events_by_source: Dict[str, List] = {}
        for event in events:
            source = getattr(event, 'source', '') or 'UNKNOWN'
            if source not in events_by_source:
                events_by_source[source] = []
            events_by_source[source].append(event)
        
        result.events_by_source = events_by_source
        
        all_offsets = self.time_offset_manager.get_all_offsets()
        result.time_offsets = {k: v.offset_seconds for k, v in all_offsets.items()}
        
        events_with_unified_time = []
        for event in events:
            unified_time = self.time_offset_manager.apply_offset_to_datetime(
                getattr(event, 'original_time', None),
                getattr(event, 'source', '')
            )
            events_with_unified_time.append((event, unified_time))
        
        if auto_detect_duplicates:
            dup_events = [e[0] for e in events_with_unified_time]
            for i, (event, ut) in enumerate(dup_events):
                if hasattr(event, 'metadata'):
                    if not event.metadata:
                        event.metadata = {}
                    event.metadata['unified_time'] = ut
            
            result.duplicate_candidates = self.duplicate_detector.detect_duplicates(dup_events)
        
        groups = self._group_events(events_with_unified_time, result.duplicate_candidates)
        
        merged_event_count = sum(1 for g in groups if len(g.events) > 1)
        result.merged_groups = merged_event_count
        
        result.groups = groups
        
        return result
    
    def _group_events(
        self,
        events_with_time: List[Tuple],
        duplicate_candidates: List[DuplicateCandidate],
    ) -> List[MergeGroup]:
        if not events_with_time:
            return []
        
        event_to_group: Dict[int, int] = {}
        group_to_events: Dict[int, List] = {}
        
        sorted_events = sorted(
            events_with_time,
            key=lambda x: x[1] or datetime.min
        )
        
        event_indices: Dict[int, int] = {}
        for idx, (event, ut) in enumerate(sorted_events):
            event_id = getattr(event, 'id', idx)
            event_indices[event_id] = idx
        
        for candidate in duplicate_candidates:
            id1 = candidate.event_id_1
            id2 = candidate.event_id_2
            
            if id1 is None or id2 is None:
                continue
            
            group1 = event_to_group.get(id1)
            group2 = event_to_group.get(id2)
            
            if group1 is None and group2 is None:
                new_group_id = self._next_group_id
                self._next_group_id += 1
                event_to_group[id1] = new_group_id
                event_to_group[id2] = new_group_id
                group_to_events[new_group_id] = [id1, id2]
            elif group1 is not None and group2 is None:
                event_to_group[id2] = group1
                group_to_events[group1].append(id2)
            elif group1 is None and group2 is not None:
                event_to_group[id1] = group2
                group_to_events[group2].append(id1)
            elif group1 != group2:
                smaller = min(group1, group2)
                larger = max(group1, group2)
                for eid in group_to_events[larger]:
                    event_to_group[eid] = smaller
                group_to_events[smaller].extend(group_to_events[larger])
                del group_to_events[larger]
        
        for idx, (event, ut) in enumerate(sorted_events):
            event_id = getattr(event, 'id', idx)
            if event_id not in event_to_group:
                new_group_id = self._next_group_id
                self._next_group_id += 1
                event_to_group[event_id] = new_group_id
                group_to_events[new_group_id] = [event_id]
        
        groups: List[MergeGroup] = []
        for group_id, event_ids in group_to_events.items():
            group_events = []
            for eid in event_ids:
                if eid in event_indices:
                    event, ut = sorted_events[event_indices[eid]]
                    group_events.append((event, ut))
            
            if not group_events:
                continue
            
            merged = self._merge_group_events(group_events, group_id)
            groups.append(merged)
        
        groups.sort(key=lambda g: g.unified_time or datetime.min)
        
        for idx, g in enumerate(groups):
            g.group_id = idx + 1
        
        return groups
    
    def _merge_group_events(
        self,
        events_with_time: List[Tuple],
        group_id: int,
    ) -> MergeGroup:
        group = MergeGroup(group_id=group_id)
        
        if not events_with_time:
            return group
        
        valid_times = [ut for (e, ut) in events_with_time if ut]
        if valid_times:
            group.unified_time = min(valid_times)
        
        areas: Dict[str, int] = {}
        event_types: Dict[str, int] = {}
        sources: Set[str] = set()
        descriptions: List[str] = []
        person_counts: List[int] = []
        all_photo_numbers: Set[str] = set()
        notes_list: List[str] = []
        risk_levels: List = []
        
        for event, ut in events_with_time:
            group.events.append(event)
            
            area = getattr(event, 'area_code', '') or getattr(event, 'area', '')
            if area:
                areas[area] = areas.get(area, 0) + 1
            
            etype = getattr(event, 'event_type_code', '') or getattr(event, 'event_type', '')
            if etype:
                event_types[etype] = event_types.get(etype, 0) + 1
            
            source = getattr(event, 'source', '')
            if source:
                sources.add(source)
            
            desc = getattr(event, 'description', '')
            if desc:
                descriptions.append(desc)
            
            pcount = getattr(event, 'person_count', None)
            if pcount is not None:
                try:
                    person_counts.append(int(pcount))
                except (ValueError, TypeError):
                    pass
            
            photos = getattr(event, 'photo_numbers', [])
            if photos:
                all_photo_numbers.update(str(p).strip() for p in photos if str(p).strip())
            
            note = getattr(event, 'notes', '')
            if note:
                notes_list.append(note)
            
            rlevel = getattr(event, 'risk_level', None)
            if rlevel is not None:
                risk_levels.append(rlevel)
        
        if areas:
            group.area_code = max(areas.keys(), key=lambda k: areas[k])
        
        if event_types:
            group.event_type_code = max(event_types.keys(), key=lambda k: event_types[k])
        
        group.sources = list(sources)
        
        if descriptions:
            group.description = " | ".join(sorted(set(descriptions)))
        
        if person_counts:
            group.person_count = sum(person_counts)
        
        group.photo_numbers = sorted(all_photo_numbers)
        
        if notes_list:
            group.notes = " | ".join(sorted(set(notes_list)))
        
        if risk_levels:
            try:
                from models.risk_level import RiskLevel
                level_ints = []
                for rl in risk_levels:
                    if isinstance(rl, RiskLevel):
                        level_ints.append(rl.to_int())
                    elif isinstance(rl, str):
                        parsed = RiskLevel.from_string(rl)
                        if parsed:
                            level_ints.append(parsed.to_int())
                if level_ints:
                    max_level = max(level_ints)
                    group.risk_level = RiskLevel.from_int(max_level)
            except ImportError:
                group.risk_level = max(risk_levels) if risk_levels else None
        
        if len(events_with_time) > 1:
            unique_areas = len(areas)
            unique_types = len(event_types)
            if unique_areas == 1 and unique_types == 1:
                group.confidence = 0.9
            else:
                group.confidence = 0.6
        else:
            group.confidence = 1.0
        
        return group
    
    def split_group(
        self,
        group: MergeGroup,
        event_indices_to_split: List[int],
    ) -> Tuple[MergeGroup, MergeGroup]:
        if not group.events:
            return group, MergeGroup()
        
        if len(event_indices_to_split) == 0:
            return group, MergeGroup()
        
        split_events = []
        remaining_events = []
        
        for idx, event in enumerate(group.events):
            if idx in event_indices_to_split:
                split_events.append(event)
            else:
                remaining_events.append(event)
        
        if not remaining_events:
            return group, MergeGroup()
        
        new_group_id = self._next_group_id
        self._next_group_id += 1
        
        split_group = MergeGroup(
            group_id=new_group_id,
            events=split_events,
            is_manual=True,
        )
        
        remaining_group = MergeGroup(
            group_id=group.group_id,
            events=remaining_events,
            is_manual=True,
        )
        
        return remaining_group, split_group
    
    def merge_manual(
        self,
        groups: List[MergeGroup],
    ) -> MergeGroup:
        if not groups:
            return MergeGroup()
        
        if len(groups) == 1:
            return groups[0]
        
        all_events = []
        for g in groups:
            all_events.extend(g.events)
        
        events_with_time = []
        for event in all_events:
            unified_time = self.time_offset_manager.apply_offset_to_datetime(
                getattr(event, 'original_time', None),
                getattr(event, 'source', '')
            )
            events_with_time.append((event, unified_time))
        
        new_group_id = self._next_group_id
        self._next_group_id += 1
        
        merged = self._merge_group_events(events_with_time, new_group_id)
        merged.is_manual = True
        
        return merged
