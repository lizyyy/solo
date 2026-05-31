"""异常检测模块 - 检测标签漏映射、指标口径变化、训练集泄漏"""

import hashlib
from typing import Dict, List, Set, Tuple, Any
from collections import defaultdict

from .models import (
    AnnotationSample, SampleStatus, AnomalyType,
    AnnotationVersion
)
from .storage import AnnotationStore


class AnomalyDetector:
    """异常检测器"""
    
    def __init__(self, store: AnnotationStore):
        self.store = store
    
    def run_all_checks(self, version_id: str) -> Dict[str, int]:
        """运行所有异常检测"""
        results = {}
        
        results["label_missing"] = self.check_missing_labels(version_id)
        results["metric_changed"] = self.check_metric_schema_changes(version_id)
        results["train_leakage"] = self.check_train_leakage(version_id)
        results["duplicate"] = self.check_duplicate_samples(version_id)
        results["inconsistent"] = self.check_inconsistent_annotations(version_id)
        
        return results
    
    def check_missing_labels(self, version_id: str) -> int:
        """检查标签缺失或未映射"""
        samples = self.store.get_all_samples(version_id)
        marked = 0
        
        for sample in samples:
            if not sample.labels:
                if AnomalyType.LABEL_MISSING not in sample.anomalies:
                    sample.anomalies.append(AnomalyType.LABEL_MISSING)
                    sample.anomaly_details["label_missing"] = "样本没有标注标签"
                    sample.status = SampleStatus.NEEDS_CONFIRMATION
                    self.store.save_sample(sample, version_id)
                    marked += 1
        
        return marked
    
    def check_metric_schema_changes(self, version_id: str, reference_version: str = None) -> int:
        """检查指标口径变化"""
        version = self.store.get_version(version_id)
        if not version:
            return 0
        
        if not reference_version:
            versions = self.store.list_versions()
            versions = [v for v in versions if v.version_id != version_id]
            if versions:
                reference_version = versions[0].version_id
            else:
                return 0
        
        ref_version = self.store.get_version(reference_version)
        if not ref_version:
            return 0
        
        ref_schema = ref_version.metric_schema
        current_schema = version.metric_schema
        
        schema_changes = self._compare_schemas(ref_schema, current_schema)
        
        if not schema_changes:
            return 0
        
        samples = self.store.get_all_samples(version_id)
        marked = 0
        
        for sample in samples:
            if AnomalyType.METRIC_CHANGED not in sample.anomalies:
                sample.anomalies.append(AnomalyType.METRIC_CHANGED)
                sample.anomaly_details["metric_changed"] = {
                    "reference_version": reference_version,
                    "schema_changes": schema_changes,
                    "explanation": f"指标口径发生变化: {', '.join(schema_changes.keys())}"
                }
                sample.status = SampleStatus.NEEDS_CONFIRMATION
                self.store.save_sample(sample, version_id)
                marked += 1
        
        return marked
    
    def _compare_schemas(self, old: Dict, new: Dict) -> Dict[str, str]:
        """对比两个指标schema的变化"""
        changes = {}
        
        old_keys = set(old.keys())
        new_keys = set(new.keys())
        
        for key in new_keys - old_keys:
            changes[key] = f"新增指标: {new[key]}"
        
        for key in old_keys - new_keys:
            changes[key] = f"移除指标: {old[key]}"
        
        for key in old_keys & new_keys:
            if old[key] != new[key]:
                changes[key] = f"指标定义变更: {old[key]} → {new[key]}"
        
        return changes
    
    def check_train_leakage(self, version_id: str) -> int:
        """检查训练集泄漏（测试集样本出现在训练集中）"""
        samples = self.store.get_all_samples(version_id)
        
        content_hashes: Dict[str, List[Tuple[str, str]]] = defaultdict(list)
        for sample in samples:
            content_hash = self._hash_content(sample.content)
            split = sample.meta.split or "unknown"
            content_hashes[content_hash].append((sample.sample_id, split))
        
        marked = 0
        for content_hash, occurrences in content_hashes.items():
            if len(occurrences) > 1:
                splits = {split for _, split in occurrences}
                if "train" in splits and ("test" in splits or "val" in splits):
                    for sample_id, split in occurrences:
                        sample = self.store.get_sample(sample_id, version_id)
                        if sample and AnomalyType.TRAIN_LEAKAGE not in sample.anomalies:
                            sample.anomalies.append(AnomalyType.TRAIN_LEAKAGE)
                            sample.anomaly_details["train_leakage"] = {
                                "content_hash": content_hash,
                                "duplicate_in_splits": [o[1] for o in occurrences],
                                "duplicate_sample_ids": [o[0] for o in occurrences],
                                "explanation": f"样本内容同时出现在训练集和{split}集中，可能导致数据泄漏"
                            }
                            sample.status = SampleStatus.NEEDS_CONFIRMATION
                            self.store.save_sample(sample, version_id)
                            marked += 1
        
        return marked
    
    def check_duplicate_samples(self, version_id: str) -> int:
        """检查重复样本"""
        samples = self.store.get_all_samples(version_id)
        
        content_hashes: Dict[str, List[str]] = defaultdict(list)
        for sample in samples:
            content_hash = self._hash_content(sample.content)
            content_hashes[content_hash].append(sample.sample_id)
        
        marked = 0
        for content_hash, sample_ids in content_hashes.items():
            if len(sample_ids) > 1:
                for sample_id in sample_ids:
                    sample = self.store.get_sample(sample_id, version_id)
                    if sample and AnomalyType.DUPLICATE_SAMPLE not in sample.anomalies:
                        sample.anomalies.append(AnomalyType.DUPLICATE_SAMPLE)
                        sample.anomaly_details["duplicate_sample"] = {
                            "content_hash": content_hash,
                            "duplicate_ids": sample_ids,
                            "explanation": f"存在 {len(sample_ids)} 个内容相同的样本"
                        }
                        self.store.save_sample(sample, version_id)
                        marked += 1
        
        return marked
    
    def check_inconsistent_annotations(self, version_id: str) -> int:
        """检查相同内容但标注不一致的样本"""
        samples = self.store.get_all_samples(version_id)
        
        content_to_labels: Dict[str, List[Tuple[str, List[str]]]] = defaultdict(list)
        for sample in samples:
            content_hash = self._hash_content(sample.content)
            content_to_labels[content_hash].append((sample.sample_id, sorted(sample.labels)))
        
        marked = 0
        for content_hash, annotations in content_to_labels.items():
            if len(annotations) > 1:
                unique_labels = set(tuple(labels) for _, labels in annotations)
                if len(unique_labels) > 1:
                    for sample_id, labels in annotations:
                        sample = self.store.get_sample(sample_id, version_id)
                        if sample and AnomalyType.INCONSISTENT_ANNOTATION not in sample.anomalies:
                            sample.anomalies.append(AnomalyType.INCONSISTENT_ANNOTATION)
                            sample.anomaly_details["inconsistent_annotation"] = {
                                "content_hash": content_hash,
                                "all_annotations": [
                                    {"sample_id": s, "labels": l} for s, l in annotations
                                ],
                                "explanation": f"相同内容的样本标注不一致: {unique_labels}"
                            }
                            sample.status = SampleStatus.NEEDS_CONFIRMATION
                            self.store.save_sample(sample, version_id)
                            marked += 1
        
        return marked
    
    def _hash_content(self, content: Dict[str, Any]) -> str:
        """计算内容的哈希值用于去重检测"""
        content_str = str(sorted(content.items()))
        return hashlib.md5(content_str.encode("utf-8")).hexdigest()
    
    def get_anomaly_summary(self, version_id: str) -> Dict[str, Any]:
        """获取异常检测摘要"""
        samples = self.store.get_all_samples(version_id)
        
        anomaly_counts: Dict[str, int] = defaultdict(int)
        anomaly_samples: Dict[str, List[str]] = defaultdict(list)
        
        for sample in samples:
            for anomaly in sample.anomalies:
                anomaly_counts[anomaly.value] += 1
                anomaly_samples[anomaly.value].append(sample.sample_id)
        
        status_counts: Dict[str, int] = defaultdict(int)
        for sample in samples:
            status_counts[sample.status.value] += 1
        
        needs_confirmation = [
            s.sample_id for s in samples if s.status == SampleStatus.NEEDS_CONFIRMATION
        ]
        
        return {
            "version_id": version_id,
            "total_samples": len(samples),
            "anomaly_counts": dict(anomaly_counts),
            "anomaly_samples": dict(anomaly_samples),
            "status_counts": dict(status_counts),
            "needs_confirmation_count": len(needs_confirmation),
            "needs_confirmation_samples": needs_confirmation
        }
