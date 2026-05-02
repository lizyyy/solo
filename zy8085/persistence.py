import json
import os
from typing import Dict, Any, Optional

class PersistenceManager:
    def __init__(self, data_dir: str = 'data'):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self.notes_file = os.path.join(data_dir, 'order_notes.json')
        self.state_file = os.path.join(data_dir, 'order_states.json')

    def load_notes(self) -> Dict[str, str]:
        if os.path.exists(self.notes_file):
            try:
                with open(self.notes_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}

    def save_notes(self, notes: Dict[str, str]):
        with open(self.notes_file, 'w', encoding='utf-8') as f:
            json.dump(notes, f, ensure_ascii=False, indent=2)

    def load_order_states(self) -> Dict[str, Dict[str, Any]]:
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}

    def save_order_states(self, states: Dict[str, Dict[str, Any]]):
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(states, f, ensure_ascii=False, indent=2)

    def save_single_order_state(self, order_id: str, state_data: Dict[str, Any]):
        states = self.load_order_states()
        states[order_id] = state_data
        self.save_order_states(states)

    def get_order_state(self, order_id: str) -> Optional[Dict[str, Any]]:
        states = self.load_order_states()
        return states.get(order_id)

    def clear_all(self):
        if os.path.exists(self.notes_file):
            os.remove(self.notes_file)
        if os.path.exists(self.state_file):
            os.remove(self.state_file)