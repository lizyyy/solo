"""数据存储层"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import uuid

from .models import (
    AnnotationSample, AnnotationVersion, ReviewLog,
    SampleStatus, LabelMapping, Label
)


class AnnotationStore:
    """标注数据存储"""
    
    def __init__(self, base_path: str = "./data"):
        self.base_path = Path(base_path)
        self._init_dirs()
        
    def _init_dirs(self):
        (self.base_path / "samples").mkdir(parents=True, exist_ok=True)
        (self.base_path / "versions").mkdir(parents=True, exist_ok=True)
        (self.base_path / "reviews").mkdir(parents=True, exist_ok=True)
        (self.base_path / "labels").mkdir(parents=True, exist_ok=True)
    
    def save_sample(self, sample: AnnotationSample, version_id: str) -> str:
        """保存样本"""
        sample.updated_at = datetime.now()
        version_path = self.base_path / "samples" / version_id
        version_path.mkdir(exist_ok=True)
        
        file_path = version_path / f"{sample.sample_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(sample.model_dump(mode="json"), f, ensure_ascii=False, indent=2)
        return sample.sample_id
    
    def get_sample(self, sample_id: str, version_id: str) -> Optional[AnnotationSample]:
        """获取样本"""
        file_path = self.base_path / "samples" / version_id / f"{sample_id}.json"
        if not file_path.exists():
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            return AnnotationSample.model_validate_json(f.read())
    
    def get_all_samples(self, version_id: str) -> List[AnnotationSample]:
        """获取指定版本的所有样本"""
        version_path = self.base_path / "samples" / version_id
        if not version_path.exists():
            return []
        
        samples = []
        for file_path in version_path.glob("*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                samples.append(AnnotationSample.model_validate_json(f.read()))
        return samples
    
    def save_version(self, version: AnnotationVersion) -> str:
        """保存版本信息"""
        file_path = self.base_path / "versions" / f"{version.version_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(version.model_dump(mode="json"), f, ensure_ascii=False, indent=2)
        return version.version_id
    
    def get_version(self, version_id: str) -> Optional[AnnotationVersion]:
        """获取版本信息"""
        file_path = self.base_path / "versions" / f"{version_id}.json"
        if not file_path.exists():
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            return AnnotationVersion.model_validate_json(f.read())
    
    def list_versions(self) -> List[AnnotationVersion]:
        """列出所有版本"""
        versions = []
        for file_path in (self.base_path / "versions").glob("*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                versions.append(AnnotationVersion.model_validate_json(f.read()))
        return sorted(versions, key=lambda v: v.created_at, reverse=True)
    
    def add_review_log(self, log: ReviewLog) -> str:
        """添加复核日志"""
        file_path = self.base_path / "reviews" / f"{log.log_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(log.model_dump(mode="json"), f, ensure_ascii=False, indent=2)
        return log.log_id
    
    def get_sample_history(self, sample_id: str) -> List[Tuple[str, ReviewLog]]:
        """获取样本的复核历史（跨版本）"""
        history = []
        for file_path in (self.base_path / "reviews").glob("*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                log = ReviewLog.model_validate_json(f.read())
                if log.sample_id == sample_id:
                    history.append((file_path.stem, log))
        return sorted(history, key=lambda x: x[1].created_at, reverse=True)
    
    def save_labels(self, labels: List[Label], version_id: str) -> None:
        """保存标签定义"""
        file_path = self.base_path / "labels" / f"{version_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump([l.model_dump(mode="json") for l in labels], f, ensure_ascii=False, indent=2)
    
    def get_labels(self, version_id: str) -> List[Label]:
        """获取标签定义"""
        file_path = self.base_path / "labels" / f"{version_id}.json"
        if not file_path.exists():
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            return [Label.model_validate(l) for l in json.load(f)]
