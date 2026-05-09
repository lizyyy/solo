import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tempfile
import os

from event_manager.database import Base
from event_manager.models import User, UserRole, Event, EventStatus, Registration, RegistrationStatus
from event_manager.utils import hash_password

@pytest.fixture
def temp_db():
    fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    
    engine = create_engine(f'sqlite:///{db_path}', echo=False)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        os.unlink(db_path)

@pytest.fixture
def test_user(temp_db):
    user = User(
        username='testuser',
        password_hash=hash_password('testpass'),
        email='test@example.com',
        full_name='测试用户',
        role=UserRole.VOLUNTEER
    )
    temp_db.add(user)
    temp_db.commit()
    temp_db.refresh(user)
    return user

@pytest.fixture
def test_organizer(temp_db):
    user = User(
        username='organizer',
        password_hash=hash_password('organizer123'),
        email='organizer@example.com',
        full_name='活动组织者',
        role=UserRole.ORGANIZER
    )
    temp_db.add(user)
    temp_db.commit()
    temp_db.refresh(user)
    return user

@pytest.fixture
def test_admin(temp_db):
    user = User(
        username='admin',
        password_hash=hash_password('admin123'),
        email='admin@example.com',
        full_name='管理员',
        role=UserRole.ADMIN
    )
    temp_db.add(user)
    temp_db.commit()
    temp_db.refresh(user)
    return user

@pytest.fixture
def test_event(temp_db, test_organizer):
    event = Event(
        title='测试活动',
        description='这是一个测试活动',
        location='测试地点',
        start_time=datetime.now() + timedelta(days=7),
        end_time=datetime.now() + timedelta(days=7, hours=3),
        max_participants=50,
        status=EventStatus.PUBLISHED,
        created_by=test_organizer.id
    )
    temp_db.add(event)
    temp_db.commit()
    temp_db.refresh(event)
    return event

@pytest.fixture
def test_registration(temp_db, test_event, test_user):
    registration = Registration(
        event_id=test_event.id,
        user_id=test_user.id,
        participant_name='张三',
        participant_email='zhangsan@example.com',
        participant_phone='13800138000',
        status=RegistrationStatus.PENDING,
        notes='测试报名'
    )
    temp_db.add(registration)
    temp_db.commit()
    temp_db.refresh(registration)
    return registration
