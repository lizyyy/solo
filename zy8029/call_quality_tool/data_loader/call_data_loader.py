import json
from typing import List, Dict, Any


class CallDataLoader:
    @staticmethod
    def load_transcripts(file_path: str) -> List[Dict[str, Any]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def validate_transcript(transcript: Dict[str, Any]) -> bool:
        required_fields = ['call_id', 'agent_id', 'agent_name', 'transcript']
        if not all(field in transcript for field in required_fields):
            return False
        
        if not isinstance(transcript['transcript'], list):
            return False
        
        for turn in transcript['transcript']:
            if not all(key in turn for key in ['speaker', 'start_time', 'end_time', 'text']):
                return False
            if not isinstance(turn['start_time'], (int, float)) or not isinstance(turn['end_time'], (int, float)):
                return False
        
        return True