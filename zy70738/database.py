from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, Text, ForeignKey, UniqueConstraint, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./image_provenance.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ImageProvenance(Base):
    __tablename__ = "image_provenance"

    id = Column(Integer, primary_key=True, index=True)
    image_tag = Column(String, index=True, nullable=False)
    image_digest = Column(String, index=True)
    pipeline_id = Column(String, index=True)
    pipeline_name = Column(String)
    pipeline_url = Column(String)
    commit_hash = Column(String, index=True)
    commit_branch = Column(String)
    commit_message = Column(Text)
    commit_author = Column(String)
    commit_url = Column(String)
    signer = Column(String)
    signature = Column(Text)
    signature_algorithm = Column(String, default="sha256-rsa")
    signature_verified = Column(Boolean, default=False)
    verification_time = Column(DateTime)
    status = Column(String, index=True, default="pending")
    exception_requested = Column(Boolean, default=False)
    exception_approved = Column(Boolean, default=False)
    exception_approver = Column(String)
    exception_reason = Column(Text)
    exception_time = Column(DateTime)
    provenance_bundle_path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('image_tag', 'commit_hash', 'pipeline_id', name='_image_commit_pipeline_uc'),
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    if 'sqlite' in DATABASE_URL:
        from sqlalchemy import event
        @event.listens_for(Base.metadata, 'before_create')
        def receive_before_create(target, connection, **kw):
            connection.execute(text("PRAGMA foreign_keys=ON"))
    
    Base.metadata.create_all(bind=engine)
