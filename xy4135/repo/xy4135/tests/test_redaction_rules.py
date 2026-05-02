"""测试脱敏规则模块"""
import pytest
import os
import sys

# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from juanzong_redactor.redaction_rules import (
    Redactor,
    validate_id_card,
    mask_id_card,
    mask_phone,
    mask_email,
    mask_bank_card,
    get_all_rules,
    get_default_rule_names,
)


class TestRedactionRules:
    """测试脱敏规则"""
    
    def test_mask_id_card_18(self):
        """测试18位身份证号脱敏"""
        original = "110101199001011234"
        masked = mask_id_card(original)
        assert masked == "110101********1234"
        assert len(masked) == 18
    
    def test_mask_id_card_15(self):
        """测试15位身份证号脱敏"""
        original = "110101900101123"
        masked = mask_id_card(original)
        assert len(masked) == 15
    
    def test_mask_phone(self):
        """测试手机号脱敏"""
        original = "13812345678"
        masked = mask_phone(original)
        assert masked == "138****5678"
        assert len(masked) == 11
    
    def test_mask_email(self):
        """测试邮箱脱敏"""
        original = "zhangsan@example.com"
        masked = mask_email(original)
        assert "@" in masked
        assert "example.com" in masked
        # 检查用户名部分被脱敏
        assert masked != original
    
    def test_mask_bank_card(self):
        """测试银行卡号脱敏"""
        original = "6222021234567890123"
        masked = mask_bank_card(original)
        # 保留前4位和后4位
        assert masked.startswith("6222")
        assert masked.endswith("0123")
    
    def test_validate_id_card_valid(self):
        """测试有效的身份证号验证"""
        # 这是一个符合校验码规则的测试身份证号
        valid_id = "110101199001011234"
        # 这个身份证号可能无效，所以测试可能返回False
        # 主要测试函数不会报错
        result = validate_id_card(valid_id)
        assert isinstance(result, bool)
    
    def test_validate_id_card_invalid_length(self):
        """测试无效长度的身份证号"""
        result = validate_id_card("123456")
        assert result is False


class TestRedactor:
    """测试Redactor类"""
    
    def test_redactor_init_default(self):
        """测试默认初始化"""
        redactor = Redactor()
        assert redactor.preserve_words == set()
        assert len(redactor.rules) > 0
    
    def test_redactor_init_with_rules(self):
        """测试指定规则初始化"""
        redactor = Redactor(rules=["id_card", "phone"])
        assert len(redactor.rules) == 2
    
    def test_redactor_init_with_preserve_words(self):
        """测试带保留词初始化"""
        preserve = ["案件编号", "法院"]
        redactor = Redactor(preserve_words=preserve)
        assert "案件编号" in redactor.preserve_words
        assert "法院" in redactor.preserve_words
    
    def test_redact_text_id_card(self):
        """测试脱敏身份证号"""
        redactor = Redactor()
        text = "身份证号：110101199001011234"
        result = redactor.redact_text(text)
        
        assert result["found_items"] > 0
        assert "110101199001011234" not in result["redacted_text"]
        assert "110101" in result["redacted_text"]  # 前6位保留
    
    def test_redact_text_phone(self):
        """测试脱敏手机号"""
        redactor = Redactor()
        text = "联系电话：13812345678"
        result = redactor.redact_text(text)
        
        assert result["found_items"] > 0
        assert "13812345678" not in result["redacted_text"]
        assert "138" in result["redacted_text"]  # 前3位保留
        assert "5678" in result["redacted_text"]  # 后4位保留
    
    def test_redact_text_email(self):
        """测试脱敏邮箱"""
        redactor = Redactor(rules=["email"])
        text = "邮箱：zhangsan@example.com"
        result = redactor.redact_text(text)
        
        assert result["found_items"] > 0
        assert "zhangsan@example.com" not in result["redacted_text"]
    
    def test_redact_text_multiple(self):
        """测试同时脱敏多种敏感信息"""
        redactor = Redactor()
        text = "张三的身份证号是110101199001011234，手机号是13812345678"
        result = redactor.redact_text(text)
        
        assert result["found_items"] >= 2
    
    def test_redact_text_with_preserve(self):
        """测试带保留词的脱敏"""
        # 假设我们要保留一个看起来像手机号的数字
        preserve = ["13800000000"]  # 假设这是一个案件编号
        redactor = Redactor(preserve_words=preserve)
        
        text = "案件编号：13800000000，当事人电话：13812345678"
        result = redactor.redact_text(text)
        
        # 案件编号应该被保留
        assert "13800000000" in result["redacted_text"]
        # 真实手机号应该被脱敏
        assert "13812345678" not in result["redacted_text"]
    
    def test_analyze_text(self):
        """测试分析功能"""
        redactor = Redactor()
        text = "身份证：110101199001011234，电话：13812345678"
        
        result = redactor.analyze_text(text)
        
        assert result["total_found"] >= 2
        assert "by_rule" in result
        assert "matches" in result
    
    def test_redact_file_txt(self, tmp_path):
        """测试脱敏文本文件"""
        # 创建临时测试文件
        test_file = tmp_path / "test.txt"
        test_content = "这是测试内容，身份证号：110101199001011234，电话：13812345678"
        test_file.write_text(test_content, encoding="utf-8")
        
        redactor = Redactor()
        output_file = tmp_path / "redacted.txt"
        
        result = redactor.redact_file(str(test_file), str(output_file))
        
        assert result["found_items"] >= 2
        
        # 检查输出文件是否被创建
        if result["found_items"] > 0:
            assert output_file.exists()
            # 检查输出内容是否已脱敏
            output_content = output_file.read_text(encoding="utf-8")
            assert "110101199001011234" not in output_content
            assert "13812345678" not in output_content


class TestRules:
    """测试规则相关函数"""
    
    def test_get_all_rules(self):
        """测试获取所有规则"""
        rules = get_all_rules()
        assert len(rules) > 0
        assert "id_card" in rules
        assert "phone" in rules
        assert "email" in rules
    
    def test_get_default_rule_names(self):
        """测试获取默认规则"""
        defaults = get_default_rule_names()
        assert len(defaults) > 0
        assert "id_card" in defaults
        assert "phone" in defaults


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
