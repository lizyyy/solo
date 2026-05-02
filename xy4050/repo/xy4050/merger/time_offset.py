from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import DUPLICATE_DETECTION_CONFIG


@dataclass
class SourceOffset:
    source_name: str = ""
    offset_seconds: int = 0
    is_manual: bool = False
    confidence: float = 1.0
    anchor_event_id: Optional[int] = None
    notes: str = ""
    
    def to_dict(self) -> Dict:
        return {
            'source_name': self.source_name,
            'offset_seconds': self.offset_seconds,
            'is_manual': self.is_manual,
            'confidence': self.confidence,
            'anchor_event_id': self.anchor_event_id,
            'notes': self.notes,
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'SourceOffset':
        return cls(
            source_name=data.get('source_name', ''),
            offset_seconds=data.get('offset_seconds', 0),
            is_manual=data.get('is_manual', False),
            confidence=data.get('confidence', 1.0),
            anchor_event_id=data.get('anchor_event_id'),
            notes=data.get('notes', ''),
        )


class TimeOffsetManager:
    def __init__(self):
        self._offsets: Dict[str, SourceOffset] = {}
        self._reference_source: Optional[str] = None
    
    def set_reference_source(self, source_name: str):
        self._reference_source = source_name
        if source_name not in self._offsets:
            self._offsets[source_name] = SourceOffset(
                source_name=source_name,
                offset_seconds=0,
                is_manual=False,
                confidence=1.0,
            )
    
    def get_reference_source(self) -> Optional[str]:
        return self._reference_source
    
    def set_offset(
        self,
        source_name: str,
        offset_seconds: int,
        is_manual: bool = True,
        confidence: float = 1.0,
        anchor_event_id: Optional[int] = None,
        notes: str = "",
    ):
        self._offsets[source_name] = SourceOffset(
            source_name=source_name,
            offset_seconds=offset_seconds,
            is_manual=is_manual,
            confidence=confidence,
            anchor_event_id=anchor_event_id,
            notes=notes,
        )
    
    def get_offset(self, source_name: str) -> int:
        if source_name == self._reference_source:
            return 0
        if source_name in self._offsets:
            return self._offsets[source_name].offset_seconds
        return 0
    
    def get_offset_info(self, source_name: str) -> Optional[SourceOffset]:
        if source_name in self._offsets:
            return self._offsets[source_name]
        return None
    
    def get_all_offsets(self) -> Dict[str, SourceOffset]:
        return self._offsets.copy()
    
    def estimate_offset_by_anchor_events(
        self,
        events_by_source: Dict[str, List],
        anchor_event_type_codes: List[str],
        area_match: bool = True,
    ) -> Dict[str, SourceOffset]:
        if not anchor_event_type_codes:
            return {}
        
        anchor_events: Dict[str, List] = {}
        for source, events in events_by_source.items():
            anchor_events[source] = [
                e for e in events 
                if hasattr(e, 'event_type_code') and e.event_type_code in anchor_event_type_codes
            ]
        
        if not self._reference_source or self._reference_source not in anchor_events:
            for source in anchor_events:
                if anchor_events[source]:
                    self._reference_source = source
                    break
        
        if not self._reference_source:
            return {}
        
        reference_anchors = anchor_events.get(self._reference_source, [])
        if not reference_anchors:
            return {}
        
        results: Dict[str, SourceOffset] = {}
        
        for source, anchors in anchor_events.items():
            if source == self._reference_source:
                continue
            
            if not anchors:
                continue
            
            offsets = []
            for ref_anchor in reference_anchors:
                for anchor in anchors:
                    if area_match:
                        ref_area = getattr(ref_anchor, 'area_code', '')
                        anchor_area = getattr(anchor, 'area_code', '')
                        if ref_area != anchor_area:
                            continue
                    
                    ref_time = getattr(ref_anchor, 'original_time', None)
                    anchor_time = getattr(anchor, 'original_time', None)
                    
                    if ref_time and anchor_time:
                        offset = int((ref_time - anchor_time).total_seconds())
                        offsets.append(offset)
            
            if offsets:
                offsets.sort()
                median_offset = offsets[len(offsets) // 2]
                confidence = min(1.0, len(offsets) / 3.0)
                
                results[source] = SourceOffset(
                    source_name=source,
                    offset_seconds=median_offset,
                    is_manual=False,
                    confidence=confidence,
                    notes=f"基于{len(offsets)}个锚点事件估算",
                )
                self._offsets[source] = results[source]
        
        return results
    
    def apply_offset_to_datetime(
        self,
        dt: Optional[datetime],
        source_name: str,
    ) -> Optional[datetime]:
        if dt is None:
            return None
        offset = self.get_offset(source_name)
        return dt + timedelta(seconds=offset)
    
    def apply_offset_to_events(
        self,
        events: List,
        source_name: Optional[str] = None,
    ) -> List:
        result = []
        for event in events:
            src = source_name or getattr(event, 'source', '')
            original_time = getattr(event, 'original_time', None)
            
            if hasattr(event, 'time_offset_seconds'):
                event.time_offset_seconds = self.get_offset(src)
            
            unified_time = self.apply_offset_to_datetime(original_time, src)
            
            event_copy = event
            if hasattr(event_copy, 'metadata'):
                event_copy.metadata = getattr(event_copy, 'metadata', {}) or {}
                event_copy.metadata['unified_time'] = unified_time
            
            result.append(event_copy)
        
        return result
    
    def to_dict(self) -> Dict:
        return {
            'reference_source': self._reference_source,
            'offsets': {k: v.to_dict() for k, v in self._offsets.items()},
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'TimeOffsetManager':
        manager = cls()
        manager._reference_source = data.get('reference_source')
        offsets_data = data.get('offsets', {})
        for source_name, offset_data in offsets_data.items():
            manager._offsets[source_name] = SourceOffset.from_dict(offset_data)
        return manager
    
    def reset(self):
        self._offsets.clear()
        self._reference_source = None
