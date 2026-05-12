"""数据模型和业务操作"""
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
import hashlib
import json

from .database import Database
from .config import (
    NEAR_EXPIRY_DAYS,
    CRITICAL_EXPIRY_DAYS,
    STORAGE_TYPE_NORMAL,
    STORAGE_TYPE_COLD,
    STORAGE_TYPE_FROZEN,
    STATUS_PENDING,
    STATUS_APPROVED,
    STATUS_COMPLETED,
    STATUS_REJECTED,
    STATUS_CANCELLED,
    STATUS_FAILED,
    ALLOWED_STATUS_TRANSITIONS,
)


def parse_date(date_str: str) -> date:
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def days_until_expiry(expiry_date_str: str, reference_date: date = None) -> int:
    if reference_date is None:
        reference_date = date.today()
    expiry_date = parse_date(expiry_date_str)
    return (expiry_date - reference_date).days


def generate_allocation_code(source_store_code: str, target_store_code: str, batch_no: str, quantity: int) -> str:
    key = f"{source_store_code}_{target_store_code}_{batch_no}_{quantity}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    return f"ALLOC_{hashlib.md5(key.encode()).hexdigest()[:12].upper()}"


def row_get(row, key, default=None):
    """安全地从 SQLite Row 对象获取值"""
    try:
        return row[key]
    except (KeyError, IndexError):
        return default


