import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from models import (
    DeviceLedger,
    DuplicateRecord,
    AbnormalRecord,
    DeduplicationResult,
    ReportCaliber,
    ApprovalNode,
)


class DeduplicationService:
    def __init__(self):
        self.receipts: Dict[str, DeviceLedger] = {}
        self.duplicates: List[DuplicateRecord] = []
        self.abnormal_records: List[AbnormalRecord] = []

    def add_receipt(self, receipt: DeviceLedger) -> None:
        self.receipts[receipt.id] = receipt

    def add_receipts_batch(self, receipts: List[DeviceLedger]) -> None:
        for receipt in receipts:
            self.receipts[receipt.id] = receipt

    def generate_fingerprint(self, receipt: DeviceLedger, fields: List[str]) -> str:
        values = []
        for field in fields:
            value = getattr(receipt, field, "")
            if value is None:
                value = ""
            values.append(str(value).strip().lower())
        content = "|".join(values)
        return hashlib.md5(content.encode("utf-8")).hexdigest()

    def find_duplicates_by_fields(
        self, fields: List[str], confidence_threshold: float = 0.8
    ) -> List[DuplicateRecord]:
        fingerprint_groups: Dict[str, List[DeviceLedger]] = defaultdict(list)
        
        for receipt in self.receipts.values():
            fingerprint = self.generate_fingerprint(receipt, fields)
            fingerprint_groups[fingerprint].append(receipt)
        
        new_duplicates: List[DuplicateRecord] = []
        
        for fingerprint, receipts in fingerprint_groups.items():
            if len(receipts) > 1:
                sorted_receipts = sorted(receipts, key=lambda r: r.created_at)
                original = sorted_receipts[0]
                
                for duplicate in sorted_receipts[1:]:
                    duplicate_record = DuplicateRecord(
                        id=str(uuid.uuid4()),
                        original_receipt_id=original.id,
                        duplicate_receipt_id=duplicate.id,
                        duplicate_fields=fields,
                        duplicate_reason=f"字段重复: {', '.join(fields)}",
                        confidence=1.0,
                        detected_at=datetime.now(),
                    )
                    new_duplicates.append(duplicate_record)
        
        self.duplicates.extend(new_duplicates)
        return new_duplicates

    def check_report_caliber_consistency(self) -> List[AbnormalRecord]:
        caliber_records: List[AbnormalRecord] = []
        
        store_calibers: Dict[str, set] = defaultdict(set)
        for receipt in self.receipts.values():
            store_calibers[receipt.store_code].add(receipt.report_caliber)
        
        for store_code, calibers in store_calibers.items():
            if len(calibers) > 1:
                store_receipts = [
                    r for r in self.receipts.values() if r.store_code == store_code
                ]
                for receipt in store_receipts:
                    other_calibers = [c for c in calibers if c != receipt.report_caliber]
                    abnormal = AbnormalRecord(
                        id=str(uuid.uuid4()),
                        receipt_id=receipt.id,
                        abnormal_type="报告口径不一致",
                        description=f"门店{receipt.store_name}({store_code})存在多种报告口径: {', '.join(calibers)}",
                        field_name="report_caliber",
                        original_value=receipt.report_caliber,
                        expected_value=other_calibers[0] if other_calibers else None,
                        detected_at=datetime.now(),
                    )
                    caliber_records.append(abnormal)
        
        self.abnormal_records.extend(caliber_records)
        return caliber_records

    def check_amount_abnormalities(self) -> List[AbnormalRecord]:
        amount_records: List[AbnormalRecord] = []
        
        for receipt in self.receipts.values():
            if receipt.purchase_amount <= 0:
                abnormal = AbnormalRecord(
                    id=str(uuid.uuid4()),
                    receipt_id=receipt.id,
                    abnormal_type="金额异常",
                    description=f"采购金额异常: {receipt.purchase_amount}",
                    field_name="purchase_amount",
                    original_value=str(receipt.purchase_amount),
                    expected_value="大于0的数值",
                    detected_at=datetime.now(),
                )
                amount_records.append(abnormal)
        
        self.abnormal_records.extend(amount_records)
        return amount_records

    def check_date_consistency(self) -> List[AbnormalRecord]:
        date_records: List[AbnormalRecord] = []
        
        for receipt in self.receipts.values():
            try:
                from datetime import datetime as dt
                purchase_dt = dt.strptime(receipt.purchase_date, "%Y-%m-%d")
                receipt_dt = dt.strptime(receipt.receipt_date, "%Y-%m-%d")
                
                if receipt_dt < purchase_dt:
                    abnormal = AbnormalRecord(
                        id=str(uuid.uuid4()),
                        receipt_id=receipt.id,
                        abnormal_type="日期逻辑异常",
                        description="收据日期早于采购日期",
                        field_name="receipt_date",
                        original_value=receipt.receipt_date,
                        expected_value=f"晚于{receipt.purchase_date}",
                        detected_at=datetime.now(),
                    )
                    date_records.append(abnormal)
            except ValueError:
                pass
        
        self.abnormal_records.extend(date_records)
        return date_records

    def get_original_receipt(self, receipt_id: str) -> Optional[DeviceLedger]:
        return self.receipts.get(receipt_id)

    def get_receipt_by_original_id(self, original_id: str) -> Optional[DeviceLedger]:
        for receipt in self.receipts.values():
            if receipt.original_id == original_id:
                return receipt
        return None

    def get_receipts_by_approval_node(
        self, approval_node: ApprovalNode
    ) -> List[DeviceLedger]:
        return [
            r for r in self.receipts.values() if r.approval_node == approval_node
        ]

    def get_receipts_by_store(self, store_code: str) -> List[DeviceLedger]:
        return [r for r in self.receipts.values() if r.store_code == store_code]

    def run_full_deduplication(
        self, deduplication_fields: Optional[List[str]] = None
    ) -> DeduplicationResult:
        if deduplication_fields is None:
            deduplication_fields = [
                "receipt_number",
                "device_code",
                "serial_number",
            ]
        
        self.duplicates.clear()
        self.abnormal_records.clear()
        
        duplicates = self.find_duplicates_by_fields(deduplication_fields)
        caliber_abnormal = self.check_report_caliber_consistency()
        amount_abnormal = self.check_amount_abnormalities()
        date_abnormal = self.check_date_consistency()
        
        total_abnormal = len(self.abnormal_records)
        caliber_changed_count = len(
            [r for r in self.abnormal_records if r.abnormal_type == "报告口径不一致"]
        )
        
        valid_count = len(self.receipts) - len(duplicates) - total_abnormal + caliber_changed_count
        
        return DeduplicationResult(
            total_processed=len(self.receipts),
            duplicates_found=len(duplicates),
            valid_records=max(0, valid_count),
            abnormal_records=total_abnormal - caliber_changed_count,
            caliber_changed_records=caliber_changed_count,
            duplicate_records=self.duplicates.copy(),
            abnormal_records_list=self.abnormal_records.copy(),
        )
