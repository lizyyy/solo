import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db, Base
from app.models import User
from app.models.enums import UserRole
from app.services.auth_service import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    users = [
        {"username": "sorter1", "full_name": "分拣员张三", "role": UserRole.SORTER, "password": "123456"},
        {"username": "supervisor1", "full_name": "主管李四", "role": UserRole.SUPERVISOR, "password": "123456"},
        {"username": "manager1", "full_name": "采购经理王五", "role": UserRole.PROCUREMENT_MANAGER, "password": "123456"},
        {"username": "auditor1", "full_name": "审计员赵六", "role": UserRole.AUDITOR, "password": "123456"},
    ]
    
    for user_data in users:
        db_user = User(
            username=user_data["username"],
            full_name=user_data["full_name"],
            role=user_data["role"],
            hashed_password=get_password_hash(user_data["password"])
        )
        db.add(db_user)
    db.commit()
    
    yield db
    
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client():
    return TestClient(app)


def get_token(client, username, password="123456"):
    response = client.post(
        "/auth/login",
        data={"username": username, "password": password}
    )
    return response.json()["access_token"]
