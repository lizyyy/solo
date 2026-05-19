from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

from config import Base
from models import (
    Hazard, HazardPhoto, ResponsiblePerson, Rectification, RectificationPhoto,
    Recheck, RecheckPhoto, BatchOperation, BatchItem, OperationLog, RuleCheckResult
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'hazard_management.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
    print("数据库初始化完成！")


def drop_db():
    Base.metadata.drop_all(bind=engine)
    print("数据库表已删除！")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "drop":
        drop_db()
    init_db()
