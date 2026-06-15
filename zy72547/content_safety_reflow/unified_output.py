from typing import Dict, List, Any
import json
from datetime import datetime

from .models import UnifiedResult, ReflowStatus
from .reflow_engine import ReflowEngine


class UnifiedOutput:
    def __init__(self, engine: ReflowEngine):
        self.engine = engine

    def get_api_response(self, sample_id: str) -> Dict[str, Any]:
        result = self.engine.get_result(sample_id)
        if not result:
            return {"error": f"样本 {sample_id} 不存在"}

        return self._result_to_api_format(result)

    def get_api_list_response(self, status_filter: ReflowStatus = None) -> Dict[str, Any]:
        if status_filter:
            results = self.engine.get_results_by_status(status_filter)
        else:
            results = self.engine.get_all_results()

        return {
            "total": len(results),
            "items": [self._result_to_api_format(r) for r in results],
            "generated_at": datetime.now().isoformat(),
            "version": "1.0",
        }

    def get_page_display_data(self, sample_id: str) -> Dict[str, Any]:
        result = self.engine.get_result(sample_id)
        if not result:
            return {"error": f"样本 {sample_id} 不存在"}

        return self._result_to_page_format(result)

    def get_page_list_data(self) -> Dict[str, Any]:
        results = self.engine.get_all_results()
        return {
            "summary": {
                "total": len(results),
                "by_status": self._count_by_status(results),
                "covered_count": sum(1 for r in results if r.is_covered),
                "with_manual_count": sum(1 for r in results if r.active_manual_judgment),
            },
            "items": [self._result_to_page_format(r) for r in results],
        }

    def get_detail_export(self) -> List[Dict[str, Any]]:
        return self.engine.export_details()

    def _result_to_api_format(self, result: UnifiedResult) -> Dict[str, Any]:
        data = {
            "sample_id": result.sample_id,
            "status": result.status.value,
            "current_label": result.current_label,
            "is_covered": result.is_covered,
            "covered_by_batch_id": result.covered_by_batch_id,
            "final_evidence": result.final_evidence,
            "last_updated": result.last_updated.isoformat(),
            "review": {
                "person": result.review_person,
                "time": result.review_time.isoformat() if result.review_time else None,
            },
            "traces": [
                {
                    "time": c.timestamp.isoformat(),
                    "operator": c.operator,
                    "action": c.action,
                    "field": c.field_name,
                    "old": c.old_value,
                    "new": c.new_value,
                    "reason": c.reason,
                }
                for c in result.change_history
            ],
        }

        if result.model_output:
            data["model"] = {
                "batch_id": result.model_output.batch_id,
                "original_line_number": result.model_output.original_line_number,
                "model_version": result.model_output.model_version,
                "predicted_label": result.model_output.predicted_label,
                "confidence": result.model_output.confidence,
                "risk_tags": result.model_output.risk_tags,
                "content_preview": result.model_output.content[:200],
                "import_time": result.model_output.import_time.isoformat(),
            }

        if result.active_manual_judgment:
            data["manual"] = {
                "judgment_id": result.active_manual_judgment.judgment_id,
                "judge_person": result.active_manual_judgment.judge_person,
                "final_label": result.active_manual_judgment.final_label,
                "on_site_statement": result.active_manual_judgment.on_site_statement,
                "change_type": result.active_manual_judgment.change_type.value,
                "judgment_time": result.active_manual_judgment.judgment_time.isoformat(),
                "remarks": result.active_manual_judgment.remarks,
            }

        overridden_judgments = [mj for mj in result.manual_judgments if mj.is_overridden]
        if overridden_judgments:
            data["overridden_manual"] = [
                {
                    "judgment_id": mj.judgment_id,
                    "judge_person": mj.judge_person,
                    "final_label": mj.final_label,
                    "on_site_statement": mj.on_site_statement,
                    "change_type": mj.change_type.value,
                    "is_overridden": True,
                    "override_batch_id": mj.override_batch_id,
                    "override_time": mj.override_time.isoformat() if mj.override_time else None,
                    "remarks": mj.remarks,
                }
                for mj in overridden_judgments
            ]

        if result.manual_judgments:
            data["manual_history"] = [
                {
                    "judgment_id": mj.judgment_id,
                    "judge_person": mj.judge_person,
                    "final_label": mj.final_label,
                    "is_overridden": mj.is_overridden,
                    "override_batch_id": mj.override_batch_id,
                    "judgment_time": mj.judgment_time.isoformat(),
                }
                for mj in result.manual_judgments
            ]

        data["result_explanation"] = self._build_explanation(result)

        return data

    def _build_explanation(self, result: UnifiedResult) -> str:
        parts = []
        if result.model_output:
            parts.append(
                f"模型输出(batch={result.model_output.batch_id}, 行号={result.model_output.original_line_number}): "
                f"预测标签={result.model_output.predicted_label}"
            )
        if result.is_covered:
            parts.append(
                f"此样本人工改判被新批跑({result.covered_by_batch_id})覆盖，当前状态为待复核"
            )
        if result.active_manual_judgment:
            parts.append(
                f"生效人工改判({result.active_manual_judgment.judgment_id}, "
                f"判单人={result.active_manual_judgment.judge_person}): "
                f"最终标签={result.active_manual_judgment.final_label}"
            )
        overridden = [mj for mj in result.manual_judgments if mj.is_overridden]
        if overridden:
            ids = ", ".join(mj.judgment_id for mj in overridden)
            parts.append(
                f"被覆盖的人工改判: {ids}（由批跑{overridden[0].override_batch_id}覆盖）"
            )
        if result.review_person:
            parts.append(f"复核人={result.review_person}")
        if not parts:
            parts.append("尚无处理记录")
        return "; ".join(parts)

    def _result_to_page_format(self, result: UnifiedResult) -> Dict[str, Any]:
        status_display = {
            "pending": "待处理",
            "model_imported": "模型已导入",
            "manual_supplemented": "人工已补看",
            "covered_pending_review": "被覆盖·待复核",
            "review_approved": "复核通过",
            "report_updated": "报告已更新",
            "rollbacked": "已回滚",
            "abnormal": "异常",
        }

        api_data = self._result_to_api_format(result)
        api_data["status_display"] = status_display.get(result.status.value, result.status.value)

        evidence_sections = []
        if result.model_output:
            evidence_sections.append(
                {
                    "source": "模型输出",
                    "batch_id": result.model_output.batch_id,
                    "original_line": result.model_output.original_line_number,
                    "items": result.model_output.evidence_snippets,
                }
            )
        if result.active_manual_judgment:
            evidence_sections.append(
                {
                    "source": "现场说法(生效)",
                    "judge": result.active_manual_judgment.judge_person,
                    "items": [result.active_manual_judgment.on_site_statement],
                }
            )
        overridden_judgments = [mj for mj in result.manual_judgments if mj.is_overridden]
        if overridden_judgments:
            for mj in overridden_judgments:
                evidence_sections.append(
                    {
                        "source": f"现场说法(被覆盖, 覆盖批跑={mj.override_batch_id})",
                        "judge": mj.judge_person,
                        "items": [mj.on_site_statement],
                    }
                )

        api_data["evidence_sections"] = evidence_sections
        return api_data

    def _count_by_status(self, results: List[UnifiedResult]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for r in results:
            key = r.status.value
            counts[key] = counts.get(key, 0) + 1
        return counts

    def to_json(self, data: Any) -> str:
        return json.dumps(data, ensure_ascii=False, indent=2, default=str)
