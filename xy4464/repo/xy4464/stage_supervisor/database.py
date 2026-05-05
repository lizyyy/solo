import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from .models import (
    Project, Cue, LightScene, AudioFile, ActorSchedule, Issue,
    CueType, IssueType, IssueSeverity
)


class DatabaseManager:
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            db_path = os.path.join(os.getcwd(), "stage_supervisor.db")
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                project_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_scan_at TIMESTAMP,
                metadata TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                cue_id TEXT NOT NULL,
                description TEXT,
                cue_type TEXT NOT NULL,
                time TEXT NOT NULL,
                light_scene_id TEXT,
                audio_file_id TEXT,
                notes TEXT,
                metadata TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(project_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS light_scenes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                scene_id TEXT NOT NULL,
                name TEXT NOT NULL,
                intensity INTEGER NOT NULL,
                color_temperature INTEGER,
                channels TEXT,
                notes TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(project_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audio_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                cue_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                path TEXT NOT NULL,
                duration_seconds REAL,
                format TEXT,
                exists INTEGER DEFAULT 1,
                FOREIGN KEY (project_id) REFERENCES projects(project_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS actor_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                actor_name TEXT NOT NULL,
                scene_id TEXT NOT NULL,
                enter_time TEXT NOT NULL,
                exit_time TEXT NOT NULL,
                notes TEXT,
                costume TEXT,
                entry_direction TEXT,
                exit_direction TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(project_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS issues (
                issue_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                issue_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                related_cue_id TEXT,
                related_actor TEXT,
                related_file TEXT,
                time_code TEXT,
                notes TEXT,
                resolved INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(project_id)
            )
        ''')

        conn.commit()
        conn.close()

    def save_project(self, project: Project) -> bool:
        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute('''
                INSERT OR REPLACE INTO projects 
                (project_id, name, path, created_at, last_scan_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                project.project_id,
                project.name,
                project.path,
                project.created_at.isoformat() if project.created_at else None,
                project.last_scan_at.isoformat() if project.last_scan_at else None,
                json.dumps({})
            ))

            cursor.execute('DELETE FROM cues WHERE project_id = ?', (project.project_id,))
            for cue in project.cues:
                cursor.execute('''
                    INSERT INTO cues 
                    (project_id, cue_id, description, cue_type, time, 
                     light_scene_id, audio_file_id, notes, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    project.project_id,
                    cue.cue_id,
                    cue.description,
                    cue.cue_type.value,
                    cue.time,
                    cue.light_scene_id,
                    cue.audio_file_id,
                    cue.notes,
                    json.dumps(cue.metadata)
                ))

            cursor.execute('DELETE FROM light_scenes WHERE project_id = ?', (project.project_id,))
            for scene in project.light_scenes:
                cursor.execute('''
                    INSERT INTO light_scenes 
                    (project_id, scene_id, name, intensity, color_temperature, channels, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    project.project_id,
                    scene.scene_id,
                    scene.name,
                    scene.intensity,
                    scene.color_temperature,
                    json.dumps(scene.channels),
                    scene.notes
                ))

            cursor.execute('DELETE FROM audio_files WHERE project_id = ?', (project.project_id,))
            for audio_file in project.audio_files:
                cursor.execute('''
                    INSERT INTO audio_files 
                    (project_id, cue_id, filename, path, duration_seconds, format, exists)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    project.project_id,
                    audio_file.cue_id,
                    audio_file.filename,
                    audio_file.path,
                    audio_file.duration_seconds,
                    audio_file.format,
                    1 if audio_file.exists else 0
                ))

            cursor.execute('DELETE FROM actor_schedules WHERE project_id = ?', (project.project_id,))
            for schedule in project.actor_schedules:
                cursor.execute('''
                    INSERT INTO actor_schedules 
                    (project_id, actor_name, scene_id, enter_time, exit_time, 
                     notes, costume, entry_direction, exit_direction)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    project.project_id,
                    schedule.actor_name,
                    schedule.scene_id,
                    schedule.enter_time,
                    schedule.exit_time,
                    schedule.notes,
                    schedule.costume,
                    schedule.entry_direction,
                    schedule.exit_direction
                ))

            cursor.execute('DELETE FROM issues WHERE project_id = ?', (project.project_id,))
            for issue in project.issues:
                cursor.execute('''
                    INSERT INTO issues 
                    (issue_id, project_id, issue_type, severity, title, description,
                     related_cue_id, related_actor, related_file, time_code, 
                     notes, resolved, created_at, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    issue.issue_id,
                    project.project_id,
                    issue.issue_type.value,
                    issue.severity.value,
                    issue.title,
                    issue.description,
                    issue.related_cue_id,
                    issue.related_actor,
                    issue.related_file,
                    issue.time_code,
                    json.dumps(issue.notes),
                    1 if issue.resolved else 0,
                    issue.created_at.isoformat(),
                    json.dumps(issue.metadata)
                ))

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            print(f"Error saving project: {e}")
            return False
        finally:
            conn.close()

    def load_project(self, project_id: str) -> Optional[Project]:
        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute('SELECT * FROM projects WHERE project_id = ?', (project_id,))
            project_row = cursor.fetchone()
            if not project_row:
                return None

            project = Project(
                project_id=project_row['project_id'],
                name=project_row['name'],
                path=project_row['path'],
                created_at=datetime.fromisoformat(project_row['created_at']) if project_row['created_at'] else None,
                last_scan_at=datetime.fromisoformat(project_row['last_scan_at']) if project_row['last_scan_at'] else None
            )

            cursor.execute('SELECT * FROM cues WHERE project_id = ?', (project_id,))
            for row in cursor.fetchall():
                project.cues.append(Cue(
                    cue_id=row['cue_id'],
                    description=row['description'],
                    cue_type=CueType(row['cue_type']),
                    time=row['time'],
                    light_scene_id=row['light_scene_id'],
                    audio_file_id=row['audio_file_id'],
                    notes=row['notes'],
                    metadata=json.loads(row['metadata']) if row['metadata'] else {}
                ))

            cursor.execute('SELECT * FROM light_scenes WHERE project_id = ?', (project_id,))
            for row in cursor.fetchall():
                project.light_scenes.append(LightScene(
                    scene_id=row['scene_id'],
                    name=row['name'],
                    intensity=row['intensity'],
                    color_temperature=row['color_temperature'],
                    channels=json.loads(row['channels']) if row['channels'] else {},
                    notes=row['notes']
                ))

            cursor.execute('SELECT * FROM audio_files WHERE project_id = ?', (project_id,))
            for row in cursor.fetchall():
                project.audio_files.append(AudioFile(
                    cue_id=row['cue_id'],
                    filename=row['filename'],
                    path=row['path'],
                    duration_seconds=row['duration_seconds'],
                    format=row['format'],
                    exists=bool(row['exists'])
                ))

            cursor.execute('SELECT * FROM actor_schedules WHERE project_id = ?', (project_id,))
            for row in cursor.fetchall():
                project.actor_schedules.append(ActorSchedule(
                    actor_name=row['actor_name'],
                    scene_id=row['scene_id'],
                    enter_time=row['enter_time'],
                    exit_time=row['exit_time'],
                    notes=row['notes'],
                    costume=row['costume'],
                    entry_direction=row['entry_direction'],
                    exit_direction=row['exit_direction']
                ))

            cursor.execute('SELECT * FROM issues WHERE project_id = ?', (project_id,))
            for row in cursor.fetchall():
                project.issues.append(Issue(
                    issue_id=row['issue_id'],
                    issue_type=IssueType(row['issue_type']),
                    severity=IssueSeverity(row['severity']),
                    title=row['title'],
                    description=row['description'],
                    related_cue_id=row['related_cue_id'],
                    related_actor=row['related_actor'],
                    related_file=row['related_file'],
                    time_code=row['time_code'],
                    notes=json.loads(row['notes']) if row['notes'] else [],
                    resolved=bool(row['resolved']),
                    created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(),
                    metadata=json.loads(row['metadata']) if row['metadata'] else {}
                ))

            return project
        except Exception as e:
            print(f"Error loading project: {e}")
            return None
        finally:
            conn.close()

    def list_projects(self) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute('SELECT project_id, name, path, created_at, last_scan_at FROM projects ORDER BY created_at DESC')
            projects = []
            for row in cursor.fetchall():
                projects.append({
                    'project_id': row['project_id'],
                    'name': row['name'],
                    'path': row['path'],
                    'created_at': row['created_at'],
                    'last_scan_at': row['last_scan_at']
                })
            return projects
        finally:
            conn.close()

    def update_issue_note(self, issue_id: str, note: str) -> bool:
        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute('SELECT notes FROM issues WHERE issue_id = ?', (issue_id,))
            row = cursor.fetchone()
            if not row:
                return False

            current_notes = json.loads(row['notes']) if row['notes'] else []
            current_notes.append(note)

            cursor.execute(
                'UPDATE issues SET notes = ? WHERE issue_id = ?',
                (json.dumps(current_notes), issue_id)
            )
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            print(f"Error updating issue note: {e}")
            return False
        finally:
            conn.close()

    def resolve_issue(self, issue_id: str) -> bool:
        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                'UPDATE issues SET resolved = 1 WHERE issue_id = ?',
                (issue_id,)
            )
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            print(f"Error resolving issue: {e}")
            return False
        finally:
            conn.close()

    def get_all_issues(self, project_id: Optional[str] = None, resolved: Optional[bool] = None) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        cursor = conn.cursor()

        try:
            query = 'SELECT * FROM issues WHERE 1=1'
            params = []

            if project_id:
                query += ' AND project_id = ?'
                params.append(project_id)

            if resolved is not None:
                query += ' AND resolved = ?'
                params.append(1 if resolved else 0)

            query += ' ORDER BY created_at DESC'

            cursor.execute(query, params)
            issues = []
            for row in cursor.fetchall():
                issues.append({
                    'issue_id': row['issue_id'],
                    'project_id': row['project_id'],
                    'issue_type': row['issue_type'],
                    'severity': row['severity'],
                    'title': row['title'],
                    'description': row['description'],
                    'related_cue_id': row['related_cue_id'],
                    'related_actor': row['related_actor'],
                    'related_file': row['related_file'],
                    'time_code': row['time_code'],
                    'notes': json.loads(row['notes']) if row['notes'] else [],
                    'resolved': bool(row['resolved']),
                    'created_at': row['created_at']
                })
            return issues
        finally:
            conn.close()
