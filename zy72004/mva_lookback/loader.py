import csv
import os
from datetime import datetime
from typing import List, Optional, Tuple

from .models import (
    ApprovalRecord,
    AttachmentIndex,
    BaseRecord,
    NoteRecord,
    PaymentRecord,
    RecordType,
    RefundRecord,
)


class DataLoadError(Exception):
    pass


class DataLoader:
    def __init__(self):
        self.records: List[BaseRecord] = []
        self.attachments: List[AttachmentIndex] = []
        self.load_errors: List[dict] = []

    def load_csv(self, file_path: str, record_type_hint: Optional[str] = None) -> int:
        if not os.path.exists(file_path):
            self.load_errors.append({
                "file": file_path,
                "error": "文件不存在",
                "row": None,
            })
            return 0

        detected_type = record_type_hint or self._detect_type_from_filename(file_path)
        count = 0

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    record = self._parse_row(row, detected_type, file_path)
                    if record is not None:
                        self.records.append(record)
                        count += 1
                except Exception as e:
                    self.load_errors.append({
                        "file": file_path,
                        "error": str(e),
                        "row": row_num,
                        "data": dict(row),
                    })

        return count

    def load_attachments_index(self, file_path: str) -> int:
        if not os.path.exists(file_path):
            self.load_errors.append({
                "file": file_path,
                "error": "附件索引文件不存在",
                "row": None,
            })
            return 0

        count = 0
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    att = AttachmentIndex(
                        attachment_id=row.get("attachment_id", f"ATT-{row_num}"),
                        related_record_id=row.get("related_record_id", ""),
                        file_name=row.get("file_name", ""),
                        file_path=row.get("file_path", ""),
                        uploaded_at=row.get("uploaded_at", ""),
                        is_late=self._parse_bool(row.get("is_late", "false")),
                    )
                    self.attachments.append(att)
                    count += 1
                except Exception as e:
                    self.load_errors.append({
                        "file": file_path,
                        "error": str(e),
                        "row": row_num,
                        "data": dict(row),
                    })

        return count

    def load_directory(self, dir_path: str) -> Tuple[int, int]:
        if not os.path.isdir(dir_path):
            raise DataLoadError(f"目录不存在: {dir_path}")

        record_count = 0
        attachment_count = 0
        type_mapping = {
            "payment": "payment",
            "refund": "refund",
            "approval": "approval",
            "note": "note",
            "attach": "attachment",
        }

        for fname in sorted(os.listdir(dir_path)):
            fpath = os.path.join(dir_path, fname)
            if not os.path.isfile(fpath):
                continue
            if not fname.lower().endswith(".csv"):
                continue

            detected = None
            for keyword, rtype in type_mapping.items():
                if keyword in fname.lower():
                    detected = rtype
                    break

            if detected == "attachment":
                attachment_count += self.load_attachments_index(fpath)
            else:
                record_count += self.load_csv(fpath, detected)

        return record_count, attachment_count

    def _detect_type_from_filename(self, filename: str) -> Optional[str]:
        lower = filename.lower()
        if "payment" in lower or "收款" in lower:
            return "payment"
        if "refund" in lower or "退款" in lower:
            return "refund"
        if "approval" in lower or "审批" in lower:
            return "approval"
        if "note" in lower or "备注" in lower:
            return "note"
        return None

    def _parse_row(self, row: dict, record_type: Optional[str], source_file: str) -> Optional[BaseRecord]:
        record_id = row.get("record_id", "") or row.get("id", "")
        if not record_id:
            return None

        amount_str = row.get("amount", "") or row.get("金额", "")
        amount = self._parse_amount(amount_str)
        date_val = row.get("date", "") or row.get("日期", "")
        batch_id = row.get("batch_id", "") or row.get("批次", "")
        description = row.get("description", "") or row.get("描述", "") or row.get("摘要", "")

        base_kwargs = {
            "record_id": record_id,
            "source_file": os.path.basename(source_file),
            "batch_id": batch_id,
            "amount": amount,
            "currency": row.get("currency", "CNY"),
            "date": date_val,
            "description": description,
            "raw_data": dict(row),
        }

        if record_type == "payment":
            return PaymentRecord(
                record_type=RecordType.PAYMENT,
                payer=row.get("payer", "") or row.get("付款方", ""),
                payee=row.get("payee", "") or row.get("收款方", ""),
                transaction_no=row.get("transaction_no", "") or row.get("流水号", ""),
                settlement_status=row.get("settlement_status", "") or row.get("结算状态", ""),
                **base_kwargs,
            )
        elif record_type == "refund":
            return RefundRecord(
                record_type=RecordType.REFUND,
                original_payment_id=row.get("original_payment_id", "") or row.get("原付款id", ""),
                refund_reason=row.get("refund_reason", "") or row.get("退款原因", ""),
                applicant=row.get("applicant", "") or row.get("申请人", ""),
                approval_status=row.get("approval_status", "") or row.get("审批状态", ""),
                **base_kwargs,
            )
        elif record_type == "approval":
            return ApprovalRecord(
                record_type=RecordType.APPROVAL,
                email_subject=row.get("email_subject", "") or row.get("邮件主题", ""),
                sender=row.get("sender", "") or row.get("发件人", ""),
                recipients=row.get("recipients", "") or row.get("收件人", ""),
                approval_action=row.get("approval_action", "") or row.get("审批动作", ""),
                related_record_id=row.get("related_record_id", "") or row.get("关联记录id", ""),
                **base_kwargs,
            )
        elif record_type == "note":
            return NoteRecord(
                record_type=RecordType.NOTE,
                author=row.get("author", "") or row.get("作者", ""),
                category=row.get("category", "") or row.get("分类", ""),
                content=row.get("content", "") or row.get("内容", ""),
                **base_kwargs,
            )
        else:
            return BaseRecord(record_type=RecordType.NOTE, **base_kwargs)

    def _parse_amount(self, value: str) -> Optional[float]:
        if not value or not value.strip():
            return None
        try:
            cleaned = value.replace(",", "").replace("，", "").strip()
            return float(cleaned)
        except (ValueError, TypeError):
            return None

    def _parse_bool(self, value: str) -> bool:
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in ("true", "1", "yes", "是")
