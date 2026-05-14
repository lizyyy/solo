from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings


Base = declarative_base()

_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        if settings.DATABASE_TYPE == "sqlite":
            _engine = create_engine(
                settings.DATABASE_URL,
                connect_args={"check_same_thread": False},
                echo=False,
            )
        else:
            _engine = create_engine(
                settings.DATABASE_URL,
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20,
                echo=False,
            )
    return _engine


def get_session_local():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=get_engine(),
        )
    return _SessionLocal


def init_database():
    from app.models import (
        LoanAccount, RepaymentPlan, RepaymentPlanHistory, RepaymentInstallment,
        ExtensionApplication, PenaltySnapshot, CreditLimitRecord,
        ApprovalHistory, RuleCheckSnapshot, AuditLog, TaskRecord
    )
    Base.metadata.create_all(bind=get_engine())


def get_db():
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session():
    SessionLocal = get_session_local()
    return SessionLocal()
