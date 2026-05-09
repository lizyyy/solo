import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, '.')

from app.database import Base, get_db
from app.main import app
from app.models import User, UserRole, Reissue, ReissueStatus
from app.security import get_password_hash

SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def _get_or_create_user(db, username, email, password, full_name, role):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role=role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@pytest.fixture
def test_user(db):
    return _get_or_create_user(
        db, "testuser", "test@example.com", "testpass123", "Test User", UserRole.CS
    )

@pytest.fixture
def test_admin(db):
    return _get_or_create_user(
        db, "testadmin", "admin@example.com", "admin123", "Test Admin", UserRole.ADMIN
    )

@pytest.fixture
def test_manager(db):
    return _get_or_create_user(
        db, "testmanager", "manager@example.com", "manager123", "Test Manager", UserRole.MANAGER
    )

@pytest.fixture
def test_operator(db):
    return _get_or_create_user(
        db, "testoperator", "operator@example.com", "operator123", "Test Operator", UserRole.OPERATOR
    )

@pytest.fixture
def auth_token(client, test_user):
    response = client.post(
        "/api/auth/login",
        data={"username": "testuser", "password": "testpass123"}
    )
    return response.json()["access_token"]

@pytest.fixture
def admin_token(client, test_admin):
    response = client.post(
        "/api/auth/login",
        data={"username": "testadmin", "password": "admin123"}
    )
    return response.json()["access_token"]

@pytest.fixture
def manager_token(client, test_manager):
    response = client.post(
        "/api/auth/login",
        data={"username": "testmanager", "password": "manager123"}
    )
    return response.json()["access_token"]

@pytest.fixture
def operator_token(client, test_operator):
    response = client.post(
        "/api/auth/login",
        data={"username": "testoperator", "password": "operator123"}
    )
    return response.json()["access_token"]

@pytest.fixture
def test_reissue(db, test_user):
    reissue = db.query(Reissue).filter(Reissue.order_no == "TEST001").first()
    if not reissue:
        reissue = Reissue(
            order_no="TEST001",
            customer_name="Test Customer",
            customer_phone="13800000000",
            address="Test Address",
            product_name="Test Product",
            product_sku="SKU-TEST",
            quantity=1,
            reason="Test Reason",
            description="Test Description",
            status=ReissueStatus.PENDING,
            created_by=test_user.id,
            assigned_to=test_user.id,
            version=1
        )
        db.add(reissue)
        db.commit()
        db.refresh(reissue)
    return reissue
