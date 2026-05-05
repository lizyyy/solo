import sqlite3
import os
from pathlib import Path


class DatabaseConnection:
    _instance = None
    _connection = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._connection is None:
            self._initialize_connection()

    def _initialize_connection(self):
        app_data_dir = Path.home() / ".copper_etching_tool"
        app_data_dir.mkdir(parents=True, exist_ok=True)
        db_path = app_data_dir / "copper_etching.db"
        self._connection = sqlite3.connect(db_path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row

    def get_connection(self):
        return self._connection

    def close(self):
        if self._connection:
            self._connection.close()
            self._connection = None


def get_db_connection():
    return DatabaseConnection().get_connection()
