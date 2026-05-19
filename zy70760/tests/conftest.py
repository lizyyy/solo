import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tempfile
import os

from app.database import get_db
from app.models import Base
from app.main import app

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
    yield TestClient(app)
    del app.dependency_overrides[get_db]


@pytest.fixture
def sample_wheel_file():
    import zipfile
    import io

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as zf:
        dist_info = "test_package-1.0.0.dist-info"
        zf.writestr(f"{dist_info}/METADATA", """Metadata-Version: 2.1
Name: test-package
Version: 1.0.0
Summary: A test package
Home-page: https://example.com
Author: Test Author
Author-email: test@example.com
License: MIT
Classifier: Programming Language :: Python :: 3
Requires-Python: >=3.7
Requires-Dist: requests>=2.0
Requires-Dist: pydantic>=1.0

Test package description.
""")
        zf.writestr(f"{dist_info}/entry_points.txt", """[console_scripts]
test-cli = test_package.cli:main

[gui_scripts]
test-gui = test_package.gui:run
""")

    buffer.seek(0)
    return buffer, "test_package-1.0.0-py3-none-any.whl"
