import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import models, schemas, services
from app.database import Base


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


class TestFieldVersionHash:
    def test_same_fields_produce_same_hash(self):
        fields1 = [
            {"name": "id", "type": "integer", "nullable": False},
            {"name": "name", "type": "string", "nullable": True}
        ]
        fields2 = [
            {"name": "id", "type": "integer", "nullable": False},
            {"name": "name", "type": "string", "nullable": True}
        ]
        hash1 = services.generate_hash(fields1)
        hash2 = services.generate_hash(fields2)
        assert hash1 == hash2

    def test_different_fields_produce_different_hash(self):
        fields1 = [
            {"name": "id", "type": "integer", "nullable": False},
            {"name": "name", "type": "string", "nullable": True}
        ]
        fields2 = [
            {"name": "id", "type": "bigint", "nullable": False},
            {"name": "name", "type": "string", "nullable": True}
        ]
        hash1 = services.generate_hash(fields1)
        hash2 = services.generate_hash(fields2)
        assert hash1 != hash2


class TestFieldComparison:
    def test_compare_identical_fields(self):
        fields1 = [
            {"name": "id", "type": "integer"},
            {"name": "name", "type": "string"}
        ]
        fields2 = [
            {"name": "id", "type": "integer"},
            {"name": "name", "type": "string"}
        ]
        result = services.compare_field_definitions(fields1, fields2)
        assert len(result['added_fields']) == 0
        assert len(result['removed_fields']) == 0
        assert len(result['modified_fields']) == 0
        assert len(result['unchanged_fields']) == 2

    def test_compare_added_field(self):
        fields1 = [{"name": "id", "type": "integer"}]
        fields2 = [
            {"name": "id", "type": "integer"},
            {"name": "new_field", "type": "string"}
        ]
        result = services.compare_field_definitions(fields1, fields2)
        assert len(result['added_fields']) == 1
        assert result['added_fields'][0]['name'] == 'new_field'

    def test_compare_removed_field(self):
        fields1 = [
            {"name": "id", "type": "integer"},
            {"name": "old_field", "type": "string"}
        ]
        fields2 = [{"name": "id", "type": "integer"}]
        result = services.compare_field_definitions(fields1, fields2)
        assert len(result['removed_fields']) == 1
        assert result['removed_fields'][0]['name'] == 'old_field'

    def test_compare_modified_field(self):
        fields1 = [{"name": "id", "type": "integer", "nullable": True}]
        fields2 = [{"name": "id", "type": "integer", "nullable": False}]
        result = services.compare_field_definitions(fields1, fields2)
        assert len(result['modified_fields']) == 1
        assert result['modified_fields'][0]['name'] == 'id'


class TestCriticalChangeDetection:
    def test_remove_field_is_critical(self):
        assert services.is_critical_field_change(
            models.FieldChangeType.REMOVE,
            {"name": "old_field", "type": "string"},
            None
        ) == True

    def test_rename_field_is_critical(self):
        assert services.is_critical_field_change(
            models.FieldChangeType.RENAME,
            {"name": "old_name", "type": "string"},
            {"new_name": "new_name"}
        ) == True

    def test_type_change_to_incompatible_is_critical(self):
        assert services.is_critical_field_change(
            models.FieldChangeType.MODIFY,
            {"name": "field", "type": "string"},
            {"name": "field", "type": "integer"}
        ) == True

    def test_nullable_to_not_nullable_is_critical(self):
        assert services.is_critical_field_change(
            models.FieldChangeType.MODIFY,
            {"name": "field", "type": "integer", "nullable": True},
            {"name": "field", "type": "integer", "nullable": False}
        ) == True

    def test_compatible_type_change_not_critical(self):
        assert services.is_critical_field_change(
            models.FieldChangeType.MODIFY,
            {"name": "field", "type": "integer", "nullable": True},
            {"name": "field", "type": "bigint", "nullable": True}
        ) == False

    def test_add_field_not_critical(self):
        assert services.is_critical_field_change(
            models.FieldChangeType.ADD,
            None,
            {"name": "new_field", "type": "string", "nullable": True}
        ) == False


