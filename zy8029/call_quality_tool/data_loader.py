import json
import yaml
from pathlib import Path
from typing import List, Dict, Any


class CallDataLoader:
    def __init__(self):
        self.calls: List[Dict[str, Any]] = []
        self.rules: List[Dict[str, Any]] = []
        self.sensitive_words: List[str] = []

    def load_calls(self, file_path: str) -> List[Dict[str, Any]]:
        path = Path(file_path)
        if path.suffix == '.json':
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    self.calls = data
                elif isinstance(data, dict) and 'calls' in data:
                    self.calls = data['calls']
                else:
                    self.calls = [data]
        return self.calls

    def load_rules(self, file_path: str) -> List[Dict[str, Any]]:
        path = Path(file_path)
        if path.suffix in ['.yaml', '.yml']:
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                if isinstance(data, dict):
                    if 'rules' in data:
                        self.rules = data['rules']
                    else:
                        self.rules = [data]
                else:
                    self.rules = data if isinstance(data, list) else [data]
        elif path.suffix == '.json':
            with open(path, 'r', encoding='utf-8') as f:
                self.rules = json.load(f)
                if isinstance(self.rules, dict):
                    if 'rules' in self.rules:
                        self.rules = self.rules['rules']
                    else:
                        self.rules = [self.rules]
        return self.rules

    def load_sensitive_words(self, file_path: str) -> List[str]:
        path = Path(file_path)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            self.sensitive_words = [
                line.strip() for line in content.split('\n')
                if line.strip() and not line.startswith('#')
            ]
        return self.sensitive_words

    def validate_call_structure(self, call: Dict[str, Any]) -> bool:
        required_fields = ['call_id', 'agent_id', 'utterances']
        for field in required_fields:
            if field not in call:
                return False
        return True

    def sort_utterances_by_time(self, call: Dict[str, Any]) -> Dict[str, Any]:
        if 'utterances' not in call:
            return call
        sorted_utterances = sorted(
            call['utterances'],
            key=lambda x: (x.get('start_time', 0), x.get('end_time', 0))
        )
        call = call.copy()
        call['utterances'] = sorted_utterances
        return call

    def get_call_summary(self) -> Dict[str, Any]:
        if not self.calls:
            return {'total_calls': 0}
        return {
            'total_calls': len(self.calls),
            'total_utterances': sum(len(c.get('utterances', [])) for c in self.calls),
            'agents': list(set(c.get('agent_id', 'unknown') for c in self.calls))
        }
