from typing import List, Dict, Any


class SilenceDetector:
    @staticmethod
    def detect_long_silence(transcript: List[Dict[str, Any]], rules: Dict[str, Any]) -> List[Dict[str, Any]]:
        silence_rules = rules.get('silence_rules', {})
        max_silence_seconds = silence_rules.get('max_silence_seconds', 10)
        
        violations = []
        
        sorted_turns = sorted(transcript, key=lambda x: x['start_time'])
        
        for i in range(1, len(sorted_turns)):
            prev_end = sorted_turns[i-1]['end_time']
            curr_start = sorted_turns[i]['start_time']
            silence_duration = curr_start - prev_end
            
            if silence_duration > max_silence_seconds:
                violations.append({
                    'type': 'long_silence',
                    'duration': round(silence_duration, 1),
                    'description': f'长时间静默: {round(silence_duration, 1)}秒',
                    'timestamp': prev_end
                })
        
        return violations