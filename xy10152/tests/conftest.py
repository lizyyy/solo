import pytest
import tempfile
import shutil
from pathlib import Path
from datetime import date, datetime
from supplier_reconciliation.models import Document, DocumentType


@pytest.fixture
def temp_dir():
    tmpdir = tempfile.mkdtemp()
    yield Path(tmpdir)
    shutil.rmtree(tmpdir)


@pytest.fixture
def sample_invoice():
    return Document(
        doc_type=DocumentType.INVOICE,
        doc_number="INV-001",
        supplier_id="SUP001",
        supplier_name="测试供应商",
        amount=10000.00,
        doc_date=date(2025, 3, 15),
        due_date=date(2025, 4, 14),
        description="测试发票",
        reference="PO-001"
    )


@pytest.fixture
def sample_payment():
    return Document(
        doc_type=DocumentType.PAYMENT,
        doc_number="PAY-001",
        supplier_id="SUP001",
        supplier_name="测试供应商",
        amount=10000.00,
        doc_date=date(2025, 4, 10),
        description="测试付款",
        reference="INV-001"
    )


@pytest.fixture
def sample_documents(sample_invoice, sample_payment):
    return [
        sample_invoice,
        sample_payment,
        Document(
            doc_type=DocumentType.INVOICE,
            doc_number="INV-002",
            supplier_id="SUP002",
            supplier_name="另一个供应商",
            amount=25000.00,
            doc_date=date(2025, 3, 20),
            due_date=date(2025, 4, 19),
        ),
        Document(
            doc_type=DocumentType.PAYMENT,
            doc_number="PAY-002",
            supplier_id="SUP002",
            supplier_name="另一个供应商",
            amount=15000.00,
            doc_date=date(2025, 4, 15),
        ),
    ]


@pytest.fixture
def sample_csv_file(temp_dir):
    csv_path = temp_dir / "test_invoices.csv"
    content = """doc_number,supplier_id,supplier_name,amount,doc_date,due_date,description,reference
INV-TEST-001,SUP001,测试供应商一,10000.00,2025-03-15,2025-04-14,测试发票1,PO-001
INV-TEST-002,SUP002,测试供应商二,25000.00,2025-03-20,2025-04-19,测试发票2,PO-002
INV-TEST-003,SUP001,测试供应商一,15000.00,2025-04-01,2025-05-01,测试发票3,PO-003
"""
    csv_path.write_text(content, encoding="utf-8")
    return csv_path
