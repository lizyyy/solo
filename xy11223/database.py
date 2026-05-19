from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import Optional
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./quality_control.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    import models.store
    import models.sample
    import models.temperature
    import models.waste
    import models.batch
    import models.rule
    import models.review
    Base.metadata.create_all(bind=engine)
