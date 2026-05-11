#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sqlite3
import sys
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP, getcontext
from pathlib import Path
from typing import Optional

getcontext().prec = 18

MONEY_SCALE = 2
VOLUME_UNITS = {'CBM', 'CFT'}
WEIGHT_UNITS = {'KG', 'LBS', 'TON'}
FEE_TYPES = {'港杂费', 'THC', '文件费', '换单费', '电放费', '封条费', '报关费', '报检费', '查验费', '消毒费', '其他'}


def money_round(value: Decimal) -> Decimal:
    return value.quantize(Decimal(f'0.01'), rounding=ROUND_HALF_UP)


def cbm_from(value: Decimal, unit: str) -> Decimal:
    unit = unit.upper()
    if unit == 'CBM':
        return value
    if unit == 'CFT':
        return value * Decimal('0.0283168')
    raise ValueError(f'未知体积单位: {unit}')


def kg_from(value: Decimal, unit: str) -> Decimal:
    unit = unit.upper()
    if unit == 'KG':
        return value
    if unit == 'LBS':
        return value * Decimal('0.45359237')
    if unit == 'TON':
        return value * Decimal('1000')
    raise ValueError(f'未知重量单位: {unit}')


@dataclass
class Cargo:
    id: Optional[int]
    customer: str
    bl_no: str
    container_no: str
    volume: Decimal
    volume_unit: str
    weight: Decimal
    weight_unit: str
    cargo_value: Optional[Decimal]
    is_repack: bool
    remark: Optional[str]
    import_batch_id: int


@dataclass
class Container:
    id: Optional[int]
    container_no: str
    container_type: str
    voyage_no: Optional[str]
    etd: Optional[str]
    import_batch_id: int


@dataclass
class Fee:
    id: Optional[int]
    container_no: str
    fee_type: str
    amount: Decimal
    currency: str
    remark: Optional[str]
    import_batch_id: int


@dataclass
class ReturnRecord:
    id: Optional[int]
    bl_no: str
    container_no: Optional[str]
    return_date: Optional[str]
    amount: Decimal
    currency: str
    remark: Optional[str]
    import_batch_id: int


@dataclass
class Payment:
    id: Optional[int]
    customer: str
    bl_no: Optional[str]
    amount: Decimal
    currency: str
    payment_date: Optional[str]
    remark: Optional[str]
    import_batch_id: int


@dataclass
class ValidationError:
    row_no: int
    source: str
    field: str
    message: str
    raw_value: str


