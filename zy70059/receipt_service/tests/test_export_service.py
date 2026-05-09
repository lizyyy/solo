import pytest
from datetime import datetime
from app.services.export_service import ExportService
from app.schemas import ExportItem


class TestExportService:
    @pytest.fixture
    def test_items(self):
        return [
            ExportItem(
                receipt_index="RCPT_001",
                original_transaction_id="TXN_001",
                transaction_date=datetime(2024, 1, 1, 10, 0, 0),
                transaction_type="TRANSFER",
                transaction_amount=100000,
                counterparty_name="供应商A",
                reprint_count=2,
                last_download_at=datetime(2024, 1, 10, 14, 0, 0),
                last_operator="张三"
            ),
            ExportItem(
                receipt_index="RCPT_002",
                original_transaction_id="TXN_002",
                transaction_date=datetime(2024, 1, 5, 15, 0, 0),
                transaction_type="PAYMENT",
                transaction_amount=50000,
                counterparty_name="供应商B",
                reprint_count=0,
                last_download_at=None,
                last_operator=None
            )
        ]
    
    def test_export_to_csv_contains_all_fields(self, test_items):
        csv_content = ExportService.export_to_csv(
            items=test_items,
            customer_id="CUST001",
            export_time=datetime(2024, 2, 1, 10, 0, 0)
        )
        
        lines = csv_content.strip().split('\n')
        header = lines[0]
        
        assert "回单索引" in header
        assert "原交易ID" in header
        assert "交易日期" in header
        assert "交易金额(分)" in header
        assert "交易金额(元)" in header
        assert "补打次数" in header
        
        assert "RCPT_001" in csv_content
        assert "RCPT_002" in csv_content
        assert "供应商A" in csv_content
    
    def test_export_to_csv_summary_correct(self, test_items):
        csv_content = ExportService.export_to_csv(
            items=test_items,
            customer_id="CUST001",
            export_time=datetime(2024, 2, 1, 10, 0, 0)
        )
        
        total_amount = sum(item.transaction_amount for item in test_items)
        total_reprint = sum(item.reprint_count for item in test_items)
        
        assert str(total_amount) in csv_content
        assert str(total_reprint) in csv_content
        assert "1500.00" in csv_content
    
    def test_export_to_customer_info_in_csv(self, test_items):
        csv_content = ExportService.export_to_csv(
            items=test_items,
            customer_id="CUST001",
            export_time=datetime(2024, 2, 1, 10, 0, 0)
        )
        
        assert "客户ID" in csv_content
        assert "CUST001" in csv_content
        assert "导出时间" in csv_content
        assert "2024-02-01" in csv_content
        assert "记录数" in csv_content
        assert "2" in csv_content
    
    def test_export_to_json_structure_correct(self, test_items):
        import json
        json_content = ExportService.export_to_json(
            items=test_items,
            customer_id="CUST001",
            export_time=datetime(2024, 2, 1, 10, 0, 0)
        )
        
        data = json.loads(json_content)
        
        assert data["customer_id"] == "CUST001"
        assert "export_time" in data
        assert "summary" in data
        assert data["summary"]["record_count"] == 2
        assert data["summary"]["total_amount_fen"] == 150000
        assert data["summary"]["total_reprint_count"] == 2
        assert len(data["records"]) == 2
    
    def test_export_to_json_amounts_correct(self, test_items):
        import json
        json_content = ExportService.export_to_json(
            items=test_items,
            customer_id="CUST001",
            export_time=datetime(2024, 2, 1, 10, 0, 0)
        )
        
        data = json.loads(json_content)
        
        first_record = data["records"][0]
        assert first_record["transaction_amount_fen"] == 100000
        assert first_record["transaction_amount_yuan"] == "1000.00"
        
        second_record = data["records"][1]
        assert second_record["transaction_amount_fen"] == 50000
        assert second_record["transaction_amount_yuan"] == "500.00"
    
    def test_validate_export_data_valid_items(self, test_items):
        result = ExportService.validate_export_data(test_items)
        
        assert result["valid"] is True
        assert len(result["errors"]) == 0
        assert result["record_count"] == 2
    
    def test_validate_export_data_duplicate_receipt(self, test_items):
        duplicate_items = test_items + [
            ExportItem(
                receipt_index="RCPT_001",
                original_transaction_id="TXN_003",
                transaction_date=datetime(2024, 1, 10, 10, 0, 0),
                transaction_type="TRANSFER",
                transaction_amount=10000,
                counterparty_name="供应商C",
                reprint_count=1
            )
        ]
        
        result = ExportService.validate_export_data(duplicate_items)
        
        assert result["valid"] is False
        assert len(result["errors"]) == 1
        assert "回单索引重复" in result["errors"][0]
    
    def test_validate_export_data_negative_amount(self):
        invalid_items = [
            ExportItem(
                receipt_index="RCPT_BAD",
                original_transaction_id="TXN_BAD",
                transaction_date=datetime(2024, 1, 1, 10, 0, 0),
                transaction_type="TRANSFER",
                transaction_amount=-1000,
                counterparty_name="供应商X",
                reprint_count=0
            )
        ]
        
        result = ExportService.validate_export_data(invalid_items)
        
        assert result["valid"] is False
        assert "交易金额异常" in result["errors"][0]
    
    def test_validate_export_data_negative_reprint_count(self):
        invalid_items = [
            ExportItem(
                receipt_index="RCPT_BAD",
                original_transaction_id="TXN_BAD",
                transaction_date=datetime(2024, 1, 1, 10, 0, 0),
                transaction_type="TRANSFER",
                transaction_amount=10000,
                counterparty_name="供应商X",
                reprint_count=-5
            )
        ]
        
        result = ExportService.validate_export_data(invalid_items)
        
        assert result["valid"] is False
        assert "补打次数异常" in result["errors"][0]
    
    def test_validate_export_data_warning_no_download_time(self):
        warning_items = [
            ExportItem(
                receipt_index="RCPT_WARN",
                original_transaction_id="TXN_WARN",
                transaction_date=datetime(2024, 1, 1, 10, 0, 0),
                transaction_type="TRANSFER",
                transaction_amount=10000,
                counterparty_name="供应商Y",
                reprint_count=1,
                last_download_at=None
            )
        ]
        
        result = ExportService.validate_export_data(warning_items)
        
        assert result["valid"] is True
        assert len(result["warnings"]) == 1
        assert "有补打记录但无下载时间" in result["warnings"][0]
    
    def test_empty_export(self):
        csv_content = ExportService.export_to_csv(
            items=[],
            customer_id="CUST001",
            export_time=datetime(2024, 2, 1, 10, 0, 0)
        )
        
        assert "记录数" in csv_content
        assert "0" in csv_content
        
        result = ExportService.validate_export_data([])
        assert result["valid"] is True
        assert result["record_count"] == 0