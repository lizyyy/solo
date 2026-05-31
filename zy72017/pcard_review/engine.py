from datetime import datetime
from collections import defaultdict
from typing import List, Dict, Optional, Tuple

from .models import Attachment, ReviewDecision, BudgetOccupancy
from .normalizer import NormalizedRecord

REQUIRED_DOCS = {"发票", "审批单"}
CONTRACT_THRESHOLD = 10000.0


class ReviewEngine:
    def __init__(self, reviewer: str = "风控复核"):
        self.reviewer = reviewer

    def review_batch(
        self,
        records: List[NormalizedRecord],
        attachments: Dict[str, List[Attachment]],
        existing_occupancy: Optional[Dict[str, BudgetOccupancy]] = None,
    ) -> Tuple[List[ReviewDecision], Dict[str, BudgetOccupancy]]:
        decisions = []
        seen = {}
        budget_occ = defaultdict(lambda: BudgetOccupancy(
            budget_code="", total_occupied=0.0, record_ids=[], details=[]
        ))
        if existing_occupancy:
            for code, occ in existing_occupancy.items():
                budget_occ[code] = BudgetOccupancy(
                    budget_code=occ.budget_code,
                    total_occupied=occ.total_occupied,
                    record_ids=list(occ.record_ids),
                    details=list(occ.details),
                )

        for rec in records:
            rec_atts = attachments.get(rec.record_id, [])
            dedup_note = self._check_duplicate(rec, seen)
            decision = self._review_single(rec, rec_atts, budget_occ, dedup_note)
            decisions.append(decision)
            seen[rec.record_id] = rec
            if decision.status == ReviewDecision.STATUS_CONFIRMED and decision.confirmed_amount:
                code = rec.budget_code
                budget_occ[code].budget_code = code
                budget_occ[code].total_occupied += decision.confirmed_amount
                budget_occ[code].record_ids.append(rec.record_id)
                budget_occ[code].details.append({
                    "record_id": rec.record_id,
                    "amount": decision.confirmed_amount,
                    "vendor": rec.vendor,
                    "purpose": rec.purpose,
                })

        return decisions, dict(budget_occ)

    def _check_duplicate(
        self, rec: NormalizedRecord, seen: Dict[str, NormalizedRecord]
    ) -> str:
        for rid, existing in seen.items():
            if rid == rec.record_id:
                continue
            if (
                rec.budget_code
                and rec.budget_code == existing.budget_code
                and rec.amount is not None
                and rec.amount == existing.amount
                and rec.vendor == existing.vendor
                and rec.date_str
                and rec.date_str == existing.date_str
            ):
                return f"疑似与{rid}重复（同科目、同金额、同供应商、同日期）"
        return ""

    def _review_single(
        self,
        rec: NormalizedRecord,
        atts: List[Attachment],
        budget_occ: Dict[str, BudgetOccupancy],
        dedup_note: str,
    ) -> ReviewDecision:
        now = datetime.now()
        missing = self._missing_docs(rec, atts)
        budget_note = self._check_budget_occupancy(rec, budget_occ)
        notes_parts = []

        if rec.normalization_notes:
            notes_parts.append("数据规范化: " + "; ".join(rec.normalization_notes))

        if not rec.amount and rec.amount != 0:
            return ReviewDecision(
                record_id=rec.record_id,
                status=ReviewDecision.STATUS_SUSPENDED,
                reason="金额缺失，无法确认预算占用",
                confirmed_amount=None,
                missing_docs=missing,
                review_notes=self._join_notes(notes_parts + ["金额为空，需补材料"]),
                reviewer=self.reviewer,
                decision_time=now,
                budget_occupancy_note=budget_note,
            )

        if not rec.budget_code:
            return ReviewDecision(
                record_id=rec.record_id,
                status=ReviewDecision.STATUS_SUSPENDED,
                reason="预算科目缺失，无法归属预算占用",
                confirmed_amount=None,
                missing_docs=missing,
                review_notes=self._join_notes(notes_parts + ["预算科目为空，需补材料"]),
                reviewer=self.reviewer,
                decision_time=now,
                budget_occupancy_note=budget_note,
            )

        if missing:
            return ReviewDecision(
                record_id=rec.record_id,
                status=ReviewDecision.STATUS_SUSPENDED,
                reason=f"缺少必要凭证: {', '.join(missing)}",
                confirmed_amount=None,
                missing_docs=missing,
                review_notes=self._join_notes(
                    notes_parts + [f"缺{', '.join(missing)}，挂起待补"]
                ),
                reviewer=self.reviewer,
                decision_time=now,
                budget_occupancy_note=budget_note,
            )

        if dedup_note:
            return ReviewDecision(
                record_id=rec.record_id,
                status=ReviewDecision.STATUS_MANUAL_REVIEW,
                reason=dedup_note,
                confirmed_amount=None,
                missing_docs=[],
                review_notes=self._join_notes(notes_parts + [dedup_note]),
                reviewer=self.reviewer,
                decision_time=now,
                budget_occupancy_note=budget_note,
            )

        if budget_note:
            return ReviewDecision(
                record_id=rec.record_id,
                status=ReviewDecision.STATUS_MANUAL_REVIEW,
                reason=f"企业采购卡预算占用冲突: {budget_note}",
                confirmed_amount=None,
                missing_docs=[],
                review_notes=self._join_notes(
                    notes_parts
                    + [
                        f"企业采购卡预算占用检测: {budget_note}",
                        "同一预算科目已有确认记录占位，需人工判断是否重复占用",
                    ]
                ),
                reviewer=self.reviewer,
                decision_time=now,
                budget_occupancy_note=budget_note,
            )

        if rec.amount and rec.amount >= CONTRACT_THRESHOLD:
            has_contract = any(a.attachment_type == "合同" for a in atts)
            if not has_contract:
                return ReviewDecision(
                    record_id=rec.record_id,
                    status=ReviewDecision.STATUS_MANUAL_REVIEW,
                    reason=f"金额{rec.amount:,.2f}超过{CONTRACT_THRESHOLD:,.0f}元门槛，缺少合同",
                    confirmed_amount=None,
                    missing_docs=["合同"],
                    review_notes=self._join_notes(
                        notes_parts
                        + [
                            f"金额{rec.amount:,.2f}元≥{CONTRACT_THRESHOLD:,.0f}元，应有合同但未找到",
                            "需人工确认是否需要补合同或走例外审批",
                        ]
                    ),
                    reviewer=self.reviewer,
                    decision_time=now,
                    budget_occupancy_note=budget_note,
                )

        if not rec.approval_ref:
            return ReviewDecision(
                record_id=rec.record_id,
                status=ReviewDecision.STATUS_MANUAL_REVIEW,
                reason="缺少审批单号",
                confirmed_amount=None,
                missing_docs=[],
                review_notes=self._join_notes(notes_parts + ["审批单号为空，需人工核实"]),
                reviewer=self.reviewer,
                decision_time=now,
                budget_occupancy_note=budget_note,
            )

        if rec.amount is not None and rec.amount < 0.1:
            return ReviewDecision(
                record_id=rec.record_id,
                status=ReviewDecision.STATUS_MANUAL_REVIEW,
                reason=f"金额异常（{rec.amount}），需人工确认",
                confirmed_amount=None,
                missing_docs=[],
                review_notes=self._join_notes(
                    notes_parts + [f"金额{rec.amount}元，疑似测试或异常数据"]
                ),
                reviewer=self.reviewer,
                decision_time=now,
                budget_occupancy_note=budget_note,
            )

        return ReviewDecision(
            record_id=rec.record_id,
            status=ReviewDecision.STATUS_CONFIRMED,
            reason="凭证齐全，企业采购卡预算占用无冲突",
            confirmed_amount=rec.amount,
            missing_docs=[],
            review_notes=self._join_notes(
                notes_parts + ["企业采购卡预算占用复核通过"]
            ),
            reviewer=self.reviewer,
            decision_time=now,
            budget_occupancy_note=budget_note,
        )

    def _missing_docs(
        self, rec: NormalizedRecord, atts: List[Attachment]
    ) -> List[str]:
        existing = {a.attachment_type for a in atts}
        missing = [d for d in REQUIRED_DOCS if d not in existing]
        return missing

    def _check_budget_occupancy(
        self, rec: NormalizedRecord, budget_occ: Dict[str, BudgetOccupancy]
    ) -> str:
        code = rec.budget_code
        if not code or code not in budget_occ:
            return ""
        occ = budget_occ[code]
        if occ.record_count == 0:
            return ""
        existing_ids = ", ".join(occ.record_ids)
        return (
            f"预算科目{code}已被{existing_ids}占用"
            f"（累计{occ.total_occupied:,.2f}元），"
            f"当前记录{rec.amount:,.2f}元将造成重复占用"
        )

    def _join_notes(self, parts: List[str]) -> str:
        return " | ".join(p for p in parts if p)
