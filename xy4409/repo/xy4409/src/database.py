from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from contextlib import contextmanager

from .config import Config


Base = declarative_base()
_engine = None
_session_factory = None
_scoped_session = None


def get_engine():
    global _engine
    if _engine is None:
        config = Config()
        db_path = config.database_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(
            f'sqlite:///{db_path}',
            connect_args={'check_same_thread': False},
            echo=False
        )
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine())
    return _session_factory


def get_scoped_session():
    global _scoped_session
    if _scoped_session is None:
        _scoped_session = scoped_session(get_session_factory())
    return _scoped_session


def init_db():
    Base.metadata.create_all(get_engine())


@contextmanager
def db_session():
    session = get_scoped_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.remove()


class Database:
    def __init__(self):
        self.engine = get_engine()
        self.session_factory = get_session_factory()

    def create_tables(self):
        init_db()

    @contextmanager
    def session(self):
        return db_session()
