from typing import List, Optional, Dict
from datetime import datetime
from database.connection import DatabaseConnection
from business.state_machine import PackageStatus, StateMachine, StateTransitionError, BusinessRuleError, BusinessRules


class PackageDAO:
    @staticmethod
    def create(template_id: int, package_number: str, notes: str = None) -> int:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            cursor.execute('''
                INSERT INTO packages (template_id, package_number, status, notes)
                VALUES (?, ?, ?, ?)
            ''', (template_id, package_number, PackageStatus.PENDING_STERILIZATION.value, notes))
            
            package_id = cursor.lastrowid
            
            cursor.execute('''
                INSERT INTO status_history (package_id, from_status, to_status, reason)
                VALUES (?, ?, ?, ?)
            ''', (package_id, None, PackageStatus.PENDING_STERILIZATION.value, '新建器械包'))
            
            return package_id

    @staticmethod
    def get_all() -> List[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.id, p.template_id, p.package_number, p.status, 
                       p.current_cycle_id, p.notes, p.created_at, p.updated_at,
                       t.name as template_name
                FROM packages p
                JOIN package_templates t ON p.template_id = t.id
                ORDER BY p.created_at DESC
            ''')
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def get_by_id(package_id: int) -> Optional[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.id, p.template_id, p.package_number, p.status, 
                       p.current_cycle_id, p.notes, p.created_at, p.updated_at,
                       t.name as template_name
                FROM packages p
                JOIN package_templates t ON p.template_id = t.id
                WHERE p.id = ?
            ''', (package_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_number(package_number: str) -> Optional[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.id, p.template_id, p.package_number, p.status, 
                       p.current_cycle_id, p.notes, p.created_at, p.updated_at,
                       t.name as template_name
                FROM packages p
                JOIN package_templates t ON p.template_id = t.id
                WHERE p.package_number = ?
            ''', (package_number,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_status(status: str) -> List[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.id, p.template_id, p.package_number, p.status, 
                       p.current_cycle_id, p.notes, p.created_at, p.updated_at,
                       t.name as template_name
                FROM packages p
                JOIN package_templates t ON p.template_id = t.id
                WHERE p.status = ?
                ORDER BY p.created_at DESC
            ''', (status,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def get_by_cycle(cycle_id: int) -> List[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.id, p.template_id, p.package_number, p.status, 
                       p.current_cycle_id, p.notes, p.created_at, p.updated_at,
                       t.name as template_name, cp.added_at
                FROM packages p
                JOIN package_templates t ON p.template_id = t.id
                JOIN cycle_packages cp ON p.id = cp.package_id
                WHERE cp.cycle_id = ? AND cp.removed_at IS NULL
                ORDER BY cp.added_at
            ''', (cycle_id,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def update_status(
        package_id: int,
        new_status: str,
        cycle_id: int = None,
        operator: str = None,
        reason: str = None,
        notes: str = None
    ) -> bool:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            cursor.execute('SELECT status, current_cycle_id FROM packages WHERE id = ?', (package_id,))
            row = cursor.fetchone()
            if not row:
                return False
            
            current_status = row['status']
            current_cycle_id = row['current_cycle_id']
            
            StateMachine.validate_transition(current_status, new_status)
            
            cursor.execute('''
                UPDATE packages
                SET status = ?, current_cycle_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (new_status, cycle_id, package_id))
            
            cursor.execute('''
                INSERT INTO status_history 
                (package_id, cycle_id, from_status, to_status, operator, reason, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (package_id, cycle_id, current_status, new_status, operator, reason, notes))
            
            return cursor.rowcount > 0

    @staticmethod
    def add_to_cycle(package_id: int, cycle_id: int, operator: str = None) -> bool:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            cursor.execute('SELECT status, current_cycle_id FROM packages WHERE id = ?', (package_id,))
            row = cursor.fetchone()
            if not row:
                return False
            
            current_status = row['status']
            current_cycle_id = row['current_cycle_id']
            
            BusinessRules.validate_package_in_active_cycle(current_status, current_cycle_id)
            
            if not BusinessRules.can_add_to_cycle(current_status):
                raise BusinessRuleError(f'当前状态"{current_status}"的器械包不能加入锅次')
            
            cursor.execute('''
                INSERT INTO cycle_packages (cycle_id, package_id)
                VALUES (?, ?)
            ''', (cycle_id, package_id))
            
            cursor.execute('''
                UPDATE packages
                SET status = ?, current_cycle_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (PackageStatus.IN_STERILIZATION.value, cycle_id, package_id))
            
            cursor.execute('''
                INSERT INTO status_history 
                (package_id, cycle_id, from_status, to_status, operator, reason)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (package_id, cycle_id, current_status, PackageStatus.IN_STERILIZATION.value, operator, '加入锅次'))
            
            return True

    @staticmethod
    def remove_from_cycle(package_id: int, cycle_id: int, reason: str = None, operator: str = None) -> bool:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            cursor.execute('SELECT status FROM packages WHERE id = ?', (package_id,))
            row = cursor.fetchone()
            if not row:
                return False
            
            current_status = row['status']
            
            if not BusinessRules.can_remove_from_cycle(current_status):
                raise BusinessRuleError(f'当前状态"{current_status}"的器械包不能从锅次移除')
            
            cursor.execute('''
                UPDATE cycle_packages
                SET removed_at = CURRENT_TIMESTAMP, status_at_removal = ?, removal_reason = ?
                WHERE cycle_id = ? AND package_id = ? AND removed_at IS NULL
            ''', (current_status, reason, cycle_id, package_id))
            
            new_status = PackageStatus.PENDING_STERILIZATION.value
            cursor.execute('''
                UPDATE packages
                SET status = ?, current_cycle_id = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (new_status, package_id))
            
            cursor.execute('''
                INSERT INTO status_history 
                (package_id, cycle_id, from_status, to_status, operator, reason)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (package_id, cycle_id, current_status, new_status, operator, reason or '从锅次移除'))
            
            return True

    @staticmethod
    def mark_as_used(package_id: int, operator: str = None, notes: str = None) -> bool:
        return PackageDAO.update_status(
            package_id=package_id,
            new_status=PackageStatus.USED.value,
            operator=operator,
            reason='领用',
            notes=notes
        )

    @staticmethod
    def mark_as_isolated(package_id: int, cycle_id: int = None, operator: str = None, reason: str = None) -> bool:
        return PackageDAO.update_status(
            package_id=package_id,
            new_status=PackageStatus.ISOLATED.value,
            cycle_id=cycle_id,
            operator=operator,
            reason=reason or '隔离'
        )

    @staticmethod
    def mark_as_discarded(package_id: int, operator: str = None, reason: str = None) -> bool:
        return PackageDAO.update_status(
            package_id=package_id,
            new_status=PackageStatus.DISCARDED.value,
            operator=operator,
            reason=reason or '报废'
        )

    @staticmethod
    def get_status_history(package_id: int) -> List[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT sh.id, sh.package_id, sh.cycle_id, sh.from_status, 
                       sh.to_status, sh.changed_at, sh.operator, sh.reason, sh.notes,
                       c.cycle_number
                FROM status_history sh
                LEFT JOIN cycles c ON sh.cycle_id = c.id
                WHERE sh.package_id = ?
                ORDER BY sh.changed_at DESC
            ''', (package_id,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def count_by_status() -> Dict[str, int]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT status, COUNT(*) as count
                FROM packages
                GROUP BY status
            ''')
            rows = cursor.fetchall()
            return {row['status']: row['count'] for row in rows}
