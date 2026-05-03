from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Any, Set
import re

from src.models import Event, Conflict


DEFAULT_COMMUTE_BUFFER_MINUTES = 30


class ConflictDetector:
    def __init__(self, commute_buffer_minutes: int = DEFAULT_COMMUTE_BUFFER_MINUTES,
                 mutually_exclusive_locations: List[List[str]] = None):
        self.commute_buffer_minutes = commute_buffer_minutes
        self.mutually_exclusive_locations = mutually_exclusive_locations or [
            ['公司', '办公室', 'office', 'work'],
            ['家', 'home', '家里'],
            ['学校', '校园', 'school', 'university'],
            ['健身房', '健身', 'gym', 'fitness'],
        ]

    def detect_all(self, events: List[Event]) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        conflicts.extend(self.detect_time_overlap(events))
        
        conflicts.extend(self.detect_commute_buffer(events))
        
        conflicts.extend(self.detect_location_conflict(events))
        
        conflicts.extend(self.detect_missing_fields(events))
        
        conflicts.extend(self.detect_cross_day(events))
        
        conflicts.extend(self.detect_recurrence_issues(events))
        
        conflicts.extend(self.detect_zero_duration(events))
        
        return self._deduplicate_conflicts(conflicts)

    def detect_time_overlap(self, events: List[Event]) -> List[Conflict]:
        conflicts: List[Conflict] = []
        sorted_events = sorted(events, key=lambda e: e.start)
        
        for i, event1 in enumerate(sorted_events):
            for j in range(i + 1, len(sorted_events)):
                event2 = sorted_events[j]
                
                if event2.start >= event1.end:
                    break
                
                overlap = self._calculate_overlap(event1, event2)
                if overlap > timedelta(0):
                    if self._is_same_event(event1, event2):
                        continue
                    
                    overlap_minutes = int(overlap.total_seconds() / 60)
                    conflicts.append(Conflict(
                        conflict_type="time_overlap",
                        events=[event1, event2],
                        description=f"事件时间重叠 {overlap_minutes} 分钟: '{event1.title}' ({event1.source_file}) 和 '{event2.title}' ({event2.source_file})",
                        suggestion=f"检查两个事件是否是同一事件，或调整其中一个的时间。重叠从 {event2.start.strftime('%m-%d %H:%M')} 到 {min(event1.end, event2.end).strftime('%H:%M')}",
                        severity="error" if overlap_minutes > 30 else "warning",
                    ))
        
        return conflicts

    def detect_commute_buffer(self, events: List[Event]) -> List[Conflict]:
        conflicts: List[Conflict] = []
        sorted_events = sorted(events, key=lambda e: e.start)
        
        for i in range(len(sorted_events) - 1):
            event1 = sorted_events[i]
            event2 = sorted_events[i + 1]
            
            if event1.all_day or event2.all_day:
                continue
            
            gap = event2.start - event1.end
            
            if gap.total_seconds() < 0:
                continue
            
            loc1 = (event1.location or "").lower()
            loc2 = (event2.location or "").lower()
            
            if loc1 and loc2 and loc1 != loc2:
                if self._are_locations_related(loc1, loc2):
                    continue
                
                required_buffer = timedelta(minutes=self.commute_buffer_minutes)
                if gap < required_buffer:
                    buffer_needed = int((required_buffer - gap).total_seconds() / 60)
                    conflicts.append(Conflict(
                        conflict_type="commute_buffer_insufficient",
                        events=[event1, event2],
                        description=f"通勤缓冲不足: '{event1.title}' 结束于 {event1.end.strftime('%H:%M')}，'{event2.title}' 开始于 {event2.start.strftime('%H:%M')}，间隔 {int(gap.total_seconds()/60)} 分钟，需要 {self.commute_buffer_minutes} 分钟",
                        suggestion=f"建议将 '{event2.title}' 延后 {buffer_needed} 分钟，或确认两个地点是否很近。地点1: {event1.location or '未知'}, 地点2: {event2.location or '未知'}",
                        severity="warning",
                    ))
        
        return conflicts

    def detect_location_conflict(self, events: List[Event]) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        events_by_date: Dict[str, List[Event]] = {}
        for event in events:
            date_key = event.start.date().isoformat()
            if date_key not in events_by_date:
                events_by_date[date_key] = []
            events_by_date[date_key].append(event)
        
        for date_key, day_events in events_by_date.items():
            if len(day_events) < 2:
                continue
            
            day_locations = [(e.location or "").lower() for e in day_events]
            
            for exclusive_group in self.mutually_exclusive_locations:
                exclusive_lower = [loc.lower() for loc in exclusive_group]
                found_locs = []
                found_events = []
                
                for event, loc in zip(day_events, day_locations):
                    if not loc:
                        continue
                    for exclusive_loc in exclusive_lower:
                        if exclusive_loc in loc or loc in exclusive_loc:
                            found_locs.append(event.location)
                            found_events.append(event)
                            break
                
                if len(found_events) >= 2:
                    unique_locs = list(set(found_locs))
                    if len(unique_locs) >= 2 or len(found_events) >= 2:
                        event_descriptions = []
                        for e in found_events:
                            event_descriptions.append(f"'{e.title}'@{e.location}")
                        conflicts.append(Conflict(
                            conflict_type="location_mutually_exclusive",
                            events=found_events,
                            description=f"同一天 ({date_key}) 检测到互斥地点的事件: {', '.join(event_descriptions)}",
                            suggestion=f"这些事件位于互斥地点组 ({'/'.join(exclusive_group)})，请确认当天的实际安排",
                            severity="warning",
                        ))
        
        return conflicts

    def detect_missing_fields(self, events: List[Event]) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        for event in events:
            if not event.title or not event.title.strip():
                conflicts.append(Conflict(
                    conflict_type="missing_title",
                    events=[event],
                    description=f"事件缺少标题 (来源: {event.source_file})",
                    suggestion="为该事件添加一个描述性标题，方便识别",
                    severity="error",
                ))
            
            if event.end <= event.start:
                conflicts.append(Conflict(
                    conflict_type="invalid_end_time",
                    events=[event],
                    description=f"事件 '{event.title}' 结束时间早于或等于开始时间",
                    suggestion="检查并修正结束时间，或确认是否为全天事件",
                    severity="error",
                ))
            
            if not event.location or not event.location.strip():
                conflicts.append(Conflict(
                    conflict_type="missing_location",
                    events=[event],
                    description=f"事件 '{event.title}' 缺少地点信息",
                    suggestion="添加地点信息可以帮助检测通勤缓冲和地点冲突",
                    severity="info",
                ))
        
        return conflicts

    def detect_cross_day(self, events: List[Event]) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        for event in events:
            if event.is_cross_day:
                days = (event.end.date() - event.start.date()).days
                conflicts.append(Conflict(
                    conflict_type="cross_day_event",
                    events=[event],
                    description=f"跨天事件 '{event.title}' 从 {event.start.strftime('%m-%d %H:%M')} 到 {event.end.strftime('%m-%d %H:%M')}，跨越 {days} 天",
                    suggestion="跨天事件在日历中可能显示异常，建议拆分为多个单日事件或确认是否正确",
                    severity="info",
                ))
        
        return conflicts

    def detect_recurrence_issues(self, events: List[Event]) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        for event in events:
            if event.is_recurrence and not event.is_expanded:
                conflicts.append(Conflict(
                    conflict_type="unexpanded_recurrence",
                    events=[event],
                    description=f"事件 '{event.title}' 是重复事件但尚未展开",
                    suggestion="建议展开重复事件以进行完整的冲突检测",
                    severity="info",
                ))
        
        return conflicts

    def detect_zero_duration(self, events: List[Event]) -> List[Conflict]:
        conflicts: List[Conflict] = []
        
        for event in events:
            if event.start >= event.end and not event.all_day:
                conflicts.append(Conflict(
                    conflict_type="zero_or_negative_duration",
                    events=[event],
                    description=f"事件 '{event.title}' 持续时间为零或负数: {event.duration}",
                    suggestion="检查结束时间是否正确设置",
                    severity="error",
                ))
        
        return conflicts

    def _calculate_overlap(self, event1: Event, event2: Event) -> timedelta:
        start_overlap = max(event1.start, event2.start)
        end_overlap = min(event1.end, event2.end)
        return max(timedelta(0), end_overlap - start_overlap)

    def _is_same_event(self, event1: Event, event2: Event) -> bool:
        if event1.title == event2.title and event1.start == event2.start:
            return True
        
        if self._titles_similar(event1.title, event2.title):
            loc1 = (event1.location or "").lower().strip()
            loc2 = (event2.location or "").lower().strip()
            if loc1 and loc2 and (loc1 == loc2 or loc1 in loc2 or loc2 in loc1):
                return True
        
        return False

    def _titles_similar(self, title1: str, title2: str) -> bool:
        if not title1 or not title2:
            return False
        
        t1 = title1.lower().strip()
        t2 = title2.lower().strip()
        
        if t1 == t2:
            return True
        
        t1_clean = re.sub(r'[\s\-_\.]+', '', t1)
        t2_clean = re.sub(r'[\s\-_\.]+', '', t2)
        
        if t1_clean == t2_clean:
            return True
        
        if len(t1_clean) > 5 and len(t2_clean) > 5:
            if t1_clean in t2_clean or t2_clean in t1_clean:
                return True
        
        words1 = set(re.findall(r'\w+', t1))
        words2 = set(re.findall(r'\w+', t2))
        common = words1 & words2
        if len(common) >= 2 and len(common) >= min(len(words1), len(words2)) * 0.5:
            return True
        
        return False

    def _are_locations_related(self, loc1: str, loc2: str) -> bool:
        if not loc1 or not loc2:
            return True
        
        common_parts = [
            '同一', '相同', 'same',
            '楼', 'building',
            '校区', 'campus',
            '园', 'park',
        ]
        
        for part in common_parts:
            if part in loc1 and part in loc2:
                return True
        
        if loc1 in loc2 or loc2 in loc1:
            return True
        
        return False

    def _deduplicate_conflicts(self, conflicts: List[Conflict]) -> List[Conflict]:
        seen: Set[str] = set()
        unique: List[Conflict] = []
        
        for conflict in conflicts:
            event_uids = sorted([e.uid for e in conflict.events])
            key = f"{conflict.conflict_type}:{':'.join(event_uids)}"
            
            if key not in seen:
                seen.add(key)
                unique.append(conflict)
        
        return unique
