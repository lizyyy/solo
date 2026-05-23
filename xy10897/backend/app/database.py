import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


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


def init_database(use_memory_fallback=True):
    db_url = get_database_url()
    db_dir = os.path.dirname(db_url.replace("sqlite:///", ""))
    
    if not is_writable(db_dir):
        if use_memory_fallback:
            print(f"⚠️  目录不可写: {db_dir}，使用内存数据库")
            return create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        raise OSError(f"数据库目录不可写: {db_dir}")
    
    return create_engine(db_url, connect_args={"check_same_thread": False})


Base = declarative_base()

__all__ = ["Base", "init_database", "get_database_url", "is_writable"]