class TestRiskLevelCalculation:
    def test_critical_change_is_high_risk(self):
        assert services.calculate_risk_level(
            impacted_tables_count=1,
            impacted_jobs_count=1,
            impacted_metrics_count=1,
            is_critical=True
        ) == 'high'

    def test_large_impact_is_high_risk(self):
        assert services.calculate_risk_level(
            impacted_tables_count=15,
            impacted_jobs_count=5,
            impacted_metrics_count=3,
            is_critical=False
        ) == 'high'

    def test_medium_impact_is_medium_risk(self):
        assert services.calculate_risk_level(
            impacted_tables_count=4,
            impacted_jobs_count=2,
            impacted_metrics_count=1,
            is_critical=False
        ) == 'medium'

    def test_small_impact_is_low_risk(self):
        assert services.calculate_risk_level(
            impacted_tables_count=1,
            impacted_jobs_count=1,
            impacted_metrics_count=0,
            is_critical=False
        ) == 'low'


class TestTableVersionWorkflow:
    def test_create_table_with_initial_version(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            description="测试表",
            fields=[
                schemas.FieldDefinition(name="id", type="integer", nullable=False),
                schemas.FieldDefinition(name="name", type="string", nullable=True)
            ]
        )
        
        table = services.create_table_metadata(db_session, table_data, created_by="test_user")
        
        assert table.id is not None
        assert table.current_version == 1
        
        version = db_session.query(models.TableFieldVersion).filter(
            models.TableFieldVersion.table_id == table.id
        ).first()
        
        assert version is not None
        assert version.version == 1
        assert version.is_active == True
        assert len(version.fields) == 2

    def test_duplicate_table_raises_error(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        
        services.create_table_metadata(db_session, table_data)
        
        with pytest.raises(ValueError, match="已存在"):
            services.create_table_metadata(db_session, table_data)


class TestChangeRequestWorkflow:
    def test_create_add_field_change_request(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data)
        
        request_data = schemas.FieldChangeRequestCreate(
            table_id=table.id,
            change_type=models.FieldChangeType.ADD,
            field_name="new_field",
            new_value={"type": "string", "nullable": True},
            reason="业务需要新增字段",
            created_by="test_user"
        )
        
        change_request = services.create_field_change_request(db_session, request_data)
        
        assert change_request.id is not None
        assert change_request.status == models.ChangeStatus.DRAFT
        assert change_request.change_type == models.FieldChangeType.ADD
        assert change_request.field_name == "new_field"

    def test_remove_nonexistent_field_raises_error(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data)
        
        request_data = schemas.FieldChangeRequestCreate(
            table_id=table.id,
            change_type=models.FieldChangeType.REMOVE,
            field_name="nonexistent",
            created_by="test_user"
        )
        
        with pytest.raises(ValueError, match="不存在"):
            services.create_field_change_request(db_session, request_data)

    def test_apply_change_creates_new_version(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data)
        
        request_data = schemas.FieldChangeRequestCreate(
            table_id=table.id,
            change_type=models.FieldChangeType.ADD,
            field_name="new_field",
            new_value={"type": "string", "nullable": True},
            reason="测试",
            created_by="test_user"
        )
        change_request = services.create_field_change_request(db_session, request_data)
        
        services.submit_for_approval(db_session, change_request.id)
        services.approve_change(db_session, change_request.id, "approver@example.com")
        
        updated_request, new_version = services.apply_change(db_session, change_request.id, "operator@example.com")
        
        assert updated_request.status == models.ChangeStatus.APPLIED
        assert updated_request.applied_at is not None
        
        db_session.refresh(table)
        assert table.current_version == 2
        
        assert new_version.version == 2
        assert new_version.is_active == True
        assert len(new_version.fields) == 2
        
        old_version = db_session.query(models.TableFieldVersion).filter(
            models.TableFieldVersion.table_id == table.id,
            models.TableFieldVersion.version == 1
        ).first()
        assert old_version.is_active == False

    def test_rollback_restores_previous_version(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data)
        
        request_data = schemas.FieldChangeRequestCreate(
            table_id=table.id,
            change_type=models.FieldChangeType.ADD,
            field_name="new_field",
            new_value={"type": "string", "nullable": True},
            reason="测试",
            created_by="test_user"
        )
        change_request = services.create_field_change_request(db_session, request_data)
        
        services.submit_for_approval(db_session, change_request.id)
        services.approve_change(db_session, change_request.id, "approver@example.com")
        services.apply_change(db_session, change_request.id, "operator@example.com")
        
        db_session.refresh(table)
        assert table.current_version == 2
        
        rolled_back_request, restored_version = services.rollback_change(
            db_session,
            change_request.id,
            "发现问题需要回滚",
            "rollbacker@example.com"
        )
        
        assert rolled_back_request.status == models.ChangeStatus.ROLLED_BACK
        assert rolled_back_request.rollback_reason == "发现问题需要回滚"
        
        db_session.refresh(table)
        assert table.current_version == 1
        
        assert restored_version.version == 1
        assert restored_version.is_active == True


class TestStatusTransitions:
    def test_cannot_apply_unapproved_change(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data)
        
        request_data = schemas.FieldChangeRequestCreate(
            table_id=table.id,
            change_type=models.FieldChangeType.ADD,
            field_name="new_field",
            new_value={"type": "string"},
            created_by="test_user"
        )
        change_request = services.create_field_change_request(db_session, request_data)
        
        with pytest.raises(ValueError, match="只有 APPROVED"):
            services.apply_change(db_session, change_request.id)

    def test_cannot_submit_already_submitted_change(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data)
        
        request_data = schemas.FieldChangeRequestCreate(
            table_id=table.id,
            change_type=models.FieldChangeType.ADD,
            field_name="new_field",
            new_value={"type": "string"},
            created_by="test_user"
        )
        change_request = services.create_field_change_request(db_session, request_data)
        
        services.submit_for_approval(db_session, change_request.id)
        
        with pytest.raises(ValueError, match="只有 DRAFT"):
            services.submit_for_approval(db_session, change_request.id)

    def test_cannot_rollback_unapplied_change(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data)
        
        request_data = schemas.FieldChangeRequestCreate(
            table_id=table.id,
            change_type=models.FieldChangeType.ADD,
            field_name="new_field",
            new_value={"type": "string"},
            created_by="test_user"
        )
        change_request = services.create_field_change_request(db_session, request_data)
        
        with pytest.raises(ValueError, match="只有 APPLIED"):
            services.rollback_change(db_session, change_request.id, "reason", "user")


class TestOperationHistory:
    def test_create_table_records_history(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data, created_by="test_user")
        
        history = db_session.query(models.OperationHistory).filter(
            models.OperationHistory.entity_type == 'TableMetadata',
            models.OperationHistory.entity_id == table.id
        ).first()
        
        assert history is not None
        assert history.operation_type == 'CREATE'
        assert history.operation_by == 'test_user'
        assert history.new_state is not None

    def test_apply_change_records_history(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data)
        
        request_data = schemas.FieldChangeRequestCreate(
            table_id=table.id,
            change_type=models.FieldChangeType.ADD,
            field_name="new_field",
            new_value={"type": "string"},
            created_by="test_user"
        )
        change_request = services.create_field_change_request(db_session, request_data)
        
        services.submit_for_approval(db_session, change_request.id)
        services.approve_change(db_session, change_request.id, "approver@example.com")
        services.apply_change(db_session, change_request.id, "operator@example.com")
        
        history = db_session.query(models.OperationHistory).filter(
            models.OperationHistory.entity_type == 'FieldChangeRequest',
            models.OperationHistory.entity_id == change_request.id,
            models.OperationHistory.operation_type == 'APPLY'
        ).first()
        
        assert history is not None
        assert history.old_state['status'] == 'approved'
        assert history.new_state['status'] == 'applied'


class TestSubscriptionAndAlert:
    def test_create_subscription(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data)
        
        subscription_data = schemas.SubscriptionCreate(
            table_id=table.id,
            subscriber_id="user_001",
            subscriber_name="测试用户",
            subscriber_email="test@example.com",
            notification_channel="email"
        )
        
        subscription = services.create_subscription(db_session, subscription_data)
        
        assert subscription.id is not None
        assert subscription.is_active == True

    def test_approve_change_creates_alerts_for_subscribers(self, db_session):
        table_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="test_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table = services.create_table_metadata(db_session, table_data)
        
        subscription_data = schemas.SubscriptionCreate(
            table_id=table.id,
            subscriber_id="user_001",
            subscriber_email="test@example.com"
        )
        services.create_subscription(db_session, subscription_data)
        
        request_data = schemas.FieldChangeRequestCreate(
            table_id=table.id,
            change_type=models.FieldChangeType.ADD,
            field_name="new_field",
            new_value={"type": "string"},
            created_by="test_user"
        )
        change_request = services.create_field_change_request(db_session, request_data)
        
        services.submit_for_approval(db_session, change_request.id)
        services.approve_change(db_session, change_request.id, "approver@example.com")
        
        alerts = db_session.query(models.Alert).filter(
            models.Alert.change_request_id == change_request.id
        ).all()
        
        assert len(alerts) == 1
        assert alerts[0].subscriber_id == "user_001"
        assert alerts[0].status == models.AlertStatus.PENDING


class TestLineageGraph:
    def test_create_lineage_edge(self, db_session):
        table1_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="source_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table2_data = schemas.TableMetadataCreate(
            database_name="test_db",
            schema_name="test_schema",
            table_name="target_table",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table1 = services.create_table_metadata(db_session, table1_data)
        table2 = services.create_table_metadata(db_session, table2_data)
        
        edge_data = schemas.LineageEdgeCreate(
            source_table_id=table1.id,
            source_field_name="id",
            target_table_id=table2.id,
            target_field_name="id",
            transformation_logic="SELECT id FROM source_table",
            job_id="job_001",
            job_name="ETL Job"
        )
        
        edge = services.create_lineage_edge(db_session, edge_data)
        
        assert edge.id is not None
        assert edge.is_active == True

    def test_get_downstream_tables(self, db_session):
        table1_data = schemas.TableMetadataCreate(
            database_name="db", schema_name="schema", table_name="t1",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table2_data = schemas.TableMetadataCreate(
            database_name="db", schema_name="schema", table_name="t2",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        table3_data = schemas.TableMetadataCreate(
            database_name="db", schema_name="schema", table_name="t3",
            fields=[schemas.FieldDefinition(name="id", type="integer")]
        )
        t1 = services.create_table_metadata(db_session, table1_data)
        t2 = services.create_table_metadata(db_session, table2_data)
        t3 = services.create_table_metadata(db_session, table3_data)
        
        services.create_lineage_edge(db_session, schemas.LineageEdgeCreate(
            source_table_id=t1.id, target_table_id=t2.id,
            source_field_name="id", target_field_name="id",
            job_id="job1"
        ))
        services.create_lineage_edge(db_session, schemas.LineageEdgeCreate(
            source_table_id=t2.id, target_table_id=t3.id,
            source_field_name="id", target_field_name="id",
            job_id="job2"
        ))
        
        downstream = services.get_downstream_tables(db_session, t1.id)
        
        downstream_names = {t['table_name'] for t in downstream}
        assert "t2" in downstream_names
        assert "t3" in downstream_names
        
        t2_info = [t for t in downstream if t['table_name'] == 't2'][0]
        t3_info = [t for t in downstream if t['table_name'] == 't3'][0]
        assert t2_info['path_length'] == 1
        assert t3_info['path_length'] == 2
