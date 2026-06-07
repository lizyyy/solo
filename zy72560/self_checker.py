from typing import List, Dict
from models import SelfCheckResult, ScoreBucketDiff
from yaml_importer import YAMLImporter
from slice_manager import SliceManager
from comparison_manager import ComparisonManager


class SelfChecker:
    def __init__(
        self,
        yaml_importer: YAMLImporter,
        slice_manager: SliceManager,
        comparison_manager: ComparisonManager
    ):
        self.yaml_importer = yaml_importer
        self.slice_manager = slice_manager
        self.comparison_manager = comparison_manager

    def run_all_checks(self, experiment_id: str) -> List[SelfCheckResult]:
        results = []
        results.append(self.check_duplicate_import())
        results.append(self.check_score_bucket_diff(experiment_id))
        results.append(self.check_recalculate_after_review(experiment_id))
        results.append(self.check_export_consistency(experiment_id))
        return results

    def check_duplicate_import(self) -> SelfCheckResult:
        passed = True
        details = {}
        duplicates = []
        
        experiment_hashes = {}
        for exp_id, yaml_obj in self.yaml_importer.imported_yamls.items():
            content_hash = hash(yaml_obj.raw_content)
            if content_hash in experiment_hashes:
                duplicates.append({
                    "experiment_id": exp_id,
                    "duplicate_of": experiment_hashes[content_hash]
                })
                passed = False
            else:
                experiment_hashes[content_hash] = exp_id
        
        details["duplicate_count"] = len(duplicates)
        if duplicates:
            details["duplicates"] = duplicates
        
        message = "重复导入检查通过" if passed else f"发现 {len(duplicates)} 个重复导入"
        return SelfCheckResult(
            check_name="重复导入检查",
            passed=passed,
            message=message,
            details=details
        )

    def check_score_bucket_diff(self, experiment_id: str) -> SelfCheckResult:
        comparison = self.comparison_manager.get_comparison(experiment_id)
        
        if not comparison:
            return SelfCheckResult(
                check_name="分数桶差异检查",
                passed=True,
                message="暂无实验对比数据，跳过检查",
                details={}
            )
        
        diff_level = comparison.score_bucket_diff
        passed = diff_level != ScoreBucketDiff.MORE_THAN_ONE
        
        details = {
            "score_bucket_diff": diff_level.value
        }
        
        if diff_level == ScoreBucketDiff.ONE_BUCKET:
            message = "检测到离线和线上分数差了一个桶，需要评测运营复核"
        elif diff_level == ScoreBucketDiff.MORE_THAN_ONE:
            message = "检测到离线和线上分数差多个桶，请重点核查"
        else:
            message = "分数桶无差异"
        
        return SelfCheckResult(
            check_name="分数桶差异检查",
            passed=passed,
            message=message,
            details=details
        )

    def check_recalculate_after_review(self, experiment_id: str) -> SelfCheckResult:
        comparison = self.comparison_manager.get_comparison(experiment_id)
        
        if not comparison:
            return SelfCheckResult(
                check_name="补录后重算检查",
                passed=True,
                message="暂无实验对比数据，跳过检查",
                details={}
            )
        
        slices = self.slice_manager.get_slices_for_experiment(experiment_id)
        details = {
            "slice_count": len(slices),
            "has_conflicts": len(comparison.conflicts) > 0
        }
        
        pending_conflicts = [
            c for c in comparison.conflicts
            if c.status.value == "待复核"
        ]
        
        passed = True
        if slices and pending_conflicts:
            message = f"存在 {len(pending_conflicts)} 个待复核冲突，请运营确认后再重算"
            details["pending_conflict_count"] = len(pending_conflicts)
        elif slices and not pending_conflicts:
            message = "所有冲突已复核，可以执行补录后重算"
        else:
            message = "暂无评测切片数据"
        
        return SelfCheckResult(
            check_name="补录后重算检查",
            passed=passed,
            message=message,
            details=details
        )

    def check_export_consistency(self, experiment_id: str) -> SelfCheckResult:
        comparison = self.comparison_manager.get_comparison(experiment_id)
        yaml_obj = self.yaml_importer.get_yaml(experiment_id)
        slices = self.slice_manager.get_slices_for_experiment(experiment_id)
        
        details = {}
        passed = True
        messages = []
        
        if yaml_obj and comparison:
            yaml_metric_keys = set(yaml_obj.metrics.keys())
            comp_yaml_keys = set(comparison.yaml_metrics.keys())
            if yaml_metric_keys != comp_yaml_keys:
                passed = False
                messages.append("参数YAML与实验对比中的YAML指标不一致")
                details["yaml_metrics"] = list(yaml_metric_keys)
                details["comparison_yaml_metrics"] = list(comp_yaml_keys)
        
        if slices and comparison:
            if slices:
                latest_slice = slices[-1]
                slice_metric_keys = set(latest_slice.metrics.keys())
                comp_slice_keys = set(comparison.slice_metrics.keys())
                if slice_metric_keys != comp_slice_keys:
                    passed = False
                    messages.append("评测切片与实验对比中的切片指标不一致")
                    details["slice_metrics"] = list(slice_metric_keys)
                    details["comparison_slice_metrics"] = list(comp_slice_keys)
        
        if not messages:
            messages.append("导出数据一致性检查通过")
        
        return SelfCheckResult(
            check_name="导出一致性检查",
            passed=passed,
            message="; ".join(messages),
            details=details
        )

    def format_results(self, results: List[SelfCheckResult]) -> str:
        lines = ["=== 自检报告 ==="]
        passed_count = sum(1 for r in results if r.passed)
        lines.append(f"通过: {passed_count}/{len(results)}")
        lines.append("")
        
        for result in results:
            status = "✅" if result.passed else "⚠️"
            lines.append(f"{status} {result.check_name}: {result.message}")
            if result.details:
                for key, value in result.details.items():
                    if value:
                        lines.append(f"     {key}: {value}")
        
        return "\n".join(lines)
