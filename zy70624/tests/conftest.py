import sys
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, '.')

from app.database import Base
from app.main import app
from app.models import CustomerDemand, AuntProfile, TrialSchedule, Deposit, Review

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client():
    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()
    
    from app.main import app
    from app.database import get_db
    app.dependency_overrides[get_db] = override_get_db
    
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    yield TestClient(app)
    
    app.dependency_overrides.clear()


@pytest.fixture
def test_data(db):
    demand1 = CustomerDemand(
        customer_name="测试客户",
        customer_phone="13800000000",
        address="测试地址",
        service_type="住家保姆"
    )
    db.add(demand1)
    
    aunt1 = AuntProfile(
        name="测试阿姨",
        phone="13900000000",
        id_card="110101198001010001"
    )
    db.add(aunt1)
    db.commit()
    
    base_date = datetime.now()
    schedule1 = TrialSchedule(
        demand_id=demand1.id,
        aunt_id=aunt1.id,
        trial_start_time=base_date + timedelta(days=1),
        trial_end_time=base_date + timedelta(days=3),
        trial_address="测试地址",
        trial_fee=300.0,
        created_by="admin"
    )
    db.add(schedule1)
    
    schedule2 = TrialSchedule(
        demand_id=demand1.id,
        aunt_id=aunt1.id,
        trial_start_time=base_date - timedelta(days=10),
        trial_end_time=base_date - timedelta(days=7),
        trial_address="测试地址",
        trial_fee=400.0,
        created_by="admin",
        status="completed"
    )
    db.add(schedule2)
    db.commit()
    
    deposit1 = Deposit(
        trial_schedule_id=schedule2.id,
        amount=500.0,
        created_by="admin",
        status="paid",
        paid_at=base_date - timedelta(days=11)
    )
    db.add(deposit1)
    
    review1 = Review(
        trial_schedule_id=schedule2.id,
        reviewer="测试客户",
        overall_rating=5,
        skill_rating=5,
        attitude_rating=5,
        punctuality_rating=5,
        hygiene_rating=5,
        communication_rating=5,
        status="approved"
    )
    db.add(review1)
    db.commit()
    
    return {
        "demand": demand1,
        "aunt": aunt1,
        "schedule1": schedule1,
        "schedule2": schedule2,
        "deposit": deposit1,
        "review": review1
    }
