import pytest
from datetime import datetime, timedelta
from app import create_app, db
from app.models import DataTable, QualityRule, RuleSilence, Alert
from app.services import SilenceService

@pytest.fixture
def app():
    app = create_app()
    app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'
    })
    
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def sample_data(app):
    with app.app_context():
        table = DataTable(
            database_name='test_db',
            schema_name='public',
            table_name='test_table'
        )
        db.session.add(table)
        db.session.flush()
        
        rule = QualityRule(
            rule_code='TEST_RULE_001',
            rule_name='Test Rule',
            rule_type='test_type',
            table_id=table.id
        )
        db.session.add(rule)
        db.session.flush()
        
        alert = Alert(
            rule_id=rule.id,
            table_id=table.id,
            alert_type='test_alert'
        )
        db.session.add(alert)
        db.session.commit()
        
        return {
            'table_id': table.id,
            'rule_id': rule.id,
            'alert_id': alert.id
        }

class TestNormalScenarios:
    def test_apply_silence(self, client, sample_data):
        start_time = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        end_time = (datetime.utcnow() + timedelta(days=1)).isoformat()
        
        response = client.post('/api/silence/apply', json={
            'rule_id': sample_data['rule_id'],
            'table_id': sample_data['table_id'],
            'applicant': 'test_user',
            'reason': 'Scheduled maintenance',
            'start_time': start_time,
            'end_time': end_time
        })
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['status'] == 'pending'
        assert 'silence_id' in data

    def test_approve_silence(self, client, sample_data):
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='Maintenance',
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=1)
        )
        db.session.add(silence)
        db.session.commit()
        
        response = client.post(f'/api/silence/approve/{silence.id}', json={
            'approver': 'admin_user'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'approved'
        
        alert = Alert.query.get(sample_data['alert_id'])
        assert alert.status == 'silenced'

    def test_check_expired_auto_restore(self, client, sample_data):
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='Maintenance',
            start_time=datetime.utcnow() - timedelta(days=2),
            end_time=datetime.utcnow() - timedelta(days=1),
            status='approved'
        )
        db.session.add(silence)
        db.session.flush()
        
        SilenceService.silence_alerts(silence)
        db.session.commit()
        
        response = client.post('/api/silence/check-expired')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['checked'] >= 1
        
        silence = RuleSilence.query.get(silence.id)
        assert silence.restore_status == 'auto_restored'
        
        alert = Alert.query.get(sample_data['alert_id'])
        assert alert.status == 'active'

    def test_manual_restore(self, client, sample_data):
        SilenceService.SIMULATE_RESTORE_FAILURE = True
        
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='Maintenance',
            start_time=datetime.utcnow() - timedelta(days=2),
            end_time=datetime.utcnow() - timedelta(days=1),
            status='approved'
        )
        db.session.add(silence)
        db.session.flush()
        SilenceService.silence_alerts(silence)
        db.session.commit()
        
        client.post('/api/silence/check-expired')
        
        silence = RuleSilence.query.get(silence.id)
        assert silence.restore_status == 'failed'
        
        SilenceService.SIMULATE_RESTORE_FAILURE = False
        
        response = client.post(f'/api/silence/restore/{silence.id}', json={
            'restorer': 'admin_user'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['restore_status'] == 'manual_restored'

    def test_export_silences_csv(self, client, sample_data):
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='Maintenance',
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=1),
            status='approved',
            approver='admin'
        )
        db.session.add(silence)
        db.session.commit()
        
        response = client.get('/api/silence/export?format=csv')
        
        assert response.status_code == 200
        assert 'text/csv' in response.headers['Content-Type']
        content = response.data.decode('utf-8')
        assert 'Test Rule' in content

