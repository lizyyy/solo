from typing import List, Dict, Any


class OpeningDetector:
    @staticmethod
    def detect_opening_missing(transcript: List[Dict[str, Any]], rules: Dict[str, Any]) -> Dict[str, Any]:
        opening_rules = rules.get('opening_rules', {})
        required_phrases = opening_rules.get('required_phrases', [])
        max_time_seconds = opening_rules.get('max_time_seconds', 30)
        agent_role = opening_rules.get('agent_role', 'agent')
        
        violations = []
        
        agent_texts = []
        total_time = 0
        
        sorted_turns = sorted(transcript, key=lambda x: x['start_time'])
        
        for turn in sorted_turns:
            if turn['speaker'] == agent_role:
                agent_texts.append(turn['text'])
                total_time = turn['end_time']
                if total_time > max_time_seconds:
                    break
        
        full_agent_text = ' '.join(agent_texts)
        
        for phrase in required_phrases:
            if phrase.lower() not in full_agent_text.lower():
                violations.append({
                    'type': 'opening_missing',
                    'missing_phrase': phrase,
                    'description': f'开场白缺少必要话术: {phrase}',
                    'timestamp': total_time
                })
        
        return violations