from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .database import Database, datetime_to_iso, iso_to_datetime
from app.models import Scene


class SceneStore:

    def __init__(self, db: Database):
        self.db = db

    def get_all(self) -> List[Scene]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM scenes 
                ORDER BY sort_order, act_number, scene_number
            """)
            rows = cursor.fetchall()
            return [self._row_to_scene(row) for row in rows]

    def get_by_id(self, scene_id: str) -> Optional[Scene]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM scenes WHERE id = ?", (scene_id,))
            row = cursor.fetchone()
            return self._row_to_scene(row) if row else None

    def get_by_act_scene(self, act_number: int, scene_number: int) -> Optional[Scene]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM scenes 
                WHERE act_number = ? AND scene_number = ?
            """, (act_number, scene_number))
            row = cursor.fetchone()
            return self._row_to_scene(row) if row else None

    def save(self, scene: Scene) -> Scene:
        scene.updated_at = datetime.now()
        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            existing = self.get_by_id(scene.id)

            if existing:
                cursor.execute("""
                    UPDATE scenes SET
                        act_number = ?, scene_number = ?, title = ?,
                        description = ?, location = ?, start_time = ?,
                        end_time = ?, duration_minutes = ?, sort_order = ?,
                        notes = ?, created_at = ?, updated_at = ?
                    WHERE id = ?
                """, (
                    scene.act_number, scene.scene_number, scene.title,
                    scene.description, scene.location,
                    datetime_to_iso(scene.start_time),
                    datetime_to_iso(scene.end_time),
                    scene.duration_minutes, scene.sort_order,
                    scene.notes,
                    datetime_to_iso(scene.created_at), datetime_to_iso(scene.updated_at),
                    scene.id
                ))
            else:
                scene.created_at = datetime.now()
                cursor.execute("""
                    INSERT INTO scenes (
                        id, act_number, scene_number, title,
                        description, location, start_time,
                        end_time, duration_minutes, sort_order,
                        notes, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    scene.id, scene.act_number, scene.scene_number, scene.title,
                    scene.description, scene.location,
                    datetime_to_iso(scene.start_time),
                    datetime_to_iso(scene.end_time),
                    scene.duration_minutes, scene.sort_order,
                    scene.notes,
                    datetime_to_iso(scene.created_at), datetime_to_iso(scene.updated_at)
                ))

            return scene

    def save_all(self, scenes: List[Scene]) -> List[Scene]:
        return [self.save(scene) for scene in scenes]

    def delete(self, scene_id: str) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM scenes WHERE id = ?", (scene_id,))
            return cursor.rowcount > 0

    def delete_all(self) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM scenes")
            return cursor.rowcount

    def count(self) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM scenes")
            return cursor.fetchone()[0]

    def _row_to_scene(self, row) -> Scene:
        return Scene(
            id=row["id"],
            act_number=row["act_number"],
            scene_number=row["scene_number"],
            title=row["title"],
            description=row["description"],
            location=row["location"],
            start_time=iso_to_datetime(row["start_time"]),
            end_time=iso_to_datetime(row["end_time"]),
            duration_minutes=row["duration_minutes"],
            sort_order=row["sort_order"],
            notes=row["notes"],
            created_at=iso_to_datetime(row["created_at"]),
            updated_at=iso_to_datetime(row["updated_at"]),
        )
