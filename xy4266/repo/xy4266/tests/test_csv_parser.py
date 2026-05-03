"""测试CSV解析和数据校验"""

import pytest
import tempfile
import os
from datetime import date
from pathlib import Path

from drip_salinity.csv_parser import (
    CSVParser, DataValidator, ECUnitNormalizer,
    ValidationError, ValidationErrorType, DailyRecord
)
from drip_salinity.config import ThresholdConfig


class TestECUnitNormalizer:
    """测试EC单位标准化器"""
    
    def test_normalize_unit_ms_cm(self):
        """测试标准化 mS/cm 单位"""
        assert ECUnitNormalizer.normalize_unit('mS/cm') == 'mS/cm'
        assert ECUnitNormalizer.normalize_unit('ms/cm') == 'mS/cm'
        assert ECUnitNormalizer.normalize_unit('mS') == 'mS/cm'
        assert ECUnitNormalizer.normalize_unit('MS') == 'mS/cm'
    
    def test_normalize_unit_us_cm(self):
        """测试标准化 μS/cm 单位"""
        assert ECUnitNormalizer.normalize_unit('μS/cm') == 'μS/cm'
        assert ECUnitNormalizer.normalize_unit('uS/cm') == 'μS/cm'
        assert ECUnitNormalizer.normalize_unit('us') == 'μS/cm'
    
    def test_normalize_unit_ds_m(self):
        """测试标准化 dS/m 单位"""
        assert ECUnitNormalizer.normalize_unit('dS/m') == 'dS/m'
        assert ECUnitNormalizer.normalize_unit('ds/m') == 'dS/m'
        assert ECUnitNormalizer.normalize_unit('ds') == 'dS/m'
    
    def test_convert_to_ms_cm(self):
        """测试EC值转换"""
        # 从 mS/cm 转换
        assert ECUnitNormalizer.convert_to_ms_cm(2.5, 'mS/cm') == 2.5
        
        # 从 μS/cm 转换 (1 μS/cm = 0.001 mS/cm)
        assert ECUnitNormalizer.convert_to_ms_cm(2500, 'μS/cm') == 2.5
        
        # 从 dS/m 转换 (1 dS/m = 0.1 mS/cm)
        assert ECUnitNormalizer.convert_to_ms_cm(25, 'dS/m') == 2.5


class TestCSVParser:
    """测试CSV解析器"""
    
    @pytest.fixture
    def sample_csv_content(self):
        """示例CSV内容"""
        return """日期,畦号,灌溉量,灌溉EC,排液量,排液EC,基质含水率,EC单位,备注
2024-01-10,A01,200,2.5,50,3.2,58,mS/cm,正常灌溉
2024-01-10,A02,200,2.5,55,3.0,60,mS/cm,正常灌溉
"""
    
    @pytest.fixture
    def temp_csv_file(self, sample_csv_content):
        """创建临时CSV文件"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(sample_csv_content)
            temp_path = f.name
        
        yield temp_path
        
        # 清理
        if os.path.exists(temp_path):
            os.unlink(temp_path)
    
    def test_parse_valid_csv(self, temp_csv_file):
        """测试解析有效CSV"""
        parser = CSVParser()
        records, errors = parser.parse_file(temp_csv_file)
        
        assert len(errors) == 0
        assert len(records) == 2
        
        # 检查第一条记录
        assert records[0].bed_id == "A01"
        assert records[0].record_date == date(2024, 1, 10)
        assert records[0].irrigation_volume == 200.0
        assert records[0].irrigation_ec == 2.5
        assert records[0].drainage_volume == 50.0
        assert records[0].drainage_ec == 3.2
        assert records[0].substrate_water_content == 58.0
    
    def test_parse_different_date_formats(self):
        """测试解析不同日期格式"""
        content = """日期,畦号,灌溉量,灌溉EC,排液量,排液EC,基质含水率
2024/01/10,A01,200,2.5,50,3.2,58
2024年01月11日,A02,200,2.5,50,3.2,58
10-01-2024,A03,200,2.5,50,3.2,58
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(content)
            temp_path = f.name
        
        try:
            parser = CSVParser()
            records, errors = parser.parse_file(temp_path)
            
            # 应该能解析大部分日期格式
            assert len(records) >= 1
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def test_parse_missing_fields(self):
        """测试解析缺失字段的CSV"""
        content = """日期,畦号,灌溉量,灌溉EC,排液量
2024-01-10,A01,200,2.5,50
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(content)
            temp_path = f.name
        
        try:
            parser = CSVParser()
            records, errors = parser.parse_file(temp_path)
            
            # 应该有缺失字段错误
            assert len(errors) > 0
            missing_errors = [e for e in errors if e.error_type == ValidationErrorType.MISSING_FIELD]
            assert len(missing_errors) > 0
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def test_parse_invalid_numbers(self):
        """测试解析无效数值"""
        content = """日期,畦号,灌溉量,灌溉EC,排液量,排液EC,基质含水率
