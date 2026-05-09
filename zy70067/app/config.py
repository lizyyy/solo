from pydantic_settings import BaseSettings
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./lab_supplies.db"
    DEBUG: bool = True

    class Config:
        env_file = ".env"


settings = Settings()

DB_DIR = Path(__file__).resolve().parent.parent
DB_PATH = DB_DIR / "lab_supplies.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
