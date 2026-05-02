import pytest
from datetime import datetime, timedelta
from typing import List

from access_arbiter.models import CardSwipeEvent, Direction
from access_arbiter.timeline import (
    TimelineMerger,
    TimelineResult,
    MergedEvent,
    DeviceTimeOffset,
    TimelineGap
)


class TestTimelineMerger:
    def create_event(self, device_id: str, card_id: str, timestamp: str, 
                     zone_id: str, direction: Direction = Direction.IN) -> CardSwipeEvent:
        return CardSwipeEvent(
            device_id=device_id,
            card_id=card_id,
            timestamp=timestamp,
            zone_id=zone_id,
            direction=direction
        )
    
    def test_auto_detect_offsets_with_known_offsets(self):
        events = [
            self.create_event("device_a", "C001", "2026-05-01 08:00:00", "main_gate"),
            self.create_event("device_b", "C001", "2026-05-01 07:58:00", "server_room"),
        ]
        
        known_offsets = {"device_b": 120}
        
        merger = TimelineMerger()
        offsets = merger.auto_detect_offsets(events, known_offsets)
        
        assert "device_a" in offsets
        assert "device_b" in offsets
        assert offsets["device_b"].offset_seconds == 120
    
    def test_merge_timeline_with_offset(self):
        events = [
            self.create_event("device_a", "C001", "2026-05-01 08:00:00", "main_gate"),
            self.create_event("device_b", "C001", "2026-05-01 07:58:00", "server_room"),
        ]
        
        offsets = {
            "device_a": DeviceTimeOffset(device_id="device_a", offset_seconds=0),
            "device_b": DeviceTimeOffset(device_id="device_b", offset_seconds=120),
        }
        
        merger = TimelineMerger()
        result = merger.merge_timeline(events, offsets)
        
        assert result.total_events == 2
        assert result.merged_count == 2
        
        assert len(result.merged_events) == 2
        
        event_b = next(e for e in result.merged_events if e.source_device == "device_b")
        assert event_b.device_offset_seconds == 120
        
        assert result.merged_events[0].corrected_timestamp.hour == 8
        assert result.merged_events[0].corrected_timestamp.minute == 0
    
    def test_detect_gaps(self):
        events = [
            self.create_event("device_a", "C001", "2026-05-01 08:00:00", "main_gate"),
            self.create_event("device_a", "C002", "2026-05-01 09:00:00", "main_gate"),
            self.create_event("device_a", "C003", "2026-05-01 09:05:00", "main_gate"),
            self.create_event("device_a", "C004", "2026-05-01 11:00:00", "main_gate"),
        ]
        
        merger = TimelineMerger()
        gaps = merger.detect_gaps(events, gap_threshold_minutes=30, typical_interval_minutes=10)
        
        assert len(gaps) == 2
        
        gaps.sort(key=lambda g: g.gap_start)
        
        assert gaps[0].device_id == "device_a"
        assert gaps[0].duration_minutes == 60.0
        
        assert gaps[1].duration_minutes == 115.0
    
    def test_duplicate_swipe_detection(self):
        events = [
            self.create_event("device_a", "C001", "2026-05-01 08:00:00", "main_gate"),
            self.create_event("device_b", "C001", "2026-05-01 08:00:30", "main_gate"),
        ]
        
        offsets = {
            "device_a": DeviceTimeOffset(device_id="device_a", offset_seconds=0),
            "device_b": DeviceTimeOffset(device_id="device_b", offset_seconds=0),
        }
        
        merger = TimelineMerger()
        result = merger.merge_timeline(events, offsets)
        
        has_conflicts = any(len(e.conflict_notes) > 0 for e in result.merged_events)
        assert has_conflicts
        
        for event in result.merged_events:
            if event.conflict_notes:
                assert "快速重复刷卡" in event.conflict_notes[0]
    
    def test_adjust_offset(self):
        events = [
            self.create_event("device_a", "C001", "2026-05-01 08:00:00", "main_gate"),
            self.create_event("device_b", "C001", "2026-05-01 07:58:00", "server_room"),
        ]
        
        offsets = {
            "device_a": DeviceTimeOffset(device_id="device_a", offset_seconds=0),
            "device_b": DeviceTimeOffset(device_id="device_b", offset_seconds=0),
        }
        
        merger = TimelineMerger()
        result = merger.merge_timeline(events, offsets)
        
        new_result = merger.adjust_offset("device_b", 120, result)
        
        assert "device_b" in new_result.device_offsets
        assert new_result.device_offsets["device_b"].offset_seconds == 120
        
        event_b = next(e for e in new_result.merged_events if e.source_device == "device_b")
        assert event_b.device_offset_seconds == 120
        assert event_b.corrected_timestamp.minute == 0
