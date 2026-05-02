import pytest
import tempfile
import json
import csv
from pathlib import Path
from freezevalidator.parser import (
    calculate_file_hash, parse_position_to_row_col,
    PositionTableParser, ScanLogParser, TemperatureParser, TransferFormParser
)


class TestCalculateFileHash:
    def test_hash_consistency(self, tmp_path):
        file_path = tmp_path / "test.txt"
        file_path.write_text("test content")
        
        hash1 = calculate_file_hash(file_path)
        hash2 = calculate_file_hash(file_path)
        
        assert hash1 == hash2
        assert len(hash1) == 64
    
    def test_hash_different_content(self, tmp_path):
        file1 = tmp_path / "test1.txt"
        file2 = tmp_path / "test2.txt"
        file1.write_text("content A")
        file2.write_text("content B")
        
        hash1 = calculate_file_hash(file1)
        hash2 = calculate_file_hash(file2)
        
        assert hash1 != hash2


class TestParsePosition:
    def test_valid_positions(self):
        test_cases = [
            ("A01", 0, 0),
            ("a01", 0, 0),
            ("B10", 1, 9),
            ("J10", 9, 9),
            ("Z01", 25, 0),
        ]
        
        for pos_str, expected_row, expected_col in test_cases:
            row, col = parse_position_to_row_col(pos_str)
            assert row == expected_row
            assert col == expected_col
    
    def test_invalid_positions(self):
        invalid_cases = ["", "A", "01", "AA01", "A-1"]
        for pos in invalid_cases:
            with pytest.raises(Exception):
                parse_position_to_row_col(pos)


class TestPositionTableParser:
    def test_parse_valid_csv(self, tmp_path):
        csv_content = """barcode,box_id,position,batch_id
SAM001,BOX001,A01,BATCH001
SAM002,BOX001,A02,BATCH001
"""
        file_path = tmp_path / "positions.csv"
        file_path.write_text(csv_content)
        
        positions, metadata = PositionTableParser.parse(file_path)
        
        assert len(positions) == 2
        assert positions[0].barcode == "SAM001"
        assert positions[0].box_id == "BOX001"
        assert positions[0].row == 0
        assert positions[0].col == 0
        assert "BOX001" in metadata["box_ids"]
    
    def test_parse_with_chinese_headers(self, tmp_path):
        csv_content = """样本条码,冻存盒号,孔位,批次号
SAM001,BOX001,A01,BATCH001
SAM002,BOX001,A02,BATCH001
"""
        file_path = tmp_path / "positions.csv"
        file_path.write_text(csv_content)
        
        positions, metadata = PositionTableParser.parse(file_path)
        
        assert len(positions) == 2
        assert positions[0].barcode == "SAM001"


class TestScanLogParser:
    def test_parse_valid_csv(self, tmp_path):
        csv_content = """barcode,scan_time,scanner_id
SAM001,2026-05-03T09:15:00,SCAN001
SAM002,2026-05-03T09:15:05,SCAN001
"""
        file_path = tmp_path / "scans.csv"
        file_path.write_text(csv_content)
        
        scans, metadata = ScanLogParser.parse(file_path)
        
        assert len(scans) == 2
        assert scans[0].barcode == "SAM001"
        assert scans[0].scanner_id == "SCAN001"


class TestTemperatureParser:
    def test_parse_valid_json(self, tmp_path):
        json_content = """{
            "freezer_id": "FREEZER001",
            "readings": [
                {
                    "timestamp": "2026-05-03T08:00:00",
                    "temperature": -78.5,
                    "freezer_id": "FREEZER001",
                    "is_alert": false,
                    "alert_marked": false
                }
            ]
        }
        """
        file_path = tmp_path / "temperature.json"
        file_path.write_text(json_content)
        
        readings, metadata = TemperatureParser.parse(file_path)
        
        assert len(readings) == 1
        assert readings[0].temperature == -78.5
        assert readings[0].freezer_id == "FREEZER001"
        assert not readings[0].is_alert
    
    def test_parse_with_alerts(self, tmp_path):
        json_content = """{
            "readings": [
                {
                    "timestamp": "2026-05-03T08:00:00",
                    "temperature": -65.0,
                    "freezer_id": "FREEZER001",
                    "is_alert": true,
                    "alert_marked": false
                }
            ]
        }
        """
        file_path = tmp_path / "temperature.json"
        file_path.write_text(json_content)
        
        readings, metadata = TemperatureParser.parse(file_path)
        
        assert len(readings) == 1
        assert readings[0].is_alert
        assert not readings[0].alert_marked
        assert metadata["alerts_count"] == 1


class TestTransferFormParser:
    def test_parse_valid_json(self, tmp_path):
        json_content = """{
            "transfer_id": "TRANSFER_001",
            "transfer_date": "2026-05-03T09:00:00",
            "sender_name": "张三",
            "sender_signature": "ZS_SIG",
            "sender_sign_date": "2026-05-03T09:10:00",
            "receiver_name": "李四",
            "receiver_signature": "LS_SIG",
            "receiver_sign_date": "2026-05-03T09:15:00",
            "box_ids": ["BOX001", "BOX002"],
            "notes": "测试交接"
        }
        """
        file_path = tmp_path / "transfer.json"
        file_path.write_text(json_content)
        
        form, metadata = TransferFormParser.parse(file_path)
        
        assert form is not None
        assert form.transfer_id == "TRANSFER_001"
        assert form.sender_name == "张三"
        assert form.receiver_name == "李四"
        assert form.sender_signature == "ZS_SIG"
        assert form.receiver_signature == "LS_SIG"
        assert form.box_ids == ["BOX001", "BOX002"]
    
    def test_parse_missing_signatures(self, tmp_path):
        json_content = """{
            "transfer_id": "TRANSFER_002",
            "transfer_date": "2026-05-03T09:00:00",
            "sender_name": "张三",
            "sender_signature": "",
            "receiver_name": "李四",
            "receiver_signature": null,
            "box_ids": ["BOX001"]
        }
        """
        file_path = tmp_path / "transfer.json"
        file_path.write_text(json_content)
        
        form, metadata = TransferFormParser.parse(file_path)
        
        assert form is not None
        assert not form.sender_signature
        assert not form.receiver_signature
