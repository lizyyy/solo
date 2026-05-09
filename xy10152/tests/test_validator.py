import pytest
from datetime import date
from supplier_reconciliation.validator import DataValidator
from supplier_reconciliation.models import DocumentType


class TestDataValidator:
    def test_parse_date_iso_format(self):
        validator = DataValidator()
        result = validator.parse_date("2025-03-15")
        assert result == date(2025, 3, 15)
    
    def test_parse_date_slash_format(self):
        validator = DataValidator()
        result = validator.parse_date("2025/03/15")
        assert result == date(2025, 3, 15)
    
    def test_parse_date_compact_format(self):
        validator = DataValidator()
        result = validator.parse_date("20250315")
        assert result == date(2025, 3, 15)
    
    def test_parse_date_eu_format(self):
        validator = DataValidator()
        result = validator.parse_date("15-03-2025")
        assert result == date(2025, 3, 15)
    
    def test_parse_date_none(self):
        validator = DataValidator()
        assert validator.parse_date(None) is None
        assert validator.parse_date("") is None
    
    def test_parse_date_object(self):
        validator = DataValidator()
        d = date(2025, 3, 15)
        assert validator.parse_date(d) == d
    
    def test_parse_amount_simple(self):
        validator = DataValidator()
        assert validator.parse_amount("10000.00") == 10000.00
    
    def test_parse_amount_with_commas(self):
        validator = DataValidator()
        assert validator.parse_amount("10,000.00") == 10000.00
    
    def test_parse_amount_with_currency(self):
        validator = DataValidator()
        assert validator.parse_amount("￥10000.00") == 10000.00
        assert validator.parse_amount("¥10000.00") == 10000.00
        assert validator.parse_amount("$10000.00") == 10000.00
    
    def test_parse_amount_numeric(self):
        validator = DataValidator()
        assert validator.parse_amount(10000) == 10000.0
        assert validator.parse_amount(10000.50) == 10000.50
    
    def test_parse_amount_invalid(self):
        validator = DataValidator()
        assert validator.parse_amount("abc") is None
        assert validator.parse_amount("") is None
        assert validator.parse_amount(None) is None
    
    def test_validate_row_valid(self):
        validator = DataValidator()
        row = {
            "doc_number": "INV-001",
            "supplier_id": "SUP001",
            "supplier_name": "测试",
            "amount": "10000.00",
            "doc_date": "2025-03-15"
        }
        is_valid, errors, cleaned = validator.validate_row(row, DocumentType.INVOICE)
        assert is_valid is True
        assert len(errors) == 0
        assert cleaned["amount_parsed"] == 10000.00
        assert cleaned["doc_date_parsed"] == date(2025, 3, 15)
    
    def test_validate_row_missing_fields(self):
        validator = DataValidator()
        row = {
            "doc_number": "",
            "amount": "10000.00",
            "doc_date": "2025-03-15"
        }
        is_valid, errors, cleaned = validator.validate_row(row, DocumentType.INVOICE)
        assert is_valid is False
        assert any("缺少必填字段" in e for e in errors)
    
    def test_validate_row_invalid_date(self):
        validator = DataValidator(strict=True)
        row = {
            "doc_number": "INV-001",
            "supplier_id": "SUP001",
            "supplier_name": "测试",
            "amount": "10000.00",
            "doc_date": "invalid-date"
        }
        is_valid, errors, cleaned = validator.validate_row(row, DocumentType.INVOICE)
        assert is_valid is False
        assert any("无法解析日期" in e for e in errors)
    
    def test_create_document(self):
        validator = DataValidator()
        row = {
            "doc_number": "INV-001",
            "supplier_id": "SUP001",
            "supplier_name": "测试供应商",
            "amount": "10000.00",
            "doc_date": "2025-03-15",
            "due_date": "2025-04-14",
            "description": "测试发票",
            "reference": "PO-001"
        }
        doc = validator.create_document(row, DocumentType.INVOICE)
        assert doc.doc_number == "INV-001"
        assert doc.amount == 10000.00
        assert doc.doc_date == date(2025, 3, 15)
        assert doc.due_date == date(2025, 4, 14)
        assert doc.is_valid is True
