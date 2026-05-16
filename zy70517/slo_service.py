import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import asdict

from models import SLOBudget, ReleaseBatch, ServiceSLO, ReleaseStatus, DecisionType
from storage import JSONStorage


class SLOBudgetService:
    def __init__(self, storage: Optional[JSONStorage] = None):
        self.storage = storage or JSONStorage()

    def create_service_slo(self, service_name: str, slo_name: str, slo_target: float, description: str) -> ServiceSLO:
        if slo_target <= 0 or slo_target >= 1:
            raise ValueError("SLO target must be between 0 and 1")
        service_slo = ServiceSLO(
            service_name=service_name,
            slo_name=slo_name,
            slo_target=slo_target,
            description=description
        )
        return self.storage.save_service_slo(service_slo)

    def init_budget(self, service_name: str, slo_name: str, total_budget: float) -> SLOBudget:
        if total_budget <= 0:
            raise ValueError("Total budget must be positive")
        
        service_slos = self.storage.list_service_slos(service_name)
        slo = next((s for s in service_slos if s.slo_name == slo_name), None)
        if not slo:
            raise ValueError(f"SLO {slo_name} not found for service {service_name}")
        
        existing = self.storage.get_budget(service_name, slo_name)
        if existing:
            raise ValueError(f"Budget already exists for {service_name}/{slo_name}")
        
        budget = SLOBudget(
            service_name=service_name,
            slo_name=slo_name,
            slo_target=slo.slo_target,
            total_budget=total_budget,
            remaining_budget=total_budget,
            consumed_budget=0.0
        )
        return self.storage.save_budget(budget)

    def evaluate_release(self, service_name: str, batch_name: str, slo_name: str,
                         budget_consumption: float, requester: str,
                         metrics_snapshot: Optional[Dict[str, Any]] = None,
                         raw_input: Optional[Dict[str, Any]] = None,
                         exemption_reason: Optional[str] = None) -> ReleaseBatch:
        if budget_consumption <= 0:
            raise ValueError("Budget consumption must be a positive number")

        budget = self.storage.get_budget(service_name, slo_name)
        if not budget:
            raise ValueError(f"Budget not found for {service_name}/{slo_name}")

        metrics_snapshot = metrics_snapshot or {}
        raw_input = raw_input or {}
        
        processing_evidence = {
            "budget_before": budget.remaining_budget,
            "budget_consumption": budget_consumption,
            "evaluation_time": datetime.now().isoformat(),
            "budget_remaining_after": budget.remaining_budget - budget_consumption,
            "budget_threshold_block": 0,
            "budget_threshold_warning": budget.total_budget * 0.1
        }

        if exemption_reason:
            decision_type = DecisionType.REQUIRE_APPROVAL
            status = ReleaseStatus.PENDING
            decision_summary = f"发布申请豁免，理由: {exemption_reason}，需审批"
        else:
            if budget.remaining_budget >= budget_consumption:
                decision_type = DecisionType.ALLOW
                status = ReleaseStatus.APPROVED
                new_remaining = budget.remaining_budget - budget_consumption
                budget.remaining_budget = new_remaining
                budget.consumed_budget += budget_consumption
                self.storage.save_budget(budget)
                processing_evidence["budget_after"] = new_remaining
                decision_summary = f"发布批准，扣减预算 {budget_consumption}，剩余 {new_remaining:.4f}"
            elif budget.remaining_budget > 0:
                decision_type = DecisionType.REQUIRE_APPROVAL
                status = ReleaseStatus.PENDING
                decision_summary = f"预算不足，剩余 {budget.remaining_budget:.4f} < 需扣减 {budget_consumption}，需审批"
            else:
                decision_type = DecisionType.BLOCK
                status = ReleaseStatus.BLOCKED
                decision_summary = f"发布拦截，错误预算已耗尽，剩余 0，需豁免审批"

        batch = ReleaseBatch(
            id=str(uuid.uuid4()),
            service_name=service_name,
            batch_name=batch_name,
            slo_name=slo_name,
            budget_consumption=budget_consumption,
            status=status,
            requester=requester,
            decision_type=decision_type,
            decision_summary=decision_summary,
            exemption_reason=exemption_reason,
            metrics_snapshot=metrics_snapshot,
            raw_input=raw_input,
            processing_evidence=processing_evidence
        )
        return self.storage.save_batch(batch)

    def approve_exemption(self, batch_id: str, approver: str, override_budget: bool = False) -> ReleaseBatch:
        batch = self.storage.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")
        if batch.status != ReleaseStatus.PENDING:
            raise ValueError(f"Batch {batch_id} is not pending approval")

        batch.approver = approver
        batch.approved_at = datetime.now().isoformat()
        batch.status = ReleaseStatus.EXEMPTED
        batch.decision_summary = f"豁免已批准 by {approver}，原结论: {batch.decision_summary}"
        
        if override_budget:
            budget = self.storage.get_budget(batch.service_name, batch.slo_name)
            if budget:
                budget.remaining_budget -= batch.budget_consumption
                budget.consumed_budget += batch.budget_consumption
                self.storage.save_budget(budget)
                batch.processing_evidence["exemption_override"] = True
                batch.decision_summary += f"，已强制扣减预算 {batch.budget_consumption}"

        return self.storage.save_batch(batch)

    def reject_exemption(self, batch_id: str, approver: str, reason: str) -> ReleaseBatch:
        batch = self.storage.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")
        if batch.status != ReleaseStatus.PENDING:
            raise ValueError(f"Batch {batch_id} is not pending approval")

        batch.approver = approver
        batch.approved_at = datetime.now().isoformat()
        batch.status = ReleaseStatus.BLOCKED
        batch.decision_summary = f"豁免被拒绝 by {approver}: {reason}，原结论: {batch.decision_summary}"
        
        return self.storage.save_batch(batch)

    def handle_exception(self, batch_id: str, error_message: str, 
                         raw_input: Optional[Dict[str, Any]] = None,
                         processing_evidence: Optional[Dict[str, Any]] = None) -> ReleaseBatch:
        batch = self.storage.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        batch.status = ReleaseStatus.FAILED
        batch.processing_evidence["exception"] = {
            "error_message": error_message,
            "timestamp": datetime.now().isoformat(),
            "additional_evidence": processing_evidence or {}
        }
        if raw_input:
            batch.raw_input.update(raw_input)
        batch.decision_summary = f"异常处理: {error_message}，原状态: {batch.status.value}"

        return self.storage.save_batch(batch)

    def manual_correction(self, batch_id: str, corrector: str, correction_note: str,
                          new_budget_consumption: Optional[float] = None,
                          new_status: Optional[ReleaseStatus] = None,
                          recalculate_budget: bool = False) -> ReleaseBatch:
        batch = self.storage.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        if new_budget_consumption is not None and new_budget_consumption <= 0:
            raise ValueError("New budget consumption must be a positive number")

        batch.is_manual_correction = True
        batch.correction_note = f"Corrected by {corrector}: {correction_note}"
        batch.processing_evidence["manual_correction"] = {
            "corrector": corrector,
            "note": correction_note,
            "timestamp": datetime.now().isoformat(),
            "original_budget_consumption": batch.budget_consumption,
            "original_status": batch.status.value
        }

        if new_budget_consumption is not None:
            old_consumption = batch.budget_consumption
            batch.budget_consumption = new_budget_consumption
            batch.processing_evidence["manual_correction"]["new_budget_consumption"] = new_budget_consumption

        if new_status:
            batch.status = new_status
            batch.processing_evidence["manual_correction"]["new_status"] = new_status.value

        if recalculate_budget and batch.status == ReleaseStatus.APPROVED:
            budget = self.storage.get_budget(batch.service_name, batch.slo_name)
            if budget:
                old_remaining = budget.remaining_budget
                budget.remaining_budget += old_consumption
                budget.remaining_budget -= new_budget_consumption
                budget.consumed_budget = budget.total_budget - budget.remaining_budget
                self.storage.save_budget(budget)
                batch.processing_evidence["manual_correction"]["budget_recalculated"] = True
                batch.processing_evidence["manual_correction"]["budget_before_recalc"] = old_remaining
                batch.processing_evidence["manual_correction"]["budget_after_recalc"] = budget.remaining_budget

        return self.storage.save_batch(batch)

    def query_batches(self, service_name: Optional[str] = None, status: Optional[ReleaseStatus] = None) -> List[ReleaseBatch]:
        return self.storage.list_batches(service_name, status)

    def query_budget(self, service_name: str, slo_name: str) -> Optional[SLOBudget]:
        return self.storage.get_budget(service_name, slo_name)

    def export_decisions(self, service_name: Optional[str] = None, 
                         start_time: Optional[str] = None,
                         end_time: Optional[str] = None) -> Dict[str, Any]:
        batches = self.storage.list_batches(service_name)
        
        if start_time:
            batches = [b for b in batches if b.created_at >= start_time]
        if end_time:
            batches = [b for b in batches if b.created_at <= end_time]

        export_data = {
            "export_metadata": {
                "export_time": datetime.now().isoformat(),
                "service_filter": service_name,
                "time_range": {"start": start_time, "end": end_time},
                "total_batches": len(batches)
            },
            "summary_statistics": {
                "approved": len([b for b in batches if b.status in [ReleaseStatus.APPROVED, ReleaseStatus.COMPLETED]]),
                "approved_active": len([b for b in batches if b.status == ReleaseStatus.APPROVED]),
                "completed": len([b for b in batches if b.status == ReleaseStatus.COMPLETED]),
                "blocked": len([b for b in batches if b.status == ReleaseStatus.BLOCKED]),
                "exempted": len([b for b in batches if b.status == ReleaseStatus.EXEMPTED]),
                "pending": len([b for b in batches if b.status == ReleaseStatus.PENDING]),
                "failed": len([b for b in batches if b.status == ReleaseStatus.FAILED]),
                "manual_corrections": len([b for b in batches if b.is_manual_correction])
            },
            "decisions": []
        }

        for batch in batches:
            decision_record = {
                "batch_id": batch.id,
                "service_name": batch.service_name,
                "batch_name": batch.batch_name,
                "slo_name": batch.slo_name,
                "status": batch.status.value,
                "decision_type": batch.decision_type.value,
                "decision_summary": batch.decision_summary,
                "budget_consumption": batch.budget_consumption,
                "requester": batch.requester,
                "approver": batch.approver,
                "exemption_reason": batch.exemption_reason,
                "is_manual_correction": batch.is_manual_correction,
                "correction_note": batch.correction_note,
                "created_at": batch.created_at,
                "updated_at": batch.updated_at,
                "raw_input": batch.raw_input,
                "processing_evidence": batch.processing_evidence,
                "metrics_snapshot": batch.metrics_snapshot
            }
            export_data["decisions"].append(decision_record)

        budgets = self.storage.list_budgets(service_name)
        export_data["budgets"] = [asdict(b) for b in budgets]

        return export_data

    def complete_release(self, batch_id: str) -> ReleaseBatch:
        batch = self.storage.get_batch(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")
        if batch.status not in [ReleaseStatus.APPROVED, ReleaseStatus.EXEMPTED]:
            raise ValueError(f"Batch {batch_id} must be approved or exempted to complete")

        batch.status = ReleaseStatus.COMPLETED
        batch.decision_summary = f"发布完成，原结论: {batch.decision_summary}"
        return self.storage.save_batch(batch)
