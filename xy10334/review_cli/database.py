import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Any


class Database:
    ATTRIBUTIONS = {
        "kitchen_slow": "厨房慢",
        "delivery_slow": "配送慢",
        "missing_item": "漏餐",
        "taste_issue": "口味问题",
        "service_issue": "客服处理不当",
        "pending": "待复核",
    }

    SOURCES = {
        "auto": "自动归因",
        "manual": "人工改判",
    }

    def __init__(self, db_path: str = "review.db"):
        self.db_path = db_path
        self._ensure_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_db(self) -> None:
        conn = self._get_conn()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                order_id TEXT PRIMARY KEY,
                platform TEXT NOT NULL,
                store_name TEXT NOT NULL,
                order_time DATETIME NOT NULL,
                order_amount REAL NOT NULL DEFAULT 0,
                items TEXT,
                customer_name TEXT,
                customer_phone TEXT,
                address TEXT,
                kitchen_start_time DATETIME,
                kitchen_finish_time DATETIME,
                kitchen_duration_seconds INTEGER,
                rider_pickup_time DATETIME,
                delivery_arrive_time DATETIME,
                delivery_duration_seconds INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                review_id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                rating INTEGER NOT NULL,
                review_time DATETIME NOT NULL,
                review_content TEXT,
                is_negative BOOLEAN NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(order_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS compensations (
                compensation_id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                compensation_time DATETIME NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                reason TEXT,
                handler TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(order_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attributions (
                attribution_id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                category TEXT NOT NULL,
                source TEXT NOT NULL,
                reason TEXT,
                evidence TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(order_id)
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_orders_order_time ON orders(order_time)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_attributions_category ON attributions(category)
        """)

        conn.commit()
        conn.close()

    def insert_order(self, order_data: Dict[str, Any]) -> bool:
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO orders 
                (order_id, platform, store_name, order_time, order_amount, items, 
                 customer_name, customer_phone, address, kitchen_start_time, 
                 kitchen_finish_time, kitchen_duration_seconds, rider_pickup_time,
                 delivery_arrive_time, delivery_duration_seconds)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                order_data['order_id'],
                order_data['platform'],
                order_data['store_name'],
                order_data['order_time'],
                order_data.get('order_amount', 0),
                order_data.get('items'),
                order_data.get('customer_name'),
                order_data.get('customer_phone'),
                order_data.get('address'),
                order_data.get('kitchen_start_time'),
                order_data.get('kitchen_finish_time'),
                order_data.get('kitchen_duration_seconds'),
                order_data.get('rider_pickup_time'),
                order_data.get('delivery_arrive_time'),
                order_data.get('delivery_duration_seconds'),
            ))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error inserting order: {e}")
            return False
        finally:
            conn.close()

    def insert_review(self, review_data: Dict[str, Any]) -> bool:
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            is_negative = review_data['rating'] <= 2
            cursor.execute("""
                INSERT OR REPLACE INTO reviews 
                (order_id, rating, review_time, review_content, is_negative)
                VALUES (?, ?, ?, ?, ?)
            """, (
                review_data['order_id'],
                review_data['rating'],
                review_data['review_time'],
                review_data.get('review_content'),
                is_negative,
            ))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error inserting review: {e}")
            return False
        finally:
            conn.close()

    def insert_compensation(self, comp_data: Dict[str, Any]) -> bool:
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO compensations 
                (order_id, compensation_time, amount, reason, handler)
                VALUES (?, ?, ?, ?, ?)
            """, (
                comp_data['order_id'],
                comp_data['compensation_time'],
                comp_data.get('amount', 0),
                comp_data.get('reason'),
                comp_data.get('handler'),
            ))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error inserting compensation: {e}")
            return False
        finally:
            conn.close()

    def get_negative_orders(self, start_date: Optional[str] = None, 
                            end_date: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        cursor = conn.cursor()

        query = """
            SELECT 
                o.order_id, o.platform, o.store_name, o.order_time, o.order_amount,
                o.kitchen_start_time, o.kitchen_finish_time, o.kitchen_duration_seconds,
                o.rider_pickup_time, o.delivery_arrive_time, o.delivery_duration_seconds,
                r.rating, r.review_time, r.review_content,
                c.amount as compensation_amount, c.reason as compensation_reason,
                a.category, a.source, a.reason as attribution_reason, a.evidence
            FROM orders o
            LEFT JOIN reviews r ON o.order_id = r.order_id
            LEFT JOIN compensations c ON o.order_id = c.order_id
            LEFT JOIN attributions a ON o.order_id = a.order_id
            WHERE r.is_negative = 1
        """
        params = []
        if start_date:
            query += " AND date(o.order_time) >= ?"
            params.append(start_date)
        if end_date:
            query += " AND date(o.order_time) <= ?"
            params.append(end_date)
        query += " ORDER BY o.order_time DESC"

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def get_order_detail(self, order_id: str) -> Optional[Dict[str, Any]]:
        conn = self._get_conn()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                o.order_id, o.platform, o.store_name, o.order_time, o.order_amount,
                o.items, o.customer_name, o.address,
                o.kitchen_start_time, o.kitchen_finish_time, o.kitchen_duration_seconds,
                o.rider_pickup_time, o.delivery_arrive_time, o.delivery_duration_seconds,
                r.rating, r.review_time, r.review_content,
                c.amount as compensation_amount, c.reason as compensation_reason,
                a.category, a.source, a.reason as attribution_reason, a.evidence
            FROM orders o
            LEFT JOIN reviews r ON o.order_id = r.order_id
            LEFT JOIN compensations c ON o.order_id = c.order_id
            LEFT JOIN attributions a ON o.order_id = a.order_id
            WHERE o.order_id = ?
        """, (order_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def save_attribution(self, order_id: str, category: str, source: str,
                         reason: str, evidence: str) -> bool:
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO attributions 
                (order_id, category, source, reason, evidence, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (order_id, category, source, reason, evidence))
            conn.commit()
            return True
        except Exception as e:
            print(f"Error saving attribution: {e}")
            return False
        finally:
            conn.close()

    def get_pending_orders(self) -> List[Dict[str, Any]]:
        conn = self._get_conn()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                o.order_id, o.platform, o.store_name, o.order_time,
                r.rating, r.review_content,
                c.amount as compensation_amount,
                a.category, a.reason as attribution_reason, a.evidence
            FROM orders o
            LEFT JOIN reviews r ON o.order_id = r.order_id
            LEFT JOIN compensations c ON o.order_id = c.order_id
            LEFT JOIN attributions a ON o.order_id = a.order_id
            WHERE r.is_negative = 1 AND (a.category IS NULL OR a.category = 'pending')
            ORDER BY o.order_time DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def get_statistics(self, start_date: Optional[str] = None,
                       end_date: Optional[str] = None) -> Dict[str, Any]:
        conn = self._get_conn()
        cursor = conn.cursor()

        where_clause = "WHERE r.is_negative = 1"
        params = []
        if start_date and end_date:
            where_clause += " AND date(o.order_time) BETWEEN ? AND ?"
            params.extend([start_date, end_date])
        elif start_date:
            where_clause += " AND date(o.order_time) >= ?"
            params.append(start_date)
        elif end_date:
            where_clause += " AND date(o.order_time) <= ?"
            params.append(end_date)

        cursor.execute(f"""
            SELECT 
                COUNT(DISTINCT o.order_id) as total_negative,
                COUNT(DISTINCT CASE WHEN a.category = 'kitchen_slow' THEN o.order_id END) as kitchen_slow_count,
                COUNT(DISTINCT CASE WHEN a.category = 'delivery_slow' THEN o.order_id END) as delivery_slow_count,
                COUNT(DISTINCT CASE WHEN a.category = 'missing_item' THEN o.order_id END) as missing_item_count,
                COUNT(DISTINCT CASE WHEN a.category = 'taste_issue' THEN o.order_id END) as taste_issue_count,
                COUNT(DISTINCT CASE WHEN a.category = 'service_issue' THEN o.order_id END) as service_issue_count,
                COUNT(DISTINCT CASE WHEN a.category = 'pending' OR a.category IS NULL THEN o.order_id END) as pending_count,
                COALESCE(SUM(c.amount), 0) as total_compensation
            FROM orders o
            INNER JOIN reviews r ON o.order_id = r.order_id
            LEFT JOIN compensations c ON o.order_id = c.order_id
            LEFT JOIN attributions a ON o.order_id = a.order_id
            {where_clause}
        """, params)
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else {}
