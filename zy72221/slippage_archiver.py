import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from models import (
    CounterRecord, InstitutionMapping, ManagerEmail, SlippageRecord,
    RecordStatus, DiscrepancyType, ProcessingResult
)
from error_messages import get_error
from demo_data import get_historical_records


class SlippageArchiver:
    def __init__(self, institution_mapping: Dict[str, InstitutionMapping]):
        self.institution_mapping = institution_mapping
        self.records: Dict[str, SlippageRecord] = {}
        self.emails: Dict[str, ManagerEmail] = {}
        self.historical_records = get_historical_records()
        self.manual_fixes: List[Dict] = []
        self.rerun_history: List[Dict] = []

    def _generate_record_id(self) -> str:
        return f"SLP-" + datetime.now().strftime("%Y%m%d") + "-" + str(uuid.uuid4().hex[:6].upper())

    def _find_email_by_tail(self, tail_number: str) -> Optional[ManagerEmail]:
        for email in self.emails.values():
            if email.tail_number == tail_number:
                return email
        return None

    def _find_historical_by_tail(self, tail_number: str) -> List[Dict]:
        return [h for h in self.historical_records if h["tail_number"] == tail_number]

    def _match_historical_name(self, tail_number: str, name: str) -> Tuple[bool, Optional[str]]:
        history = self._find_historical_by_tail(tail_number)
        if not history:
            return False, None
        for h in history:
            if h["institution_name"] == name:
                return True, h["trade_date"]
        return False, None

    def import_counter_records(self, counter_records: List[CounterRecord]) -> ProcessingResult:
        result = ProcessingResult()
        tail_names = defaultdict(list)

        for record in counter_records:
            tail_names[record.tail_number].append(record)

        for tail, records in tail_names.items():
            mapping = self.institution_mapping.get(tail)
            if not mapping:
                result.error_messages.append(
                    get_error("no_mapping_found", tail=tail)
                )
                continue

            for counter_record in records:
                record_id = self._generate_record_id()
                imported_name = counter_record.institution_name
                is_name_match = (
                    imported_name == mapping.official_name
                    or imported_name in mapping.historical_aliases
                )

                discrepancy_type = DiscrepancyType.NONE
                status = RecordStatus.NORMAL
                discrepancy_detail = ""

                if not is_name_match:
                    discrepancy_type = DiscrepancyType.INSTITUTION_NAME_MISMATCH
                    status = RecordStatus.PENDING_REVIEW
                    discrepancy_detail = get_error(
                        "inst_name_mismatch_detail",
                        tail=tail,
                        date=counter_record.trade_date,
                        imported=imported_name,
                        official=mapping.official_name
                    )
                    result.error_messages.append(
                        get_error(
                            "inst_name_mismatch",
                            tail=tail,
                            imported=imported_name,
                            official=mapping.official_name
                        )
                    )
                    result.pending_review_count += 1
                else:
                    result.normal_count += 1

                slippage_record = SlippageRecord(
                    record_id=record_id,
                    tail_number=tail,
                    trade_date=counter_record.trade_date,
                    amount=counter_record.amount,
                    slippage=counter_record.slippage,
                    institution_name_imported=imported_name,
                    institution_name_verified=mapping.official_name if is_name_match else None,
                    status=status,
                    discrepancy_type=discrepancy_type,
                    discrepancy_detail=discrepancy_detail
                )

                self.records[record_id] = slippage_record
                result.records.append(slippage_record)
                result.total_count += 1

        return result

    def load_manager_emails(self, emails: List[ManagerEmail]) -> None:
        for email in emails:
            self.emails[email.email_id] = email

    def apply_supplement(self, tail_number: str) -> ProcessingResult:
        result = ProcessingResult()
        email = self._find_email_by_tail(tail_number)

        if not email:
            result.error_messages.append(
                get_error("supplement_not_found", tail=tail_number)
            )
            return result

        matching_records = [
            r for r in self.records.values()
            if r.tail_number == tail_number
            and r.status == RecordStatus.PENDING_REVIEW
        ]

        if not matching_records:
            return result

        for record in matching_records:
            email_name = email.institution_name_old
            imported_name = record.institution_name_imported

            if email_name == imported_name:
                hist_match, hist_date = self._match_historical_name(tail_number, email_name)

                if hist_match:
                    record.status = RecordStatus.SUPPLEMENTED
                    record.discrepancy_type = DiscrepancyType.NONE
                    record.institution_name_supplemented = email_name
                    record.email_reference = email.email_id
                    record.discrepancy_detail = get_error(
                        "supplement_match",
                        tail=tail_number,
                        email_id=email.email_id,
                        old_name=email_name
                    ) + " " + get_error(
                        "historical_match",
                        tail=tail_number,
                        name=email_name,
                        date=hist_date
                    )
                    record.updated_at = datetime.now()
                    result.supplemented_count += 1
                    result.records.append(record)
                else:
                    record.discrepancy_detail = get_error(
                        "supplement_match",
                        tail=tail_number,
                        email_id=email.email_id,
                        old_name=email_name
                    ) + " " + get_error(
                        "historical_mismatch",
                        tail=tail_number,
                        name=email_name
                    )
                    result.error_messages.append(record.discrepancy_detail)
            else:
                record.discrepancy_detail = get_error(
                    "supplement_mismatch",
                    tail=tail_number,
                    email_name=email_name,
                    imported=imported_name
                )
                result.error_messages.append(record.discrepancy_detail)

            result.total_count += 1

        return result

    def apply_manual_fix(self, record_id: str, operator: str, note: str, corrected_name: Optional[str] = None) -> ProcessingResult:
        result = ProcessingResult()
        record = self.records.get(record_id)

        if not record:
            result.error_messages.append(f"找不到记录ID：{record_id}")
            return result

        record.status = RecordStatus.MANUALLY_FIXED
        record.manual_fix_note = note
        if corrected_name:
            record.institution_name_verified = corrected_name
        record.updated_at = datetime.now()
        record.discrepancy_type = DiscrepancyType.NONE
        record.discrepancy_detail = get_error(
            "manual_fix_applied",
            tail=record.tail_number,
            operator=operator,
            note=note
        )

        self.manual_fixes.append({
            "record_id": record_id,
            "operator": operator,
            "note": note,
            "timestamp": datetime.now()
        })

        result.manually_fixed_count = 1
        result.records.append(record)
        result.total_count = 1
        return result

    def rerun_record(self, record_id: str) -> ProcessingResult:
        result = ProcessingResult()
        record = self.records.get(record_id)

        if not record:
            result.error_messages.append(f"找不到记录ID：{record_id}")
            return result

        if record.status == RecordStatus.PENDING_REVIEW:
            result.error_messages.append(
                get_error("pending_review_reminder", tail=record.tail_number)
            )
            return result

        record.rerun_count += 1
        record.status = RecordStatus.RERUN
        record.updated_at = datetime.now()
        record.discrepancy_detail = get_error(
            "rerun_completed",
            tail=record.tail_number,
            count=record.rerun_count,
            status=record.status.value
        )

        self.rerun_history.append({
            "record_id": record_id,
            "rerun_count": record.rerun_count,
            "timestamp": datetime.now()
        })

        result.rerun_count = 1
        result.records.append(record)
        result.total_count = 1
        return result

    def archive_records(self, record_ids: Optional[List[str]] = None) -> ProcessingResult:
        result = ProcessingResult()
        records_to_archive = []

        if record_ids:
            records_to_archive = [self.records[rid] for rid in record_ids if rid in self.records]
        else:
            records_to_archive = list(self.records.values())

        for record in records_to_archive:
            if record.status == RecordStatus.PENDING_REVIEW:
                result.error_messages.append(
                    get_error("pending_review_reminder", tail=record.tail_number)
                )
                continue

            record.archived = True
            record.archived_at = datetime.now()
            record.status = RecordStatus.ARCHIVED
            record.discrepancy_detail = get_error(
                "archive_success",
                tail=record.tail_number,
                time=record.archived_at.strftime("%Y-%m-%d %H:%M:%S")
            )
            result.records.append(record)
            result.total_count += 1

        return result

    def get_records_by_tail(self, tail_number: str) -> List[SlippageRecord]:
        return [r for r in self.records.values() if r.tail_number == tail_number]

    def get_pending_review_records(self) -> List[SlippageRecord]:
        return [r for r in self.records.values() if r.status == RecordStatus.PENDING_REVIEW]

    def get_supplemented_records(self) -> List[SlippageRecord]:
        return [r for r in self.records.values() if r.status == RecordStatus.SUPPLEMENTED]

    def print_summary(self) -> str:
        status_counts = defaultdict(int)
        for r in self.records.values():
            status_counts[r.status.value] += 1

        lines = ["=" * 60]
        lines.append("量化回测滑点归档 - 处理结果汇总")
        lines.append("=" * 60)
        for status, count in status_counts.items():
            lines.append(f"  {status}: {count} 条")
        lines.append(f"  总计: {len(self.records)} 条")
        lines.append("=" * 60)
        return "\n".join(lines)
