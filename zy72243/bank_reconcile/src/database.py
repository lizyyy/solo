import os
import yaml
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

_engine = None
_session_factory = None
_scoped_session = None


def load_config():
    config_path = os.path.join(os.path.dirname(__file__), "..", "config", "config.yaml")
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _get_db_path():
    config = load_config()
    db_path = os.path.join(os.path.dirname(__file__), "..", config["database"]["path"])
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    return db_path


def get_engine():
    global _engine
    if _engine is None:
        db_path = _get_db_path()
        _engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    return _engine


def init_db():
    from .models import Base
    engine = get_engine()
    Base.metadata.create_all(engine)
    return engine


def get_session():
    global _session_factory, _scoped_session
    if _scoped_session is None:
        _session_factory = sessionmaker(bind=get_engine())
        _scoped_session = scoped_session(_session_factory)
    return _scoped_session()


def reset_session():
    global _engine, _session_factory, _scoped_session
    if _scoped_session is not None:
        _scoped_session.remove()
    _engine = None
    _session_factory = None
    _scoped_session = None
