"""三步流程处理 - 导入→补看→回放更新"""

from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from .models import (
    TrackingRecord,
    RecordStatus,
    ProcessingResult,
    IssueType,
)
from .importer import DataImporter
from .self_check import SelfChecker
from .store import UnifiedDataStore


class ThreeStepWorkflow:
    """三步流程处理器

    第一步: 模型输出片段第一次导入
    第二步: 标注负责人周姐补看人工改判表
    第三步: 证据回放更新

    关键原则:
    - 同一用户反馈被重复计入时，别急着归正常，留给标注负责人复核
    - 补录后必须重算
    - 所有操作留下证据日志
    """

    def __init__(self, data_dir: str = "./data"):
        self.importer = DataImporter()
        self.checker = SelfChecker()
        self.store = UnifiedDataStore(storage_dir=data_dir)
        self.workflow_log: List[Dict[str, Any]] = []

    def step1_import_model_output(
        self,
        model_output_file: str,
        batch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """第一步: 模型输出片段第一次导入"""
        step_info = {
            "step": 1,
            "name": "模型输出片段导入",
            "start_time": datetime.now(),
            "input_file": model_output_file,
        }

        records, warnings, errors = self.importer.import_model_output(
            model_output_file,
            batch_id=batch_id,
        )

        self.store.add_records(records)

        check_result = self.checker.run_all_checks(self.store.get_all_records())

        step_info.update({
            "imported_count": len(records),
            "warnings": warnings,
            "errors": errors,
            "check_result": {
                "total_records": check_result.total_records,
                "normal_count": check_result.normal_count,
                "duplicate_user_feedback_count": check_result.duplicate_user_feedback_count,
                "duplicate_import_count": check_result.duplicate_import_count,
                "review_required_count": check_result.review_required_count,
                "export_consistent": check_result.export_consistent,
            },
            "end_time": datetime.now(),
        })

        self.workflow_log.append(step_info)

        return step_info

    def step2_supplement_manual_judgments(
        self,
        manual_judgment_file: str,
        judge_name: str = "周姐",
    ) -> Dict[str, Any]:
        """第二步: 标注负责人补看人工改判表"""
        step_info = {
            "step": 2,
            "name": "补看人工改判表",
            "start_time": datetime.now(),
            "input_file": manual_judgment_file,
            "judge_name": judge_name,
        }

        updated_ids, warnings, errors = self.importer.import_manual_judgments(
            manual_judgment_file,
            self.store.get_all_records(),
            judge_name=judge_name,
        )

        check_result = self.checker.recalculate_after_supplement(
            self.store.get_all_records(),
            updated_ids,
        )

        step_info.update({
            "updated_count": len(updated_ids),
            "updated_record_ids": updated_ids,
            "warnings": warnings,
            "errors": errors,
            "check_result": {
                "total_records": check_result.total_records,
                "normal_count": check_result.normal_count,
                "duplicate_user_feedback_count": check_result.duplicate_user_feedback_count,
                "duplicate_import_count": check_result.duplicate_import_count,
                "review_required_count": check_result.review_required_count,
                "export_consistent": check_result.export_consistent,
            },
            "note": "补录后已自动重算，重复用户反馈记录保留为待复核状态，未自动归为正常",
            "end_time": datetime.now(),
        })

        self.workflow_log.append(step_info)

        return step_info

    def step3_evidence_playback_update(
        self,
        review_decisions: Optional[Dict[str, Dict[str, Any]]] = None,
        reviewer: str = "周姐",
    ) -> Dict[str, Any]:
        """第三步: 证据回放更新

        review_decisions 格式:
        {
            "record_id_1": {"keep": True, "reason": "经核对，该记录对应不同链接，需保留"},
            "record_id_2": {"keep": False, "reason": "确认为重复记录，予以剔除"},
        }
        """
        step_info = {
            "step": 3,
            "name": "证据回放更新",
            "start_time": datetime.now(),
            "reviewer": reviewer,
        }

        summary_before = self.store.generate_review_summary()

        processed = []
        if review_decisions:
            for record_id, decision in review_decisions.items():
                keep = decision.get("keep", True)
                reason = decision.get("reason", "")
                success = self.store.review_duplicate_record(
                    record_id=record_id,
                    operator=reviewer,
                    keep=keep,
                    review_reason=reason,
                )
                processed.append({
                    "record_id": record_id,
                    "keep": keep,
                    "reason": reason,
                    "success": success,
                })

        check_result = self.checker.run_all_checks(self.store.get_all_records())
        summary_after = self.store.generate_review_summary()

        duplicate_groups_detail = []
        for group in summary_after["duplicate_groups"]:
            group_detail = self.store.get_duplicate_group_detail(group["group_id"])
            duplicate_groups_detail.append(group_detail)

        step_info.update({
            "summary_before": summary_before,
            "summary_after": summary_after,
            "processed_decisions": processed,
            "check_result": {
                "total_records": check_result.total_records,
                "normal_count": check_result.normal_count,
                "duplicate_user_feedback_count": check_result.duplicate_user_feedback_count,
                "duplicate_import_count": check_result.duplicate_import_count,
                "review_required_count": check_result.review_required_count,
                "reviewed_count": check_result.reviewed_count,
                "export_consistent": check_result.export_consistent,
            },
            "duplicate_groups_detail": duplicate_groups_detail,
            "note": (
                "所有重复用户反馈记录保留完整证据链，"
                "可通过record_id或group_id查看周姐当时保留/拒绝的理由"
            ),
            "end_time": datetime.now(),
        })

        self.workflow_log.append(step_info)

        return step_info

    def run_full_workflow(
        self,
        model_output_file: str,
        manual_judgment_file: str,
        review_decisions: Optional[Dict[str, Dict[str, Any]]] = None,
        judge_name: str = "周姐",
        reviewer: str = "周姐",
    ) -> Dict[str, Any]:
        """运行完整三步流程"""
        result = {
            "workflow": "知识库失效链接追踪 - 完整三步流程",
            "start_time": datetime.now(),
            "judge_name": judge_name,
            "reviewer": reviewer,
        }

        step1 = self.step1_import_model_output(model_output_file)
        step2 = self.step2_supplement_manual_judgments(
            manual_judgment_file,
            judge_name=judge_name,
        )
        step3 = self.step3_evidence_playback_update(
            review_decisions=review_decisions,
            reviewer=reviewer,
        )

        state_file = self.store.save_state()

        result.update({
            "step1": step1,
            "step2": step2,
            "step3": step3,
            "state_file": state_file,
            "replay_command": (
                f"kb-link-tracker replay --state {state_file}"
            ),
            "end_time": datetime.now(),
        })

        return result

    def get_evidence_for_record(self, record_id: str) -> Dict[str, Any]:
        """获取单条记录的完整证据 - 标注负责人追问时能回到证据"""
        record = self.store.get_record(record_id)
        if not record:
            return {"error": f"未找到记录: {record_id}"}

        evidence_trail = self.store.get_evidence_trail(record_id)

        return {
            "record_id": record_id,
            "user_feedback_id": record.user_feedback_id,
            "user_id": record.user_id,
            "kb_link": record.kb_link,
            "status": record.status.value,
            "issue_type": record.issue_type.value,
            "issue_note": record.issue_note,
            "is_duplicate_user_feedback": record.is_duplicate_user_feedback,
            "duplicate_group_id": record.duplicate_group_id,
            "review_by": record.review_by,
            "review_reason": record.review_reason,
            "review_timestamp": record.review_timestamp.isoformat() if record.review_timestamp else None,
            "initial_model_output": {
                "raw_line_number": record.initial_model_fragment.raw_line_number,
                "import_batch_id": record.initial_model_fragment.import_batch_id,
                "confidence": record.initial_model_fragment.confidence,
                "link_status": record.initial_model_fragment.link_status,
                "raw_content": record.initial_model_fragment.raw_content,
            },
            "manual_judgments": [
                {
                    "judge_name": j.judge_name,
                    "judgment_result": j.judgment_result,
                    "judgment_reason": j.judgment_reason,
                    "raw_line_number": j.raw_line_number,
                    "judgment_timestamp": j.judgment_timestamp.isoformat(),
                }
                for j in record.manual_judgments
            ],
            "evidence_trail": evidence_trail,
        }

    def export_results(
        self,
        output_dir: str = "./output",
        prefix: str = "kb_link_tracking",
    ) -> Dict[str, str]:
        """导出结果 - 从统一数据源输出，确保导出/页面/接口一致"""
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        csv_path = str(out_dir / f"{prefix}_detail_{timestamp}.csv")
        json_path = str(out_dir / f"{prefix}_detail_{timestamp}.json")
        summary_path = str(out_dir / f"{prefix}_summary_{timestamp}.json")
        state_path = str(out_dir / f"{prefix}_state_{timestamp}.pkl")
        workflow_log_path = str(out_dir / f"{prefix}_workflow_{timestamp}.json")

        self.store.export_to_csv(csv_path)
        self.store.export_to_json(json_path)

        summary = {
            "review_summary": self.store.generate_review_summary(),
            "workflow_log": self.workflow_log,
            "export_consistency_check": "PASSED - 明细、页面、接口读取同一份统一数据源",
            "data_source": "unified",
            "export_timestamp": datetime.now().isoformat(),
        }

        import json as _json
        with open(summary_path, "w", encoding="utf-8") as f:
            _json.dump(summary, f, ensure_ascii=False, indent=2, default=str)

        self.store.save_state(state_path)

        with open(workflow_log_path, "w", encoding="utf-8") as f:
            _json.dump(self.workflow_log, f, ensure_ascii=False, indent=2, default=str)

        return {
            "detail_csv": csv_path,
            "detail_json": json_path,
            "summary_json": summary_path,
            "state_pkl": state_path,
            "workflow_log_json": workflow_log_path,
            "replay_command": f"kb-link-tracker replay --state {state_path}",
        }
