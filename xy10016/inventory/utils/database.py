from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Optional

from inventory.config import DATABASE_URL
from inventory.models import Base


class DatabaseManager:
    _instance: Optional['DatabaseManager'] = None
    _engine = None
    _Session = None

    def __new__(cls, database_url: str = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init(database_url)
        return cls._instance

    def _init(self, database_url: str = None):
        url = database_url or DATABASE_URL
        self._engine = create_engine(url, echo=False, future=True)
        self._Session = sessionmaker(bind=self._engine, expire_on_commit=False, future=True)

    def create_tables(self):
        Base.metadata.create_all(self._engine)

    def drop_tables(self):
        Base.metadata.drop_all(self._engine)

    @contextmanager
    def session(self) -> Session:
        session = self._Session()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_engine(self):
        return self._engine


def get_db():
    return DatabaseManager()


def init_database(database_url: str = None, reset: bool = False):
    db = DatabaseManager(database_url)
    if reset:
        db.drop_tables()
    db.create_tables()
    return db
