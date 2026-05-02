from typing import List, Optional, Dict
from database.connection import DatabaseConnection


class PackageTemplateDAO:
    @staticmethod
    def create(name: str, description: str = None) -> int:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            cursor.execute('''
                INSERT INTO package_templates (name, description)
                VALUES (?, ?)
            ''', (name, description))
            return cursor.lastrowid

    @staticmethod
    def get_all() -> List[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, name, description, created_at, updated_at
                FROM package_templates
                ORDER BY name
            ''')
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def get_by_id(template_id: int) -> Optional[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, name, description, created_at, updated_at
                FROM package_templates
                WHERE id = ?
            ''', (template_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_by_name(name: str) -> Optional[Dict]:
        db = DatabaseConnection()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, name, description, created_at, updated_at
                FROM package_templates
                WHERE name = ?
            ''', (name,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def update(template_id: int, name: str = None, description: str = None) -> bool:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            updates = []
            params = []
            if name is not None:
                updates.append('name = ?')
                params.append(name)
            if description is not None:
                updates.append('description = ?')
                params.append(description)
            
            if not updates:
                return False
            
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(template_id)
            
            cursor.execute(f'''
                UPDATE package_templates
                SET {', '.join(updates)}
                WHERE id = ?
            ''', params)
            return cursor.rowcount > 0

    @staticmethod
    def delete(template_id: int) -> bool:
        db = DatabaseConnection()
        with db.get_cursor() as cursor:
            cursor.execute('''
                DELETE FROM package_templates
                WHERE id = ?
            ''', (template_id,))
            return cursor.rowcount > 0
