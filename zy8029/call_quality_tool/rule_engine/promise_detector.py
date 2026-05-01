import re
from typing import List, Dict, Any


class PromiseDetector:
    @staticmethod
    def detect_promise_conflicts(transcript: List[Dict[str, Any]], rules: Dict[str, Any]) -> List[Dict[str, Any]]:
        promise_rules = rules.get('promise_rules', {})
        time_patterns = promise_rules.get('time_patterns', [])
        conflict_threshold = promise_rules.get('conflict_threshold_hours', 24)
        
        violations = []
        promises = []
        
        sorted_turns = sorted(transcript, key=lambda x: x['start_time'])
        
        for turn in sorted_turns:
            text = turn['text']
            for pattern in time_patterns:
                matches = re.findall(pattern['regex'], text, re.IGNORECASE)
                for match in matches:
                    promises.append({
                        'text': text,
                        'time_value': int(match),
                        'time_unit': pattern['unit'],
                        'timestamp': turn['start_time'],
                        'speaker': turn['speaker']
                    })
        
        for i in range(len(promises)):
            for j in range(i + 1, len(promises)):
                p1, p2 = promises[i], promises[j]
                if p1['time_unit'] == p2['time_unit']:
                    diff = abs(p1['time_value'] - p2['time_value'])
                    if p1['time_unit'] == 'hour':
                        diff_hours = diff
                    elif p1['time_unit'] == 'day':
                        diff_hours = diff * 24
                    else:
                        diff_hours = diff / 60
                    
                    if diff_hours > conflict_threshold:
                        violations.append({
                            'type': 'promise_conflict',
                            'first_promise': f"{p1['time_value']}{p1['time_unit']}",
                            'second_promise': f"{p2['time_value']}{p2['time_unit']}",
                            'first_text': p1['text'],
                            'second_text': p2['text'],
                            'description': f'承诺时效矛盾: {p1["time_value"]}{p1["time_unit"]} vs {p2["time_value"]}{p2["time_unit"]}',
                            'timestamp': p2['timestamp']
                        })
        
        return violations