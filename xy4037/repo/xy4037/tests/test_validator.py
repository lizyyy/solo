"""
数据校验模块测试
"""

import tempfile
import json
from pathlib import Path
from datetime import datetime

import pytest

from ticket_cluster_helper.config import Config, init_config
from ticket_cluster_helper.csv_parser import ParsedTicket
from ticket_cluster_helper.validator import (
    TicketValidator, 
    ValidationError, 
    ValidationResult,
    validate_tickets
)


class TestTicketValidator:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)
        self.config = init_config(self.project_path)
        self.validator = TicketValidator(self.config)
    
    def _create_mock_ticket(self, ticket_id: str, **kwargs) -> ParsedTicket:
        sanitized_data = {
            "工单号": ticket_id,
            "用户描述": "测试用户描述",
            "渠道": "APP",
            "产品线": "用户账户",
            "时间": "2026-04-20 09:15:30",
            "处理人": "张三",
            "处理结论": "已处理"
        }
        sanitized_data.update(kwargs)
        
        return ParsedTicket(
            ticket_id=ticket_id,
            original_data=sanitized_data.copy(),
            sanitized_data=sanitized_data,
            import_time=datetime.now(),
            source_file="test.csv",
            row_index=2
        )
    
    def test_validate_valid_ticket(self):
        ticket = self._create_mock_ticket("TK001")
        
        result = self.validator.validate([ticket])
        
        assert result.is_valid
        assert result.valid_count == 1
        assert result.invalid_count == 0
        assert len(result.valid_tickets) == 1
    
    def test_validate_missing_required_field(self):
        ticket = self._create_mock_ticket("TK001", 用户描述="")
        
        result = self.validator.validate([ticket])
        
        assert not result.is_valid
        assert result.invalid_count >= 1
        
        errors = result.invalid_tickets
        assert any(e.error_type == "必填字段缺失" for e in errors)
    
    def test_validate_invalid_time_format(self):
        ticket = self._create_mock_ticket("TK001", 时间="invalid_time")
        
        result = self.validator.validate([ticket])
        
        errors = result.invalid_tickets
        time_errors = [e for e in errors if e.error_type == "时间格式错误"]
        assert len(time_errors) > 0
    
    def test_validate_duplicate_ticket_id(self):
        ticket1 = self._create_mock_ticket("TK001")
        ticket2 = self._create_mock_ticket("TK001")
        
        result = self.validator.validate([ticket1, ticket2])
        
        assert not result.is_valid
        assert result.valid_count == 1
        assert "TK001" in result.duplicate_ticket_ids
    
    def test_validate_empty_description(self):
        ticket = self._create_mock_ticket("TK001", 用户描述="")
        
        result = self.validator.validate([ticket])
        
        errors = result.invalid_tickets
        desc_errors = [e for e in errors if e.field_name == "用户描述"]
        assert len(desc_errors) > 0
    
    def test_validate_channel_not_in_config(self):
        self.config.channels = ["APP", "网页端"]
        ticket = self._create_mock_ticket("TK001", 渠道="未知渠道")
        
        result = self.validator.validate([ticket])
        
        errors = result.invalid_tickets
        channel_errors = [e for e in errors if e.error_type == "渠道不在配置中"]
        assert len(channel_errors) > 0
    
    def test_validate_product_line_not_in_config(self):
        self.config.product_lines = ["用户账户", "订单退款"]
        ticket = self._create_mock_ticket("TK001", 产品线="未知产品线")
        
        result = self.validator.validate([ticket])
        
        errors = result.invalid_tickets
        product_errors = [e for e in errors if e.error_type == "产品线不在配置中"]
        assert len(product_errors) > 0


class TestValidationResult:
    def test_properties(self):
        result = ValidationResult()
        
        assert result.is_valid
        assert result.valid_count == 0
        assert result.invalid_count == 0
    
    def test_get_error_summary(self):
        result = ValidationResult()
        result.invalid_tickets = [
            ValidationError(
                ticket_id="TK001",
                field_name="用户描述",
                error_type="必填字段缺失",
                error_message="描述为空",
                row_index=2,
                source_file="test.csv"
            ),
            ValidationError(
                ticket_id="TK002",
                field_name="用户描述",
                error_type="必填字段缺失",
                error_message="描述为空",
                row_index=3,
                source_file="test.csv"
            ),
            ValidationError(
                ticket_id="TK003",
                field_name="时间",
                error_type="时间格式错误",
                error_message="格式错误",
                row_index=4,
                source_file="test.csv"
            )
        ]
        result.duplicate_ticket_ids = ["TK004"]
        
        summary = result.get_error_summary()
        
        assert summary["必填字段缺失(用户描述)"] == 2
        assert summary["时间格式错误(时间)"] == 1
        assert summary["重复工单号"] == 1


class TestQuarantine:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)
        self.config = init_config(self.project_path)
        self.validator = TicketValidator(self.config)
    
    def _create_mock_ticket(self, ticket_id: str, **kwargs) -> ParsedTicket:
        sanitized_data = {
            "工单号": ticket_id,
            "用户描述": "测试用户描述",
            "渠道": "APP",
            "产品线": "用户账户",
            "时间": "2026-04-20 09:15:30",
            "处理人": "张三",
            "处理结论": "已处理"
        }
        sanitized_data.update(kwargs)
        
        return ParsedTicket(
            ticket_id=ticket_id,
            original_data=sanitized_data.copy(),
            sanitized_data=sanitized_data,
            import_time=datetime.now(),
            source_file="test.csv",
            row_index=2
        )
    
    def test_save_quarantine(self):
        ticket1 = self._create_mock_ticket("TK001")
        ticket2 = self._create_mock_ticket("TK002", 用户描述="")
        
        result = self.validator.validate([ticket1, ticket2])
        quarantine_path = self.validator.save_quarantine(result, "test_import")
        
        assert quarantine_path.exists()
        
        with open(quarantine_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["import_id"] == "test_import"
        assert data[0]["summary"]["total_tickets"] == 2
        assert data[0]["summary"]["valid_count"] == 1
        assert data[0]["summary"]["invalid_count"] == 1
    
    def test_load_quarantine(self):
        ticket1 = self._create_mock_ticket("TK001")
        ticket2 = self._create_mock_ticket("TK002", 用户描述="")
        
        result = self.validator.validate([ticket1, ticket2])
        self.validator.save_quarantine(result, "test_import_1")
        
        quarantine_data = self.validator.load_quarantine()
        
        assert len(quarantine_data) >= 1
        assert quarantine_data[0]["import_id"] == "test_import_1"
