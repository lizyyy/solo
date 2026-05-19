from typing import List, Dict
from datetime import datetime


class GapDetector:
    def __init__(
        self,
        gap_threshold: int = 1800,
        session_timeout: int = 3600,
        time_field: str = "event_time"
    ):
        self.gap_threshold = gap_threshold
        self.session_timeout = session_timeout
        self.time_field = time_field

    def detect_gaps(self, sessions: List[Dict]) -> List[Dict]:
        for session in sessions:
            gaps = []
            events = session['events']
            
            for i in range(1, len(events)):
                prev_event = events[i - 1]
                curr_event = events[i]
                
                time_diff = curr_event['_parsed_time'] - prev_event['_parsed_time']
                
                if time_diff > self.gap_threshold:
                    prev_source = prev_event['_source']
                    curr_source = curr_event['_source']
                    
                    gap_type = self._classify_gap(
                        time_diff,
                        prev_source,
                        curr_source
                    )
                    
                    gap = {
                        'gap_index': i,
                        'gap_duration_seconds': time_diff,
                        'gap_type': gap_type,
                        'prev_event': {
                            'time': prev_event[self.time_field],
                            'source_file': prev_source['file'],
                            'source_line': prev_source['line']
                        },
                        'next_event': {
                            'time': curr_event[self.time_field],
                            'source_file': curr_source['file'],
                            'source_line': curr_source['line']
                        },
                        'cross_file': prev_source['file'] != curr_source['file']
                    }
                    
                    gaps.append(gap)
                    
                    curr_event['_gap_info'] = {
                        'has_gap_before': True,
                        'gap_duration_seconds': time_diff,
                        'gap_type': gap_type
                    }
            
            session['gaps'] = gaps
            session['gap_count'] = len(gaps)
            session['total_gap_seconds'] = sum(g['gap_duration_seconds'] for g in gaps)
            
            if gaps:
                session['has_gaps'] = True
                session['max_gap_seconds'] = max(g['gap_duration_seconds'] for g in gaps)
            else:
                session['has_gaps'] = False
                session['max_gap_seconds'] = 0
        
        return sessions

    def _classify_gap(self, time_diff: float, prev_source: Dict, curr_source: Dict) -> str:
        if prev_source['file'] != curr_source['file']:
            if time_diff > self.session_timeout:
                return "cross_file_session_timeout"
            else:
                return "cross_file_shard_gap"
        else:
            if time_diff > self.session_timeout:
                return "same_file_session_timeout"
            else:
                return "same_file_data_missing"
