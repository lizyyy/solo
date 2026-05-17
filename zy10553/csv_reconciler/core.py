import re
import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Optional, Any
from decimal import Decimal, InvalidOperation


@dataclass
class BadRow:
    file_path: str
    row_number: int
    raw_content: str
    error_reason: str


@dataclass
class Transaction:
    transaction_id: str
    amount: Decimal
    tax: Decimal
    fee: Decimal
    refund_status: str
    source_file: str
    row_number: int
    raw_data: Dict[str, Any]


class AmountNormalizer:
    @staticmethod
    def normalize(value: str) -> Decimal:
        if value is None or value == '':
            return Decimal('0')
        
        value = str(value).strip()
        
        value = re.sub(r'[¥$€£]', '', value)
        value = re.sub(r',', '', value)
        value = value.replace(' ', '')
        
        value = re.sub(r'\((.*?)\)', r'-\1', value)
        
        try:
            return Decimal(value)
        except InvalidOperation:
            raise ValueError(f"无法解析金额: {value}")


class CSVParser:
    def __init__(self, encoding: str = 'utf-8'):
        self.encoding = encoding
        self.bad_rows: List[BadRow] = []
    
    def parse_file(
        self,
        file_path: str,
        transaction_id_col: str,
        amount_col: str,
        tax_col: str,
        fee_col: str,
        refund_status_col: str,
        refund_status_values: Optional[Dict[str, str]] = None
    ) -> List[Transaction]:
        transactions = []
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        refund_map = refund_status_values or {}
        
        try:
            with open(path, 'r', encoding=self.encoding) as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(path, 'r', encoding='gbk') as f:
                content = f.read()
        
        lines = content.splitlines()
        if not lines:
            return transactions
        
        reader = csv.DictReader(lines)
        
        required_cols = [transaction_id_col, amount_col, tax_col, fee_col, refund_status_col]
        missing_cols = [col for col in required_cols if col not in reader.fieldnames]
        if missing_cols:
            raise ValueError(f"文件 {file_path} 缺少必要列: {', '.join(missing_cols)}")
        
        for row_num, row in enumerate(reader, start=2):
            try:
                transaction_id = str(row[transaction_id_col]).strip()
                if not transaction_id:
                    self.bad_rows.append(BadRow(
                        file_path=file_path,
                        row_number=row_num,
                        raw_content=str(row),
                        error_reason="交易号为空"
                    ))
                    continue
                
                amount = AmountNormalizer.normalize(row[amount_col])
                tax = AmountNormalizer.normalize(row[tax_col])
                fee = AmountNormalizer.normalize(row[fee_col])
                
                raw_refund = str(row[refund_status_col]).strip()
                refund_status = refund_map.get(raw_refund, raw_refund)
                
                transactions.append(Transaction(
                    transaction_id=transaction_id,
                    amount=amount,
                    tax=tax,
                    fee=fee,
                    refund_status=refund_status,
                    source_file=file_path,
                    row_number=row_num,
                    raw_data=row
                ))
                
            except Exception as e:
                self.bad_rows.append(BadRow(
                    file_path=file_path,
                    row_number=row_num,
                    raw_content=str(row),
                    error_reason=str(e)
                ))
        
        return transactions
    
    def get_bad_rows(self) -> List[BadRow]:
        return self.bad_rows
