from __future__ import annotations

from typing import Any

from .boundary_rules import BoundaryResult, BoundaryRuleEngine
from .dedup import DedupService
from .history import HistoryService
from .models import ChangeType, RemarkStatus, SettlementType, TaxRateRemark
from .workflow import WorkflowEngine, WorkflowError, WorkflowStep


class VerificationService:
    def __init__(self):
        self.dedup = DedupService()
        self.boundary = BoundaryRuleEngine()
        self.workflow = WorkflowEngine()
        self.history = HistoryService()
        self._remarks: dict[str, TaxRateRemark] = {}

    def import_remarks(
        self,
        remarks: list[TaxRateRemark],
        source_file: str = "",
        operator: str = "",
    ) -> dict[str, Any]:
        new_remarks, updated_remarks, batch = self.dedup.dedup_import(
            remarks, source_file=source_file, operator=operator
        )

        if not new_remarks and not updated_remarks:
            return {
                "status": "duplicate_batch",
                "message": "该批次已导入过，不重复处理",
                "batch": batch.to_dict(),
                "new_count": 0,
                "updated_count": 0,
            }

        for r in new_remarks:
            self._remarks[r.id] = r
        for r in updated_remarks:
            self._remarks[r.id] = r

        return {
            "status": "imported",
            "message": f"导入完成：新增 {len(new_remarks)} 条，更新 {len(updated_remarks)} 条",
            "batch": batch.to_dict(),
            "new_count": len(new_remarks),
            "updated_count": len(updated_remarks),
            "new_ids": [r.id for r in new_remarks],
            "updated_ids": [r.id for r in updated_remarks],
        }

    def change_settlement(
        self,
        remark_id: str,
        proposed_settlement: SettlementType,
        operator: str = "",
        reason: str = "",
    ) -> dict[str, Any]:
        remark = self._remarks.get(remark_id)
        if remark is None:
            return {"status": "error", "message": f"未找到备注: {remark_id}"}

        applied, results = self.boundary.apply_settlement_change(
            remark, proposed_settlement, operator=operator, reason=reason
        )

        result_dicts = [r.to_dict() for r in results]

        if self.boundary.is_blocked(results):
            return {
                "status": "blocked",
                "message": "修改被边界规则阻止",
                "boundary_results": result_dicts,
                "remark": remark.to_dict(),
            }

        if self.boundary.needs_manager_review(results):
            return {
                "status": "flagged_for_manager",
                "message": "修改已应用但需基金经理复核",
                "boundary_results": result_dicts,
                "remark": remark.to_dict(),
            }

        return {
            "status": "applied",
            "message": "修改已应用",
            "boundary_results": result_dicts,
            "remark": remark.to_dict(),
        }

    def rollback_settlement(
        self,
        remark_id: str,
        operator: str = "",
        reason: str = "",
    ) -> dict[str, Any]:
        remark = self._remarks.get(remark_id)
        if remark is None:
            return {"status": "error", "message": f"未找到备注: {remark_id}"}

        rolled_back = self.boundary.rollback_settlement(
            remark, operator=operator, reason=reason
        )
        if not rolled_back:
            return {
                "status": "no_change",
                "message": "当前结算类型与原始一致，无需回滚",
                "remark": remark.to_dict(),
            }

        return {
            "status": "rolled_back",
            "message": f"已回滚至原始结算类型: {remark.original_settlement_type.value}",
            "remark": remark.to_dict(),
        }

    def fill_counter_flow_tail(
        self,
        remark_id: str,
        tail_number: str,
        operator: str = "",
    ) -> dict[str, Any]:
        remark = self._remarks.get(remark_id)
        if remark is None:
            return {"status": "error", "message": f"未找到备注: {remark_id}"}

        remark.counter_flow_tail = tail_number
        remark.record_change(
            change_type=ChangeType.TAIL_REVIEW,
            operator=operator,
            reason=f"补看柜台流水尾号: {tail_number}",
        )
        return {
            "status": "updated",
            "message": "柜台流水尾号已填写",
            "remark": remark.to_dict(),
        }

    def update_reconciliation_note(
        self,
        remark_id: str,
        note: str,
        operator: str = "",
    ) -> dict[str, Any]:
        remark = self._remarks.get(remark_id)
        if remark is None:
            return {"status": "error", "message": f"未找到备注: {remark_id}"}

        remark.reconciliation_note = note
        remark.record_change(
            change_type=ChangeType.RECONCILIATION_UPDATE,
            operator=operator,
            reason="对账说明更新",
        )
        return {
            "status": "updated",
            "message": "对账说明已更新",
            "remark": remark.to_dict(),
        }

    def add_upgrade_note(
        self,
        remark_id: str,
        note: str,
        operator: str = "",
    ) -> dict[str, Any]:
        remark = self._remarks.get(remark_id)
        if remark is None:
            return {"status": "error", "message": f"未找到备注: {remark_id}"}

        remark.upgrade_note = note
        remark.record_change(
            change_type=ChangeType.UPGRADE_NOTE,
            operator=operator,
            reason=f"升阻备注: {note}",
        )
        return {
            "status": "updated",
            "message": "升阻备注已添加",
            "remark": remark.to_dict(),
        }

    def advance_workflow(
        self,
        remark_id: str,
        target_step: WorkflowStep,
        operator: str = "",
        reason: str = "",
    ) -> dict[str, Any]:
        remark = self._remarks.get(remark_id)
        if remark is None:
            return {"status": "error", "message": f"未找到备注: {remark_id}"}

        try:
            transition = self.workflow.advance(
                remark, target_step, operator=operator, reason=reason
            )
            return {
                "status": "advanced",
                "message": f"工作流已推进: {transition.from_step.value} → {transition.to_step.value}",
                "transition": transition.to_dict(),
                "remark": remark.to_dict(),
            }
        except WorkflowError as e:
            return {
                "status": "error",
                "message": str(e),
                "current_step": self.workflow.get_current_step(remark).value,
                "remark": remark.to_dict(),
            }

    def manager_review(
        self,
        remark_id: str,
        approved: bool,
        manager_operator: str = "",
        reason: str = "",
    ) -> dict[str, Any]:
        remark = self._remarks.get(remark_id)
        if remark is None:
            return {"status": "error", "message": f"未找到备注: {remark_id}"}

        ok, msg = self.workflow.manager_review_resolve(
            remark, approved, manager_operator=manager_operator, reason=reason
        )
        return {
            "status": "approved" if ok else "rejected",
            "message": msg,
            "remark": remark.to_dict(),
        }

    def get_audit_trail(self, remark_id: str) -> dict[str, Any]:
        remark = self._remarks.get(remark_id)
        if remark is None:
            return {"status": "error", "message": f"未找到备注: {remark_id}"}
        return self.history.get_audit_trail(remark)

    def get_evidence(self, remark_id: str, keyword: str = "") -> dict[str, Any]:
        remark = self._remarks.get(remark_id)
        if remark is None:
            return {"status": "error", "message": f"未找到备注: {remark_id}"}
        return {
            "remark_id": remark_id,
            "evidence": self.history.find_evidence(remark, keyword=keyword),
        }

    def get_remark(self, remark_id: str) -> TaxRateRemark | None:
        return self._remarks.get(remark_id)

    def list_remarks(self) -> list[dict]:
        return [r.to_dict() for r in self._remarks.values()]

    def full_workflow_demo(
        self,
        remark: TaxRateRemark,
        tail_number: str = "A001",
        reconciliation_note: str = "对账完成",
        operator: str = "阿南",
    ) -> dict[str, Any]:
        import_result = self.import_remarks([remark], operator=operator)
        if import_result["status"] == "duplicate_batch":
            return import_result

        remark_id = import_result["new_ids"][0]

        tail_result = self.fill_counter_flow_tail(
            remark_id, tail_number, operator=operator
        )

        advance_1 = self.advance_workflow(
            remark_id, WorkflowStep.STEP_2_TAIL_REVIEW, operator=operator
        )

        recon_result = self.update_reconciliation_note(
            remark_id, reconciliation_note, operator=operator
        )

        advance_2 = self.advance_workflow(
            remark_id, WorkflowStep.STEP_3_RECONCILIATION, operator=operator
        )

        audit = self.get_audit_trail(remark_id)

        return {
            "import": import_result,
            "tail_review": tail_result,
            "advance_to_step2": advance_1,
            "reconciliation_update": recon_result,
            "advance_to_step3": advance_2,
            "audit_trail": audit,
        }
