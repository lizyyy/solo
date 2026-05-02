# -*- coding: utf-8 -*-
"""
数据校验器测试
"""

import pytest
from datetime import datetime, timedelta
from core.models import SKUData, LabelTemplate, TemplateField
from core.validator import BarcodeValidator, DateValidator, DataValidator
from core.constants import BarcodeType, ErrorLevel


class TestBarcodeValidator:
    """条码校验器测试"""
    
    def test_validate_code128_valid(self):
        """测试有效的CODE128条码"""
        is_valid, errors = BarcodeValidator.validate_code128("1234567890")
        assert is_valid is True
        assert len(errors) == 0
    
    def test_validate_code128_empty(self):
        """测试空的CODE128条码"""
        is_valid, errors = BarcodeValidator.validate_code128("")
        assert is_valid is False
        assert "条码内容为空" in errors[0]
    
    def test_validate_code128_non_ascii(self):
        """测试包含非ASCII字符的CODE128条码"""
        is_valid, errors = BarcodeValidator.validate_code128("条码测试")
        assert is_valid is False
        assert any("非ASCII" in e for e in errors)
    
    def test_validate_ean13_valid(self):
        """测试有效的EAN-13条码"""
        is_valid, errors = BarcodeValidator.validate_ean13("9787111213826")
        assert is_valid is True
    
    def test_validate_ean13_invalid_length(self):
        """测试EAN-13长度错误"""
        is_valid, errors = BarcodeValidator.validate_ean13("12345")
        assert is_valid is False
        assert any("必须为12或13位" in e for e in errors)
    
    def test_validate_ean13_non_digit(self):
        """测试EAN-13包含非数字"""
        is_valid, errors = BarcodeValidator.validate_ean13("ABC1234567890")
        assert is_valid is False
        assert any("必须为纯数字" in e for e in errors)
    
    def test_validate_qrcode_valid(self):
        """测试有效的QR Code"""
        is_valid, errors = BarcodeValidator.validate_qrcode("Hello World")
        assert is_valid is True


class TestDateValidator:
    """日期校验器测试"""
    
    def test_parse_date_valid_format1(self):
        """测试解析有效日期格式 YYYY-MM-DD"""
        result = DateValidator.parse_date("2027-05-01")
        assert result is not None
        assert result.year == 2027
        assert result.month == 5
        assert result.day == 1
    
    def test_parse_date_valid_format2(self):
        """测试解析有效日期格式 YYYY/MM/DD"""
        result = DateValidator.parse_date("2027/05/01")
        assert result is not None
        assert result.year == 2027
    
    def test_parse_date_valid_format3(self):
        """测试解析有效日期格式 YYYYMMDD"""
        result = DateValidator.parse_date("20270501")
        assert result is not None
        assert result.year == 2027
    
    def test_parse_date_invalid(self):
        """测试解析无效日期"""
        result = DateValidator.parse_date("无效日期")
        assert result is None
    
    def test_validate_expiry_valid(self):
        """测试有效的效期"""
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        is_valid, errors = DateValidator.validate_expiry(future_date)
        assert is_valid is True
    
    def test_validate_expiry_past(self):
        """测试已过期的效期"""
        past_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        is_valid, errors = DateValidator.validate_expiry(past_date)
        assert is_valid is False
        assert any("已过期" in e for e in errors)
    
    def test_validate_expiry_empty(self):
        """测试空的效期"""
        is_valid, errors = DateValidator.validate_expiry("")
        assert is_valid is False
        assert any("为空" in e for e in errors)


class TestDataValidator:
    """主数据校验器测试"""
    
    @pytest.fixture
    def sample_template(self):
        """创建示例模板"""
        return LabelTemplate(
            name="测试模板",
            width_mm=60.0,
            height_mm=40.0,
            fields=[
                TemplateField(
                    name="sku",
                    field_type="text",
                    x=5.0,
                    y=5.0,
                    is_required=True
                ),
                TemplateField(
                    name="box_number",
                    field_type="barcode",
                    x=5.0,
                    y=15.0,
                    barcode_type=BarcodeType.CODE128,
                    is_required=True
                ),
                TemplateField(
                    name="batch_number",
                    field_type="text",
                    x=5.0,
                    y=25.0,
                    is_required=True
                ),
            ]
        )
    
    @pytest.fixture
    def validator(self, sample_template):
        """创建校验器"""
        return DataValidator(sample_template)
    
    def test_validate_single_valid(self, validator):
        """测试校验有效的SKU数据"""
        sku = SKUData(
            sku="SKU001",
            box_number="BOX-001",
            batch_number="BATCH-001",
            row_index=1
        )
        
        result = validator.validate_single(sku)
        
        assert result.is_valid is True
        assert len(result.errors) == 0
    
    def test_validate_single_missing_required(self, validator):
        """测试校验缺失必填字段"""
        sku = SKUData(
            sku="SKU001",
            box_number="",
            batch_number="BATCH-001",
            row_index=1
        )
        
        result = validator.validate_single(sku)
        
        assert result.is_valid is False
        assert any("箱号不能为空" in e.message for e in result.errors)
    
    def test_validate_all_duplicate_box(self, validator):
        """测试校验重复箱号"""
        sku1 = SKUData(
            sku="SKU001",
            box_number="BOX-001",
            batch_number="BATCH-001",
            row_index=1
        )
        sku2 = SKUData(
            sku="SKU002",
            box_number="BOX-001",
            batch_number="BATCH-002",
            row_index=2
        )
        
        results = validator.validate_all([sku1, sku2])
        
        assert len(results) == 2
        assert any("箱号重复" in e.message for r in results for e in r.errors)
    
    def test_check_template_fields_match(self, validator, sample_template):
        """测试模板字段匹配检查"""
        sku = SKUData(
            sku="SKU001",
            box_number="BOX-001",
            batch_number="BATCH-001",
            row_index=1
        )
        
        missing, extra = validator.check_template_fields([sku], sample_template)
        
        assert len(missing) == 0
    
    def test_validate_without_template(self):
        """测试无模板时的校验"""
        validator = DataValidator()
        sku = SKUData(
            sku="SKU001",
            box_number="BOX-001",
            batch_number="BATCH-001",
            row_index=1
        )
        
        result = validator.validate_single(sku)
        
        assert result.is_valid is False
        assert any("未加载标签模板" in e.message for e in result.errors)
