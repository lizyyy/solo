from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from pydantic import BaseModel, Field
from collections import defaultdict

from .models import CardSwipeEvent, Direction


class DeviceTimeOffset(BaseModel):
    device_id: str
    offset_seconds: int = 0
    reference_time: Optional[datetime] = None
    confidence: float = 1.0


class TimelineGap(BaseModel):
    device_id: str
    gap_start: datetime
    gap_end: datetime
    duration_minutes: float
    expected_events_count: int = 0


class MergedEvent(BaseModel):
    original_event: CardSwipeEvent
    corrected_timestamp: datetime
    device_offset_seconds: int
    timeline_order: int
    source_device: str
    conflict_notes: List[str] = Field(default_factory=list)


class TimelineResult(BaseModel):
    merged_events: List[MergedEvent] = Field(default_factory=list)
    device_offsets: Dict[str, DeviceTimeOffset] = Field(default_factory=dict)
    gaps: List[TimelineGap] = Field(default_factory=list)
    total_events: int = 0
    merged_count: int = 0


class TimelineMerger:
    def __init__(self, default_offset_seconds: int = 0):
        self.default_offset = default_offset_seconds

    def auto_detect_offsets(
        self, 
        events: List[CardSwipeEvent],
        known_offsets: Dict[str, int]
    ) -> Dict[str, DeviceTimeOffset]:
        device_events: Dict[str, List[CardSwipeEvent]] = defaultdict(list)
        for event in events:
            device_events[event.device_id].append(event)
        
        offsets: Dict[str, DeviceTimeOffset] = {}
        
        for device_id, dev_events in device_events.items():
            if not dev_events:
                continue
            
            if device_id in known_offsets:
                offset = known_offsets[device_id]
                offsets[device_id] = DeviceTimeOffset(
                    device_id=device_id,
                    offset_seconds=offset,
                    confidence=0.9
                )
                continue
            
            dev_events.sort(key=lambda e: e.timestamp)
            reference_time = dev_events[0].timestamp
            
            offsets[device_id] = DeviceTimeOffset(
                device_id=device_id,
                offset_seconds=self.default_offset,
                reference_time=reference_time,
                confidence=0.5
            )
        
        return offsets

    def detect_gaps(
        self,
        events: List[CardSwipeEvent],
        gap_threshold_minutes: int = 60,
        typical_interval_minutes: int = 10
    ) -> List[TimelineGap]:
        if not events:
            return []
        
        device_events: Dict[str, List[CardSwipeEvent]] = defaultdict(list)
        for event in events:
            device_events[event.device_id].append(event)
        
        gaps: List[TimelineGap] = []
        
        for device_id, dev_events in device_events.items():
            if len(dev_events) < 2:
                continue
            
            dev_events.sort(key=lambda e: e.timestamp)
            
            for i in range(1, len(dev_events)):
                prev_event = dev_events[i - 1]
                curr_event = dev_events[i]
                
                delta = curr_event.timestamp - prev_event.timestamp
                delta_minutes = delta.total_seconds() / 60
                
                if delta_minutes > gap_threshold_minutes:
                    expected_count = int(delta_minutes / typical_interval_minutes)
                    
                    gaps.append(TimelineGap(
                        device_id=device_id,
                        gap_start=prev_event.timestamp,
                        gap_end=curr_event.timestamp,
                        duration_minutes=delta_minutes,
                        expected_events_count=expected_count
                    ))
        
        gaps.sort(key=lambda g: g.gap_start)
        return gaps

    def merge_timeline(
        self,
        events: List[CardSwipeEvent],
        device_offsets: Dict[str, DeviceTimeOffset],
        gap_threshold_minutes: int = 60
    ) -> TimelineResult:
        merged_events: List[MergedEvent] = []
        
        for event in events:
            offset = device_offsets.get(
                event.device_id,
                DeviceTimeOffset(device_id=event.device_id, offset_seconds=0)
            )
            
            corrected_ts = event.timestamp + timedelta(seconds=offset.offset_seconds)
            
            merged_events.append(MergedEvent(
                original_event=event,
                corrected_timestamp=corrected_ts,
                device_offset_seconds=offset.offset_seconds,
                timeline_order=0,
                source_device=event.device_id
            ))
        
        merged_events.sort(key=lambda e: e.corrected_timestamp)
        
        for idx, event in enumerate(merged_events):
            event.timeline_order = idx
        
        self._detect_conflicts(merged_events)
        
        gaps = self.detect_gaps(events, gap_threshold_minutes)
        
        return TimelineResult(
            merged_events=merged_events,
            device_offsets=device_offsets,
            gaps=gaps,
            total_events=len(events),
            merged_count=len(merged_events)
        )

    def _detect_conflicts(self, events: List[MergedEvent]):
        card_timestamps: Dict[str, List[Tuple[datetime, MergedEvent]]] = defaultdict(list)
        
        for event in events:
            card_id = event.original_event.card_id
            timestamp = event.corrected_timestamp
            
            for prev_ts, prev_event in card_timestamps[card_id]:
                delta = (timestamp - prev_ts).total_seconds()
                
                if delta < 60:
                    event.conflict_notes.append(
                        f"快速重复刷卡: 与设备 {prev_event.source_device} 在 {prev_ts.strftime('%H:%M:%S')} 的刷卡间隔仅 {int(delta)} 秒"
                    )
                    prev_event.conflict_notes.append(
                        f"快速重复刷卡: 与设备 {event.source_device} 在 {timestamp.strftime('%H:%M:%S')} 的刷卡间隔仅 {int(delta)} 秒"
                    )
                
                if delta < 300 and prev_event.original_event.zone_id == event.original_event.zone_id:
                    event.conflict_notes.append(
                        f"同门区重复进出: {event.original_event.zone_id} 门区, 5分钟内多次刷卡"
                    )
            
            card_timestamps[card_id].append((timestamp, event))

    def adjust_offset(
        self,
        device_id: str,
        new_offset_seconds: int,
        timeline_result: TimelineResult
    ) -> TimelineResult:
        new_offsets = dict(timeline_result.device_offsets)
        new_offsets[device_id] = DeviceTimeOffset(
            device_id=device_id,
            offset_seconds=new_offset_seconds,
            confidence=1.0
        )
        
        all_events = [me.original_event for me in timeline_result.merged_events]
        
        return self.merge_timeline(all_events, new_offsets)
