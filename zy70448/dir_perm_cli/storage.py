import json
import hashlib
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from tinydb import TinyDB, Query
from .models import SubmissionMaterial, DriftConclusion, CheckStatus


class StorageInitError(Exception):
    """存储初始化失败异常"""
    pass


class StorageManager:
    def __init__(self, db_path: Optional[str] = None):
        self._init_db(db_path)
    
    def _init_db(self, db_path: Optional[str] = None):
        if db_path is None:
            try:
                home_dir = Path.home()
                config_dir = home_dir / ".dir_perm_cli"
                config_dir.mkdir(exist_ok=True)
                db_path = str(config_dir / "db.json")
            except (PermissionError, OSError) as e:
                raise StorageInitError(
                    f"无法创建数据目录 {config_dir}: {str(e)}。请检查主目录权限或使用 --db-path 指定可写路径。"
                ) from e
        
        try:
            self.db = TinyDB(db_path)
        except (PermissionError, OSError) as e:
            raise StorageInitError(
                f"无法打开数据库文件 {db_path}: {str(e)}。请检查文件权限。"
            ) from e
        
        self.submissions_table = self.db.table("submissions")
        self.conclusions_table = self.db.table("conclusions")
        self.materials_table = self.db.table("materials")
    
    @staticmethod
    def _serialize_datetime(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Type {type(obj)} not serializable")
    
    @staticmethod
    def _deserialize_datetime(data):
        for key, value in data.items():
            if isinstance(value, str) and value.endswith("+00:00"):
                try:
                    data[key] = datetime.fromisoformat(value)
                except ValueError:
                    pass
            elif isinstance(value, dict):
                StorageManager._deserialize_datetime(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        StorageManager._deserialize_datetime(item)
        return data
    
    @staticmethod
    def calculate_material_hash(raw_data: Dict[str, Any]) -> str:
        data_str = json.dumps(raw_data, sort_keys=True, default=StorageManager._serialize_datetime)
        return hashlib.sha256(data_str.encode()).hexdigest()
    
    def save_submission(self, material: SubmissionMaterial) -> str:
        material_dict = json.loads(material.model_dump_json())
        existing = self.submissions_table.get(Query().submission_id == material.submission_id)
        if existing:
            raise ValueError(f"提交ID已存在: {material.submission_id}")
        self.submissions_table.insert(material_dict)
        return material.submission_id
    
    def get_submission(self, submission_id: str) -> Optional[SubmissionMaterial]:
        result = self.submissions_table.get(Query().submission_id == submission_id)
        if result:
            result = self._deserialize_datetime(result)
            return SubmissionMaterial(**result)
        return None
    
    def get_submission_by_hash(self, material_hash: str) -> Optional[SubmissionMaterial]:
        result = self.submissions_table.get(Query().material_hash == material_hash)
        if result:
            result = self._deserialize_datetime(result)
            return SubmissionMaterial(**result)
        return None
    
    def get_submissions_by_batch(self, batch_id: str) -> List[SubmissionMaterial]:
        results = self.submissions_table.search(Query().batch_id == batch_id)
        return [SubmissionMaterial(**self._deserialize_datetime(r)) for r in results]
    
    def save_conclusion(self, conclusion: DriftConclusion) -> str:
        conclusion_dict = json.loads(conclusion.model_dump_json())
        existing = self.conclusions_table.get(Query().conclusion_id == conclusion.conclusion_id)
        if existing:
            raise ValueError(f"结论ID已存在: {conclusion.conclusion_id}")
        self.conclusions_table.insert(conclusion_dict)
        return conclusion.conclusion_id
    
    def get_conclusion(self, conclusion_id: str) -> Optional[DriftConclusion]:
        result = self.conclusions_table.get(Query().conclusion_id == conclusion_id)
        if result:
            result = self._deserialize_datetime(result)
            return DriftConclusion(**result)
        return None
    
    def get_conclusion_by_submission(self, submission_id: str) -> Optional[DriftConclusion]:
        result = self.conclusions_table.get(Query().submission_id == submission_id)
        if result:
            result = self._deserialize_datetime(result)
            return DriftConclusion(**result)
        return None
    
    def get_conclusions_by_batch(self, batch_id: str) -> List[DriftConclusion]:
        results = self.conclusions_table.search(Query().batch_id == batch_id)
        return [DriftConclusion(**self._deserialize_datetime(r)) for r in results]
    
    def get_all_submissions(self) -> List[SubmissionMaterial]:
        results = self.submissions_table.all()
        return [SubmissionMaterial(**self._deserialize_datetime(r)) for r in results]
    
    def get_all_conclusions(self) -> List[DriftConclusion]:
        results = self.conclusions_table.all()
        return [DriftConclusion(**self._deserialize_datetime(r)) for r in results]
    
    def delete_submission(self, submission_id: str) -> bool:
        results = self.submissions_table.remove(Query().submission_id == submission_id)
        return len(results) > 0
    
    def delete_conclusion(self, conclusion_id: str) -> bool:
        results = self.conclusions_table.remove(Query().conclusion_id == conclusion_id)
        return len(results) > 0
