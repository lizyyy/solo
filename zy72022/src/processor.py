import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from sqlalchemy.orm import Session

from .config import DEPOSIT_KEYWORDS, BATCH_PATTERN, REQUIRED_EVIDENCE_FOR_CONFIRM
from .database import get_db
from .models import (
    PaymentRecord, RefundRequest, ApprovalEmail, ManualNote,
    AttachmentIndex, AuctionDeposit, EvidenceLink, ConflictRecord,
    AuditLog, RecordStatus, EvidenceType
)
from .importer import DataImporter


class DepositProcessor:
    def __init__(self, db: Session):
        self.db = db
        self.importer = DataImporter(db)
        self.processing_results = []
        self.evidence_chains = {}

    def is_deposit(self, payment: PaymentRecord, manual_notes: List[ManualNote]) -> Tuple[bool, str, List[str]]:
        reasons = []
        evidence = []

        if payment.remark:
            for kw in DEPOSIT_KEYWORDS:
                if kw in payment.remark:
                    reasons.append(f"备注包含关键词: {kw}")
                    evidence.append(f"payment_flow:remark:{payment.remark}")
                    break

        for note in manual_notes:
            if note.related_transaction_no == payment.transaction_no:
                for kw in DEPOSIT_KEYWORDS:
                    if kw in note.content:
                        reasons.append(f"手写备注[{note.note_no}]确认: {kw}")
                        evidence.append(f"manual_note:{note.id}:{note.content[:50]}")
                        break

        approvals = self.db.query(ApprovalEmail).filter(
            ApprovalEmail.related_transaction_no == payment.transaction_no
        ).all()
        for approval in approvals:
            content = f"{approval.subject} {approval.content}"
            for kw in DEPOSIT_KEYWORDS:
                if kw in content:
                    reasons.append(f"审批邮件[{approval.email_id}]确认: {kw}")
                    evidence.append(f"approval_email:{approval.id}:{approval.subject}")
                    break

        attachments = self.db.query(AttachmentIndex).filter(
            AttachmentIndex.related_transaction_no == payment.transaction_no
        ).all()
        for att in attachments:
            desc = f"{att.document_type} {att.description}"
            for kw in DEPOSIT_KEYWORDS:
                if kw in desc:
                    reasons.append(f"附件[{att.attachment_no}]类型为: {att.document_type}")
                    evidence.append(f"attachment:{att.id}:{att.document_type}")
                    break

        is_deposit = len(reasons) > 0
        reason_text = "; ".join(reasons) if reasons else "未找到二手车拍卖保证金相关标识"
        return is_deposit, reason_text, evidence

    def extract_batch_number(self, payment: PaymentRecord, manual_notes: List[ManualNote], contracts: Dict) -> Optional[str]:
        if payment.remark:
            batch = self.importer.extract_batch(payment.remark)
            if batch:
                return batch

        for note in manual_notes:
            if note.related_transaction_no == payment.transaction_no:
                batch = self.importer.extract_batch(note.content)
                if batch:
                    return batch

        if payment.transaction_no in contracts:
            batch = contracts[payment.transaction_no].get("batch")
            if batch:
                return batch

        approvals = self.db.query(ApprovalEmail).filter(
            ApprovalEmail.related_transaction_no == payment.transaction_no
        ).all()
        for approval in approvals:
            content = f"{approval.subject} {approval.content}"
            batch = self.importer.extract_batch(content)
            if batch:
                return batch

        return None

    def gather_evidence(self, transaction_no: str) -> Dict[str, Any]:
        evidence = {
            "payment_flow": None,
            "refund_requests": [],
            "approval_emails": [],
            "manual_notes": [],
            "attachments": [],
            "contract": None
        }

        payment = self.db.query(PaymentRecord).filter(
            PaymentRecord.transaction_no == transaction_no
        ).first()
        if payment:
            evidence["payment_flow"] = {
                "id": payment.id,
                "transaction_no": payment.transaction_no,
                "amount": payment.amount,
                "time": payment.transaction_time.isoformat() if payment.transaction_time else None,
                "remark": payment.remark,
                "source": payment.source_file
            }

        refunds = self.db.query(RefundRequest).filter(
            RefundRequest.related_transaction_no == transaction_no
        ).all()
        for r in refunds:
            evidence["refund_requests"].append({
                "id": r.id,
                "request_no": r.request_no,
                "amount": r.amount,
                "status": r.status,
                "reason": r.reason,
                "approver": r.approver,
                "approval_time": r.approval_time.isoformat() if r.approval_time else None,
                "source": r.source_file
            })

        approvals = self.db.query(ApprovalEmail).filter(
            ApprovalEmail.related_transaction_no == transaction_no
        ).all()
        for a in approvals:
            evidence["approval_emails"].append({
                "id": a.id,
                "email_id": a.email_id,
                "subject": a.subject,
                "decision": a.approval_decision,
                "amount": a.approved_amount,
                "content": a.content,
                "source": a.source_file
            })

        notes = self.db.query(ManualNote).filter(
            ManualNote.related_transaction_no == transaction_no
        ).all()
        for n in notes:
            evidence["manual_notes"].append({
                "id": n.id,
                "note_no": n.note_no,
                "author": n.author,
                "content": n.content,
                "is_override": n.is_override,
                "time": n.note_time.isoformat() if n.note_time else None,
                "source": n.source_file
            })

        attachments = self.db.query(AttachmentIndex).filter(
            AttachmentIndex.related_transaction_no == transaction_no
        ).all()
        for att in attachments:
            evidence["attachments"].append({
                "id": att.id,
                "attachment_no": att.attachment_no,
                "document_type": att.document_type,
                "file_name": att.file_name,
                "description": att.description,
                "source": att.source_file
            })

        return evidence

    def check_duplicate_batch_claim(self, payment: PaymentRecord, batch: str, all_payments: List[PaymentRecord]) -> Optional[Dict]:
        same_batch = [
            p for p in all_payments
            if p.transaction_no != payment.transaction_no and
               p.amount == payment.amount and
               self.importer.extract_batch(p.remark) == batch
        ]

        if same_batch:
            return {
                "conflict_type": "duplicate_batch_claim",
                "transaction_no": payment.transaction_no,
                "amount": payment.amount,
                "batch": batch,
                "duplicate_with": [p.transaction_no for p in same_batch],
                "message": f"同一批次{batch}中存在多笔金额为{payment.amount}的记录，可能重复认领"
            }
        return None

    def check_contract_conflict(self, transaction_no: str, payment_amount: float, contracts: Dict) -> Optional[Dict]:
        if transaction_no not in contracts:
            return None

        contract = contracts[transaction_no]
        contract_amount = contract["amount"]

        if abs(contract_amount - payment_amount) > 0.01:
            return {
                "conflict_type": "amount_mismatch",
                "transaction_no": transaction_no,
                "side_a": {
                    "source": "银行流水",
                    "value": payment_amount,
                    "evidence": "收款流水记录"
                },
                "side_b": {
                    "source": "合同扫描件",
                    "value": contract_amount,
                    "evidence": f"合同[{contract['contract_no']}]条款"
                },
                "suggested_action": "请业务部门核实实际到账金额与合同约定金额不一致的原因，确认后再处理",
                "message": f"金额不一致：流水{payment_amount} ≠ 合同{contract_amount}"
            }
        return None

    def check_override_note(self, transaction_no: str) -> Optional[ManualNote]:
        notes = self.db.query(ManualNote).filter(
            ManualNote.related_transaction_no == transaction_no,
            ManualNote.is_override == True
        ).order_by(ManualNote.note_time.desc()).all()
        return notes[0] if notes else None

    def check_missing_evidence(self, evidence: Dict[str, Any]) -> List[str]:
        missing = []
        if not evidence["payment_flow"]:
            missing.append("缺少收款流水记录")
        if not evidence["approval_emails"]:
            missing.append("缺少审批邮件确认")
        return missing

    def check_refund_status(self, evidence: Dict[str, Any]) -> Tuple[bool, float, Optional[datetime], Optional[str]]:
        if not evidence["refund_requests"]:
            return False, 0.0, None, None

        for refund in evidence["refund_requests"]:
            if refund["status"] == "已审批":
                approval_time_str = refund["approval_time"]
                approval_time = None
                if approval_time_str:
                    try:
                        approval_time = datetime.fromisoformat(approval_time_str)
                    except (ValueError, TypeError):
                        approval_time = None
                return True, refund["amount"], approval_time, None
            elif refund["status"] == "已驳回":
                return False, 0.0, None, "退款申请已驳回，保证金不予退还"

        return False, 0.0, None, None

    def determine_status(
        self,
        evidence: Dict[str, Any],
        conflicts: List[Dict],
        missing_evidence: List[str],
        has_override: bool,
        is_refunded: bool,
        is_deposit_flag: bool,
        reject_message: str = None
    ) -> Tuple[RecordStatus, str]:
        if not is_deposit_flag:
            return RecordStatus.PENDING, "非二手车拍卖保证金，跳过处理"

        override_note = self.check_override_note(evidence["payment_flow"]["transaction_no"] if evidence["payment_flow"] else "")
        if override_note:
            return RecordStatus.SUSPENDED, f"根据风控复核员[{override_note.author}]备注挂起：{override_note.content[:100]}"

        if conflicts:
            return RecordStatus.CONFLICT, "存在数据冲突，待人工核实：" + "; ".join([c["message"] for c in conflicts])

        if missing_evidence:
            return RecordStatus.SUSPENDED, "缺少必要凭证，挂起待补：" + "; ".join(missing_evidence)

        if is_refunded:
            return RecordStatus.REFUNDED, "保证金已完成退款审批"

        if reject_message:
            return RecordStatus.CONFIRMED, reject_message

        return RecordStatus.CONFIRMED, "凭证齐全，确认二手车拍卖保证金"

    def create_evidence_links(self, deposit_id: str, evidence: Dict[str, Any]):
        links = []

        if evidence["payment_flow"]:
            links.append(EvidenceLink(
                deposit_id=deposit_id,
                evidence_type=EvidenceType.PAYMENT_FLOW.value,
                evidence_id=evidence["payment_flow"]["id"],
                evidence_source=evidence["payment_flow"]["source"],
                evidence_content=f"收款流水: {evidence['payment_flow']['amount']}元",
                relevance_score=1.0
            ))

        for refund in evidence["refund_requests"]:
            links.append(EvidenceLink(
                deposit_id=deposit_id,
                evidence_type=EvidenceType.REFUND_REQUEST.value,
                evidence_id=refund["id"],
                evidence_source=refund["source"],
                evidence_content=f"退款申请: {refund['amount']}元, 状态: {refund['status']}",
                relevance_score=0.9
            ))

        for approval in evidence["approval_emails"]:
            links.append(EvidenceLink(
                deposit_id=deposit_id,
                evidence_type=EvidenceType.APPROVAL_EMAIL.value,
                evidence_id=approval["id"],
                evidence_source=approval["source"],
                evidence_content=f"审批邮件: {approval['subject']}, 决定: {approval['decision']}",
                relevance_score=1.0
            ))

        for note in evidence["manual_notes"]:
            links.append(EvidenceLink(
                deposit_id=deposit_id,
                evidence_type=EvidenceType.MANUAL_NOTE.value,
                evidence_id=note["id"],
                evidence_source=note["source"],
                evidence_content=f"手写备注[{note['author']}]: {note['content'][:50]}",
                relevance_score=0.95 if note["is_override"] else 0.8
            ))

        for att in evidence["attachments"]:
            links.append(EvidenceLink(
                deposit_id=deposit_id,
                evidence_type=EvidenceType.ATTACHMENT_INDEX.value,
                evidence_id=att["id"],
                evidence_source=att["source"],
                evidence_content=f"附件: {att['document_type']} - {att['file_name']}",
                relevance_score=0.7
            ))

        self.db.add_all(links)

    def create_conflict_record(self, deposit_id: str, conflict: Dict):
        conflict_id = f"conf_{deposit_id}_{conflict['conflict_type']}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        side_a = conflict.get("side_a", {})
        side_b = conflict.get("side_b", {})

        if conflict["conflict_type"] == "duplicate_batch_claim":
            side_a = {
                "source": "当前交易",
                "value": conflict["transaction_no"],
                "evidence": f"交易号 {conflict['transaction_no']}, 金额 {conflict['amount']}"
            }
            side_b = {
                "source": "重复批次认领",
                "value": ", ".join(conflict["duplicate_with"]),
                "evidence": f"同一批次{conflict['batch']}中存在相同金额记录"
            }

        record = ConflictRecord(
            id=conflict_id,
            deposit_id=deposit_id,
            conflict_type=conflict["conflict_type"],
            side_a_source=side_a.get("source", ""),
            side_a_value=str(side_a.get("value", "")),
            side_a_evidence=side_a.get("evidence", ""),
            side_b_source=side_b.get("source", ""),
            side_b_value=str(side_b.get("value", "")),
            side_b_evidence=side_b.get("evidence", ""),
            suggested_action=conflict.get("suggested_action", "请人工核实后处理"),
            resolved=False
        )

        self.db.add(record)

    def create_audit_log(self, deposit_id: str, action: str, old_status: str, new_status: str,
                         old_amount: float, new_amount: float, reason: str, module: str):
        log = AuditLog(
            deposit_id=deposit_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            old_amount=old_amount,
            new_amount=new_amount,
            reason=reason,
            source_module=module
        )
        self.db.add(log)

    def process_payment(
        self,
        payment: PaymentRecord,
        all_payments: List[PaymentRecord],
        manual_notes: List[ManualNote],
        contracts: Dict[str, Any]
    ) -> Dict[str, Any]:
        transaction_no = payment.transaction_no
        deposit_id = f"dep_{transaction_no}"

        existing = self.db.query(AuctionDeposit).filter(AuctionDeposit.id == deposit_id).first()
        if existing:
            return {
                "transaction_no": transaction_no,
                "status": "skipped",
                "message": "已处理过，跳过"
            }

        is_deposit_flag, deposit_reason, deposit_evidence = self.is_deposit(payment, manual_notes)

        evidence = self.gather_evidence(transaction_no)

        batch = self.extract_batch_number(payment, manual_notes, contracts)
        contract_info = contracts.get(transaction_no)

        conflicts = []
        amount_conflict = self.check_contract_conflict(transaction_no, payment.amount, contracts)
        if amount_conflict:
            conflicts.append(amount_conflict)

        if batch:
            duplicate_conflict = self.check_duplicate_batch_claim(payment, batch, all_payments)
            if duplicate_conflict:
                conflicts.append(duplicate_conflict)

        missing_evidence = self.check_missing_evidence(evidence)
        has_override = self.check_override_note(transaction_no) is not None
        is_refunded, refund_amount, refund_time, reject_message = self.check_refund_status(evidence)

        status, decision_reason = self.determine_status(
            evidence, conflicts, missing_evidence, has_override, is_refunded, is_deposit_flag, reject_message
        )

        confirmed_amount = payment.amount if status == RecordStatus.CONFIRMED or status == RecordStatus.REFUNDED else 0.0
        suspended_amount = payment.amount if status == RecordStatus.SUSPENDED or status == RecordStatus.CONFLICT else 0.0

        deposit = AuctionDeposit(
            id=deposit_id,
            deposit_no=f"DEP{datetime.now().strftime('%Y%m%d')}{transaction_no[-4:]}",
            transaction_no=transaction_no,
            related_batch=batch,
            payer=payment.payer,
            amount=payment.amount,
            currency=payment.currency,
            payment_time=payment.transaction_time,
            refund_time=refund_time,
            refund_amount=refund_amount,
            status=status.value,
            is_deposit=is_deposit_flag,
            confirmed_amount=confirmed_amount,
            suspended_amount=suspended_amount,
            contract_amount=contract_info["amount"] if contract_info else None,
            contract_terms=contract_info["terms"] if contract_info else None,
            contract_file=contract_info["file_path"] if contract_info else None,
            decision_reason=f"二手车拍卖保证金判断: {deposit_reason}; 状态判定: {decision_reason}",
            decision_time=datetime.now(),
            source_evidence=json.dumps(deposit_evidence, ensure_ascii=False),
            evidence_chain=json.dumps(evidence, ensure_ascii=False)
        )

        self.db.add(deposit)
        self.create_evidence_links(deposit_id, evidence)

        for conflict in conflicts:
            self.create_conflict_record(deposit_id, conflict)

        self.create_audit_log(
            deposit_id=deposit_id,
            action="CREATE_DEPOSIT",
            old_status="",
            new_status=status.value,
            old_amount=0.0,
            new_amount=confirmed_amount,
            reason=decision_reason,
            module="DepositProcessor.process_payment"
        )

        self.db.commit()

        return {
            "transaction_no": transaction_no,
            "payer": payment.payer,
            "amount": payment.amount,
            "batch": batch,
            "status": status.value,
            "is_deposit": is_deposit_flag,
            "confirmed_amount": confirmed_amount,
            "suspended_amount": suspended_amount,
            "refund_amount": refund_amount,
            "decision_reason": decision_reason,
            "deposit_reason": deposit_reason,
            "conflicts": conflicts,
            "missing_evidence": missing_evidence
        }

    def process_all(self, contracts: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        contracts = contracts or {}

        all_payments = self.db.query(PaymentRecord).all()
        manual_notes = self.db.query(ManualNote).all()

        results = []
        for payment in all_payments:
            result = self.process_payment(payment, all_payments, manual_notes, contracts)
            if result["status"] != "skipped":
                results.append(result)

        self.processing_results = results
        return results


def process_deposits(contracts: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    with get_db() as db:
        processor = DepositProcessor(db)
        return processor.process_all(contracts)
