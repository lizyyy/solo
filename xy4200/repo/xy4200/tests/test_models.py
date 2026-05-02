import pytest
from datetime import datetime
from models import Pottery, SpliceGroup, PotteryGroupAssociation, AuditLog, Issue, Version


def test_pottery_creation(app, sample_pottery):
    with app.app_context():
        pottery = Pottery.query.filter_by(pottery_id='TP-TEST-001').first()
        assert pottery is not None
        assert pottery.trench == 'T01'
        assert pottery.layer == 'L03'
        assert pottery.decoration == '绳纹'
        assert pottery.status == 'pending'
        assert pottery.created_at is not None


def test_pottery_unique_id(app):
    with app.app_context():
        pottery1 = Pottery(
            pottery_id='TP-UNIQUE-001',
            trench='T01',
            layer='L03',
            decoration='绳纹',
            paste_type='夹砂红陶',
            status='pending',
            created_by='test'
        )
        db.session.add(pottery1)
        db.session.commit()
        
        pottery2 = Pottery(
            pottery_id='TP-UNIQUE-001',
            trench='T02',
            layer='L04',
            decoration='篮纹',
            paste_type='泥质灰陶',
            status='pending',
            created_by='test'
        )
        db.session.add(pottery2)
        
        with pytest.raises(Exception):
            db.session.commit()
        
        db.session.rollback()


def test_splice_group_creation(app, sample_group):
    with app.app_context():
        group = SpliceGroup.query.filter_by(group_id='SG-TEST-001').first()
        assert group is not None
        assert group.name == '测试拼接组'
        assert group.status == 'draft'
        assert len(group.potteries) == 2


def test_pottery_group_association(app, sample_group):
    with app.app_context():
        group = SpliceGroup.query.filter_by(group_id='SG-TEST-001').first()
        pottery = Pottery.query.filter_by(pottery_id='TP-TEST-001').first()
        
        assert pottery in [a.pottery for a in group.associations]
        assert group in [a.group for a in pottery.associations]


def test_audit_log_creation(app):
    with app.app_context():
        log = AuditLog(
            action='create',
            entity_type='pottery',
            entity_id='TP-AUDIT-001',
            old_values=None,
            new_values={'pottery_id': 'TP-AUDIT-001', 'trench': 'T01'},
            user='test_user',
            ip_address='127.0.0.1'
        )
        db.session.add(log)
        db.session.commit()
        
        saved_log = AuditLog.query.filter_by(entity_id='TP-AUDIT-001').first()
        assert saved_log is not None
        assert saved_log.action == 'create'
        assert saved_log.user == 'test_user'
        assert saved_log.timestamp is not None


def test_issue_creation(app, sample_pottery):
    with app.app_context():
        issue = Issue(
            issue_type='layer_conflict',
            severity='high',
            title='层位冲突检测',
            description='该陶片被分配到不同层位的拼接组中',
            pottery_id=sample_pottery.id,
            rule_name='TrenchLayerConsistencyRule',
            status='open'
        )
        db.session.add(issue)
        db.session.commit()
        
        saved_issue = Issue.query.filter_by(title='层位冲突检测').first()
        assert saved_issue is not None
        assert saved_issue.severity == 'high'
        assert saved_issue.pottery_id == sample_pottery.id


def test_version_creation(app, sample_pottery):
    with app.app_context():
        version = Version(
            entity_type='pottery',
            entity_id=str(sample_pottery.id),
            version_number=1,
            data={'pottery_id': 'TP-TEST-001', 'trench': 'T01', 'layer': 'L03'},
            created_by='test_user',
            change_reason='初始创建'
        )
        db.session.add(version)
        db.session.commit()
        
        saved_version = Version.query.filter_by(entity_type='pottery').first()
        assert saved_version is not None
        assert saved_version.version_number == 1
        assert saved_version.data['trench'] == 'T01'


def test_pottery_update_timestamp(app, sample_pottery):
    with app.app_context():
        pottery = Pottery.query.filter_by(pottery_id='TP-TEST-001').first()
        original_updated = pottery.updated_at
        
        pottery.notes = '更新后的备注'
        db.session.commit()
        
        updated_pottery = Pottery.query.filter_by(pottery_id='TP-TEST-001').first()
        assert updated_pottery.updated_at >= original_updated


def test_group_status_enum(app, sample_group):
    with app.app_context():
        group = SpliceGroup.query.filter_by(group_id='SG-TEST-001').first()
        assert group.status in ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn', 'archived']


def test_audit_log_new_values_json(app):
    with app.app_context():
        log = AuditLog(
            action='update',
            entity_type='pottery',
            entity_id='TP-JSON-001',
            old_values={'status': 'pending'},
            new_values={'status': 'under_review', 'notes': '开始复核'},
            user='test_user'
        )
        db.session.add(log)
        db.session.commit()
        
        saved_log = AuditLog.query.filter_by(entity_id='TP-JSON-001').first()
        assert saved_log.new_values['status'] == 'under_review'
        assert saved_log.old_values['status'] == 'pending'


import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import db
