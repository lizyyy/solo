"""
JFR Summary JSON Parser
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging

from ..models.gc_event import GCEvent, GCEventType

logger = logging.getLogger(__name__)


class JFRSummaryParser:
    def __init__(self):
        self.events: List[GCEvent] = []
        self.summary_data: Dict[str, Any] = {}
    
    def parse_file(self, filepath: str) -> List[GCEvent]:
        self.events = []
        self.summary_data = {}
        
        with open(filepath, 'r', encoding='utf-8') as f:
            self.summary_data = json.load(f)
        
        self._extract_gc_events()
        return self.events
    
    def _extract_gc_events(self):
        base_time = datetime.now()
        
        if "gc" in self.summary_data:
            gc_data = self.summary_data["gc"]
            
            if "events" in gc_data:
                for event in gc_data["events"]:
                    gc_event = self._parse_gc_event(event, base_time)
                    if gc_event:
                        self.events.append(gc_event)
            
            if "youngGarbageCollections" in gc_data:
                for event in gc_data["youngGarbageCollections"]:
                    gc_event = self._parse_jfr_young_gc(event, base_time)
                    if gc_event:
                        self.events.append(gc_event)
            
            if "oldGarbageCollections" in gc_data:
                for event in gc_data["oldGarbageCollections"]:
                    gc_event = self._parse_jfr_old_gc(event, base_time)
                    if gc_event:
                        self.events.append(gc_event)
            
            if "concurrentPhases" in gc_data:
                for event in gc_data["concurrentPhases"]:
                    gc_event = self._parse_jfr_concurrent(event, base_time)
                    if gc_event:
                        self.events.append(gc_event)
        
        if "gcPause" in self.summary_data or "gcPauses" in self.summary_data:
            pauses = self.summary_data.get("gcPauses", self.summary_data.get("gcPause", []))
            for pause in pauses if isinstance(pauses, list) else [pauses]:
                gc_event = self._parse_pause_event(pause, base_time)
                if gc_event:
                    self.events.append(gc_event)
    
    def _parse_gc_event(self, event: Dict[str, Any], base_time: datetime) -> Optional[GCEvent]:
        timestamp = self._parse_jfr_timestamp(event.get("timestamp"), base_time)
        
        event_type = GCEventType.YOUNG_GC
        gc_name = event.get("name", "GC Event")
        duration_ms = event.get("duration", 0)
        
        if "Full GC" in gc_name or "full" in gc_name.lower():
            event_type = GCEventType.FULL_GC
        elif "Mixed" in gc_name or "mixed" in gc_name.lower():
            event_type = GCEventType.MIXED_GC
        elif "Humongous" in gc_name:
            event_type = GCEventType.HUMONGOUS_ALLOCATION
        
        heap_before = event.get("heapBefore", event.get("heapBeforeBytes", 0))
        heap_after = event.get("heapAfter", event.get("heapAfterBytes", 0))
        heap_max = event.get("heapMax", event.get("heapMaxBytes", 0))
        
        cause = event.get("cause")
        if not cause:
            reason = event.get("reason")
            if reason:
                cause = str(reason)
        
        return GCEvent(
            timestamp=timestamp,
            event_type=event_type,
            gc_name=gc_name,
            duration_ms=duration_ms,
            heap_before_bytes=heap_before,
            heap_after_bytes=heap_after,
            heap_max_bytes=heap_max,
            cause=cause
        )
    
    def _parse_jfr_young_gc(self, event: Dict[str, Any], base_time: datetime) -> Optional[GCEvent]:
        timestamp = self._parse_jfr_timestamp(event.get("startTime", event.get("timestamp")), base_time)
        
        duration_ms = event.get("duration", 0)
        if event.get("durationMs"):
            duration_ms = event["durationMs"]
        
        return GCEvent(
            timestamp=timestamp,
            event_type=GCEventType.YOUNG_GC,
            gc_name="Young GC",
            duration_ms=duration_ms,
            heap_before_bytes=event.get("heapBeforeBytes", 0),
            heap_after_bytes=event.get("heapAfterBytes", 0),
            heap_max_bytes=event.get("heapMaxBytes", 0),
            cause=event.get("gcCause")
        )
    
    def _parse_jfr_old_gc(self, event: Dict[str, Any], base_time: datetime) -> Optional[GCEvent]:
        timestamp = self._parse_jfr_timestamp(event.get("startTime", event.get("timestamp")), base_time)
        
        duration_ms = event.get("duration", 0)
        if event.get("durationMs"):
            duration_ms = event["durationMs"]
        
        return GCEvent(
            timestamp=timestamp,
            event_type=GCEventType.FULL_GC,
            gc_name="Full GC",
            duration_ms=duration_ms,
            heap_before_bytes=event.get("heapBeforeBytes", 0),
            heap_after_bytes=event.get("heapAfterBytes", 0),
            heap_max_bytes=event.get("heapMaxBytes", 0),
            cause=event.get("gcCause")
        )
    
    def _parse_jfr_concurrent(self, event: Dict[str, Any], base_time: datetime) -> Optional[GCEvent]:
        timestamp = self._parse_jfr_timestamp(event.get("startTime", event.get("timestamp")), base_time)
        
        duration_ms = event.get("duration", 0)
        if event.get("durationMs"):
            duration_ms = event["durationMs"]
        
        phase_name = event.get("phase", event.get("name", "Concurrent Phase"))
        
        return GCEvent(
            timestamp=timestamp,
            event_type=GCEventType.CONCURRENT_MARK,
            gc_name=f"Concurrent: {phase_name}",
            duration_ms=duration_ms,
            is_concurrent=True,
            is_stop_the_world=False
        )
    
    def _parse_pause_event(self, pause: Dict[str, Any], base_time: datetime) -> Optional[GCEvent]:
        timestamp = self._parse_jfr_timestamp(pause.get("timestamp"), base_time)
        
        duration_ms = pause.get("duration", pause.get("durationMs", 0))
        
        pause_type = pause.get("type", "Pause")
        
        event_type = GCEventType.YOUNG_GC
        if "Full" in pause_type or "full" in pause_type.lower():
            event_type = GCEventType.FULL_GC
        
        return GCEvent(
            timestamp=timestamp,
            event_type=event_type,
            gc_name=f"GC Pause: {pause_type}",
            duration_ms=duration_ms,
            is_stop_the_world=True
        )
    
    def _parse_jfr_timestamp(self, ts_value: Any, base_time: datetime) -> datetime:
        if not ts_value:
            return base_time
        
        if isinstance(ts_value, str):
            try:
                return datetime.fromisoformat(ts_value.replace('Z', '+00:00'))
            except ValueError:
                pass
        
        if isinstance(ts_value, (int, float)):
            if ts_value > 1e12:
                return datetime.fromtimestamp(ts_value / 1000)
            elif ts_value > 1e9:
                return datetime.fromtimestamp(ts_value)
            else:
                from datetime import timedelta
                return base_time + timedelta(seconds=ts_value)
        
        return base_time
    
    def get_summary_stats(self) -> Dict[str, Any]:
        stats = {
            "total_events": len(self.events),
        }
        
        if self.summary_data:
            if "gc" in self.summary_data:
                gc = self.summary_data["gc"]
                stats["gc_summary"] = {
                    "total_collections": gc.get("totalCollections", 0),
                    "total_pause_time_ms": gc.get("totalPauseTime", 0),
                    "max_pause_ms": gc.get("maxPauseTime", 0),
                    "gc_overhead_percent": gc.get("gcOverheadPercent", 0),
                }
        
        return stats
