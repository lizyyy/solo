#!/usr/bin/env python3
import argparse
import sqlite3
import hashlib
import json
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any


DB_PATH = "coffee_batches.db"


@dataclass
class GreenBean:
    green_bean_id: str
    origin: str
    variety: str
    weight_kg: float
    arrival_date: str
    supplier: str
    notes: Optional[str] = None


@dataclass
class RoastBatch:
    batch_id: str
    green_bean_id: str
    roast_date: str
    profile_summary: str
    raw_input_kg: float
    roast_duration_min: float
    first_crack_temp_c: Optional[float] = None
    first_crack_min: Optional[float] = None
    drop_temp_c: Optional[float] = None
    notes: Optional[str] = None


@dataclass
class Cupping:
    cupping_id: str
    batch_id: str
    cupping_date: str
    aroma: float
    flavor: float
    acidity: float
    body: float
    balance: float
    sweetness: float
    cleanliness: float
    overall: Optional[float] = None
    completed: bool = False
    notes: Optional[str] = None


@dataclass
class Reservation:
    reservation_id: str
    batch_id: str
    customer_id: str
    customer_name: str
    weight_kg: float
    reserved_date: str
    status: str = "active"
    notes: Optional[str] = None


@dataclass
class BatchEvent:
    event_id: str
    batch_id: str
    event_type: str
    event_date: str
    details: str
    actor: Optional[str] = None


