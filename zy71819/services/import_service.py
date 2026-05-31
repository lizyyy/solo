import os
import uuid
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from pathlib import Path

from config import UPLOAD_DIR, BILL_TYPE_INVOICE, BILL_TYPE_STATEMENT, BILL_TYPE_SETTLEMENT, STATUS_PENDING, STATUS_NORMAL
from models import Bill, UploadFile, HistoryRecord
from services.anomaly_detector import AnomalyDetector
from database import SessionLocal

COLUMN_MAPPING = {
    "bill_no": ["票据号", "票号", "单号", "单据号", "bill_no", "invoice_no", "serial"],
    "bill_date": ["票据日期", "开票日期", "日期", "date", "bill_date", "invoice_date"],
    "due_date": ["到期日期", "到期日", "兑付日期", "due_date", "maturity_date"],
    "amount": ["金额", "票面金额", "本金", "amount", "principal"],
    "fee_amount": ["手续费", "费用", "fee", "charge", "fee_amount"],
    "payer": ["付款方", "付款人", "出票人", "payer", "drawee", "issuer"],
    "payee": ["收款方", "收款人", "payee", "beneficiary"],
    "serial_no": ["流水号", "交易流水号", "银行流水号", "serial_no", "transaction_no", "bank_serial"],
    "bank_account": ["银行账号", "开户行", "账号", "bank_account", "account_no"],
    "remark": ["备注", "说明", "remark", "note", "description"],
}


class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self.detector = AnomalyDetector(db)

    def _parse_date(self, value: Any) -> datetime.date:
        if pd.isna(value) or value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, pd.Timestamp):
            return value.to_pydatetime().date()
        try:
            return pd.to_datetime(str(value)).date()
        except:
            return None

    def _parse_float(self, value: Any) -> float:
        if pd.isna(value) or value is None or value == "":
            return 0.0
        try:
            s = str(value).replace(",", "").replace("，", "").strip()
            return float(s)
        except:
            return 0.0

    def _map_columns(self, df: pd.DataFrame) -> Dict[str, str]:
        mapping = {}
        df_columns_lower = {col.lower(): col for col in df.columns}

        for target_name, possible_names in COLUMN_MAPPING.items():
            for name in possible_names:
                name_lower = name.lower()
                if name_lower in df_columns_lower:
                    mapping[target_name] = df_columns_lower[name_lower]
                    break
                for actual_col in df.columns:
                    if name_lower in actual_col.lower():
                        mapping[target_name] = actual_col
                        break
        return mapping

    def _read_file(self, file_path: Path) -> pd.DataFrame:
        suffix = file_path.suffix.lower()
        if suffix in [".xlsx", ".xls"]:
            return pd.read_excel(file_path)
        elif suffix == ".csv":
            try:
                return pd.read_csv(file_path, encoding="utf-8")
            except UnicodeDecodeError:
                return pd.read_csv(file_path, encoding="gbk")
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _save_upload_record(self, filename: str, file_path: str, file_type: str, record_count: int) -> UploadFile:
        upload = UploadFile(
            file_name=filename,
            file_path=file_path,
            file_type=file_type,
            record_count=record_count,
            processed=True,
            processed_at=datetime.now(),
            upload_time=datetime.now()
        )
        self.db.add(upload)
        self.db.flush()
        return upload

    def _create_history_record(self, bill_id: int, operator: str = "import"):
        history = HistoryRecord(
            bill_id=bill_id,
            operation_type="import",
            operator=operator,
            remark="系统导入"
        )
        self.db.add(history)

    def import_bills(self, file, file_type: str, operator: str = "operator") -> Tuple[int, List[Bill], List[str]]:
        filename = file.filename
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        save_path = UPLOAD_DIR / unique_name

        with open(save_path, "wb") as f:
            content = file.file.read()
            f.write(content)

        df = self._read_file(save_path)
        mapping = self._map_columns(df)

        bills = []
        errors = []

        bill_type_map = {
            "invoice": BILL_TYPE_INVOICE,
            "statement": BILL_TYPE_STATEMENT,
            "settlement": BILL_TYPE_SETTLEMENT,
        }
        actual_bill_type = bill_type_map.get(file_type, BILL_TYPE_INVOICE)

        for idx, row in df.iterrows():
            try:
                bill_data = {
                    "bill_no": str(row[mapping["bill_no"]]).strip() if "bill_no" in mapping else f"AUTO{idx + 1}",
                    "bill_type": actual_bill_type,
                    "amount": self._parse_float(row[mapping["amount"]]) if "amount" in mapping else 0.0,
                    "fee_amount": self._parse_float(row[mapping["fee_amount"]]) if "fee_amount" in mapping else 0.0,
                    "bill_date": self._parse_date(row[mapping["bill_date"]]) if "bill_date" in mapping else datetime.now().date(),
                    "due_date": self._parse_date(row[mapping["due_date"]]) if "due_date" in mapping else datetime.now().date(),
                    "payer": str(row[mapping["payer"]]).strip() if "payer" in mapping and not pd.isna(row[mapping["payer"]]) else None,
                    "payee": str(row[mapping["payee"]]).strip() if "payee" in mapping and not pd.isna(row[mapping["payee"]]) else None,
                    "serial_no": str(row[mapping["serial_no"]]).strip() if "serial_no" in mapping and not pd.isna(row[mapping["serial_no"]]) else None,
                    "bank_account": str(row[mapping["bank_account"]]).strip() if "bank_account" in mapping and not pd.isna(row[mapping["bank_account"]]) else None,
                    "source_file": filename,
                    "source_type": file_type,
                    "remark": str(row[mapping["remark"]]).strip() if "remark" in mapping and not pd.isna(row[mapping["remark"]]) else None,
                    "status": STATUS_NORMAL,
                }

                bill = Bill(**bill_data)
                bill = self.detector.analyze_and_mark(bill)

                bills.append(bill)
                self.db.add(bill)
                self.db.flush()

                self._create_history_record(bill.id, operator)

            except Exception as e:
                errors.append(f"第{idx + 1}行解析失败: {str(e)}")

        upload_record = self._save_upload_record(filename, str(save_path), file_type, len(bills))
        self.db.commit()

        return upload_record.id, bills, errors

    def match_invoice_with_statement(self, invoice_ids: List[int] = None):
        query = self.db.query(Bill).filter(Bill.bill_type == BILL_TYPE_INVOICE)
        if invoice_ids:
            query = query.filter(Bill.id.in_(invoice_ids))
        invoices = query.all()

        statements = self.db.query(Bill).filter(
            Bill.bill_type == BILL_TYPE_STATEMENT
        ).all()

        matched_count = 0
        for invoice in invoices:
            for stmt in statements:
                if invoice.serial_no and stmt.serial_no and invoice.serial_no == stmt.serial_no:
                    if abs(invoice.amount - stmt.amount) < 0.01:
                        invoice.related_statement_id = stmt.id
                        stmt.related_invoice_id = invoice.id
                        matched_count += 1
                        break

        self.db.commit()
        return matched_count