2024-01-10,A01,abc,2.5,50,3.2,58
2024-01-10,A02,200,xyz,50,3.2,58
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(content)
            temp_path = f.name
        
        try:
            parser = CSVParser()
            records, errors = parser.parse_file(temp_path)
            
            # 应该有数值格式错误
            invalid_errors = [e for e in errors if e.error_type == ValidationErrorType.INVALID_NUMBER]
            assert len(invalid_errors) == 2
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)


class TestDataValidator:
    """测试数据校验器"""
    
    @pytest.fixture
    def validator(self):
        """创建校验器"""
        thresholds = ThresholdConfig(
            max_drainage_ratio=0.4,
            min_drainage_ratio=0.1,
            ec_warning_threshold=4.0,
            ec_danger_threshold=5.0
        )
        return DataValidator(thresholds)
    
    @pytest.fixture
    def sample_records(self):
        """示例记录"""
        return [
            DailyRecord(
                record_date=date(2024, 1, 10),
                bed_id="A01",
                irrigation_volume=200.0,
                irrigation_ec=2.5,
                drainage_volume=50.0,  # 排液率 25% - 正常
                drainage_ec=3.2,
                substrate_water_content=58.0
            ),
            DailyRecord(
                record_date=date(2024, 1, 10),
                bed_id="A02",
                irrigation_volume=200.0,
                irrigation_ec=2.5,
                drainage_volume=90.0,  # 排液率 45% - 过高
                drainage_ec=3.0,
                substrate_water_content=60.0
            ),
            DailyRecord(
                record_date=date(2024, 1, 10),
                bed_id="A03",
                irrigation_volume=200.0,
                irrigation_ec=2.5,
                drainage_volume=15.0,  # 排液率 7.5% - 过低
                drainage_ec=3.5,
                substrate_water_content=57.0
            )
        ]
    
    def test_validate_drainage_ratio(self, validator, sample_records):
        """测试排液率校验"""
        errors = validator.validate(sample_records)
        
        # 应该有2个排液率错误
        drainage_errors = [e for e in errors if e.error_type == ValidationErrorType.DRAINAGE_RATIO_ABNORMAL]
        assert len(drainage_errors) == 2
        
        # 检查具体错误
        error_messages = [e.message for e in drainage_errors]
        assert any("过高" in msg for msg in error_messages)
        assert any("过低" in msg for msg in error_messages)
    
    def test_validate_ec_confusion(self, validator):
        """测试EC单位混乱校验"""
        records = [
            DailyRecord(
                record_date=date(2024, 1, 10),
                bed_id="A01",
                irrigation_volume=200.0,
                irrigation_ec=100.0,  # 异常高
                drainage_volume=50.0,
                drainage_ec=120.0,
                substrate_water_content=58.0
            ),
            DailyRecord(
                record_date=date(2024, 1, 10),
                bed_id="A02",
                irrigation_volume=200.0,
                irrigation_ec=0.05,  # 异常低
                drainage_volume=50.0,
                drainage_ec=0.06,
                substrate_water_content=58.0
            ),
            DailyRecord(
                record_date=date(2024, 1, 10),
                bed_id="A03",
                irrigation_volume=200.0,
                irrigation_ec=3.0,
                drainage_volume=50.0,
                drainage_ec=2.0,  # 排液EC低于灌溉EC的80%
                substrate_water_content=58.0
            )
        ]
        
        errors = validator.validate(records)
        ec_errors = [e for e in errors if e.error_type == ValidationErrorType.EC_UNIT_CONFUSION]
        
        # 应该有3个EC相关错误
        assert len(ec_errors) >= 3
    
    def test_validate_duplicate_beds(self, validator):
        """测试重复畦号校验"""
        records = [
            DailyRecord(
                record_date=date(2024, 1, 10),
                bed_id="A01",
                irrigation_volume=200.0,
                irrigation_ec=2.5,
                drainage_volume=50.0,
                drainage_ec=3.2,
                substrate_water_content=58.0
            ),
            DailyRecord(
                record_date=date(2024, 1, 10),  # 同一日期
                bed_id="A01",  # 同一畦号
                irrigation_volume=200.0,
                irrigation_ec=2.5,
                drainage_volume=50.0,
                drainage_ec=3.2,
                substrate_water_content=58.0
            )
        ]
        
        errors = validator.validate(records)
        duplicate_errors = [e for e in errors if e.error_type == ValidationErrorType.DUPLICATE_BED_ID]
        
        # 应该有重复错误
        assert len(duplicate_errors) >= 1
