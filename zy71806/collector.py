from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from models import (
    SaleFeeRecord, RecordType, RecordStatus, Attachment,
    AutoJudgement, ReviewLog, FrozenAmount, ReviewResult
)
from utils import generate_id, is_close


class TailDiffCollector:
    def __init__(self):
        self.records: List[SaleFeeRecord] = []
        self.serial_number_map: Dict[str, List[SaleFeeRecord]] = defaultdict(list)
        self.product_code_map: Dict[str, List[SaleFeeRecord]] = defaultdict(list)

    def add_record(self, record: SaleFeeRecord) -> None:
        self.records.append(record)
        self.serial_number_map[record.serial_number].append(record)
        self.product_code_map[record.product_code].append(record)

    def detect_duplicates(self) -> List[Tuple[SaleFeeRecord, List[SaleFeeRecord]]]:
        duplicates = []
        for serial, records in self.serial_number_map.items():
            if len(records) > 1:
                main_record = records[0]
                dup_records = records[1:]
                duplicates.append((main_record, dup_records))
        return duplicates

    def mark_duplicates(self) -> None:
        for main_record, dup_records in self.detect_duplicates():
            for dup in dup_records:
                dup.record_type = RecordType.DUPLICATE
                dup.status = RecordStatus.MANUAL_REVIEW
                dup.review_reason = f"检测到重复流水号：{dup.serial_number}，与记录{main_record.id}重复"
                dup.next_step = "请核对业务真实性，如为误报请标记为正常记录，如为真实重复请合并或删除"
                dup.updated_at = datetime.now()

    def detect_late_attachments(self, deadline_hours: int = 24) -> List[SaleFeeRecord]:
        late_records = []
        for record in self.records:
            if record.record_type == RecordType.NORMAL and record.attachments:
                for att in record.attachments:
                    expected_time = record.sale_date + timedelta(hours=deadline_hours)
                    if att.uploaded_at > expected_time:
                        att.is_late = True
                        att.note = f"附件晚到，应在{expected_time.strftime('%Y-%m-%d %H:%M')}前上传"
                        if record.record_type == RecordType.NORMAL:
                            record.record_type = RecordType.LATE_ATTACHMENT
                            record.review_reason = f"存在晚到附件：{att.name}，晚到{round((att.uploaded_at - expected_time).total_seconds() / 3600, 1)}小时"
                            record.next_step = "请确认晚到附件的真实性和有效性，必要时联系业务人员说明情况"
                            late_records.append(record)
                            break
        return late_records

    def process_manual_correction(self, record_id: str, correction_note: str,
                                   corrected_fee: float, corrector: str) -> Optional[SaleFeeRecord]:
        for record in self.records:
            if record.id == record_id:
                old_fee = record.actual_fee
                old_tail = record.tail_diff

                record.actual_fee = corrected_fee
                record.tail_diff = record.expected_fee - corrected_fee
                record.record_type = RecordType.MANUAL_CORRECTION
                record.manual_correction_note = correction_note
                record.correction_source = corrector
                record.status = RecordStatus.MANUAL_REVIEW
                record.review_reason = f"人工更正：实际代销费从{old_fee}调整为{corrected_fee}，尾差从{old_tail}变为{record.tail_diff}。更正说明：{correction_note}"
                record.next_step = "请复核人工更正的合理性，核对调整依据是否充分"
                record.updated_at = datetime.now()
                return record
        return None

    def get_records_by_type(self, record_type: RecordType) -> List[SaleFeeRecord]:
        return [r for r in self.records if r.record_type == record_type]

    def get_records_by_status(self, status: RecordStatus) -> List[SaleFeeRecord]:
        return [r for r in self.records if r.status == status]

    def get_record_by_id(self, record_id: str) -> Optional[SaleFeeRecord]:
        for record in self.records:
            if record.id == record_id:
                return record
        return None
