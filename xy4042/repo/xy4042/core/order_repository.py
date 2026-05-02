from datetime import datetime, date
from typing import List, Optional, Dict, Any

from models.order import Order
from models.audit_log import AuditLog
from core.base_repository import BaseRepository
from core.workflow.state_machine import StateMachine


class OrderRepository(BaseRepository[Order]):
    def __init__(self):
        super().__init__()
        self.state_machine = StateMachine()
    
    def _table_name(self) -> str:
        return "orders"
    
    def _row_to_model(self, row) -> Order:
        return Order.from_row(row)
    
    def create(self, order: Order) -> Order:
        now = datetime.now()
        sql = """
            INSERT INTO orders (
                patient_id, order_number, body_part, side, status,
                impression_date, technician, follow_up_date, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        cursor = self.db.execute(
            sql,
            (
                order.patient_id, order.order_number, order.body_part,
                order.side, order.status,
                order.impression_date, order.technician,
                order.follow_up_date, order.notes,
                now, now
            )
        )
        order.id = cursor.lastrowid
        order.created_at = now
        order.updated_at = now
        
        self._log_status_change(order.id, None, order.status, "创建订单")
        
        return order
    
    def update(self, order: Order) -> Order:
        now = datetime.now()
        sql = """
            UPDATE orders 
            SET patient_id = ?, order_number = ?, body_part = ?, side = ?, status = ?,
                impression_date = ?, technician = ?, follow_up_date = ?, notes = ?,
                updated_at = ?
            WHERE id = ?
        """
        self.db.execute(
            sql,
            (
                order.patient_id, order.order_number, order.body_part,
                order.side, order.status,
                order.impression_date, order.technician,
                order.follow_up_date, order.notes,
                now, order.id
            )
        )
        order.updated_at = now
        return order
    
    def update_status(
        self,
        order_id: int,
        new_status: str,
        reason: str = ""
    ) -> Optional[Order]:
        order = self.get_by_id(order_id)
        if not order:
            return None
        
        old_status = order.status
        order.status = new_status
        order = self.update(order)
        
        self._log_status_change(order_id, old_status, new_status, reason)
        
        return order
    
    def _log_status_change(
        self,
        order_id: int,
        old_status: Optional[str],
        new_status: str,
        reason: str
    ) -> None:
        sql = """
            INSERT INTO audit_logs (order_id, action, details, old_value, new_value)
            VALUES (?, ?, ?, ?, ?)
        """
        self.db.execute(
            sql,
            (
                order_id,
                "状态变更",
                reason or "状态更新",
                old_status,
                new_status
            )
        )
    
    def get_by_status(self, status: str) -> List[Order]:
        sql = """
            SELECT * FROM orders 
            WHERE status = ? 
            ORDER BY created_at DESC
        """
        cursor = self.db.execute(sql, (status,))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_by_patient(self, patient_id: int) -> List[Order]:
        sql = """
            SELECT * FROM orders 
            WHERE patient_id = ? 
            ORDER BY created_at DESC
        """
        cursor = self.db.execute(sql, (patient_id,))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_by_order_number(self, order_number: str) -> Optional[Order]:
        sql = "SELECT * FROM orders WHERE order_number = ?"
        cursor = self.db.execute(sql, (order_number,))
        row = cursor.fetchone()
        return self._row_to_model(row) if row else None
    
    def search(self, keyword: str) -> List[Order]:
        sql = """
            SELECT o.* FROM orders o
            LEFT JOIN patients p ON o.patient_id = p.id
            WHERE o.order_number LIKE ? 
               OR o.body_part LIKE ? 
               OR o.technician LIKE ?
               OR p.name LIKE ?
            ORDER BY o.created_at DESC
        """
        pattern = f"%{keyword}%"
        cursor = self.db.execute(sql, (pattern, pattern, pattern, pattern))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_all_order_numbers(self) -> List[str]:
        sql = "SELECT order_number FROM orders ORDER BY order_number"
        cursor = self.db.execute(sql)
        rows = cursor.fetchall()
        return [row[0] for row in rows]
    
    def get_status_counts(self) -> Dict[str, int]:
        sql = """
            SELECT status, COUNT(*) as count 
            FROM orders 
            GROUP BY status
        """
        cursor = self.db.execute(sql)
        rows = cursor.fetchall()
        result = {
            "待取模": 0, "待设计": 0, "制作中": 0,
            "待试穿": 0, "需返修": 0, "已交付": 0
        }
        for row in rows:
            result[row['status']] = row['count']
        return result
