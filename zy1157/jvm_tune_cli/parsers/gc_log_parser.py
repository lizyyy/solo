"""
GC Log Parser - supports G1, ZGC, ParallelGC, CMS logs
"""

import re
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import logging

from ..models.gc_event import GCEvent, GCEventType

logger = logging.getLogger(__name__)


class GCLogParser:
    def __init__(self):
        self.events: List[GCEvent] = []
        self.jvm_start_time: Optional[datetime] = None
        self._base_time = datetime.now()
    
    def parse_file(self, filepath: str) -> List[GCEvent]:
        self.events = []
        self.jvm_start_time = None
        
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        for line in lines:
            event = self._parse_line(line.strip())
            if event:
                self.events.append(event)
        
        return self.events
    
    def _parse_line(self, line: str) -> Optional[GCEvent]:
        if not line or line.startswith('#'):
            return None
        
        if "Java HotSpot" in line or "OpenJDK" in line:
            return None
        
        parsers = [
            self._parse_g1_log,
            self._parse_zgc_log,
            self._parse_parallel_log,
            self._parse_cms_log,
            self._parse_unified_log,
        ]
        
        for parser in parsers:
            try:
                event = parser(line)
                if event:
                    return event
            except Exception as e:
                logger.debug(f"Parser {parser.__name__} failed: {e}")
        
        return None
    
    def _parse_timestamp(self, line: str) -> Optional[datetime]:
        uptime_match = re.search(r'^(\d+\.\d+):\s*\[', line)
        if uptime_match:
            seconds = float(uptime_match.group(1))
            return self._base_time + timedelta(seconds=seconds)
        
        iso_match = re.search(r'\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+[+-]\d{4})\]', line)
        if iso_match:
            try:
                return datetime.fromisoformat(iso_match.group(1))
            except ValueError:
                pass
        
        date_match = re.search(r'\[(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})', line)
        if date_match:
            try:
                return datetime.strptime(f"{date_match.group(1)} {date_match.group(2)}", "%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass
        
        return self._base_time
    
    def _parse_g1_log(self, line: str) -> Optional[GCEvent]:
        if "G1" not in line and "G1GC" not in line:
            return None
        
        timestamp = self._parse_timestamp(line)
        
        event_type = GCEventType.YOUNG_GC
        gc_name = "G1 Young GC"
        duration_ms = 0.0
        cause = None
        
        if "Full GC" in line:
            event_type = GCEventType.FULL_GC
            gc_name = "G1 Full GC"
        elif "Mixed GC" in line:
            event_type = GCEventType.MIXED_GC
            gc_name = "G1 Mixed GC"
        elif "concurrent-mark" in line.lower() or "Concurrent Mark" in line:
            event_type = GCEventType.CONCURRENT_MARK
            gc_name = "G1 Concurrent Mark"
        elif "Humongous" in line:
            event_type = GCEventType.HUMONGOUS_ALLOCATION
            gc_name = "G1 Humongous Allocation"
        
        if "Allocation Failure" in line:
            cause = "Allocation Failure"
        elif "Metadata GC Threshold" in line:
            cause = "Metadata GC Threshold"
        elif "System.gc()" in line:
            cause = "System.gc()"
        elif "G1 Evacuation Pause" in line:
            cause = "G1 Evacuation Pause"
        
        duration_match = re.search(r'(\d+\.\d+)\s*ms\]', line)
        if duration_match:
            duration_ms = float(duration_match.group(1))
        
        heap_match = re.search(r'(\d+)M->(\d+)M\((\d+)M\)', line)
        heap_before = 0
        heap_after = 0
        heap_max = 0
        if heap_match:
            heap_before = int(heap_match.group(1)) * 1024 * 1024
            heap_after = int(heap_match.group(2)) * 1024 * 1024
            heap_max = int(heap_match.group(3)) * 1024 * 1024
        
        return GCEvent(
            timestamp=timestamp,
            event_type=event_type,
            gc_name=gc_name,
            duration_ms=duration_ms,
            heap_before_bytes=heap_before,
            heap_after_bytes=heap_after,
            heap_max_bytes=heap_max,
            cause=cause,
            is_stop_the_world=event_type not in [GCEventType.CONCURRENT_MARK]
        )
    
    def _parse_zgc_log(self, line: str) -> Optional[GCEvent]:
        if "ZGC" not in line and "ZGCPhase" not in line:
            return None
        
        timestamp = self._parse_timestamp(line)
        
        event_type = GCEventType.ZGC_PHASE
        gc_name = "ZGC Phase"
        duration_ms = 0.0
        
        phases = {
            "Pause Mark Start": "ZGC Pause Mark Start",
            "Pause Mark End": "ZGC Pause Mark End",
            "Pause Relocate Start": "ZGC Pause Relocate Start",
        }
        
        for phase_name, display_name in phases.items():
            if phase_name in line:
                gc_name = display_name
                event_type = GCEventType.ZGC_PHASE
                break
        
        duration_match = re.search(r'(\d+\.\d+)\s*ms', line)
        if duration_match:
            duration_ms = float(duration_match.group(1))
        
        return GCEvent(
            timestamp=timestamp,
            event_type=event_type,
            gc_name=gc_name,
            duration_ms=duration_ms,
            is_stop_the_world="Pause" in gc_name
        )
    
    def _parse_parallel_log(self, line: str) -> Optional[GCEvent]:
        if "Parallel" not in line and "PSYoungGen" not in line and "ParOldGen" not in line:
            return None
        
        timestamp = self._parse_timestamp(line)
        
        event_type = GCEventType.YOUNG_GC
        gc_name = "Parallel Young GC"
        duration_ms = 0.0
        
        if "Full GC" in line:
            event_type = GCEventType.FULL_GC
            gc_name = "Parallel Full GC"
        
        duration_match = re.search(r'(\d+\.\d+)\s*secs', line)
        if duration_match:
            duration_ms = float(duration_match.group(1)) * 1000
        
        return GCEvent(
            timestamp=timestamp,
            event_type=event_type,
            gc_name=gc_name,
            duration_ms=duration_ms
        )
    
    def _parse_cms_log(self, line: str) -> Optional[GCEvent]:
        if "CMS" not in line and "ConcurrentMarkSweep" not in line:
            return None
        
        timestamp = self._parse_timestamp(line)
        
        event_type = GCEventType.YOUNG_GC
        gc_name = "CMS Young GC"
        duration_ms = 0.0
        
        if "Full GC" in line:
            event_type = GCEventType.FULL_GC
            gc_name = "CMS Full GC"
        elif "concurrent" in line.lower():
            event_type = GCEventType.CONCURRENT_MARK
            gc_name = "CMS Concurrent"
        
        duration_match = re.search(r'(\d+\.\d+)\s*secs', line)
        if duration_match:
            duration_ms = float(duration_match.group(1)) * 1000
        
        return GCEvent(
            timestamp=timestamp,
            event_type=event_type,
            gc_name=gc_name,
            duration_ms=duration_ms
        )
    
    def _parse_unified_log(self, line: str) -> Optional[GCEvent]:
        if "[gc" not in line.lower():
            return None
        
        timestamp = self._parse_timestamp(line)
        
        event_type = GCEventType.YOUNG_GC
        gc_name = "GC Event"
        duration_ms = 0.0
        
        if "young" in line.lower():
            gc_name = "Young GC"
        elif "old" in line.lower():
            gc_name = "Old GC"
        elif "mixed" in line.lower():
            gc_name = "Mixed GC"
            event_type = GCEventType.MIXED_GC
        
        if "full" in line.lower():
            event_type = GCEventType.FULL_GC
            gc_name = "Full GC"
        
        duration_match = re.search(r'Pause\s+(\d+\.?\d*)ms', line)
        if duration_match:
            duration_ms = float(duration_match.group(1))
        
        cause_match = re.search(r'\((.*?)\)', line)
        cause = cause_match.group(1) if cause_match else None
        
        return GCEvent(
            timestamp=timestamp,
            event_type=event_type,
            gc_name=gc_name,
            duration_ms=duration_ms,
            cause=cause
        )
    
    def get_stats(self) -> Dict[str, Any]:
        if not self.events:
            return {}
        
        durations = [e.duration_ms for e in self.events if e.duration_ms > 0]
        if not durations:
            durations = [0]
        
        young_gcs = [e for e in self.events if e.event_type == GCEventType.YOUNG_GC]
        full_gcs = [e for e in self.events if e.event_type == GCEventType.FULL_GC]
        mixed_gcs = [e for e in self.events if e.event_type == GCEventType.MIXED_GC]
        humongous = [e for e in self.events if e.event_type == GCEventType.HUMONGOUS_ALLOCATION]
        
        import statistics
        return {
            "total_events": len(self.events),
            "total_duration_ms": sum(durations),
            "mean_pause_ms": statistics.mean(durations),
            "max_pause_ms": max(durations),
            "min_pause_ms": min(durations),
            "young_gc_count": len(young_gcs),
            "full_gc_count": len(full_gcs),
            "mixed_gc_count": len(mixed_gcs),
            "humongous_allocation_count": len(humongous),
        }
