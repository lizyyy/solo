import pytest
import tempfile
import os
from datetime import datetime
from src.parsers import CSVParser, JSONParser


class TestCSVParser:
    
    def test_parse_simple_csv(self):
        parser = CSVParser()
        
        csv_content = """样本ID,样本类型,架位ID,位置
BL001,血样,RACK01,A01
BL002,血样,RACK01,A02
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            results = parser.parse(temp_path)
            assert len(results) == 2
            assert results[0]["样本ID"] == "BL001"
            assert results[1]["样本类型"] == "血样"
        finally:
            os.unlink(temp_path)
    
    def test_parse_datetime(self):
        parser = CSVParser()
        
        csv_content = """样本ID,扫描时间
BL001,2026-05-03 08:30:00
BL002,2026/05/03
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(csv_content)
            temp_path = f.name
        
        try:
            results = parser.parse(temp_path)
            assert len(results) == 2
            assert isinstance(results[0]["扫描时间"], datetime)
        finally:
            os.unlink(temp_path)


class TestJSONParser:
    
    def test_parse_json_list(self):
        parser = JSONParser()
        
        json_content = """[
    {"sample_id": "BL001", "temperature": 4.5},
    {"sample_id": "BL002", "temperature": 5.2}
]"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            f.write(json_content)
            temp_path = f.name
        
        try:
            results = parser.parse(temp_path)
            assert len(results) == 2
            assert results[0]["sample_id"] == "BL001"
            assert results[1]["temperature"] == 5.2
        finally:
            os.unlink(temp_path)
    
    def test_parse_json_object_with_data_key(self):
        parser = JSONParser()
        
        json_content = """{
    "records": [
        {"fridge_id": "FRIDGE01", "temperature": 4.5}
    ]
}"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            f.write(json_content)
            temp_path = f.name
        
        try:
            results = parser.parse(temp_path)
            assert len(results) == 1
            assert results[0]["fridge_id"] == "FRIDGE01"
        finally:
            os.unlink(temp_path)
