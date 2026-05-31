from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .models import (
    ReconciliationRecord,
    EvidenceRecord,
    EvidenceType,
    MatchStatus,
    JudgmentHistory
)


class Reconciler:
    def __init__(self, operator: str = "系统"):
        self.operator = operator
        self.snapshot_before: Dict[str, MatchStatus] = {}

    def associate_evidence(
        self,
        records: List[ReconciliationRecord],
        evidence_map: Dict[str, List[EvidenceRecord]]
    ) -> None:
        for record in records:
            if record.voucher_no in evidence_map:
                for ev in evidence_map[record.voucher_no]:
                    record.add_evidence(ev)

    def _take_snapshot(self, records: List[ReconciliationRecord]) -> None:
        self.snapshot_before = {
            r.voucher_no: r.current_status for r in records
        }

    def _get_diff_since_snapshot(
        self, records: List[ReconciliationRecord]
    ) -> List[Tuple[str, MatchStatus, MatchStatus]]:
        diffs = []
        for r in records:
            before = self.snapshot_before.get(r.voucher_no, MatchStatus.UNMATCHED)
            after = r.current_status
            if before != after:
                diffs.append((r.voucher_no, before, after))
        return diffs

    def _determine_actual_amount(self, record: ReconciliationRecord) -> Optional[float]:
        bank_receipts = record.get_evidence_by_type(EvidenceType.BANK_RECEIPT)
        if bank_receipts:
            amounts = [br.amount for br in bank_receipts if br.amount is not None]
            if amounts:
                return sum(amounts)

        payments = record.get_evidence_by_type(EvidenceType.PAYMENT_RECEIPT)
        if payments:
            amounts = [p.amount for p in payments if p.amount is not None]
            if amounts:
                return sum(amounts)

        refunds = record.get_evidence_by_type(EvidenceType.REFUND_REQUEST)
        if refunds:
            for r in refunds:
                if r.amount is not None:
                    return 0.0

        return None

    def _check_conflict(self, record: ReconciliationRecord) -> Optional[Dict]:
        payments = record.get_evidence_by_type(EvidenceType.PAYMENT_RECEIPT)
        bank_receipts = record.get_evidence_by_type(EvidenceType.BANK_RECEIPT)

        if not payments or not bank_receipts:
            return None

        payment_amounts = [p.amount for p in payments if p.amount is not None]
        bank_amounts = [b.amount for b in bank_receipts if b.amount is not None]

        if not payment_amounts or not bank_amounts:
            return None

        payment_total = sum(payment_amounts)
        bank_total = sum(bank_amounts)

        if abs(payment_total - bank_total) > 0.01:
            return {
                "payment_amount": payment_total,
                "bank_amount": bank_total,
                "diff": bank_total - payment_total,
                "payment_sources": [p.source_file for p in payments],
                "bank_sources": [b.source_file for b in bank_receipts],
                "payment_details": [p.content for p in payments],
                "bank_details": [b.content for b in bank_receipts]
            }

        return None

    def _generate_suggestions(self, record: ReconciliationRecord, conflict: Optional[Dict]) -> List[str]:
        suggestions = []

        if conflict:
            suggestions.append(
                f"【数据冲突】收款流水显示{conflict['payment_amount']:.2f}元，银企回单显示{conflict['bank_amount']:.2f}元，"
                f"差额{conflict['diff']:.2f}元。请业务同事核对："
                f"1) 是否有优惠券/积分抵扣未记录；"
                f"2) 是否存在服务费调价；"
                f"3) 联系航司确认最终结算金额。"
                "请勿直接拍板，先核实两边凭证原件。"
            )

        if record.current_status == MatchStatus.PENDING_MATERIALS:
            missing = []
            if not record.has_evidence_type(EvidenceType.PAYMENT_RECEIPT):
                missing.append("收款流水")
            if not record.has_evidence_type(EvidenceType.BANK_RECEIPT):
                missing.append("银企回单截图")
            if missing:
                suggestions.append(
                    f"【待补材料】缺少{', '.join(missing)}，请联系运营岗小孟尽快收集，"
                    "补全后重新运行对账。材料不齐不能确认入账。"
                )

        refunds = record.get_evidence_by_type(EvidenceType.REFUND_REQUEST)
        for r in refunds:
            if "待审批" in r.content:
                suggestions.append(
                    "【退款待批】该笔退款申请尚未完成审批，"
                    "请跟进审批进度，审批通过后方可核销。"
                )

        if record.current_status == MatchStatus.MANUAL_REVIEW:
            suggestions.append(
                "【人工改判】该笔记录存在特殊情况，"
                "请运营主管小孟复核后在系统中标记最终处理意见，"
                "并同步给财务岗留档。"
            )

        if record.manual_notes:
            suggestions.append(
                f"【人工备注】已有{len(record.manual_notes)}条手写备注，"
                "处理时请先查看备注内容，了解历史背景后再操作。"
            )

        late_attachments = [
            e for e in record.get_evidence_by_type(EvidenceType.ATTACHMENT)
        ]
        if late_attachments and record.judgment_history:
            suggestions.append(
                f"【晚到附件】本批有{len(late_attachments)}份附件是后期补传，"
                "原判断已保留在历史记录中。请核对附件内容是否影响原结论，"
                "如需改判请走人工复核流程。"
            )

        return suggestions

    def _record_judgment(
        self,
        record: ReconciliationRecord,
        new_status: MatchStatus,
        reason: str,
        evidence_refs: Optional[List[str]] = None
    ) -> None:
        judgment = JudgmentHistory(
            timestamp=datetime.now(),
            status_before=record.current_status,
            status_after=new_status,
            reason=reason,
            operator=self.operator,
            evidence_refs=evidence_refs or []
        )
        record.add_judgment(judgment)

    def reconcile(self, records: List[ReconciliationRecord]) -> List[ReconciliationRecord]:
        self._take_snapshot(records)

        for record in records:
            actual = self._determine_actual_amount(record)
            record.actual_amount = actual

            manual_notes = record.get_evidence_by_type(EvidenceType.MANUAL_NOTE)
            handled = False
            for note in manual_notes:
                if "积分兑换" in note.content or "无需实际收款" in note.content:
                    self._record_judgment(
                        record,
                        MatchStatus.CONFIRMED,
                        "手写备注说明为积分兑换，无需实际收款，按特殊情况确认",
                        [e.source_file for e in record.evidence]
                    )
                    record.suggestions = self._generate_suggestions(record, None)
                    handled = True
                    break
            if handled:
                continue

            for note in manual_notes:
                if "暂搁置" in note.content or "联系不上" in note.content:
                    self._record_judgment(
                        record,
                        MatchStatus.MANUAL_REVIEW,
                        "手写备注说明客户联系不上，退款申请暂搁置，需人工跟进",
                        [e.source_file for e in record.evidence]
                    )
                    record.suggestions = self._generate_suggestions(record, None)
                    handled = True
                    break
            if handled:
                continue

            refund_approved = False
            for r in record.get_evidence_by_type(EvidenceType.REFUND_REQUEST):
                if "已审批" in r.content:
                    refund_approved = True
                    break

            if refund_approved and actual == 0.0:
                self._record_judgment(
                    record,
                    MatchStatus.CONFIRMED,
                    "退款已审批，实际到账0元，与预期一致（已全额退款）",
                    [e.source_file for e in record.evidence]
                )
                record.suggestions = self._generate_suggestions(record, None)
                continue

            has_approval = record.has_evidence_type(EvidenceType.APPROVAL_EMAIL)
            if has_approval and actual is not None and abs(actual - record.expected_amount) >= 0.01:
                self._record_judgment(
                    record,
                    MatchStatus.CONFIRMED,
                    f"金额差异{record.amount_diff:.2f}元，已有审批邮件说明，按审批结果确认",
                    [e.source_file for e in record.evidence]
                )
                record.suggestions = self._generate_suggestions(record, None)
                continue

            conflict = self._check_conflict(record)
            if conflict and not has_approval:
                manual_notes = record.get_evidence_by_type(EvidenceType.MANUAL_NOTE)
                has_confirm_note = any(
                    "可确认" in n.content or "同意确认" in n.content or "正常折扣" in n.content
                    for n in manual_notes
                )

                if has_confirm_note:
                    record.conflict_details = conflict
                    self._record_judgment(
                        record,
                        MatchStatus.CONFIRMED,
                        f"存在数据冲突（差额{conflict['diff']:.2f}元），但已有手写备注确认差异原因，按备注意见确认",
                        [e.source_file for e in record.evidence]
                    )
                else:
                    record.conflict_details = conflict
                    self._record_judgment(
                        record,
                        MatchStatus.CONFLICT,
                        "收款流水与银企回单金额不一致，存在数据冲突",
                        [e.source_file for e in record.evidence]
                    )
                record.suggestions = self._generate_suggestions(record, conflict)
                continue

            has_payment = record.has_evidence_type(EvidenceType.PAYMENT_RECEIPT)
            has_bank = record.has_evidence_type(EvidenceType.BANK_RECEIPT)

            if not has_payment and not has_bank:
                self._record_judgment(
                    record,
                    MatchStatus.PENDING_MATERIALS,
                    "缺少收款流水和银企回单，待补材料",
                    []
                )
                record.suggestions = self._generate_suggestions(record, None)
                continue

            if actual is not None and abs(actual - record.expected_amount) < 0.01:
                ev_refs = [e.source_file for e in record.evidence]
                if has_payment and has_bank:
                    reason = "收款流水与银企回单金额一致，且与预期金额相符，确认无误"
                elif has_payment:
                    reason = "收款流水金额与预期相符，但缺少银企回单，请尽快补回"
                else:
                    reason = "银企回单金额与预期相符，但缺少收款流水，请尽快补回"

                self._record_judgment(record, MatchStatus.CONFIRMED, reason, ev_refs)
                record.suggestions = self._generate_suggestions(record, None)
                continue

            if actual is not None and abs(actual - record.expected_amount) >= 0.01:
                if has_approval:
                    self._record_judgment(
                        record,
                        MatchStatus.CONFIRMED,
                        f"金额差异{record.amount_diff:.2f}元，已有审批邮件说明，按审批结果确认",
                        [e.source_file for e in record.evidence]
                    )
                else:
                    self._record_judgment(
                        record,
                        MatchStatus.MANUAL_REVIEW,
                        f"金额差异{record.amount_diff:.2f}元，无审批说明，需人工复核原因",
                        [e.source_file for e in record.evidence]
                    )
                record.suggestions = self._generate_suggestions(record, None)
                continue

            self._record_judgment(
                record,
                MatchStatus.UNMATCHED,
                "证据不足，无法匹配",
                []
            )
            record.suggestions = self._generate_suggestions(record, None)

        return records

    def apply_late_evidence(
        self,
        records: List[ReconciliationRecord],
        late_evidence: Dict[str, List[EvidenceRecord]]
    ) -> List[Tuple[str, MatchStatus, MatchStatus, List[str]]]:
        self._take_snapshot(records)
        changes = []

        for record in records:
            if record.voucher_no not in late_evidence:
                continue

            orig_status = record.current_status
            orig_evidence_count = len(record.evidence)

            for ev in late_evidence[record.voucher_no]:
                record.add_evidence(ev)

            added_evidence = late_evidence[record.voucher_no]

            if record.current_status == MatchStatus.CONFIRMED:
                note = (
                    f"晚到附件已追加，原判断【{orig_status.value}】保留。"
                    f"新增{len(added_evidence)}份证据，请人工复核是否需要改判。"
                )
                record.add_manual_note(note, self.operator)
                changes.append((
                    record.voucher_no,
                    orig_status,
                    orig_status,
                    ["状态未变，晚到附件已追加，需人工复核是否改判"]
                ))
            else:
                self.reconcile([record])
                new_status = record.current_status
                change_desc = [
                    f"晚到附件触发重新判断：{orig_status.value} → {new_status.value}",
                    f"新增证据：{[e.content for e in added_evidence]}"
                ]
                changes.append((record.voucher_no, orig_status, new_status, change_desc))

        return changes

    def apply_manual_note(
        self,
        records: List[ReconciliationRecord],
        voucher_no: str,
        note: str,
        operator: str = "人工补录"
    ) -> Optional[Tuple[str, MatchStatus, MatchStatus, List[str]]]:
        self._take_snapshot(records)

        target = None
        for r in records:
            if r.voucher_no == voucher_no:
                target = r
                break

        if not target:
            return None

        orig_status = target.current_status
        target.add_manual_note(note, operator)

        evidence = EvidenceRecord(
            evidence_type=EvidenceType.MANUAL_NOTE,
            source_file="人工补录",
            content=f"手写备注: {note}, 记录人{operator}",
            voucher_no=voucher_no,
            passenger_name=target.passenger_name,
            flight_no=target.flight_no,
            service_date=target.service_date
        )
        target.add_evidence(evidence)

        self.reconcile([target])
        new_status = target.current_status

        diff_desc = [
            f"补录备注触发重新判断：{orig_status.value} → {new_status.value}",
            f"备注内容：{note}"
        ]

        return (voucher_no, orig_status, new_status, diff_desc)
