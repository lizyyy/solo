import sqlite3
import os
from contextlib import contextmanager
from typing import Optional


class DatabaseConnection:
    _instance: Optional['DatabaseConnection'] = None
    _db_path: str

    def __new__(cls, db_path: Optional[str] = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, db_path: Optional[str] = None):
        if self._initialized:
            return
        if db_path is None:
            db_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                'data',
                'sterilization.db'
            )
        self._db_path = db_path
        self._initialized = True
        self._ensure_data_directory()

    def _ensure_data_directory(self):
        data_dir = os.path.dirname(self._db_path)
        if not os.path.exists(data_dir):
            os.makedirs(data_dir)

    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def get_cursor(self, commit: bool = True):
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            yield cursor
            if commit:
                conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def get_db_path(self) -> str:
        return self._db_path

    @classmethod
    def reset_instance(cls):
        cls._instance = None
