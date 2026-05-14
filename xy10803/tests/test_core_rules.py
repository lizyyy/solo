import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.data_template import DataTemplate
from app.models.tenant_sandbox import TenantSandbox
from app.models.seed_batch import SeedBatch
from app.services.batch_service import BatchService
from app.services.template_service import TemplateService
from app.services.cleanup_service import CleanupService

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def test_template(db_session):
    template = DataTemplate(
        name="测试模板",
        description="测试用",
        template_type="test",
        sql_template="SELECT * FROM test WHERE id = {{test_id}};",
        parameters=[{"name": "test_id", "required": True}],
        is_active=True,
        version="1.0"
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)
    return template

@pytest.fixture
def test_sandbox(db_session):
    sandbox = TenantSandbox(
        tenant_id="TEST_001",
        name="测试沙箱",
        environment="test",
        is_active=True
    )
    db_session.add(sandbox)
    db_session.commit()
    db_session.refresh(sandbox)
    return sandbox

class TestTemplateRendering:
    def test_template_rendering_with_parameters(self, test_template):
        parameters = {"test_id": "123"}
        rendered = TemplateService.render_template(test_template, parameters)
        assert "123" in rendered
        assert "SELECT" in rendered

    def test_parameter_validation_valid(self, test_template):
        parameters = {"test_id": "123"}
        is_valid, errors = TemplateService.validate_parameters(test_template, parameters)
        assert is_valid
        assert len(errors) == 0

    def test_parameter_validation_missing_required(self, test_template):
        parameters = {}
        is_valid, errors = TemplateService.validate_parameters(test_template, parameters)
        assert not is_valid
        assert len(errors) > 0

class TestBatchExecution:
    def test_create_batch(self, db_session, test_template, test_sandbox):
        from app.schemas.seed_batch import SeedBatchCreate
        batch_create = SeedBatchCreate(
            sandbox_id=test_sandbox.id,
            template_id=test_template.id,
            parameters={"test_id": "456"},
            created_by="test_user"
        )
        batch = BatchService.create_batch(db_session, batch_create)
        assert batch.id is not None
        assert batch.status == "pending"
        assert batch.batch_no.startswith("BATCH-")

    def test_execute_batch_success(self, db_session, test_template, test_sandbox):
        from app.schemas.seed_batch import SeedBatchCreate
        batch_create = SeedBatchCreate(
            sandbox_id=test_sandbox.id,
            template_id=test_template.id,
            parameters={"test_id": "789"},
            created_by="test_user"
        )
        batch = BatchService.create_batch(db_session, batch_create)
        success, message = BatchService.execute_batch(db_session, batch.id)
        assert success
        
        updated_batch = BatchService.get_batch(db_session, batch.id)
        assert updated_batch.status == "completed"
        assert updated_batch.executed_at is not None
        assert updated_batch.completed_at is not None

class TestIdempotency:
    def test_idempotent_execution(self, db_session, test_template, test_sandbox):
        from app.schemas.seed_batch import SeedBatchCreate
        
        batch_create = SeedBatchCreate(
            sandbox_id=test_sandbox.id,
            template_id=test_template.id,
            parameters={"test_id": "repeat_test"},
            created_by="test_user"
        )
        batch1 = BatchService.create_batch(db_session, batch_create)
        BatchService.execute_batch(db_session, batch1.id)
        
        batch2 = BatchService.create_batch(db_session, batch_create)
        success, message = BatchService.execute_batch(db_session, batch2.id)
        
        assert success
        updated_batch = BatchService.get_batch(db_session, batch2.id)
        assert updated_batch.is_idempotent == 1
        assert "idempotent" in message.lower()

class TestCleanupAndRollback:
    def test_rollback_batch(self, db_session, test_template, test_sandbox):
        from app.schemas.seed_batch import SeedBatchCreate
        batch_create = SeedBatchCreate(
            sandbox_id=test_sandbox.id,
            template_id=test_template.id,
            parameters={"test_id": "rollback_test"},
            created_by="test_user"
        )
        batch = BatchService.create_batch(db_session, batch_create)
        BatchService.execute_batch(db_session, batch.id)
        
        success, message = CleanupService.rollback_batch(db_session, batch.id)
        assert success
        
        updated_batch = BatchService.get_batch(db_session, batch.id)
        assert updated_batch.status == "rolled_back"

class TestBatchReport:
    def test_get_batch_report(self, db_session, test_template, test_sandbox):
        from app.schemas.seed_batch import SeedBatchCreate
        batch_create = SeedBatchCreate(
            sandbox_id=test_sandbox.id,
            template_id=test_template.id,
            parameters={"test_id": "report_test"},
            created_by="test_user"
        )
        batch = BatchService.create_batch(db_session, batch_create)
        BatchService.execute_batch(db_session, batch.id)
        
        report = BatchService.get_batch_report(db_session, batch.id)
        
        assert report is not None
        assert "batch" in report
        assert "logs" in report
        assert len(report["logs"]) > 0
        assert "total_duration_ms" in report

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
