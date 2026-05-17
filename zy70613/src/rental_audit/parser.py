import csv
import json
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
import logging

from dateutil import parser as date_parser

from .models import (
    RentalOrder, DepositTransaction, DamageItem, RenewalApplication,
    SettlementReport, BadRow, SourceLocation, RentalStatus, DepositStatus,
    DamageSeverity
)

logger = logging.getLogger(__name__)


class ParseError(Exception):
    pass


class BaseParser:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.bad_rows: List[BadRow] = []

    def _make_source(self, line_number: Optional[int] = None, 
                     sheet_name: Optional[str] = None,
                     row_index: Optional[int] = None) -> SourceLocation:
        return SourceLocation(
            file_path=self.file_path,
            line_number=line_number,
            sheet_name=sheet_name,
            row_index=row_index
        )

    def _add_bad_row(self, raw_data: str, error_message: str, error_type: str,
                     line_number: Optional[int] = None,
                     sheet_name: Optional[str] = None,
                     row_index: Optional[int] = None) -> None:
        bad_row = BadRow(
            source=self._make_source(line_number, sheet_name, row_index),
            raw_data=raw_data,
            error_message=error_message,
            error_type=error_type
        )
        self.bad_rows.append(bad_row)
        logger.warning(f"解析错误 [{error_type}]: {error_message} 在 {self.file_path}:{line_number or row_index}")

    def _parse_date(self, value: str) -> date:
        if not value:
            raise ValueError("日期值为空")
        try:
            return date_parser.parse(value).date()
        except Exception as e:
            raise ValueError(f"无法解析日期: {value}, 错误: {str(e)}")

    def _parse_datetime(self, value: str) -> datetime:
        if not value:
            raise ValueError("日期时间值为空")
        try:
            return date_parser.parse(value)
        except Exception as e:
            raise ValueError(f"无法解析日期时间: {value}, 错误: {str(e)}")

    def _parse_decimal(self, value: str) -> Decimal:
        if not value:
            raise ValueError("数值为空")
        try:
            cleaned = str(value).strip().replace(',', '').replace('¥', '').replace('CNY', '')
            return Decimal(cleaned)
        except InvalidOperation:
            raise ValueError(f"无法解析金额: {value}")

    def _parse_int(self, value: str) -> int:
        if not value:
            raise ValueError("整数值为空")
        try:
            return int(value)
        except ValueError:
            raise ValueError(f"无法解析整数: {value}")

    def get_bad_rows(self) -> List[BadRow]:
        return self.bad_rows