class Store:
    def __init__(self, id: int, store_code: str, store_name: str, region: str, address: str = None, phone: str = None):
        self.id = id
        self.store_code = store_code
        self.store_name = store_name
        self.region = region
        self.address = address
        self.phone = phone

    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            store_code=row['store_code'],
            store_name=row['store_name'],
            region=row['region'],
            address=row_get(row, 'address'),
            phone=row_get(row, 'phone'),
        )

    @classmethod
    def create(cls, db: Database, store_code: str, store_name: str, region: str, address: str = None, phone: str = None):
        now = datetime.now().isoformat()
        cursor = db.execute(
            """INSERT INTO stores (store_code, store_name, region, address, phone, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (store_code, store_name, region, address, phone, now, now),
        )
        return cls(
            id=cursor.lastrowid,
            store_code=store_code,
            store_name=store_name,
            region=region,
            address=address,
            phone=phone,
        )

    @classmethod
    def get_by_code(cls, db: Database, store_code: str):
        row = db.query_one(
            """SELECT * FROM stores WHERE store_code = ?""",
            (store_code,),
        )
        if row:
            return cls.from_row(row)
        return None

    @classmethod
    def get_all(cls, db: Database):
        rows = db.query("""SELECT * FROM stores ORDER BY store_code""")
        return [cls.from_row(row) for row in rows]


class Medicine:
    def __init__(self, id: int, medicine_code: str, medicine_name: str, storage_type: str = STORAGE_TYPE_NORMAL,
                 unit: str = "box", price: float = 0.0):
        self.id = id
        self.medicine_code = medicine_code
        self.medicine_name = medicine_name
        self.storage_type = storage_type
        self.unit = unit
        self.price = price

    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            medicine_code=row['medicine_code'],
            medicine_name=row['medicine_name'],
            storage_type=row['storage_type'],
            unit=row['unit'],
            price=row['price'],
        )

    @classmethod
    def create(cls, db: Database, medicine_code: str, medicine_name: str, storage_type: str = STORAGE_TYPE_NORMAL,
               unit: str = "box", price: float = 0.0):
        now = datetime.now().isoformat()
        cursor = db.execute(
            """INSERT INTO medicines (medicine_code, medicine_name, storage_type, unit, price, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (medicine_code, medicine_name, storage_type, unit, price, now, now),
        )
        return cls(
            id=cursor.lastrowid,
            medicine_code=medicine_code,
            medicine_name=medicine_name,
            storage_type=storage_type,
            unit=unit,
            price=price,
        )

    @classmethod
    def get_by_code(cls, db: Database, medicine_code: str):
        row = db.query_one(
            """SELECT * FROM medicines WHERE medicine_code = ?""",
            (medicine_code,),
        )
        if row:
            return cls.from_row(row)
        return None

    @classmethod
    def get_all(cls, db: Database):
        rows = db.query("""SELECT * FROM medicines ORDER BY medicine_code""")
        return [cls.from_row(row) for row in rows]


class Batch:
    def __init__(self, id: int, medicine_id: int, batch_no: str, expiry_date: str, supplier: str = None):
        self.id = id
        self.medicine_id = medicine_id
        self.batch_no = batch_no
        self.expiry_date = expiry_date
        self.supplier = supplier
        self._medicine = None

    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            medicine_id=row['medicine_id'],
            batch_no=row['batch_no'],
            expiry_date=row['expiry_date'],
            supplier=row_get(row, 'supplier'),
        )

    @classmethod
    def create(cls, db: Database, medicine_id: int, batch_no: str, expiry_date: str, supplier: str = None):
        now = datetime.now().isoformat()
        cursor = db.execute(
            """INSERT INTO batches (medicine_id, batch_no, expiry_date, supplier, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (medicine_id, batch_no, expiry_date, supplier, now, now),
        )
        return cls(
            id=cursor.lastrowid,
            medicine_id=medicine_id,
            batch_no=batch_no,
            expiry_date=expiry_date,
            supplier=supplier,
        )

    @classmethod
    def get_by_medicine_and_batch(cls, db: Database, medicine_id: int, batch_no: str):
        row = db.query_one(
            """SELECT * FROM batches WHERE medicine_id = ? AND batch_no = ?""",
            (medicine_id, batch_no),
        )
        if row:
            return cls.from_row(row)
        return None

    def get_days_until_expiry(self, reference_date: date = None) -> int:
        return days_until_expiry(self.expiry_date, reference_date)

    def is_expired(self, reference_date: date = None) -> bool:
        return self.get_days_until_expiry(reference_date) <= 0

    def is_near_expiry(self, reference_date: date = None) -> bool:
        days = self.get_days_until_expiry(reference_date)
        return 0 < days <= NEAR_EXPIRY_DAYS

    def is_critical_expiry(self, reference_date: date = None) -> bool:
        days = self.get_days_until_expiry(reference_date)
        return 0 < days <= CRITICAL_EXPIRY_DAYS

    def get_medicine(self, db: Database):
        if self._medicine is None:
            row = db.query_one("""SELECT * FROM medicines WHERE id = ?""", (self.medicine_id,))
            if row:
                self._medicine = Medicine.from_row(row)
        return self._medicine


class Inventory:
    def __init__(self, id: int, store_id: int, batch_id: int, quantity: int, daily_sales_rate: float):
        self.id = id
        self.store_id = store_id
        self.batch_id = batch_id
        self.quantity = quantity
        self.daily_sales_rate = daily_sales_rate
        self._store = None
        self._batch = None

    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            store_id=row['store_id'],
            batch_id=row['batch_id'],
            quantity=row['quantity'],
            daily_sales_rate=row['daily_sales_rate'],
        )

    @classmethod
    def create(cls, db: Database, store_id: int, batch_id: int, quantity: int, daily_sales_rate: float = 0.0):
        now = datetime.now().isoformat()
        cursor = db.execute(
            """INSERT INTO inventory (store_id, batch_id, quantity, daily_sales_rate, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (store_id, batch_id, quantity, daily_sales_rate, now, now),
        )
        return cls(
            id=cursor.lastrowid,
            store_id=store_id,
            batch_id=batch_id,
            quantity=quantity,
            daily_sales_rate=daily_sales_rate,
        )

    @classmethod
    def update_upsert(cls, db: Database, store_id: int, batch_id: int, quantity: int, daily_sales_rate: float = None):
        existing = db.query_one(
            """SELECT * FROM inventory WHERE store_id = ? AND batch_id = ?""",
            (store_id, batch_id),
        )
        now = datetime.now().isoformat()
        if existing:
            if daily_sales_rate is None:
                daily_sales_rate = existing['daily_sales_rate']
            db.execute(
                """UPDATE inventory SET quantity = ?, daily_sales_rate = ?, updated_at = ?
                   WHERE id = ?""",
                (quantity, daily_sales_rate, now, existing['id']),
            )
            return cls.from_row(existing)
        else:
            if daily_sales_rate is None:
                daily_sales_rate = 0.0
            return cls.create(db, store_id, batch_id, quantity, daily_sales_rate)

    @classmethod
    def get_by_store(cls, db: Database, store_id: int):
        rows = db.query(
            """SELECT * FROM inventory WHERE store_id = ?""",
            (store_id,),
        )
        return [cls.from_row(row) for row in rows]

    @classmethod
    def get_by_batch(cls, db: Database, batch_id: int):
        rows = db.query(
            """SELECT * FROM inventory WHERE batch_id = ?""",
            (batch_id,),
        )
        return [cls.from_row(row) for row in rows]

    def get_store(self, db: Database):
        if self._store is None:
            row = db.query_one("""SELECT * FROM stores WHERE id = ?""", (self.store_id,))
            if row:
                self._store = Store.from_row(row)
        return self._store

    def get_batch(self, db: Database):
        if self._batch is None:
            row = db.query_one("""SELECT * FROM batches WHERE id = ?""", (self.batch_id,))
            if row:
                self._batch = Batch.from_row(row)
        return self._batch

    def get_days_of_stock(self) -> float:
        if self.daily_sales_rate <= 0:
            return float('inf')
        return self.quantity / self.daily_sales_rate

    def get_estimated_stock_out_date(self, reference_date: date = None) -> Optional[date]:
        if reference_date is None:
            reference_date = date.today()
        days_stock = self.get_days_of_stock()
        if days_stock == float('inf'):
            return None
        return reference_date + timedelta(days=int(days_stock))


class Allocation:
    def __init__(self, id: int, allocation_code: str, source_store_id: int, target_store_id: int,
                 batch_id: int, quantity: int, status: str, risk_reduction: float,
                 source_before_qty: int = None, source_after_qty: int = None,
                 target_before_qty: int = None, target_after_qty: int = None,
                 created_at: str = None, updated_at: str = None):
        self.id = id
        self.allocation_code = allocation_code
        self.source_store_id = source_store_id
        self.target_store_id = target_store_id
        self.batch_id = batch_id
        self.quantity = quantity
        self.status = status
        self.risk_reduction = risk_reduction
        self.source_before_qty = source_before_qty
        self.source_after_qty = source_after_qty
        self.target_before_qty = target_before_qty
        self.target_after_qty = target_after_qty
        self.created_at = created_at
        self.updated_at = updated_at
        self._source_store = None
        self._target_store = None
        self._batch = None

    @classmethod
    def from_row(cls, row):
        return cls(
            id=row['id'],
            allocation_code=row['allocation_code'],
            source_store_id=row['source_store_id'],
            target_store_id=row['target_store_id'],
            batch_id=row['batch_id'],
            quantity=row['quantity'],
            status=row['status'],
            risk_reduction=row['risk_reduction'],
            source_before_qty=row_get(row, 'source_before_qty'),
            source_after_qty=row_get(row, 'source_after_qty'),
            target_before_qty=row_get(row, 'target_before_qty'),
            target_after_qty=row_get(row, 'target_after_qty'),
            created_at=row_get(row, 'created_at'),
            updated_at=row_get(row, 'updated_at'),
        )

    @classmethod
    def create(cls, db: Database, allocation_code: str, source_store_id: int, target_store_id: int,
               batch_id: int, quantity: int, risk_reduction: float = 0.0):
        now = datetime.now().isoformat()
        cursor = db.execute(
            """INSERT INTO allocations 
               (allocation_code, source_store_id, target_store_id, batch_id, quantity, status, 
                risk_reduction, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (allocation_code, source_store_id, target_store_id, batch_id, quantity, STATUS_PENDING, 
             risk_reduction, now, now),
        )
        return cls(
            id=cursor.lastrowid,
            allocation_code=allocation_code,
            source_store_id=source_store_id,
            target_store_id=target_store_id,
            batch_id=batch_id,
            quantity=quantity,
            status=STATUS_PENDING,
            risk_reduction=risk_reduction,
            created_at=now,
            updated_at=now,
        )

    @classmethod
    def get_by_code(cls, db: Database, allocation_code: str):
        row = db.query_one(
            """SELECT * FROM allocations WHERE allocation_code = ?""",
            (allocation_code,),
        )
        if row:
            return cls.from_row(row)
        return None

    @classmethod
    def get_all(cls, db: Database, status: str = None):
        if status:
            rows = db.query(
                """SELECT * FROM allocations WHERE status = ? ORDER BY created_at DESC""",
                (status,),
            )
        else:
            rows = db.query("""SELECT * FROM allocations ORDER BY created_at DESC""")
        return [cls.from_row(row) for row in rows]

    @classmethod
    def get_pending_duplicate(cls, db: Database, source_store_id: int, target_store_id: int,
                               batch_id: int):
        row = db.query_one(
            """SELECT * FROM allocations 
               WHERE source_store_id = ? AND target_store_id = ? AND batch_id = ? 
               AND status IN (?, ?)
               ORDER BY created_at DESC LIMIT 1""",
            (source_store_id, target_store_id, batch_id, STATUS_PENDING, STATUS_APPROVED),
        )
        if row:
            return cls.from_row(row)
        return None

    def get_source_store(self, db: Database):
        if self._source_store is None:
            row = db.query_one("""SELECT * FROM stores WHERE id = ?""", (self.source_store_id,))
            if row:
                self._source_store = Store.from_row(row)
        return self._source_store

    def get_target_store(self, db: Database):
        if self._target_store is None:
            row = db.query_one("""SELECT * FROM stores WHERE id = ?""", (self.target_store_id,))
            if row:
                self._target_store = Store.from_row(row)
        return self._target_store

    def get_batch(self, db: Database):
        if self._batch is None:
            row = db.query_one("""SELECT * FROM batches WHERE id = ?""", (self.batch_id,))
            if row:
                self._batch = Batch.from_row(row)
        return self._batch

    def get_history(self, db: Database):
        rows = db.query(
            """SELECT * FROM allocation_history WHERE allocation_id = ? ORDER BY created_at ASC""",
            (self.id,),
        )
        return [dict(row) for row in rows]

    def add_history(self, db: Database, action: str, operator: str, remarks: str = None,
                    before_status: str = None, after_status: str = None,
                    before_quantity: int = None, after_quantity: int = None):
        now = datetime.now().isoformat()
        db.execute(
            """INSERT INTO allocation_history 
               (allocation_id, action, operator, before_status, after_status, 
                before_quantity, after_quantity, remarks, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (self.id, action, operator, before_status, after_status,
             before_quantity, after_quantity, remarks, now),
        )

    def transition_status(self, db: Database, new_status: str, operator: str, remarks: str = None):
        if self.status not in ALLOWED_STATUS_TRANSITIONS:
            return False, f"当前状态 {self.status} 不允许状态变更"

        allowed = ALLOWED_STATUS_TRANSITIONS[self.status]
        if new_status not in allowed:
            return False, f"不允许从 {self.status} 变更到 {new_status}"

        old_status = self.status
        self.status = new_status
        now = datetime.now().isoformat()
        db.execute(
            """UPDATE allocations SET status = ?, updated_at = ? WHERE id = ?""",
            (new_status, now, self.id),
        )

        action_map = {
            STATUS_APPROVED: "审批通过",
            STATUS_REJECTED: "审批拒绝",
            STATUS_COMPLETED: "完成调拨",
            STATUS_CANCELLED: "取消调拨",
            STATUS_FAILED: "调拨失败",
        }

        self.add_history(
            db=db,
            action=action_map.get(new_status, new_status),
            operator=operator,
            remarks=remarks,
            before_status=old_status,
            after_status=new_status,
        )

        return True, "状态变更成功"

    def update_quantity(self, db: Database, new_quantity: int, operator: str, remarks: str = None):
        old_quantity = self.quantity
        self.quantity = new_quantity
        now = datetime.now().isoformat()
        db.execute(
            """UPDATE allocations SET quantity = ?, updated_at = ? WHERE id = ?""",
            (new_quantity, now, self.id),
        )

        self.add_history(
            db=db,
            action="人工修正",
            operator=operator,
            remarks=remarks,
            before_quantity=old_quantity,
            after_quantity=new_quantity,
        )

        return True, "数量修正成功"

    def execute_allocation(self, db: Database, operator: str):
        source_inv = db.query_one(
            """SELECT * FROM inventory WHERE store_id = ? AND batch_id = ?""",
            (self.source_store_id, self.batch_id),
        )
        if not source_inv or source_inv['quantity'] < self.quantity:
            return False, "源门店库存不足"

        target_inv = db.query_one(
            """SELECT * FROM inventory WHERE store_id = ? AND batch_id = ?""",
            (self.target_store_id, self.batch_id),
        )

        source_before = source_inv['quantity']
        source_after = source_before - self.quantity

        if target_inv:
            target_before = target_inv['quantity']
            target_after = target_before + self.quantity
        else:
            target_before = 0
            target_after = self.quantity

        now = datetime.now().isoformat()

        db.execute(
            """UPDATE inventory SET quantity = ?, updated_at = ? WHERE id = ?""",
            (source_after, now, source_inv['id']),
        )

        if target_inv:
            db.execute(
                """UPDATE inventory SET quantity = ?, updated_at = ? WHERE id = ?""",
                (target_after, now, target_inv['id']),
            )
        else:
            db.execute(
                """INSERT INTO inventory (store_id, batch_id, quantity, daily_sales_rate, created_at, updated_at)
                   VALUES (?, ?, ?, 0, ?, ?)""",
                (self.target_store_id, self.batch_id, target_after, now, now),
            )

        db.execute(
            """UPDATE allocations 
               SET source_before_qty = ?, source_after_qty = ?,
                   target_before_qty = ?, target_after_qty = ?,
                   status = ?, updated_at = ?
               WHERE id = ?""",
            (source_before, source_after, target_before, target_after,
             STATUS_COMPLETED, now, self.id),
        )

        self.source_before_qty = source_before
        self.source_after_qty = source_after
        self.target_before_qty = target_before
        self.target_after_qty = target_after
        self.status = STATUS_COMPLETED

        self.add_history(
            db=db,
            action="执行调拨",
            operator=operator,
            before_status=STATUS_APPROVED,
            after_status=STATUS_COMPLETED,
        )

        return True, "调拨执行成功"
