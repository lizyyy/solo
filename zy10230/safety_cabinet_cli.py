#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
实验室安全柜领用 CLI
维护试剂、批号、危化等级、项目、领用人、归还量和废液处理记录
"""

import argparse
import csv
import hashlib
import json
import os
import sqlite3
import sys
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple


DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'safety_cabinet.db')


class Database:
    def __init__(self, db_path: str = DB_FILE):
        self.db_path = db_path

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def init(self) -> None:
        conn = self.connect()
        cursor = conn.cursor()
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS reagents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reagent_name TEXT NOT NULL,
            batch_no TEXT NOT NULL,
            hazard_level TEXT NOT NULL,
            expiration_date TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(reagent_name, batch_no)
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS usages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reagent_id INTEGER NOT NULL,
            project_name TEXT NOT NULL,
            user_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT DEFAULT '瓶',
            approval_status TEXT DEFAULT 'pending',
            taken_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            import_hash TEXT,
            FOREIGN KEY (reagent_id) REFERENCES reagents(id),
            UNIQUE(reagent_id, project_name, user_name, taken_date, quantity)
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usage_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            return_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            import_hash TEXT,
            FOREIGN KEY (usage_id) REFERENCES usages(id),
            UNIQUE(usage_id, return_date, quantity)
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS waste_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reagent_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            treatment_date TEXT NOT NULL,
            disposal_method TEXT,
            created_at TEXT NOT NULL,
            import_hash TEXT,
            FOREIGN KEY (reagent_id) REFERENCES reagents(id),
            UNIQUE(reagent_id, treatment_date, quantity, disposal_method)
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS imports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            import_hash TEXT NOT NULL,
            import_type TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            UNIQUE(import_hash)
        )
        """)
        
        conn.commit()
        conn.close()

    def is_initialized(self) -> bool:
        return os.path.exists(self.db_path)


