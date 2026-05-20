from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./api_tutorial.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Developer(Base):
    __tablename__ = "developers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    api_key = Column(String, unique=True, index=True)
    api_secret = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    progress = relationship("Progress", back_populates="developer")
    requests = relationship("PracticeRequest", back_populates="developer")


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    order = Column(Integer, unique=True)
    title = Column(String)
    description = Column(Text)
    endpoint = Column(String)
    method = Column(String)
    required_params = Column(Text)
    success_criteria = Column(Text)
    hint = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    progress = relationship("Progress", back_populates="lesson")


class Progress(Base):
    __tablename__ = "progress"

    id = Column(Integer, primary_key=True, index=True)
    developer_id = Column(Integer, ForeignKey("developers.id"))
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    status = Column(String)
    attempts = Column(Integer, default=0)
    completed_at = Column(DateTime, nullable=True)
    last_attempt_at = Column(DateTime, nullable=True)

    developer = relationship("Developer", back_populates="progress")
    lesson = relationship("Lesson", back_populates="progress")


class PracticeRequest(Base):
    __tablename__ = "practice_requests"

    id = Column(Integer, primary_key=True, index=True)
    developer_id = Column(Integer, ForeignKey("developers.id"))
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    request_method = Column(String)
    request_url = Column(String)
    request_headers = Column(Text)
    request_body = Column(Text)
    response_status = Column(Integer)
    response_body = Column(Text)
    is_success = Column(Boolean)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    developer = relationship("Developer", back_populates="requests")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
