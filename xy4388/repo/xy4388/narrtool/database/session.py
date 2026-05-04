"""数据库会话管理"""

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from narrtool.config import config
from .models import Base


def get_engine():
    """获取数据库引擎"""
    return create_engine(
        config.db_url,
        echo=False,
        connect_args={"check_same_thread": False}
    )


def init_db():
    """初始化数据库表"""
    engine = get_engine()
    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    """获取数据库会话"""
    engine = get_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """会话上下文管理器"""
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
