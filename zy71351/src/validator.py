from __future__ import annotations

from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from datetime import datetime

from .models import PrintRecord, Conflict, Severity, BatchValidationResult, PrintStatus
from .storage import Storage


class EditionValidator:
    def __init__(self, storage: Storage):
        self.storage = storage

    def validate_batch(self, batch_id: str, new_records: List[PrintRecord]) -> BatchValidationResult:
        all_records = self.storage.load_all_records()
        existing_records = [r for r in all_records if r.batch_id != batch_id]
        batch_existing = [r for r in all_records if r.batch_id == batch_id]

        records_to_check = batch_existing + new_records

        conflicts: List[Conflict] = []

        conflicts.extend(self._check_duplicate_editions(records_to_check, existing_records))
        conflicts.extend(self._check_missing_certificates(records_to_check))
        conflicts.extend(self._check_stale_return_status(records_to_check))
        conflicts.extend(self._check_certificate_uniqueness(records_to_check, existing_records))
        conflicts.extend(self._check_edition_range_validity(records_to_check))

        is_valid = not any(c.severity == Severity.CRITICAL for c in conflicts)

        result = BatchValidationResult(
            batch_id=batch_id,
            total_records=len(records_to_check),
            conflicts=conflicts,
            is_valid=is_valid
        )

        self.storage.save_validation_result(result)
        self.storage.save_error_report(batch_id, conflicts)

        return result

    def _check_duplicate_editions(
        self,
        batch_records: List[PrintRecord],
        existing_records: List[PrintRecord]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []

        edition_map: Dict[str, List[PrintRecord]] = defaultdict(list)
        for record in batch_records:
            edition_map[record.get_edition_key()].append(record)

        for edition_key, records in edition_map.items():
            if len(records) > 1:
                buyers = [r.buyer or "(无购买人)" for r in records]
                record_ids = [r.record_id for r in records]
                conflicts.append(Conflict(
                    conflict_type="duplicate_edition",
                    severity=Severity.CRITICAL,
                    description=f"版号重复: {edition_key} 被分配给 {len(records)} 个购买人: {', '.join(buyers)}",
                    affected_records=record_ids,
                    details={
                        "edition_key": edition_key,
                        "buyers": buyers,
                        "record_ids": record_ids,
                        "conflict_scope": "within_batch"
                    }
                ))

        all_existing_editions = {r.get_edition_key(): r for r in existing_records}
        for record in batch_records:
            edition_key = record.get_edition_key()
            if edition_key in all_existing_editions:
                existing = all_existing_editions[edition_key]
                if existing.status != PrintStatus.RETURNED and record.status != PrintStatus.RETURNED:
                    conflicts.append(Conflict(
                        conflict_type="duplicate_edition",
                        severity=Severity.CRITICAL,
                        description=f"版号重复: {edition_key} 已在历史记录中存在，购买人: {existing.buyer}",
                        affected_records=[record.record_id, existing.record_id],
                        details={
                            "edition_key": edition_key,
                            "existing_buyer": existing.buyer,
                            "new_buyer": record.buyer,
                            "existing_batch": existing.batch_id,
                            "conflict_scope": "cross_batch"
                        }
                    ))

        return conflicts

    def _check_missing_certificates(self, records: List[PrintRecord]) -> List[Conflict]:
        conflicts: List[Conflict] = []

        for record in records:
            if record.is_sold_without_certificate():
                conflicts.append(Conflict(
                    conflict_type="missing_certificate",
                    severity=Severity.WARNING,
                    description=f"证书漏发: {record.get_edition_key()} 已售给 {record.buyer}，但证书号为空",
                    affected_records=[record.record_id],
                    details={
                        "edition_key": record.get_edition_key(),
                        "buyer": record.buyer,
                        "status": record.status.value,
                        "has_certificate": bool(record.certificate_number)
                    }
                ))

        return conflicts

    def _check_stale_return_status(self, records: List[PrintRecord]) -> List[Conflict]:
        conflicts: List[Conflict] = []

        for record in records:
            if record.status == PrintStatus.RETURNED:
                if record.buyer or record.certificate_number:
                    conflicts.append(Conflict(
                        conflict_type="stale_return_status",
                        severity=Severity.INFO,
                        description=f"退货状态未清理: {record.get_edition_key()} 标记为退货，但仍保留购买人/证书信息",
                        affected_records=[record.record_id],
                        details={
                            "edition_key": record.get_edition_key(),
                            "buyer": record.buyer,
                            "certificate_number": record.certificate_number,
                            "status": record.status.value,
                            "should_clear": ["buyer", "certificate_number"]
                        }
                    ))
            elif record.status == PrintStatus.SOLD and not record.buyer:
                conflicts.append(Conflict(
                    conflict_type="stale_return_status",
                    severity=Severity.INFO,
                    description=f"退货后状态未改: {record.get_edition_key()} 可能已退货但仍标记为已售",
                    affected_records=[record.record_id],
                    details={
                        "edition_key": record.get_edition_key(),
                        "buyer": record.buyer,
                        "status": record.status.value,
                        "suggested_status": PrintStatus.RETURNED.value
                    }
                ))

        return conflicts

    def _check_certificate_uniqueness(
        self,
        batch_records: List[PrintRecord],
        existing_records: List[PrintRecord]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []

        cert_map: Dict[str, List[PrintRecord]] = defaultdict(list)
        for record in batch_records:
            if record.certificate_number:
                cert_map[record.certificate_number].append(record)

        for cert_num, records in cert_map.items():
            if len(records) > 1:
                editions = [r.get_edition_key() for r in records]
                conflicts.append(Conflict(
                    conflict_type="duplicate_certificate",
                    severity=Severity.CRITICAL,
                    description=f"证书号重复: {cert_num} 被分配给多个版号: {', '.join(editions)}",
                    affected_records=[r.record_id for r in records],
                    details={
                        "certificate_number": cert_num,
                        "editions": editions
                    }
                ))

        existing_certs = {r.certificate_number: r for r in existing_records if r.certificate_number}
        for record in batch_records:
            if record.certificate_number and record.certificate_number in existing_certs:
                existing = existing_certs[record.certificate_number]
                conflicts.append(Conflict(
                    conflict_type="duplicate_certificate",
                    severity=Severity.CRITICAL,
                    description=f"证书号重复: {record.certificate_number} 已用于 {existing.get_edition_key()}",
                    affected_records=[record.record_id, existing.record_id],
                    details={
                        "certificate_number": record.certificate_number,
                        "existing_edition": existing.get_edition_key(),
                        "new_edition": record.get_edition_key()
                    }
                ))

        return conflicts

    def _check_edition_range_validity(self, records: List[PrintRecord]) -> List[Conflict]:
        conflicts: List[Conflict] = []

        series_info: Dict[str, Dict[str, List[Tuple[int, int, PrintRecord]]]] = defaultdict(
            lambda: {"regular": [], "ap": []}
        )

        for record in records:
            import re
            edition = record.edition_number
            ap_match = re.match(r"^AP\s+(\d+)/(\d+)$", edition)
            regular_match = re.match(r"^(\d+)/(\d+)$", edition)

            if ap_match:
                num, total = int(ap_match.group(1)), int(ap_match.group(2))
                series_info[record.series]["ap"].append((num, total, record))
            elif regular_match:
                num, total = int(regular_match.group(1)), int(regular_match.group(2))
                series_info[record.series]["regular"].append((num, total, record))

        for series, types in series_info.items():
            for type_name, entries in types.items():
                if not entries:
                    continue
                totals = set(e[1] for e in entries)
                if len(totals) > 1:
                    conflicts.append(Conflict(
                        conflict_type="inconsistent_edition_total",
                        severity=Severity.WARNING,
                        description=f"版号总数不一致: {series} {type_name}版 出现不同总数: {totals}",
                        affected_records=[e[2].record_id for e in entries],
                        details={
                            "series": series,
                            "type": type_name,
                            "totals": list(totals)
                        }
                    ))

                nums = [e[0] for e in entries]
                for num, total, record in entries:
                    if num < 1 or num > total:
                        conflicts.append(Conflict(
                            conflict_type="invalid_edition_number",
                            severity=Severity.CRITICAL,
                            description=f"版号超出范围: {series} {record.edition_number} 超出1-{total}范围",
                            affected_records=[record.record_id],
                            details={
                                "series": series,
                                "edition": record.edition_number,
                                "max_number": total
                            }
                        ))

                if len(set(nums)) != len(nums):
                    duplicates = [n for n in nums if nums.count(n) > 1]
                    for dup in set(duplicates):
                        dup_records = [e[2] for e in entries if e[0] == dup]
                        conflicts.append(Conflict(
                            conflict_type="duplicate_edition",
                            severity=Severity.CRITICAL,
                            description=f"同系列版号重复: {series} {type_name}版 第{dup}号出现{len(dup_records)}次",
                            affected_records=[r.record_id for r in dup_records],
                            details={
                                "series": series,
                                "type": type_name,
                                "duplicate_number": dup
                            }
                        ))

        return conflicts


class CertificateTracker:
    def __init__(self, storage: Storage):
        self.storage = storage

    def track_certificate(self, record_id: str, certificate_number: str) -> PrintRecord:
        record = self.storage.find_record_by_id(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        record.certificate_number = certificate_number
        record.updated_at = datetime.now()
        self.storage.update_record(record)
        return record

    def get_untracked_certificates(self) -> List[PrintRecord]:
        records = self.storage.load_all_records()
        return [r for r in records if r.status == PrintStatus.SOLD and not r.certificate_number]

    def verify_certificate_chain(self, batch_id: str) -> Dict[str, Any]:
        records = self.storage.get_records_by_batch(batch_id)
        sold_records = [r for r in records if r.status == PrintStatus.SOLD]
        with_cert = [r for r in sold_records if r.certificate_number]
        without_cert = [r for r in sold_records if not r.certificate_number]

        return {
            "total_sold": len(sold_records),
            "with_certificate": len(with_cert),
            "without_certificate": len(without_cert),
            "completion_rate": len(with_cert) / len(sold_records) if sold_records else 1.0,
            "missing_records": [r.record_id for r in without_cert]
        }


class ReturnRollback:
    def __init__(self, storage: Storage):
        self.storage = storage

    def process_return(self, record_id: str, clear_certificate: bool = True) -> PrintRecord:
        record = self.storage.find_record_by_id(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        previous_status = record.status
        previous_buyer = record.buyer
        previous_certificate = record.certificate_number

        record.status = PrintStatus.RETURNED
        if clear_certificate:
            record.certificate_number = None
        record.updated_at = datetime.now()

        if not record.remarks:
            record.remarks = ""
        record.remarks += f" | 退货处理: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        if previous_buyer:
            record.remarks += f" (原购买人: {previous_buyer})"
        if previous_certificate and clear_certificate:
            record.remarks += f" (原证书号: {previous_certificate})"
        record.remarks = record.remarks.lstrip(" | ")

        self.storage.update_record(record)
        return record

    def rollback_return(self, record_id: str, restore_buyer: Optional[str] = None,
                        restore_certificate: Optional[str] = None) -> PrintRecord:
        record = self.storage.find_record_by_id(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        if record.status != PrintStatus.RETURNED:
            raise ValueError(f"记录状态不是退货: {record.status}")

        record.status = PrintStatus.SOLD
        if restore_buyer:
            record.buyer = restore_buyer
        if restore_certificate:
            record.certificate_number = restore_certificate
        record.updated_at = datetime.now()

        if record.remarks:
            record.remarks += f" | 取消退货: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

        self.storage.update_record(record)
        return record

    def get_returned_records(self) -> List[PrintRecord]:
        records = self.storage.load_all_records()
        return [r for r in records if r.status == PrintStatus.RETURNED]

    def audit_return_status(self) -> List[Conflict]:
        records = self.storage.load_all_records()
        conflicts: List[Conflict] = []

        for record in records:
            if record.status == PrintStatus.RETURNED and record.buyer:
                conflicts.append(Conflict(
                    conflict_type="stale_return_status",
                    severity=Severity.INFO,
                    description=f"退货记录未清理: {record.get_edition_key()} 仍保留购买人 {record.buyer}",
                    affected_records=[record.record_id],
                    details={"recommended_action": "clear_buyer_and_certificate"}
                ))

        return conflicts