class CoffeeBatchManager:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS green_beans (
            green_bean_id TEXT PRIMARY KEY,
            origin TEXT NOT NULL,
            variety TEXT NOT NULL,
            weight_kg REAL NOT NULL,
            arrival_date TEXT NOT NULL,
            supplier TEXT NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS roast_batches (
            batch_id TEXT PRIMARY KEY,
            green_bean_id TEXT NOT NULL,
            roast_date TEXT NOT NULL,
            profile_summary TEXT NOT NULL,
            raw_input_kg REAL NOT NULL,
            roast_duration_min REAL NOT NULL,
            first_crack_temp_c REAL,
            first_crack_min REAL,
            drop_temp_c REAL,
            notes TEXT,
            output_weight_kg REAL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (green_bean_id) REFERENCES green_beans(green_bean_id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS cuppings (
            cupping_id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            cupping_date TEXT NOT NULL,
            aroma REAL NOT NULL,
            flavor REAL NOT NULL,
            acidity REAL NOT NULL,
            body REAL NOT NULL,
            balance REAL NOT NULL,
            sweetness REAL NOT NULL,
            cleanliness REAL NOT NULL,
            overall REAL,
            completed BOOLEAN DEFAULT FALSE,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES roast_batches(batch_id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS reservations (
            reservation_id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            customer_id TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            weight_kg REAL NOT NULL,
            reserved_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES roast_batches(batch_id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS batch_events (
            event_id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            event_date TEXT NOT NULL,
            details TEXT NOT NULL,
            actor TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES roast_batches(batch_id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS idempotency_keys (
            key TEXT PRIMARY KEY,
            operation TEXT NOT NULL,
            payload_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_roast_batches_date ON roast_batches(roast_date)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_reservations_batch ON reservations(batch_id)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations(customer_id)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_batch_events_batch ON batch_events(batch_id)
        ''')

        conn.commit()
        conn.close()

    def _compute_payload_hash(self, payload: Dict[str, Any]) -> str:
        sorted_payload = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(sorted_payload.encode('utf-8')).hexdigest()

    def _check_idempotency(self, operation: str, payload: Dict[str, Any], cursor) -> Optional[str]:
        payload_hash = self._compute_payload_hash(payload)
        cursor.execute(
            "SELECT key FROM idempotency_keys WHERE operation = ? AND payload_hash = ?",
            (operation, payload_hash)
        )
        row = cursor.fetchone()
        return row['key'] if row else None

    def _store_idempotency(self, operation: str, key: str, payload: Dict[str, Any], cursor):
        payload_hash = self._compute_payload_hash(payload)
        cursor.execute(
            "INSERT OR IGNORE INTO idempotency_keys (key, operation, payload_hash) VALUES (?, ?, ?)",
            (key, operation, payload_hash)
        )

    def add_green_bean(self, green_bean: GreenBean) -> str:
        conn = self._get_connection()
        cursor = conn.cursor()

        existing_key = self._check_idempotency('add_green_bean', asdict(green_bean), cursor)
        if existing_key:
            conn.close()
            return existing_key

        try:
            cursor.execute('''
            INSERT OR IGNORE INTO green_beans 
            (green_bean_id, origin, variety, weight_kg, arrival_date, supplier, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                green_bean.green_bean_id,
                green_bean.origin,
                green_bean.variety,
                green_bean.weight_kg,
                green_bean.arrival_date,
                green_bean.supplier,
                green_bean.notes
            ))
            self._store_idempotency('add_green_bean', green_bean.green_bean_id, asdict(green_bean), cursor)
            conn.commit()
        except sqlite3.Error as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        return green_bean.green_bean_id

    def add_roast_batch(self, batch: RoastBatch) -> str:
        conn = self._get_connection()
        cursor = conn.cursor()

        existing_key = self._check_idempotency('add_roast_batch', asdict(batch), cursor)
        if existing_key:
            conn.close()
            return existing_key

        try:
            cursor.execute(
                "SELECT weight_kg FROM green_beans WHERE green_bean_id = ?",
                (batch.green_bean_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"生豆不存在: {batch.green_bean_id}")

            cursor.execute('''
            INSERT OR IGNORE INTO roast_batches
            (batch_id, green_bean_id, roast_date, profile_summary, raw_input_kg, 
             roast_duration_min, first_crack_temp_c, first_crack_min, drop_temp_c, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                batch.batch_id,
                batch.green_bean_id,
                batch.roast_date,
                batch.profile_summary,
                batch.raw_input_kg,
                batch.roast_duration_min,
                batch.first_crack_temp_c,
                batch.first_crack_min,
                batch.drop_temp_c,
                batch.notes
            ))

            self._add_event(cursor, batch.batch_id, 'ROAST_CREATED', batch.roast_date,
                          f"烘焙批次创建，投入生豆 {batch.raw_input_kg}kg")

            self._store_idempotency('add_roast_batch', batch.batch_id, asdict(batch), cursor)
            conn.commit()
        except sqlite3.Error as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        return batch.batch_id

    def record_output_weight(self, batch_id: str, output_weight_kg: float) -> float:
        conn = self._get_connection()
        cursor = conn.cursor()

        payload = {'batch_id': batch_id, 'output_weight_kg': output_weight_kg}
        existing_key = self._check_idempotency('record_output_weight', payload, cursor)
        if existing_key:
            cursor.execute("SELECT output_weight_kg FROM roast_batches WHERE batch_id = ?", (batch_id,))
            row = cursor.fetchone()
            conn.close()
            return row['output_weight_kg'] if row else 0.0

        try:
            cursor.execute(
                "SELECT raw_input_kg FROM roast_batches WHERE batch_id = ?",
                (batch_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"批次不存在: {batch_id}")

            raw_input = row['raw_input_kg']
            max_expected = raw_input * 0.90

            if output_weight_kg > max_expected:
                yield_ratio = (output_weight_kg / raw_input) * 100
                raise ValueError(
                    f"成品重量 {output_weight_kg}kg 超过生豆可得量上限 {max_expected:.2f}kg "
                    f"(产出率 {yield_ratio:.1f}%，正常范围约 75%-88%)"
                )

            cursor.execute(
                "UPDATE roast_batches SET output_weight_kg = ? WHERE batch_id = ?",
                (output_weight_kg, batch_id)
            )

            self._add_event(cursor, batch_id, 'OUTPUT_RECORDED', datetime.now().strftime('%Y-%m-%d'),
                          f"记录成品重量: {output_weight_kg}kg，产出率: {(output_weight_kg/raw_input*100):.1f}%")

            self._store_idempotency('record_output_weight', f"{batch_id}_output_{output_weight_kg}", payload, cursor)
            conn.commit()
        except sqlite3.Error as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        return output_weight_kg

    def add_cupping(self, cupping: Cupping) -> str:
        conn = self._get_connection()
        cursor = conn.cursor()

        existing_key = self._check_idempotency('add_cupping', asdict(cupping), cursor)
        if existing_key:
            conn.close()
            return existing_key

        try:
            cursor.execute(
                "SELECT batch_id FROM roast_batches WHERE batch_id = ?",
                (cupping.batch_id,)
            )
            if not cursor.fetchone():
                raise ValueError(f"批次不存在: {cupping.batch_id}")

            if cupping.overall is None:
                cupping.overall = (
                    cupping.aroma + cupping.flavor + cupping.acidity +
                    cupping.body + cupping.balance + cupping.sweetness +
                    cupping.cleanliness
                ) / 7.0

            cursor.execute('''
            INSERT OR IGNORE INTO cuppings
            (cupping_id, batch_id, cupping_date, aroma, flavor, acidity, body,
             balance, sweetness, cleanliness, overall, completed, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                cupping.cupping_id,
                cupping.batch_id,
                cupping.cupping_date,
                cupping.aroma,
                cupping.flavor,
                cupping.acidity,
                cupping.body,
                cupping.balance,
                cupping.sweetness,
                cupping.cleanliness,
                cupping.overall,
                cupping.completed,
                cupping.notes
            ))

            event_type = 'CUPPING_COMPLETED' if cupping.completed else 'CUPPING_STARTED'
            self._add_event(cursor, cupping.batch_id, event_type, cupping.cupping_date,
                          f"杯测分数: {cupping.overall:.1f}")

            self._store_idempotency('add_cupping', cupping.cupping_id, asdict(cupping), cursor)
            conn.commit()
        except sqlite3.Error as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        return cupping.cupping_id

    def add_reservation(self, reservation: Reservation) -> str:
        conn = self._get_connection()
        cursor = conn.cursor()

        existing_key = self._check_idempotency('add_reservation', asdict(reservation), cursor)
        if existing_key:
            conn.close()
            return existing_key

        try:
            cursor.execute('''
            SELECT rb.output_weight_kg, rb.batch_id
            FROM roast_batches rb
            WHERE rb.batch_id = ?
            ''', (reservation.batch_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"批次不存在: {reservation.batch_id}")

            if row['output_weight_kg'] is None:
                raise ValueError(f"批次 {reservation.batch_id} 尚未记录成品重量，无法预留")

            cursor.execute('''
            SELECT c.completed, c.overall
            FROM cuppings c
            WHERE c.batch_id = ? AND c.completed = 1
            ORDER BY c.cupping_date DESC
            LIMIT 1
            ''', (reservation.batch_id,))
            cupping_row = cursor.fetchone()
            if not cupping_row or not cupping_row['completed']:
                raise ValueError(
                    f"批次 {reservation.batch_id} 杯测未完成，禁止发货预留！"
                    "请先完成杯测评分。"
                )

            if cupping_row['overall'] < 7.5:
                print(f"⚠️  警告: 批次 {reservation.batch_id} 杯测分数较低 ({cupping_row['overall']:.1f})，建议确认是否发货")

            cursor.execute('''
            SELECT SUM(weight_kg) as reserved
            FROM reservations
            WHERE batch_id = ? AND status = 'active'
            ''', (reservation.batch_id,))
            reserved_row = cursor.fetchone()
            already_reserved = reserved_row['reserved'] or 0.0
            available = row['output_weight_kg'] - already_reserved

            if reservation.weight_kg > available:
                raise ValueError(
                    f"库存不足: 批次 {reservation.batch_id} 可售库存 {available:.2f}kg，"
                    f"请求预留 {reservation.weight_kg}kg"
                )

            cursor.execute('''
            SELECT reservation_id FROM reservations
            WHERE batch_id = ? AND customer_id = ? AND status = 'active'
            ''', (reservation.batch_id, reservation.customer_id))
            if cursor.fetchone():
                raise ValueError(
                    f"客户 {reservation.customer_name} ({reservation.customer_id}) "
                    f"已在批次 {reservation.batch_id} 有活跃预留，禁止重复预留"
                )

            cursor.execute('''
            INSERT OR IGNORE INTO reservations
            (reservation_id, batch_id, customer_id, customer_name, weight_kg, reserved_date, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                reservation.reservation_id,
                reservation.batch_id,
                reservation.customer_id,
                reservation.customer_name,
                reservation.weight_kg,
                reservation.reserved_date,
                reservation.status,
                reservation.notes
            ))

            self._add_event(cursor, reservation.batch_id, 'RESERVATION_CREATED', reservation.reserved_date,
                          f"客户 {reservation.customer_name} 预留 {reservation.weight_kg}kg")

            self._store_idempotency('add_reservation', reservation.reservation_id, asdict(reservation), cursor)
            conn.commit()
        except sqlite3.Error as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        return reservation.reservation_id

    def cancel_reservation(self, reservation_id: str) -> bool:
        conn = self._get_connection()
        cursor = conn.cursor()

        payload = {'reservation_id': reservation_id, 'action': 'cancel'}
        existing_key = self._check_idempotency('cancel_reservation', payload, cursor)
        if existing_key:
            conn.close()
            return True

        try:
            cursor.execute(
                "SELECT batch_id, weight_kg, status FROM reservations WHERE reservation_id = ?",
                (reservation_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"预留不存在: {reservation_id}")

            if row['status'] == 'cancelled':
                print(f"⚠️  预留 {reservation_id} 已处于取消状态")
                conn.close()
                return True

            cursor.execute(
                "UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?",
                (reservation_id,)
            )

            self._add_event(cursor, row['batch_id'], 'RESERVATION_CANCELLED',
                          datetime.now().strftime('%Y-%m-%d'),
                          f"取消预留，回滚库存 {row['weight_kg']}kg")

            self._store_idempotency('cancel_reservation', f"{reservation_id}_cancelled", payload, cursor)
            conn.commit()
        except sqlite3.Error as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        return True

    def revoke_batch(self, batch_id: str, reason: str = "") -> bool:
        conn = self._get_connection()
        cursor = conn.cursor()

        payload = {'batch_id': batch_id, 'action': 'revoke', 'reason': reason}
        existing_key = self._check_idempotency('revoke_batch', payload, cursor)
        if existing_key:
            conn.close()
            return True

        try:
            cursor.execute(
                "SELECT batch_id FROM roast_batches WHERE batch_id = ?",
                (batch_id,)
            )
            if not cursor.fetchone():
                raise ValueError(f"批次不存在: {batch_id}")

            cursor.execute('''
            SELECT reservation_id, customer_id, customer_name, weight_kg
            FROM reservations
            WHERE batch_id = ? AND status = 'active'
            ''', (batch_id,))
            reservations = cursor.fetchall()

            for res in reservations:
                cursor.execute(
                    "UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?",
                    (res['reservation_id'],)
                )
                self._add_event(cursor, batch_id, 'RESERVATION_CANCELLED',
                              datetime.now().strftime('%Y-%m-%d'),
                              f"批次撤销自动取消: 客户 {res['customer_name']} {res['weight_kg']}kg")

            self._add_event(cursor, batch_id, 'BATCH_REVOKED',
                          datetime.now().strftime('%Y-%m-%d'),
                          f"批次撤销: {reason}")

            self._store_idempotency('revoke_batch', f"{batch_id}_revoked", payload, cursor)
            conn.commit()
        except sqlite3.Error as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

        return True

    def _add_event(self, cursor, batch_id: str, event_type: str, event_date: str, details: str, actor: Optional[str] = None):
        event_payload = {'batch_id': batch_id, 'event_type': event_type, 'event_date': event_date, 'details': details}
        event_hash = hashlib.md5(json.dumps(event_payload, sort_keys=True).encode()).hexdigest()[:12]
        event_id = f"evt_{event_hash}"
        cursor.execute('''
        INSERT OR IGNORE INTO batch_events
        (event_id, batch_id, event_type, event_date, details, actor)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (event_id, batch_id, event_type, event_date, details, actor))

    def get_batch_history(self, batch_id: str) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
        SELECT e.event_type, e.event_date, e.details, e.actor
        FROM batch_events e
        WHERE e.batch_id = ?
        ORDER BY e.event_date, e.created_at
        ''', (batch_id,))

        events = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return events

    def get_inventory_report(self) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
        SELECT 
            rb.batch_id,
            gb.origin,
            gb.variety,
            rb.roast_date,
            rb.output_weight_kg,
            COALESCE(SUM(CASE WHEN r.status = 'active' THEN r.weight_kg ELSE 0 END), 0) as reserved_kg,
            MAX(CASE WHEN c.completed = 1 THEN c.overall ELSE NULL END) as cupping_score
        FROM roast_batches rb
        JOIN green_beans gb ON rb.green_bean_id = gb.green_bean_id
        LEFT JOIN reservations r ON rb.batch_id = r.batch_id
        LEFT JOIN cuppings c ON rb.batch_id = c.batch_id
        GROUP BY rb.batch_id
        ORDER BY rb.roast_date DESC
        ''')

        results = []
        for row in cursor.fetchall():
            available = (row['output_weight_kg'] or 0) - row['reserved_kg']
            results.append({
                'batch_id': row['batch_id'],
                'origin': row['origin'],
                'variety': row['variety'],
                'roast_date': row['roast_date'],
                'output_kg': row['output_weight_kg'],
                'reserved_kg': row['reserved_kg'],
                'available_kg': available,
                'cupping_score': row['cupping_score']
            })

        conn.close()
        return results

    def get_low_score_batches(self, threshold: float = 7.5) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
        SELECT 
            rb.batch_id,
            gb.origin,
            gb.variety,
            rb.roast_date,
            rb.profile_summary,
            MAX(c.overall) as cupping_score,
            rb.notes as batch_notes,
            c.notes as cupping_notes
        FROM roast_batches rb
        JOIN green_beans gb ON rb.green_bean_id = gb.green_bean_id
        JOIN cuppings c ON rb.batch_id = c.batch_id AND c.completed = 1
        GROUP BY rb.batch_id
        HAVING cupping_score < ?
        ORDER BY cupping_score ASC
        ''', (threshold,))

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

    def get_all_batches(self) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
        SELECT 
            rb.*,
            gb.origin,
            gb.variety,
            gb.supplier
        FROM roast_batches rb
        JOIN green_beans gb ON rb.green_bean_id = gb.green_bean_id
        ORDER BY rb.roast_date DESC
        ''')

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

    def get_reservations(self, batch_id: Optional[str] = None) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()

        if batch_id:
            cursor.execute('''
            SELECT r.*, gb.origin, gb.variety
            FROM reservations r
            JOIN roast_batches rb ON r.batch_id = rb.batch_id
            JOIN green_beans gb ON rb.green_bean_id = gb.green_bean_id
            WHERE r.batch_id = ?
            ORDER BY r.reserved_date
            ''', (batch_id,))
        else:
            cursor.execute('''
            SELECT r.*, gb.origin, gb.variety
            FROM reservations r
            JOIN roast_batches rb ON r.batch_id = rb.batch_id
            JOIN green_beans gb ON rb.green_bean_id = gb.green_bean_id
            ORDER BY r.reserved_date DESC
            ''')

        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results


def format_report(title: str, content: str) -> str:
    border = "=" * 60
    return f"\n{border}\n{title}\n{border}\n{content}\n{border}\n"


def print_batch_history(manager: CoffeeBatchManager, batch_id: str):
    events = manager.get_batch_history(batch_id)
    if not events:
        print(f"未找到批次 {batch_id} 的历史记录")
        return

    content = f"批次 ID: {batch_id}\n\n"
    for i, evt in enumerate(events, 1):
        content += f"{i}. [{evt['event_type']}] {evt['event_date']}\n"
        content += f"   {evt['details']}\n"
        if evt['actor']:
            content += f"   操作者: {evt['actor']}\n"
        content += "\n"

    print(format_report("批次履历", content))


def print_inventory_report(manager: CoffeeBatchManager):
    inventory = manager.get_inventory_report()
    if not inventory:
        print("暂无库存数据")
        return

    content = f"{'批次ID':<15} {'产地':<12} {'品种':<10} {'烘焙日期':<12} {'总量':<8} {'预留':<8} {'可售':<8} {'杯测分':<8}\n"
    content += "-" * 85 + "\n"

    total_output = 0.0
    total_reserved = 0.0
    total_available = 0.0

    for item in inventory:
        output = item['output_kg'] or 0
        score = f"{item['cupping_score']:.1f}" if item['cupping_score'] else "未完成"

        content += (f"{item['batch_id']:<15} {item['origin']:<12} {item['variety']:<10} "
                   f"{item['roast_date']:<12} {output:<8.2f} {item['reserved_kg']:<8.2f} "
                   f"{item['available_kg']:<8.2f} {score:<8}\n")

        total_output += output
        total_reserved += item['reserved_kg']
        total_available += item['available_kg']

    content += "-" * 85 + "\n"
    content += (f"{'合计':<15} {'':<12} {'':<10} {'':<12} {total_output:<8.2f} "
               f"{total_reserved:<8.2f} {total_available:<8.2f} {'':<8}\n")

    print(format_report("可售库存报告", content))


def print_low_score_report(manager: CoffeeBatchManager, threshold: float = 7.5):
    batches = manager.get_low_score_batches(threshold)
    if not batches:
        print(f"未发现杯测分低于 {threshold} 的批次")
        return

    content = f"低分阈值: {threshold}\n\n"
    content += f"{'批次ID':<15} {'产地':<12} {'品种':<10} {'烘焙日期':<12} {'分数':<8}\n"
    content += "-" * 65 + "\n"

    for batch in batches:
        content += (f"{batch['batch_id']:<15} {batch['origin']:<12} {batch['variety']:<10} "
                   f"{batch['roast_date']:<12} {batch['cupping_score']:<8.1f}\n")

    content += "\n" + "=" * 60 + "\n"
    content += "低分批次处理建议:\n"
    content += "-" * 60 + "\n"

    for batch in batches:
        score = batch['cupping_score']
        content += f"\n【{batch['batch_id']}】 {batch['origin']} {batch['variety']}\n"
        content += f"  杯测分数: {score:.1f}\n"

        if score < 7.0:
            content += "  🚫 建议: 不可售卖，考虑降级为培训豆或原料\n"
            content += "      请排查烘焙曲线是否有问题，或生豆质量问题\n"
        elif score < 7.5:
            content += "  ⚠️  建议: 谨慎售卖，仅限老客或特价促销\n"
            content += "      可考虑拼配使用，或缩短货架期\n"

        if batch['profile_summary']:
            content += f"  烘焙曲线摘要: {batch['profile_summary']}\n"
        if batch['cupping_notes']:
            content += f"  杯测备注: {batch['cupping_notes']}\n"

    print(format_report(f"低分批次报告 (阈值: {threshold})", content))


def load_sample_data(manager: CoffeeBatchManager):
    print("正在加载示例数据...\n")

    try:
        green_beans = [
            GreenBean(
                green_bean_id="GB_ETH_2024_001",
                origin="埃塞俄比亚 耶加雪菲",
                variety="原生种",
                weight_kg=60.0,
                arrival_date="2024-01-15",
                supplier="Coffee Link 咖啡贸易",
                notes="水洗处理，花香明显"
            ),
            GreenBean(
                green_bean_id="GB_COL_2024_002",
                origin="哥伦比亚 慧兰",
                variety="卡杜拉",
                weight_kg=120.0,
                arrival_date="2024-01-20",
                supplier="South America Coffee",
                notes="蜜处理，坚果巧克力"
            ),
            GreenBean(
                green_bean_id="GB_GUA_2024_003",
                origin="危地马拉 安提瓜",
                variety="波旁",
                weight_kg=80.0,
                arrival_date="2024-02-01",
                supplier="Central America Traders",
                notes="水洗，醇厚平衡"
            )
        ]

        for gb in green_beans:
            try:
                manager.add_green_bean(gb)
                print(f"✓ 生豆入库: {gb.origin}")
            except Exception as e:
                print(f"  (已存在) {gb.origin}: {e}")

        print()

        batches = [
            RoastBatch(
                batch_id="B20240215_ETH_01",
                green_bean_id="GB_ETH_2024_001",
                roast_date="2024-02-15",
                profile_summary="中浅烘焙，一爆发展30秒，185℃下豆",
                raw_input_kg=12.0,
                roast_duration_min=12.5,
                first_crack_temp_c=198.0,
                first_crack_min=9.0,
                drop_temp_c=205.0,
                notes="第一锅埃塞，验证新曲线"
            ),
            RoastBatch(
                batch_id="B20240216_COL_01",
                green_bean_id="GB_COL_2024_002",
                roast_date="2024-02-16",
                profile_summary="中烘焙，一爆发展1分钟，火力稍大",
                raw_input_kg=15.0,
                roast_duration_min=14.0,
                first_crack_temp_c=196.0,
                first_crack_min=9.5,
                drop_temp_c=210.0,
                notes="哥伦比亚日常批次"
            ),
            RoastBatch(
                batch_id="B20240217_GUA_01",
                green_bean_id="GB_GUA_2024_003",
                roast_date="2024-02-17",
                profile_summary="中深烘焙，发展过度，焦感明显",
                raw_input_kg=12.0,
                roast_duration_min=15.0,
                first_crack_temp_c=197.0,
                first_crack_min=10.0,
                drop_temp_c=218.0,
                notes="测试深烘曲线，结果不理想"
            )
        ]

        for batch in batches:
            try:
                manager.add_roast_batch(batch)
                print(f"✓ 烘焙批次创建: {batch.batch_id}")
            except Exception as e:
                print(f"  (已存在) {batch.batch_id}: {e}")

        print()

        outputs = [
            ("B20240215_ETH_01", 10.2),
            ("B20240216_COL_01", 12.8),
            ("B20240217_GUA_01", 10.0),
        ]

        for batch_id, weight in outputs:
            try:
                manager.record_output_weight(batch_id, weight)
                print(f"✓ 记录成品: {batch_id} {weight}kg (产出率 {(weight/12 if 'ETH' in batch_id or 'GUA' in batch_id else weight/15)*100:.1f}%)")
            except Exception as e:
                print(f"  (已处理) {batch_id}: {e}")

        print()

        cuppings = [
            Cupping(
                cupping_id="CUP_B20240215_ETH_01",
                batch_id="B20240215_ETH_01",
                cupping_date="2024-02-16",
                aroma=8.5,
                flavor=8.5,
                acidity=8.0,
                body=7.5,
                balance=8.0,
                sweetness=8.0,
                cleanliness=8.0,
                completed=True,
                notes="茉莉花香明显，柠檬酸明亮，回甘好"
            ),
            Cupping(
                cupping_id="CUP_B20240216_COL_01",
                batch_id="B20240216_COL_01",
                cupping_date="2024-02-17",
                aroma=7.5,
                flavor=7.5,
                acidity=7.0,
                body=8.0,
                balance=7.5,
                sweetness=7.5,
                cleanliness=7.5,
                completed=True,
                notes="坚果巧克力风味，醇厚，适合意式"
            ),
            Cupping(
                cupping_id="CUP_B20240217_GUA_01",
                batch_id="B20240217_GUA_01",
                cupping_date="2024-02-18",
                aroma=6.5,
                flavor=6.0,
                acidity=6.5,
                body=7.0,
                balance=6.0,
                sweetness=6.5,
                cleanliness=6.0,
                completed=True,
                notes="焦苦味重，尾韵不干净，发展过度"
            )
        ]

        for cup in cuppings:
            try:
                manager.add_cupping(cup)
                print(f"✓ 杯测记录: {cup.batch_id} 总分 {cup.overall:.1f}")
            except Exception as e:
                print(f"  (已存在) {cup.batch_id}: {e}")

        print()

        reservations = [
            Reservation(
                reservation_id="RES_001",
                batch_id="B20240215_ETH_01",
                customer_id="CUST_001",
                customer_name="张三咖啡馆",
                weight_kg=2.0,
                reserved_date="2024-02-18",
                notes="每周固定订单"
            ),
            Reservation(
                reservation_id="RES_002",
                batch_id="B20240216_COL_01",
                customer_id="CUST_002",
                customer_name="李四精品咖啡",
                weight_kg=5.0,
                reserved_date="2024-02-19",
                notes="意式拼配原料"
            )
        ]

        for res in reservations:
            try:
                manager.add_reservation(res)
                print(f"✓ 客户预留: {res.customer_name} {res.weight_kg}kg")
            except Exception as e:
                print(f"  (已存在) {res.customer_name}: {e}")

        print()
        print("示例数据加载完成！")
        print("\n提示: 重复执行此命令不会重复添加数据（幂等性保证）")

    except Exception as e:
        print(f"❌ 加载示例数据失败: {e}")
        raise


def main():
    parser = argparse.ArgumentParser(
        description="咖啡豆烘焙杯测批次管理 CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 加载示例数据
  coffee_batch_cli.py sample

  # 查看库存报告
  coffee_batch_cli.py inventory

  # 查看低分批次
  coffee_batch_cli.py low-score --threshold 7.5

  # 查看批次履历
  coffee_batch_cli.py history B20240215_ETH_01

  # 查看所有预留
  coffee_batch_cli.py reservations
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    sample_parser = subparsers.add_parser('sample', help='加载示例数据（3锅样例）')

    inventory_parser = subparsers.add_parser('inventory', help='查看可售库存报告')

    low_score_parser = subparsers.add_parser('low-score', help='查看低分批次及处理建议')
    low_score_parser.add_argument('--threshold', type=float, default=7.5, help='低分阈值 (默认 7.5)')

    history_parser = subparsers.add_parser('history', help='查看批次履历')
    history_parser.add_argument('batch_id', help='批次 ID')

    reservations_parser = subparsers.add_parser('reservations', help='查看预留记录')
    reservations_parser.add_argument('--batch', help='指定批次 ID')

    report_parser = subparsers.add_parser('report', help='生成完整报告（库存 + 低分批次）')

    args = parser.parse_args()

    manager = CoffeeBatchManager()

    if args.command == 'sample':
        load_sample_data(manager)
        print("\n" + "=" * 60)
        print("运行以下命令查看结果:")
        print("  python coffee_batch_cli.py inventory    # 查看库存")
        print("  python coffee_batch_cli.py low-score    # 查看低分批次")
        print("  python coffee_batch_cli.py history B20240215_ETH_01  # 查看批次履历")
        print("  python coffee_batch_cli.py report       # 完整报告")
        print("=" * 60)

    elif args.command == 'inventory':
        print_inventory_report(manager)

    elif args.command == 'low-score':
        print_low_score_report(manager, args.threshold)

    elif args.command == 'history':
        print_batch_history(manager, args.batch_id)

    elif args.command == 'reservations':
        reservations = manager.get_reservations(args.batch)
        if not reservations:
            print("暂无预留记录")
        else:
            content = f"{'预留ID':<12} {'批次ID':<18} {'客户':<15} {'重量':<8} {'状态':<10}\n"
            content += "-" * 70 + "\n"
            for r in reservations:
                content += (f"{r['reservation_id']:<12} {r['batch_id']:<18} {r['customer_name']:<15} "
                          f"{r['weight_kg']:<8.2f} {r['status']:<10}\n")
            print(format_report("预留记录", content))

    elif args.command == 'report':
        print_inventory_report(manager)
        print()
        print_low_score_report(manager)
        print()

    elif args.command is None:
        parser.print_help()


if __name__ == '__main__':
    main()
