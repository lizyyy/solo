import json
import tempfile
from pathlib import Path
from datetime import datetime
from unittest.mock import mock_open, patch

import pytest

from claim_risk_scanner.data_parser import (
    InvoiceParser, ClaimParser, RiskSampleParser,
    InvoiceData, ClaimData, RiskSample, InvoiceItem
)


class TestInvoiceParser:
    def test_parse_single_invoice(self):
        parser = InvoiceParser()
        
        invoice_data = {
            "invoice_number": "INV2024000001",
            "invoice_date": "2024-01-15",
            "vendor_name": "北京康泰医药有限公司",
            "vendor_tax_id": "91110106MA007Y7K8T",
            "total_amount": 1500.0,
            "tax_amount": 90.0,
            "ocr_confidence": 95.5,
            "items": [
                {"item_name": "阿莫西林胶囊", "quantity": 3, "unit_price": 500.0, "amount": 1500.0}
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(invoice_data, f)
            temp_path = Path(f.name)
        
        try:
            invoices = parser.parse_file(temp_path)
            
            assert len(invoices) == 1
            inv = invoices[0]
            assert inv.invoice_number == "INV2024000001"
            assert inv.vendor_name == "北京康泰医药有限公司"
            assert inv.total_amount == 1500.0
            assert inv.ocr_confidence == 95.5
        finally:
            temp_path.unlink()
    
    def test_parse_multiple_invoices(self):
        parser = InvoiceParser()
        
        invoices_data = [
            {
                "invoice_number": "INV2024000001",
                "invoice_date": "2024-01-15",
                "vendor_name": "北京康泰医药有限公司",
                "vendor_tax_id": "91110106MA007Y7K8T",
                "total_amount": 1500.0,
                "tax_amount": 90.0,
                "items": []
            },
            {
                "invoice_number": "INV2024000002",
                "invoice_date": "2024-01-16",
                "vendor_name": "上海康复医疗器械有限公司",
                "vendor_tax_id": "91310115MA1G8H7Y9K",
                "total_amount": 2800.0,
                "tax_amount": 168.0,
                "items": []
            }
        ]
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(invoices_data, f)
            temp_path = Path(f.name)
        
        try:
            invoices = parser.parse_file(temp_path)
            
            assert len(invoices) == 2
            assert invoices[0].invoice_number == "INV2024000001"
            assert invoices[1].invoice_number == "INV2024000002"
        finally:
            temp_path.unlink()
    
    def test_parse_date_formats(self):
        parser = InvoiceParser()
        
        test_cases = [
            ("2024-01-15", "2024-01-15"),
            ("2024/01/15", "2024-01-15"),
            ("2024年01月15日", "2024-01-15"),
            ("01-15-2024", "2024-01-15"),
        ]
        
        for input_date, expected_date in test_cases:
            invoice_data = {
                "invoice_number": "INV2024000001",
                "invoice_date": input_date,
                "vendor_name": "测试公司",
                "vendor_tax_id": "12345678",
                "total_amount": 100.0,
                "tax_amount": 6.0,
                "items": []
            }
            
            inv = parser._parse_single_invoice(invoice_data)
            assert inv.invoice_date == expected_date


class TestClaimParser:
    def test_parse_claim_csv(self):
        parser = ClaimParser()
        
        csv_content = """claim_id,policy_number,claimant_name,claim_date,claim_amount,invoice_number,diagnosis,hospital_name
CLM2024001,POL123456,张三,2024-01-20,1500.0,INV2024000001,感冒发烧,北京协和医院
CLM2024002,POL789012,李四,2024-01-21,2800.0,INV2024000002,急性肠胃炎,上海瑞金医院"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            claims = parser.parse_file(temp_path)
            
            assert len(claims) == 2
            assert claims[0].claim_id == "CLM2024001"
            assert claims[0].claimant_name == "张三"
            assert claims[0].claim_amount == 1500.0
            assert claims[1].claim_id == "CLM2024002"
        finally:
            temp_path.unlink()


class TestRiskSampleParser:
    def test_parse_risk_samples_csv(self):
        parser = RiskSampleParser()
        
        csv_content = """vendor_name,vendor_tax_id,risk_level,risk_type,sample_count,last_occurrence
北京诚信医药经营部,91110105MA008X9Y1T,high,虚假发票,5,2024-01-01
上海汇通商贸有限公司,91310114MA1G7H8Z2K,high,重复报销,3,2024-02-15
广州市天河区康源药房,91440106MA59H7Y3K,medium,金额异常,2,2024-03-20"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = Path(f.name)
        
        try:
            samples = parser.parse_file(temp_path)
            
            assert len(samples) == 3
            assert samples[0].vendor_name == "北京诚信医药经营部"
            assert samples[0].risk_level == "high"
            assert samples[0].sample_count == 5
        finally:
            temp_path.unlink()


class TestInvoiceData:
    def test_invoice_data_creation(self):
        items = [
            InvoiceItem(item_name="阿莫西林胶囊", quantity=3, unit_price=500.0, amount=1500.0)
        ]
        
        inv = InvoiceData(
            invoice_number="INV2024000001",
            invoice_date="2024-01-15",
            vendor_name="北京康泰医药有限公司",
            vendor_tax_id="91110106MA007Y7K8T",
            total_amount=1500.0,
            tax_amount=90.0,
            items=items,
            ocr_confidence=95.5,
            raw_json={"test": "data"}
        )
        
        assert inv.invoice_number == "INV2024000001"
        assert len(inv.items) == 1
        assert inv.items[0].item_name == "阿莫西林胶囊"
        assert inv.ocr_confidence == 95.5


class TestClaimData:
    def test_claim_data_creation(self):
        claim = ClaimData(
            claim_id="CLM2024001",
            policy_number="POL123456",
            claimant_name="张三",
            claim_date="2024-01-20",
            claim_amount=1500.0,
            invoice_number="INV2024000001",
            diagnosis="感冒发烧",
            hospital_name="北京协和医院",
            raw_data={"test": "data"}
        )
        
        assert claim.claim_id == "CLM2024001"
        assert claim.claimant_name == "张三"
        assert claim.claim_amount == 1500.0


class TestRiskSample:
    def test_risk_sample_creation(self):
        sample = RiskSample(
            vendor_name="北京诚信医药经营部",
            vendor_tax_id="91110105MA008X9Y1T",
            risk_level="high",
            risk_type="虚假发票",
            sample_count=5,
            last_occurrence="2024-01-01",
            raw_data={"test": "data"}
        )
        
        assert sample.vendor_name == "北京诚信医药经营部"
        assert sample.risk_level == "high"
        assert sample.sample_count == 5
