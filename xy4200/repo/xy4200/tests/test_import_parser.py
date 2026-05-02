import os
import json
import tempfile
import pytest
from services.import_parser import ImportParser


class TestImportParser:
    @pytest.fixture
    def sample_json_data(self):
        return [
            {
                "pottery_id": "TP-IMPORT-001",
                "trench": "T01",
                "layer": "L03",
                "square": "A1",
                "length": 15.2,
                "width": 8.5,
                "thickness": 0.8,
                "decoration": "绳纹",
                "paste_type": "夹砂红陶",
                "status": "pending"
            },
            {
                "pottery_id": "TP-IMPORT-002",
                "trench": "T01",
                "layer": "L03",
                "square": "A2",
                "length": 12.8,
                "width": 9.2,
                "thickness": 0.7,
                "decoration": "篮纹",
                "paste_type": "泥质灰陶",
                "status": "pending"
            }
        ]

    @pytest.fixture
    def sample_csv_data(self):
        return """pottery_id,trench,layer,square,length,width,thickness,decoration,paste_type,status
TP-IMPORT-001,T01,L03,A1,15.2,8.5,0.8,绳纹,夹砂红陶,pending
TP-IMPORT-002,T01,L03,A2,12.8,9.2,0.7,篮纹,泥质灰陶,pending
"""

    def test_parse_json_valid(self, sample_json_data):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(sample_json_data, f)
            json_file = f.name
        
        try:
            parser = ImportParser()
            result = parser.parse_json(json_file)
            
            assert result['success'] is True
            assert len(result['data']) == 2
            assert result['data'][0]['pottery_id'] == 'TP-IMPORT-001'
            assert result['data'][1]['pottery_id'] == 'TP-IMPORT-002'
        finally:
            os.unlink(json_file)

    def test_parse_json_invalid_format(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write('not valid json {{{')
            json_file = f.name
        
        try:
            parser = ImportParser()
            result = parser.parse_json(json_file)
            
            assert result['success'] is False
            assert 'error' in result
        finally:
            os.unlink(json_file)

    def test_parse_json_not_list(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({'key': 'value'}, f)
            json_file = f.name
        
        try:
            parser = ImportParser()
            result = parser.parse_json(json_file)
            
            assert result['success'] is False
            assert '格式错误' in result['error']
        finally:
            os.unlink(json_file)

    def test_parse_csv_valid(self, sample_csv_data):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(sample_csv_data)
            csv_file = f.name
        
        try:
            parser = ImportParser()
            result = parser.parse_csv(csv_file)
            
            assert result['success'] is True
            assert len(result['data']) == 2
            assert result['data'][0]['pottery_id'] == 'TP-IMPORT-001'
            assert result['data'][1]['pottery_id'] == 'TP-IMPORT-002'
        finally:
            os.unlink(csv_file)

    def test_parse_csv_empty(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write('pottery_id,trench,layer')
            csv_file = f.name
        
        try:
            parser = ImportParser()
            result = parser.parse_csv(csv_file)
            
            assert result['success'] is True
            assert len(result['data']) == 0
        finally:
            os.unlink(csv_file)

    def test_detect_format_json(self):
        parser = ImportParser()
        
        assert parser.detect_format('data.json') == 'json'
        assert parser.detect_format('/path/to/data.JSON') == 'json'
        assert parser.detect_format('data.Json') == 'json'

    def test_detect_format_csv(self):
        parser = ImportParser()
        
        assert parser.detect_format('data.csv') == 'csv'
        assert parser.detect_format('/path/to/data.CSV') == 'csv'

    def test_detect_format_unknown(self):
        parser = ImportParser()
        
        assert parser.detect_format('data.txt') == 'unknown'
        assert parser.detect_format('data') == 'unknown'

    def test_parse_auto_json(self, sample_json_data):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(sample_json_data, f)
            json_file = f.name
        
        try:
            parser = ImportParser()
            result = parser.parse_auto(json_file)
            
            assert result['success'] is True
            assert len(result['data']) == 2
        finally:
            os.unlink(json_file)

    def test_parse_auto_csv(self, sample_csv_data):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(sample_csv_data)
            csv_file = f.name
        
        try:
            parser = ImportParser()
            result = parser.parse_auto(csv_file)
            
            assert result['success'] is True
            assert len(result['data']) == 2
        finally:
            os.unlink(csv_file)

    def test_parse_auto_unknown_format(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write('some text')
            txt_file = f.name
        
        try:
            parser = ImportParser()
            result = parser.parse_auto(txt_file)
            
            assert result['success'] is False
            assert '不支持的文件格式' in result['error']
        finally:
            os.unlink(txt_file)

    def test_validate_pottery_record_valid(self):
        parser = ImportParser()
        
        valid_record = {
            'pottery_id': 'TP-VALID-001',
            'trench': 'T01',
            'layer': 'L03'
        }
        
        result = parser._validate_pottery_record(valid_record)
        
        assert result['valid'] is True
        assert len(result['errors']) == 0

    def test_validate_pottery_record_missing_required(self):
        parser = ImportParser()
        
        invalid_record = {
            'trench': 'T01'
        }
        
        result = parser._validate_pottery_record(invalid_record)
        
        assert result['valid'] is False
        assert len(result['errors']) > 0
        assert '缺少必填字段' in result['errors'][0]

    def test_batch_validate_records(self, sample_json_data):
        parser = ImportParser()
        
        result = parser.validate_records(sample_json_data, 'pottery')
        
        assert result['total'] == 2
        assert result['valid'] == 2
        assert result['invalid'] == 0

    def test_batch_validate_mixed_records(self):
        parser = ImportParser()
        
        records = [
            {
                'pottery_id': 'TP-VALID-001',
                'trench': 'T01',
                'layer': 'L03'
            },
            {
                'pottery_id': 'TP-INVALID-001'
            }
        ]
        
        result = parser.validate_records(records, 'pottery')
        
        assert result['total'] == 2
        assert result['valid'] == 1
        assert result['invalid'] == 1
        assert len(result['details']) == 2
