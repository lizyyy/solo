from datetime import datetime, timedelta
from typing import List, Dict, Set
from collections import defaultdict

from .models import SampleRecord, ValidationResult, RejectionReason, ApprovalStatus


class RuleEngine:
    def __init__(self, max_hours_sampling_to_receive: int = 24):
        self.max_hours_sampling_to_receive = max_hours_sampling_to_receive

    def validate(self, records: List[SampleRecord]) -> ValidationResult:
        result = ValidationResult()
        result.total_records = len(records)

        self._validate_barcode_uniqueness(records, result)
        self._validate_time_constraints(records, result)
        self._validate_rejection_status(records, result)
        self._validate_required_fields(records, result)
        self._count_statistics(records, result)

        return result

    def _validate_barcode_uniqueness(self, records: List[SampleRecord], result: ValidationResult):
        barcode_map: Dict[str, List[SampleRecord]] = defaultdict(list)
        valid_records = [r for r in records if r.is_valid]

        for record in valid_records:
            barcode_map[record.barcode].append(record)

        for barcode, barcode_records in barcode_map.items():
            if len(barcode_records) > 1:
                result.barcode_duplicates.append(barcode)
                for record in barcode_records:
                    record.errors.append(f"条码重复: 该条码在 {len(barcode_records)} 条记录中出现")
                    record.rejection_reason = RejectionReason.BARCODE_DUPLICATE
                    record.is_rejected = True

    def _validate_time_constraints(self, records: List[SampleRecord], result: ValidationResult):
        for record in records:
            if not record.is_valid:
                continue

            if record.sampling_time is None:
                record.errors.append("采样时间缺失")
                record.warnings.append("无法验证接收时限")
                continue

            if record.receive_time is None:
                record.warnings.append("接收时间缺失，跳过接收时限验证")
                continue

            time_diff = record.receive_time - record.sampling_time

            if time_diff.total_seconds() < 0:
                record.errors.append("接收时间早于采样时间")
                record.rejection_reason = RejectionReason.TIME_INVALID
                record.is_rejected = True
            elif time_diff.total_seconds() > self.max_hours_sampling_to_receive * 3600:
                record.errors.append(f"接收超时: 采样到接收间隔 {time_diff.total_seconds() / 3600:.1f} 小时")
                result.time_expired.append(record.barcode)
                record.rejection_reason = RejectionReason.TIME_EXPIRED
                record.is_rejected = True

    def _validate_rejection_status(self, records: List[SampleRecord], result: ValidationResult):
        for record in records:
            if not record.is_valid:
                continue

            if record.is_rejected and record.rejection_reason is None:
                record.warnings.append("拒收但未填写拒收原因")

            if record.rejection_reason is not None and not record.is_rejected:
                record.is_rejected = True
                record.warnings.append("自动标记为拒收（因存在拒收原因）")

    def _validate_required_fields(self, records: List[SampleRecord], result: ValidationResult):
        for record in records:
            if not record.is_valid:
                continue

            if record.transporter is None or not record.transporter.strip():
                record.warnings.append("运输人信息缺失")

            if record.transport_batch is None or not record.transport_batch.strip():
                record.warnings.append("运输批次信息缺失")

    def _count_statistics(self, records: List[SampleRecord], result: ValidationResult):
        valid_count = 0
        invalid_count = 0
        rejected_count = 0
        pending_count = 0

        for record in records:
            if record.is_valid:
                valid_count += 1
            else:
                invalid_count += 1

            if record.is_rejected:
                rejected_count += 1

            if record.approval_status == ApprovalStatus.PENDING:
                pending_count += 1

            if record.errors:
                key = f"{record.source_file}:{record.source_row}"
                result.error_details[key] = record.errors.copy()

        result.valid_records = valid_count
        result.invalid_records = invalid_count
        result.rejected_records = rejected_count
        result.pending_approval = pending_count

    def get_records_by_barcode(self, records: List[SampleRecord], barcode: str) -> List[SampleRecord]:
        return sorted(
            [r for r in records if r.barcode == barcode],
            key=lambda x: (x.source_file, x.source_row)
        )

    def get_rejected_records(self, records: List[SampleRecord]) -> List[SampleRecord]:
        return sorted(
            [r for r in records if r.is_rejected],
            key=lambda x: (x.source_file, x.source_row)
        )

    def get_records_needing_approval(self, records: List[SampleRecord]) -> List[SampleRecord]:
        return sorted(
            [r for r in records if r.is_rejected and r.approval_status == ApprovalStatus.PENDING],
            key=lambda x: (x.source_file, x.source_row)
        )

    def get_records_by_source(self, records: List[SampleRecord], source_file: str) -> List[SampleRecord]:
        return sorted(
            [r for r in records if r.source_file == source_file],
            key=lambda x: x.source_row
        )

    def get_duplicate_groups(self, records: List[SampleRecord]) -> Dict[str, List[SampleRecord]]:
        barcode_map: Dict[str, List[SampleRecord]] = defaultdict(list)
        for record in records:
            if record.is_valid:
                barcode_map[record.barcode].append(record)

        return {
            barcode: sorted(group, key=lambda x: (x.source_file, x.source_row))
            for barcode, group in barcode_map.items()
            if len(group) > 1
        }
