import os
import tempfile
import unittest
from datetime import datetime
from ferment_calibrator.csv_parser import (
    CSVParser,
    FieldMapper,
    TimeParser,
    FermentationRecord,
    ValidationError,
    ValidationErrorType,
    QuarantineStore
)


class TestFieldMapper(unittest.TestCase):
    
    def test_english_field_names(self):
        headers = ['time', 'temperature', 'pH', 'DO', 'stirring', 'OD600', 'feed', 'feed_recipe', 'phase', 'notes']
        mapper = FieldMapper(headers)
        mapping = mapper.get_mapping()
        self.assertEqual(mapping['time'], 'time')
        self.assertEqual(mapping['temperature'], 'temperature')
        self.assertEqual(mapping['ph'], 'pH')
        self.assertEqual(mapping['do'], 'DO')
    
    def test_chinese_field_names(self):
        headers = ['时间', '温度', 'pH', '溶氧', '搅拌转速', 'OD600', '补料量', '补料配方', '阶段', '批次备注']
        mapper = FieldMapper(headers)
        mapping = mapper.get_mapping()
        self.assertEqual(mapping['time'], '时间')
        self.assertEqual(mapping['temperature'], '温度')
        self.assertEqual(mapping['ph'], 'pH')
        self.assertEqual(mapping['do'], '溶氧')
    
    def test_mixed_field_names(self):
        headers = ['time', '温度', 'pH值', 'dissolved_oxygen', 'stir', '取样OD600', 'feed amount', '阶段', 'batch_notes']
        mapper = FieldMapper(headers)
        mapping = mapper.get_mapping()
        self.assertEqual(mapping['time'], 'time')
        self.assertEqual(mapping['temperature'], '温度')
        self.assertEqual(mapping['ph'], 'pH值')
        self.assertEqual(mapping['do'], 'dissolved_oxygen')
    
    def test_get_field(self):
        headers = ['时间', '温度', 'pH', '溶氧']
        mapper = FieldMapper(headers)
        row = {'时间': '2024-01-01 00:00:00', '温度': '30.0', 'pH': '5.5', '溶氧': '95.0'}
        self.assertEqual(mapper.get_field(row, 'time'), '2024-01-01 00:00:00')
        self.assertEqual(mapper.get_field(row, 'temperature'), '30.0')
        self.assertEqual(mapper.get_field(row, 'ph'), '5.5')
        self.assertEqual(mapper.get_field(row, 'do'), '95.0')


class TestTimeParser(unittest.TestCase):
    
    def test_iso_format(self):
        parser = TimeParser()
        result = parser.parse('2024-05-01 08:00:00')
        self.assertIsInstance(result, datetime)
        self.assertEqual(result.year, 2024)
        self.assertEqual(result.month, 5)
        self.assertEqual(result.day, 1)
        self.assertEqual(result.hour, 8)
    
    def test_iso_format_with_t(self):
        parser = TimeParser()
        result = parser.parse('2024-05-01T08:30:00')
        self.assertEqual(result.hour, 8)
        self.assertEqual(result.minute, 30)
    
    def test_european_format(self):
        parser = TimeParser()
        result = parser.parse('01/05/2024 09:00:00')
        self.assertEqual(result.day, 1)
        self.assertEqual(result.month, 5)
        self.assertEqual(result.hour, 9)
    
    def test_hour_format(self):
        parser = TimeParser()
        result = parser.parse('2.5')
        self.assertEqual(result.hour, 2)
        self.assertEqual(result.minute, 30)
    
    def test_invalid_time(self):
        parser = TimeParser()
        with self.assertRaises(ValueError):
            parser.parse('invalid_time_string')


