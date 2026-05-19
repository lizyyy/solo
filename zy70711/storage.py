import json
import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import hashlib

from models import (
    NotebookRecord, ParameterSet, RuntimeEnvironment,
    OutputArtifact, ReviewComment, ArtifactIndex
)


class StorageManager:
    def __init__(self, base_dir: str = "./notebook_artifacts"):
        self.base_dir = Path(base_dir)
        self.records_dir = self.base_dir / "records"
        self.artifacts_dir = self.base_dir / "artifacts"
        self.index_file = self.base_dir / "index.json"
        self._init_directories()

    def _init_directories(self):
        self.records_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

    def save_record(self, record: NotebookRecord) -> str:
        if not record.parameters.signature:
            record.parameters.generate_signature()
        if not record.environment.env_hash:
            record.environment.generate_hash()
        
        record_path = self.records_dir / f"{record.notebook_id}.json"
        with open(record_path, 'w', encoding='utf-8') as f:
            json.dump(record.to_dict(), f, indent=2, ensure_ascii=False)
        
        self._update_index(record.notebook_id)
        return record.notebook_id

    def load_record(self, notebook_id: str) -> Optional[NotebookRecord]:
        record_path = self.records_dir / f"{notebook_id}.json"
        if not record_path.exists():
            return None
        
        with open(record_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self._dict_to_record(data)

    def _dict_to_record(self, data: Dict[str, Any]) -> NotebookRecord:
        params = ParameterSet(**data["parameters"])
        env = RuntimeEnvironment(**data["environment"])
        artifacts = [OutputArtifact(**a) for a in data["artifacts"]]
        reviews = [ReviewComment(**r) for r in data["reviews"]]
        
        record = NotebookRecord(
            notebook_id=data["notebook_id"],
            name=data["name"],
            path=data["path"],
            parameters=params,
            environment=env,
            artifacts=artifacts,
            reviews=reviews,
            review_status=data["review_status"],
            created_at=data["created_at"],
            executed_at=data["executed_at"],
            execution_time=data["execution_time"],
            exit_code=data["exit_code"]
        )
        return record

    def list_records(self) -> List[str]:
        return [f.stem for f in self.records_dir.glob("*.json")]

    def _update_index(self, notebook_id: str):
        index = self.load_index()
        if notebook_id not in index.records:
            index.records.append(notebook_id)
        index.updated_at = datetime.now().isoformat()
        self._save_index(index)

    def load_index(self) -> ArtifactIndex:
        if self.index_file.exists():
            with open(self.index_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return ArtifactIndex(**data)
        return ArtifactIndex()

    def _save_index(self, index: ArtifactIndex):
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(index.__dict__, f, indent=2, ensure_ascii=False)

    def verify_record(self, notebook_id: str) -> Dict[str, Any]:
        record = self.load_record(notebook_id)
        if not record:
            return {"valid": False, "error": "Record not found"}
        
        issues = []
        
        if not record.parameters.verify_signature():
            issues.append("参数签名不匹配 - 参数可能被篡改")
        
        if not record.environment.verify_hash():
            issues.append("环境哈希不匹配 - 运行环境可能被修改")
        
        for artifact in record.artifacts:
            artifact_path = self.artifacts_dir / artifact.path
            if artifact_path.exists():
                with open(artifact_path, 'rb') as f:
                    content = f.read()
                expected_checksum = hashlib.sha256(content).hexdigest()[:16]
                if artifact.checksum != expected_checksum:
                    issues.append(f"制品 {artifact.name} 校验和不匹配")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "record": record.to_dict()
        }

    def archive_record(self, notebook_id: str, archive_path: str) -> bool:
        record = self.load_record(notebook_id)
        if not record:
            return False
        
        archive_dir = Path(archive_path)
        archive_dir.mkdir(parents=True, exist_ok=True)
        
        record_data = record.to_dict()
        record_data["archived_at"] = datetime.now().isoformat()
        
        with open(archive_dir / f"{notebook_id}_archive.json", 'w', encoding='utf-8') as f:
            json.dump(record_data, f, indent=2, ensure_ascii=False)
        
        for artifact in record.artifacts:
            src = self.artifacts_dir / artifact.path
            if src.exists():
                dst = archive_dir / artifact.path
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
        
        return True

    def get_all_records(self) -> List[NotebookRecord]:
        records = []
        for notebook_id in self.list_records():
            record = self.load_record(notebook_id)
            if record:
                records.append(record)
        return records

    def add_artifact_version(self, notebook_id: str, artifact: OutputArtifact, 
                            content: bytes) -> Optional[str]:
        record = self.load_record(notebook_id)
        if not record:
            return None
        
        existing_versions = [a.version for a in record.artifacts if a.name == artifact.name]
        if existing_versions:
            latest = max(existing_versions)
            major, minor, patch = map(int, latest.split('.'))
            artifact.version = f"{major}.{minor}.{patch + 1}"
        
        artifact_dir = self.artifacts_dir / notebook_id
        artifact_dir.mkdir(parents=True, exist_ok=True)
        
        artifact_path = artifact_dir / f"{artifact.artifact_id}_{artifact.name}"
        with open(artifact_path, 'wb') as f:
            f.write(content)
        
        artifact.path = str(artifact_path.relative_to(self.artifacts_dir))
        artifact.generate_checksum(content)
        
        record.add_artifact(artifact)
        self.save_record(record)
        
        return artifact.version

    def add_review(self, notebook_id: str, review: ReviewComment) -> bool:
        record = self.load_record(notebook_id)
        if not record:
            return False
        
        record.add_review(review)
        self.save_record(record)
        return True
