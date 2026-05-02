"""
CSV解析与脱敏模块测试
"""

import tempfile
import csv
from pathlib import Path
from datetime import datetime

import pytest

from ticket_cluster_helper.config import Config, init_config
from ticket_cluster_helper.csv_parser import TicketParser, ParsedTicket, load_all_tickets


class TestTicketParser:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)
        self.config = init_config(self.project_path)
        self.parser = TicketParser(self.config)
        
        self.sample_csv = self.project_path / "test_tickets.csv"
        self._create_sample_csv()
    
    def _create_sample_csv(self):
        data = [
            {
                "工单号": "TK001",
                "用户描述": "登录一直提示密码错误，联系电话13812345678，邮箱user@example.com",
                "渠道": "APP",
                "产品线": "用户账户",
                "时间": "2026-04-20 09:15:30",
                "处理人": "张三",
                "处理结论": "已重置密码",
                "手机号": "13812345678",
                "邮箱": "user@example.com",
                "订单号": "ORD20260420001"
            },
            {
                "工单号": "TK002",
                "用户描述": "退款申请一直没处理",
                "渠道": "网页端",
                "产品线": "订单退款",
                "时间": "2026-04-20 10:20:15",
                "处理人": "李四",
                "处理结论": "已审核通过",
                "手机号": "13923456789",
                "邮箱": "user2@example.com",
                "订单号": "ORD20260420002"
            }
        ]
        
        with open(self.sample_csv, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
    
    def test_import_csv(self):
        tickets = self.parser.import_csv(self.sample_csv, "test_import")
        
        assert len(tickets) == 2
        assert tickets[0].ticket_id == "TK001"
        assert tickets[1].ticket_id == "TK002"
    
    def test_sanitize_phone(self):
        tickets = self.parser.import_csv(self.sample_csv, "test_import")
        
        tk001 = tickets[0]
        sanitized_phone = tk001.sanitized_data.get("手机号", "")
        
        assert "*" in sanitized_phone
        assert sanitized_phone != "13812345678"
        assert sanitized_phone.startswith("138")
        assert sanitized_phone.endswith("5678")
    
    def test_sanitize_email(self):
        tickets = self.parser.import_csv(self.sample_csv, "test_import")
        
        tk001 = tickets[0]
        sanitized_email = tk001.sanitized_data.get("邮箱", "")
        
        assert "*" in sanitized_email or "***" in sanitized_email
        assert sanitized_email != "user@example.com"
    
    def test_sanitize_text_in_description(self):
        tickets = self.parser.import_csv(self.sample_csv, "test_import")
        
        tk001 = tickets[0]
        sanitized_desc = tk001.sanitized_data.get("用户描述", "")
        
        assert "13812345678" not in sanitized_desc
        assert "user@example.com" not in sanitized_desc
    
    def test_save_and_load_tickets(self):
        tickets = self.parser.import_csv(self.sample_csv, "test_import")
        saved_path = self.parser.save_tickets(tickets, "test_import")
        
        assert saved_path.exists()
        
        loaded_tickets = self.parser.load_tickets("test_import")
        
        assert len(loaded_tickets) == 2
        assert loaded_tickets[0].ticket_id == "TK001"
        assert loaded_tickets[1].ticket_id == "TK002"
    
    def test_list_imports(self):
        tickets = self.parser.import_csv(self.sample_csv, "test_import_1")
        self.parser.save_tickets(tickets, "test_import_1")
        
        imports = self.parser.list_imports()
        
        assert len(imports) >= 1
        assert any(i["import_id"] == "test_import_1" for i in imports)


class TestMaskSensitiveField:
    def setup_method(self):
        self.config = Config()
        self.parser = TicketParser(self.config)
    
    def test_mask_phone_11_digits(self):
        masked = self.parser._mask_sensitive_field("13812345678", "手机号")
        
        assert masked == "138****5678"
        assert len(masked) == 11
    
    def test_mask_email(self):
        masked = self.parser._mask_sensitive_field("testuser@example.com", "邮箱")
        
        assert "@" in masked
        assert masked.startswith("te") or masked.startswith("test")
        assert "***" in masked
        assert masked.endswith("@example.com")
    
    def test_mask_order_id(self):
        masked = self.parser._mask_sensitive_field("ORD202604200001", "订单号")
        
        assert "****" in masked
        assert masked != "ORD202604200001"
    
    def test_mask_id_card(self):
        masked = self.parser._mask_sensitive_field("110101199001011234", "身份证号")
        
        assert "********" in masked
        assert masked.startswith("110101")
        assert masked.endswith("1234")
