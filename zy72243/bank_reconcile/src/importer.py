import os
import re
import pandas as pd
from datetime import datetime
from .database import load_config, get_session
from .models import ClearingBatch, TransactionRecord, AuditTrail


class CurrencyDetector:
    def __init__(self):
        config = load_config()
        self.cny_symbols = config["currency"]["cny_symbol"]
        self.hkd_symbols = config["currency"]["hkd_symbol"]
        self.mixed_keywords = config["currency"]["mixed_column_keywords"]
        self.audit_reasons = config["audit_reasons"]
        self.roles = config["roles"]

    def detect_currency_in_text(self, text):
        if not text or not isinstance(text, str):
            return [], False

        found = []
        text_upper = text.upper()

        for symbol in self.cny_symbols:
            if symbol.upper() in text_upper:
                found.append("CNY")
                break

        for symbol in self.hkd_symbols:
            if symbol.upper() in text_upper:
                found.append("HKD")
                break

        has_mixed = len(found) > 1
        return found, has_mixed

    def parse_amount_from_mixed(self, text):
        if not text or not isinstance(text, str):
            return None, None

        amount_pattern = r"([\-\+]?\d+\.?\d*)\s*([^\d\s\.\,]+)?"
        matches = re.findall(amount_pattern, text)

        amounts = []
        for amount_str, currency_str in matches:
            try:
                amount = float(amount_str)
                currency = "CNY"
                if currency_str:
                    currencies, _ = self.detect_currency_in_text(currency_str)
                    if currencies:
                        currency = currencies[0]
                amounts.append((amount, currency))
            except (ValueError, TypeError):
                continue

        if amounts:
            return amounts[0][0], amounts[0][1]
        return None, None


class BankStatementImporter:
    def __init__(self):
        self.detector = CurrencyDetector()
        self.session = get_session()
        config = load_config()
        self.audit_reasons = config["audit_reasons"]
        self.roles = config["roles"]

    def import_batch(self, file_path, batch_no, source_file=None):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        existing = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
        if existing:
            raise ValueError(f"清算批次号已存在: {batch_no}")

        batch = ClearingBatch(
            batch_no=batch_no,
            source_file=source_file or os.path.basename(file_path),
            import_date=datetime.now(),
            status="imported"
        )
        self.session.add(batch)
        self.session.flush()

        df = self._read_file(file_path)
        records = []
        mixed_count = 0

        for idx, row in df.iterrows():
            record = self._create_transaction(batch.id, row, idx)
            if record.has_mixed_currency:
                mixed_count += 1
            records.append(record)

        batch.total_records = len(records)
        batch.mixed_currency_count = mixed_count
        batch.status = "detected"

        self.session.add_all(records)
        self._generate_initial_audit(batch, records)
        self.session.commit()

        return {
            "batch_no": batch_no,
            "total_records": len(records),
            "mixed_currency_count": mixed_count,
            "batch_id": batch.id
        }

    def _read_file(self, file_path):
        ext = os.path.splitext(file_path)[1].lower()
        if ext in [".xlsx", ".xls"]:
            return pd.read_excel(file_path)
        elif ext == ".csv":
            return pd.read_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def _create_transaction(self, batch_id, row, idx):
        raw_amount = self._get_value(row, ["金额", "交易金额", "收支金额", "amount", "Amount"])
        currencies, has_mixed = self.detector.detect_currency_in_text(str(raw_amount))

        amount, currency = self.detector.parse_amount_from_mixed(str(raw_amount))
        if amount is None:
            amount = self._get_numeric_value(row, ["金额", "交易金额", "收支金额", "amount", "Amount"])
            if not currencies:
                currency = "CNY"
            else:
                currency = currencies[0]

        trans_date = self._get_date_value(row, ["日期", "交易日期", "date", "Date"])
        summary = self._get_value(row, ["摘要", "交易摘要", "summary", "Summary", "Remark", "备注"])
        trans_no = self._get_value(row, ["流水号", "交易流水号", "transaction_no", "TransactionNo"])
        counterparty = self._get_value(row, ["对方账户", "对方单位", "counterparty", "Counterparty"])
        remark = self._get_value(row, ["备注", "附言", "remark", "Remark"])

        return TransactionRecord(
            batch_id=batch_id,
            transaction_date=trans_date,
            transaction_no=str(trans_no) if trans_no else f"AUTO{idx:06d}",
            summary=str(summary) if summary else "",
            amount=float(amount) if amount is not None else 0.0,
            amount_column_raw=str(raw_amount) if raw_amount else "",
            currency=currency,
            has_mixed_currency=has_mixed,
            detected_currencies=",".join(currencies) if currencies else "",
            counterparty=str(counterparty) if counterparty else "",
            remark=str(remark) if remark else ""
        )

    def _generate_initial_audit(self, batch, records):
        for record in records:
            if record.has_mixed_currency:
                audit = AuditTrail(
                    batch_id=batch.id,
                    transaction_id=record.id,
                    audit_type="mixed_currency",
                    status="pending",
                    reason=self.audit_reasons["mixed_currency"],
                    missing_materials="需要清算批次号来源说明和币种区分凭证",
                    next_action=f"请{self.roles['custodian']}复核此笔交易",
                    responsible_party=self.roles["custodian"],
                    is_resolved=False
                )
                self.session.add(audit)

            if not batch.holiday_notes:
                audit = AuditTrail(
                    batch_id=batch.id,
                    transaction_id=record.id,
                    audit_type="missing_holiday_note",
                    status="pending",
                    reason=self.audit_reasons["missing_holiday_note"],
                    missing_materials="缺少节假日顺延说明",
                    next_action=f"请{self.roles['operator']}补录节假日顺延说明",
                    responsible_party=self.roles["operator"],
                    is_resolved=False
                )
                self.session.add(audit)

    def _get_value(self, row, possible_keys):
        for key in possible_keys:
            if key in row and pd.notna(row[key]):
                return row[key]
        return None

    def _get_numeric_value(self, row, possible_keys):
        for key in possible_keys:
            if key in row and pd.notna(row[key]):
                try:
                    return float(row[key])
                except (ValueError, TypeError):
                    continue
        return None

    def _get_date_value(self, row, possible_keys):
        for key in possible_keys:
            if key in row and pd.notna(row[key]):
                try:
                    return pd.to_datetime(row[key]).to_pydatetime()
                except (ValueError, TypeError):
                    continue
        return datetime.now()
