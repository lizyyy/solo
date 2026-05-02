import json
import os
import hashlib
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import pandas as pd


@dataclass
class RoastNote:
    roast_id: str
    roast_name: str
    created_at: str
    updated_at: str
    
    bean_origin: str = ""
    bean_variety: str = ""
    bean_process: str = ""
    roast_level: str = ""
    
    overall_notes: str = ""
    flavor_notes: str = ""
    
    defects: List[str] = None
    positive_aspects: List[str] = None
    
    custom_tags: List[str] = None
    
    roast_date: str = ""
    green_weight: float = None
    roasted_weight: float = None
    weight_loss: float = None
    
    additional_metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.defects is None:
            self.defects = []
        if self.positive_aspects is None:
            self.positive_aspects = []
        if self.custom_tags is None:
            self.custom_tags = []
        if self.additional_metadata is None:
            self.additional_metadata = {}


DEFECT_TAGS = [
    "夹生",
    "烤焦",
    "烟味重",
    "发展不足",
    "发展过度",
    "烘焙不均",
    "豆表过黑",
    "银皮残留",
    "涩味",
    "苦味过重",
    "酸味尖锐",
    "风味平淡",
    "青草味",
    "谷物味",
    "木质味"
]

POSITIVE_TAGS = [
    "酸甜平衡",
    "花香",
    "果香",
    "焦糖甜",
    "巧克力",
    "坚果",
    "醇厚度好",
    "干净",
    "层次丰富",
    "回甘好"
]


