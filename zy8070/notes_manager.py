import json
import os
from datetime import datetime


class NotesManager:
    def __init__(self, storage_path=None):
        if storage_path is None:
            storage_path = os.path.join(os.path.dirname(__file__), 'data', 'notes.json')

        self.storage_path = storage_path
        self._ensure_storage_dir()
        self.notes = self._load_notes()

    def _ensure_storage_dir(self):
        dir_path = os.path.dirname(self.storage_path)
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)

    def _load_notes(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {}
        return {}

    def _save_notes(self):
        with open(self.storage_path, 'w', encoding='utf-8') as f:
            json.dump(self.notes, f, ensure_ascii=False, indent=2)

    def get_note(self, segment_id):
        return self.notes.get(str(segment_id), '')

    def save_note(self, segment_id, content):
        self.notes[str(segment_id)] = content
        self._save_notes()

    def clear_note(self, segment_id):
        if str(segment_id) in self.notes:
            del self.notes[str(segment_id)]
            self._save_notes()

    def get_all_notes(self):
        return self.notes.copy()