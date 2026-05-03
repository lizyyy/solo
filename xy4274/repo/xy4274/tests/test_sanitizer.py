"""脱敏规则模块测试"""

from pathlib import Path
from datetime import timedelta

import pytest

from interview_sanitizer.sanitizer import (
    NameSanitizer,
    SegmentSanitizer,
    SRTSanitizer,
    SanitizationRules,
    phone_sanitizer,
    id_card_sanitizer,
    SanitizationResult,
    Replacement,
)
from interview_sanitizer.parser import (
    AuthorizationData,
    AuthorizationRecord,
    SensitiveNames,
    SensitiveName,
)


class TestNameSanitizer:
    """姓名脱敏器测试"""
    
    def test_sanitize_text_with_pseudonym(self):
        """测试有化名的姓名替换"""
        auth_data = AuthorizationData(file_path=Path("/test"))
        auth_data.records["张三"] = AuthorizationRecord(
            name="张三",
            pseudonym="张大爷",
            is_authorized=True
        )
        auth_data.records["李四"] = AuthorizationRecord(
            name="李四",
            pseudonym="李师傅",
            is_authorized=True
        )
        
        sanitizer = NameSanitizer(auth_data=auth_data)
        
        result = sanitizer.sanitize_text("大家好，我是张三，我的同事是李四。")
        
        assert result.sanitized_text == "大家好，我是张大爷，我的同事是李师傅。"
        assert len(result.replacements) == 2
        assert result.is_safe is True
    
    def test_sanitize_text_without_pseudonym(self):
        """测试无化名的姓名（应报告问题）"""
        auth_data = AuthorizationData(file_path=Path("/test"))
        auth_data.records["王五"] = AuthorizationRecord(
            name="王五",
            pseudonym=None,
            is_authorized=True
        )
        
        sanitizer = NameSanitizer(auth_data=auth_data)
        
        result = sanitizer.sanitize_text("王五今天来了。")
        
        assert result.sanitized_text == "王五今天来了。"
        assert len(result.replacements) == 0
        assert len(result.issues) == 1
        assert result.is_safe is False
    
    def test_has_pseudonym(self):
        """测试检查是否有化名"""
        auth_data = AuthorizationData(file_path=Path("/test"))
        auth_data.records["张三"] = AuthorizationRecord(
            name="张三",
            pseudonym="张大爷",
            is_authorized=True
        )
        auth_data.records["李四"] = AuthorizationRecord(
            name="李四",
            pseudonym=None,
            is_authorized=True
        )
        
        sanitizer = NameSanitizer(auth_data=auth_data)
        
        assert sanitizer.has_pseudonym("张三") is True
        assert sanitizer.has_pseudonym("李四") is False
        assert sanitizer.has_pseudonym("王五") is False
    
    def test_get_pseudonym(self):
        """测试获取化名"""
        auth_data = AuthorizationData(file_path=Path("/test"))
        auth_data.records["张三"] = AuthorizationRecord(
            name="张三",
            pseudonym="张大爷",
            is_authorized=True
        )
        
        sanitizer = NameSanitizer(auth_data=auth_data)
        
        assert sanitizer.get_pseudonym("张三") == "张大爷"
        assert sanitizer.get_pseudonym("李四") is None
    
    def test_sensitive_names_integration(self):
        """测试敏感词词典与授权表整合"""
        auth_data = AuthorizationData(file_path=Path("/test"))
        auth_data.records["张三"] = AuthorizationRecord(
            name="张三",
            pseudonym="张大爷",
            is_authorized=True
        )
        
        sensitive_names = SensitiveNames()
        sensitive_names.names["李四"] = SensitiveName(
            original="李四",
            categories=["同事"],
            suggested_pseudonym="李师傅"
        )
        
        sanitizer = NameSanitizer(auth_data=auth_data, sensitive_names=sensitive_names)
        
        assert sanitizer.get_pseudonym("张三") == "张大爷"
        assert sanitizer.get_pseudonym("李四") == "李师傅"


class TestSegmentSanitizer:
    """片段脱敏器测试"""
    
    def test_check_authorization_authorized(self):
        """测试检查已授权片段"""
        auth_data = AuthorizationData(file_path=Path("/test"))
        auth_data.records["张三"] = AuthorizationRecord(
            name="张三",
            pseudonym="张大爷",
            is_authorized=True,
            segments=[
                (timedelta(minutes=0), timedelta(minutes=10)),
            ]
        )
        
        sanitizer = SegmentSanitizer(auth_data)
        
        is_authorized, unauthorized = sanitizer.check_authorization(
            ["张三"],
            timedelta(minutes=2),
            timedelta(minutes=3)
        )
        
        assert is_authorized is True
        assert len(unauthorized) == 0
    
    def test_check_authorization_unauthorized(self):
        """测试检查未授权片段"""
        auth_data = AuthorizationData(file_path=Path("/test"))
        auth_data.records["张三"] = AuthorizationRecord(
            name="张三",
            pseudonym="张大爷",
            is_authorized=True,
            segments=[
                (timedelta(minutes=0), timedelta(minutes=5)),
            ]
        )
        
        sanitizer = SegmentSanitizer(auth_data)
        
        is_authorized, unauthorized = sanitizer.check_authorization(
            ["张三"],
            timedelta(minutes=6),
            timedelta(minutes=7)
        )
        
        assert is_authorized is False
        assert "张三" in unauthorized


class TestSanitizationRules:
    """脱敏规则引擎测试"""
    
    def test_phone_sanitizer(self):
        """测试手机号脱敏"""
        text = "我的手机号是13912345678，欢迎联系。"
        result = phone_sanitizer(text)
        
        assert "139****5678" in result.sanitized_text
        assert len(result.replacements) == 1
        assert result.replacements[0].original == "13912345678"
        assert result.replacements[0].replacement == "139****5678"
    
    def test_id_card_sanitizer(self):
        """测试身份证号脱敏"""
        text = "我的身份证号是110101196001011234，请登记。"
        result = id_card_sanitizer(text)
        
        assert "110101********1234" in result.sanitized_text
        assert len(result.replacements) == 1
        assert result.replacements[0].original == "110101196001011234"
        assert result.replacements[0].replacement == "110101********1234"
    
    def test_rules_engine_multiple_rules(self):
        """测试规则引擎应用多个规则"""
        text = "张三的手机号是13912345678，身份证号110101196001011234。"
        
        auth_data = AuthorizationData(file_path=Path("/test"))
        auth_data.records["张三"] = AuthorizationRecord(
            name="张三",
            pseudonym="张大爷",
            is_authorized=True
        )
        name_sanitizer = NameSanitizer(auth_data=auth_data)
        name_result = name_sanitizer.sanitize_text(text)
        
        phone_result = phone_sanitizer(name_result.sanitized_text)
        id_result = id_card_sanitizer(phone_result.sanitized_text)
        
        assert "张大爷" in id_result.sanitized_text
        assert "139****5678" in id_result.sanitized_text
        assert "110101********1234" in id_result.sanitized_text
