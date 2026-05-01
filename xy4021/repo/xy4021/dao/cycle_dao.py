from typing import List, Optional, Dict
from datetime import datetime
from database.connection import DatabaseConnection
from business.state_machine import (
    PackageStatus, CycleStatus, IndicatorResult,
    StateMachine, StateTransitionError, BusinessRuleError, BusinessRules
)
from dao.package_dao import PackageDAO


class CycleDAO:
    @staticmethod
    def create(
        cycle_number: str,
        autoclave_id: str,
        operator: str,
        start_time: str = None,
        temperature: float = None,
        pressure: float = None,
        notes: str = None
    ) -> int:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            cursor.execute('''
                INSERT INTO cycles (
                    cycle_number, autoclave_id, operator, start_time,
                    temperature, pressure, status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                cycle_number, autoclave_id, operator, start_time,
                temperature, pressure, CycleStatus.IN_PROGRESS.value, notes
            ))
            return cursor.lastrowid

    @staticmethod
    def get_all() -> List[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, cycle_number, autoclave_id, start_time, end_time,
                       operator, temperature, pressure, biological_indicator,
                       chemical_indicator, status, failure_reason, notes,
                       created_at, updated_at
                FROM cycles
                ORDER BY created_at DESC
            ''')
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def get_by_id(cycle_id: int) -> Optional[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, cycle_number, autoclave_id, start_time, end_time,
                       operator, temperature, pressure, biological_indicator,
                       chemical_indicator, status, failure_reason, notes,
                       created_at, updated_at
                FROM cycles
                WHERE id = ?
            ''', (cycle_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_number(cycle_number: str) -> Optional[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, cycle_number, autoclave_id, start_time, end_time,
                       operator, temperature, pressure, biological_indicator,
                       chemical_indicator, status, failure_reason, notes,
                       created_at, updated_at
                FROM cycles
                WHERE cycle_number = ?
            ''', (cycle_number,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_status(status: str) -> List[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, cycle_number, autoclave_id, start_time, end_time,
                       operator, temperature, pressure, biological_indicator,
                       chemical_indicator, status, failure_reason, notes,
                       created_at, updated_at
                FROM cycles
                WHERE status = ?
                ORDER BY created_at DESC
            ''', (status,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def get_active_cycles() -> List[Dict]:
        return CycleDAO.get_by_status(CycleStatus.IN_PROGRESS.value)

    @staticmethod
    def update(
        cycle_id: int,
        end_time: str = None,
        temperature: float = None,
        pressure: float = None,
        biological_indicator: str = None,
        chemical_indicator: str = None,
        notes: str = None
    ) -> bool:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            updates = []
            params = []
            
            if end_time is not None:
                updates.append('end_time = ?')
                params.append(end_time)
            if temperature is not None:
                updates.append('temperature = ?')
                params.append(temperature)
            if pressure is not None:
                updates.append('pressure = ?')
                params.append(pressure)
            if biological_indicator is not None:
                updates.append('biological_indicator = ?')
                params.append(biological_indicator)
            if chemical_indicator is not None:
                updates.append('chemical_indicator = ?')
                params.append(chemical_indicator)
            if notes is not None:
                updates.append('notes = ?')
                params.append(notes)
            
            if not updates:
                return False
            
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(cycle_id)
            
            cursor.execute(f'''
                UPDATE cycles
                SET {', '.join(updates)}
                WHERE id = ?
            ''', params)
            return cursor.rowcount > 0

    @staticmethod
    def complete_cycle(
        cycle_id: int,
        biological_indicator: str,
        chemical_indicator: str,
        operator: str = None
    ) -> bool:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            cursor.execute('SELECT status FROM cycles WHERE id = ?', (cycle_id,))
            row = cursor.fetchone()
            if not row or row['status'] != CycleStatus.IN_PROGRESS.value:
                raise BusinessRuleError('只有进行中的锅次可以完成')
            
            cursor.execute('''
                UPDATE cycles
                SET status = ?, 
                    biological_indicator = ?,
                    chemical_indicator = ?,
                    end_time = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (CycleStatus.COMPLETED.value, biological_indicator, chemical_indicator, cycle_id))
            
            packages = PackageDAO.get_by_cycle(cycle_id)
            for pkg in packages:
                PackageDAO.update_status(
                    package_id=pkg['id'],
                    new_status=PackageStatus.PENDING_RELEASE.value,
                    cycle_id=cycle_id,
                    operator=operator,
                    reason='灭菌完成，待放行'
                )
            
            return True

    @staticmethod
    def fail_cycle(
        cycle_id: int,
        failure_reason: str,
        operator: str = None
    ) -> bool:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            cursor.execute('SELECT status FROM cycles WHERE id = ?', (cycle_id,))
            row = cursor.fetchone()
            if not row:
                return False
            
            cursor.execute('''
                UPDATE cycles
                SET status = ?, failure_reason = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (CycleStatus.FAILED.value, failure_reason, cycle_id))
            
            packages = PackageDAO.get_by_cycle(cycle_id)
            isolated_count = 0
            
            for pkg in packages:
                if BusinessRules.validate_cycle_failure_packages(pkg['status'], pkg['id']):
                    PackageDAO.mark_as_isolated(
                        package_id=pkg['id'],
                        cycle_id=cycle_id,
                        operator=operator,
                        reason=f'锅次失败隔离: {failure_reason}'
                    )
                    isolated_count += 1
            
            return True

    @staticmethod
    def release_packages(
        cycle_id: int,
        operator: str = None
    ) -> int:
        cycle = CycleDAO.get_by_id(cycle_id)
        if not cycle:
            raise BusinessRuleError('锅次不存在')
        
        if cycle['status'] != CycleStatus.COMPLETED.value:
            raise BusinessRuleError('只有已完成的锅次可以放行')
        
        BusinessRules.validate_release(
            cycle['biological_indicator'],
            cycle['chemical_indicator']
        )
        
        packages = PackageDAO.get_by_cycle(cycle_id)
        released_count = 0
        
        for pkg in packages:
            if pkg['status'] == PackageStatus.PENDING_RELEASE.value:
                PackageDAO.update_status(
                    package_id=pkg['id'],
                    new_status=PackageStatus.RELEASED.value,
                    cycle_id=None,
                    operator=operator,
                    reason='放行'
                )
                released_count += 1
        
        return released_count

    @staticmethod
    def get_cycle_packages_history(cycle_id: int) -> List[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT cp.id, cp.cycle_id, cp.package_id, cp.added_at,
                       cp.removed_at, cp.status_at_removal, cp.removal_reason,
                       p.package_number, p.status, t.name as template_name
                FROM cycle_packages cp
                JOIN packages p ON cp.package_id = p.id
                JOIN package_templates t ON p.template_id = t.id
                WHERE cp.cycle_id = ?
                ORDER BY cp.added_at
            ''', (cycle_id,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def generate_cycle_number() -> str:
        now = datetime.now()
        date_str = now.strftime('%Y%m%d')
        
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT cycle_number FROM cycles
                WHERE cycle_number LIKE ?
                ORDER BY cycle_number DESC
                LIMIT 1
            ''', (f'{date_str}%',))
            
            row = cursor.fetchone()
            if row:
                last_num = int(row['cycle_number'][-3:])
                new_num = last_num + 1
            else:
                new_num = 1
            
            return f'{date_str}{new_num:03d}'
