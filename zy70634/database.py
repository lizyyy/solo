from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base
import os

DATABASE_URL = "sqlite:///./wave_picking.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    if not os.path.exists("./wave_picking.db"):
        Base.metadata.create_all(bind=engine)
        print("数据库初始化完成")
    else:
        print("数据库已存在")


if __name__ == "__main__":
    init_db()