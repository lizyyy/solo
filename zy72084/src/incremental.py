import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import copy

from .config import ParameterManager
from .estimator import HoleSample, save_results_to_dict


class IncrementalProcessor:
    def __init__(self, param_manager: ParameterManager,
                 previous_results_path: Optional[str] = None):
        self.pm = param_manager
        self.previous_results_path = previous_results_path
        self.previous_samples: Dict[str, HoleSample] = {}
        self._load_previous_results()

    def _load_previous_results(self) -> None:
        if not self.previous_results_path or not os.path.exists(self.previous_results_path):
            return

        try:
            with open(self.previous_results_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            if "samples" in data:
                for sample_data in data["samples"]:
                    sample = self._dict_to_sample(sample_data)
                    self.previous_samples[sample.sample_id] = sample
        except json.JSONDecodeError:
            print(f"[警告] 无法解析之前的结果文件 {self.previous_results_path}")

    def _dict_to_sample(self, data: Dict[str, Any]) -> HoleSample:
        sample = HoleSample(
            sample_id=data["sample_id"],
            raw_data=data.get("raw_data", {}),
            source=data.get("source", "unknown")
        )
        sample.estimated_area = data.get("estimated_area")
        if data.get("confidence_interval"):
            sample.confidence_interval = tuple(data["confidence_interval"])
        sample.estimation_method = data.get("estimation_method")
        sample.processed_at = data.get("processed_at")
        sample.metadata = data.get("metadata", {})
        sample.is_anomaly = data.get("is_anomaly", False)
        sample.anomaly_reasons = data.get("anomaly_reasons", [])
        sample.manual_override = data.get("manual_override")
        sample.manual_note = data.get("manual_note")
        sample.manual_operator = data.get("manual_operator")
        return sample

    def merge_with_previous(self, new_samples: List[HoleSample]) -> List[HoleSample]:
        merged = []
        seen_ids = set()

        for new_sample in new_samples:
            seen_ids.add(new_sample.sample_id)

            if new_sample.sample_id in self.previous_samples:
                prev = self.previous_samples[new_sample.sample_id]
                merged_sample = self._merge_samples(prev, new_sample)
                merged.append(merged_sample)
            else:
                merged.append(new_sample)

        for sample_id, prev_sample in self.previous_samples.items():
            if sample_id not in seen_ids:
                merged.append(copy.deepcopy(prev_sample))

        return merged

    def _merge_samples(self, previous: HoleSample,
                       new: HoleSample) -> HoleSample:
        merged = copy.deepcopy(new)

        if previous.manual_override is not None:
            merged.manual_override = previous.manual_override
            merged.manual_note = previous.manual_note
            merged.manual_operator = previous.manual_operator
            merged.metadata["retained_manual_override"] = True
            merged.metadata["previous_processed_at"] = previous.processed_at

        if previous.metadata.get("manual_notes"):
            if "manual_notes" not in merged.metadata:
                merged.metadata["manual_notes"] = []
            merged.metadata["manual_notes"].extend(previous.metadata["manual_notes"])

        return merged

    def generate_diff_report(self, previous_samples: List[HoleSample],
                            new_samples: List[HoleSample]) -> Dict[str, Any]:
        prev_map = {s.sample_id: s for s in previous_samples}
        new_map = {s.sample_id: s for s in new_samples}

        all_ids = set(list(prev_map.keys()) + list(new_map.keys()))

        added = []
        removed = []
        modified = []
        unchanged = []

        for sid in all_ids:
            if sid in new_map and sid not in prev_map:
                s = new_map[sid]
                added.append(self._sample_diff_summary(s, None, "added"))
            elif sid in prev_map and sid not in new_map:
                s = prev_map[sid]
                removed.append(self._sample_diff_summary(None, s, "removed"))
            else:
                diff = self._compare_samples(prev_map[sid], new_map[sid])
                if diff["has_changes"]:
                    modified.append(diff)
                else:
                    unchanged.append(self._sample_diff_summary(new_map[sid],
                                                              prev_map[sid],
                                                              "unchanged"))

        return {
            "generated_at": datetime.now().isoformat(),
            "previous_result_file": self.previous_results_path,
            "summary": {
                "total_previous": len(prev_map),
                "total_new": len(new_map),
                "added": len(added),
                "removed": len(removed),
                "modified": len(modified),
                "unchanged": len(unchanged)
            },
            "added_samples": added,
            "removed_samples": removed,
            "modified_samples": modified,
            "unchanged_samples": unchanged,
            "parameter_changes": self._get_parameter_changes()
        }

    def _sample_diff_summary(self, new: Optional[HoleSample],
                            old: Optional[HoleSample],
                            status: str) -> Dict[str, Any]:
        s = new if new else old
        return {
            "sample_id": s.sample_id if s else "unknown",
            "status": status,
            "final_area_new": new.manual_override if (new and new.manual_override is not None) else (new.estimated_area if new else None),
            "final_area_old": old.manual_override if (old and old.manual_override is not None) else (old.estimated_area if old else None),
            "has_manual_override_new": new.manual_override is not None if new else False,
            "has_manual_override_old": old.manual_override is not None if old else False,
            "is_anomaly_new": new.is_anomaly if new else False,
            "is_anomaly_old": old.is_anomaly if old else False,
            "source": s.source if s else "unknown"
        }

    def _compare_samples(self, previous: HoleSample,
                         new: HoleSample) -> Dict[str, Any]:
        changes = []
        has_changes = False

        prev_final = previous.manual_override if previous.manual_override is not None else previous.estimated_area
        new_final = new.manual_override if new.manual_override is not None else new.estimated_area

        if prev_final != new_final:
            has_changes = True
            changes.append({
                "field": "final_area",
                "old": prev_final,
                "new": new_final,
                "explanation": f"面积从 {prev_final:.3f} 变为 {new_final:.3f}"
            })

        if previous.is_anomaly != new.is_anomaly:
            has_changes = True
            changes.append({
                "field": "is_anomaly",
                "old": previous.is_anomaly,
                "new": new.is_anomaly,
                "explanation": "异常状态变化：" + ("标记为异常" if new.is_anomaly else "恢复为正常")
            })

        if previous.anomaly_reasons != new.anomaly_reasons:
            has_changes = True
            added_reasons = [r for r in new.anomaly_reasons if r not in previous.anomaly_reasons]
            removed_reasons = [r for r in previous.anomaly_reasons if r not in new.anomaly_reasons]
            changes.append({
                "field": "anomaly_reasons",
                "added": added_reasons,
                "removed": removed_reasons,
                "explanation": f"新增 {len(added_reasons)} 条异常原因，移除 {len(removed_reasons)} 条"
            })

        if previous.estimation_method != new.estimation_method:
            has_changes = True
            changes.append({
                "field": "estimation_method",
                "old": previous.estimation_method,
                "new": new.estimation_method,
                "explanation": f"估算方法从 {previous.estimation_method} 变为 {new.estimation_method}"
            })

        if new.manual_override is not None and previous.manual_override is None:
            has_changes = True
            changes.append({
                "field": "manual_override",
                "old": None,
                "new": new.manual_override,
                "explanation": f"新增人工修正：{new.manual_override:.3f}（操作员：{new.manual_operator}）"
            })

        if new.metadata.get("retained_manual_override"):
            changes.append({
                "field": "manual_override",
                "status": "retained",
                "explanation": "保留了前一次的人工修正值，未被算法覆盖"
            })

        return {
            "sample_id": new.sample_id,
            "has_changes": has_changes,
            "changes": changes,
            "final_area_old": prev_final,
            "final_area_new": new_final,
            "source": new.source
        }

    def _get_parameter_changes(self) -> Dict[str, Any]:
        diff = self.pm.diff_from_default()
        if not diff:
            return {
                "has_changes": False,
                "message": "所有参数使用默认值，无人工调整"
            }
        return {
            "has_changes": True,
            "message": f"共有 {len(diff)} 个参数被人工调整",
            "modified_params": diff
        }

    def add_manual_note(self, samples: List[HoleSample],
                        sample_id: str, note: str,
                        operator: str = "unknown") -> bool:
        for sample in samples:
            if sample.sample_id == sample_id:
                if "manual_notes" not in sample.metadata:
                    sample.metadata["manual_notes"] = []
                sample.metadata["manual_notes"].append({
                    "timestamp": datetime.now().isoformat(),
                    "operator": operator,
                    "note": note
                })
                return True
        return False

    def add_manual_override(self, samples: List[HoleSample],
                           sample_id: str, override_value: float,
                           note: str, operator: str = "unknown") -> bool:
        for sample in samples:
            if sample.sample_id == sample_id:
                sample.manual_override = override_value
                sample.manual_note = note
                sample.manual_operator = operator
                sample.metadata["last_manual_update"] = datetime.now().isoformat()
                return True
        return False

    def save_diff_report(self, diff_report: Dict[str, Any],
                        output_path: str) -> None:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(diff_report, f, indent=2, ensure_ascii=False)

    def format_diff_for_display(self, diff_report: Dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("增量处理差异报告")
        lines.append("=" * 60)
        lines.append(f"生成时间: {diff_report['generated_at']}")
        if diff_report.get("previous_result_file"):
            lines.append(f"对比基准: {diff_report['previous_result_file']}")
        lines.append("")

        s = diff_report["summary"]
        lines.append("概览:")
        lines.append(f"  原有样本: {s['total_previous']} 个")
        lines.append(f"  现有样本: {s['total_new']} 个")
        lines.append(f"  新增: {s['added']} 个 | 移除: {s['removed']} 个")
        lines.append(f"  修改: {s['modified']} 个 | 未变: {s['unchanged']} 个")
        lines.append("")

        if diff_report["parameter_changes"]["has_changes"]:
            lines.append("参数变更:")
            lines.append(f"  {diff_report['parameter_changes']['message']}")
            for key, info in diff_report["parameter_changes"]["modified_params"].items():
                lines.append(f"    - {key}: {info['default']} → {info['current']}")
            lines.append("")

        if diff_report["added_samples"]:
            lines.append(f"新增样本 ({len(diff_report['added_samples'])}):")
            for s in diff_report["added_samples"]:
                lines.append(f"  + {s['sample_id']}: {s['final_area_new']:.3f} mm² (来源: {s['source']})")
            lines.append("")

        if diff_report["removed_samples"]:
            lines.append(f"移除样本 ({len(diff_report['removed_samples'])}):")
            for s in diff_report["removed_samples"]:
                lines.append(f"  - {s['sample_id']}: 原有值 {s['final_area_old']:.3f} mm²")
            lines.append("")

        if diff_report["modified_samples"]:
            lines.append(f"修改样本 ({len(diff_report['modified_samples'])}):")
            for s in diff_report["modified_samples"]:
                lines.append(f"  * {s['sample_id']}: {s['final_area_old']:.3f} → {s['final_area_new']:.3f} mm²")
                for change in s["changes"]:
                    lines.append(f"    - {change['explanation']}")
            lines.append("")

        if diff_report["unchanged_samples"]:
            lines.append(f"未变样本 ({len(diff_report['unchanged_samples'])}): 略")
            lines.append("")

        return "\n".join(lines)
