import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.main import app
from app.models import (
    Tool,
    PermissionDeclaration,
    ActualCall,
    ApprovalBatch,
    ExceptionRecord,
    ToolStatus,
    ApprovalStatus,
    ExceptionStatus,
)

TEST_DATABASE_URL = "sqlite:///./test_mcp_permission.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function")
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client():
    return TestClient(app)


@pytest.fixture(scope="function")
def test_data(db):
    tool = Tool(
        name="test_tool",
        mcp_server="test_server",
        description="Test tool",
        version="1.0.0",
        status=ToolStatus.ACTIVE,
    )
    db.add(tool)
    db.commit()

    batch = ApprovalBatch(
        batch_number="TEST-001",
        title="Test Batch",
        description="Test batch description",
        submitter="admin@example.com",
        status=ApprovalStatus.PENDING,
    )
    db.add(batch)
    db.commit()

    declaration = PermissionDeclaration(
        tool_id=tool.id,
        batch_id=batch.id,
        declared_scopes=["read:test", "write:test"],
        declared_resources=["/test/path"],
        declared_actions=["action1", "action2"],
        declared_description="Test declaration",
        declared_by="admin@example.com",
    )
    db.add(declaration)
    db.commit()

    call = ActualCall(
        tool_id=tool.id,
        call_id="test_call_001",
        actual_scopes=["read:test"],
        actual_resources=["/test/path/data"],
        actual_actions=["action1"],
        caller="user@example.com",
        call_time=datetime.utcnow(),
    )
    db.add(call)
    db.commit()

    exception = ExceptionRecord(
        batch_id=batch.id,
        tool_id=tool.id,
        title="Test Exception",
        description="Test exception description",
        exception_type="test_mismatch",
        original_input={"test": "data"},
        status=ExceptionStatus.OPEN,
    )
    db.add(exception)
    db.commit()

    return {
        "tool": tool,
        "batch": batch,
        "declaration": declaration,
        "call": call,
        "exception": exception,
    }
