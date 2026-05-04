#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
预约管理服务
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime, date

from config import get_config
from database import get_db


class BookingService:
    """预约管理服务"""
    
    def __init__(self):
        self.config = get_config()
        self.db = get_db()
    
    def get_all_bookings(self, status: str = None) -> List[Dict]:
        """获取所有预约"""
        cursor = self.db.cursor()
        
        query = '''
            SELECT b.*, 
                   c.grade || c.class_number as class_name,
                   c.student_count as class_student_count,
                   (SELECT COUNT(*) FROM booking_items WHERE booking_id = b.id) as item_count
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
        '''
        params = []
        
        if status:
            query += ' WHERE b.status = ?'
            params.append(status)
        
        query += ' ORDER BY b.experiment_date DESC, b.created_at DESC'
        
        cursor.execute(query, params)
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_booking(self, booking_id: int) -> Optional[Dict]:
        """获取单个预约"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT b.*, 
                   c.grade || c.class_number as class_name,
                   c.teacher_name as class_teacher
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
            WHERE b.id = ?
        ''', (booking_id,))
        
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_booking_items(self, booking_id: int) -> List[Dict]:
        """获取预约项目明细"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT bi.*,
                   r.name as reagent_name,
                   r.category as reagent_category,
                   r.danger_level as reagent_danger_level,
                   r.concentration as reagent_concentration,
                   r.unit as reagent_unit,
                   r.available_quantity as reagent_available
            FROM booking_items bi
            JOIN reagents r ON bi.reagent_id = r.id
            WHERE bi.booking_id = ?
        ''', (booking_id,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def create_booking(self, booking_data: Dict, items: List[Dict]) -> int:
        """创建预约"""
        cursor = self.db.cursor()
        
        # 插入预约主表
        cursor.execute('''
            INSERT INTO bookings 
            (class_id, experiment_name, teacher_name, booking_date,
             experiment_date, student_count, status, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            booking_data.get('class_id'),
            booking_data.get('experiment_name'),
            booking_data.get('teacher_name'),
            booking_data.get('booking_date', date.today().isoformat()),
            booking_data.get('experiment_date'),
            booking_data.get('student_count', 0),
            'pending',
            booking_data.get('remarks')
        ))
        
        booking_id = cursor.lastrowid
        
        # 插入预约项目
        for item in items:
            cursor.execute('''
                INSERT INTO booking_items
                (booking_id, reagent_id, requested_quantity, remarks)
                VALUES (?, ?, ?, ?)
            ''', (
                booking_id,
                item.get('reagent_id'),
                item.get('requested_quantity'),
                item.get('remarks')
            ))
        
        self.db.commit()
        return booking_id
    
    def update_booking(self, booking_id: int, booking_data: Dict, items: List[Dict] = None) -> bool:
        """更新预约"""
        cursor = self.db.cursor()
        
        # 更新预约主表
        cursor.execute('''
            UPDATE bookings
            SET class_id = ?, experiment_name = ?, teacher_name = ?,
                experiment_date = ?, student_count = ?, remarks = ?
            WHERE id = ?
        ''', (
            booking_data.get('class_id'),
            booking_data.get('experiment_name'),
            booking_data.get('teacher_name'),
            booking_data.get('experiment_date'),
            booking_data.get('student_count', 0),
            booking_data.get('remarks'),
            booking_id
        ))
        
        # 如果提供了项目列表，更新项目
        if items is not None:
            # 删除旧项目
            cursor.execute('DELETE FROM booking_items WHERE booking_id = ?', (booking_id,))
            
            # 插入新项目
            for item in items:
                cursor.execute('''
                    INSERT INTO booking_items
                    (booking_id, reagent_id, requested_quantity, remarks)
                    VALUES (?, ?, ?, ?)
                ''', (
                    booking_id,
                    item.get('reagent_id'),
                    item.get('requested_quantity'),
                    item.get('remarks')
                ))
        
        self.db.commit()
        return True
    
    def delete_booking(self, booking_id: int) -> bool:
        """删除预约（只能删除待审批状态的）"""
        cursor = self.db.cursor()
        
        # 检查状态
        cursor.execute('SELECT status FROM bookings WHERE id = ?', (booking_id,))
        row = cursor.fetchone()
        
        if not row or row['status'] != 'pending':
            return False
        
        # 删除相关记录
        cursor.execute('DELETE FROM booking_items WHERE booking_id = ?', (booking_id,))
        cursor.execute('DELETE FROM bookings WHERE id = ?', (booking_id,))
        
        self.db.commit()
        return True
    
    def update_status(self, booking_id: int, status: str) -> bool:
        """更新预约状态"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            UPDATE bookings
            SET status = ?
            WHERE id = ?
        ''', (status, booking_id))
        
        self.db.commit()
        return cursor.rowcount > 0
    
    def collect_reagents(self, booking_id: int, collector_name: str, 
                         issued_quantities: Dict[int, float]) -> bool:
        """领用试剂"""
        cursor = self.db.cursor()
        
        # 更新预约状态
        cursor.execute('''
            UPDATE bookings
            SET status = 'collected'
            WHERE id = ?
        ''', (booking_id,))
        
        # 更新每个项目的实际发放数量
        for item_id, quantity in issued_quantities.items():
            cursor.execute('''
                UPDATE booking_items
                SET issued_quantity = ?
                WHERE id = ?
            ''', (quantity, item_id))
            
            # 减少库存
            cursor.execute('''
                UPDATE reagents r
                JOIN booking_items bi ON r.id = bi.reagent_id
                SET r.available_quantity = r.available_quantity - ?
                WHERE bi.id = ?
            ''', (quantity, item_id))
        
        # 记录领用
        cursor.execute('''
            INSERT INTO collections (booking_id, collector_name)
            VALUES (?, ?)
        ''', (booking_id, collector_name))
        
        self.db.commit()
        return True
    
    def return_reagents(self, booking_id: int, returner_name: str,
                        returned_items: List[Dict]) -> bool:
        """归还试剂"""
        cursor = self.db.cursor()
        
        # 记录归还主表
        cursor.execute('''
            INSERT INTO returns (booking_id, returner_name)
            VALUES (?, ?)
        ''', (booking_id, returner_name))
        
        return_id = cursor.lastrowid
        
        # 检查是否全部归还
        all_returned = True
        
        for item in returned_items:
            booking_item_id = item.get('booking_item_id')
            returned_quantity = item.get('returned_quantity', 0)
            
            # 记录归还明细
            cursor.execute('''
                INSERT INTO return_items 
                (return_id, booking_item_id, returned_quantity, condition, remarks)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                return_id,
                booking_item_id,
                returned_quantity,
                item.get('condition'),
                item.get('remarks')
            ))
            
            # 更新预约项目的归还数量
            cursor.execute('''
                UPDATE booking_items
                SET returned_quantity = returned_quantity + ?
                WHERE id = ?
            ''', (returned_quantity, booking_item_id))
            
            # 增加库存
            cursor.execute('''
                UPDATE reagents r
                JOIN booking_items bi ON r.id = bi.reagent_id
                SET r.available_quantity = r.available_quantity + ?
                WHERE bi.id = ?
            ''', (returned_quantity, booking_item_id))
            
            # 检查是否全部归还
            cursor.execute('''
                SELECT issued_quantity, returned_quantity 
                FROM booking_items 
                WHERE id = ?
            ''', (booking_item_id,))
            
            bi = cursor.fetchone()
            if bi and bi['returned_quantity'] < bi['issued_quantity']:
                all_returned = False
        
        # 更新预约状态
        if all_returned:
            cursor.execute('''
                UPDATE bookings
                SET status = 'returned'
                WHERE id = ?
            ''', (booking_id,))
        else:
            cursor.execute('''
                UPDATE bookings
                SET status = 'partial_returned'
                WHERE id = ?
            ''', (booking_id,))
        
        self.db.commit()
        return True
    
    def get_all_classes(self) -> List[Dict]:
        """获取所有班级"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT c.*, c.grade || c.class_number as full_name
            FROM classes c
            ORDER BY c.grade, c.class_number
        ''')
        
        return [dict(row) for row in cursor.fetchall()]
    
    def add_class(self, class_data: Dict) -> int:
        """添加班级"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            INSERT INTO classes (grade, class_number, student_count, teacher_name, remarks)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            class_data.get('grade'),
            class_data.get('class_number'),
            class_data.get('student_count', 0),
            class_data.get('teacher_name'),
            class_data.get('remarks')
        ))
        
        self.db.commit()
        return cursor.lastrowid
    
    def get_bookings_by_date(self, start_date: date, end_date: date) -> List[Dict]:
        """按日期范围获取预约"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT b.*, 
                   c.grade || c.class_number as class_name
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
            WHERE b.experiment_date BETWEEN ? AND ?
            ORDER BY b.experiment_date, b.created_at
        ''', (start_date.isoformat(), end_date.isoformat()))
        
        return [dict(row) for row in cursor.fetchall()]
