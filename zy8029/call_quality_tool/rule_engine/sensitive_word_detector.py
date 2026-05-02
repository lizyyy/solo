from typing import List, Dict, Any


class SensitiveWordDetector:
    @staticmethod
    def detect_sensitive_words(transcript: List[Dict[str, Any]], sensitive_words: List[str]) -> List[Dict[str, Any]]:
        violations = []
        
        sorted_turns = sorted(transcript, key=lambda x: x['start_time'])
        
        for turn in sorted_turns:
            text = turn['text']
            for word in sensitive_words:
                if word.lower() in text.lower():
                    violations.append({
                        'type': 'sensitive_word',
                        'word': word,
                        'text': text,
                        'speaker': turn['speaker'],
                        'description': f'敏感词命中: "{word}"',
                        'timestamp': turn['start_time']
                    })
        
        return violations