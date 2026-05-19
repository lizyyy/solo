import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from pathlib import Path
import tempfile

from app.main import app
from app.database import Base, get_db
from app.config import settings


@pytest.fixture(scope="function")
def db_session():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        temp_db_path = tmp.name
    
    try:
        engine = create_engine(
            f"sqlite:///{temp_db_path}", connect_args={"check_same_thread": False}
        )
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        Base.metadata.create_all(bind=engine)
        
        db = TestingSessionLocal()
        yield db
        db.close()
    finally:
        Path(temp_db_path).unlink(missing_ok=True)


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


@pytest.fixture(scope="function")
def sample_fixture_data():
    return {
        "request_method": "POST",
        "request_url": "https://example.com/webhook",
        "request_headers": {
            "Content-Type": "application/json",
            "User-Agent": "Webhook-Client/1.0"
        },
        "signature_headers": {
            "X-Signature": "sha256=abc123def456",
            "X-Timestamp": "1620000000"
        },
        "raw_payload": '{"event_type":"payment.completed","data":{"id":"pay_123","amount":100.00,"currency":"CNY"}}',
        "handler": "tester"
    }
