from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from pension_rebalance.models import (
    Receipt, Refund, Approval, Note,
    ReconcileResult, ChangeEntry,
)


AMOUNT_BOUNDARY_LOW = 0.01
AMOUNT_BOUNDARY_HIGH = 9_999_999.00


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _fmt_amount(val: Optional[float]) -> str:
    if val is None:
        return "(空)"
    return f"{val:,.2f}"


def detect_duplicate_receipts(receipts: List[Receipt]) -> List[Tuple[Receipt, Receipt, str]]:
    seen: Dict[str, List[Receipt]] = defaultdict(list)
    for r in receipts:
        key = f"{r.transaction_id}|{r.amount}|{r.date}|{r.counterparty}"
        seen[key].append(r)

    duplicates = []
    for key, group in seen.items():
        if len(group) > 1:
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    reason = f"交易流水号{group[i].transaction_id}与{group[j].transaction_id}: 金额/日期/对方账户完全相同，疑似重复"
                    duplicates.append((group[i], group[j], reason))
    return duplicates


def detect_duplicate_refunds(refunds: List[Refund]) -> List[Tuple[Refund, Refund, str]]:
    seen: Dict[str, List[Refund]] = defaultdict(list)
    for r in refunds:
        key = f"{r.refund_id}|{r.transaction_id}|{r.amount}"
        seen[key].append(r)

    duplicates = []
    for key, group in seen.items():
        if len(group) > 1:
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    reason = f"退款申请号{group[i].refund_id}重复: 同一交易{group[i].transaction_id}同金额出现两次"
                    duplicates.append((group[i], group[j], reason))
    return duplicates


def _apply_late_notes(
    result: ReconcileResult,
    note: Note,
) -> None:
    if note.source != "晚到附件":
        return

    old_judgment = result.judgment
    old_reason = result.judgment_reason

    new_judgment = "待复核"
    new_reason = f"晚到附件补充: {note.content}"

    change = ChangeEntry(
        field_name="judgment",
        old_value=old_judgment,
        new_value=new_judgment,
        changed_at=_now(),
        changed_by=f"备注{note.note_id}({note.author})",
        reason=note.content,
    )
    result.change_chain.append(change)
    result.judgment = new_judgment
    result.judgment_reason = f"{old_reason} -> {new_reason}"


