from typing import List, Dict, Any
from .opening_detector import OpeningDetector
from .promise_detector import PromiseDetector
from .sensitive_word_detector import SensitiveWordDetector
from .silence_detector import SilenceDetector


class QualityEngine:
    def __init__(self, rules: Dict[str, Any], sensitive_words: List[str]):
        self.rules = rules
        self.sensitive_words = sensitive_words
    
    def analyze_call(self, call_data: Dict[str, Any]) -> Dict[str, Any]:
        transcript = call_data['transcript']
        
        violations = []
        violations.extend(OpeningDetector.detect_opening_missing(transcript, self.rules))
        violations.extend(PromiseDetector.detect_promise_conflicts(transcript, self.rules))
        violations.extend(SensitiveWordDetector.detect_sensitive_words(transcript, self.sensitive_words))
        violations.extend(SilenceDetector.detect_long_silence(transcript, self.rules))
        
        return {
            'call_id': call_data['call_id'],
            'agent_id': call_data['agent_id'],
            'agent_name': call_data['agent_name'],
            'violations': violations,
            'violation_count': len(violations),
            'call_duration': self._calculate_call_duration(transcript)
        }
    
    def analyze_calls(self, calls_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        results = []
        for call in calls_data:
            results.append(self.analyze_call(call))
        return results
    
    @staticmethod
    def _calculate_call_duration(transcript: List[Dict[str, Any]]) -> float:
        if not transcript:
            return 0
        sorted_turns = sorted(transcript, key=lambda x: x['start_time'])
        return sorted_turns[-1]['end_time'] - sorted_turns[0]['start_time']