class TestExceptionScenarios:
    def test_apply_silence_missing_fields(self, client, sample_data):
        response = client.post('/api/silence/apply', json={
            'rule_id': sample_data['rule_id'],
            'applicant': 'test_user'
        })
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data

    def test_apply_silence_invalid_dates(self, client, sample_data):
        response = client.post('/api/silence/apply', json={
            'rule_id': sample_data['rule_id'],
            'table_id': sample_data['table_id'],
            'applicant': 'test_user',
            'reason': 'Test',
            'start_time': 'invalid-date',
            'end_time': '2024-12-31'
        })
        
        assert response.status_code == 400

    def test_approve_nonexistent_silence(self, client):
        response = client.post('/api/silence/approve/99999', json={
            'approver': 'admin'
        })
        
        assert response.status_code == 404

    def test_approve_already_approved(self, client, sample_data):
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='Test',
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=1),
            status='approved'
        )
        db.session.add(silence)
        db.session.commit()
        
        response = client.post(f'/api/silence/approve/{silence.id}', json={
            'approver': 'admin'
        })
        
        assert response.status_code == 400

    def test_restore_already_restored(self, client, sample_data):
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='Test',
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=1),
            status='approved',
            restore_status='auto_restored'
        )
        db.session.add(silence)
        db.session.commit()
        
        response = client.post(f'/api/silence/restore/{silence.id}', json={
            'restorer': 'admin'
        })
        
        assert response.status_code == 400

    def test_duplicate_silence_application(self, client, sample_data):
        start_time = datetime.utcnow() + timedelta(hours=1)
        end_time = datetime.utcnow() + timedelta(days=1)
        
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='First application',
            start_time=start_time,
            end_time=end_time,
            status='pending'
        )
        db.session.add(silence)
        db.session.commit()
        
        response = client.post('/api/silence/apply', json={
            'rule_id': sample_data['rule_id'],
            'table_id': sample_data['table_id'],
            'applicant': 'another_user',
            'reason': 'Duplicate application',
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat()
        })
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'already exists' in data['error']

class TestSpecialScenarios:
    def test_rule_rename_during_silence(self, client, sample_data):
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='Maintenance',
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=1),
            status='approved'
        )
        db.session.add(silence)
        db.session.flush()
        SilenceService.silence_alerts(silence)
        db.session.commit()
        
        response = client.post(f'/api/rule/rename/{sample_data["rule_id"]}', json={
            'new_name': 'Renamed Test Rule',
            'renamed_by': 'admin'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['old_name'] == 'Test Rule'
        assert data['new_name'] == 'Renamed Test Rule'
        
        rule = QualityRule.query.get(sample_data['rule_id'])
        assert rule.rule_name == 'Renamed Test Rule'

    def test_table_migration_during_silence(self, client, sample_data):
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='Maintenance',
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=1),
            status='approved'
        )
        db.session.add(silence)
        db.session.flush()
        SilenceService.silence_alerts(silence)
        db.session.commit()
        
        response = client.post(f'/api/rule/migrate-table/{sample_data["table_id"]}', json={
            'new_database': 'new_production',
            'new_schema': 'public',
            'new_table_name': 'new_test_table',
            'migrated_by': 'admin'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['affected_rules_count'] >= 1
        
        table = DataTable.query.get(sample_data['table_id'])
        assert table.database_name == 'new_production'
        assert table.table_name == 'new_test_table'

    def test_alert_merge_scenarios(self, client, sample_data):
        alert2 = Alert(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            alert_type='test_alert_2'
        )
        alert3 = Alert(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            alert_type='test_alert_3'
        )
        db.session.add_all([alert2, alert3])
        db.session.commit()
        
        response = client.post('/api/alert/merge', json={
            'source_alert_ids': [alert2.id, alert3.id],
            'target_alert_id': sample_data['alert_id'],
            'merged_by': 'admin'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['merged_count'] == 2
        
        merged_alert = Alert.query.get(alert2.id)
        assert merged_alert.status == 'merged'
        assert merged_alert.merged_into == sample_data['alert_id']

class TestRepeatability:
    def test_multiple_check_expired_calls(self, client, sample_data):
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='Maintenance',
            start_time=datetime.utcnow() - timedelta(days=2),
            end_time=datetime.utcnow() - timedelta(days=1),
            status='approved'
        )
        db.session.add(silence)
        db.session.flush()
        SilenceService.silence_alerts(silence)
        db.session.commit()
        
        for i in range(3):
            response = client.post('/api/silence/check-expired')
            assert response.status_code == 200
        
        silence = RuleSilence.query.get(silence.id)
        assert silence.restore_attempts == 1
        assert silence.restore_status == 'auto_restored'

    def test_multiple_export_calls(self, client, sample_data):
        silence = RuleSilence(
            rule_id=sample_data['rule_id'],
            table_id=sample_data['table_id'],
            applicant='test_user',
            reason='Test',
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(days=1)
        )
        db.session.add(silence)
        db.session.commit()
        
        for i in range(5):
            response = client.get('/api/silence/export?format=csv')
            assert response.status_code == 200
            assert 'text/csv' in response.headers['Content-Type']
