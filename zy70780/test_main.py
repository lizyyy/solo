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
    from models import PackageStatus

    auditor = HashAuditor()

    hash_type, hash_value = auditor._parse_integrity("sha512-5/PsL6iGPdfQ/lKM1UuielYgv3BUoJfz1aUwU9vHZ+J7gyvwdQXFEBIEIaxeGf0GIcreATNyBExtalisDbuMqQ==")
    assert hash_type == "sha512"
    assert hash_value is not None

    hash_type, hash_value = auditor._parse_integrity("sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
    assert hash_type == "sha256"
    assert hash_value == "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

    hash_type, hash_value = auditor._parse_integrity("sha512:abcdef123456")
    assert hash_type == "sha512"
    assert hash_value == "abcdef123456"

    is_valid, status, result = auditor.verify_hash("test-package", "1.0.0", "invalid-hash", "https://registry.npmjs.org")
    assert status == PackageStatus.UNVERIFIED
    assert is_valid == False


def test_parser_scoped_package():
    from parser import LockfileParser

    parser = LockfileParser()

    test_lockfile = {
        "name": "test-project",
        "lockfileVersion": 2,
        "packages": {
            "node_modules/@angular/core": {
                "version": "16.0.0",
                "resolved": "https://registry.npmjs.org/@angular/core/-/core-16.0.0.tgz",
                "integrity": "sha512-test=="
            }
        }
    }

    packages, errors = parser.parse(json.dumps(test_lockfile), "package-lock.json")
    assert len(errors) == 0
    assert len(packages) == 1
    assert packages[0]["package_name"] == "@angular/core"
    assert packages[0]["version"] == "16.0.0"


def test_registry_extraction():
    from parser import LockfileParser

    parser = LockfileParser()

    registry = parser._extract_registry("https://registry.npmjs.org/express/-/express-4.18.2.tgz")
    assert registry == "https://registry.npmjs.org"

    registry = parser._extract_registry("https://unknown.com/package.tgz")
    assert registry == "https://unknown.com"


def test_poetry_pipfile_hash_parsing():
    from auditor import HashAuditor

    auditor = HashAuditor()

    hash_type, hash_value = auditor._parse_integrity("sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
    assert hash_type == "sha256"
    assert hash_value == "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

    hash_type, hash_value = auditor._parse_integrity("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
    assert hash_type == "sha256"


def test_pypi_urls_field_parsing():
    from auditor import HashAuditor
    from unittest.mock import patch, MagicMock
    from models import PackageStatus

    auditor = HashAuditor()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "info": {"name": "requests", "version": "2.31.0"},
        "urls": [
            {
                "filename": "requests-2.31.0-py3-none-any.whl",
                "digests": {
                    "sha256": "a" * 64
                }
            }
        ]
    }

    result = {}
    with patch('requests.get', return_value=mock_response):
        actual_hashes, result = auditor._fetch_from_registry(
            "requests", "2.31.0", "https://pypi.org/simple", "sha256", result
        )
        assert isinstance(actual_hashes, list)
        assert len(actual_hashes) == 1
        assert "a" * 64 in actual_hashes
        assert result.get("error_message") is None


def test_verify_hash_pypi_integration():
    from auditor import HashAuditor
    from unittest.mock import patch, MagicMock
    from models import PackageStatus

    auditor = HashAuditor()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "info": {"name": "requests", "version": "2.31.0"},
        "urls": [
            {
                "filename": "requests-2.31.0-py3-none-any.whl",
                "digests": {
                    "sha256": "a" * 64
                }
            }
        ]
    }

    with patch('requests.get', return_value=mock_response):
        is_valid, status, result = auditor.verify_hash(
            "requests", "2.31.0",
            f"sha256:{'a' * 64}",
            "https://pypi.org/simple"
        )
        assert is_valid == True
        assert status == PackageStatus.NORMAL
        assert result.get("found") == True
        assert result.get("hash_match") == True


def test_pypi_multiple_files_hash_match():
    from auditor import HashAuditor
    from unittest.mock import patch, MagicMock
    from models import PackageStatus

    auditor = HashAuditor()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "info": {"name": "requests", "version": "2.31.0"},
        "urls": [
            {
                "filename": "requests-2.31.0-py3-none-any.whl",
                "digests": {"sha256": "a" * 64}  # Valid sha256 hex hash
            },
            {
                "filename": "requests-2.31.0.tar.gz",
                "digests": {"sha256": "b" * 64}  # Valid sha256 hex hash
            }
        ]
    }

    with patch('requests.get', return_value=mock_response):
        is_valid, status, result = auditor.verify_hash(
            "requests", "2.31.0",
            f"sha256:{'b' * 64}",  # Match the sdist hash
            "https://pypi.org/simple"
        )
        assert is_valid == True
        assert status == PackageStatus.NORMAL
        assert result.get("found") == True
        assert result.get("hash_match") == True
        assert result.get("candidates_count") == 2


