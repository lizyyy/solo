import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import Base, get_db
from app.main import app
from app.auth import create_access_token, get_password_hash
from app.models import User, UserRole

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    users = [
        ("entry_user", "entry123", UserRole.ENTRY),
        ("review_user", "review123", UserRole.REVIEW),
        ("supervisor_user", "super123", UserRole.SUPERVISOR),
        ("readonly_user", "readonly123", UserRole.READONLY),
    ]
    for username, password, role in users:
        hashed_pwd = get_password_hash(password)
        user = User(username=username, hashed_password=hashed_pwd, role=role)
        db.add(user)
    db.commit()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def entry_token():
    return create_access_token(data={"sub": "entry_user"})


@pytest.fixture
def review_token():
    return create_access_token(data={"sub": "review_user"})


@pytest.fixture
def supervisor_token():
    return create_access_token(data={"sub": "supervisor_user"})


@pytest.fixture
def readonly_token():
    return create_access_token(data={"sub": "readonly_user"})