class Database:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
            self._init_schema()
        return self._conn

    def _init_schema(self):
        cur = self.conn.cursor()
        cur.executescript('''
        CREATE TABLE IF NOT EXISTS import_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            source_file TEXT,
            batch_hash TEXT UNIQUE,
            remark TEXT
        );

        CREATE TABLE IF NOT EXISTS containers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            container_no TEXT NOT NULL,
            container_type TEXT NOT NULL,
            voyage_no TEXT,
            etd TEXT,
            import_batch_id INTEGER NOT NULL,
            UNIQUE(container_no),
            FOREIGN KEY(import_batch_id) REFERENCES import_batches(id)
        );

        CREATE TABLE IF NOT EXISTS cargos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer TEXT NOT NULL,
            bl_no TEXT NOT NULL,
            container_no TEXT NOT NULL,
            volume TEXT NOT NULL,
            volume_unit TEXT NOT NULL,
            weight TEXT NOT NULL,
            weight_unit TEXT NOT NULL,
            cargo_value TEXT,
            is_repack INTEGER NOT NULL DEFAULT 0,
            remark TEXT,
            import_batch_id INTEGER NOT NULL,
            UNIQUE(bl_no, container_no),
            FOREIGN KEY(container_no) REFERENCES containers(container_no),
            FOREIGN KEY(import_batch_id) REFERENCES import_batches(id)
        );

        CREATE TABLE IF NOT EXISTS fees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            container_no TEXT NOT NULL,
            fee_type TEXT NOT NULL,
            amount TEXT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'CNY',
            remark TEXT,
            import_batch_id INTEGER NOT NULL,
            FOREIGN KEY(container_no) REFERENCES containers(container_no),
            FOREIGN KEY(import_batch_id) REFERENCES import_batches(id)
        );

        CREATE TABLE IF NOT EXISTS return_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bl_no TEXT NOT NULL,
            container_no TEXT,
            return_date TEXT,
            amount TEXT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'CNY',
            remark TEXT,
            import_batch_id INTEGER NOT NULL,
            FOREIGN KEY(import_batch_id) REFERENCES import_batches(id)
        );

        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer TEXT NOT NULL,
            bl_no TEXT,
            amount TEXT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'CNY',
            payment_date TEXT,
            remark TEXT,
            import_batch_id INTEGER NOT NULL,
            FOREIGN KEY(import_batch_id) REFERENCES import_batches(id)
        );

        CREATE TABLE IF NOT EXISTS validation_errors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            import_batch_id INTEGER NOT NULL,
            row_no INTEGER NOT NULL,
            source TEXT NOT NULL,
            field TEXT NOT NULL,
            message TEXT NOT NULL,
            raw_value TEXT,
            FOREIGN KEY(import_batch_id) REFERENCES import_batches(id)
        );

        CREATE TABLE IF NOT EXISTS split_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            container_no TEXT NOT NULL,
            bl_no TEXT NOT NULL,
            fee_type TEXT NOT NULL,
            original_amount TEXT NOT NULL,
            split_amount TEXT NOT NULL,
            split_base TEXT NOT NULL,
            split_ratio TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        ''')
        self.conn.commit()

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

    def begin(self):
        self.conn.execute('BEGIN')

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def create_batch(self, source_file: str, batch_hash: str, remark: str) -> int:
        cur = self.conn.cursor()
        cur.execute('''
            INSERT OR IGNORE INTO import_batches(created_at, source_file, batch_hash, remark)
            VALUES (?, ?, ?, ?)
        ''', (datetime.now().isoformat(), source_file, batch_hash, remark))
        cur.execute('SELECT id FROM import_batches WHERE batch_hash = ?', (batch_hash,))
        return cur.fetchone()[0]

    def batch_exists(self, batch_hash: str) -> bool:
        cur = self.conn.cursor()
        cur.execute('SELECT 1 FROM import_batches WHERE batch_hash = ?', (batch_hash,))
        return cur.fetchone() is not None

    def insert_container(self, c: Container):
        self.conn.execute('''
            INSERT OR REPLACE INTO containers(container_no, container_type, voyage_no, etd, import_batch_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (c.container_no, c.container_type, c.voyage_no, c.etd, c.import_batch_id))

    def insert_cargo(self, c: Cargo):
        self.conn.execute('''
            INSERT OR REPLACE INTO cargos(
                customer, bl_no, container_no, volume, volume_unit, weight, weight_unit,
                cargo_value, is_repack, remark, import_batch_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            c.customer, c.bl_no, c.container_no, str(c.volume), c.volume_unit,
            str(c.weight), c.weight_unit,
            str(c.cargo_value) if c.cargo_value else None,
            1 if c.is_repack else 0, c.remark, c.import_batch_id
        ))

    def insert_fee(self, f: Fee):
        self.conn.execute('''
            INSERT INTO fees(container_no, fee_type, amount, currency, remark, import_batch_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (f.container_no, f.fee_type, str(f.amount), f.currency, f.remark, f.import_batch_id))

    def insert_return(self, r: ReturnRecord):
        self.conn.execute('''
            INSERT INTO return_records(bl_no, container_no, return_date, amount, currency, remark, import_batch_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (r.bl_no, r.container_no, r.return_date, str(r.amount), r.currency, r.remark, r.import_batch_id))

    def insert_payment(self, p: Payment):
        self.conn.execute('''
            INSERT INTO payments(customer, bl_no, amount, currency, payment_date, remark, import_batch_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (p.customer, p.bl_no, str(p.amount), p.currency, p.payment_date, p.remark, p.import_batch_id))

    def insert_validation_error(self, batch_id: int, e: ValidationError):
        self.conn.execute('''
            INSERT INTO validation_errors(import_batch_id, row_no, source, field, message, raw_value)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (batch_id, e.row_no, e.source, e.field, e.message, e.raw_value))

    def get_all_containers(self) -> list[sqlite3.Row]:
        return list(self.conn.execute('SELECT * FROM containers ORDER BY container_no').fetchall())

    def get_container_by_no(self, container_no: str) -> Optional[sqlite3.Row]:
        cur = self.conn.execute('SELECT * FROM containers WHERE container_no = ?', (container_no,))
        return cur.fetchone()

    def get_cargos_by_container(self, container_no: str) -> list[sqlite3.Row]:
        return list(self.conn.execute('SELECT * FROM cargos WHERE container_no = ? ORDER BY bl_no', (container_no,)).fetchall())

    def get_fees_by_container(self, container_no: str) -> list[sqlite3.Row]:
        return list(self.conn.execute('SELECT * FROM fees WHERE container_no = ? ORDER BY fee_type', (container_no,)).fetchall())

    def get_returns_by_bl(self, bl_no: str) -> list[sqlite3.Row]:
        return list(self.conn.execute('SELECT * FROM return_records WHERE bl_no = ?', (bl_no,)).fetchall())

    def get_payments_by_customer(self, customer: str) -> list[sqlite3.Row]:
        return list(self.conn.execute('SELECT * FROM payments WHERE customer = ?', (customer,)).fetchall())

    def get_payments_by_bl(self, bl_no: str) -> list[sqlite3.Row]:
        return list(self.conn.execute('SELECT * FROM payments WHERE bl_no = ?', (bl_no,)).fetchall())

    def get_all_validation_errors(self) -> list[sqlite3.Row]:
        return list(self.conn.execute('SELECT * FROM validation_errors ORDER BY id').fetchall())

    def clear_split_results(self):
        self.conn.execute('DELETE FROM split_results')

    def insert_split_result(self, container_no: str, bl_no: str, fee_type: str,
                            original_amount: Decimal, split_amount: Decimal,
                            split_base: str, split_ratio: Decimal):
        self.conn.execute('''
            INSERT INTO split_results(
                container_no, bl_no, fee_type, original_amount,
                split_amount, split_base, split_ratio, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            container_no, bl_no, fee_type, str(original_amount), str(split_amount),
            split_base, str(split_ratio), datetime.now().isoformat()
        ))

    def get_split_results_by_container(self, container_no: str) -> list[sqlite3.Row]:
        return list(self.conn.execute('SELECT * FROM split_results WHERE container_no = ? ORDER BY bl_no, fee_type', (container_no,)).fetchall())

    def get_split_results_by_customer(self) -> list[sqlite3.Row]:
        return list(self.conn.execute('''
            SELECT c.customer, s.*, c.bl_no
            FROM split_results s
            JOIN cargos c ON s.bl_no = c.bl_no AND s.container_no = c.container_no
            ORDER BY c.customer, s.container_no, s.fee_type
        ''').fetchall())


def compute_batch_hash(rows_dict: dict) -> str:
    import hashlib
    sorted_str = json.dumps(rows_dict, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(sorted_str.encode('utf-8')).hexdigest()


class DataImporter:
    def __init__(self, db: Database):
        self.db = db

    def parse_decimal(self, value: str) -> Optional[Decimal]:
        if value is None or str(value).strip() == '':
            return None
        s = str(value).strip().replace(',', '')
        return Decimal(s)

    def parse_bool(self, value: str) -> bool:
        if value is None:
            return False
        s = str(value).strip().lower()
        return s in {'1', 'yes', 'y', 'true', 't', '是', '√'}

    def _validate_container(self, row: dict, row_no: int, errors: list[ValidationError]) -> bool:
        valid = True
        if not row.get('container_no', '').strip():
            errors.append(ValidationError(row_no, 'containers', 'container_no', '柜号不能为空', row.get('container_no', '')))
            valid = False
        if not row.get('container_type', '').strip():
            errors.append(ValidationError(row_no, 'containers', 'container_type', '柜型不能为空', row.get('container_type', '')))
            valid = False
        return valid

    def _validate_cargo(self, row: dict, row_no: int, errors: list[ValidationError]) -> bool:
        valid = True
        if not row.get('customer', '').strip():
            errors.append(ValidationError(row_no, 'cargos', 'customer', '客户不能为空', row.get('customer', '')))
            valid = False
        if not row.get('bl_no', '').strip():
            errors.append(ValidationError(row_no, 'cargos', 'bl_no', '提单号不能为空', row.get('bl_no', '')))
            valid = False
        if not row.get('container_no', '').strip():
            errors.append(ValidationError(row_no, 'cargos', 'container_no', '柜号不能为空', row.get('container_no', '')))
            valid = False
        try:
            vol = self.parse_decimal(row.get('volume', ''))
            if vol is None:
                errors.append(ValidationError(row_no, 'cargos', 'volume', '体积不能为空', row.get('volume', '')))
                valid = False
            elif vol < 0:
                errors.append(ValidationError(row_no, 'cargos', 'volume', '体积不能为负', str(vol)))
                valid = False
        except:
            errors.append(ValidationError(row_no, 'cargos', 'volume', '体积格式错误', row.get('volume', '')))
            valid = False
        try:
            w = self.parse_decimal(row.get('weight', ''))
            if w is None:
                errors.append(ValidationError(row_no, 'cargos', 'weight', '重量不能为空', row.get('weight', '')))
                valid = False
            elif w < 0:
                errors.append(ValidationError(row_no, 'cargos', 'weight', '重量不能为负', str(w)))
                valid = False
        except:
            errors.append(ValidationError(row_no, 'cargos', 'weight', '重量格式错误', row.get('weight', '')))
            valid = False
        v_unit = row.get('volume_unit', '').strip().upper()
        if v_unit and v_unit not in VOLUME_UNITS:
            errors.append(ValidationError(row_no, 'cargos', 'volume_unit', f'体积单位必须是 {VOLUME_UNITS}', row.get('volume_unit', '')))
            valid = False
        w_unit = row.get('weight_unit', '').strip().upper()
        if w_unit and w_unit not in WEIGHT_UNITS:
            errors.append(ValidationError(row_no, 'cargos', 'weight_unit', f'重量单位必须是 {WEIGHT_UNITS}', row.get('weight_unit', '')))
            valid = False
        return valid

    def _validate_fee(self, row: dict, row_no: int, errors: list[ValidationError]) -> bool:
        valid = True
        if not row.get('container_no', '').strip():
            errors.append(ValidationError(row_no, 'fees', 'container_no', '柜号不能为空', row.get('container_no', '')))
            valid = False
        fee_type = row.get('fee_type', '').strip()
        if not fee_type:
            errors.append(ValidationError(row_no, 'fees', 'fee_type', '费用类型不能为空', row.get('fee_type', '')))
            valid = False
        try:
            amt = self.parse_decimal(row.get('amount', ''))
            if amt is None:
                errors.append(ValidationError(row_no, 'fees', 'amount', '金额不能为空', row.get('amount', '')))
                valid = False
        except:
            errors.append(ValidationError(row_no, 'fees', 'amount', '金额格式错误', row.get('amount', '')))
            valid = False
        return valid

    def _validate_return(self, row: dict, row_no: int, errors: list[ValidationError]) -> bool:
        valid = True
        if not row.get('bl_no', '').strip():
            errors.append(ValidationError(row_no, 'return_records', 'bl_no', '提单号不能为空', row.get('bl_no', '')))
            valid = False
        try:
            amt = self.parse_decimal(row.get('amount', ''))
            if amt is None:
                errors.append(ValidationError(row_no, 'return_records', 'amount', '金额不能为空', row.get('amount', '')))
                valid = False
        except:
            errors.append(ValidationError(row_no, 'return_records', 'amount', '金额格式错误', row.get('amount', '')))
            valid = False
        return valid

    def _validate_payment(self, row: dict, row_no: int, errors: list[ValidationError]) -> bool:
        valid = True
        if not row.get('customer', '').strip():
            errors.append(ValidationError(row_no, 'payments', 'customer', '客户不能为空', row.get('customer', '')))
            valid = False
        try:
            amt = self.parse_decimal(row.get('amount', ''))
            if amt is None:
                errors.append(ValidationError(row_no, 'payments', 'amount', '金额不能为空', row.get('amount', '')))
                valid = False
        except:
            errors.append(ValidationError(row_no, 'payments', 'amount', '金额格式错误', row.get('amount', '')))
            valid = False
        return valid

    def read_csv(self, file_path: Path) -> list[dict]:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            return [{k.strip(): v.strip() if v is not None else v for k, v in row.items()} for row in reader]

    def import_file(self, file_path: Path, sheet_name: Optional[str] = None) -> dict:
        ext = file_path.suffix.lower()
        if ext in {'.json'}:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        elif ext in {'.csv', '.txt'}:
            rows = self.read_csv(file_path)
            data = self._infer_sheet_from_rows(rows)
        else:
            raise ValueError(f'不支持的文件格式: {ext}')
        return self.import_data(data, source_file=str(file_path))

    def _infer_sheet_from_rows(self, rows: list[dict]) -> dict:
        if not rows:
            return {}
        first = rows[0]
        keys = set(first.keys())
        if 'bl_no' in keys and 'customer' in keys and 'container_no' in keys:
            return {'cargos': rows}
        if 'fee_type' in keys:
            return {'fees': rows}
        if 'return_date' in keys or ('bl_no' in keys and 'amount' in keys and 'fee_type' not in keys):
            return {'return_records': rows}
        if 'payment_date' in keys:
            return {'payments': rows}
        if 'container_type' in keys:
            return {'containers': rows}
        return {'cargos': rows}

    def _detect_duplicate_bl_in_containers(
        self,
        new_cargos: list[Cargo],
        existing_cargos: list[sqlite3.Row],
        errors: list[ValidationError]
    ):
        bl_to_containers: dict[str, dict[str, list[tuple]]] = {}
        for idx, c in enumerate(new_cargos):
            bl = c.bl_no
            cn = c.container_no
            if bl not in bl_to_containers:
                bl_to_containers[bl] = {}
            if cn not in bl_to_containers[bl]:
                bl_to_containers[bl][cn] = []
            bl_to_containers[bl][cn].append(('new', idx + 2, c.customer))
        for ec in existing_cargos:
            bl = ec['bl_no']
            cn = ec['container_no']
            if bl not in bl_to_containers:
                bl_to_containers[bl] = {}
            if cn not in bl_to_containers[bl]:
                bl_to_containers[bl][cn] = []
            bl_to_containers[bl][cn].append(('existing', ec['id'], ec['customer']))
        for bl, containers in bl_to_containers.items():
            if len(containers) > 1:
                container_list = list(containers.keys())
                for cn, records in containers.items():
                    for rec_type, row_ref, customer in records:
                        if rec_type == 'new':
                            other_containers = [c for c in container_list if c != cn]
                            errors.append(ValidationError(
                                row_no=row_ref,
                                source='cargos',
                                field='bl_no',
                                message=f'同票货重复装柜：提单 {bl} 已在柜 {", ".join(other_containers)} 中存在',
                                raw_value=bl
                            ))

    def import_data(self, data: dict, source_file: str = 'manual') -> dict:
        all_rows = {}
        for key in ['containers', 'cargos', 'fees', 'return_records', 'payments']:
            if key in data:
                all_rows[key] = list(data[key])
        if not all_rows:
            raise ValueError('没有有效数据可导入')
        batch_hash = compute_batch_hash(all_rows)
        if self.db.batch_exists(batch_hash):
            return {'status': 'skipped', 'reason': 'duplicate_batch', 'batch_hash': batch_hash}
        errors: list[ValidationError] = []
        containers: list[Container] = []
        cargos: list[Cargo] = []
        fees: list[Fee] = []
        returns: list[ReturnRecord] = []
        payments: list[Payment] = []
        for row_no, row in enumerate(all_rows.get('containers', []), start=2):
            if self._validate_container(row, row_no, errors):
                containers.append(Container(
                    id=None,
                    container_no=row['container_no'].strip(),
                    container_type=row['container_type'].strip(),
                    voyage_no=row.get('voyage_no', '').strip() or None,
                    etd=row.get('etd', '').strip() or None,
                    import_batch_id=0
                ))
        for row_no, row in enumerate(all_rows.get('cargos', []), start=2):
            if self._validate_cargo(row, row_no, errors):
                cargos.append(Cargo(
                    id=None,
                    customer=row['customer'].strip(),
                    bl_no=row['bl_no'].strip(),
                    container_no=row['container_no'].strip(),
                    volume=self.parse_decimal(row['volume']) or Decimal('0'),
                    volume_unit=row.get('volume_unit', 'CBM').strip().upper() or 'CBM',
                    weight=self.parse_decimal(row['weight']) or Decimal('0'),
                    weight_unit=row.get('weight_unit', 'KG').strip().upper() or 'KG',
                    cargo_value=self.parse_decimal(row.get('cargo_value', '')),
                    is_repack=self.parse_bool(row.get('is_repack', '0')),
                    remark=row.get('remark', '').strip() or None,
                    import_batch_id=0
                ))
        for row_no, row in enumerate(all_rows.get('fees', []), start=2):
            if self._validate_fee(row, row_no, errors):
                fees.append(Fee(
                    id=None,
                    container_no=row['container_no'].strip(),
                    fee_type=row['fee_type'].strip(),
                    amount=self.parse_decimal(row['amount']) or Decimal('0'),
                    currency=row.get('currency', 'CNY').strip() or 'CNY',
                    remark=row.get('remark', '').strip() or None,
                    import_batch_id=0
                ))
        for row_no, row in enumerate(all_rows.get('return_records', []), start=2):
            if self._validate_return(row, row_no, errors):
                returns.append(ReturnRecord(
                    id=None,
                    bl_no=row['bl_no'].strip(),
                    container_no=row.get('container_no', '').strip() or None,
                    return_date=row.get('return_date', '').strip() or None,
                    amount=self.parse_decimal(row['amount']) or Decimal('0'),
                    currency=row.get('currency', 'CNY').strip() or 'CNY',
                    remark=row.get('remark', '').strip() or None,
                    import_batch_id=0
                ))
        for row_no, row in enumerate(all_rows.get('payments', []), start=2):
            if self._validate_payment(row, row_no, errors):
                payments.append(Payment(
                    id=None,
                    customer=row['customer'].strip(),
                    bl_no=row.get('bl_no', '').strip() or None,
                    amount=self.parse_decimal(row['amount']) or Decimal('0'),
                    currency=row.get('currency', 'CNY').strip() or 'CNY',
                    payment_date=row.get('payment_date', '').strip() or None,
                    remark=row.get('remark', '').strip() or None,
                    import_batch_id=0
                ))
        if cargos:
            existing_cargos = list(self.db.conn.execute('SELECT * FROM cargos').fetchall())
            self._detect_duplicate_bl_in_containers(cargos, existing_cargos, errors)
        self.db.begin()
        try:
            batch_id = self.db.create_batch(source_file, batch_hash, '')
            for c in containers:
                c.import_batch_id = batch_id
                self.db.insert_container(c)
            for c in cargos:
                c.import_batch_id = batch_id
                self.db.insert_cargo(c)
            for f in fees:
                f.import_batch_id = batch_id
                self.db.insert_fee(f)
            for r in returns:
                r.import_batch_id = batch_id
                self.db.insert_return(r)
            for p in payments:
                p.import_batch_id = batch_id
                self.db.insert_payment(p)
            for e in errors:
                self.db.insert_validation_error(batch_id, e)
            self.db.commit()
            return {
                'status': 'imported',
                'batch_id': batch_id,
                'batch_hash': batch_hash,
                'containers': len(containers),
                'cargos': len(cargos),
                'fees': len(fees),
                'return_records': len(returns),
                'payments': len(payments),
                'validation_errors': len(errors)
            }
        except:
            self.db.rollback()
            raise


class CostSplitter:
    def __init__(self, db: Database):
        self.db = db

    def split_container(self, container_no: str) -> dict:
        container = self.db.get_container_by_no(container_no)
        if not container:
            raise ValueError(f'未找到柜号: {container_no}')
        cargos = self.db.get_cargos_by_container(container_no)
        fees = self.db.get_fees_by_container(container_no)
        if not cargos:
            return {'container_no': container_no, 'results': [], 'warnings': ['该柜没有货物记录']}
        if not fees:
            return {'container_no': container_no, 'results': [], 'warnings': ['该柜没有费用记录']}
        normalized_cargos = []
        for c in cargos:
            volume = cbm_from(Decimal(c['volume']), c['volume_unit'])
            weight = kg_from(Decimal(c['weight']), c['weight_unit'])
            chargeable = max(volume * Decimal('167'), weight)
            normalized_cargos.append({
                'row': c,
                'volume_cbm': volume,
                'weight_kg': weight,
                'chargeable': chargeable,
                'bl_no': c['bl_no'],
                'customer': c['customer'],
                'is_repack': bool(c['is_repack'])
            })
        total_volume = sum(c['volume_cbm'] for c in normalized_cargos)
        total_weight = sum(c['weight_kg'] for c in normalized_cargos)
        total_chargeable = sum(c['chargeable'] for c in normalized_cargos)
        results = []
        warnings = []
        for fee in fees:
            fee_amount = money_round(Decimal(fee['amount']))
            fee_type = fee['fee_type']
            if fee_type in {'查验费', '消毒费', '其他'} and any(c['is_repack'] for c in normalized_cargos):
                repack_cargos = [c for c in normalized_cargos if c['is_repack']]
                non_repack_cargos = [c for c in normalized_cargos if not c['is_repack']]
                if repack_cargos:
                    split_results = self._split_by_base(
                        fee_amount, repack_cargos,
                        lambda c: c['chargeable'],
                        fee_type, 'chargeable', container_no
                    )
                    results.extend(split_results)
                if non_repack_cargos:
                    warnings.append(f'费用 {fee_type} 仅分摊给了重新装柜的货物')
                continue
            if total_volume > 0:
                split_base = 'volume'
                base_key = lambda c: c['volume_cbm']
                total_base = total_volume
            elif total_weight > 0:
                split_base = 'weight'
                base_key = lambda c: c['weight_kg']
                total_base = total_weight
            else:
                warnings.append(f'费用 {fee_type} 无法分摊：体积和重量均为0')
                continue
            results.extend(self._split_by_base(
                fee_amount, normalized_cargos, base_key, fee_type, split_base, container_no, total_base
            ))
        return {'container_no': container_no, 'results': results, 'warnings': warnings}

    def _split_by_base(self, total_amount: Decimal, cargos: list, base_key, fee_type: str,
                       split_base: str, container_no: str, total_base: Optional[Decimal] = None) -> list:
        if total_base is None:
            total_base = sum(base_key(c) for c in cargos)
        if total_base == 0:
            return []
        results = []
        assigned = Decimal('0')
        sorted_cargos = sorted(cargos, key=lambda c: c['bl_no'])
        for i, c in enumerate(sorted_cargos):
            ratio = base_key(c) / total_base
            if i == len(sorted_cargos) - 1:
                split_amount = total_amount - assigned
            else:
                split_amount = money_round(total_amount * ratio)
                assigned += split_amount
            results.append({
                'container_no': container_no,
                'bl_no': c['bl_no'],
                'customer': c['customer'],
                'fee_type': fee_type,
                'original_amount': total_amount,
                'split_amount': split_amount,
                'split_base': split_base,
                'split_ratio': ratio
            })
        return results

    def split_all(self) -> list:
        self.db.clear_split_results()
        all_results = []
        containers = self.db.get_all_containers()
        for container in containers:
            result = self.split_container(container['container_no'])
            all_results.append(result)
            for r in result['results']:
                self.db.insert_split_result(
                    r['container_no'], r['bl_no'], r['fee_type'],
                    r['original_amount'], r['split_amount'],
                    r['split_base'], r['split_ratio']
                )
        self.db.commit()
        return all_results


class ReportGenerator:
    def __init__(self, db: Database):
        self.db = db

    def container_summary(self, container_no: str) -> dict:
        cargos = self.db.get_cargos_by_container(container_no)
        fees = self.db.get_fees_by_container(container_no)
        splits = self.db.get_split_results_by_container(container_no)
        total_fees = sum(money_round(Decimal(f['amount'])) for f in fees)
        total_splits = sum(money_round(Decimal(s['split_amount'])) for s in splits)
        bl_fees_map = {}
        for s in splits:
            bl = s['bl_no']
            if bl not in bl_fees_map:
                bl_fees_map[bl] = Decimal('0')
            bl_fees_map[bl] += money_round(Decimal(s['split_amount']))
        customer_totals = {}
        for c in cargos:
            bl = c['bl_no']
            customer = c['customer']
            bl_fees = bl_fees_map.get(bl, Decimal('0'))
            returns = self.db.get_returns_by_bl(bl)
            return_total = sum(money_round(Decimal(r['amount'])) for r in returns)
            net_fee = bl_fees - return_total
            if customer not in customer_totals:
                customer_totals[customer] = {
                    'fees': Decimal('0'),
                    'net_fees': Decimal('0'),
                    'returns': Decimal('0'),
                    'bls': set()
                }
            customer_totals[customer]['fees'] += bl_fees
            customer_totals[customer]['net_fees'] += net_fee
            customer_totals[customer]['returns'] += return_total
            customer_totals[customer]['bls'].add(bl)
        cargo_details = []
        for c in cargos:
            volume = cbm_from(Decimal(c['volume']), c['volume_unit'])
            weight = kg_from(Decimal(c['weight']), c['weight_unit'])
            chargeable = max(volume * Decimal('167'), weight)
            bl_fees = bl_fees_map.get(c['bl_no'], Decimal('0'))
            returns = self.db.get_returns_by_bl(c['bl_no'])
            return_total = sum(money_round(Decimal(r['amount'])) for r in returns)
            payments = self.db.get_payments_by_bl(c['bl_no'])
            payment_total = sum(money_round(Decimal(p['amount'])) for p in payments)
            cargo_details.append({
                'bl_no': c['bl_no'],
                'customer': c['customer'],
                'volume_cbm': volume,
                'weight_kg': weight,
                'chargeable': chargeable,
                'is_repack': bool(c['is_repack']),
                'fees_assigned': bl_fees,
                'return_amount': return_total,
                'net_fee': bl_fees - return_total,
                'payment_received': payment_total,
                'balance': payment_total - (bl_fees - return_total)
            })
        return {
            'container_no': container_no,
            'total_fees': total_fees,
            'total_splits': total_splits,
            'difference': total_splits - total_fees,
            'cargo_count': len(cargos),
            'customer_count': len(customer_totals),
            'customer_totals': {
                k: {
                    'fees': v['fees'],
                    'net_fees': v['net_fees'],
                    'returns': v['returns'],
                    'bl_count': len(v['bls'])
                }
                for k, v in customer_totals.items()
            },
            'cargo_details': cargo_details
        }

    def customer_breakdown(self) -> dict:
        results = self.db.get_split_results_by_customer()
        customers = {}
        bl_info = {}
        for row in results:
            cust = row['customer']
            bl = row['bl_no']
            if cust not in customers:
                customers[cust] = {
                    'containers': set(),
                    'fees': Decimal('0'),
                    'returns': Decimal('0'),
                    'net_fees': Decimal('0'),
                    'details': []
                }
            if bl not in bl_info:
                returns = self.db.get_returns_by_bl(bl)
                return_total = sum(money_round(Decimal(r['amount'])) for r in returns)
                bl_info[bl] = {'return_total': return_total, 'processed_customers': set()}
            customers[cust]['containers'].add(row['container_no'])
            split_amount = money_round(Decimal(row['split_amount']))
            customers[cust]['fees'] += split_amount
            if cust not in bl_info[bl]['processed_customers']:
                customers[cust]['returns'] += bl_info[bl]['return_total']
                bl_info[bl]['processed_customers'].add(cust)
            customers[cust]['details'].append({
                'container_no': row['container_no'],
                'bl_no': bl,
                'fee_type': row['fee_type'],
                'original_amount': money_round(Decimal(row['original_amount'])),
                'split_amount': split_amount,
                'return_amount': bl_info[bl]['return_total'],
                'net_amount': split_amount,
                'split_ratio': Decimal(row['split_ratio'])
            })
        for cust in customers.keys():
            customers[cust]['net_fees'] = customers[cust]['fees'] - customers[cust]['returns']
            payments = self.db.get_payments_by_customer(cust)
            customers[cust]['payments'] = sum(money_round(Decimal(p['amount'])) for p in payments)
            customers[cust]['balance'] = customers[cust]['payments'] - customers[cust]['net_fees']
        return customers

    def validation_errors_report(self) -> list:
        errors = self.db.get_all_validation_errors()
        return [dict(e) for e in errors]


def print_table(headers: list, rows: list[list]):
    if not rows:
        print('(无数据)')
        return
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            w = len(str(cell))
            if w > col_widths[i]:
                col_widths[i] = w
    format_str = '  '.join(f'{{:<{w}}}' for w in col_widths)
    print(format_str.format(*headers))
    print('-' * (sum(col_widths) + len(headers) * 2 - 2))
    for row in rows:
        print(format_str.format(*[str(c) for c in row]))


def cmd_import(db: Database, args):
    importer = DataImporter(db)
    file_path = Path(args.file)
    if not file_path.exists():
        print(f'错误: 文件不存在: {file_path}', file=sys.stderr)
        sys.exit(1)
    result = importer.import_file(file_path)
    if result['status'] == 'skipped':
        print(f'跳过重复导入 (batch_hash: {result["batch_hash"][:16]}...)')
    else:
        print(f'导入完成:')
        print(f'  批次ID: {result["batch_id"]}')
        print(f'  柜信息: {result["containers"]} 条')
        print(f'  货物: {result["cargos"]} 条')
        print(f'  费用: {result["fees"]} 条')
        print(f'  退关: {result["return_records"]} 条')
        print(f'  收款: {result["payments"]} 条')
        if result['validation_errors'] > 0:
            print(f'  校验错误: {result["validation_errors"]} 条 (运行 review 命令查看)')


def cmd_split(db: Database, args):
    splitter = CostSplitter(db)
    if args.container:
        result = splitter.split_container(args.container)
        if result['warnings']:
            for w in result['warnings']:
                print(f'警告: {w}')
        print(f'\n柜号: {args.container}')
        print(f'拆分记录: {len(result["results"])} 条')
        headers = ['提单号', '客户', '费用类型', '原金额', '分摊金额', '分摊基准', '分摊比例']
        rows = []
        for r in result['results']:
            ratio = f"{float(r['split_ratio']) * 100:.2f}%"
            rows.append([
                r['bl_no'], r['customer'], r['fee_type'],
                f"{r['original_amount']:.2f}", f"{r['split_amount']:.2f}",
                r['split_base'], ratio
            ])
        print_table(headers, rows)
    else:
        results = splitter.split_all()
        print(f'已处理 {len(results)} 个柜')
        for r in results:
            print(f'  {r["container_no"]}: {len(r["results"])} 条拆分记录')
            for w in r.get('warnings', []):
                print(f'    警告: {w}')


def cmd_summary(db: Database, args):
    generator = ReportGenerator(db)
    if args.container:
        summary = generator.container_summary(args.container)
        print(f'\n=== 柜 {args.container} 盈亏汇总 ===')
        print(f'货物数量: {summary["cargo_count"]} 票')
        print(f'涉及客户: {summary["customer_count"]} 家')
        print(f'费用总额: {summary["total_fees"]:.2f}')
        print(f'分摊总额: {summary["total_splits"]:.2f}')
        print(f'尾差: {summary["difference"]:.2f}')
        print('\n按客户汇总:')
        headers = ['客户', '票数', '分摊费用', '退关冲抵', '净费用']
        rows = [[
            k, v['bl_count'],
            f"{v['fees']:.2f}", f"{v['returns']:.2f}", f"{v['net_fees']:.2f}"
        ] for k, v in summary['customer_totals'].items()]
        print_table(headers, rows)
        print('\n每票货物明细:')
        headers = ['提单号', '客户', '体积(CBM)', '重量(KG)', '计费重', '分摊费用', '退关冲抵', '净费用', '已收款', '余额']
        rows = []
        for d in summary['cargo_details']:
            rows.append([
                d['bl_no'], d['customer'],
                f"{d['volume_cbm']:.4f}", f"{d['weight_kg']:.2f}", f"{d['chargeable']:.2f}",
                f"{d['fees_assigned']:.2f}", f"{d['return_amount']:.2f}", f"{d['net_fee']:.2f}",
                f"{d['payment_received']:.2f}", f"{d['balance']:.2f}"
            ])
        print_table(headers, rows)
    else:
        containers = db.get_all_containers()
        print(f'\n=== 所有柜盈亏汇总 ===')
        headers = ['柜号', '货物数', '费用总额', '分摊总额', '尾差']
        rows = []
        grand_total_fees = Decimal('0')
        grand_total_splits = Decimal('0')
        for c in containers:
            s = generator.container_summary(c['container_no'])
            rows.append([
                c['container_no'], s['cargo_count'],
                f"{s['total_fees']:.2f}", f"{s['total_splits']:.2f}", f"{s['difference']:.2f}"
            ])
            grand_total_fees += s['total_fees']
            grand_total_splits += s['total_splits']
        print_table(headers, rows)
        print(f'\n总计费用: {grand_total_fees:.2f}')
        print(f'总计分摊: {grand_total_splits:.2f}')
        print(f'总尾差: {grand_total_splits - grand_total_fees:.2f}')


def cmd_customer(db: Database, args):
    generator = ReportGenerator(db)
    breakdown = generator.customer_breakdown()
    if not breakdown:
        print('暂无数据，请先运行 split 命令')
        return
    print(f'\n=== 按客户拆分明细 ===\n')
    for cust, data in breakdown.items():
        print(f'客户: {cust}')
        print(f'  涉及柜数: {len(data["containers"])}')
        print(f'  分摊总费用: {data["fees"]:.2f}')
        print(f'  退关冲抵: {data["returns"]:.2f}')
        print(f'  净费用: {data["net_fees"]:.2f}')
        print(f'  已收款: {data["payments"]:.2f}')
        print(f'  余额: {data["balance"]:.2f}')
        print(f'  明细:')
        headers = ['柜号', '提单号', '费用类型', '原金额', '分摊金额', '退关冲抵', '比例']
        rows = []
        for d in data['details']:
            ratio = f"{float(d['split_ratio']) * 100:.2f}%"
            rows.append([
                d['container_no'], d['bl_no'], d['fee_type'],
                f"{d['original_amount']:.2f}", f"{d['split_amount']:.2f}",
                f"{d['return_amount']:.2f}", ratio
            ])
        print_table(headers, rows)
        print()


def cmd_review(db: Database, args):
    generator = ReportGenerator(db)
    errors = generator.validation_errors_report()
    if not errors:
        print('暂无校验错误，数据质量良好')
        return
    print(f'\n=== 财务复核 - 坏数据列表 ===')
    print(f'共 {len(errors)} 条错误\n')
    headers = ['序号', '来源', '行号', '字段', '错误信息', '原始值']
    rows = []
    for e in errors:
        rows.append([
            e['id'], e['source'], e['row_no'], e['field'], e['message'], e.get('raw_value', '')
        ])
    print_table(headers, rows)


def cmd_export(db: Database, args):
    generator = ReportGenerator(db)
    breakdown = generator.customer_breakdown()
    errors = generator.validation_errors_report()
    containers = db.get_all_containers()
    container_summaries = {c['container_no']: generator.container_summary(c['container_no']) for c in containers}
    output = {
        'generated_at': datetime.now().isoformat(),
        'customers': {},
        'containers': {},
        'validation_errors': errors
    }
    for cust, data in breakdown.items():
        output['customers'][cust] = {
            'containers': list(data['containers']),
            'total_fees': float(data['fees']),
            'total_payments': float(data['payments']),
            'balance': float(data['balance']),
            'details': [{
                'container_no': d['container_no'],
                'bl_no': d['bl_no'],
                'fee_type': d['fee_type'],
                'original_amount': float(d['original_amount']),
                'split_amount': float(d['split_amount']),
                'split_ratio': float(d['split_ratio'])
            } for d in data['details']]
        }
    for cn, s in container_summaries.items():
        output['containers'][cn] = {
            'total_fees': float(s['total_fees']),
            'total_splits': float(s['total_splits']),
            'difference': float(s['difference']),
            'cargo_count': s['cargo_count'],
            'customer_count': s['customer_count'],
            'customer_totals': {k: {'fees': float(v['fees']), 'bl_count': v['bl_count']} for k, v in s['customer_totals'].items()},
            'cargo_details': [{
                'bl_no': d['bl_no'],
                'customer': d['customer'],
                'volume_cbm': float(d['volume_cbm']),
                'weight_kg': float(d['weight_kg']),
                'chargeable': float(d['chargeable']),
                'fees_assigned': float(d['fees_assigned']),
                'return_amount': float(d['return_amount']),
                'net_fee': float(d['net_fee']),
                'payment_received': float(d['payment_received']),
                'balance': float(d['balance'])
            } for d in s['cargo_details']]
        }
    out_path = Path(args.output)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f'已导出到: {out_path}')


def main():
    parser = argparse.ArgumentParser(description='货代散货拼柜费用分摊 CLI')
    parser.add_argument('--db', default='freight_cost.db', help='数据库文件路径 (默认: freight_cost.db)')
    subparsers = parser.add_subparsers(dest='command', required=True)
    import_parser = subparsers.add_parser('import', help='导入数据文件 (CSV/JSON)')
    import_parser.add_argument('file', help='数据文件路径')
    split_parser = subparsers.add_parser('split', help='执行费用分摊')
    split_parser.add_argument('--container', help='指定柜号 (可选，不指定则处理所有柜)')
    summary_parser = subparsers.add_parser('summary', help='查看整柜盈亏汇总')
    summary_parser.add_argument('--container', help='指定柜号 (可选，不指定则显示所有柜)')
    subparsers.add_parser('customer', help='按客户打印拆分明细')
    subparsers.add_parser('review', help='查看坏数据(财务复核)')
    export_parser = subparsers.add_parser('export', help='导出所有结果为 JSON')
    export_parser.add_argument('--output', '-o', default='freight_report.json', help='输出文件路径')
    args = parser.parse_args()
    db = Database(Path(args.db))
    try:
        if args.command == 'import':
            cmd_import(db, args)
        elif args.command == 'split':
            cmd_split(db, args)
        elif args.command == 'summary':
            cmd_summary(db, args)
        elif args.command == 'customer':
            cmd_customer(db, args)
        elif args.command == 'review':
            cmd_review(db, args)
        elif args.command == 'export':
            cmd_export(db, args)
    finally:
        db.close()


if __name__ == '__main__':
    main()
