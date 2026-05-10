from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

from .config import settings


metadata = MetaData()
Base = declarative_base(metadata=metadata)

connect_args = {}
if "sqlite" in settings.database_url:
    connect_args["check_same_thread"] = False
    poolclass = StaticPool
else:
    poolclass = None

engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args=connect_args,
    poolclass=poolclass,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def init_db() -> None:
    from . import models

    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
