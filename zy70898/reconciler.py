import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from models import (
    BoxTransferRecord, TellerSchedule, ErrorRecord,
    TransferReconciliation, DiscrepancyDetail,
    DiscrepancyType, VerificationStatus
)


class ReconciliationEngine:
    def __init__(self):
        self.tellers_map: Dict[str, TellerSchedule] = {}
        self.errors_map: Dict[str, List[ErrorRecord]] = {}
        self.box_history: Dict[str, List[BoxTransferRecord]] = {}

    def reconcile(
        self,
        transfers: List[BoxTransferRecord],
        schedules: List[TellerSchedule],
        errors: List[ErrorRecord]
    ) -> List[TransferReconciliation]:
        self._build_indices(schedules, errors, transfers)
        results = []
        for transfer in transfers:
            result = self._reconcile_single(transfer)
            results.append(result)
        return results

    def _build_indices(
        self,
        schedules: List[TellerSchedule],
        errors: List[ErrorRecord],
        transfers: List[BoxTransferRecord]
    ):
        for schedule in schedules:
            key = f"{schedule.teller_id}_{schedule.date}"
            self.tellers_map[key] = schedule
        for error in errors:
            if error.transfer_id not in self.errors_map:
                self.errors_map[error.transfer_id] = []
            self.errors_map[error.transfer_id].append(error)
        for transfer in transfers:
            if transfer.box_id not in self.box_history:
                self.box_history[transfer.box_id] = []
            self.box_history[transfer.box_id].append(transfer)

    def _reconcile_single(self, transfer: BoxTransferRecord) -> TransferReconciliation:
        discrepancies = []
        discrepancies.extend(self._check_amount_consistency(transfer))
        discrepancies.extend(self._check_double_signature(transfer))
        discrepancies.extend(self._check_cross_day_transfer(transfer))
        discrepancies.extend(self._check_teller_schedule(transfer))
        discrepancies.extend(self._check_error_records(transfer))
        discrepancies.extend(self._check_box_history(transfer))
        status = VerificationStatus.MATCHED if not discrepancies else VerificationStatus.DISCREPANCY
        return TransferReconciliation(
            transfer_id=transfer.transfer_id,
            box_id=transfer.box_id,
            original_record=transfer,
            verification_status=status,
            discrepancies=discrepancies
        )

    def _check_amount_consistency(self, transfer: BoxTransferRecord) -> List[DiscrepancyDetail]:
        discrepancies = []
        calculated_total = transfer.cash_amount + transfer.check_amount
        if abs(calculated_total - transfer.total_amount) > 0.01:
            discrepancies.append(DiscrepancyDetail(
                discrepancy_id=str(uuid.uuid4()),
                discrepancy_type=DiscrepancyType.AMOUNT_MISMATCH,
                field_name="total_amount",
                expected_value=calculated_total,
                actual_value=transfer.total_amount,
                description=f"金额不平: 现金({transfer.cash_amount:,.2f}) + 支票({transfer.check_amount:,.2f}) = {calculated_total:,.2f}，但记录总金额为 {transfer.total_amount:,.2f}，差异 {abs(calculated_total - transfer.total_amount):,.2f} 元",
                severity="high"
            ))
        return discrepancies

    def _check_double_signature(self, transfer: BoxTransferRecord) -> List[DiscrepancyDetail]:
        discrepancies = []
        missing_sigs = []
        if not transfer.first_signatory:
            missing_sigs.append("第一签核人")
        if not transfer.second_signatory:
            missing_sigs.append("第二签核人")
        if missing_sigs:
            discrepancies.append(DiscrepancyDetail(
                discrepancy_id=str(uuid.uuid4()),
                discrepancy_type=DiscrepancyType.MISSING_DOUBLE_SIGN,
                field_name="signatories",
                expected_value="双人签核",
                actual_value=f"缺少: {', '.join(missing_sigs)}",
                description=f"缺双签: 交接需要双人确认，但{', '.join(missing_sigs)}未签字。涉及人员: 移交人{transfer.sender_name}，接收人{transfer.receiver_name}",
                severity="high"
            ))
        return discrepancies

    def _check_cross_day_transfer(self, transfer: BoxTransferRecord) -> List[DiscrepancyDetail]:
        discrepancies = []
        try:
            transfer_dt = datetime.strptime(f"{transfer.transfer_date} {transfer.transfer_time}", "%Y-%m-%d %H:%M:%S")
            business_end = transfer_dt.replace(hour=22, minute=0, second=0)
            business_start = transfer_dt.replace(hour=6, minute=0, second=0)
            if transfer_dt < business_start or transfer_dt > business_end:
                discrepancies.append(DiscrepancyDetail(
                    discrepancy_id=str(uuid.uuid4()),
                    discrepancy_type=DiscrepancyType.CROSS_DAY_TRANSFER,
                    field_name="transfer_time",
                    expected_value="营业时间内(06:00-22:00)",
                    actual_value=transfer.transfer_time,
                    description=f"跨日交接: 交接时间 {transfer.transfer_time} 不在正常营业时间范围内(06:00-22:00)，可能涉及跨日风险，需确认是否为正常加班交接",
                    severity="medium"
                ))
        except ValueError:
            pass
        return discrepancies

    def _check_teller_schedule(self, transfer: BoxTransferRecord) -> List[DiscrepancyDetail]:
        discrepancies = []
        for teller_id, teller_name in [
            (transfer.sender_id, transfer.sender_name),
            (transfer.receiver_id, transfer.receiver_name),
            (transfer.first_signatory, None),
            (transfer.second_signatory, None)
        ]:
            if not teller_id:
                continue
            key = f"{teller_id}_{transfer.transfer_date}"
            if key not in self.tellers_map:
                discrepancies.append(DiscrepancyDetail(
                    discrepancy_id=str(uuid.uuid4()),
                    discrepancy_type=DiscrepancyType.MISSING_TELLER,
                    field_name="teller_schedule",
                    expected_value=f"柜员{teller_id}当日排班记录",
                    actual_value="无记录",
                    description=f"柜员缺失: {teller_name or teller_id} 在 {transfer.transfer_date} 没有排班记录，但参与了本次交接",
                    severity="medium"
                ))
            else:
                schedule = self.tellers_map[key]
                if not schedule.is_working:
                    discrepancies.append(DiscrepancyDetail(
                        discrepancy_id=str(uuid.uuid4()),
                        discrepancy_type=DiscrepancyType.MISSING_TELLER,
                        field_name="teller_schedule",
                        expected_value="当班",
                        actual_value="休假",
                        description=f"柜员不在岗: {teller_name or teller_id} 在 {transfer.transfer_date} 为休假状态，但参与了本次交接",
                        severity="high"
                    ))
        return discrepancies

    def _check_error_records(self, transfer: BoxTransferRecord) -> List[DiscrepancyDetail]:
        discrepancies = []
        if transfer.transfer_id in self.errors_map:
            for error in self.errors_map[transfer.transfer_id]:
                if error.status == "open":
                    discrepancies.append(DiscrepancyDetail(
                        discrepancy_id=str(uuid.uuid4()),
                        discrepancy_type=DiscrepancyType.ERROR_MISMATCH,
                        field_name=f"error_{error.error_id}",
                        expected_value="差错已闭环",
                        actual_value="差错未处理",
                        description=f"差错未闭环: [{error.error_type}] {error.error_description}（上报人: {error.reporter_name}）",
                        severity="high"
                    ))
        return discrepancies

    def _check_box_history(self, transfer: BoxTransferRecord) -> List[DiscrepancyDetail]:
        discrepancies = []
        history = self.box_history.get(transfer.box_id, [])
        same_day_transfers = [t for t in history if t.transfer_date == transfer.transfer_date and t.transfer_id != transfer.transfer_id]
        if len(same_day_transfers) >= 3:
            discrepancies.append(DiscrepancyDetail(
                discrepancy_id=str(uuid.uuid4()),
                discrepancy_type=DiscrepancyType.DUPLICATE_RECORD,
                field_name="box_frequency",
                expected_value="当日不超过2次交接",
                actual_value=f"当日{len(same_day_transfers) + 1}次交接",
                description=f"交接频繁: 尾箱{transfer.box_id}在 {transfer.transfer_date} 已发生{len(same_day_transfers) + 1}次交接，超出正常频次",
                severity="medium"
            ))
        return discrepancies

    def recalculate_record(
        self,
        reconciliation: TransferReconciliation,
        new_cash: float = None,
        new_check: float = None,
        notes: str = None
    ) -> TransferReconciliation:
        cash = new_cash if new_cash is not None else reconciliation.original_record.cash_amount
        check = new_check if new_check is not None else reconciliation.original_record.check_amount
        new_total = cash + check
        reconciliation.adjusted_cash_amount = cash
        reconciliation.adjusted_check_amount = check
        reconciliation.adjusted_total_amount = new_total
        reconciliation.is_adjusted = True
        if notes:
            reconciliation.review_notes.append(f"[重新计算] {notes}")
        reconciliation.discrepancies = [
            d for d in reconciliation.discrepancies
            if d.discrepancy_type != DiscrepancyType.AMOUNT_MISMATCH
        ]
        if not reconciliation.discrepancies:
            reconciliation.verification_status = VerificationStatus.MATCHED
        return reconciliation
