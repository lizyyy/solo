import os
import hashlib
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from .models import (
    Base, User, Role, ImportBatch, ColdChainRecord,
    RecordIssue, FixHistory, OperationLog
)

DB_PATH = os.path.expanduser("~/.cold_chain_inspector/cold_chain.db")


def get_engine():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    return create_engine(f"sqlite:///{DB_PATH}")


def get_session():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    return Session()


def init_database():
    engine = get_engine()
    Base.metadata.create_all(engine)
    return True


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def create_default_users(session):
    default_users = [
        {"username": "entry", "password": "entry123", "role": Role.DATA_ENTRY},
        {"username": "reviewer", "password": "reviewer123", "role": Role.REVIEWER},
        {"username": "supervisor", "password": "supervisor123", "role": Role.SUPERVISOR},
        {"username": "viewer", "password": "viewer123", "role": Role.READ_ONLY},
    ]
    
    for user_data in default_users:
        existing = session.query(User).filter_by(username=user_data["username"]).first()
        if not existing:
            user = User(
                username=user_data["username"],
                password_hash=hash_password(user_data["password"]),
                role=user_data["role"]
            )
            session.add(user)
    
    session.commit()


def authenticate(session, username, password):
    user = session.query(User).filter_by(username=username).first()
    if user and user.password_hash == hash_password(password):
        user.last_login = datetime.now()
        session.commit()
        return user
    return None


def log_operation(session, user, action, resource_type=None, resource_id=None, details=None):
    log = OperationLog(
        user_id=user.id if user else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details
    )
    session.add(log)
    session.commit()
    return log


def generate_batch_no():
    return f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}
