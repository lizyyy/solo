"""
数据模型模块 - 定义各个业务实体的CRUD操作
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .database import Database


class RoomManager:
    """房间管理"""
    
    def __init__(self, db: Database):
        self.db = db
    
    def add_room(self, room_number: str, name: str, floor: int = 1, 
                 max_guests: int = 2) -> int:
        """添加房间（支持幂等，重复房间号则返回现有ID）"""
        existing = self.db.query_one(
            "SELECT id FROM rooms WHERE room_number = ?", 
            (room_number,)
        )
        if existing:
            return existing['id']
        
        cursor = self.db.execute(
            '''INSERT INTO rooms (room_number, name, floor, max_guests)
               VALUES (?, ?, ?, ?)''',
            (room_number, name, floor, max_guests)
        )
        return cursor.lastrowid
    
    def list_rooms(self) -> List[Dict]:
        """列出所有房间"""
        rows = self.db.query('''
            SELECT r.*, COUNT(s.id) as stove_count
            FROM rooms r
            LEFT JOIN stoves s ON r.id = s.room_id AND s.is_active = 1
            GROUP BY r.id
            ORDER BY r.room_number
        ''')
        return [dict(row) for row in rows]
    
    def get_room(self, room_id: int) -> Optional[Dict]:
        """获取单个房间"""
        row = self.db.query_one(
            "SELECT * FROM rooms WHERE id = ?", 
            (room_id,)
        )
        return dict(row) if row else None
    
    def get_room_by_number(self, room_number: str) -> Optional[Dict]:
        """通过房间号获取房间"""
        row = self.db.query_one(
            "SELECT * FROM rooms WHERE room_number = ?", 
            (room_number,)
        )
        return dict(row) if row else None


class StoveManager:
    """炉具管理 - 不同炉具消耗不同"""
    
    # 炉具类型默认日消耗量（公斤）
    STOVE_TYPE_CONSUMPTION = {
        '土炕': 4.0,      # 传统土炕，持续燃烧但效率高
        '壁炉': 6.0,      # 装饰性壁炉，消耗大
        '火炉': 5.0,      # 普通火炉
        '暖墙': 3.5,      # 暖墙系统，效率较高
        '地暖': 7.0,      # 柴火地暖，消耗大但温暖
    }
    
    def __init__(self, db: Database):
        self.db = db
    
    def add_stove(self, room_id: int, stove_type: str, 
                  daily_consumption_kg: float = None,
                  model: str = None, installed_date: str = None) -> int:
        """添加炉具（支持幂等）"""
        if daily_consumption_kg is None:
            daily_consumption_kg = self.STOVE_TYPE_CONSUMPTION.get(
                stove_type, 5.0
            )
        
        # 检查是否已存在
        existing = self.db.query_one(
            '''SELECT id FROM stoves 
               WHERE room_id = ? AND stove_type = ?''',
            (room_id, stove_type)
        )
        if existing:
            # 更新消耗量
            self.db.execute(
                '''UPDATE stoves 
                   SET daily_consumption_kg = ?, is_active = 1
                   WHERE id = ?''',
                (daily_consumption_kg, existing['id'])
            )
            return existing['id']
        
        cursor = self.db.execute(
            '''INSERT INTO stoves 
               (room_id, stove_type, model, daily_consumption_kg, installed_date)
               VALUES (?, ?, ?, ?, ?)''',
            (room_id, stove_type, model, daily_consumption_kg, installed_date)
        )
        return cursor.lastrowid
    
    def list_stoves(self, room_id: int = None) -> List[Dict]:
        """列出炉具"""
        if room_id:
            rows = self.db.query(
                '''SELECT s.*, r.room_number, r.name as room_name
                   FROM stoves s
                   JOIN rooms r ON s.room_id = r.id
                   WHERE s.room_id = ? AND s.is_active = 1
                   ORDER BY s.stove_type''',
                (room_id,)
            )
        else:
            rows = self.db.query('''
                SELECT s.*, r.room_number, r.name as room_name
                FROM stoves s
                JOIN rooms r ON s.room_id = r.id
                WHERE s.is_active = 1
                ORDER BY r.room_number, s.stove_type
            ''')
        return [dict(row) for row in rows]
    
    def get_room_stoves(self, room_id: int) -> List[Dict]:
        """获取房间的所有活动炉具"""
        rows = self.db.query(
            '''SELECT * FROM stoves 
               WHERE room_id = ? AND is_active = 1''',
            (room_id,)
        )
        return [dict(row) for row in rows]


class StayManager:
    """入住记录管理"""
    
    def __init__(self, db: Database):
        self.db = db
    
    def add_stay(self, stay_code: str, room_id: int, check_in_date: str,
                 check_out_date: str = None, guest_name: str = None,
                 guest_count: int = 1, status: str = 'checked_in') -> Dict:
        """
        添加入住记录
        处理状态冲突：已退房的记录不能再修改为在住
        """
        existing = self.db.query_one(
            "SELECT * FROM stays WHERE stay_code = ?",
            (stay_code,)
        )
        
        if existing:
            # 状态冲突检查
            if existing['status'] == 'checked_out' and status == 'checked_in':
                raise ValueError(
                    f"入住记录 {stay_code} 已退房，不能重新标记为在住"
                )
            
            # 更新现有记录
            self.db.execute(
                '''UPDATE stays 
                   SET check_out_date = ?, guest_name = ?, 
                       guest_count = ?, status = ?
                   WHERE stay_code = ?''',
                (check_out_date, guest_name, guest_count, status, stay_code)
            )
            return self._get_stay_by_code(stay_code)
        
        cursor = self.db.execute(
            '''INSERT INTO stays 
               (stay_code, room_id, check_in_date, check_out_date, 
                guest_name, guest_count, status)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (stay_code, room_id, check_in_date, check_out_date, 
             guest_name, guest_count, status)
        )
        
        return self._get_stay_by_code(stay_code)
    
    def _get_stay_by_code(self, stay_code: str) -> Optional[Dict]:
        row = self.db.query_one(
            '''SELECT s.*, r.room_number, r.name as room_name
               FROM stays s
               JOIN rooms r ON s.room_id = r.id
               WHERE s.stay_code = ?''',
            (stay_code,)
        )
        return dict(row) if row else None
    
    def list_stays(self, status: str = None, 
                   start_date: str = None, end_date: str = None) -> List[Dict]:
        """列出入住记录"""
        query = '''
            SELECT s.*, r.room_number, r.name as room_name
            FROM stays s
            JOIN rooms r ON s.room_id = r.id
            WHERE 1=1
        '''
        params = []
        
        if status:
            query += " AND s.status = ?"
            params.append(status)
        
        if start_date:
            query += " AND s.check_in_date >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND s.check_in_date <= ?"
            params.append(end_date)
        
        query += " ORDER BY s.check_in_date DESC"
        
        rows = self.db.query(query, tuple(params) if params else None)
        return [dict(row) for row in rows]
    
    def get_stay(self, stay_id: int) -> Optional[Dict]:
        """获取单个入住记录"""
        row = self.db.query_one(
            '''SELECT s.*, r.room_number, r.name as room_name
               FROM stays s
               JOIN rooms r ON s.room_id = r.id
               WHERE s.id = ?''',
            (stay_id,)
        )
        return dict(row) if row else None


class FirewoodInManager:
    """柴火入库管理"""
    
    def __init__(self, db: Database):
        self.db = db
    
    def add_firewood(self, batch_code: str, delivery_date: str, 
                     weight_kg: float, wood_type: str = None,
                     supplier: str = None, unit_price: float = None,
                     notes: str = None) -> Dict:
        """
        添加柴火入库
        支持重复导入：同批次号则更新
        """
        existing = self.db.query_one(
            "SELECT * FROM firewood_in WHERE batch_code = ?",
            (batch_code,)
        )
        
        total_cost = unit_price * weight_kg if unit_price and weight_kg else None
        
        if existing:
            # 更新现有记录
            self.db.execute(
                '''UPDATE firewood_in 
                   SET delivery_date = ?, weight_kg = ?, wood_type = ?,
                       supplier = ?, unit_price = ?, total_cost = ?, notes = ?
                   WHERE batch_code = ?''',
                (delivery_date, weight_kg, wood_type, supplier,
                 unit_price, total_cost, notes, batch_code)
            )
            return self._get_firewood_by_code(batch_code)
        
        cursor = self.db.execute(
            '''INSERT INTO firewood_in 
               (batch_code, delivery_date, weight_kg, wood_type, supplier,
                unit_price, total_cost, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (batch_code, delivery_date, weight_kg, wood_type, supplier,
             unit_price, total_cost, notes)
        )
        
        return self._get_firewood_by_code(batch_code)
    
    def _get_firewood_by_code(self, batch_code: str) -> Optional[Dict]:
        row = self.db.query_one(
            "SELECT * FROM firewood_in WHERE batch_code = ?",
            (batch_code,)
        )
        return dict(row) if row else None
    
    def list_firewood(self, start_date: str = None, 
                      end_date: str = None) -> List[Dict]:
        """列出入库记录"""
        query = "SELECT * FROM firewood_in WHERE 1=1"
        params = []
        
        if start_date:
            query += " AND delivery_date >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND delivery_date <= ?"
            params.append(end_date)
        
        query += " ORDER BY delivery_date DESC"
        
        rows = self.db.query(query, tuple(params) if params else None)
        return [dict(row) for row in rows]
    
    def get_total_in(self, start_date: str = None, 
                     end_date: str = None) -> float:
        """获取总入库量"""
        query = "SELECT SUM(weight_kg) as total FROM firewood_in WHERE 1=1"
        params = []
        
        if start_date:
            query += " AND delivery_date >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND delivery_date <= ?"
            params.append(end_date)
        
        row = self.db.query_one(query, tuple(params) if params else None)
        return row['total'] or 0.0