class TestFermentationRecord(unittest.TestCase):
    
    def test_create_record(self):
        record = FermentationRecord(
            timestamp=datetime(2024, 5, 1, 8, 0, 0),
            temperature=30.0,
            ph=5.5,
            do=95.0,
            stirring=200,
            od600=0.1,
            feed=0.0,
            feed_recipe=None,
            phase='lag',
            notes='接种完成'
        )
        self.assertEqual(record.temperature, 30.0)
        self.assertEqual(record.ph, 5.5)
        self.assertEqual(record.do, 95.0)
        self.assertEqual(record.od600, 0.1)
        self.assertEqual(record.phase, 'lag')
    
    def test_to_dict(self):
        record = FermentationRecord(
            timestamp=datetime(2024, 5, 1, 8, 0, 0),
            temperature=30.0,
            ph=5.5,
            do=95.0,
            stirring=200,
            od600=0.1,
            feed=0.0,
            feed_recipe=None,
            phase='lag',
            notes='测试'
        )
        data = record.to_dict()
        self.assertEqual(data['temperature'], 30.0)
        self.assertEqual(data['ph'], 5.5)
        self.assertEqual(data['do'], 95.0)
        self.assertIn('timestamp', data)
        self.assertIn('phase', data)
    
    def test_has_od_sample(self):
        record_with_od = FermentationRecord(
            timestamp=datetime(2024, 5, 1, 8, 0, 0),
            temperature=30.0,
            ph=5.5,
            do=95.0,
            stirring=200,
            od600=0.1,
            feed=0.0,
            feed_recipe=None,
            phase='lag',
            notes=None
        )
        self.assertTrue(record_with_od.has_od_sample())
        
        record_without_od = FermentationRecord(
            timestamp=datetime(2024, 5, 1, 8, 30, 0),
            temperature=30.1,
            ph=5.5,
            do=94.5,
            stirring=200,
            od600=None,
            feed=0.0,
            feed_recipe=None,
            phase='lag',
            notes=None
        )
        self.assertFalse(record_without_od.has_od_sample())
    
    def test_is_feed_event(self):
        feed_record = FermentationRecord(
            timestamp=datetime(2024, 5, 1, 14, 0, 0),
            temperature=30.2,
            ph=5.0,
            do=60.0,
            stirring=350,
            od600=0.4,
            feed=50.0,
            feed_recipe='feedA',
            phase='feed',
            notes='第一次补料'
        )
        self.assertTrue(feed_record.is_feed_event())
        
        non_feed_record = FermentationRecord(
            timestamp=datetime(2024, 5, 1, 8, 0, 0),
            temperature=30.0,
            ph=5.5,
            do=95.0,
            stirring=200,
            od600=0.1,
            feed=0.0,
            feed_recipe=None,
            phase='lag',
            notes=None
        )
        self.assertFalse(non_feed_record.is_feed_event())


class TestValidationError(unittest.TestCase):
    
    def test_create_error(self):
        error = ValidationError(
            error_type=ValidationErrorType.MISSING_FIELD,
            field='time',
            value=None,
            message='时间字段缺失'
        )
        self.assertEqual(error.error_type, ValidationErrorType.MISSING_FIELD)
        self.assertEqual(error.field, 'time')
        self.assertEqual(error.message, '时间字段缺失')
    
    def test_to_dict(self):
        error = ValidationError(
            error_type=ValidationErrorType.INVALID_VALUE,
            field='temperature',
            value='abc',
            message='温度必须是数值'
        )
        data = error.to_dict()
        self.assertEqual(data['error_type'], 'INVALID_VALUE')
        self.assertEqual(data['field'], 'temperature')
        self.assertEqual(data['value'], 'abc')


class TestQuarantineStore(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.quarantine_path = os.path.join(self.temp_dir, 'quarantine.json')
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_add_quarantine(self):
        store = QuarantineStore(self.quarantine_path)
        error = ValidationError(
            error_type=ValidationErrorType.INVALID_TIME,
            field='time',
            value='invalid',
            message='无效的时间格式'
        )
        store.add_quarantine({'time': 'invalid', 'temperature': '30.0'}, error, 'test.csv')
        
        stats = store.get_statistics()
        self.assertEqual(stats['total_quarantined'], 1)
        self.assertEqual(stats['by_error_type']['INVALID_TIME'], 1)
    
    def test_save_and_load(self):
        store = QuarantineStore(self.quarantine_path)
        error = ValidationError(
            error_type=ValidationErrorType.VALUE_OUT_OF_RANGE,
            field='pH',
            value=15.0,
            message='pH值超出范围'
        )
        store.add_quarantine({'pH': '15.0'}, error, 'test.csv')
        store.save()
        
        store2 = QuarantineStore(self.quarantine_path)
        stats = store2.get_statistics()
        self.assertEqual(stats['total_quarantined'], 1)
    
    def test_get_all_errors(self):
        store = QuarantineStore(self.quarantine_path)
        error1 = ValidationError(
            error_type=ValidationErrorType.DUPLICATE_TIME,
            field='time',
            value='2024-05-01 08:00:00',
            message='重复时间点'
        )
        error2 = ValidationError(
            error_type=ValidationErrorType.INVALID_PHASE,
            field='phase',
            value='invalid',
            message='无效的阶段枚举'
        )
        store.add_quarantine({'time': '2024-05-01 08:00:00'}, error1, 'test.csv')
        store.add_quarantine({'phase': 'invalid'}, error2, 'test.csv')
        
        errors = store.get_all_errors()
        self.assertEqual(len(errors), 2)
        
        by_type = store.get_errors_by_type(ValidationErrorType.DUPLICATE_TIME)
        self.assertEqual(len(by_type), 1)


if __name__ == '__main__':
    unittest.main()
