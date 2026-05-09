import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.models.role import Role, UserRole
from app.services.auth_service import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="function")
def test_user(db_session):
    role = Role(name="测试角色", code="test_role", is_system=False)
    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)

    user = User(
        username="testuser",
        email="test@example.com",
        password_hash=get_password_hash("test123456"),
        full_name="测试用户",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    user_role = UserRole(user_id=user.id, role_id=role.id)
    db_session.add(user_role)
    db_session.commit()

    return user


@pytest.fixture(scope="function")
def auth_headers(client, test_user):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "test123456"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
