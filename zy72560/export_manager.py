import json
import yaml
from datetime import datetime
from typing import Dict, Any, Optional
from models import ParameterYAML, ExperimentComparison
from history_tracker import HistoryTracker


class ExportManager:
    def __init__(
        self,
        yaml_importer,
        slice_manager,
        comparison_manager,
        history_tracker: HistoryTracker,
        self_checker
    ):
        self.yaml_importer = yaml_importer
        self.slice_manager = slice_manager
        self.comparison_manager = comparison_manager
        self.history_tracker = history_tracker
        self.self_checker = self_checker

    def export_experiment(self, experiment_id: str, operator: str = "系统") -> Dict[str, Any]:
        yaml_obj = self.yaml_importer.get_yaml(experiment_id)
        comparison = self.comparison_manager.get_comparison(experiment_id)
        slices = self.slice_manager.get_slices_for_experiment(experiment_id)
        history = self.history_tracker.get_experiment_history(experiment_id)
        self_check_results = self.self_checker.run_all_checks(experiment_id)
        
        if not yaml_obj or not comparison:
            return {
                "success": False,
                "message": "实验数据不完整，无法导出",
                "data": None
            }
        
        export_data = {
            "export_info": {
                "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "exported_by": operator,
                "experiment_id": experiment_id,
                "experiment_name": comparison.experiment_name
            },
            "parameter_yaml": {
                "version": yaml_obj.version,
                "import_time": yaml_obj.import_time.strftime("%Y-%m-%d %H:%M:%S"),
                "import_id": yaml_obj.import_id,
                "parameters": yaml_obj.parameters,
                "metrics": yaml_obj.metrics,
                "conclusion": yaml_obj.conclusion
            },
            "yaml_version_history": [
                {
                    "version": v.version,
                    "import_time": v.import_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "is_latest": v.is_latest,
                    "content_hash": v.content_hash[:8]
                }
                for v in self.yaml_importer.get_all_versions(experiment_id)
            ],
            "evaluation_slices": [
                {
                    "slice_id": s.slice_id,
                    "upload_time": s.upload_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "uploader": s.uploader,
                    "source": s.source,
                    "metrics": s.metrics,
                    "score_distribution": s.score_distribution,
                    "notes": s.notes
                }
                for s in slices
            ],
            "experiment_comparison": {
                "yaml_metrics": comparison.yaml_metrics,
                "slice_metrics": comparison.slice_metrics,
                "metric_diffs": comparison.metric_diffs,
                "score_bucket_diff": comparison.score_bucket_diff.value,
                "conflicts": [
                    {
                        "field_name": c.field_name,
                        "yaml_value": c.yaml_value,
                        "slice_value": c.slice_value,
                        "description": c.description,
                        "status": c.status.value,
                        "reviewer": c.reviewer,
                        "review_time": c.review_time.strftime("%Y-%m-%d %H:%M:%S") if c.review_time else None
                    }
                    for c in comparison.conflicts
                ],
                "last_update_time": comparison.last_update_time.strftime("%Y-%m-%d %H:%M:%S")
            },
            "self_check": [
                {
                    "check_name": r.check_name,
                    "passed": r.passed,
                    "message": r.message,
                    "details": r.details
                }
                for r in self_check_results
            ],
            "history_log": [
                {
                    "timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "action": r.action,
                    "operator": r.operator,
                    "details": r.details
                }
                for r in history
            ],
            "summary": self._build_summary(experiment_id, comparison, self_check_results, slices)
        }
        
        self.history_tracker.add_record(
            experiment_id=experiment_id,
            action="导出实验数据",
            operator=operator,
            details=f"导出实验 {comparison.experiment_name} 的完整数据，包含 {len(slices)} 个评测切片、{len(comparison.conflicts)} 个冲突记录",
            before_state={"exported_before": False},
            after_state={"exported": True}
        )
        
        return {
            "success": True,
            "message": "导出成功",
            "data": export_data
        }

    def _build_summary(
        self,
        experiment_id: str,
        comparison: ExperimentComparison,
        self_check_results,
        slices
    ) -> Dict[str, Any]:
        all_passed = all(r.passed for r in self_check_results)
        
        has_one_bucket = any(
            r.check_name == "分数桶差异检查" and "差了一个桶" in r.message
            for r in self_check_results
        )
        
        pending_conflicts = [
            c for c in comparison.conflicts
            if c.status.value == "待复核"
        ]
        
        return {
            "status": "可导出" if all_passed else "存在异常，请复核后再导出",
            "all_checks_passed": all_passed,
            "has_score_bucket_diff": has_one_bucket,
            "pending_conflict_count": len(pending_conflicts),
            "slice_count": len(slices),
            "yaml_import_count": self.yaml_importer.get_import_count(experiment_id),
            "recommendation": self._get_recommendation(has_one_bucket, pending_conflicts, all_passed)
        }

    def _get_recommendation(self, has_one_bucket, pending_conflicts, all_passed) -> str:
        if pending_conflicts:
            return f"还有 {len(pending_conflicts)} 个冲突待复核，请评测运营确认或驳回后再归档"
        if has_one_bucket:
            return "离线和线上分数差了一个桶，已标记保留，请评测运营重点关注后再决定是否归档"
        if all_passed:
            return "所有自检通过，可以导出并归档"
        return "存在自检未通过项，请核查后再导出"

    def export_to_json(self, experiment_id: str, file_path: str, operator: str = "系统") -> Dict[str, Any]:
        result = self.export_experiment(experiment_id, operator)
        if not result["success"]:
            return result
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(result["data"], f, ensure_ascii=False, indent=2)
        
        result["file_path"] = file_path
        result["message"] = f"已导出到 {file_path}"
        return result

    def export_to_yaml(self, experiment_id: str, file_path: str, operator: str = "系统") -> Dict[str, Any]:
        result = self.export_experiment(experiment_id, operator)
        if not result["success"]:
            return result
        
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(result["data"], f, allow_unicode=True, default_flow_style=False)
        
        result["file_path"] = file_path
        result["message"] = f"已导出到 {file_path}"
        return result

    def format_export_summary(self, export_result: Dict[str, Any]) -> str:
        if not export_result["success"]:
            return f"导出失败: {export_result['message']}"
        
        data = export_result["data"]
        summary = data["summary"]
        
        lines = []
        lines.append("=== 导出结果 ===")
        lines.append(f"实验: {data['export_info']['experiment_name']}")
        lines.append(f"导出时间: {data['export_info']['export_time']}")
        lines.append(f"导出人: {data['export_info']['exported_by']}")
        lines.append("")
        lines.append(f"状态: {'✅ 可导出归档' if summary['all_checks_passed'] else '⚠️ 存在异常'}")
        lines.append(f"YAML导入次数: {summary['yaml_import_count']}")
        lines.append(f"评测切片数: {summary['slice_count']}")
        lines.append(f"待复核冲突: {summary['pending_conflict_count']}")
        lines.append(f"分数桶差异: {'是（差一个桶，需重点关注）' if summary['has_score_bucket_diff'] else '无'}")
        lines.append("")
        lines.append(f"建议: {summary['recommendation']}")
        lines.append("")
        lines.append("--- 自检结果 ---")
        for check in data["self_check"]:
            status = "✅" if check["passed"] else "⚠️"
            lines.append(f"  {status} {check['check_name']}: {check['message']}")
        
        return "\n".join(lines)
