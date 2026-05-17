import csv
import glob
import os
from datetime import datetime
from typing import List, Tuple, Dict, Optional
from models import Transaction, TransactionType, SourceLocation
from config import AppConfig


class TransactionParser:
    def __init__(self, config: AppConfig):
        self.config = config
        self.bad_rows: List[SourceLocation] = []

    def _find_column(self, header: List[str], possible_names: List[str]) -> Optional[int]:
        header_lower = [h.strip().lower() for h in header]
        for name in possible_names:
            name_lower = name.lower()
            if name_lower in header_lower:
                return header_lower.index(name_lower)
        return None

    def _parse_datetime(self, value: str, formats: List[str]) -> Optional[datetime]:
        value = value.strip()
        if not value:
            return None
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        return None

    def _parse_amount(self, value: str) -> float:
        value = value.strip()
        value = value.replace(",", "").replace("¥", "").replace("￥", "")
        try:
            return float(value)
        except ValueError:
            return 0.0

    def _parse_transaction_type(self, value: str) -> TransactionType:
        value = value.strip().lower()
        if "refund" in value or "退款" in value:
            return TransactionType.REFUND
        return TransactionType.PAYMENT

    def _parse_bool(self, value: str) -> bool:
        value = value.strip().lower()
        return value in ["true", "1", "yes", "是", "退款", "refund"]

    def parse_file(
        self,
        file_path: str,
        column_mapping: Dict[str, List[str]],
        date_formats: List[str]
    ) -> Tuple[List[Transaction], List[SourceLocation]]:
        transactions: List[Transaction] = []
        bad_rows: List[SourceLocation] = []
        file_path = os.path.abspath(file_path)

        with open(file_path, "r", encoding=self.config.parser.encoding, errors="replace") as f:
            reader = csv.reader(f, delimiter=self.config.parser.delimiter)
            lines = list(reader)

        start_row = self.config.parser.skip_rows
        if self.config.parser.has_header:
            start_row += 1
            if start_row > len(lines):
                return transactions, bad_rows
            header = lines[self.config.parser.skip_rows] if self.config.parser.skip_rows < len(lines) else []
        else:
            header = []

        column_indices = {}
        for field, possible_names in column_mapping.items():
            column_indices[field] = self._find_column(header, possible_names)

        for line_num in range(start_row, len(lines)):
            row = lines[line_num]
            raw_content = self.config.parser.delimiter.join(row)
            source_location = SourceLocation(
                file_path=file_path,
                line_number=line_num + 1,
                raw_content=raw_content
            )

            try:
                def get_value(field: str) -> str:
                    idx = column_indices.get(field)
                    if idx is not None and idx < len(row):
                        return str(row[idx]).strip()
                    return ""

                transaction_id = get_value("transaction_id")
                store_id = get_value("store_id")
                amount = self._parse_amount(get_value("amount"))
                transaction_time_str = get_value("transaction_time")
                transaction_time = self._parse_datetime(transaction_time_str, date_formats)
                transaction_type = self._parse_transaction_type(get_value("transaction_type"))
                payment_method = get_value("payment_method") or None
                order_no = get_value("order_no") or None
                is_refund_marked = self._parse_bool(get_value("is_refund"))
                refund_reference = get_value("refund_reference") or None

                if is_refund_marked:
                    transaction_type = TransactionType.REFUND

                if not transaction_id or not transaction_time:
                    bad_rows.append(source_location)
                    continue

                extra = {}
                for i, h in enumerate(header):
                    if i < len(row) and h not in [v[0] for v in column_mapping.values()]:
                        extra[h] = row[i]

                transaction = Transaction(
                    transaction_id=transaction_id,
                    store_id=store_id,
                    amount=amount,
                    transaction_time=transaction_time,
                    transaction_type=transaction_type,
                    source=source_location,
                    payment_method=payment_method,
                    order_no=order_no,
                    is_refund_marked=is_refund_marked,
                    refund_reference=refund_reference,
                    extra=extra
                )
                transactions.append(transaction)

            except Exception as e:
                bad_rows.append(source_location)

        return transactions, bad_rows

    def parse_files(
        self,
        file_patterns: List[str],
        column_mapping: Dict[str, List[str]],
        date_formats: List[str]
    ) -> Tuple[List[Transaction], List[SourceLocation]]:
        all_transactions: List[Transaction] = []
        all_bad_rows: List[SourceLocation] = []

        for pattern in file_patterns:
            matched_files = glob.glob(pattern, recursive=True)
            if not matched_files:
                continue

            for file_path in sorted(matched_files):
                if not os.path.isfile(file_path):
                    continue
                transactions, bad_rows = self.parse_file(file_path, column_mapping, date_formats)
                all_transactions.extend(transactions)
                all_bad_rows.extend(bad_rows)

        all_transactions.sort(key=lambda t: (t.transaction_time, t.transaction_id))
        return all_transactions, all_bad_rows

    def parse_cash_register(self, file_patterns: List[str]) -> Tuple[List[Transaction], List[SourceLocation]]:
        return self.parse_files(
            file_patterns,
            self.config.cash_register_columns,
            self.config.parser.cash_register_date_formats
        )

    def parse_payment_gateway(self, file_patterns: List[str]) -> Tuple[List[Transaction], List[SourceLocation]]:
        return self.parse_files(
            file_patterns,
            self.config.payment_gateway_columns,
            self.config.parser.payment_gateway_date_formats
        )
