import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional, Dict, Generator

from .models import ActionItem, InterviewNote, SecurityLevel


class Storage:
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            db_path = Path.cwd() / ".interview_data" / "data.db"
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS interview_notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL UNIQUE,
                    file_hash TEXT NOT NULL,
                    customer_name TEXT,
                    interviewee TEXT,
                    interview_date TEXT,
                    security_level TEXT NOT NULL,
                    key_questions TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS action_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    interview_id INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    owner TEXT,
                    due_date TEXT,
                    is_completed INTEGER NOT NULL DEFAULT 0,
                    completed_date TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (interview_id) REFERENCES interview_notes (id)
                )
            ''')

            cursor.execute('CREATE INDEX IF NOT EXISTS idx_file_hash ON interview_notes(file_hash)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_interview_id ON action_items(interview_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_is_completed ON action_items(is_completed)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_owner ON action_items(owner)')

    def save_interview(self, note: InterviewNote) -> InterviewNote:
        existing_note = self.get_interview_by_path(note.file_path)

        if existing_note:
            if existing_note.file_hash == note.file_hash:
                return existing_note
            note.id = existing_note.id
            return self._update_interview(note, existing_note)
        else:
            return self._create_interview(note)

    def _create_interview(self, note: InterviewNote) -> InterviewNote:
        now = datetime.now().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO interview_notes (
                    file_path, file_hash, customer_name, interviewee, interview_date,
                    security_level, key_questions, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                note.file_path,
                note.file_hash,
                note.customer_name,
                note.interviewee,
                note.interview_date.isoformat() if note.interview_date else None,
                note.security_level.value,
                '\n'.join(note.key_questions) if note.key_questions else None,
                now,
                now,
            ))

            note.id = cursor.lastrowid

            for action_item in note.action_items:
                self._create_action_item(cursor, note.id, action_item)

        return note

    def _update_interview(self, note: InterviewNote, existing: InterviewNote) -> InterviewNote:
        now = datetime.now().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE interview_notes SET
                    file_hash = ?, customer_name = ?, interviewee = ?,
                    interview_date = ?, security_level = ?, key_questions = ?,
                    updated_at = ?
                WHERE id = ?
            ''', (
                note.file_hash,
                note.customer_name,
                note.interviewee,
                note.interview_date.isoformat() if note.interview_date else None,
                note.security_level.value,
                '\n'.join(note.key_questions) if note.key_questions else None,
                now,
                note.id,
            ))

            existing_items = self._get_action_items_for_interview(note.id)
            existing_descriptions = {item.description: item for item in existing_items}

            for new_item in note.action_items:
                if new_item.description in existing_descriptions:
                    continue
                self._create_action_item(cursor, note.id, new_item)

        return note

    def _create_action_item(self, cursor: sqlite3.Cursor, interview_id: int, item: ActionItem):
        now = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO action_items (
                interview_id, description, owner, due_date,
                is_completed, completed_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            interview_id,
            item.description,
            item.owner,
            item.due_date.isoformat() if item.due_date else None,
            1 if item.is_completed else 0,
            item.completed_date.isoformat() if item.completed_date else None,
            now,
            now,
        ))

    def get_interview_by_path(self, file_path: str) -> Optional[InterviewNote]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM interview_notes WHERE file_path = ?', (file_path,))
            row = cursor.fetchone()
            if row:
                return self._row_to_interview(row)
        return None

    def get_interview_by_hash(self, file_hash: str) -> Optional[InterviewNote]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM interview_notes WHERE file_hash = ?', (file_hash,))
            row = cursor.fetchone()
            if row:
                return self._row_to_interview(row)
        return None

    def get_all_interviews(self) -> List[InterviewNote]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM interview_notes ORDER BY created_at DESC')
            rows = cursor.fetchall()
            return [self._row_to_interview(row) for row in rows]

    def _row_to_interview(self, row: sqlite3.Row) -> InterviewNote:
        note = InterviewNote(
            id=row['id'],
            file_path=row['file_path'],
            file_hash=row['file_hash'],
            customer_name=row['customer_name'],
            interviewee=row['interviewee'],
            security_level=SecurityLevel(row['security_level']),
            action_items=self._get_action_items_for_interview(row['id']),
        )

        if row['interview_date']:
            note.interview_date = date.fromisoformat(row['interview_date'])

        if row['key_questions']:
            note.key_questions = [q.strip() for q in row['key_questions'].split('\n') if q.strip()]

        note.created_at = datetime.fromisoformat(row['created_at'])
        note.updated_at = datetime.fromisoformat(row['updated_at'])

        return note

    def _get_action_items_for_interview(self, interview_id: int) -> List[ActionItem]:
        items = []
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM action_items WHERE interview_id = ? ORDER BY id', (interview_id,))
            rows = cursor.fetchall()
            for row in rows:
                items.append(self._row_to_action_item(row))
        return items

    def _row_to_action_item(self, row: sqlite3.Row) -> ActionItem:
        item = ActionItem(
            id=row['id'],
            interview_id=row['interview_id'],
            description=row['description'],
            owner=row['owner'],
            is_completed=bool(row['is_completed']),
        )

        if row['due_date']:
            item.due_date = date.fromisoformat(row['due_date'])

        if row['completed_date']:
            item.completed_date = date.fromisoformat(row['completed_date'])

        item.created_at = datetime.fromisoformat(row['created_at'])
        item.updated_at = datetime.fromisoformat(row['updated_at'])

        return item

    def get_action_item_by_id(self, action_item_id: int) -> Optional[ActionItem]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM action_items WHERE id = ?', (action_item_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_action_item(row)
        return None

    def get_pending_action_items(self, include_invalid: bool = False) -> List[ActionItem]:
        items = []
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = 'SELECT * FROM action_items WHERE is_completed = 0'
            if not include_invalid:
                query += ' AND owner IS NOT NULL AND due_date IS NOT NULL'
            query += ' ORDER BY due_date NULLS LAST, id'
            cursor.execute(query)
            rows = cursor.fetchall()
            for row in rows:
                items.append(self._row_to_action_item(row))
        return items

    def get_invalid_action_items(self) -> List[ActionItem]:
        items = []
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM action_items 
                WHERE is_completed = 0 AND (owner IS NULL OR due_date IS NULL)
                ORDER BY id
            ''')
            rows = cursor.fetchall()
            for row in rows:
                items.append(self._row_to_action_item(row))
        return items

    def mark_action_item_completed(self, action_item_id: int) -> bool:
        now = datetime.now()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE action_items SET
                    is_completed = 1,
                    completed_date = ?,
                    updated_at = ?
                WHERE id = ? AND is_completed = 0
            ''', (
                date.today().isoformat(),
                now.isoformat(),
                action_item_id,
            ))
            return cursor.rowcount > 0

    def find_duplicate_interviews(self) -> Dict[str, List[InterviewNote]]:
        duplicates: Dict[str, List[InterviewNote]] = {}
        all_notes = self.get_all_interviews()

        hash_groups: Dict[str, List[InterviewNote]] = {}
        for note in all_notes:
            if note.file_hash not in hash_groups:
                hash_groups[note.file_hash] = []
            hash_groups[note.file_hash].append(note)

        for file_hash, notes in hash_groups.items():
            if len(notes) > 1:
                duplicates[file_hash] = notes

        return duplicates

    def find_similar_interviews(self) -> List[List[InterviewNote]]:
        similar: List[List[InterviewNote]] = []
        all_notes = self.get_all_interviews()

        customer_groups: Dict[str, List[InterviewNote]] = {}
        for note in all_notes:
            key = f"{note.customer_name or 'Unknown'}_{note.interviewee or 'Unknown'}"
            if key not in customer_groups:
                customer_groups[key] = []
            customer_groups[key].append(note)

        for key, notes in customer_groups.items():
            if len(notes) > 1:
                similar.append(notes)

        return similar

    def clear_database(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM action_items')
            cursor.execute('DELETE FROM interview_notes')
