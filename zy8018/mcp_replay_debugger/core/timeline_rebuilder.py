from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
from collections import defaultdict

from .trace_parser import ToolCallEvent


@dataclass
class TimelineEvent:
    event: ToolCallEvent
    relative_time_ms: float
    group_id: str
    sequence_in_group: int
    parallel_group: Optional[str] = None


@dataclass
class Timeline:
    events: List[TimelineEvent]
    start_time: datetime
    end_time: datetime
    total_duration_ms: float
    tool_call_groups: Dict[str, List[TimelineEvent]]
    parallel_batches: List[List[TimelineEvent]]

    def get_summary(self) -> Dict[str, Any]:
        tool_counts = defaultdict(int)
        retry_count = 0
        error_count = 0

        for te in self.events:
            tool_counts[te.event.tool_name] += 1
            if te.event.is_retry:
                retry_count += 1
            if te.event.error:
                error_count += 1

        return {
            "total_events": len(self.events),
            "unique_tool_calls": len(self.tool_call_groups),
            "tool_usage": dict(tool_counts),
            "retry_count": retry_count,
            "error_count": error_count,
            "total_duration_ms": self.total_duration_ms,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "parallel_batches": len(self.parallel_batches),
        }


class TimelineRebuilder:
    def __init__(self, parallel_threshold_ms: float = 100.0):
        self.parallel_threshold_ms = parallel_threshold_ms

    def rebuild(self, events: List[ToolCallEvent]) -> Timeline:
        if not events:
            return Timeline(
                events=[],
                start_time=datetime.now(),
                end_time=datetime.now(),
                total_duration_ms=0.0,
                tool_call_groups={},
                parallel_batches=[],
            )

        sorted_events = sorted(events, key=lambda e: e.timestamp)

        start_time = sorted_events[0].timestamp
        end_time = sorted_events[-1].timestamp
        total_duration_ms = (end_time - start_time).total_seconds() * 1000

        timeline_events = self._create_timeline_events(sorted_events, start_time)

        tool_call_groups = defaultdict(list)
        for te in timeline_events:
            tool_call_groups[te.event.id].append(te)

        parallel_batches = self._detect_parallel_batches(timeline_events)

        return Timeline(
            events=timeline_events,
            start_time=start_time,
            end_time=end_time,
            total_duration_ms=total_duration_ms,
            tool_call_groups=dict(tool_call_groups),
            parallel_batches=parallel_batches,
        )

    def _create_timeline_events(
        self,
        sorted_events: List[ToolCallEvent],
        start_time: datetime,
    ) -> List[TimelineEvent]:
        timeline_events = []
        group_sequences: Dict[str, int] = defaultdict(int)

        for event in sorted_events:
            relative_time_ms = (event.timestamp - start_time).total_seconds() * 1000
            group_sequences[event.id] += 1

            timeline_events.append(
                TimelineEvent(
                    event=event,
                    relative_time_ms=relative_time_ms,
                    group_id=event.id,
                    sequence_in_group=group_sequences[event.id],
                )
            )

        return timeline_events

    def _detect_parallel_batches(
        self,
        timeline_events: List[TimelineEvent],
    ) -> List[List[TimelineEvent]]:
        if not timeline_events:
            return []

        batches: List[List[TimelineEvent]] = []
        current_batch: List[TimelineEvent] = []
        batch_end_time = -1.0

        for te in timeline_events:
            if not current_batch:
                current_batch = [te]
                batch_end_time = te.relative_time_ms
            else:
                if te.relative_time_ms - batch_end_time <= self.parallel_threshold_ms:
                    current_batch.append(te)
                    batch_end_time = max(batch_end_time, te.relative_time_ms)
                else:
                    batches.append(current_batch)
                    current_batch = [te]
                    batch_end_time = te.relative_time_ms

        if current_batch:
            batches.append(current_batch)

        return batches

    def generate_replay_plan(
        self,
        timeline: Timeline,
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        config = config or {}
        mode = config.get("mode", "dry_run")
        include_retries = config.get("include_retries", True)
        respect_timing = config.get("respect_timing", True)
        filter_tools = config.get("filter_tools", None)

        plan_steps = []
        step_index = 1

        for batch_idx, batch in enumerate(timeline.parallel_batches):
            batch_events = []

            for te in batch:
                if not include_retries and te.event.is_retry:
                    continue
                if filter_tools and te.event.tool_name not in filter_tools:
                    continue

                batch_events.append({
                    "step": step_index,
                    "tool_call_id": te.event.id,
                    "tool_name": te.event.tool_name,
                    "arguments": te.event.arguments,
                    "relative_time_ms": te.relative_time_ms,
                    "is_retry": te.event.is_retry,
                    "retry_count": te.event.retry_count,
                    "expected_response": te.event.response,
                    "expected_error": te.event.error,
                    "original_duration_ms": te.event.duration_ms,
                })
                step_index += 1

            if batch_events:
                plan_steps.append({
                    "batch": batch_idx + 1,
                    "is_parallel": len(batch_events) > 1 and respect_timing,
                    "events": batch_events,
                })

        return {
            "mode": mode,
            "total_steps": step_index - 1,
            "total_batches": len(plan_steps),
            "respect_timing": respect_timing,
            "include_retries": include_retries,
            "steps": plan_steps,
            "summary": {
                "total_events": timeline.get_summary()["total_events"],
                "filtered_events": step_index - 1,
            },
        }
