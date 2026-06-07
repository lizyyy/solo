"""数据库连接管理"""

from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DEFAULT_DB_PATH = "data/email_risk.db"


def get_engine(db_path: str = DEFAULT_DB_PATH):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{db_path}")


def get_session(db_path: str = DEFAULT_DB_PATH):
    engine = get_engine(db_path)
    Session = sessionmaker(bind=engine)
    return Session()


def init_db(db_path: str = DEFAULT_DB_PATH):
    from .models import Base
    engine = get_engine(db_path)
    Base.metadata.create_all(engine)
    return engine
