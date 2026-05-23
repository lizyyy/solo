import os
import threading
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool


def get_database_url():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(base_dir, "dev_access.db")
    return f"sqlite:///{db_path}"


def is_writable(path):
    try:
        test_file = os.path.join(path, ".write_test")
        with open(test_file, "w") as f:
            f.write("test")
        os.remove(test_file)
        return True
    except (OSError, IOError):
        return False


_engine = None
_SessionLocal = None
_initialized = False
_lock = threading.Lock()


def get_engine(use_memory_fallback=True):
    global _engine, _initialized
    if _engine is None:
        with _lock:
            if _engine is None:
                db_url = get_database_url()
                db_dir = os.path.dirname(db_url.replace("sqlite:///", ""))
                
                if not is_writable(db_dir):
                    if use_memory_fallback:
                        print(f"⚠️  目录不可写: {db_dir}，使用内存数据库（StaticPool）")
                        _engine = create_engine(
                            "sqlite:///:memory:",
                            connect_args={"check_same_thread": False},
                            poolclass=StaticPool,
                            pool_pre_ping=True
                        )
                    else:
                        raise OSError(f"数据库目录不可写: {db_dir}")
                else:
                    _engine = create_engine(db_url, connect_args={"check_same_thread": False})
                _initialized = True
    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


def init_database_schema():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)


def is_initialized():
    return _initialized


Base = declarative_base()

__all__ = [
    "Base", 
    "get_engine", 
    "get_session_factory", 
    "init_database_schema",
    "get_database_url", 
    "is_writable",
    "is_initialized"
]
