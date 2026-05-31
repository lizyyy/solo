from typing import Dict, Any, List, Tuple
from models import TrainingLog


class VersionComparator:
    def compare(self, new_log: TrainingLog, old_log: TrainingLog) -> Dict[str, Any]:
        changes = {}

        metric_changes = self._compare_metrics(new_log, old_log)
        if metric_changes:
            changes["metrics"] = metric_changes

        feature_changes = self._compare_feature_stats(new_log, old_log)
        if feature_changes:
            changes["feature_stats"] = feature_changes

        label_changes = self._compare_label_mapping(new_log, old_log)
        if label_changes:
            changes["label_mapping"] = label_changes

        training_set_changes = self._compare_training_sets(new_log, old_log)
        if training_set_changes:
            changes["training_set"] = training_set_changes

        return {
            "has_changes": bool(changes),
            "old_version": old_log.version,
            "new_version": new_log.version,
            "old_log_id": old_log.log_id,
            "new_log_id": new_log.log_id,
            "changes": changes,
            "summary": self._generate_summary(changes)
        }

    def _compare_metrics(self, new_log: TrainingLog, old_log: TrainingLog) -> Dict[str, Any]:
        new_metrics = set(new_log.metrics.keys())
        old_metrics = set(old_log.metrics.keys())

        added = new_metrics - old_metrics
        removed = old_metrics - new_metrics
        changed = {}

        for metric in new_metrics & old_metrics:
            new_val = new_log.metrics[metric]
            old_val = old_log.metrics[metric]
            if abs(new_val - old_val) > 1e-9:
                changed[metric] = {
                    "old": old_val,
                    "new": new_val,
                    "diff": new_val - old_val,
                    "diff_percent": round((new_val - old_val) / old_val * 100, 2) if old_val != 0 else float('inf')
                }

        if added or removed or changed:
            return {
                "added": list(added),
                "removed": list(removed),
                "changed": changed
            }
        return {}

    def _compare_feature_stats(self, new_log: TrainingLog, old_log: TrainingLog) -> Dict[str, Any]:
        new_features = set(new_log.feature_stats.keys())
        old_features = set(old_log.feature_stats.keys())

        added = new_features - old_features
        removed = old_features - new_features

        if added or removed:
            return {
                "added": list(added),
                "removed": list(removed)
            }
        return {}

    def _compare_label_mapping(self, new_log: TrainingLog, old_log: TrainingLog) -> Dict[str, Any]:
        new_labels = set(new_log.label_mapping.keys())
        old_labels = set(old_log.label_mapping.keys())

        added = new_labels - old_labels
        removed = old_labels - new_labels
        remapped = {}

        for label in new_labels & old_labels:
            if new_log.label_mapping[label] != old_log.label_mapping[label]:
                remapped[label] = {
                    "old": old_log.label_mapping[label],
                    "new": new_log.label_mapping[label]
                }

        if added or removed or remapped:
            return {
                "added": list(added),
                "removed": list(removed),
                "remapped": remapped
            }
        return {}

    def _compare_training_sets(self, new_log: TrainingLog, old_log: TrainingLog) -> Dict[str, Any]:
        new_ids = set(new_log.training_set_ids)
        old_ids = set(old_log.training_set_ids)

        added = new_ids - old_ids
        removed = old_ids - new_ids

        if added or removed:
            return {
                "added_count": len(added),
                "removed_count": len(removed),
                "added_samples": list(added)[:10],
                "removed_samples": list(removed)[:10]
            }
        return {}

    def _generate_summary(self, changes: Dict[str, Any]) -> str:
        summary_parts: List[str] = []

        if "metrics" in changes:
            m = changes["metrics"]
            if m.get("added"):
                summary_parts.append(f"指标新增 {len(m['added'])} 项")
            if m.get("removed"):
                summary_parts.append(f"指标删除 {len(m['removed'])} 项")
            if m.get("changed"):
                summary_parts.append(f"指标值变动 {len(m['changed'])} 项")

        if "feature_stats" in changes:
            f = changes["feature_stats"]
            if f.get("added"):
                summary_parts.append(f"特征新增 {len(f['added'])} 项")
            if f.get("removed"):
                summary_parts.append(f"特征删除 {len(f['removed'])} 项")

        if "label_mapping" in changes:
            lm = changes["label_mapping"]
            if lm.get("added"):
                summary_parts.append(f"标签新增 {len(lm['added'])} 项")
            if lm.get("removed"):
                summary_parts.append(f"标签删除 {len(lm['removed'])} 项")
            if lm.get("remapped"):
                summary_parts.append(f"标签重映射 {len(lm['remapped'])} 项")

        if "training_set" in changes:
            ts = changes["training_set"]
            if ts.get("added_count"):
                summary_parts.append(f"训练集新增 {ts['added_count']} 个样本")
            if ts.get("removed_count"):
                summary_parts.append(f"训练集移除 {ts['removed_count']} 个样本")

        return "；".join(summary_parts) if summary_parts else "无显著变化"

    def format_changes_for_display(self, comparison_result: Dict[str, Any]) -> str:
        if not comparison_result["has_changes"]:
            return "训练日志内容无变化。"

        lines = [f"版本变化汇总：{comparison_result['summary']}", ""]
        changes = comparison_result["changes"]

        if "metrics" in changes:
            lines.append("【指标变更】")
            m = changes["metrics"]
            if m.get("added"):
                lines.append(f"  新增: {', '.join(m['added'])}")
            if m.get("removed"):
                lines.append(f"  删除: {', '.join(m['removed'])}")
            if m.get("changed"):
                lines.append("  变动:")
                for name, vals in m["changed"].items():
                    sign = "+" if vals["diff"] > 0 else ""
                    lines.append(f"    {name}: {vals['old']} → {vals['new']} ({sign}{vals['diff_percent']}%)")
            lines.append("")

        if "label_mapping" in changes:
            lines.append("【标签映射变更】")
            lm = changes["label_mapping"]
            if lm.get("added"):
                lines.append(f"  新增标签: {', '.join(lm['added'])}")
            if lm.get("removed"):
                lines.append(f"  删除标签: {', '.join(lm['removed'])}")
            if lm.get("remapped"):
                lines.append("  重映射:")
                for label, vals in lm["remapped"].items():
                    lines.append(f"    {label}: {vals['old']} → {vals['new']}")
            lines.append("")

        if "feature_stats" in changes:
            lines.append("【特征统计变更】")
            f = changes["feature_stats"]
            if f.get("added"):
                lines.append(f"  新增特征: {', '.join(f['added'])}")
            if f.get("removed"):
                lines.append(f"  删除特征: {', '.join(f['removed'])}")
            lines.append("")

        if "training_set" in changes:
            lines.append("【训练集变更】")
            ts = changes["training_set"]
            if ts.get("added_count"):
                lines.append(f"  新增样本数: {ts['added_count']}")
                if ts.get("added_samples"):
                    lines.append(f"  示例: {', '.join(ts['added_samples'])}")
            if ts.get("removed_count"):
                lines.append(f"  移除样本数: {ts['removed_count']}")
                if ts.get("removed_samples"):
                    lines.append(f"  示例: {', '.join(ts['removed_samples'])}")
            lines.append("")

        return "\n".join(lines)