def compute_hash(*args) -> str:
    content = "||".join(str(arg) for arg in args)
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def parse_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    formats = ['%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


def format_date(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.strftime('%Y-%m-%d')


class SafetyCabinetCLI:
    def __init__(self):
        self.db = Database()
    
    def init_db(self, args):
        if self.db.is_initialized() and not args.force:
            print("数据库已存在，使用 --force 强制重新初始化")
            return 1
        self.db.init()
        print(f"数据库已初始化: {self.db.db_path}")
        return 0
    
    def import_data(self, args):
        if not self.db.is_initialized():
            print("数据库未初始化，请先运行 init 命令")
            return 1
        
        if not os.path.exists(args.file):
            print(f"文件不存在: {args.file}")
            return 1
        
        if args.type == 'reagents':
            return self._import_reagents(args.file)
        elif args.type == 'usages':
            return self._import_usages(args.file)
        elif args.type == 'returns':
            return self._import_returns(args.file)
        elif args.type == 'waste':
            return self._import_waste(args.file)
        else:
            print(f"未知导入类型: {args.type}")
            return 1
    
    def _import_reagents(self, filepath: str) -> int:
        conn = self.db.connect()
        cursor = conn.cursor()
        
        imported = 0
        skipped = 0
        errors = []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                name = row.get('reagent_name', '').strip()
                batch_no = row.get('batch_no', '').strip()
                hazard_level = row.get('hazard_level', '').strip()
                exp_date = row.get('expiration_date', '').strip()
                
                if not name or not batch_no or not hazard_level:
                    errors.append(f"第{row_num}行: 试剂名、批号、危化等级不能为空")
                    continue
                
                if exp_date:
                    parsed = parse_date(exp_date)
                    if not parsed:
                        errors.append(f"第{row_num}行: 日期格式错误，使用 YYYY-MM-DD")
                        continue
                    exp_date = format_date(parsed)
                
                import_hash = compute_hash('reagent', name, batch_no, hazard_level, exp_date or '')
                
                cursor.execute("SELECT id FROM imports WHERE import_hash = ?", (import_hash,))
                if cursor.fetchone():
                    skipped += 1
                    continue
                
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO reagents (reagent_name, batch_no, hazard_level, expiration_date, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    """, (name, batch_no, hazard_level, exp_date, datetime.now().isoformat()))
                    
                    if cursor.rowcount > 0:
                        cursor.execute("""
                            INSERT OR IGNORE INTO imports (import_hash, import_type, imported_at)
                            VALUES (?, ?, ?)
                        """, (import_hash, 'reagent', datetime.now().isoformat()))
                        imported += 1
                except Exception as e:
                    errors.append(f"第{row_num}行: {e}")
        
        conn.commit()
        conn.close()
        
        print(f"导入试剂: 成功 {imported}, 跳过(重复) {skipped}, 错误 {len(errors)}")
        for err in errors:
            print(f"  - {err}")
        return 0 if not errors else 1
    
    def _import_usages(self, filepath: str) -> int:
        conn = self.db.connect()
        cursor = conn.cursor()
        
        imported = 0
        skipped = 0
        errors = []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                name = row.get('reagent_name', '').strip()
                batch_no = row.get('batch_no', '').strip()
                project = row.get('project_name', '').strip()
                user = row.get('user_name', '').strip()
                qty = row.get('quantity', '').strip()
                unit = row.get('unit', '瓶').strip()
                approval = row.get('approval_status', 'pending').strip()
                taken_date = row.get('taken_date', '').strip()
                
                if not name or not batch_no or not project or not user or not qty or not taken_date:
                    errors.append(f"第{row_num}行: 必要字段不能为空")
                    continue
                
                try:
                    qty_val = float(qty)
                    if qty_val <= 0:
                        raise ValueError("数量必须大于0")
                except ValueError as e:
                    errors.append(f"第{row_num}行: 数量格式错误 - {e}")
                    continue
                
                taken_parsed = parse_date(taken_date)
                if not taken_parsed:
                    errors.append(f"第{row_num}行: 领用日期格式错误")
                    continue
                taken_date = format_date(taken_parsed)
                
                cursor.execute("""
                    SELECT id FROM reagents WHERE reagent_name = ? AND batch_no = ?
                """, (name, batch_no))
                reagent = cursor.fetchone()
                if not reagent:
                    errors.append(f"第{row_num}行: 试剂不存在 - {name} ({batch_no})")
                    continue
                reagent_id = reagent[0]
                
                import_hash = compute_hash('usage', reagent_id, project, user, qty_val, taken_date)
                
                cursor.execute("SELECT id FROM imports WHERE import_hash = ?", (import_hash,))
                if cursor.fetchone():
                    skipped += 1
                    continue
                
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO usages 
                        (reagent_id, project_name, user_name, quantity, unit, approval_status, taken_date, created_at, import_hash)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (reagent_id, project, user, qty_val, unit, approval, taken_date, 
                          datetime.now().isoformat(), import_hash))
                    
                    if cursor.rowcount > 0:
                        cursor.execute("""
                            INSERT OR IGNORE INTO imports (import_hash, import_type, imported_at)
                            VALUES (?, ?, ?)
                        """, (import_hash, 'usage', datetime.now().isoformat()))
                        imported += 1
                    else:
                        skipped += 1
                except Exception as e:
                    errors.append(f"第{row_num}行: {e}")
        
        conn.commit()
        conn.close()
        
        print(f"导入领用记录: 成功 {imported}, 跳过(重复) {skipped}, 错误 {len(errors)}")
        for err in errors:
            print(f"  - {err}")
        return 0 if not errors else 1
    
    def _import_returns(self, filepath: str) -> int:
        conn = self.db.connect()
        cursor = conn.cursor()
        
        imported = 0
        skipped = 0
        errors = []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                usage_id = row.get('usage_id', '').strip()
                name = row.get('reagent_name', '').strip()
                batch_no = row.get('batch_no', '').strip()
                project = row.get('project_name', '').strip()
                user = row.get('user_name', '').strip()
                qty = row.get('quantity', '').strip()
                return_date = row.get('return_date', '').strip()
                
                if not qty or not return_date:
                    errors.append(f"第{row_num}行: 归还数量和日期不能为空")
                    continue
                
                try:
                    qty_val = float(qty)
                    if qty_val <= 0:
                        raise ValueError("数量必须大于0")
                except ValueError as e:
                    errors.append(f"第{row_num}行: 数量格式错误 - {e}")
                    continue
                
                return_parsed = parse_date(return_date)
                if not return_parsed:
                    errors.append(f"第{row_num}行: 归还日期格式错误")
                    continue
                return_date = format_date(return_parsed)
                
                found_usage_id = None
                if usage_id:
                    cursor.execute("SELECT id FROM usages WHERE id = ?", (int(usage_id),))
                    if cursor.fetchone():
                        found_usage_id = int(usage_id)
                
                if not found_usage_id and name and batch_no and project and user:
                    cursor.execute("""
                        SELECT id FROM usages 
                        WHERE reagent_id = (SELECT id FROM reagents WHERE reagent_name = ? AND batch_no = ?)
                        AND project_name = ? AND user_name = ?
                        ORDER BY taken_date DESC LIMIT 1
                    """, (name, batch_no, project, user))
                    result = cursor.fetchone()
                    if result:
                        found_usage_id = result[0]
                
                if not found_usage_id:
                    errors.append(f"第{row_num}行: 找不到对应的领用记录")
                    continue
                
                import_hash = compute_hash('return', found_usage_id, qty_val, return_date)
                
                cursor.execute("SELECT id FROM imports WHERE import_hash = ?", (import_hash,))
                if cursor.fetchone():
                    skipped += 1
                    continue
                
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO returns (usage_id, quantity, return_date, created_at, import_hash)
                        VALUES (?, ?, ?, ?, ?)
                    """, (found_usage_id, qty_val, return_date, datetime.now().isoformat(), import_hash))
                    
                    if cursor.rowcount > 0:
                        cursor.execute("""
                            INSERT OR IGNORE INTO imports (import_hash, import_type, imported_at)
                            VALUES (?, ?, ?)
                        """, (import_hash, 'return', datetime.now().isoformat()))
                        imported += 1
                    else:
                        skipped += 1
                except Exception as e:
                    errors.append(f"第{row_num}行: {e}")
        
        conn.commit()
        conn.close()
        
        print(f"导入归还记录: 成功 {imported}, 跳过(重复) {skipped}, 错误 {len(errors)}")
        for err in errors:
            print(f"  - {err}")
        return 0 if not errors else 1
    
    def _import_waste(self, filepath: str) -> int:
        conn = self.db.connect()
        cursor = conn.cursor()
        
        imported = 0
        skipped = 0
        errors = []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                name = row.get('reagent_name', '').strip()
                batch_no = row.get('batch_no', '').strip()
                qty = row.get('quantity', '').strip()
                treatment_date = row.get('treatment_date', '').strip()
                disposal_method = row.get('disposal_method', '').strip()
                
                if not name or not batch_no or not qty or not treatment_date:
                    errors.append(f"第{row_num}行: 必要字段不能为空")
                    continue
                
                try:
                    qty_val = float(qty)
                    if qty_val <= 0:
                        raise ValueError("数量必须大于0")
                except ValueError as e:
                    errors.append(f"第{row_num}行: 数量格式错误 - {e}")
                    continue
                
                treatment_parsed = parse_date(treatment_date)
                if not treatment_parsed:
                    errors.append(f"第{row_num}行: 处理日期格式错误")
                    continue
                treatment_date = format_date(treatment_parsed)
                
                cursor.execute("""
                    SELECT id FROM reagents WHERE reagent_name = ? AND batch_no = ?
                """, (name, batch_no))
                reagent = cursor.fetchone()
                if not reagent:
                    errors.append(f"第{row_num}行: 试剂不存在 - {name} ({batch_no})")
                    continue
                reagent_id = reagent[0]
                
                import_hash = compute_hash('waste', reagent_id, qty_val, treatment_date, disposal_method)
                
                cursor.execute("SELECT id FROM imports WHERE import_hash = ?", (import_hash,))
                if cursor.fetchone():
                    skipped += 1
                    continue
                
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO waste_records 
                        (reagent_id, quantity, treatment_date, disposal_method, created_at, import_hash)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (reagent_id, qty_val, treatment_date, disposal_method, 
                          datetime.now().isoformat(), import_hash))
                    
                    if cursor.rowcount > 0:
                        cursor.execute("""
                            INSERT OR IGNORE INTO imports (import_hash, import_type, imported_at)
                            VALUES (?, ?, ?)
                        """, (import_hash, 'waste', datetime.now().isoformat()))
                        imported += 1
                    else:
                        skipped += 1
                except Exception as e:
                    errors.append(f"第{row_num}行: {e}")
        
        conn.commit()
        conn.close()
        
        print(f"导入废液记录: 成功 {imported}, 跳过(重复) {skipped}, 错误 {len(errors)}")
        for err in errors:
            print(f"  - {err}")
        return 0 if not errors else 1
    
    def validate(self, args):
        if not self.db.is_initialized():
            print("数据库未初始化")
            return 1
        
        conn = self.db.connect()
        cursor = conn.cursor()
        
        issues = []
        
        cursor.execute("""
            SELECT u.id, r.reagent_name, r.batch_no, u.project_name, u.user_name, u.taken_date
            FROM usages u
            JOIN reagents r ON u.reagent_id = r.id
            WHERE u.approval_status NOT IN ('approved', 'confirmed')
        """)
        unapproved = cursor.fetchall()
        for row in unapproved:
            issues.append(f"[无审批] 领用记录 #{row[0]}: {row[1]} ({row[2]}) - {row[3]} / {row[4]} @ {row[5]}")
        
        cursor.execute("""
            SELECT u.id, r.reagent_name, r.batch_no, u.quantity, 
                   COALESCE(rt_agg.total_return, 0) as total_return
            FROM usages u
            JOIN reagents r ON u.reagent_id = r.id
            LEFT JOIN (
                SELECT usage_id, SUM(quantity) as total_return
                FROM returns
                GROUP BY usage_id
            ) rt_agg ON u.id = rt_agg.usage_id
            WHERE COALESCE(rt_agg.total_return, 0) > u.quantity
        """)
        over_returns = cursor.fetchall()
        for row in over_returns:
            issues.append(f"[归还超标] 领用 #{row[0]}: {row[1]} ({row[2]}) 领用{row[3]} 归还{row[4]}")
        
        cursor.execute("""
            SELECT r.id, r.reagent_name, r.batch_no,
                   COALESCE(u_agg.total_taken, 0) as total_taken,
                   COALESCE(rt_agg.total_returned, 0) as total_returned,
                   COALESCE(w_agg.total_waste, 0) as total_waste
            FROM reagents r
            LEFT JOIN (
                SELECT reagent_id, SUM(quantity) as total_taken
                FROM usages
                GROUP BY reagent_id
            ) u_agg ON r.id = u_agg.reagent_id
            LEFT JOIN (
                SELECT u.reagent_id, SUM(rt.quantity) as total_returned
                FROM returns rt
                JOIN usages u ON rt.usage_id = u.id
                GROUP BY u.reagent_id
            ) rt_agg ON r.id = rt_agg.reagent_id
            LEFT JOIN (
                SELECT reagent_id, SUM(quantity) as total_waste
                FROM waste_records
                GROUP BY reagent_id
            ) w_agg ON r.id = w_agg.reagent_id
            WHERE (COALESCE(u_agg.total_taken, 0) - COALESCE(rt_agg.total_returned, 0)) 
                  - COALESCE(w_agg.total_waste, 0) > 0.001
        """)
        unaccounted = cursor.fetchall()
        for row in unaccounted:
            accounted = row[4] + row[5]
            diff = row[3] - accounted
            issues.append(f"[去向不明] {row[1]} ({row[2]}): 领用{row[3]}, 归还{row[4]}, 废液{row[5]}, 缺口{diff}")
        
        today = date.today().isoformat()
        cursor.execute("""
            SELECT id, reagent_name, batch_no, expiration_date
            FROM reagents
            WHERE expiration_date IS NOT NULL AND expiration_date < ?
        """, (today,))
        expired = cursor.fetchall()
        for row in expired:
            issues.append(f"[已过期] {row[1]} ({row[2]}) 有效期至 {row[3]}")
        
        cursor.execute("""
            SELECT u.id, r.reagent_name, r.batch_no, r.expiration_date, u.taken_date
            FROM usages u
            JOIN reagents r ON u.reagent_id = r.id
            WHERE r.expiration_date IS NOT NULL AND u.taken_date > r.expiration_date
        """)
        expired_usage = cursor.fetchall()
        for row in expired_usage:
            issues.append(f"[过期领用] #{row[0]}: {row[1]} ({row[2]}) 过期{row[3]} 领用{row[4]}")
        
        conn.close()
        
        if issues:
            print("=" * 60)
            print(f"发现 {len(issues)} 个问题:")
            print("=" * 60)
            for issue in issues:
                print(issue)
            return 2
        else:
            print("所有记录校验通过")
            return 0
    
    def confirm(self, args):
        if not self.db.is_initialized():
            print("数据库未初始化")
            return 1
        
        conn = self.db.connect()
        cursor = conn.cursor()
        
        if args.type == 'usage':
            if not args.id:
                print("请指定 --id 参数")
                conn.close()
                return 1
            cursor.execute("""
                UPDATE usages SET approval_status = 'confirmed'
                WHERE id = ? AND approval_status != 'confirmed'
            """, (args.id,))
            if cursor.rowcount > 0:
                print(f"领用记录 #{args.id} 已确认")
            else:
                print("记录不存在或已确认")
        
        elif args.type == 'all':
            cursor.execute("""
                UPDATE usages SET approval_status = 'confirmed'
                WHERE approval_status != 'confirmed'
            """)
            count = cursor.rowcount
            print(f"已确认 {count} 条待确认记录")
        
        else:
            print(f"未知确认类型: {args.type}")
            conn.close()
            return 1
        
        conn.commit()
        conn.close()
        return 0
    
    def _get_reagent_status(self) -> Dict[str, List[Dict]]:
        conn = self.db.connect()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        today = date.today().isoformat()
        
        cursor.execute("""
            SELECT 
                r.id, r.reagent_name, r.batch_no, r.hazard_level, r.expiration_date,
                COALESCE(u_agg.total_taken, 0) as total_taken,
                COALESCE(rt_agg.total_returned, 0) as total_returned,
                COALESCE(w_agg.total_waste, 0) as total_waste
            FROM reagents r
            LEFT JOIN (
                SELECT reagent_id, SUM(quantity) as total_taken
                FROM usages
                GROUP BY reagent_id
            ) u_agg ON r.id = u_agg.reagent_id
            LEFT JOIN (
                SELECT u.reagent_id, SUM(rt.quantity) as total_returned
                FROM returns rt
                JOIN usages u ON rt.usage_id = u.id
                GROUP BY u.reagent_id
            ) rt_agg ON r.id = rt_agg.reagent_id
            LEFT JOIN (
                SELECT reagent_id, SUM(quantity) as total_waste
                FROM waste_records
                GROUP BY reagent_id
            ) w_agg ON r.id = w_agg.reagent_id
        """)
        all_reagents = cursor.fetchall()
        
        ok_list = []
        remove_list = []
        missing_list = []
        
        for row in all_reagents:
            info = {
                'id': row['id'],
                'name': row['reagent_name'],
                'batch': row['batch_no'],
                'hazard': row['hazard_level'],
                'expiration': row['expiration_date'],
                'balance': row['total_taken'] - row['total_returned'] - row['total_waste']
            }
            
            is_expired = row['expiration_date'] and row['expiration_date'] < today
            balance = info['balance']
            
            if is_expired:
                remove_list.append(info)
            elif balance < 0 or abs(balance) > 0.001:
                missing_list.append(info)
            else:
                ok_list.append(info)
        
        conn.close()
        return {
            'ok': ok_list,
            'remove': remove_list,
            'missing': missing_list
        }
    
    def status(self, args):
        if not self.db.is_initialized():
            print("数据库未初始化")
            return 1
        
        status = self._get_reagent_status()
        
        categories = [
            ("可继续使用", 'ok', status['ok']),
            ("需要下架", 'remove', status['remove']),
            ("缺少去向", 'missing', status['missing']),
        ]
        
        for title, key, items in categories:
            print("=" * 60)
            print(f"【{title}】共 {len(items)} 项")
            print("=" * 60)
            for item in items:
                exp = item['expiration'] or '无期限'
                print(f"  {item['name']} (批次:{item['batch']}, 等级:{item['hazard']})")
                print(f"    有效期: {exp}")
                if key != 'ok':
                    print(f"    去向缺口: {item['balance']:.3f}")
        
        return 0
    
    def history(self, args):
        if not self.db.is_initialized():
            print("数据库未初始化")
            return 1
        
        conn = self.db.connect()
        cursor = conn.cursor()
        
        if args.type == 'reagents':
            self._print_reagents(cursor, args)
        elif args.type == 'usages':
            self._print_usages(cursor, args)
        elif args.type == 'returns':
            self._print_returns(cursor, args)
        elif args.type == 'waste':
            self._print_waste(cursor, args)
        else:
            print("请指定历史类型: --type [reagents|usages|returns|waste]")
            conn.close()
            return 1
        
        conn.close()
        return 0
    
    def _print_reagents(self, cursor, args):
        query = "SELECT id, reagent_name, batch_no, hazard_level, expiration_date, created_at FROM reagents"
        params = []
        
        if args.search:
            query += " WHERE reagent_name LIKE ? OR batch_no LIKE ?"
            search = f"%{args.search}%"
            params = [search, search]
        
        query += " ORDER BY created_at DESC"
        if args.limit:
            query += f" LIMIT {int(args.limit)}"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        print(f"\n试剂列表 (共 {len(rows)} 条)")
        print("-" * 80)
        for row in rows:
            print(f"#{row[0]:<4} {row[1]:<20} 批次:{row[2]:<15} 危化:{row[3]:<8} 有效期:{row[4] or '-'}")
    
    def _print_usages(self, cursor, args):
        query = """
            SELECT u.id, r.reagent_name, r.batch_no, u.project_name, u.user_name,
                   u.quantity, u.unit, u.approval_status, u.taken_date
            FROM usages u
            JOIN reagents r ON u.reagent_id = r.id
        """
        params = []
        conditions = []
        
        if args.search:
            conditions.append("(r.reagent_name LIKE ? OR u.user_name LIKE ? OR u.project_name LIKE ?)")
            search = f"%{args.search}%"
            params += [search, search, search]
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY u.taken_date DESC"
        if args.limit:
            query += f" LIMIT {int(args.limit)}"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        print(f"\n领用记录 (共 {len(rows)} 条)")
        print("-" * 100)
        for row in rows:
            status_icon = "✓" if row[7] in ('approved', 'confirmed') else "?"
            print(f"#{row[0]:<4} {row[1]:<15} [{row[2]}] {row[3]}/{row[4]} "
                  f"{row[5]:.1f}{row[6]} {status_icon} {row[8]}")
    
    def _print_returns(self, cursor, args):
        query = """
            SELECT rt.id, r.reagent_name, r.batch_no, u.project_name, u.user_name,
                   rt.quantity, rt.return_date, u.id as usage_id
            FROM returns rt
            JOIN usages u ON rt.usage_id = u.id
            JOIN reagents r ON u.reagent_id = r.id
        """
        params = []
        conditions = []
        
        if args.search:
            conditions.append("(r.reagent_name LIKE ? OR u.user_name LIKE ?)")
            search = f"%{args.search}%"
            params += [search, search]
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY rt.return_date DESC"
        if args.limit:
            query += f" LIMIT {int(args.limit)}"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        print(f"\n归还记录 (共 {len(rows)} 条)")
        print("-" * 80)
        for row in rows:
            print(f"#{row[0]:<4} {row[1]:<15} [{row[2]}] {row[3]}/{row[4]} "
                  f"归还{row[5]:.1f} 日期:{row[6]} (领用#{row[7]})")
    
    def _print_waste(self, cursor, args):
        query = """
            SELECT w.id, r.reagent_name, r.batch_no, w.quantity, w.treatment_date, w.disposal_method
            FROM waste_records w
            JOIN reagents r ON w.reagent_id = r.id
        """
        params = []
        conditions = []
        
        if args.search:
            conditions.append("(r.reagent_name LIKE ?)")
            search = f"%{args.search}%"
            params += [search]
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += " ORDER BY w.treatment_date DESC"
        if args.limit:
            query += f" LIMIT {int(args.limit)}"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        print(f"\n废液处理记录 (共 {len(rows)} 条)")
        print("-" * 80)
        for row in rows:
            method = row[5] or '未说明'
            print(f"#{row[0]:<4} {row[1]:<15} [{row[2]}] {row[3]:.1f} 处理日期:{row[4]} 方式:{method}")
    
    def export(self, args):
        if not self.db.is_initialized():
            print("数据库未初始化")
            return 1
        
        conn = self.db.connect()
        cursor = conn.cursor()
        
        if args.type == 'status':
            status = self._get_reagent_status()
            data = {
                'exported_at': datetime.now().isoformat(),
                '可继续使用': status['ok'],
                '需要下架': status['remove'],
                '缺少去向': status['missing']
            }
            
            if args.format == 'json':
                with open(args.output, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"已导出状态报告到: {args.output}")
            elif args.format == 'csv':
                with open(args.output, 'w', encoding='utf-8', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(['分类', '试剂名', '批号', '危化等级', '有效期', '去向缺口'])
                    for cat, items in [('可继续使用', status['ok']), 
                                       ('需要下架', status['remove']),
                                       ('缺少去向', status['missing'])]:
                        for item in items:
                            writer.writerow([cat, item['name'], item['batch'], item['hazard'],
                                           item['expiration'] or '', f"{item['balance']:.3f}"])
                print(f"已导出状态报告到: {args.output}")
        
        elif args.type == 'all':
            if args.format != 'json':
                print("全量导出仅支持 JSON 格式")
                conn.close()
                return 1
            
            cursor.execute("SELECT * FROM reagents")
            cols = [desc[0] for desc in cursor.description]
            reagents = [dict(zip(cols, row)) for row in cursor.fetchall()]
            
            cursor.execute("SELECT * FROM usages")
            cols = [desc[0] for desc in cursor.description]
            usages = [dict(zip(cols, row)) for row in cursor.fetchall()]
            
            cursor.execute("SELECT * FROM returns")
            cols = [desc[0] for desc in cursor.description]
            returns = [dict(zip(cols, row)) for row in cursor.fetchall()]
            
            cursor.execute("SELECT * FROM waste_records")
            cols = [desc[0] for desc in cursor.description]
            waste = [dict(zip(cols, row)) for row in cursor.fetchall()]
            
            export_data = {
                'exported_at': datetime.now().isoformat(),
                'reagents': reagents,
                'usages': usages,
                'returns': returns,
                'waste_records': waste
            }
            
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)
            print(f"已导出全量数据到: {args.output}")
        
        else:
            print(f"未知导出类型: {args.type}")
            conn.close()
            return 1
        
        conn.close()
        return 0


def main():
    parser = argparse.ArgumentParser(
        description='实验室安全柜领用 CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s init
  %(prog)s import --type reagents -f reagents.csv
  %(prog)s validate
  %(prog)s status
  %(prog)s confirm --type all
  %(prog)s history --type usages --limit 10
  %(prog)s export --type status -f report.csv --format csv
"""
    )
    
    subparsers = parser.add_subparsers(dest='command', required=True)
    
    sp_init = subparsers.add_parser('init', help='初始化数据库')
    sp_init.add_argument('--force', action='store_true', help='强制重新初始化')
    sp_init.set_defaults(func=lambda args: SafetyCabinetCLI().init_db(args))
    
    sp_import = subparsers.add_parser('import', help='导入数据 (reagents|usages|returns|waste)')
    sp_import.add_argument('--type', required=True, choices=['reagents', 'usages', 'returns', 'waste'])
    sp_import.add_argument('-f', '--file', required=True, help='CSV 文件路径')
    sp_import.set_defaults(func=lambda args: SafetyCabinetCLI().import_data(args))
    
    sp_validate = subparsers.add_parser('validate', help='校验数据合规性')
    sp_validate.set_defaults(func=lambda args: SafetyCabinetCLI().validate(args))
    
    sp_confirm = subparsers.add_parser('confirm', help='确认记录')
    sp_confirm.add_argument('--type', default='all', choices=['all', 'usage'])
    sp_confirm.add_argument('--id', type=int, help='领用记录 ID (type=usage 时使用)')
    sp_confirm.set_defaults(func=lambda args: SafetyCabinetCLI().confirm(args))
    
    sp_status = subparsers.add_parser('status', help='查看试剂状态（安全检查）')
    sp_status.set_defaults(func=lambda args: SafetyCabinetCLI().status(args))
    
    sp_history = subparsers.add_parser('history', help='查询历史记录')
    sp_history.add_argument('--type', required=True, choices=['reagents', 'usages', 'returns', 'waste'])
    sp_history.add_argument('--search', help='搜索关键词')
    sp_history.add_argument('--limit', type=int, help='显示条数')
    sp_history.set_defaults(func=lambda args: SafetyCabinetCLI().history(args))
    
    sp_export = subparsers.add_parser('export', help='导出数据')
    sp_export.add_argument('--type', required=True, choices=['status', 'all'])
    sp_export.add_argument('-f', '--file', dest='output', required=True, help='输出文件路径')
    sp_export.add_argument('--format', default='json', choices=['json', 'csv'])
    sp_export.set_defaults(func=lambda args: SafetyCabinetCLI().export(args))
    
    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == '__main__':
    main()
