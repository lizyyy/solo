import os
import re
import json
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from .config import SAMPLES_DIR, DEPOSIT_KEYWORDS, BATCH_PATTERN
from .database import get_db, check_file_already_processed, mark_file_processed
from .models import (
    PaymentRecord, RefundRequest, ApprovalEmail, ManualNote,
    AttachmentIndex, RecordStatus, EvidenceType
)


class FileTypeDetector:
    PATTERNS = {
        "payment_flow": ["收款流水", "交易流水", "payment", "transaction"],
        "refund_request": ["退款申请", "refund"],
        "approval_email": ["审批邮件", "approval", "email"],
        "manual_note": ["手写备注", "note", "remark"],
        "attachment_index": ["附件索引", "attachment"],
        "contract_scan": ["合同扫描件", "contract", "OCR"],
    }

    @classmethod
    def detect(cls, file_name: str) -> Optional[str]:
        name_lower = file_name.lower()
        for file_type, patterns in cls.PATTERNS.items():
            for pattern in patterns:
                if pattern.lower() in name_lower:
                    return file_type
        return None

    @classmethod
    def detect_by_content(cls, df: pd.DataFrame) -> Optional[str]:
        columns = [str(c).lower() for c in df.columns]
        if any("交易流水号" in c or "transaction" in c for c in columns):
            return "payment_flow"
        if any("申请编号" in c or "refund" in c for c in columns):
            return "refund_request"
        if any("邮件ID" in c or "email" in c for c in columns):
            return "approval_email"
        if any("备注编号" in c or "note" in c for c in columns):
            return "manual_note"
        if any("附件编号" in c or "attachment" in c for c in columns):
            return "attachment_index"
        if any("合同编号" in c or "contract" in c for c in columns):
            return "contract_scan"
        return None


