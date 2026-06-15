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
        results.append(self.check_duplicate_import(experiment_id))
        results.append(self.check_score_bucket_diff(experiment_id))
        results.append(self.check_recalculate_after_review(experiment_id))
        results.append(self.check_export_consistency(experiment_id))
        return results

    def check_duplicate_import(self, experiment_id: str) -> SelfCheckResult:
        dup_info = self.yaml_importer.get_duplicate_info(experiment_id)
        details = dup_info.copy()
        
        if dup_info["total_imports"] == 0:
            return SelfCheckResult(
                check_name="重复导入检查",
                passed=True,
                message="暂无导入记录",
                details=details
            )
        
        if dup_info["total_imports"] == 1:
            passed = True
            message = "仅导入1次，无重复"
        elif dup_info["has_duplicate"]:
            passed = False
            message = f"共导入{dup_info['total_imports']}次，其中{dup_info['duplicate_count']}次内容完全重复"
        else:
            passed = True
            message = f"共导入{dup_info['total_imports']}次，均为不同版本更新，无内容重复"
        
        versions = self.yaml_importer.get_all_versions(experiment_id)
        details["version_history"] = [
            {
                "import_id": v.import_id[:8],
                "version": v.version,
                "import_time": v.import_time.strftime("%Y-%m-%d %H:%M:%S"),
                "is_latest": v.is_latest,
                "content_hash": v.content_hash[:8]
            }
            for v in versions
        ]
        
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
        passed = diff_level == ScoreBucketDiff.NONE
        
        details = {
            "score_bucket_diff": diff_level.value
        }
        
        if diff_level == ScoreBucketDiff.ONE_BUCKET:
            message = "离线和线上分数差了一个桶，需要评测运营复核，不归为正常"
        elif diff_level == ScoreBucketDiff.MORE_THAN_ONE:
            message = "离线和线上分数差多个桶，请重点核查"
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
            "has_conflicts": len(comparison.conflicts) > 0,
            "conflict_total": len(comparison.conflicts)
        }
        
        pending_conflicts = [
            c for c in comparison.conflicts
            if c.status.value == "待复核"
        ]
        confirmed_conflicts = [
            c for c in comparison.conflicts
            if c.status.value == "已确认"
        ]
        rejected_conflicts = [
            c for c in comparison.conflicts
            if c.status.value == "已驳回"
        ]
        
        details["pending_count"] = len(pending_conflicts)
        details["confirmed_count"] = len(confirmed_conflicts)
        details["rejected_count"] = len(rejected_conflicts)
        
        if not slices:
            passed = True
            message = "暂无评测切片数据"
        elif pending_conflicts:
            passed = False
            message = f"存在 {len(pending_conflicts)} 个待复核冲突，请运营确认或驳回后再重算"
        else:
            passed = True
            message = "所有冲突已处理完毕，可以执行补录后重算"
        
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
        latest_slice = slices[-1] if slices else None
        
        details = {}
        passed = True
        messages = []
        
        if yaml_obj and comparison:
            yaml_metric_keys = set(yaml_obj.metrics.keys())
            comp_yaml_keys = set(comparison.yaml_metrics.keys())
            if yaml_metric_keys != comp_yaml_keys:
                passed = False
                messages.append("参数YAML与实验对比中的YAML指标不一致")
                details["yaml_metrics"] = sorted(list(yaml_metric_keys))
                details["comparison_yaml_metrics"] = sorted(list(comp_yaml_keys))
            else:
                for k in yaml_metric_keys:
                    if yaml_obj.metrics[k] != comparison.yaml_metrics[k]:
                        passed = False
                        messages.append(f"指标 {k} 在参数YAML和实验对比中数值不一致")
        
        if latest_slice and comparison:
            slice_metric_keys = set(latest_slice.metrics.keys())
            comp_slice_keys = set(comparison.slice_metrics.keys())
            if slice_metric_keys != comp_slice_keys:
                passed = False
                messages.append("评测切片与实验对比中的切片指标不一致")
                details["slice_metrics"] = sorted(list(slice_metric_keys))
                details["comparison_slice_metrics"] = sorted(list(comp_slice_keys))
            else:
                for k in slice_metric_keys:
                    if latest_slice.metrics[k] != comparison.slice_metrics[k]:
                        passed = False
                        messages.append(f"指标 {k} 在评测切片和实验对比中数值不一致")
        
        if yaml_obj and comparison:
            if yaml_obj.experiment_name != comparison.experiment_name:
                passed = False
                messages.append("实验名称在参数YAML和实验对比中不一致")
        
        details["export_ready"] = passed
        details["yaml_version"] = yaml_obj.version if yaml_obj else None
        details["slice_count"] = len(slices)
        
        if not messages:
            messages.append("导出数据一致性检查通过，数据可导出")
        
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
                    if isinstance(value, list):
                        lines.append(f"     {key}: (共{len(value)}项)")
                    elif value is not None and value != "":
                        lines.append(f"     {key}: {value}")
        
        return "\n".join(lines)
