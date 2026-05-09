import sqlite3
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from .models import RiskResult, Route


class Storage:
    def __init__(self, db_path: str = 'data/simulations.db'):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS simulations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                simulation_id TEXT UNIQUE,
                route_id TEXT,
                simulation_timestamp TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS risk_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                simulation_id TEXT,
                order_id TEXT,
                route_id TEXT,
                risk_level TEXT,
                total_overtime_min INTEGER,
                max_temp_violation REAL,
                min_temp_violation REAL,
                triggers TEXT,
                missing_data_count INTEGER,
                missing_data_duration_min REAL,
                recommendations TEXT,
                simulation_timestamp TEXT,
                segment_details TEXT,
                FOREIGN KEY (simulation_id) REFERENCES simulations (simulation_id)
            )
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_risk_results_simulation_id 
            ON risk_results(simulation_id)
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_risk_results_order_id 
            ON risk_results(order_id)
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_risk_results_risk_level 
            ON risk_results(risk_level)
        ''')

        conn.commit()
        conn.close()

    def save_simulation(
        self,
        simulation_id: str,
        route: Route,
        results: List[RiskResult]
    ) -> bool:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            cursor.execute('''
                INSERT INTO simulations (simulation_id, route_id, simulation_timestamp)
                VALUES (?, ?, ?)
            ''', (
                simulation_id,
                route.route_id,
                results[0].simulation_timestamp.isoformat() if results else datetime.now().isoformat()
            ))

            for result in results:
                cursor.execute('''
                    INSERT INTO risk_results (
                        simulation_id, order_id, route_id, risk_level,
                        total_overtime_min, max_temp_violation, min_temp_violation,
                        triggers, missing_data_count, missing_data_duration_min,
                        recommendations, simulation_timestamp, segment_details
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    simulation_id,
                    result.order_id,
                    result.route_id,
                    result.risk_level,
                    result.total_overtime_min,
                    result.max_temp_violation,
                    result.min_temp_violation,
                    json.dumps(result.triggers, ensure_ascii=False),
                    result.missing_data_count,
                    result.missing_data_duration_min,
                    json.dumps(result.recommendations, ensure_ascii=False),
                    result.simulation_timestamp.isoformat(),
                    json.dumps(self._serialize_segment_details(result.segment_details), ensure_ascii=False)
                ))

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            print(f"保存失败: {e}")
            return False
        finally:
            conn.close()

    def _serialize_segment_details(self, details: List[Dict]) -> List[Dict]:
        serialized = []
        for detail in details:
            s = {}
            for key, value in detail.items():
                if isinstance(value, datetime):
                    s[key] = value.isoformat()
                elif isinstance(value, list):
                    s[key] = self._serialize_segment_details(value) if value and isinstance(value[0], dict) else value
                else:
                    s[key] = value
            serialized.append(s)
        return serialized

    def get_simulation(self, simulation_id: str) -> Optional[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM simulations WHERE simulation_id = ?
        ''', (simulation_id,))
        sim_row = cursor.fetchone()

        if not sim_row:
            conn.close()
            return None

        cursor.execute('''
            SELECT * FROM risk_results WHERE simulation_id = ?
        ''', (simulation_id,))
        result_rows = cursor.fetchall()

        conn.close()

        results = []
        for row in result_rows:
            results.append({
                'order_id': row[2],
                'route_id': row[3],
                'risk_level': row[4],
                'total_overtime_min': row[5],
                'max_temp_violation': row[6],
                'min_temp_violation': row[7],
                'triggers': json.loads(row[8]),
                'missing_data_count': row[9],
                'missing_data_duration_min': row[10],
                'recommendations': json.loads(row[11]),
                'simulation_timestamp': row[12],
                'segment_details': json.loads(row[13])
            })

        return {
            'simulation_id': sim_row[1],
            'route_id': sim_row[2],
            'simulation_timestamp': sim_row[3],
            'created_at': sim_row[4],
            'results': results
        }

    def list_simulations(self, limit: int = 100) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT s.simulation_id, s.route_id, s.simulation_timestamp, s.created_at,
                   COUNT(r.id) as order_count,
                   SUM(CASE WHEN r.risk_level = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
                   SUM(CASE WHEN r.risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_count,
                   SUM(CASE WHEN r.risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_count,
                   SUM(CASE WHEN r.risk_level = 'LOW' THEN 1 ELSE 0 END) as low_count,
                   SUM(CASE WHEN r.risk_level = 'NONE' THEN 1 ELSE 0 END) as none_count
            FROM simulations s
            LEFT JOIN risk_results r ON s.simulation_id = r.simulation_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT ?
        ''', (limit,))

        rows = cursor.fetchall()
        conn.close()

        return [
            {
                'simulation_id': row[0],
                'route_id': row[1],
                'simulation_timestamp': row[2],
                'created_at': row[3],
                'order_count': row[4],
                'critical_count': row[5],
                'high_count': row[6],
                'medium_count': row[7],
                'low_count': row[8],
                'none_count': row[9]
            }
            for row in rows
        ]

    def get_order_history(self, order_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT r.*, s.route_id, s.simulation_timestamp, s.created_at
            FROM risk_results r
            JOIN simulations s ON r.simulation_id = s.simulation_id
            WHERE r.order_id = ?
            ORDER BY s.created_at DESC
            LIMIT ?
        ''', (order_id, limit))

        rows = cursor.fetchall()
        conn.close()

        return [
            {
                'simulation_id': row[1],
                'order_id': row[2],
                'route_id': row[3],
                'risk_level': row[4],
                'total_overtime_min': row[5],
                'max_temp_violation': row[6],
                'min_temp_violation': row[7],
                'triggers': json.loads(row[8]),
                'missing_data_count': row[9],
                'missing_data_duration_min': row[10],
                'recommendations': json.loads(row[11]),
                'simulation_timestamp': row[12],
                'created_at': row[16]
            }
            for row in rows
        ]

    def delete_simulation(self, simulation_id: str) -> bool:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            cursor.execute('''
                DELETE FROM risk_results WHERE simulation_id = ?
            ''', (simulation_id,))

            cursor.execute('''
                DELETE FROM simulations WHERE simulation_id = ?
            ''', (simulation_id,))

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            print(f"删除失败: {e}")
            return False
        finally:
            conn.close()
