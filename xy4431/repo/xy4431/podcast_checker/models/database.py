import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, date
from pathlib import Path
from typing import Optional, List, Dict, Any, Iterator

from podcast_checker.config import settings
from podcast_checker.models.schemas import (
    Episode,
    EpisodeCheckResult,
    CheckStatus,
    Issue,
    IssueType,
    ReviewNote,
)


def adapt_date(val: date) -> str:
    return val.isoformat()


def convert_date(val: bytes) -> date:
    return date.fromisoformat(val.decode())


def adapt_datetime(val: datetime) -> str:
    return val.isoformat()


def convert_datetime(val: bytes) -> datetime:
    return datetime.fromisoformat(val.decode())


sqlite3.register_adapter(date, adapt_date)
sqlite3.register_converter("date", convert_date)
sqlite3.register_adapter(datetime, adapt_datetime)
sqlite3.register_converter("datetime", convert_datetime)


class DatabaseManager:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or settings.DB_PATH
    
    @contextmanager
    def get_connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(
            self.db_path,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
        )
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def init_db(self) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS episodes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    episode_number INTEGER UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    publish_date date,
                    audio_file TEXT,
                    duration_seconds INTEGER,
                    sponsors TEXT,
                    music_tracks TEXT,
                    cover_file TEXT,
                    description TEXT,
                    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
                    updated_at timestamp DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS episode_checks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    episode_number INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    overall_status TEXT DEFAULT 'pending',
                    loudness_status TEXT DEFAULT 'pending',
                    ad_status TEXT DEFAULT 'pending',
                    music_status TEXT DEFAULT 'pending',
                    cover_status TEXT DEFAULT 'pending',
                    issues_json TEXT DEFAULT '[]',
                    checked_at timestamp,
                    FOREIGN KEY (episode_number) REFERENCES episodes(episode_number)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS review_notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    episode_number INTEGER NOT NULL,
                    note TEXT NOT NULL,
                    reviewer TEXT,
                    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
                    updated_at timestamp,
                    FOREIGN KEY (episode_number) REFERENCES episodes(episode_number)
                )
            """)
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_episode_number ON episodes(episode_number)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_check_episode ON episode_checks(episode_number)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_episode ON review_notes(episode_number)")
    
    def save_episode(self, episode: Episode) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO episodes 
                (episode_number, title, publish_date, audio_file, duration_seconds, 
                 sponsors, music_tracks, cover_file, description, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                episode.episode_number,
                episode.title,
                episode.publish_date,
                episode.audio_file,
                episode.duration_seconds,
                json.dumps(episode.sponsors, ensure_ascii=False),
                json.dumps(episode.music_tracks, ensure_ascii=False),
                episode.cover_file,
                episode.description,
            ))
    
    def get_episode(self, episode_number: int) -> Optional[Episode]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM episodes WHERE episode_number = ?", (episode_number,))
            row = cursor.fetchone()
            if row:
                return self._row_to_episode(row)
            return None
    
    def get_all_episodes(self) -> List[Episode]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM episodes ORDER BY episode_number")
            return [self._row_to_episode(row) for row in cursor.fetchall()]
    
    def save_check_result(self, check_result: EpisodeCheckResult) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            issues_json = json.dumps([
                {
                    "issue_type": i.issue_type.value,
                    "severity": i.severity.value,
                    "message": i.message,
                    "details": i.details,
                    "affected_field": i.affected_field,
                }
                for i in check_result.issues
            ], ensure_ascii=False)
            
            cursor.execute("""
                INSERT OR REPLACE INTO episode_checks 
                (episode_number, title, overall_status, loudness_status, ad_status,
                 music_status, cover_status, issues_json, checked_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                check_result.episode_number,
                check_result.title,
                check_result.overall_status.value,
                check_result.loudness_status.value,
                check_result.ad_status.value,
                check_result.music_status.value,
                check_result.cover_status.value,
                issues_json,
            ))
    
    def get_check_result(self, episode_number: int) -> Optional[EpisodeCheckResult]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM episode_checks WHERE episode_number = ?", (episode_number,))
            row = cursor.fetchone()
            if row:
                return self._row_to_check_result(row)
            return None
    
    def get_all_check_results(self) -> List[EpisodeCheckResult]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM episode_checks ORDER BY episode_number")
            return [self._row_to_check_result(row) for row in cursor.fetchall()]
    
    def add_review_note(self, episode_number: int, note: str, reviewer: Optional[str] = None) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO review_notes (episode_number, note, reviewer, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            """, (episode_number, note, reviewer))
            return cursor.lastrowid
    
    def get_review_notes(self, episode_number: int) -> List[ReviewNote]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM review_notes 
                WHERE episode_number = ? 
                ORDER BY created_at DESC
            """, (episode_number,))
            return [
                ReviewNote(
                    id=row["id"],
                    episode_number=row["episode_number"],
                    note=row["note"],
                    reviewer=row["reviewer"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
                for row in cursor.fetchall()
            ]
    
    def update_review_note(self, note_id: int, note: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE review_notes 
                SET note = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            """, (note, note_id))
            return cursor.rowcount > 0
    
    def get_statistics(self) -> Dict[str, Any]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) as count FROM episodes")
            total_episodes = cursor.fetchone()["count"]
            
            cursor.execute("""
                SELECT overall_status, COUNT(*) as count 
                FROM episode_checks 
                GROUP BY overall_status
            """)
            status_counts = {row["overall_status"]: row["count"] for row in cursor.fetchall()}
            
            cursor.execute("""
                SELECT COUNT(*) as count FROM review_notes
            """)
            total_notes = cursor.fetchone()["count"]
            
            return {
                "total_episodes": total_episodes,
                "status_counts": status_counts,
                "total_review_notes": total_notes,
            }
    
    def clear_all_data(self) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM review_notes")
            cursor.execute("DELETE FROM episode_checks")
            cursor.execute("DELETE FROM episodes")
    
    def _row_to_episode(self, row: sqlite3.Row) -> Episode:
        return Episode(
            episode_number=row["episode_number"],
            title=row["title"],
            publish_date=row["publish_date"],
            audio_file=row["audio_file"],
            duration_seconds=row["duration_seconds"],
            sponsors=json.loads(row["sponsors"] or "[]"),
            music_tracks=json.loads(row["music_tracks"] or "[]"),
            cover_file=row["cover_file"],
            description=row["description"],
        )
    
    def _row_to_check_result(self, row: sqlite3.Row) -> EpisodeCheckResult:
        issues_data = json.loads(row["issues_json"] or "[]")
        issues = [
            Issue(
                issue_type=IssueType(i["issue_type"]),
                severity=CheckStatus(i["severity"]),
                message=i["message"],
                details=i.get("details"),
                affected_field=i.get("affected_field"),
            )
            for i in issues_data
        ]
        
        return EpisodeCheckResult(
            episode_number=row["episode_number"],
            title=row["title"],
            overall_status=CheckStatus(row["overall_status"]),
            loudness_status=CheckStatus(row["loudness_status"]),
            ad_status=CheckStatus(row["ad_status"]),
            music_status=CheckStatus(row["music_status"]),
            cover_status=CheckStatus(row["cover_status"]),
            issues=issues,
            checked_at=row["checked_at"],
            review_notes=[],
        )


def init_db(db_path: Optional[Path] = None) -> DatabaseManager:
    db = DatabaseManager(db_path)
    db.init_db()
    return db
