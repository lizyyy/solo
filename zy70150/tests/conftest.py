import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from mrs.database import Base
from mrs.models import MessageMetadata
from mrs.utils import generate_message_id, generate_idempotency_key


@pytest.fixture
def db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def sample_messages(db_session):
    now = datetime.utcnow()
    messages = []
    
    for i in range(10):
        message_id = generate_message_id()
        business_id = f"BUS-{i:06d}"
        idempotency_key = generate_idempotency_key(
            "order",
            business_id,
            message_id,
        )
        
        message = MessageMetadata(
            message_id=message_id,
            topic="order.events",
            partition=i % 3,
            offset=i * 100,
            message_body=f'{{"order_id": "ORD-{i:06d}", "amount": {100 + i * 50}}}',
            headers={"source": "test"},
            business_key=f"order:{business_id}",
            idempotency_key=idempotency_key,
            business_type="order",
            business_id=business_id,
            amount=100 + i * 50,
            quantity=i + 1,
            source_timestamp=now - timedelta(hours=10 - i),
        )
        db_session.add(message)
        messages.append(message)
    
    db_session.commit()
    for msg in messages:
        db_session.refresh(msg)
    
    return messages
