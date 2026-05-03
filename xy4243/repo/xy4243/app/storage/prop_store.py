from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .database import Database, datetime_to_iso, iso_to_datetime
from app.models import Prop, DangerLevel


class PropStore:

    def __init__(self, db: Database):
        self.db = db

    def get_all(self) -> List[Prop]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM props ORDER BY name")
            rows = cursor.fetchall()
            return [self._row_to_prop(row) for row in rows]

    def get_by_id(self, prop_id: str) -> Optional[Prop]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM props WHERE id = ?", (prop_id,))
            row = cursor.fetchone()
            return self._row_to_prop(row) if row else None

    def get_by_name(self, name: str) -> Optional[Prop]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM props WHERE name = ?", (name,))
            row = cursor.fetchone()
            return self._row_to_prop(row) if row else None

    def get_dangerous_props(self) -> List[Prop]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM props 
                WHERE is_dangerous = 1 OR danger_level != 'SAFE'
                ORDER BY name
            """)
            rows = cursor.fetchall()
            return [self._row_to_prop(row) for row in rows]

    def save(self, prop: Prop) -> Prop:
        prop.updated_at = datetime.now()
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            existing = self.get_by_id(prop.id)

            if existing:
                cursor.execute("""
                    UPDATE props SET
                        name = ?, description = ?, category = ?,
                        danger_level = ?, is_dangerous = ?, danger_description = ?,
                        requires_verification = ?, location = ?, owner = ?,
                        total_quantity = ?, available_quantity = ?,
                        barcode = ?, serial_number = ?, notes = ?,
                        last_verified_at = ?, created_at = ?, updated_at = ?
                    WHERE id = ?
                """, (
                    prop.name, prop.description, prop.category,
                    prop.danger_level.name, prop.is_dangerous, prop.danger_description,
                    prop.requires_verification, prop.location, prop.owner,
                    prop.total_quantity, prop.available_quantity,
                    prop.barcode, prop.serial_number, prop.notes,
                    datetime_to_iso(prop.last_verified_at),
                    datetime_to_iso(prop.created_at), datetime_to_iso(prop.updated_at),
                    prop.id
                ))
            else:
                prop.created_at = datetime.now()
                cursor.execute("""
                    INSERT INTO props (
                        id, name, description, category,
                        danger_level, is_dangerous, danger_description,
                        requires_verification, location, owner,
                        total_quantity, available_quantity,
                        barcode, serial_number, notes,
                        last_verified_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    prop.id, prop.name, prop.description, prop.category,
                    prop.danger_level.name, prop.is_dangerous, prop.danger_description,
                    prop.requires_verification, prop.location, prop.owner,
                    prop.total_quantity, prop.available_quantity,
                    prop.barcode, prop.serial_number, prop.notes,
                    datetime_to_iso(prop.last_verified_at),
                    datetime_to_iso(prop.created_at), datetime_to_iso(prop.updated_at)
                ))

            return prop

    def save_all(self, props: List[Prop]) -> List[Prop]:
        return [self.save(prop) for prop in props]

    def delete(self, prop_id: str) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM props WHERE id = ?", (prop_id,))
            return cursor.rowcount > 0

    def delete_all(self) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM props")
            return cursor.rowcount

    def count(self) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM props")
            return cursor.fetchone()[0]

    def _row_to_prop(self, row) -> Prop:
        try:
            danger_level = DangerLevel[row["danger_level"]]
        except (KeyError, ValueError):
            danger_level = DangerLevel.SAFE

        return Prop(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            category=row["category"],
            danger_level=danger_level,
            is_dangerous=bool(row["is_dangerous"]),
            danger_description=row["danger_description"],
            requires_verification=bool(row["requires_verification"]),
            location=row["location"],
            owner=row["owner"],
            total_quantity=row["total_quantity"],
            available_quantity=row["available_quantity"],
            barcode=row["barcode"],
            serial_number=row["serial_number"],
            notes=row["notes"],
            last_verified_at=iso_to_datetime(row["last_verified_at"]),
            created_at=iso_to_datetime(row["created_at"]),
            updated_at=iso_to_datetime(row["updated_at"]),
        )
