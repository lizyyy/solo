"""版本对比与变更检测模块"""

from typing import Dict, List, Tuple, Set, Any
from collections import defaultdict

from .models import (
    AnnotationSample, ChangeRecord, ChangeType,
    VersionDiff, SampleStatus, AnomalyType
)
from .storage import AnnotationStore


class VersionDiffer:
    """版本对比器"""
    
    def __init__(self, store: AnnotationStore):
        self.store = store
    
    def compare_versions(self, base_version: str, target_version: str) -> VersionDiff:
        """对比两个版本的差异"""
        base_samples = {s.sample_id: s for s in self.store.get_all_samples(base_version)}
        target_samples = {s.sample_id: s for s in self.store.get_all_samples(target_version)}
        
        changes: List[ChangeRecord] = []
        new_samples: List[str] = []
        removed_samples: List[str] = []
        
        base_ids = set(base_samples.keys())
        target_ids = set(target_samples.keys())
        
        for sample_id in target_ids - base_ids:
            new_samples.append(sample_id)
            changes.append(ChangeRecord(
                sample_id=sample_id,
                change_type=ChangeType.NEW_SAMPLE,
                explanation=f"新版本新增样本，标签: {target_samples[sample_id].labels}"
            ))
        
        for sample_id in base_ids - target_ids:
            removed_samples.append(sample_id)
            changes.append(ChangeRecord(
                sample_id=sample_id,
                change_type=ChangeType.REMOVED_SAMPLE,
                explanation=f"样本在新版本中被移除，原标签: {base_samples[sample_id].labels}"
            ))
        
        for sample_id in base_ids & target_ids:
            base_sample = base_samples[sample_id]
            target_sample = target_samples[sample_id]
            sample_changes = self._compare_sample(base_sample, target_sample)
            changes.extend(sample_changes)
        
        summary = defaultdict(int)
        for change in changes:
            summary[change.change_type.value] += 1
        
        return VersionDiff(
            base_version=base_version,
            target_version=target_version,
            total_changes=len(changes),
            changes=changes,
            new_samples=new_samples,
            removed_samples=removed_samples,
            summary=dict(summary)
        )
    
    def _compare_sample(self, base: AnnotationSample, target: AnnotationSample) -> List[ChangeRecord]:
        """对比单个样本的变化"""
        changes: List[ChangeRecord] = []
        
        if set(base.labels) != set(target.labels):
            changes.append(ChangeRecord(
                sample_id=target.sample_id,
                change_type=ChangeType.LABEL_CHANGED,
                field="labels",
                old_value=base.labels,
                new_value=target.labels,
                explanation=f"标签变更: {base.labels} → {target.labels}"
            ))
        
        base_metrics = base.meta.metrics
        target_metrics = target.meta.metrics
        for key in set(base_metrics.keys()) | set(target_metrics.keys()):
            bv = base_metrics.get(key)
            tv = target_metrics.get(key)
            if bv != tv:
                changes.append(ChangeRecord(
                    sample_id=target.sample_id,
                    change_type=ChangeType.SCORE_CHANGED,
                    field=f"metrics.{key}",
                    old_value=bv,
                    new_value=tv,
                    explanation=f"指标 {key} 变更: {bv} → {tv}"
                ))
        
        return changes
    
    def mark_version_conflicts(self, version_id: str, base_version: str) -> int:
        """标记版本冲突的样本为待确认状态"""
        diff = self.compare_versions(base_version, version_id)
        samples = self.store.get_all_samples(version_id)
        sample_dict = {s.sample_id: s for s in samples}
        
        marked = 0
        for change in diff.changes:
            if change.sample_id in sample_dict:
                sample = sample_dict[change.sample_id]
                if AnomalyType.VERSION_CONFLICT not in sample.anomalies:
                    sample.anomalies.append(AnomalyType.VERSION_CONFLICT)
                    sample.anomaly_details["version_conflict"] = {
                        "change_type": change.change_type.value,
                        "field": change.field,
                        "old_value": change.old_value,
                        "new_value": change.new_value,
                        "explanation": change.explanation,
                        "base_version": base_version
                    }
                    sample.status = SampleStatus.NEEDS_CONFIRMATION
                    self.store.save_sample(sample, version_id)
                    marked += 1
        
        return marked
    
    def get_change_summary(self, diff: VersionDiff) -> str:
        """生成变更摘要文本"""
        lines = [
            f"版本对比摘要: {diff.base_version} → {diff.target_version}",
            f"总变更数: {diff.total_changes}",
            f"新增样本: {len(diff.new_samples)}",
            f"移除样本: {len(diff.removed_samples)}"
        ]
        
        for change_type, count in diff.summary.items():
            if change_type not in [ChangeType.NEW_SAMPLE.value, ChangeType.REMOVED_SAMPLE.value]:
                lines.append(f"{change_type}: {count}")
        
        if diff.changes:
            lines.append("\n详细变更:")
            for change in diff.changes[:10]:
                lines.append(f"  [{change.change_type.value}] {change.sample_id}: {change.explanation}")
            if len(diff.changes) > 10:
                lines.append(f"  ... 还有 {len(diff.changes) - 10} 条变更")
        
        return "\n".join(lines)