class RentalOrderParser(BaseParser):
    def parse(self) -> Tuple[List[RentalOrder], List[BadRow]]:
        orders = []
        self.bad_rows = []
        
        path = Path(self.file_path)
        
        if path.suffix.lower() == '.csv':
            orders = self._parse_csv()
        elif path.suffix.lower() in ['.json', '.jsonl']:
            orders = self._parse_json()
        else:
            raise ParseError(f"不支持的文件格式: {path.suffix}")
        
        return orders, self.bad_rows

    def _parse_csv(self) -> List[RentalOrder]:
        orders = []
        
        with open(self.file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_idx, row in enumerate(reader, start=2):
                try:
                    order = self._parse_row(row, row_idx)
                    orders.append(order)
                except Exception as e:
                    self._add_bad_row(
                        raw_data=json.dumps(row, ensure_ascii=False),
                        error_message=str(e),
                        error_type="RentalOrderParseError",
                        line_number=row_idx
                    )
        
        return orders

    def _parse_row(self, row: Dict[str, str], line_number: int) -> RentalOrder:
        required_fields = ['order_id', 'customer_id', 'customer_name', 
                          'equipment_id', 'equipment_name', 'rental_start_date',
                          'rental_end_date', 'daily_rate', 'deposit_amount', 
                          'status', 'created_at']
        
        for field in required_fields:
            if field not in row or not str(row.get(field, '')).strip():
                raise ValueError(f"缺少必填字段: {field}")

        try:
            status = RentalStatus(str(row['status']).strip().lower())
        except ValueError:
            raise ValueError(f"无效的租赁状态: {row['status']}")

        actual_return_date = None
        if row.get('actual_return_date') and str(row['actual_return_date']).strip():
            actual_return_date = self._parse_date(row['actual_return_date'])

        return RentalOrder(
            order_id=str(row['order_id']).strip(),
            customer_id=str(row['customer_id']).strip(),
            customer_name=str(row['customer_name']).strip(),
            equipment_id=str(row['equipment_id']).strip(),
            equipment_name=str(row['equipment_name']).strip(),
            rental_start_date=self._parse_date(row['rental_start_date']),
            rental_end_date=self._parse_date(row['rental_end_date']),
            daily_rate=self._parse_decimal(row['daily_rate']),
            deposit_amount=self._parse_decimal(row['deposit_amount']),
            status=status,
            actual_return_date=actual_return_date,
            created_at=self._parse_datetime(row['created_at']),
            source=self._make_source(line_number=line_number)
        )

    def _parse_json(self) -> List[RentalOrder]:
        orders = []
        
        with open(self.file_path, 'r', encoding='utf-8') as f:
            if self.file_path.endswith('.jsonl'):
                for line_num, line in enumerate(f, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        order = self._parse_json_row(data, line_num)
                        orders.append(order)
                    except Exception as e:
                        self._add_bad_row(
                            raw_data=line,
                            error_message=str(e),
                            error_type="RentalOrderParseError",
                            line_number=line_num
                        )
            else:
                data = json.load(f)
                if not isinstance(data, list):
                    data = [data]
                for idx, item in enumerate(data):
                    try:
                        order = self._parse_json_row(item, idx + 1)
                        orders.append(order)
                    except Exception as e:
                        self._add_bad_row(
                            raw_data=json.dumps(item, ensure_ascii=False),
                            error_message=str(e),
                            error_type="RentalOrderParseError",
                            line_number=idx + 1
                        )
        
        return orders

    def _parse_json_row(self, data: Dict[str, Any], line_num: int) -> RentalOrder:
        try:
            status = RentalStatus(str(data['status']).strip().lower())
        except ValueError:
            raise ValueError(f"无效的租赁状态: {data.get('status')}")

        actual_return_date = None
        if data.get('actual_return_date'):
            actual_return_date = self._parse_date(str(data['actual_return_date']))

        return RentalOrder(
            order_id=str(data['order_id']),
            customer_id=str(data['customer_id']),
            customer_name=str(data['customer_name']),
            equipment_id=str(data['equipment_id']),
            equipment_name=str(data['equipment_name']),
            rental_start_date=self._parse_date(str(data['rental_start_date'])),
            rental_end_date=self._parse_date(str(data['rental_end_date'])),
            daily_rate=self._parse_decimal(str(data['daily_rate'])),
            deposit_amount=self._parse_decimal(str(data['deposit_amount'])),
            status=status,
            actual_return_date=actual_return_date,
            created_at=self._parse_datetime(str(data['created_at'])),
            source=self._make_source(line_number=line_num)
        )


class DepositTransactionParser(BaseParser):
    def parse(self) -> Tuple[List[DepositTransaction], List[BadRow]]:
        transactions = []
        self.bad_rows = []
        
        path = Path(self.file_path)
        
        if path.suffix.lower() == '.csv':
            transactions = self._parse_csv()
        elif path.suffix.lower() in ['.json', '.jsonl']:
            transactions = self._parse_json()
        else:
            raise ParseError(f"不支持的文件格式: {path.suffix}")
        
        return transactions, self.bad_rows

    def _parse_csv(self) -> List[DepositTransaction]:
        transactions = []
        
        with open(self.file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_idx, row in enumerate(reader, start=2):
                try:
                    transaction = self._parse_row(row, row_idx)
                    transactions.append(transaction)
                except Exception as e:
                    self._add_bad_row(
                        raw_data=json.dumps(row, ensure_ascii=False),
                        error_message=str(e),
                        error_type="DepositTransactionParseError",
                        line_number=row_idx
                    )
        
        return transactions

    def _parse_row(self, row: Dict[str, str], line_number: int) -> DepositTransaction:
        required_fields = ['transaction_id', 'order_id', 'transaction_type',
                          'amount', 'transaction_date', 'status', 'payment_method']
        
        for field in required_fields:
            if field not in row or not str(row.get(field, '')).strip():
                raise ValueError(f"缺少必填字段: {field}")

        try:
            status = DepositStatus(str(row['status']).strip().lower())
        except ValueError:
            raise ValueError(f"无效的押金状态: {row['status']}")

        return DepositTransaction(
            transaction_id=str(row['transaction_id']).strip(),
            order_id=str(row['order_id']).strip(),
            transaction_type=str(row['transaction_type']).strip(),
            amount=self._parse_decimal(row['amount']),
            currency=str(row.get('currency', 'CNY')).strip(),
            transaction_date=self._parse_datetime(row['transaction_date']),
            status=status,
            payment_method=str(row['payment_method']).strip(),
            reference_no=str(row.get('reference_no', '')).strip() or None,
            source=self._make_source(line_number=line_number)
        )

    def _parse_json(self) -> List[DepositTransaction]:
        transactions = []
        
        with open(self.file_path, 'r', encoding='utf-8') as f:
            if self.file_path.endswith('.jsonl'):
                for line_num, line in enumerate(f, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        transaction = self._parse_json_row(data, line_num)
                        transactions.append(transaction)
                    except Exception as e:
                        self._add_bad_row(
                            raw_data=line,
                            error_message=str(e),
                            error_type="DepositTransactionParseError",
                            line_number=line_num
                        )
            else:
                data = json.load(f)
                if not isinstance(data, list):
                    data = [data]
                for idx, item in enumerate(data):
                    try:
                        transaction = self._parse_json_row(item, idx + 1)
                        transactions.append(transaction)
                    except Exception as e:
                        self._add_bad_row(
                            raw_data=json.dumps(item, ensure_ascii=False),
                            error_message=str(e),
                            error_type="DepositTransactionParseError",
                            line_number=idx + 1
                        )
        
        return transactions

    def _parse_json_row(self, data: Dict[str, Any], line_num: int) -> DepositTransaction:
        try:
            status = DepositStatus(str(data['status']).strip().lower())
        except ValueError:
            raise ValueError(f"无效的押金状态: {data.get('status')}")

        return DepositTransaction(
            transaction_id=str(data['transaction_id']),
            order_id=str(data['order_id']),
            transaction_type=str(data['transaction_type']),
            amount=self._parse_decimal(str(data['amount'])),
            currency=str(data.get('currency', 'CNY')),
            transaction_date=self._parse_datetime(str(data['transaction_date'])),
            status=status,
            payment_method=str(data['payment_method']),
            reference_no=str(data.get('reference_no', '')) or None,
            source=self._make_source(line_number=line_num)
        )


class DamageItemParser(BaseParser):
    def parse(self) -> Tuple[List[DamageItem], List[BadRow]]:
        items = []
        self.bad_rows = []
        
        path = Path(self.file_path)
        
        if path.suffix.lower() == '.csv':
            items = self._parse_csv()
        elif path.suffix.lower() in ['.json', '.jsonl']:
            items = self._parse_json()
        else:
            raise ParseError(f"不支持的文件格式: {path.suffix}")
        
        return items, self.bad_rows

    def _parse_csv(self) -> List[DamageItem]:
        items = []
        
        with open(self.file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_idx, row in enumerate(reader, start=2):
                try:
                    item = self._parse_row(row, row_idx)
                    items.append(item)
                except Exception as e:
                    self._add_bad_row(
                        raw_data=json.dumps(row, ensure_ascii=False),
                        error_message=str(e),
                        error_type="DamageItemParseError",
                        line_number=row_idx
                    )
        
        return items

    def _parse_row(self, row: Dict[str, str], line_number: int) -> DamageItem:
        required_fields = ['damage_id', 'order_id', 'equipment_id',
                          'damage_description', 'severity', 'repair_cost',
                          'reported_date', 'reported_by']
        
        for field in required_fields:
            if field not in row or not str(row.get(field, '')).strip():
                raise ValueError(f"缺少必填字段: {field}")

        try:
            severity = DamageSeverity(str(row['severity']).strip().lower())
        except ValueError:
            raise ValueError(f"无效的损坏程度: {row['severity']}")

        photos = []
        if row.get('photos_attached'):
            photos = [p.strip() for p in str(row['photos_attached']).split(';') if p.strip()]

        is_verified = str(row.get('is_verified', '')).strip().lower() in ['true', '1', 'yes', '是']

        return DamageItem(
            damage_id=str(row['damage_id']).strip(),
            order_id=str(row['order_id']).strip(),
            equipment_id=str(row['equipment_id']).strip(),
            damage_description=str(row['damage_description']).strip(),
            severity=severity,
            repair_cost=self._parse_decimal(row['repair_cost']),
            reported_date=self._parse_datetime(row['reported_date']),
            reported_by=str(row['reported_by']).strip(),
            photos_attached=photos,
            is_verified=is_verified,
            source=self._make_source(line_number=line_number)
        )

    def _parse_json(self) -> List[DamageItem]:
        items = []
        
        with open(self.file_path, 'r', encoding='utf-8') as f:
            if self.file_path.endswith('.jsonl'):
                for line_num, line in enumerate(f, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        item = self._parse_json_row(data, line_num)
                        items.append(item)
                    except Exception as e:
                        self._add_bad_row(
                            raw_data=line,
                            error_message=str(e),
                            error_type="DamageItemParseError",
                            line_number=line_num
                        )
            else:
                data = json.load(f)
                if not isinstance(data, list):
                    data = [data]
                for idx, item in enumerate(data):
                    try:
                        damage_item = self._parse_json_row(item, idx + 1)
                        items.append(damage_item)
                    except Exception as e:
                        self._add_bad_row(
                            raw_data=json.dumps(item, ensure_ascii=False),
                            error_message=str(e),
                            error_type="DamageItemParseError",
                            line_number=idx + 1
                        )
        
        return items

    def _parse_json_row(self, data: Dict[str, Any], line_num: int) -> DamageItem:
        try:
            severity = DamageSeverity(str(data['severity']).strip().lower())
        except ValueError:
            raise ValueError(f"无效的损坏程度: {data.get('severity')}")

        photos = data.get('photos_attached', [])
        if isinstance(photos, str):
            photos = [p.strip() for p in photos.split(';') if p.strip()]

        return DamageItem(
            damage_id=str(data['damage_id']),
            order_id=str(data['order_id']),
            equipment_id=str(data['equipment_id']),
            damage_description=str(data['damage_description']),
            severity=severity,
            repair_cost=self._parse_decimal(str(data['repair_cost'])),
            reported_date=self._parse_datetime(str(data['reported_date'])),
            reported_by=str(data['reported_by']),
            photos_attached=photos,
            is_verified=bool(data.get('is_verified', False)),
            source=self._make_source(line_number=line_num)
        )


class RenewalApplicationParser(BaseParser):
    def parse(self) -> Tuple[List[RenewalApplication], List[BadRow]]:
        applications = []
        self.bad_rows = []
        
        path = Path(self.file_path)
        
        if path.suffix.lower() == '.csv':
            applications = self._parse_csv()
        elif path.suffix.lower() in ['.json', '.jsonl']:
            applications = self._parse_json()
        else:
            raise ParseError(f"不支持的文件格式: {path.suffix}")
        
        return applications, self.bad_rows

    def _parse_csv(self) -> List[RenewalApplication]:
        applications = []
        
        with open(self.file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_idx, row in enumerate(reader, start=2):
                try:
                    app = self._parse_row(row, row_idx)
                    applications.append(app)
                except Exception as e:
                    self._add_bad_row(
                        raw_data=json.dumps(row, ensure_ascii=False),
                        error_message=str(e),
                        error_type="RenewalApplicationParseError",
                        line_number=row_idx
                    )
        
        return applications

    def _parse_row(self, row: Dict[str, str], line_number: int) -> RenewalApplication:
        required_fields = ['renewal_id', 'order_id', 'original_end_date',
                          'new_end_date', 'renewal_days', 'renewal_fee',
                          'application_date', 'idempotency_key']
        
        for field in required_fields:
            if field not in row or not str(row.get(field, '')).strip():
                raise ValueError(f"缺少必填字段: {field}")

        approved = None
        if row.get('approved') and str(row['approved']).strip():
            approved = str(row['approved']).strip().lower() in ['true', '1', 'yes', '是']

        approved_by = None
        if row.get('approved_by') and str(row['approved_by']).strip():
            approved_by = str(row['approved_by']).strip()

        approved_date = None
        if row.get('approved_date') and str(row['approved_date']).strip():
            approved_date = self._parse_datetime(row['approved_date'])

        return RenewalApplication(
            renewal_id=str(row['renewal_id']).strip(),
            order_id=str(row['order_id']).strip(),
            original_end_date=self._parse_date(row['original_end_date']),
            new_end_date=self._parse_date(row['new_end_date']),
            renewal_days=self._parse_int(row['renewal_days']),
            renewal_fee=self._parse_decimal(row['renewal_fee']),
            application_date=self._parse_datetime(row['application_date']),
            approved=approved,
            approved_by=approved_by,
            approved_date=approved_date,
            idempotency_key=str(row['idempotency_key']).strip(),
            source=self._make_source(line_number=line_number)
        )

    def _parse_json(self) -> List[RenewalApplication]:
        applications = []
        
        with open(self.file_path, 'r', encoding='utf-8') as f:
            if self.file_path.endswith('.jsonl'):
                for line_num, line in enumerate(f, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        app = self._parse_json_row(data, line_num)
                        applications.append(app)
                    except Exception as e:
                        self._add_bad_row(
                            raw_data=line,
                            error_message=str(e),
                            error_type="RenewalApplicationParseError",
                            line_number=line_num
                        )
            else:
                data = json.load(f)
                if not isinstance(data, list):
                    data = [data]
                for idx, item in enumerate(data):
                    try:
                        app = self._parse_json_row(item, idx + 1)
                        applications.append(app)
                    except Exception as e:
                        self._add_bad_row(
                            raw_data=json.dumps(item, ensure_ascii=False),
                            error_message=str(e),
                            error_type="RenewalApplicationParseError",
                            line_number=idx + 1
                        )
        
        return applications

    def _parse_json_row(self, data: Dict[str, Any], line_num: int) -> RenewalApplication:
        approved = data.get('approved')
        if isinstance(approved, str):
            approved = approved.strip().lower() in ['true', '1', 'yes', '是']
        elif approved is not None:
            approved = bool(approved)

        approved_by = data.get('approved_by')
        if approved_by is not None:
            approved_by = str(approved_by)

        approved_date = data.get('approved_date')
        if approved_date is not None:
            approved_date = self._parse_datetime(str(approved_date))

        return RenewalApplication(
            renewal_id=str(data['renewal_id']),
            order_id=str(data['order_id']),
            original_end_date=self._parse_date(str(data['original_end_date'])),
            new_end_date=self._parse_date(str(data['new_end_date'])),
            renewal_days=self._parse_int(str(data['renewal_days'])),
            renewal_fee=self._parse_decimal(str(data['renewal_fee'])),
            application_date=self._parse_datetime(str(data['application_date'])),
            approved=approved,
            approved_by=approved_by,
            approved_date=approved_date,
            idempotency_key=str(data['idempotency_key']),
            source=self._make_source(line_number=line_num)
        )
