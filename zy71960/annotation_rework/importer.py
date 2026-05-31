"""数据导入与标签映射模块"""

import json
import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import uuid

from .models import (
    AnnotationSample, AnnotationVersion, Label, LabelMapping,
    SampleStatus, AnomalyType, SampleMeta
)
from .storage import AnnotationStore


class AnnotationImporter:
    """标注数据导入器"""
    
    def __init__(self, store: AnnotationStore):
        self.store = store
    
    def create_version(self, name: str, description: Optional[str] = None,
                       metric_schema: Optional[Dict[str, Any]] = None) -> str:
        """创建新版本"""
        version_id = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
        version = AnnotationVersion(
            version_id=version_id,
            name=name,
            description=description,
            metric_schema=metric_schema or {},
            created_at=datetime.now()
        )
        self.store.save_version(version)
        return version_id
    
    def import_from_json(self, file_path: str, version_id: str,
                         id_field: str = "id", content_fields: Optional[List[str]] = None,
                         label_field: Optional[str] = None) -> Tuple[int, List[str]]:
        """从JSON文件导入样本"""
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            data = [data]
        
        return self._import_samples(data, version_id, id_field, content_fields, label_field)
    
    def import_from_csv(self, file_path: str, version_id: str,
                        id_field: str = "id", content_fields: Optional[List[str]] = None,
                        label_field: Optional[str] = None, delimiter: str = ",") -> Tuple[int, List[str]]:
        """从CSV文件导入样本"""
        data = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            for row in reader:
                data.append(row)
        
        return self._import_samples(data, version_id, id_field, content_fields, label_field)
    
    def _import_samples(self, data: List[Dict], version_id: str,
                        id_field: str, content_fields: Optional[List[str]],
                        label_field: Optional[str]) -> Tuple[int, List[str]]:
        """导入样本数据"""
        imported = 0
        warnings = []
        
        for item in data:
            sample_id = str(item.get(id_field, str(uuid.uuid4())))
            
            if content_fields:
                content = {k: item[k] for k in content_fields if k in item}
            else:
                content = {k: v for k, v in item.items() if k != id_field and k != label_field}
            
            labels = []
            if label_field and label_field in item:
                label_value = item[label_field]
                if isinstance(label_value, list):
                    labels = label_value
                elif isinstance(label_value, str):
                    labels = [l.strip() for l in label_value.split(",") if l.strip()]
                else:
                    labels = [str(label_value)]
            
            meta = SampleMeta()
            if "split" in item:
                meta.split = item["split"]
            if "source" in item:
                meta.source = item["source"]
            if "confidence" in item:
                try:
                    meta.confidence = float(item["confidence"])
                except (ValueError, TypeError):
                    pass
            
            existing = self.store.get_sample(sample_id, version_id)
            if existing:
                warnings.append(f"样本 {sample_id} 已存在，将被覆盖")
            
            sample = AnnotationSample(
                sample_id=sample_id,
                content=content,
                labels=labels,
                meta=meta,
                status=SampleStatus.ANNOTATED if labels else SampleStatus.PENDING
            )
            
            self.store.save_sample(sample, version_id)
            imported += 1
        
        version = self.store.get_version(version_id)
        if version:
            version.sample_count = imported
            self.store.save_version(version)
        
        return imported, warnings


class LabelMapper:
    """标签映射器"""
    
    def __init__(self, store: AnnotationStore):
        self.store = store
    
    def set_label_mappings(self, version_id: str, mappings: List[LabelMapping]) -> None:
        """设置标签映射规则"""
        version = self.store.get_version(version_id)
        if version:
            version.label_mappings = mappings
            self.store.save_version(version)
    
    def add_label_mapping(self, version_id: str, source_label: str,
                          target_label: str, confidence: float = 1.0) -> None:
        """添加单个标签映射"""
        version = self.store.get_version(version_id)
        if not version:
            return
        
        existing = None
        for m in version.label_mappings:
            if m.source_label == source_label:
                existing = m
                break
        
        if existing:
            existing.target_label = target_label
            existing.confidence = confidence
        else:
            version.label_mappings.append(LabelMapping(
                source_label=source_label,
                target_label=target_label,
                confidence=confidence
            ))
        
        self.store.save_version(version)
    
    def apply_mappings(self, version_id: str) -> Tuple[int, List[str]]:
        """应用标签映射到所有样本"""
        version = self.store.get_version(version_id)
        if not version:
            return 0, ["版本不存在"]
        
        mapping_dict = {m.source_label: m for m in version.label_mappings}
        samples = self.store.get_all_samples(version_id)
        updated = 0
        unmapped_labels = set()
        
        for sample in samples:
            new_labels = []
            sample_unmapped = []
            
            for label in sample.labels:
                if label in mapping_dict:
                    new_labels.append(mapping_dict[label].target_label)
                else:
                    sample_unmapped.append(label)
                    unmapped_labels.add(label)
            
            if sample_unmapped:
                if AnomalyType.LABEL_MAPPING_MISSING not in sample.anomalies:
                    sample.anomalies.append(AnomalyType.LABEL_MAPPING_MISSING)
                sample.anomaly_details["unmapped_labels"] = sample_unmapped
                sample.status = SampleStatus.NEEDS_CONFIRMATION
            
            if new_labels != sample.labels:
                sample.labels = new_labels
                self.store.save_sample(sample, version_id)
                updated += 1
        
        warnings = []
        if unmapped_labels:
            warnings.append(f"发现未映射标签: {', '.join(sorted(unmapped_labels))}")
        
        return updated, warnings
