from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Any, Set
import re
import copy

from src.models import Event


DEFAULT_TITLE_SIMILARITY_THRESHOLD = 0.7
DEFAULT_TIME_OVERLAP_THRESHOLD = 0.5


class EventMerger:
    def __init__(self, 
                 title_similarity_threshold: float = DEFAULT_TITLE_SIMILARITY_THRESHOLD,
                 time_overlap_threshold: float = DEFAULT_TIME_OVERLAP_THRESHOLD,
                 require_location_match: bool = True):
        self.title_similarity_threshold = title_similarity_threshold
        self.time_overlap_threshold = time_overlap_threshold
        self.require_location_match = require_location_match
        self.merged_groups: List[List[Event]] = []

    def merge_duplicates(self, events: List[Event]) -> Tuple[List[Event], List[List[Event]]]:
        self.merged_groups = []
        if not events:
            return [], []
        
        events_by_date: Dict[str, List[Event]] = {}
        for event in events:
            date_key = event.start.date().isoformat()
            if date_key not in events_by_date:
                events_by_date[date_key] = []
            events_by_date[date_key].append(event)
        
        merged_events: List[Event] = []
        
        for date_key, day_events in events_by_date.items():
            day_merged, day_groups = self._merge_day_events(day_events)
            merged_events.extend(day_merged)
            self.merged_groups.extend(day_groups)
        
        return merged_events, self.merged_groups

    def _merge_day_events(self, events: List[Event]) -> Tuple[List[Event], List[List[Event]]]:
        if len(events) <= 1:
            return events, []
        
        sorted_events = sorted(events, key=lambda e: (e.start, e.end))
        
        merged_indices: Set[int] = set()
        merged_groups: List[List[Event]] = []
        result_events: List[Event] = []
        
        for i, event1 in enumerate(sorted_events):
            if i in merged_indices:
                continue
            
            duplicate_indices: List[int] = []
            
            for j in range(i + 1, len(sorted_events)):
                if j in merged_indices:
                    continue
                
                event2 = sorted_events[j]
                
                if self._are_duplicates(event1, event2):
                    duplicate_indices.append(j)
            
            if duplicate_indices:
                all_duplicates = [event1] + [sorted_events[idx] for idx in duplicate_indices]
                merged_event = self._merge_events(all_duplicates)
                result_events.append(merged_event)
                merged_groups.append(all_duplicates)
                
                for idx in duplicate_indices:
                    merged_indices.add(idx)
                merged_indices.add(i)
            else:
                result_events.append(event1)
        
        return result_events, merged_groups

    def _are_duplicates(self, event1: Event, event2: Event) -> bool:
        if event1.source_file == event2.source_file and event1.uid == event2.uid:
            return True
        
        if event1.title != event2.title:
            title_sim = self._calculate_title_similarity(event1.title, event2.title)
            if title_sim < self.title_similarity_threshold:
                return False
        
        time_overlap = self._calculate_time_overlap_ratio(event1, event2)
        if time_overlap < self.time_overlap_threshold:
            return False
        
        if self.require_location_match:
            loc1 = (event1.location or "").strip().lower()
            loc2 = (event2.location or "").strip().lower()
            
            if loc1 and loc2:
                if not self._locations_match(loc1, loc2):
                    return False
        
        return True

    def _calculate_title_similarity(self, title1: str, title2: str) -> float:
        if not title1 or not title2:
            return 0.0
        
        t1 = title1.lower().strip()
        t2 = title2.lower().strip()
        
        if t1 == t2:
            return 1.0
        
        t1_clean = re.sub(r'[\s\-_\.\(\)\[\]【】（）]+', '', t1)
        t2_clean = re.sub(r'[\s\-_\.\(\)\[\]【】（）]+', '', t2)
        
        if t1_clean == t2_clean:
            return 0.95
        
        words1 = set(re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z]+', t1))
        words2 = set(re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z]+', t2))
        
        if not words1 or not words2:
            return 0.0
        
        common_words = words1 & words2
        all_words = words1 | words2
        
        if common_words:
            jaccard = len(common_words) / len(all_words)
            if jaccard >= 0.7:
                return jaccard
        
        if len(t1_clean) > 3 and len(t2_clean) > 3:
            if t1_clean in t2_clean or t2_clean in t1_clean:
                return 0.8
        
        return self._levenshtein_similarity(t1_clean, t2_clean)

    def _levenshtein_similarity(self, s1: str, s2: str) -> float:
        if not s1 or not s2:
            return 0.0
        
        m, n = len(s1), len(s2)
        if m < n:
            return self._levenshtein_similarity(s2, s1)
        if n == 0:
            return 0.0
        
        previous = list(range(n + 1))
        for i, c1 in enumerate(s1):
            current = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous[j + 1] + 1
                deletions = current[j] + 1
                substitutions = previous[j] + (c1 != c2)
                current.append(min(insertions, deletions, substitutions))
            previous = current
        
        distance = previous[n]
        max_len = max(m, n)
        if max_len == 0:
            return 1.0
        return 1.0 - (distance / max_len)

    def _calculate_time_overlap_ratio(self, event1: Event, event2: Event) -> float:
        start_overlap = max(event1.start, event2.start)
        end_overlap = min(event1.end, event2.end)
        
        if start_overlap >= end_overlap:
            return 0.0
        
        overlap_duration = end_overlap - start_overlap
        duration1 = event1.end - event1.start
        duration2 = event2.end - event2.start
        
        if duration1.total_seconds() == 0 or duration2.total_seconds() == 0:
            return 1.0 if start_overlap == end_overlap else 0.0
        
        overlap_ratio1 = overlap_duration / duration1
        overlap_ratio2 = overlap_duration / duration2
        
        return max(overlap_ratio1, overlap_ratio2)

    def _locations_match(self, loc1: str, loc2: str) -> bool:
        if loc1 == loc2:
            return True
        
        if loc1 in loc2 or loc2 in loc1:
            return True
        
        common_keywords = [
            ('教室', 'classroom'),
            ('办公室', 'office'),
            ('体育馆', 'gym'),
            ('图书馆', 'library'),
            ('食堂', 'cafeteria'),
            ('宿舍', 'dormitory'),
            ('实验室', 'lab'),
            ('操场', 'playground'),
        ]
        
        for cn, en in common_keywords:
            if (cn in loc1 or en in loc1) and (cn in loc2 or en in loc2):
                return True
        
        return False

    def _merge_events(self, events: List[Event]) -> Event:
        if not events:
            raise ValueError("No events to merge")
        
        if len(events) == 1:
            return events[0]
        
        main_event = self._select_best_event(events)
        merged = copy.deepcopy(main_event)
        
        merged.merged_from = []
        for event in events:
            if event.uid != main_event.uid:
                merged.merged_from.append(f"{event.title}({event.source_file})")
        
        for event in events:
            if event == main_event:
                continue
            
            if not merged.location and event.location:
                merged.location = event.location
            
            if not merged.description:
                merged.description = event.description
            elif event.description and event.description not in merged.description:
                merged.description = f"{merged.description}\n\n--- 来自 {event.source_file} ---\n{event.description}"
            
            if event.organizer and not merged.organizer:
                merged.organizer = event.organizer
            
            for attendee in event.attendees:
                if attendee not in merged.attendees:
                    merged.attendees.append(attendee)
        
        all_starts = [e.start for e in events]
        all_ends = [e.end for e in events]
        merged.start = min(all_starts)
        merged.end = max(all_ends)
        
        if len(events) > 1:
            source_info = " | ".join([f"{e.title}({e.source_file})" for e in events])
            if merged.description:
                merged.description = f"[合并事件] {source_info}\n\n{merged.description}"
            else:
                merged.description = f"[合并事件] {source_info}"
        
        return merged

    def _select_best_event(self, events: List[Event]) -> Event:
        scored = []
        
        for event in events:
            score = 0
            
            if event.title and len(event.title.strip()) > 0:
                score += 10
                score += min(len(event.title), 20)
            
            if event.location and len(event.location.strip()) > 0:
                score += 15
            
            if event.description and len(event.description.strip()) > 0:
                score += 10
            
            if event.organizer:
                score += 5
            
            if event.attendees:
                score += len(event.attendees)
            
            if not event.all_day and event.duration > timedelta(0):
                score += 5
            
            scored.append((score, event))
        
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    def get_merge_report(self) -> List[Dict[str, Any]]:
        report = []
        for group in self.merged_groups:
            if len(group) < 2:
                continue
            
            report.append({
                "merged_title": group[0].title if group else "Unknown",
                "date": group[0].start.date().isoformat() if group else "Unknown",
                "time": f"{group[0].start.strftime('%H:%M')} - {group[0].end.strftime('%H:%M')}" if group else "Unknown",
                "location": group[0].location or "Unknown",
                "sources": [
                    {
                        "title": e.title,
                        "source_file": e.source_file,
                        "time": f"{e.start.strftime('%H:%M')} - {e.end.strftime('%H:%M')}",
                    }
                    for e in group
                ],
                "count": len(group),
            })
        return report
