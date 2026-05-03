from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .database import Database, datetime_to_iso, iso_to_datetime
from app.models import Actor


class ActorStore:

    def __init__(self, db: Database):
        self.db = db

    def get_all(self) -> List[Actor]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM actors ORDER BY name")
            rows = cursor.fetchall()
            return [self._row_to_actor(row) for row in rows]

    def get_by_id(self, actor_id: str) -> Optional[Actor]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM actors WHERE id = ?", (actor_id,))
            row = cursor.fetchone()
            return self._row_to_actor(row) if row else None

    def get_by_name(self, name: str) -> Optional[Actor]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM actors WHERE name = ?", (name,))
            row = cursor.fetchone()
            return self._row_to_actor(row) if row else None

    def save(self, actor: Actor) -> Actor:
        actor.updated_at = datetime.now()
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            existing = self.get_by_id(actor.id)

            if existing:
                cursor.execute("""
                    UPDATE actors SET
                        name = ?, role = ?, contact_info = ?, notes = ?,
                        created_at = ?, updated_at = ?
                    WHERE id = ?
                """, (
                    actor.name, actor.role, actor.contact_info, actor.notes,
                    datetime_to_iso(actor.created_at), datetime_to_iso(actor.updated_at),
                    actor.id
                ))
            else:
                actor.created_at = datetime.now()
                cursor.execute("""
                    INSERT INTO actors (
                        id, name, role, contact_info, notes,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    actor.id, actor.name, actor.role, actor.contact_info, actor.notes,
                    datetime_to_iso(actor.created_at), datetime_to_iso(actor.updated_at)
                ))

            return actor

    def save_all(self, actors: List[Actor]) -> List[Actor]:
        return [self.save(actor) for actor in actors]

    def delete(self, actor_id: str) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM actors WHERE id = ?", (actor_id,))
            return cursor.rowcount > 0

    def delete_all(self) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM actors")
            return cursor.rowcount

    def count(self) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM actors")
            return cursor.fetchone()[0]

    def _row_to_actor(self, row) -> Actor:
        return Actor(
            id=row["id"],
            name=row["name"],
            role=row["role"],
            contact_info=row["contact_info"],
            notes=row["notes"],
            created_at=iso_to_datetime(row["created_at"]),
            updated_at=iso_to_datetime(row["updated_at"]),
        )
