from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, date
from collections import defaultdict

from models import (
    FundMatchRecord,
    Invoice,
    HolidayExtension,
    TailAdjustment,
    DiscrepancyItem,
    MatchStatus,
    RecordType,
    DiscrepancyStatus,
)
from repository import MatchRepository
from services.audit_service import AuditService


class MatchingEngine:
    def __init__(
        self,
        repository: Optional[MatchRepository] = None,
        audit_service: Optional[AuditService] = None,
    ):
        self.repo = repository or MatchRepository()
        self.audit = audit_service or AuditService(self.repo)

    def create_match_records_from_invoices(
        self,
        invoices: List[Invoice],
        operator: str,
    ) -> List[FundMatchRecord]:
        business_no_groups: Dict[str, List[Invoice]] = defaultdict(list)
        for invoice in invoices:
            if invoice.business_no:
                business_no_groups[invoice.business_no].append(invoice)

        records = []
        for business_no, group_invoices in business_no_groups.items():
            record = self._create_single_record(business_no, group_invoices, operator)
            records.append(record)

        self.audit.log_import(
            data_type="发票并创建匹配记录",
            operator=operator,
            batch=invoices[0].import_batch if invoices and invoices[0].import_batch else "manual",
            count=len(records),
        )

        return records

    def _create_single_record(
        self,
        business_no: str,
        invoices: List[Invoice],
        operator: str,
    ) -> FundMatchRecord:
        total_amount = sum(inv.total_amount for inv in invoices)

        record = FundMatchRecord(
            business_no=business_no,
            record_type=RecordType.COMBINED,
            expected_amount=total_amount,
            matched_amount=total_amount,
            match_date=date.today(),
            status=MatchStatus.PENDING,
            invoice_ids=[inv.invoice_id for inv in invoices],
            updated_by=operator,
        )

        self.repo.add_match_record(record)
        return record

    def create_split_records(
        self,
        business_no: str,
        principal_amount: float,
        fee_amount: float,
        operator: str,
        match_date: Optional[date] = None,
        existing_record_id: Optional[str] = None,
    ) -> Tuple[FundMatchRecord, FundMatchRecord]:
        principal_record = FundMatchRecord(
            business_no=business_no,
            record_type=RecordType.PRINCIPAL,
            expected_amount=principal_amount,
            matched_amount=principal_amount,
            match_date=match_date or date.today(),
            status=MatchStatus.PENDING_REVIEW,
            updated_by=operator,
        )

        fee_record = FundMatchRecord(
            business_no=business_no,
            record_type=RecordType.FEE,
            expected_amount=fee_amount,
            matched_amount=fee_amount,
            match_date=match_date or date.today(),
            status=MatchStatus.PENDING_REVIEW,
            updated_by=operator,
        )

        principal_record.related_record_id = fee_record.record_id
        fee_record.related_record_id = principal_record.record_id

        if existing_record_id:
            existing = self.repo.get_match_record(existing_record_id)
            if existing:
                principal_record.invoice_ids = existing.invoice_ids.copy()
                fee_record.invoice_ids = existing.invoice_ids.copy()

                changes = {
                    "record_type": (existing.record_type.value, "拆分为本金/手续费"),
                    "status": (existing.status.value, MatchStatus.PENDING_REVIEW.value),
                    "expected_amount": (existing.expected_amount, f"{principal_amount:.2f} + {fee_amount:.2f}"),
                }
                self.audit.log_record_update(
                    record=existing,
                    operator=operator,
                    reason="同一业务号拆分为本金和手续费两行",
                    changes=changes,
                )

        self.repo.add_match_record(principal_record)
        self.repo.add_match_record(fee_record)

        self._create_discrepancy_for_split(principal_record, fee_record, operator)

        return principal_record, fee_record

    def recalculate_matched_amounts(
        self,
        business_no: str,
        operator: str,
        reason: str,
    ) -> List[FundMatchRecord]:
        records = self.repo.get_records_by_business_no(business_no)
        if not records:
            return []

        holiday = self.repo.get_holiday_extension_by_business_no(business_no)
        tail_adj = self.repo.get_tail_adjustment_by_business_no(business_no)

        conflict = self.repo.get_conflict_evidence(business_no)
        resolution = self.repo.get_conflict_resolution(business_no)

        if conflict and not resolution:
            for record in records:
                if record.status != MatchStatus.PENDING_REVIEW:
                    record.status = MatchStatus.CONFLICT
                record.updated_at = datetime.now()
                record.updated_by = operator
            return records

        base_amount = sum(r.expected_amount for r in records)
        calculated_amount = base_amount

        if holiday:
            calculated_amount = calculated_amount * (1 + holiday.extension_days * 0.001)
        if tail_adj:
            calculated_amount += tail_adj.adjustment_amount

        if resolution and resolution.final_amount is not None:
            calculated_amount = resolution.final_amount
        elif resolution and resolution.resolution == DiscrepancyStatus.REJECTED:
            calculated_amount = base_amount

        changes_list = []
        for record in records:
            old_matched = record.matched_amount
            ratio = record.expected_amount / base_amount if base_amount > 0 else 0
            new_matched = calculated_amount * ratio

            if abs(old_matched - new_matched) > 0.001:
                record.matched_amount = new_matched
                changes_list.append(
                    (
                        record,
                        {
                            "matched_amount": (old_matched, new_matched),
                        },
                    )
                )

            record.holiday_extension_applied = holiday is not None
            record.tail_adjustment_applied = tail_adj is not None

            if resolution:
                if resolution.chosen_rule == "holiday_extension":
                    record.holiday_extension_applied = True
                    record.tail_adjustment_applied = False
                elif resolution.chosen_rule == "tail_adjustment":
                    record.tail_adjustment_applied = True
                    record.holiday_extension_applied = False
                elif resolution.resolution == DiscrepancyStatus.REJECTED:
                    record.holiday_extension_applied = False
                    record.tail_adjustment_applied = False

            if record.status == MatchStatus.PENDING_REVIEW:
                pass
            elif resolution and resolution.resolution == DiscrepancyStatus.REJECTED:
                record.status = MatchStatus.DISCREPANCY
            elif abs(record.expected_amount - record.matched_amount) > 0.001:
                record.status = MatchStatus.DISCREPANCY
            else:
                record.status = MatchStatus.MATCHED

            record.updated_at = datetime.now()
            record.updated_by = operator

        for record, changes in changes_list:
            self.audit.log_record_update(
                record=record,
                operator=operator,
                reason=reason,
                changes=changes,
            )

        return records

    def confirm_split_records(
        self,
        business_no: str,
        operator: str,
        confirm: bool,
        notes: str,
    ) -> List[FundMatchRecord]:
        records = self.repo.get_records_by_business_no(business_no)
        split_records = [r for r in records if r.is_split_record()]

        if not split_records:
            return records

        new_status = MatchStatus.MATCHED if confirm else MatchStatus.DISCREPANCY

        for record in split_records:
            old_status = record.status
            record.status = new_status
            record.updated_at = datetime.now()
            record.updated_by = operator

            self.audit.log_record_update(
                record=record,
                operator=operator,
                reason=f"结算主管复核拆分行：{notes}",
                changes={"status": (old_status.value, new_status.value)},
            )

        discrepancies = self.repo.get_discrepancies_by_business_no(business_no)
        for d in discrepancies:
            if d.is_split_record:
                self.repo.update_discrepancy_status(
                    discrepancy_id=d.discrepancy_id,
                    status=DiscrepancyStatus.RESOLVED if confirm else DiscrepancyStatus.REJECTED,
                    operator=operator,
                    notes=notes,
                )
                self.audit.log_discrepancy_resolution(
                    discrepancy=d,
                    operator=operator,
                    new_status=DiscrepancyStatus.RESOLVED if confirm else DiscrepancyStatus.REJECTED,
                    notes=notes,
                )

        return records

    def apply_holiday_extension(
        self,
        extension: HolidayExtension,
        operator: str,
    ) -> List[FundMatchRecord]:
        self.repo.add_holiday_extension(extension)

        records = self.repo.get_records_by_business_no(extension.business_no)
        for record in records:
            old_status = record.status
            if record.status != MatchStatus.PENDING_REVIEW:
                record.status = MatchStatus.DISCREPANCY
            record.updated_at = datetime.now()
            record.updated_by = operator

            self.audit.log_record_update(
                record=record,
                operator=operator,
                reason=f"导入节假日顺延说明，顺延 {extension.extension_days} 天：{extension.reason}",
                changes={
                    "holiday_extension_applied": (False, True),
                    "status": (old_status.value, record.status.value),
                },
            )

        self.audit.log_import(
            data_type="节假日顺延说明",
            operator=operator,
            batch=extension.import_batch or "manual",
            count=1,
        )

        return records

    def apply_tail_adjustment(
        self,
        adjustment: TailAdjustment,
        operator: str,
    ) -> List[FundMatchRecord]:
        self.repo.add_tail_adjustment(adjustment)

        records = self.repo.get_records_by_business_no(adjustment.business_no)
        for record in records:
            old_status = record.status
            if record.status != MatchStatus.PENDING_REVIEW:
                record.status = MatchStatus.DISCREPANCY
            record.updated_at = datetime.now()
            record.updated_by = operator

            self.audit.log_record_update(
                record=record,
                operator=operator,
                reason=f"补录尾差调整条，调整金额 {adjustment.adjustment_amount:.2f} 元：{adjustment.reason}",
                changes={
                    "tail_adjustment_applied": (False, True),
                    "status": (old_status.value, record.status.value),
                },
            )

        self.audit.log_import(
            data_type="尾差调整条",
            operator=operator,
            batch=adjustment.import_batch or "manual",
            count=1,
        )

        return records

    def _create_discrepancy_for_split(
        self,
        principal_record: FundMatchRecord,
        fee_record: FundMatchRecord,
        operator: str,
    ) -> DiscrepancyItem:
        discrepancy = DiscrepancyItem(
            business_no=principal_record.business_no,
            discrepancy_type="拆分行复核",
            description="同一业务号拆分为本金和手续费两行，待结算主管复核",
            expected_value=principal_record.expected_amount + fee_record.expected_amount,
            actual_value=principal_record.expected_amount + fee_record.expected_amount,
            status=DiscrepancyStatus.OPEN,
            related_record_ids=[principal_record.record_id, fee_record.record_id],
            is_split_record=True,
            requires_supervisor_review=True,
        )
        self.repo.add_discrepancy(discrepancy)

        self.audit.log_change(
            business_no=principal_record.business_no,
            operator=operator,
            action="创建差异项",
            field_changed="discrepancy",
            old_value=None,
            new_value="拆分行待复核",
            reason="同一业务号拆分为本金和手续费，系统不自动归正常，留待主管复核",
            affected_record_ids=[principal_record.record_id, fee_record.record_id],
            affected_calculation_fields=["status"],
        )

        return discrepancy