class LocalStorage:
    DEFAULT_STORAGE_DIR = ".roast_data"
    NOTES_FILE = "roast_notes.json"
    CACHE_DIR = "cache"

    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            storage_dir = os.path.join(os.getcwd(), self.DEFAULT_STORAGE_DIR)
        
        self.storage_dir = storage_dir
        self.notes_file = os.path.join(storage_dir, self.NOTES_FILE)
        self.cache_dir = os.path.join(storage_dir, self.CACHE_DIR)
        
        self._ensure_directories()
        self._notes_cache: Dict[str, RoastNote] = {}
        self._load_notes()

    def _ensure_directories(self):
        os.makedirs(self.storage_dir, exist_ok=True)
        os.makedirs(self.cache_dir, exist_ok=True)

    def _load_notes(self):
        if not os.path.exists(self.notes_file):
            self._notes_cache = {}
            return

        try:
            with open(self.notes_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            self._notes_cache = {}
            for roast_id, note_data in data.items():
                self._notes_cache[roast_id] = RoastNote(**note_data)
        except (json.JSONDecodeError, IOError):
            self._notes_cache = {}

    def _save_notes(self):
        try:
            data = {}
            for roast_id, note in self._notes_cache.items():
                data[roast_id] = asdict(note)
            
            with open(self.notes_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except IOError as e:
            print(f"保存笔记失败: {e}")

    @staticmethod
    def generate_roast_id(df: pd.DataFrame, filename: str = "") -> str:
        sample_data = ""
        
        if len(df) > 0:
            first_row = df.iloc[0]
            last_row = df.iloc[-1]
            
            time_first = str(first_row.get('time_seconds', '') or first_row.get('time', ''))
            time_last = str(last_row.get('time_seconds', '') or last_row.get('time', ''))
            temp_first = str(first_row.get('bean_temp', ''))
            temp_last = str(last_row.get('bean_temp', ''))
            row_count = str(len(df))
            
            sample_data = f"{time_first}_{time_last}_{temp_first}_{temp_last}_{row_count}"
        
        combined = f"{filename}_{sample_data}_{datetime.now().strftime('%Y%m%d')}"
        hash_obj = hashlib.md5(combined.encode('utf-8'))
        return hash_obj.hexdigest()[:12]

    def get_note(self, roast_id: str) -> Optional[RoastNote]:
        return self._notes_cache.get(roast_id)

    def get_or_create_note(self, roast_id: str, roast_name: str = "") -> RoastNote:
        if roast_id in self._notes_cache:
            return self._notes_cache[roast_id]
        
        now = datetime.now().isoformat()
        note = RoastNote(
            roast_id=roast_id,
            roast_name=roast_name or f"Roast_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            created_at=now,
            updated_at=now
        )
        
        self._notes_cache[roast_id] = note
        self._save_notes()
        return note

    def save_note(self, note: RoastNote) -> bool:
        note.updated_at = datetime.now().isoformat()
        self._notes_cache[note.roast_id] = note
        self._save_notes()
        return True

    def update_note(self, roast_id: str, **kwargs) -> Optional[RoastNote]:
        note = self._notes_cache.get(roast_id)
        if note is None:
            return None

        for key, value in kwargs.items():
            if hasattr(note, key):
                setattr(note, key, value)

        note.updated_at = datetime.now().isoformat()
        self._save_notes()
        return note

    def delete_note(self, roast_id: str) -> bool:
        if roast_id in self._notes_cache:
            del self._notes_cache[roast_id]
            self._save_notes()
            return True
        return False

    def get_all_notes(self) -> Dict[str, RoastNote]:
        return self._notes_cache.copy()

    def search_notes(self, query: str) -> List[RoastNote]:
        results = []
        query_lower = query.lower()

        for note in self._notes_cache.values():
            search_fields = [
                note.roast_name.lower(),
                note.bean_origin.lower(),
                note.bean_variety.lower(),
                note.overall_notes.lower(),
                note.flavor_notes.lower()
            ]
            search_fields.extend([d.lower() for d in note.defects])
            search_fields.extend([p.lower() for p in note.positive_aspects])
            search_fields.extend([t.lower() for t in note.custom_tags])

            if any(query_lower in field for field in search_fields):
                results.append(note)

        return results

    def get_notes_by_defect(self, defect_tag: str) -> List[RoastNote]:
        return [n for n in self._notes_cache.values() if defect_tag in n.defects]

    def get_notes_by_tag(self, tag: str) -> List[RoastNote]:
        return [n for n in self._notes_cache.values() if tag in n.custom_tags]

    def cache_roast_data(self, roast_id: str, df: pd.DataFrame, metadata: Dict) -> bool:
        try:
            cache_file = os.path.join(self.cache_dir, f"{roast_id}_data.parquet")
            meta_file = os.path.join(self.cache_dir, f"{roast_id}_meta.json")

            df.to_parquet(cache_file, engine='pyarrow')
            with open(meta_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            return True
        except Exception as e:
            print(f"缓存数据失败: {e}")
            return False

    def load_cached_roast(self, roast_id: str) -> Optional[Tuple[pd.DataFrame, Dict]]:
        cache_file = os.path.join(self.cache_dir, f"{roast_id}_data.parquet")
        meta_file = os.path.join(self.cache_dir, f"{roast_id}_meta.json")

        if not os.path.exists(cache_file) or not os.path.exists(meta_file):
            return None

        try:
            df = pd.read_parquet(cache_file)
            with open(meta_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            return (df, metadata)
        except Exception as e:
            print(f"加载缓存失败: {e}")
            return None

    def clear_cache(self) -> int:
        cleared = 0
        if os.path.exists(self.cache_dir):
            for filename in os.listdir(self.cache_dir):
                file_path = os.path.join(self.cache_dir, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    cleared += 1
        return cleared

    def export_all_notes(self, filepath: str) -> bool:
        try:
            data = {}
            for roast_id, note in self._notes_cache.items():
                data[roast_id] = asdict(note)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except IOError as e:
            print(f"导出笔记失败: {e}")
            return False

    def import_notes(self, filepath: str, merge: bool = True) -> int:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            imported = 0
            for roast_id, note_data in data.items():
                if merge or roast_id not in self._notes_cache:
                    self._notes_cache[roast_id] = RoastNote(**note_data)
                    imported += 1

            self._save_notes()
            return imported
        except Exception as e:
            print(f"导入笔记失败: {e}")
            return 0
