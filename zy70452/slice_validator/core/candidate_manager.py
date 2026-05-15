import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

from slice_validator.models.schemas import (
    RollbackPlan,
    CandidateAction,
    ValidationResult,
    FailureType,
)


class CandidateManager:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.candidates_dir = self.data_dir / "candidates"
        self.candidates_dir.mkdir(parents=True, exist_ok=True)

    def generate_rollback_candidates(
        self, validation_result: ValidationResult, base_dir: str = ""
    ) -> RollbackPlan:
        candidates: List[CandidateAction] = []

        for failure_type, affected_items in validation_result.failure_groups.items():
            if failure_type == FailureType.PARTIAL_SUCCESS:
                continue

            reason = self._get_failure_reason(failure_type)
            affected_files = [item for item in affected_items if not item.startswith("批次")]

            if affected_files:
                candidates.append(
                    CandidateAction(
                        action_id=str(uuid.uuid4()),
                        action_type="rollback",
                        reason=reason,
                        affected_files=affected_files,
                        requires_manual_confirmation=True,
                    )
                )

        if FailureType.PARTIAL_SUCCESS in validation_result.failure_groups:
            failed_files = [
                s["file_name"]
                for s in validation_result.validated_slices
                if s["status"] != "success"
            ]
            candidates.append(
                CandidateAction(
                    action_id=str(uuid.uuid4()),
                    action_type="partial_cleanup",
                    reason="部分成功批次，需要清理失败的切片文件",
                    affected_files=failed_files,
                    requires_manual_confirmation=True,
                )
            )

        rollback_plan = RollbackPlan(
            plan_id=str(uuid.uuid4()),
            batch_id=validation_result.batch_id,
            candidates=candidates,
            status="pending_confirmation",
        )

        self._save_rollback_plan(rollback_plan)
        return rollback_plan

    def _get_failure_reason(self, failure_type: FailureType) -> str:
        reason_map = {
            FailureType.CHECKSUM_MISMATCH: "校验和不匹配，数据可能已损坏",
            FailureType.SIZE_MISMATCH: "文件大小与预期不符，可能传输不完整",
            FailureType.MISSING_SLICE: "切片文件缺失，需要重新传输",
            FailureType.CORRUPTED_DATA: "数据格式损坏，无法正常解析",
            FailureType.TIMEOUT: "传输超时，连接不稳定",
            FailureType.DUPLICATE_RECORD: "存在重复记录，需要去重",
            FailureType.PARTIAL_SUCCESS: "部分切片成功，部分失败",
        }
        return reason_map.get(failure_type, "未知错误")

    def _save_rollback_plan(self, plan: RollbackPlan) -> None:
        plan_file = self.candidates_dir / f"{plan.plan_id}_rollback.json"
        with open(plan_file, "w", encoding="utf-8") as f:
            json.dump(plan.model_dump(mode="json"), f, ensure_ascii=False, indent=2)

    def list_pending_plans(self) -> List[Dict]:
        plans = []
        for plan_file in self.candidates_dir.glob("*_rollback.json"):
            with open(plan_file, "r", encoding="utf-8") as f:
                plan_data = json.load(f)
                if plan_data["status"] == "pending_confirmation":
                    plans.append(plan_data)
        return plans

    def confirm_plan(self, plan_id: str, confirmed: bool) -> bool:
        plan_file = self.candidates_dir / f"{plan_id}_rollback.json"
        if not plan_file.exists():
            return False

        with open(plan_file, "r", encoding="utf-8") as f:
            plan_data = json.load(f)

        plan_data["status"] = "confirmed" if confirmed else "rejected"
        plan_data["confirmed_at"] = datetime.now().isoformat()

        with open(plan_file, "w", encoding="utf-8") as f:
            json.dump(plan_data, f, ensure_ascii=False, indent=2)

        return True

    def execute_rollback(self, plan_id: str, dry_run: bool = True) -> Dict:
        plan_file = self.candidates_dir / f"{plan_id}_rollback.json"
        if not plan_file.exists():
            return {"success": False, "error": "回滚计划不存在"}

        with open(plan_file, "r", encoding="utf-8") as f:
            plan_data = json.load(f)

        if plan_data["status"] != "confirmed":
            return {"success": False, "error": "回滚计划尚未确认"}

        all_files = []
        for candidate in plan_data["candidates"]:
            all_files.extend(candidate["affected_files"])

        if dry_run:
            return {
                "success": True,
                "dry_run": True,
                "files_to_delete": all_files,
                "message": f"预计删除 {len(all_files)} 个文件",
            }

        deleted_count = 0
        failed_deletions = []
        for file_path in all_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    deleted_count += 1
            except Exception as e:
                failed_deletions.append({"file": file_path, "error": str(e)})

        plan_data["status"] = "executed"
        plan_data["executed_at"] = datetime.now().isoformat()
        plan_data["execution_result"] = {
            "deleted_count": deleted_count,
            "failed_deletions": failed_deletions,
        }

        with open(plan_file, "w", encoding="utf-8") as f:
            json.dump(plan_data, f, ensure_ascii=False, indent=2)

        return {
            "success": len(failed_deletions) == 0,
            "deleted_count": deleted_count,
            "failed_deletions": failed_deletions,
        }

    def manual_partition_confirmation(
        self, batch_id: str, partition_list: List[Dict], approved: bool
    ) -> Dict:
        confirmation_file = self.candidates_dir / f"{batch_id}_partition_confirmation.json"
        result = {
            "batch_id": batch_id,
            "approved": approved,
            "partitions": partition_list,
            "confirmed_at": datetime.now().isoformat(),
        }

        with open(confirmation_file, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        return result
