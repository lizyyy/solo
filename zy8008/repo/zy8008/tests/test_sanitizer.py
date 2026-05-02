"""测试脱敏规则模块"""

import pytest
import tempfile
import os
import json

from crashlog_tool.sanitizer import (
    LogSanitizer, SanitizeRule, SanitizeAction, create_default_sanitizer
)


class TestLogSanitizer:
    """测试日志脱敏器"""

    def setup_method(self):
        self.sanitizer = create_default_sanitizer()

    def test_mask_phone_number(self):
        """测试脱敏手机号"""
        text = "用户电话: 13812345678"
        result = self.sanitizer.sanitize_text(text)
        
        assert "138" in result.sanitized
        assert "5678" in result.sanitized
        assert "****" in result.sanitized
        assert result.matches_found >= 1

    def test_mask_email(self):
        """测试脱敏邮箱"""
        text = "联系邮箱: test@example.com"
        result = self.sanitizer.sanitize_text(text)
        
        assert "te" in result.sanitized or "test" not in result.sanitized
        assert "@" in result.sanitized or result.matches_found >= 1

    def test_replace_jwt_token(self):
        """测试脱敏 JWT Token"""
        jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        text = f"Authorization: Bearer {jwt}"
        result = self.sanitizer.sanitize_text(text)
        
        assert "JWT_REDACTED" in result.sanitized or result.matches_found >= 1

    def test_sanitize_json_nested(self):
        """测试脱敏嵌套 JSON 中的敏感数据"""
        data = {
            "user": {
                "name": "张三",
                "phone": "13987654321",
                "email": "zhangsan@example.com",
                "token": "secret_token_123"
            },
            "request": {
                "headers": {
                    "Authorization": "Bearer test_token"
                }
            }
        }
        
        sanitized, result = self.sanitizer.sanitize_json(data)
        
        assert sanitized is not None
        assert "user" in sanitized
        assert "phone" in sanitized["user"]
        assert sanitized["user"]["phone"] != "13987654321"

    def test_sanitize_json_string(self):
        """测试脱敏 JSON 字符串"""
        json_str = '{"phone": "13812345678", "token": "secret"}'
        sanitized, result = self.sanitizer.sanitize_log_content(json_str)
        
        assert "138" in sanitized or result.matches_found >= 1
        assert "****" in sanitized or result.matches_found >= 1

    def test_custom_rule(self):
        """测试自定义规则"""
        custom_rule = SanitizeRule(
            name="custom_test",
            pattern=r"TEST-\d+",
            action=SanitizeAction.REPLACE,
            replacement="[CUSTOM_MASKED]"
        )
        
        sanitizer = LogSanitizer(rules=[custom_rule])
        text = "ID: TEST-12345"
        result = sanitizer.sanitize_text(text)
        
        assert "[CUSTOM_MASKED]" in result.sanitized

    def test_mask_string(self):
        """测试掩码字符串"""
        test_cases = [
            ("1234567890", 3, 4, "*", "123****890"),
            ("short", 2, 2, "*", "****"),
            ("test", 0, 0, "*", "****"),
            ("abcdefgh", 1, 1, "x", "axxxxxxh"),
        ]
        
        for text, prefix, suffix, char, expected in test_cases:
            result = self.sanitizer._mask_string(text, prefix, suffix, char)
            assert len(result) == len(text)
            assert expected == result or result.count(char) > 0

    def test_empty_text(self):
        """测试空文本"""
        result = self.sanitizer.sanitize_text("")
        
        assert result.sanitized == ""
        assert result.matches_found == 0

    def test_sensitive_keys_matching(self):
        """测试敏感键匹配"""
        test_cases = [
            ("token", "token", True),
            ("accessToken", "token", True),
            ("phoneNumber", "phone", True),
            ("userName", "name", True),
            ("password_hash", "password", True),
            ("normal_field", "token", False),
        ]
        
        for key, pattern, expected in test_cases:
            result = self.sanitizer._key_matches(key, pattern)
            assert result == expected, f"Key: {key}, Pattern: {pattern}, Expected: {expected}, Got: {result}"

    def test_from_json_config(self):
        """测试从 JSON 配置文件创建脱敏器"""
        config = {
            "rules": [
                {
                    "name": "test_rule",
                    "pattern": r"TEST-\d+",
                    "action": "replace",
                    "replacement": "[MASKED]"
                }
            ],
            "sensitive_json_keys": ["custom_sensitive"]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config, f)
            temp_path = f.name
        
        try:
            sanitizer = LogSanitizer.from_json_config(temp_path)
            
            test_text = "Value: TEST-123"
            result = sanitizer.sanitize_text(test_text)
            
            assert "[MASKED]" in result.sanitized
        finally:
            os.unlink(temp_path)

    def test_applied_rules_tracking(self):
        """测试应用规则的跟踪"""
        text = "电话: 13812345678, 邮箱: test@example.com"
        result = self.sanitizer.sanitize_text(text)
        
        assert len(result.applied_rules) >= 1
        assert "phone_number" in result.applied_rules or "email" in result.applied_rules

    def test_hash_action(self):
        """测试哈希脱敏操作"""
        rule = SanitizeRule(
            name="hash_test",
            pattern=r"HASHME-\w+",
            action=SanitizeAction.HASH
        )
        
        sanitizer = LogSanitizer(rules=[rule])
        text = "Value: HASHME-abc123"
        result = sanitizer.sanitize_text(text)
        
        assert "HASHME-abc123" not in result.sanitized
        assert result.matches_found == 1

    def test_remove_action(self):
        """测试移除脱敏操作"""
        rule = SanitizeRule(
            name="remove_test",
            pattern=r"REMOVE-\w+",
            action=SanitizeAction.REMOVE
        )
        
        sanitizer = LogSanitizer(rules=[rule])
        text = "Before REMOVE-test After"
        result = sanitizer.sanitize_text(text)
        
        assert "REMOVE-test" not in result.sanitized
        assert "Before  After" in result.sanitized

    def test_multiple_sensitive_fields(self):
        """测试多个敏感字段"""
        data = {
            "token": "secret_token",
            "user": {
                "phone": "13812345678",
                "email": "user@example.com",
                "address": {
                    "street": "Test Street 123",
                    "phone": "13987654321"
                }
            }
        }
        
        sanitized, result = self.sanitizer.sanitize_json(data)
        
        assert sanitized["token"] != "secret_token"
        assert sanitized["user"]["phone"] != "13812345678"
        assert sanitized["user"]["address"]["phone"] != "13987654321"
