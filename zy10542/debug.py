#!/usr/bin/env python3
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_debug.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from models import Base
Base.metadata.create_all(bind=engine)

from database import get_db

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

from main import app
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

db = TestingSessionLocal()
from models import Resource
db.add(Resource(resource_code='ROOM-A101', resource_name='Test', resource_type='classroom'))
db.commit()
db.close()

future1 = datetime.now() + timedelta(days=1)
future2 = future1 + timedelta(hours=2)

res = client.post('/api/reservations/', json={
    'resource_code': 'ROOM-A101',
    'booker_id': 'user001',
    'booker_name': '张三',
    'booker_contact': '13800138000',
    'start_time': future1.isoformat(),
    'end_time': future2.isoformat()
})
print('Status:', res.status_code)
print('Response:', res.json())
