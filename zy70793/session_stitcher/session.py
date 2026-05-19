from typing import List, Dict
from collections import defaultdict


class SessionStitcher:
    def __init__(
        self,
        user_field: str = "user_id",
        session_field: str = "session_id",
        time_field: str = "event_time"
    ):
        self.user_field = user_field
        self.session_field = session_field
        self.time_field = time_field

    def stable_sort_key(self, event: Dict) -> tuple:
        return (
            event['_parsed_time'],
            event.get(self.user_field, ''),
            event.get(self.session_field, ''),
            event['_source']['file'],
            event['_source']['line']
        )

    def group_by_user_session(self, events: List[Dict]) -> Dict[str, List[Dict]]:
        grouped = defaultdict(list)
        
        for event in events:
            user_id = event[self.user_field]
            session_id = event[self.session_field]
            key = f"{user_id}||{session_id}"
            grouped[key].append(event)
        
        return grouped

    def stitch_sessions(self, events: List[Dict]) -> List[Dict]:
        events_sorted = sorted(events, key=self.stable_sort_key)
        
        grouped = self.group_by_user_session(events_sorted)
        
        sessions = []
        
        for key, session_events in grouped.items():
            user_id, session_id = key.split('||', 1)
            
            first_event = session_events[0]
            last_event = session_events[-1]
            
            session = {
                'user_id': user_id,
                'session_id': session_id,
                'start_time': first_event['_parsed_time'],
                'end_time': last_event['_parsed_time'],
                'event_count': len(session_events),
                'events': session_events,
                'sources': list({e['_source']['file'] for e in session_events})
            }
            
            sessions.append(session)
        
        sessions_sorted = sorted(
            sessions,
            key=lambda s: (s['user_id'], s['start_time'], s['session_id'])
        )
        
        return sessions_sorted