class DataImporter:
    def __init__(self, db: Session):
        self.db = db
        self.import_results = []

    def read_file(self, file_path: str) -> pd.DataFrame:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        suffix = path.suffix.lower()
        if suffix == ".csv":
            df = pd.read_csv(file_path, dtype=str)
        elif suffix in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path, dtype=str)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

        df = df.fillna("")
        return df

    def parse_datetime(self, value: str) -> Optional[datetime]:
        if not value or pd.isna(value):
            return None
        try:
            return pd.to_datetime(value).to_pydatetime()
        except Exception:
            return None

    def parse_float(self, value: str) -> float:
        if not value or pd.isna(value):
            return 0.0
        try:
            return float(str(value).replace(",", ""))
        except Exception:
            return 0.0

    def parse_bool(self, value: str) -> bool:
        if not value:
            return False
        value = str(value).lower()
        return value in ["true", "1", "是", "yes", "y", "t"]

    def extract_batch(self, text: str) -> Optional[str]:
        if not text:
            return None
        match = re.search(BATCH_PATTERN, str(text), re.IGNORECASE)
        if match:
            batch_num = match.group(1) or match.group(2)
            return f"批次{batch_num.zfill(3)}"
        return None

    def is_deposit_related(self, text: str) -> bool:
        if not text:
            return False
        text = str(text)
        return any(kw in text for kw in DEPOSIT_KEYWORDS)

    def import_payment_flow(self, df: pd.DataFrame, source_file: str) -> int:
        count = 0
        for _, row in df.iterrows():
            transaction_no = str(row.get("交易流水号", row.get("transaction_no", ""))).strip()
            if not transaction_no:
                continue

            record = PaymentRecord(
                id=f"pay_{transaction_no}",
                transaction_no=transaction_no,
                payer=str(row.get("付款人", row.get("payer", ""))).strip(),
                payee=str(row.get("收款人", row.get("payee", ""))).strip(),
                amount=self.parse_float(row.get("金额", row.get("amount", "0"))),
                currency=str(row.get("币种", row.get("currency", "CNY"))).strip() or "CNY",
                transaction_time=self.parse_datetime(row.get("交易时间", row.get("transaction_time", ""))),
                bank_reference=str(row.get("银行参考号", row.get("bank_reference", ""))).strip(),
                remark=str(row.get("备注", row.get("remark", ""))).strip(),
                source_file=source_file,
                source_type="payment_flow",
                raw_data=json.dumps(row.to_dict(), ensure_ascii=False)
            )

            existing = self.db.query(PaymentRecord).filter(PaymentRecord.id == record.id).first()
            if existing:
                continue

            self.db.add(record)
            count += 1

        self.db.commit()
        return count

    def import_refund_request(self, df: pd.DataFrame, source_file: str) -> int:
        count = 0
        for _, row in df.iterrows():
            request_no = str(row.get("申请编号", row.get("request_no", ""))).strip()
            if not request_no:
                continue

            record = RefundRequest(
                id=f"ref_{request_no}",
                request_no=request_no,
                related_transaction_no=str(row.get("关联交易号", row.get("related_transaction_no", ""))).strip(),
                applicant=str(row.get("申请人", row.get("applicant", ""))).strip(),
                reason=str(row.get("退款原因", row.get("reason", ""))).strip(),
                amount=self.parse_float(row.get("申请金额", row.get("amount", "0"))),
                request_time=self.parse_datetime(row.get("申请时间", row.get("request_time", ""))),
                status=str(row.get("状态", row.get("status", ""))).strip(),
                approver=str(row.get("审批人", row.get("approver", ""))).strip(),
                approval_time=self.parse_datetime(row.get("审批时间", row.get("approval_time", ""))),
                source_file=source_file,
                raw_data=json.dumps(row.to_dict(), ensure_ascii=False)
            )

            existing = self.db.query(RefundRequest).filter(RefundRequest.id == record.id).first()
            if existing:
                continue

            self.db.add(record)
            count += 1

        self.db.commit()
        return count

    def import_approval_email(self, df: pd.DataFrame, source_file: str) -> int:
        count = 0
        for _, row in df.iterrows():
            email_id = str(row.get("邮件ID", row.get("email_id", ""))).strip()
            if not email_id:
                continue

            record = ApprovalEmail(
                id=f"eml_{email_id}",
                email_id=email_id,
                subject=str(row.get("主题", row.get("subject", ""))).strip(),
                sender=str(row.get("发件人", row.get("sender", ""))).strip(),
                recipients=str(row.get("收件人", row.get("recipients", ""))).strip(),
                sent_time=self.parse_datetime(row.get("发送时间", row.get("sent_time", ""))),
                related_transaction_no=str(row.get("关联交易号", row.get("related_transaction_no", ""))).strip(),
                related_request_no=str(row.get("关联申请号", row.get("related_request_no", ""))).strip(),
                content=str(row.get("内容", row.get("content", ""))).strip(),
                approval_decision=str(row.get("审批决定", row.get("approval_decision", ""))).strip(),
                approved_amount=self.parse_float(row.get("审批金额", row.get("approved_amount", "0"))),
                source_file=source_file,
                raw_data=json.dumps(row.to_dict(), ensure_ascii=False)
            )

            existing = self.db.query(ApprovalEmail).filter(ApprovalEmail.id == record.id).first()
            if existing:
                continue

            self.db.add(record)
            count += 1

        self.db.commit()
        return count

    def import_manual_note(self, df: pd.DataFrame, source_file: str) -> int:
        count = 0
        for _, row in df.iterrows():
            note_no = str(row.get("备注编号", row.get("note_no", ""))).strip()
            if not note_no:
                continue

            record = ManualNote(
                id=f"note_{note_no}",
                note_no=note_no,
                author=str(row.get("作者", row.get("author", ""))).strip(),
                note_time=self.parse_datetime(row.get("备注时间", row.get("note_time", ""))),
                related_transaction_no=str(row.get("关联交易号", row.get("related_transaction_no", ""))).strip(),
                related_request_no=str(row.get("关联申请号", row.get("related_request_no", ""))).strip(),
                content=str(row.get("内容", row.get("content", ""))).strip(),
                is_override=self.parse_bool(row.get("是否覆盖", row.get("is_override", "false"))),
                source_file=source_file,
                raw_data=json.dumps(row.to_dict(), ensure_ascii=False)
            )

            existing = self.db.query(ManualNote).filter(ManualNote.id == record.id).first()
            if existing:
                continue

            self.db.add(record)
            count += 1

        self.db.commit()
        return count

    def import_attachment_index(self, df: pd.DataFrame, source_file: str) -> int:
        count = 0
        for _, row in df.iterrows():
            attachment_no = str(row.get("附件编号", row.get("attachment_no", ""))).strip()
            if not attachment_no:
                continue

            record = AttachmentIndex(
                id=f"att_{attachment_no}",
                attachment_no=attachment_no,
                related_transaction_no=str(row.get("关联交易号", row.get("related_transaction_no", ""))).strip(),
                related_request_no=str(row.get("关联申请号", row.get("related_request_no", ""))).strip(),
                file_name=str(row.get("文件名", row.get("file_name", ""))).strip(),
                file_path=str(row.get("文件路径", row.get("file_path", ""))).strip(),
                file_type=str(row.get("文件类型", row.get("file_type", ""))).strip(),
                document_type=str(row.get("文档类型", row.get("document_type", ""))).strip(),
                description=str(row.get("描述", row.get("description", ""))).strip(),
                upload_time=self.parse_datetime(row.get("上传时间", row.get("upload_time", ""))),
                source_file=source_file,
                raw_data=json.dumps(row.to_dict(), ensure_ascii=False)
            )

            existing = self.db.query(AttachmentIndex).filter(AttachmentIndex.id == record.id).first()
            if existing:
                continue

            self.db.add(record)
            count += 1

        self.db.commit()
        return count

    def import_contract_scan(self, df: pd.DataFrame, source_file: str) -> Dict[str, Any]:
        contracts = {}
        for _, row in df.iterrows():
            transaction_no = str(row.get("关联交易号", row.get("related_transaction_no", ""))).strip()
            if not transaction_no:
                continue

            contracts[transaction_no] = {
                "contract_no": str(row.get("合同编号", row.get("contract_no", ""))).strip(),
                "amount": self.parse_float(row.get("保证金金额", row.get("amount", "0"))),
                "batch": str(row.get("批次号", row.get("batch", ""))).strip() or self.extract_batch(row.get("批次号", "")),
                "terms": str(row.get("合同条款", row.get("terms", ""))).strip(),
                "file_path": str(row.get("文件路径", row.get("file_path", ""))).strip(),
                "source_file": source_file
            }

        return contracts

    def import_file(self, file_path: str, skip_processed: bool = True) -> Dict[str, Any]:
        file_name = os.path.basename(file_path)

        if skip_processed and check_file_already_processed(self.db, file_path):
            return {
                "file": file_name,
                "status": "skipped",
                "message": "文件已处理过，跳过",
                "count": 0
            }

        try:
            df = self.read_file(file_path)
            file_type = FileTypeDetector.detect(file_name) or FileTypeDetector.detect_by_content(df)

            if not file_type:
                mark_file_processed(self.db, file_path, 0, "failed", f"无法识别文件类型: {file_name}")
                return {
                    "file": file_name,
                    "status": "failed",
                    "message": "无法识别文件类型",
                    "count": 0
                }

            import_method = getattr(self, f"import_{file_type}", None)
            if not import_method:
                mark_file_processed(self.db, file_path, 0, "failed", f"不支持的文件类型: {file_type}")
                return {
                    "file": file_name,
                    "status": "failed",
                    "message": f"不支持的文件类型: {file_type}",
                    "count": 0
                }

            result = import_method(df, file_path)

            if isinstance(result, dict):
                count = len(result)
                contracts = result
                mark_file_processed(self.db, file_path, count, "success")
                return {
                    "file": file_name,
                    "file_type": file_type,
                    "status": "success",
                    "count": count,
                    "contracts": contracts
                }
            else:
                count = result
                mark_file_processed(self.db, file_path, count, "success")
                return {
                    "file": file_name,
                    "file_type": file_type,
                    "status": "success",
                    "count": count
                }

        except Exception as e:
            mark_file_processed(self.db, file_path, 0, "failed", str(e))
            return {
                "file": file_name,
                "status": "failed",
                "message": str(e),
                "count": 0
            }

    def import_directory(self, dir_path: str, skip_processed: bool = True) -> List[Dict[str, Any]]:
        results = []
        path = Path(dir_path)
        if not path.exists():
            return results

        for file_path in sorted(path.glob("*")):
            if file_path.suffix.lower() in [".csv", ".xlsx", ".xls"]:
                result = self.import_file(str(file_path), skip_processed)
                results.append(result)

        return results


def import_all_samples() -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    contracts = {}
    with get_db() as db:
        importer = DataImporter(db)
        results = importer.import_directory(str(SAMPLES_DIR), skip_processed=False)

        for result in results:
            if result.get("file_type") == "contract_scan" and "contracts" in result:
                contracts.update(result["contracts"])

    return results, contracts
