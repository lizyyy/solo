import pytest
from datetime import date
from supplier_reconciliation.models import Document, DocumentType, ReconciliationStatus


class TestDocument:
    def test_document_creation(self, sample_invoice):
        assert sample_invoice.doc_type == DocumentType.INVOICE
        assert sample_invoice.doc_number == "INV-001"
        assert sample_invoice.supplier_id == "SUP001"
        assert sample_invoice.amount == 10000.00
    
    def test_document_key(self, sample_invoice):
        expected = "invoice:INV-001:SUP001"
        assert sample_invoice.key == expected
    
    def test_document_validate_valid(self, sample_invoice):
        errors = sample_invoice.validate()
        assert len(errors) == 0
        assert sample_invoice.is_valid is True
    
    def test_document_validate_missing_doc_number(self):
        doc = Document(
            doc_type=DocumentType.INVOICE,
            doc_number="",
            supplier_id="SUP001",
            supplier_name="测试",
            amount=1000.00,
            doc_date=date(2025, 1, 1)
        )
        errors = doc.validate()
        assert "凭证号不能为空" in errors
        assert doc.is_valid is False
    
    def test_document_validate_missing_supplier_id(self):
        doc = Document(
            doc_type=DocumentType.INVOICE,
            doc_number="INV-001",
            supplier_id="",
            supplier_name="测试",
            amount=1000.00,
            doc_date=date(2025, 1, 1)
        )
        errors = doc.validate()
        assert "供应商ID不能为空" in errors
    
    def test_document_validate_negative_amount(self):
        doc = Document(
            doc_type=DocumentType.INVOICE,
            doc_number="INV-001",
            supplier_id="SUP001",
            supplier_name="测试",
            amount=-1000.00,
            doc_date=date(2025, 1, 1)
        )
        errors = doc.validate()
        assert any("金额不能为负数" in e for e in errors)
    
    def test_document_validate_future_date(self):
        future_date = date(2030, 1, 1)
        doc = Document(
            doc_type=DocumentType.INVOICE,
            doc_number="INV-001",
            supplier_id="SUP001",
            supplier_name="测试",
            amount=1000.00,
            doc_date=future_date
        )
        errors = doc.validate()
        assert any("凭证日期不能晚于今天" in e for e in errors)


class TestDocumentType:
    def test_document_type_values(self):
        assert DocumentType.INVOICE.value == "invoice"
        assert DocumentType.GRN.value == "grn"
        assert DocumentType.PAYMENT.value == "payment"


class TestReconciliationStatus:
    def test_status_values(self):
        assert ReconciliationStatus.MATCHED.value == "matched"
        assert ReconciliationStatus.PARTIAL.value == "partial"
        assert ReconciliationStatus.UNMATCHED.value == "unmatched"
        assert ReconciliationStatus.DUPLICATE.value == "duplicate"
        assert ReconciliationStatus.INVALID.value == "invalid"
