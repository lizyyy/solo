import pytest
from app import create_app, db
from models import Pottery, SpliceGroup, PotteryGroupAssociation, AuditLog, Issue, Version


@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def runner(app):
    return app.test_cli_runner()


@pytest.fixture
def sample_pottery(app):
    with app.app_context():
        pottery = Pottery(
            pottery_id='TP-TEST-001',
            trench='T01',
            layer='L03',
            square='A1',
            length=15.2,
            width=8.5,
            thickness=0.8,
            weight=125.5,
            decoration='绳纹',
            paste_type='夹砂红陶',
            color='红褐色',
            photo_path='/photos/test.jpg',
            photo_hash='abc123',
            status='pending',
            notes='测试陶片',
            created_by='test_user'
        )
        db.session.add(pottery)
        db.session.commit()
        yield pottery


@pytest.fixture
def sample_group(app, sample_pottery):
    with app.app_context():
        pottery2 = Pottery(
            pottery_id='TP-TEST-002',
            trench='T01',
            layer='L03',
            square='A1',
            length=12.8,
            width=9.2,
            thickness=0.7,
            decoration='绳纹',
            paste_type='夹砂红陶',
            color='红褐色',
            status='pending',
            created_by='test_user'
        )
        db.session.add(pottery2)
        db.session.commit()
        
        group = SpliceGroup(
            group_id='SG-TEST-001',
            name='测试拼接组',
            description='用于测试的拼接组',
            status='draft',
            guess_evidence='同探方同层位同纹饰',
            created_by='test_user'
        )
        db.session.add(group)
        db.session.flush()
        
        assoc1 = PotteryGroupAssociation(
            pottery_id=sample_pottery.id,
            group_id=group.id
        )
        assoc2 = PotteryGroupAssociation(
            pottery_id=pottery2.id,
            group_id=group.id
        )
        db.session.add(assoc1)
        db.session.add(assoc2)
        db.session.commit()
        
        yield group
