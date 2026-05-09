import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.models import (
    EnterpriseCustomer, Receipt, SignatureRecord, 
    ReprintPermission, DownloadLog, AuditLog
)


TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_customer(db_session):
    customer = EnterpriseCustomer(
        customer_id="CUST001",
        customer_name="测试企业有限公司",
        company_type="LIMITED_LIABILITY",
        status="ACTIVE"
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer


@pytest.fixture(scope="function")
def test_receipt(db_session, test_customer):
    receipt = Receipt(
        receipt_index="RCPT_20240101_001",
        original_transaction_id="TXN_20240101_12345",
        customer_id=test_customer.customer_id,
        transaction_type="TRANSFER",
        transaction_amount=100000,
        transaction_currency="CNY",
        transaction_date=datetime(2024, 1, 1, 10, 30, 0),
        counterparty_name="供应商A公司",
        counterparty_account="1234567890",
        payer_account="9876543210",
        payer_name=test_customer.customer_name,
        original_receipt_path="/receipts/RCPT_20240101_001.pdf"
    )
    db_session.add(receipt)
    db_session.commit()
    db_session.refresh(receipt)
    return receipt


@pytest.fixture(scope="function")
def test_signature(db_session, test_receipt):
    signature = SignatureRecord(
        receipt_id=test_receipt.id,
        receipt_index=test_receipt.receipt_index,
        original_transaction_id=test_receipt.original_transaction_id,
        signature_value="SIGNATURE_HASH_12345",
        signature_algorithm="SHA256",
        certificate_info="CERT_INFO",
        signed_at=datetime(2024, 1, 1, 10, 35, 0),
        verification_status="VERIFIED",
        verified_at=datetime(2024, 1, 1, 10, 36, 0),
        verified_by="VERIFIER_001"
    )
    db_session.add(signature)
    db_session.commit()
    db_session.refresh(signature)
    return signature


@pytest.fixture(scope="function")
def test_permission(db_session, test_customer, test_receipt):
    now = datetime.utcnow()
    permission = ReprintPermission(
        permission_id="PERM_TEST_001",
        customer_id=test_customer.customer_id,
        receipt_id=test_receipt.id,
        receipt_index=test_receipt.receipt_index,
        original_transaction_id=test_receipt.original_transaction_id,
        operator_id="OPER_001",
        operator_name="张三",
        request_reason="对账需要",
        max_download_count=3,
        current_download_count=0,
        valid_from=now,
        valid_until=now + timedelta(days=30),
        is_active=True
    )
    db_session.add(permission)
    db_session.commit()
    db_session.refresh(permission)
    return permission