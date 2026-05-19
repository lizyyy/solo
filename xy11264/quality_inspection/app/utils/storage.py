import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from app.models import InspectionRecord, SensitiveWord, BadRecord
from app.utils.masking import generate_content_hash


class DataStorage:
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        self.records_file = self.data_dir / 'inspection_records.json'
        self.sensitive_words_file = self.data_dir / 'sensitive_words.json'
        self.bad_records_file = self.data_dir / 'bad_records.json'
        self.hash_index_file = self.data_dir / 'hash_index.json'
        
        self._init_files()
        
        self._records: Dict[str, InspectionRecord] = {}
        self._sensitive_words: Dict[str, SensitiveWord] = {}
        self._bad_records: Dict[str, BadRecord] = {}
        self._hash_index: Dict[str, str] = {}
        
        self._load_all()
    
    def _init_files(self):
        for file_path in [
            self.records_file,
            self.sensitive_words_file,
            self.bad_records_file,
            self.hash_index_file,
        ]:
            if not file_path.exists():
                file_path.write_text('{}', encoding='utf-8')
    
    def _load_all(self):
        self._load_records()
        self._load_sensitive_words()
        self._load_bad_records()
        self._load_hash_index()
    
    def _load_records(self):
        data = json.loads(self.records_file.read_text(encoding='utf-8'))
        for record_id, record_data in data.items():
            try:
                self._records[record_id] = InspectionRecord(**record_data)
            except Exception as e:
                print(f"Error loading record {record_id}: {e}")
    
    def _load_sensitive_words(self):
        data = json.loads(self.sensitive_words_file.read_text(encoding='utf-8'))
        for word_id, word_data in data.items():
            try:
                self._sensitive_words[word_id] = SensitiveWord(**word_data)
            except Exception as e:
                print(f"Error loading sensitive word {word_id}: {e}")
    
    def _load_bad_records(self):
        data = json.loads(self.bad_records_file.read_text(encoding='utf-8'))
        for record_id, record_data in data.items():
            try:
                self._bad_records[record_id] = BadRecord(**record_data)
            except Exception as e:
                print(f"Error loading bad record {record_id}: {e}")
    
    def _load_hash_index(self):
        data = json.loads(self.hash_index_file.read_text(encoding='utf-8'))
        self._hash_index = data
    
    def _save_records(self):
        data = {rid: r.dict() for rid, r in self._records.items()}
        self.records_file.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    
    def _save_sensitive_words(self):
        data = {wid: w.dict() for wid, w in self._sensitive_words.items()}
        self.sensitive_words_file.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    
    def _save_bad_records(self):
        data = {bid: b.dict() for bid, b in self._bad_records.items()}
        self.bad_records_file.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    
    def _save_hash_index(self):
        self.hash_index_file.write_text(json.dumps(self._hash_index, ensure_ascii=False, indent=2), encoding='utf-8')
    
    def check_duplicate(self, content_hash: str) -> Optional[str]:
        return self._hash_index.get(content_hash)
    
    def add_record(self, record: InspectionRecord) -> bool:
        if record.imported_hash in self._hash_index:
            return False
        self._records[record.id] = record
        self._hash_index[record.imported_hash] = record.id
        self._save_records()
        self._save_hash_index()
        return True
    
    def get_record(self, record_id: str) -> Optional[InspectionRecord]:
        return self._records.get(record_id)
    
    def get_record_by_call_id(self, call_id: str) -> Optional[InspectionRecord]:
        for record in self._records.values():
            if record.call_id == call_id:
                return record
        return None
    
    def get_all_records(self) -> List[InspectionRecord]:
        return list(self._records.values())
    
    def update_record(self, record: InspectionRecord) -> bool:
        if record.id not in self._records:
            return False
        self._records[record.id] = record
        self._save_records()
        return True
    
    def delete_record(self, record_id: str) -> bool:
        if record_id not in self._records:
            return False
        record = self._records.pop(record_id)
        if record.imported_hash in self._hash_index:
            del self._hash_index[record.imported_hash]
            self._save_hash_index()
        self._save_records()
        return True
    
    def add_sensitive_word(self, word: SensitiveWord) -> bool:
        if word.id in self._sensitive_words:
            return False
        self._sensitive_words[word.id] = word
        self._save_sensitive_words()
        return True
    
    def get_sensitive_word(self, word_id: str) -> Optional[SensitiveWord]:
        return self._sensitive_words.get(word_id)
    
    def get_all_sensitive_words(self) -> List[SensitiveWord]:
        return [w for w in self._sensitive_words.values() if w.enabled]
    
    def update_sensitive_word(self, word: SensitiveWord) -> bool:
        if word.id not in self._sensitive_words:
            return False
        self._sensitive_words[word.id] = word
        self._save_sensitive_words()
        return True
    
    def delete_sensitive_word(self, word_id: str) -> bool:
        if word_id not in self._sensitive_words:
            return False
        del self._sensitive_words[word_id]
        self._save_sensitive_words()
        return True
    
    def add_bad_record(self, bad_record: BadRecord) -> str:
        content_hash = generate_content_hash({
            "source_file": bad_record.source_file,
            "original_position": bad_record.original_position,
            "raw_content": bad_record.raw_content,
        })
        for existing in self._bad_records.values():
            existing_hash = generate_content_hash({
                "source_file": existing.source_file,
                "original_position": existing.original_position,
                "raw_content": existing.raw_content,
            })
            if existing_hash == content_hash:
                return existing.id
        self._bad_records[bad_record.id] = bad_record
        self._save_bad_records()
        return bad_record.id
    
    def get_bad_record(self, record_id: str) -> Optional[BadRecord]:
        return self._bad_records.get(record_id)
    
    def get_all_bad_records(self) -> List[BadRecord]:
        return list(self._bad_records.values())
    
    def clear_all(self):
        self._records.clear()
        self._sensitive_words.clear()
        self._bad_records.clear()
        self._hash_index.clear()
        self._save_records()
        self._save_sensitive_words()
        self._save_bad_records()
        self._save_hash_index()


_storage_instance = None


def get_storage() -> DataStorage:
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = DataStorage()
    return _storage_instance
