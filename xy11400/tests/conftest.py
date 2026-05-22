import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from app.database import Base, get_db
from app.config import settings

TEST_DATABASE_URL = "sqlite:///./test_cold_chain.db"

engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def auth_headers(client):
    from app.auth import create_initial_users
    db = TestingSessionLocal()
    create_initial_users(db)
    db.close()

    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def operator_auth_headers(client):
    from app.auth import create_initial_users
    db = TestingSessionLocal()
    create_initial_users(db)
    db.close()

    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "operator", "password": "operator123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def reviewer_auth_headers(client):
    from app.auth import create_initial_users
    db = TestingSessionLocal()
    create_initial_users(db)
    db.close()

    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "reviewer", "password": "reviewer123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def viewer_auth_headers(client):
    from app.auth import create_initial_users
    db = TestingSessionLocal()
    create_initial_users(db)
    db.close()

    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        data={"username": "viewer", "password": "viewer123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
