import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models import (
    Supplier, SupplierType, SupplierStatus,
    Qualification, QualificationStatus,
    PriceSnapshot
)
from main import app

TEST_DATABASE_URL = "sqlite:///./test_supplier_switch.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


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
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_suppliers(db):
    now = datetime.utcnow()
    
    primary = Supplier(
        name="测试主供应商",
        code="TEST-PRI-001",
        type=SupplierType.PRIMARY,
        status=SupplierStatus.EXCEPTION,
        contact_person="张三",
        phone="138-0000-0001",
        address="测试地址1"
    )
    db.add(primary)
    db.flush()
    
    good_alt = Supplier(
        name="合格备选供应商",
        code="TEST-ALT-GOOD",
        type=SupplierType.ALTERNATIVE,
        status=SupplierStatus.ACTIVE,
        contact_person="李四",
        phone="138-0000-0002",
        address="测试地址2"
    )
    db.add(good_alt)
    db.flush()
    
    expired_alt = Supplier(
        name="资质过期供应商",
        code="TEST-ALT-EXPIRED",
        type=SupplierType.ALTERNATIVE,
        status=SupplierStatus.ACTIVE,
        contact_person="王五",
        phone="138-0000-0003",
        address="测试地址3"
    )
    db.add(expired_alt)
    db.flush()
    
    db.add(Qualification(
        supplier_id=primary.id,
        name="ISO9001",
        certificate_number="TEST-ISO-001",
        issue_date=now - timedelta(days=365),
        expiry_date=now + timedelta(days=365),
        status=QualificationStatus.VALID
    ))
    
    db.add(Qualification(
        supplier_id=good_alt.id,
        name="ISO9001",
        certificate_number="TEST-ISO-002",
        issue_date=now - timedelta(days=100),
        expiry_date=now + timedelta(days=630),
        status=QualificationStatus.VALID
    ))
    db.add(Qualification(
        supplier_id=good_alt.id,
        name="RoHS",
        certificate_number="TEST-ROHS-001",
        issue_date=now - timedelta(days=60),
        expiry_date=now + timedelta(days=720),
        status=QualificationStatus.VALID
    ))
    
    db.add(Qualification(
        supplier_id=expired_alt.id,
        name="ISO9001",
        certificate_number="TEST-ISO-003",
        issue_date=now - timedelta(days=730),
        expiry_date=now - timedelta(days=30),
        status=QualificationStatus.EXPIRED
    ))
    
    db.add(PriceSnapshot(
        supplier_id=primary.id,
        product_code="TEST-PROD-001",
        product_name="测试产品A",
        unit_price=100.00,
        is_current=True
    ))
    db.add(PriceSnapshot(
        supplier_id=good_alt.id,
        product_code="TEST-PROD-001",
        product_name="测试产品A",
        unit_price=105.00,
        is_current=True
    ))
    db.add(PriceSnapshot(
        supplier_id=expired_alt.id,
        product_code="TEST-PROD-001",
        product_name="测试产品A",
        unit_price=95.00,
        is_current=True
    ))
    
    db.commit()
    
    return {
        "primary": primary,
        "good_alt": good_alt,
        "expired_alt": expired_alt
    }
