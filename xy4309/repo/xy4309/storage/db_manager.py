#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库管理器 - 处理所有数据库操作
"""

import sqlite3
import json
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from contextlib import contextmanager

from models import (
    Reagent, Cabinet, ResponsiblePerson, UsageRecord,
    InventoryCheck, InspectionRecord, Alert,
    ChemicalCategory, AlertType
)


class DatabaseManager:
    """数据库管理器类"""
    
    def __init__(self, db_path: Optional[str] = None):
        """
        初始化数据库管理器
        
        Args:
            db_path: 数据库文件路径，默认为 data 目录下的 chemicals.db
        """
        if db_path is None:
            # 默认数据库路径
            data_dir = Path(__file__).parent.parent / "data"
            data_dir.mkdir(exist_ok=True)
            db_path = str(data_dir / "chemicals.db")
        
        self.db_path = db_path
        self._create_tables()
    
    @contextmanager
    def get_connection(self):
        """获取数据库连接的上下文管理器"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _create_tables(self):
        """创建数据库表"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 责任人表
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS responsible_persons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                employee_id TEXT UNIQUE NOT NULL,
                department TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            ''')
            
            # 柜位表
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS cabinets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                description TEXT,
                responsible_person_id INTEGER,
                capacity INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (responsible_person_id) REFERENCES responsible_persons(id)
            )
            ''')
            
            # 试剂表
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS reagents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bottle_number TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                purity TEXT,
                specification TEXT,
                manufacturer TEXT,
                production_date TEXT NOT NULL,
                expiration_date TEXT NOT NULL,
                cabinet_id INTEGER,
                quantity REAL NOT NULL DEFAULT 0,
                unit TEXT NOT NULL,
                min_quantity REAL NOT NULL DEFAULT 0,
                responsible_person_id INTEGER,
                purchase_date TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (cabinet_id) REFERENCES cabinets(id),
                FOREIGN KEY (responsible_person_id) REFERENCES responsible_persons(id)
            )
            ''')
            
            # 领用/归还记录表
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS usage_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reagent_id INTEGER NOT NULL,
                bottle_number TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                operator_id INTEGER NOT NULL,
                expected_return_date TEXT,
                actual_return_date TEXT,
                purpose TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (reagent_id) REFERENCES reagents(id),
                FOREIGN KEY (operator_id) REFERENCES responsible_persons(id)
            )
            ''')
            
            # 盘点记录表
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS inventory_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reagent_id INTEGER NOT NULL,
                bottle_number TEXT NOT NULL,
                check_date TEXT NOT NULL,
                checker_id INTEGER NOT NULL,
                expected_quantity REAL NOT NULL,
                actual_quantity REAL NOT NULL,
                difference REAL NOT NULL,
                difference_reason TEXT,
                status TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (reagent_id) REFERENCES reagents(id),
                FOREIGN KEY (checker_id) REFERENCES responsible_persons(id)
            )
            ''')
            
            # 巡检记录表
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS inspection_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inspection_date TEXT NOT NULL,
                inspector_id INTEGER NOT NULL,
                total_reagents INTEGER NOT NULL,
                expired_count INTEGER NOT NULL,
                low_stock_count INTEGER NOT NULL,
                incompatible_count INTEGER NOT NULL,
                overdue_return_count INTEGER NOT NULL,
                status TEXT NOT NULL,
                report_path TEXT,
                csv_path TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (inspector_id) REFERENCES responsible_persons(id)
            )
            ''')
            
            # 预警表
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_type TEXT NOT NULL,
                reagent_id INTEGER NOT NULL,
                bottle_number TEXT NOT NULL,
                reagent_name TEXT NOT NULL,
                message TEXT NOT NULL,
                is_resolved INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                resolved_at TEXT,
                FOREIGN KEY (reagent_id) REFERENCES reagents(id)
            )
            ''')
            
            conn.commit()
    
    def initialize_database(self):
        """初始化数据库（确保表存在）"""
        # 表已经在 __init__ 中创建
        pass
    
    # ========== 日期转换辅助方法 ==========
    @staticmethod
    def _date_to_str(d: Optional[date]) -> Optional[str]:
        """将 date 转换为字符串"""
        return d.isoformat() if d else None
    
    @staticmethod
    def _str_to_date(s: Optional[str]) -> Optional[date]:
        """将字符串转换为 date"""
        if not s:
            return None
        try:
            return date.fromisoformat(s)
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def _datetime_to_str(dt: datetime) -> str:
        """将 datetime 转换为字符串"""
        return dt.isoformat()
    
    @staticmethod
    def _str_to_datetime(s: str) -> datetime:
        """将字符串转换为 datetime"""
        return datetime.fromisoformat(s)
    
    # ========== 责任人操作 ==========
    def add_responsible_person(self, person: ResponsiblePerson) -> int:
        """添加责任人"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            INSERT INTO responsible_persons 
            (name, employee_id, department, phone, email, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                person.name, person.employee_id, person.department,
                person.phone, person.email,
                self._datetime_to_str(now), self._datetime_to_str(now)
            ))
            conn.commit()
            return cursor.lastrowid
    
    def update_responsible_person(self, person: ResponsiblePerson):
        """更新责任人"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            UPDATE responsible_persons SET
                name=?, employee_id=?, department=?, phone=?, email=?, updated_at=?
            WHERE id=?
            ''', (
                person.name, person.employee_id, person.department,
                person.phone, person.email, self._datetime_to_str(now),
                person.id
            ))
            conn.commit()
    
    def delete_responsible_person(self, person_id: int):
        """删除责任人"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM responsible_persons WHERE id=?', (person_id,))
            conn.commit()
    
    def get_responsible_person_by_id(self, person_id: int) -> Optional[ResponsiblePerson]:
        """根据 ID 获取责任人"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM responsible_persons WHERE id=?', (person_id,))
            row = cursor.fetchone()
            return self._row_to_responsible_person(row) if row else None
    
    def get_responsible_person_by_employee_id(self, employee_id: str) -> Optional[ResponsiblePerson]:
        """根据工号获取责任人"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM responsible_persons WHERE employee_id=?', (employee_id,))
            row = cursor.fetchone()
            return self._row_to_responsible_person(row) if row else None
    
    def get_all_responsible_persons(self) -> List[ResponsiblePerson]:
        """获取所有责任人"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM responsible_persons ORDER BY name')
            rows = cursor.fetchall()
            return [self._row_to_responsible_person(row) for row in rows]
    
    def _row_to_responsible_person(self, row: sqlite3.Row) -> ResponsiblePerson:
        """将数据库行转换为 ResponsiblePerson 对象"""
        return ResponsiblePerson(
            id=row['id'],
            name=row['name'],
            employee_id=row['employee_id'],
            department=row['department'],
            phone=row['phone'],
            email=row['email'],
            created_at=self._str_to_datetime(row['created_at']),
            updated_at=self._str_to_datetime(row['updated_at'])
        )
    
    # ========== 柜位操作 ==========
    def add_cabinet(self, cabinet: Cabinet) -> int:
        """添加柜位"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            INSERT INTO cabinets 
            (name, location, description, responsible_person_id, capacity, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                cabinet.name, cabinet.location, cabinet.description,
                cabinet.responsible_person_id, cabinet.capacity,
                self._datetime_to_str(now), self._datetime_to_str(now)
            ))
            conn.commit()
            return cursor.lastrowid
    
    def update_cabinet(self, cabinet: Cabinet):
        """更新柜位"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            UPDATE cabinets SET
                name=?, location=?, description=?, responsible_person_id=?, 
                capacity=?, updated_at=?
            WHERE id=?
            ''', (
                cabinet.name, cabinet.location, cabinet.description,
                cabinet.responsible_person_id, cabinet.capacity,
                self._datetime_to_str(now), cabinet.id
            ))
            conn.commit()
    
    def delete_cabinet(self, cabinet_id: int):
        """删除柜位"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM cabinets WHERE id=?', (cabinet_id,))
            conn.commit()
    
    def get_cabinet_by_id(self, cabinet_id: int) -> Optional[Cabinet]:
        """根据 ID 获取柜位"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM cabinets WHERE id=?', (cabinet_id,))
            row = cursor.fetchone()
            return self._row_to_cabinet(row) if row else None
    
    def get_cabinet_by_name(self, name: str) -> Optional[Cabinet]:
        """根据名称获取柜位"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM cabinets WHERE name=?', (name,))
            row = cursor.fetchone()
            return self._row_to_cabinet(row) if row else None
    
    def get_all_cabinets(self) -> List[Cabinet]:
        """获取所有柜位"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM cabinets ORDER BY name')
            rows = cursor.fetchall()
            return [self._row_to_cabinet(row) for row in rows]
    
    def _row_to_cabinet(self, row: sqlite3.Row) -> Cabinet:
        """将数据库行转换为 Cabinet 对象"""
        return Cabinet(
            id=row['id'],
            name=row['name'],
            location=row['location'],
            description=row['description'],
            responsible_person_id=row['responsible_person_id'],
            capacity=row['capacity'],
            created_at=self._str_to_datetime(row['created_at']),
            updated_at=self._str_to_datetime(row['updated_at'])
        )
    
    # ========== 试剂操作 ==========
    def add_reagent(self, reagent: Reagent) -> int:
        """添加试剂"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            INSERT INTO reagents 
            (bottle_number, name, category, purity, specification, manufacturer,
             production_date, expiration_date, cabinet_id, quantity, unit, 
             min_quantity, responsible_person_id, purchase_date, notes, 
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                reagent.bottle_number, reagent.name, reagent.category.value,
                reagent.purity, reagent.specification, reagent.manufacturer,
                self._date_to_str(reagent.production_date),
                self._date_to_str(reagent.expiration_date),
                reagent.cabinet_id, reagent.quantity, reagent.unit,
                reagent.min_quantity, reagent.responsible_person_id,
                self._date_to_str(reagent.purchase_date), reagent.notes,
                self._datetime_to_str(now), self._datetime_to_str(now)
            ))
            conn.commit()
            return cursor.lastrowid
    
    def update_reagent(self, reagent: Reagent):
        """更新试剂"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            UPDATE reagents SET
                name=?, category=?, purity=?, specification=?, manufacturer=?,
                production_date=?, expiration_date=?, cabinet_id=?, 
                quantity=?, unit=?, min_quantity=?, responsible_person_id=?,
                purchase_date=?, notes=?, updated_at=?
            WHERE id=?
            ''', (
                reagent.name, reagent.category.value, reagent.purity,
                reagent.specification, reagent.manufacturer,
                self._date_to_str(reagent.production_date),
                self._date_to_str(reagent.expiration_date),
                reagent.cabinet_id, reagent.quantity, reagent.unit,
                reagent.min_quantity, reagent.responsible_person_id,
                self._date_to_str(reagent.purchase_date), reagent.notes,
                self._datetime_to_str(now), reagent.id
            ))
            conn.commit()
    
    def delete_reagent(self, reagent_id: int):
        """删除试剂"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM reagents WHERE id=?', (reagent_id,))
            conn.commit()
    
    def get_reagent_by_id(self, reagent_id: int) -> Optional[Reagent]:
        """根据 ID 获取试剂"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM reagents WHERE id=?', (reagent_id,))
            row = cursor.fetchone()
            return self._row_to_reagent(row) if row else None
    
    def get_reagent_by_bottle_number(self, bottle_number: str) -> Optional[Reagent]:
        """根据瓶号获取试剂"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM reagents WHERE bottle_number=?', (bottle_number,))
            row = cursor.fetchone()
            return self._row_to_reagent(row) if row else None
    
    def get_reagents_by_cabinet(self, cabinet_id: int) -> List[Reagent]:
        """根据柜位获取试剂"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM reagents WHERE cabinet_id=? ORDER BY name', (cabinet_id,))
            rows = cursor.fetchall()
            return [self._row_to_reagent(row) for row in rows]
    
    def get_all_reagents(self) -> List[Reagent]:
        """获取所有试剂"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM reagents ORDER BY name')
            rows = cursor.fetchall()
            return [self._row_to_reagent(row) for row in rows]
    
    def search_reagents(self, keyword: str) -> List[Reagent]:
        """搜索试剂"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            search_pattern = f'%{keyword}%'
            cursor.execute('''
                SELECT * FROM reagents 
                WHERE name LIKE ? OR bottle_number LIKE ? OR manufacturer LIKE ?
                ORDER BY name
            ''', (search_pattern, search_pattern, search_pattern))
            rows = cursor.fetchall()
            return [self._row_to_reagent(row) for row in rows]
    
    def _row_to_reagent(self, row: sqlite3.Row) -> Reagent:
        """将数据库行转换为 Reagent 对象"""
        return Reagent(
            id=row['id'],
            bottle_number=row['bottle_number'],
            name=row['name'],
            category=ChemicalCategory(row['category']),
            purity=row['purity'],
            specification=row['specification'],
            manufacturer=row['manufacturer'],
            production_date=self._str_to_date(row['production_date']),
            expiration_date=self._str_to_date(row['expiration_date']),
            cabinet_id=row['cabinet_id'],
            quantity=row['quantity'],
            unit=row['unit'],
            min_quantity=row['min_quantity'],
            responsible_person_id=row['responsible_person_id'],
            purchase_date=self._str_to_date(row['purchase_date']),
            notes=row['notes'],
            created_at=self._str_to_datetime(row['created_at']),
            updated_at=self._str_to_datetime(row['updated_at'])
        )
    
    # ========== 领用/归还记录操作 ==========
    def add_usage_record(self, record: UsageRecord) -> int:
        """添加领用/归还记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            INSERT INTO usage_records 
            (reagent_id, bottle_number, operation_type, quantity, unit, 
             operator_id, expected_return_date, actual_return_date, 
             purpose, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record.reagent_id, record.bottle_number, record.operation_type,
                record.quantity, record.unit, record.operator_id,
                self._date_to_str(record.expected_return_date),
                self._date_to_str(record.actual_return_date),
                record.purpose, record.notes,
                self._datetime_to_str(now), self._datetime_to_str(now)
            ))
            conn.commit()
            return cursor.lastrowid
    
    def update_usage_record(self, record: UsageRecord):
        """更新领用/归还记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            UPDATE usage_records SET
                reagent_id=?, bottle_number=?, operation_type=?, quantity=?, 
                unit=?, operator_id=?, expected_return_date=?, actual_return_date=?,
                purpose=?, notes=?, updated_at=?
            WHERE id=?
            ''', (
                record.reagent_id, record.bottle_number, record.operation_type,
                record.quantity, record.unit, record.operator_id,
                self._date_to_str(record.expected_return_date),
                self._date_to_str(record.actual_return_date),
                record.purpose, record.notes,
                self._datetime_to_str(now), record.id
            ))
            conn.commit()
    
    def get_usage_record_by_id(self, record_id: int) -> Optional[UsageRecord]:
        """根据 ID 获取领用/归还记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM usage_records WHERE id=?', (record_id,))
            row = cursor.fetchone()
            return self._row_to_usage_record(row) if row else None
    
    def get_usage_records_by_reagent(self, reagent_id: int) -> List[UsageRecord]:
        """根据试剂获取领用/归还记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM usage_records 
                WHERE reagent_id=? 
                ORDER BY created_at DESC
            ''', (reagent_id,))
            rows = cursor.fetchall()
            return [self._row_to_usage_record(row) for row in rows]
    
    def get_overdue_usage_records(self) -> List[UsageRecord]:
        """获取超期未归还的记录"""
        today = date.today().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM usage_records 
                WHERE operation_type=? 
                    AND actual_return_date IS NULL 
                    AND expected_return_date <= ?
                ORDER BY expected_return_date
            ''', ('领用', today))
            rows = cursor.fetchall()
            return [self._row_to_usage_record(row) for row in rows]
    
    def get_all_usage_records(self) -> List[UsageRecord]:
        """获取所有领用/归还记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM usage_records ORDER BY created_at DESC')
            rows = cursor.fetchall()
            return [self._row_to_usage_record(row) for row in rows]
    
    def _row_to_usage_record(self, row: sqlite3.Row) -> UsageRecord:
        """将数据库行转换为 UsageRecord 对象"""
        return UsageRecord(
            id=row['id'],
            reagent_id=row['reagent_id'],
            bottle_number=row['bottle_number'],
            operation_type=row['operation_type'],
            quantity=row['quantity'],
            unit=row['unit'],
            operator_id=row['operator_id'],
            expected_return_date=self._str_to_date(row['expected_return_date']),
            actual_return_date=self._str_to_date(row['actual_return_date']),
            purpose=row['purpose'],
            notes=row['notes'],
            created_at=self._str_to_datetime(row['created_at']),
            updated_at=self._str_to_datetime(row['updated_at'])
        )
    
    # ========== 盘点记录操作 ==========
    def add_inventory_check(self, check: InventoryCheck) -> int:
        """添加盘点记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            INSERT INTO inventory_checks 
            (reagent_id, bottle_number, check_date, checker_id, 
             expected_quantity, actual_quantity, difference, 
             difference_reason, status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                check.reagent_id, check.bottle_number,
                self._date_to_str(check.check_date),
                check.checker_id, check.expected_quantity,
                check.actual_quantity, check.difference,
                check.difference_reason, check.status,
                check.notes, self._datetime_to_str(now)
            ))
            conn.commit()
            return cursor.lastrowid
    
    def get_inventory_checks_by_date(self, check_date: date) -> List[InventoryCheck]:
        """根据日期获取盘点记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM inventory_checks 
                WHERE check_date=? 
                ORDER BY created_at
            ''', (self._date_to_str(check_date),))
            rows = cursor.fetchall()
            return [self._row_to_inventory_check(row) for row in rows]
    
    def get_all_inventory_checks(self) -> List[InventoryCheck]:
        """获取所有盘点记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM inventory_checks ORDER BY created_at DESC')
            rows = cursor.fetchall()
            return [self._row_to_inventory_check(row) for row in rows]
    
    def _row_to_inventory_check(self, row: sqlite3.Row) -> InventoryCheck:
        """将数据库行转换为 InventoryCheck 对象"""
        return InventoryCheck(
            id=row['id'],
            reagent_id=row['reagent_id'],
            bottle_number=row['bottle_number'],
            check_date=self._str_to_date(row['check_date']),
            checker_id=row['checker_id'],
            expected_quantity=row['expected_quantity'],
            actual_quantity=row['actual_quantity'],
            difference=row['difference'],
            difference_reason=row['difference_reason'],
            status=row['status'],
            notes=row['notes'],
            created_at=self._str_to_datetime(row['created_at'])
        )
    
    # ========== 巡检记录操作 ==========
    def add_inspection_record(self, record: InspectionRecord) -> int:
        """添加巡检记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            INSERT INTO inspection_records 
            (inspection_date, inspector_id, total_reagents, expired_count, 
             low_stock_count, incompatible_count, overdue_return_count, 
             status, report_path, csv_path, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                self._date_to_str(record.inspection_date),
                record.inspector_id, record.total_reagents,
                record.expired_count, record.low_stock_count,
                record.incompatible_count, record.overdue_return_count,
                record.status, record.report_path, record.csv_path,
                record.notes, self._datetime_to_str(now), self._datetime_to_str(now)
            ))
            conn.commit()
            return cursor.lastrowid
    
    def get_inspection_record_by_id(self, record_id: int) -> Optional[InspectionRecord]:
        """根据 ID 获取巡检记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM inspection_records WHERE id=?', (record_id,))
            row = cursor.fetchone()
            return self._row_to_inspection_record(row) if row else None
    
    def get_all_inspection_records(self) -> List[InspectionRecord]:
        """获取所有巡检记录"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM inspection_records ORDER BY created_at DESC')
            rows = cursor.fetchall()
            return [self._row_to_inspection_record(row) for row in rows]
    
    def _row_to_inspection_record(self, row: sqlite3.Row) -> InspectionRecord:
        """将数据库行转换为 InspectionRecord 对象"""
        return InspectionRecord(
            id=row['id'],
            inspection_date=self._str_to_date(row['inspection_date']),
            inspector_id=row['inspector_id'],
            total_reagents=row['total_reagents'],
            expired_count=row['expired_count'],
            low_stock_count=row['low_stock_count'],
            incompatible_count=row['incompatible_count'],
            overdue_return_count=row['overdue_return_count'],
            status=row['status'],
            report_path=row['report_path'],
            csv_path=row['csv_path'],
            notes=row['notes'],
            created_at=self._str_to_datetime(row['created_at']),
            updated_at=self._str_to_datetime(row['updated_at'])
        )
    
    # ========== 预警操作 ==========
    def add_alert(self, alert: Alert) -> int:
        """添加预警"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
            INSERT INTO alerts 
            (alert_type, reagent_id, bottle_number, reagent_name, message, 
             is_resolved, created_at, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                alert.alert_type.value, alert.reagent_id, alert.bottle_number,
                alert.reagent_name, alert.message,
                1 if alert.is_resolved else 0,
                self._datetime_to_str(now),
                self._datetime_to_str(alert.resolved_at) if alert.resolved_at else None
            ))
            conn.commit()
            return cursor.lastrowid
    
    def resolve_alert(self, alert_id: int):
        """解决预警"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now()
            cursor.execute('''
                UPDATE alerts SET 
                    is_resolved=1, 
                    resolved_at=?
                WHERE id=?
            ''', (self._datetime_to_str(now), alert_id))
            conn.commit()
    
    def get_unresolved_alerts(self) -> List[Alert]:
        """获取未解决的预警"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM alerts 
                WHERE is_resolved=0 
                ORDER BY created_at DESC
            ''')
            rows = cursor.fetchall()
            return [self._row_to_alert(row) for row in rows]
    
    def get_all_alerts(self) -> List[Alert]:
        """获取所有预警"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM alerts ORDER BY created_at DESC')
            rows = cursor.fetchall()
            return [self._row_to_alert(row) for row in rows]
    
    def _row_to_alert(self, row: sqlite3.Row) -> Alert:
        """将数据库行转换为 Alert 对象"""
        return Alert(
            id=row['id'],
            alert_type=AlertType(row['alert_type']),
            reagent_id=row['reagent_id'],
            bottle_number=row['bottle_number'],
            reagent_name=row['reagent_name'],
            message=row['message'],
            is_resolved=row['is_resolved'] == 1,
            created_at=self._str_to_datetime(row['created_at']),
            resolved_at=self._str_to_datetime(row['resolved_at']) if row['resolved_at'] else None
        )