def reconcile(
    receipts: List[Receipt],
    refunds: List[Refund],
    approvals: List[Approval],
    notes: List[Note],
) -> List[ReconcileResult]:
    refund_by_txn: Dict[str, List[Refund]] = defaultdict(list)
    for ref in refunds:
        if ref.transaction_id:
            refund_by_txn[ref.transaction_id].append(ref)

    approval_by_refund: Dict[str, List[Approval]] = defaultdict(list)
    for apr in approvals:
        if apr.refund_id:
            approval_by_refund[apr.refund_id].append(apr)

    notes_by_txn: Dict[str, List[Note]] = defaultdict(list)
    for n in notes:
        if n.transaction_id:
            notes_by_txn[n.transaction_id].append(n)

    results: List[ReconcileResult] = []

    for rcp in receipts:
        result = ReconcileResult(
            transaction_id=rcp.transaction_id,
            fund_code=rcp.fund_code,
            receipt_amount=rcp.amount,
            source_file=rcp.source_file,
            processed_at=_now(),
        )

        if rcp.amount is None:
            result.warnings.append(f"收款金额为空(原始值:'{rcp.raw_amount}')")
        if not rcp.fund_code:
            result.warnings.append(f"基金代码为空")
        if not rcp.date:
            result.warnings.append(f"交易日期为空")

        if rcp.amount is not None:
            if rcp.amount <= AMOUNT_BOUNDARY_LOW:
                result.warnings.append(f"边界低额: 收款金额{rcp.amount}极小，需确认是否为测试记录")
            if rcp.amount >= AMOUNT_BOUNDARY_HIGH:
                result.warnings.append(f"边界高额: 收款金额{rcp.amount}极大，需二次确认")

        related_refunds = refund_by_txn.get(rcp.transaction_id, [])
        if related_refunds:
            result.has_refund = True
            ref = related_refunds[0]
            result.refund_amount = ref.amount
            result.refund_status = ref.status

            if ref.amount is None:
                result.warnings.append(f"退款金额为空(原始值:'{ref.raw_amount}')")
            elif rcp.amount is not None:
                if abs(rcp.amount - ref.amount) < 0.01:
                    result.amount_match = "一致"
                else:
                    result.amount_match = f"不一致(收{_fmt_amount(rcp.amount)} vs 退{_fmt_amount(ref.amount)})"
                    result.warnings.append(result.amount_match)

            related_approvals = approval_by_refund.get(ref.refund_id, [])
            if related_approvals:
                result.has_approval = True
                apr = related_approvals[0]
                result.approval_result = apr.result
                if not apr.approver:
                    result.warnings.append(f"审批人缺失(审批编号{apr.approval_id})")
            else:
                result.warnings.append(f"退款{ref.refund_id}无审批记录")

            if len(related_refunds) > 1:
                result.warnings.append(f"同一交易关联{len(related_refunds)}条退款申请，取首条")
        else:
            result.amount_match = "无退款"

        related_notes = notes_by_txn.get(rcp.transaction_id, [])
        if related_notes:
            note_texts = [f"[{n.note_id}]{n.content}({n.note_date})" for n in related_notes]
            result.notes = "; ".join(note_texts)

            for n in related_notes:
                _apply_late_notes(result, n)

        if not result.judgment:
            if result.amount_match == "一致" and result.has_approval and result.approval_result == "同意":
                result.judgment = "正常"
                result.judgment_reason = "金额一致，审批通过"
            elif result.amount_match == "无退款" and not result.has_refund:
                result.judgment = "正常(无退款)"
                result.judgment_reason = "无退款申请，收款单边正常"
            elif result.warnings:
                result.judgment = "待核查"
                reasons = "; ".join(result.warnings[:3])
                result.judgment_reason = f"存在异常: {reasons}"
            else:
                result.judgment = "待核查"
                result.judgment_reason = "无法自动判定"

        results.append(result)

    orphan_refund_txns = set(refund_by_txn.keys()) - {r.transaction_id for r in receipts}
    for txn_id in orphan_refund_txns:
        for ref in refund_by_txn[txn_id]:
            result = ReconcileResult(
                transaction_id=txn_id,
                fund_code=ref.fund_code,
                receipt_amount=None,
                refund_amount=ref.amount,
                has_refund=True,
                refund_status=ref.status,
                source_file=ref.source_file,
                processed_at=_now(),
            )
            result.warnings.append(f"退款{ref.refund_id}关联的交易流水号{txn_id}在收款流水中不存在")
            result.amount_match = "收款缺失"
            result.judgment = "待核查"
            result.judgment_reason = f"退款无对应收款记录"

            related_approvals = approval_by_refund.get(ref.refund_id, [])
            if related_approvals:
                result.has_approval = True
                result.approval_result = related_approvals[0].result
            related_notes = notes_by_txn.get(txn_id, [])
            if related_notes:
                result.notes = "; ".join([f"[{n.note_id}]{n.content}" for n in related_notes])
            results.append(result)

    orphan_note_txns = set(notes_by_txn.keys()) - {r.transaction_id for r in receipts} - orphan_refund_txns
    for txn_id in orphan_note_txns:
        for n in notes_by_txn[txn_id]:
            result = ReconcileResult(
                transaction_id=txn_id,
                source_file=n.source_file,
                processed_at=_now(),
            )
            result.warnings.append(f"备注{n.note_id}关联的交易流水号{txn_id}在收款/退款中均不存在")
            result.notes = f"[{n.note_id}]{n.content}"
            result.judgment = "孤立备注"
            result.judgment_reason = "备注关联的交易流水号无对应记录"
            results.append(result)

    return results
