import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import sys
sys.path.insert(0, '.')

from main import app
from database import Base, get_db

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "healthy"
    assert "timestamp" in data


def test_create_audit(client):
    test_lockfile = {
        "name": "test-project",
        "lockfileVersion": 2,
        "packages": {
            "node_modules/express": {
                "version": "4.18.2",
                "resolved": "https://registry.npmjs.org/express/-/express-4.18.2.tgz",
                "integrity": "sha512-5/PsL6iGPdfQ/lKM1UuielYgv3BUoJfz1aUwU9vHZ+J7gyvwdQXFEBIEIaxeGf0GIcreATNyBExtalisDbuMqQ=="
            }
        }
    }

    response = client.post(
        "/api/audits",
        json={
            "name": "test-audit",
            "lockfile_type": "package-lock.json",
            "created_by": "test-user",
            "notes": "test notes",
            "content": json.dumps(test_lockfile)
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test-audit"
    assert data["status"] == "processing"
    assert "content_hash" in data
    assert len(data["packages"]) == 1
    assert data["packages"][0]["package_name"] == "express"


def test_list_audits(client):
    test_lockfile = {
        "name": "test-project",
        "lockfileVersion": 2,
        "packages": {}
    }

    for i in range(3):
        client.post(
            "/api/audits",
            json={
                "name": f"test-audit-{i}",
                "lockfile_type": "package-lock.json",
                "content": json.dumps(test_lockfile)
            }
        )

    response = client.get("/api/audits")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3


def test_get_audit(client):
    test_lockfile = {
        "name": "test-project",
        "lockfileVersion": 2,
        "packages": {}
    }

    create_response = client.post(
        "/api/audits",
        json={
            "name": "test-audit",
            "lockfile_type": "package-lock.json",
            "content": json.dumps(test_lockfile)
        }
    )
    audit_id = create_response.json()["id"]

    response = client.get(f"/api/audits/{audit_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == audit_id
    assert data["name"] == "test-audit"


def test_get_audit_not_found(client):
    response = client.get("/api/audits/9999")
    assert response.status_code == 404
    assert "detail" in response.json()


def test_update_audit_status(client):
    test_lockfile = {
        "name": "test-project",
        "lockfileVersion": 2,
        "packages": {}
    }

    create_response = client.post(
        "/api/audits",
        json={
            "name": "test-audit",
            "lockfile_type": "package-lock.json",
            "content": json.dumps(test_lockfile)
        }
    )
    audit_id = create_response.json()["id"]

    response = client.patch(
        f"/api/audits/{audit_id}/status",
        json={
            "status": "needs_review",
            "notes": "updated notes"
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "needs_review"
    assert data["notes"] == "updated notes"


def test_close_audit(client):
    test_lockfile = {
        "name": "test-project",
        "lockfileVersion": 2,
        "packages": {}
    }

    create_response = client.post(
        "/api/audits",
        json={
            "name": "test-audit",
            "lockfile_type": "package-lock.json",
            "content": json.dumps(test_lockfile)
        }
    )
    audit_id = create_response.json()["id"]

    response = client.delete(f"/api/audits/{audit_id}/close?notes=测试关闭")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "audit" in data
    assert data["audit"]["status"] == "closed"
    assert data["audit"]["notes"] == "测试关闭"


def test_export_audit(client):
    test_lockfile = {
        "name": "test-project",
        "lockfileVersion": 2,
        "packages": {
            "node_modules/lodash": {
                "version": "4.17.21",
                "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
                "integrity": "sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=="
            }
        }
    }

    create_response = client.post(
        "/api/audits",
        json={
            "name": "test-audit-export",
            "lockfile_type": "package-lock.json",
            "content": json.dumps(test_lockfile)
        }
    )
    audit_id = create_response.json()["id"]

    response = client.get(f"/api/audits/{audit_id}/export")
    assert response.status_code == 200
    data = response.json()
    assert data["audit_id"] == audit_id
    assert data["name"] == "test-audit-export"
    assert "exported_at" in data
    assert "summary" in data
    assert "packages" in data


def test_manual_correction(client):
    test_lockfile = {
        "name": "test-project",
        "lockfileVersion": 2,
        "packages": {
            "node_modules/suspicious": {
                "version": "1.0.0",
                "resolved": "https://unknown-registry.com/suspicious/-/suspicious-1.0.0.tgz",
                "integrity": "sha512-fakehashfakehashfakehashfakehashfakehashfakehashfakehashfakehash=="
            }
        }
    }

    create_response = client.post(
        "/api/audits",
        json={
            "name": "test-audit-correct",
            "lockfile_type": "package-lock.json",
            "content": json.dumps(test_lockfile)
        }
    )
    audit_id = create_response.json()["id"]

    response = client.post(
        f"/api/audits/{audit_id}/correct",
        json={
            "package_name": "suspicious",
            "version": "1.0.0",
            "correct_registry": "https://registry.npmjs.org",
            "correct_hash": "sha512-realhashrealhashrealhashrealhashrealhashrealhashrealhashrealhash==",
            "handler": "security-engineer",
            "reason": "确认是合法包，registry 配置错误"
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert "package" in data
    assert "exception" in data
    assert data["package"]["status"] == "normal"
    assert data["package"]["registry"] == "https://registry.npmjs.org"
    assert data["exception"]["resolved"] == True
    assert data["exception"]["handler"] == "security-engineer"


def test_list_exceptions(client):
    test_lockfile = {
        "name": "test-project",
        "lockfileVersion": 2,
        "packages": {}
    }

    create_response = client.post(
        "/api/audits",
        json={
            "name": "test-audit",
            "lockfile_type": "package-lock.json",
            "content": json.dumps(test_lockfile)
        }
    )
    audit_id = create_response.json()["id"]

    response = client.get(f"/api/audits/{audit_id}/exceptions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_parser_lockfile():
    from parser import LockfileParser

    parser = LockfileParser()

    test_lockfile = {
        "name": "test-project",
        "lockfileVersion": 2,
        "packages": {
            "node_modules/express": {
                "version": "4.18.2",
                "resolved": "https://registry.npmjs.org/express/-/express-4.18.2.tgz",
                "integrity": "sha512-test=="
            }
        }
    }

    packages, errors = parser.parse(json.dumps(test_lockfile), "package-lock.json")
    assert len(errors) == 0
    assert len(packages) == 1
    assert packages[0]["package_name"] == "express"
    assert packages[0]["version"] == "4.18.2"
    assert packages[0]["registry"] == "https://registry.npmjs.org"


def test_auditor_hash_verification():
    from auditor import HashAuditor

    auditor = HashAuditor()

    hash_type, hash_value = auditor._parse_integrity("sha512-5/PsL6iGPdfQ/lKM1UuielYgv3BUoJfz1aUwU9vHZ+J7gyvwdQXFEBIEIaxeGf0GIcreATNyBExtalisDbuMqQ==")
    assert hash_type == "sha512"
    assert hash_value is not None

    hash_type, hash_value = auditor._parse_integrity("sha256:abcdef123456")
    assert hash_type == "sha512"


def test_registry_extraction():
    from parser import LockfileParser

    parser = LockfileParser()

    registry = parser._extract_registry("https://registry.npmjs.org/express/-/express-4.18.2.tgz")
    assert registry == "https://registry.npmjs.org"

    registry = parser._extract_registry("https://unknown.com/package.tgz")
    assert registry == "https://unknown.com"