def test_pipfile_index_pypi_mapping():
    from parser import LockfileParser

    parser = LockfileParser()

    pipfile_lock_content = json.dumps({
        "default": {
            "requests": {
                "version": "==2.31.0",
                "index": "pypi",
                "hashes": [
                    "sha256:e6f7002f50ea85fa369c28b5201395404c2f8b469f830e0"
                ]
            }
        },
        "develop": {}
    })

    packages, errors = parser.parse(pipfile_lock_content, "pipfile.lock")
    assert len(errors) == 0
    assert len(packages) == 1
    assert packages[0]["registry"] == "https://pypi.org/simple"
    assert packages[0]["package_name"] == "requests"
    assert packages[0]["version"] == "2.31.0"


def test_yarn_scoped_multi_selector():
    from parser import LockfileParser

    parser = LockfileParser()

    yarn_lock_content = '''
"@babel/core@^7.0.0", "@babel/core@^7.1.0":
  version "7.18.5"
  resolved "https://registry.npmjs.org/@babel/core/-/core-7.18.5.tgz"
  integrity sha512-JGYANYP5Q8g7A6Q6PWwKz/B2jM2qM2qM2qM2qM2qM2q==

lodash@^4.17.0:
  version "4.17.21"
  resolved "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"
  integrity sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==
'''

    packages, errors = parser.parse(yarn_lock_content, "yarn.lock")
    assert len(errors) == 0
    assert len(packages) == 2

    babel_pkg = next((p for p in packages if p["package_name"] == "@babel/core"), None)
    assert babel_pkg is not None
    assert babel_pkg["version"] == "7.18.5"
    assert babel_pkg["registry"] == "https://registry.npmjs.org"
    assert "sha512-JGYANYP5" in babel_pkg["integrity_hash"]

    lodash_pkg = next((p for p in packages if p["package_name"] == "lodash"), None)
    assert lodash_pkg is not None
    assert lodash_pkg["version"] == "4.17.21"


def test_pnpm_lock_resolution_integrity():
    from parser import LockfileParser

    parser = LockfileParser()

    pnpm_lock_content = '''
lockfileVersion: '6.0'

packages:
  /express/4.18.2:
    resolution:
      tarball: https://registry.npmjs.org/express/-/express-4.18.2.tgz
      integrity: sha512-5/PsL6iGPdfQ/lKM1UuielYgv3BUoJfz1aUwU9vHZ+J7gyvwdQXFEBIEIaxeGf0GIcreATNyBExtalisDbuMqQ==
    version: 4.18.2

  /lodash/4.17.21:
    resolution:
      tarball: https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz
    integrity: sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==
    version: 4.17.21
'''

    packages, errors = parser.parse(pnpm_lock_content, "pnpm-lock.yaml")
    assert len(errors) == 0
    assert len(packages) == 2

    express_pkg = next((p for p in packages if p["package_name"] == "express"), None)
    assert express_pkg is not None
    assert express_pkg["version"] == "4.18.2"
    assert "sha512-5/PsL6iGPdf" in express_pkg["integrity_hash"]

    lodash_pkg = next((p for p in packages if p["package_name"] == "lodash"), None)
    assert lodash_pkg is not None
    assert lodash_pkg["version"] == "4.17.21"
    assert "sha512-v2kDEe57lecT" in lodash_pkg["integrity_hash"]


def test_pnpm_scoped_package_parsing():
    from parser import LockfileParser

    parser = LockfileParser()

    pnpm_lock_content = '''
lockfileVersion: '6.0'

packages:
  /@babel/core/7.18.5:
    resolution:
      tarball: https://registry.npmjs.org/@babel/core/-/core-7.18.5.tgz
      integrity: sha512-JGYANYP5Q8g7A6Q6PWwKz/B2jM2qM2qM2qM2qM2qM2q==
    version: 7.18.5
'''

    packages, errors = parser.parse(pnpm_lock_content, "pnpm-lock.yaml")
    assert len(errors) == 0
    assert len(packages) == 1

    assert packages[0]["package_name"] == "@babel/core"
    assert packages[0]["version"] == "7.18.5"
    assert "sha512-JGYANYP5" in packages[0]["integrity_hash"]
