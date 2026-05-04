import pytest
import json
from app.services.anonymization_service import AnonymizationService

class TestAnonymizationService:
    """测试脱敏服务"""
    
    def setup_method(self):
        """每个测试方法前初始化服务"""
        self.service = AnonymizationService()
    
    def test_identify_phone_number(self, sample_sensitive_text):
        """测试识别电话号码"""
        sensitive_info = self.service.identify_sensitive_info(sample_sensitive_text)
        
        # 检查是否识别到电话
        assert 'phone' in sensitive_info
        # 检查识别到的电话数量
        phone_matches = sensitive_info['phone']
        assert len(phone_matches) > 0
        # 检查是否包含特定的手机号
        phone_contents = [match[0] for match in phone_matches]
        assert '13812345678' in phone_contents
    
    def test_identify_email(self, sample_sensitive_text):
        """测试识别邮箱"""
        sensitive_info = self.service.identify_sensitive_info(sample_sensitive_text)
        
        # 检查是否识别到邮箱
        assert 'email' in sensitive_info
        # 检查识别到的邮箱
        email_matches = sensitive_info['email']
        assert len(email_matches) > 0
        email_contents = [match[0] for match in email_matches]
        assert 'liming@example.com' in email_contents
    
    def test_identify_id_card(self, sample_sensitive_text):
        """测试识别身份证号"""
        sensitive_info = self.service.identify_sensitive_info(sample_sensitive_text)
        
        # 检查是否识别到身份证号
        assert 'id_card' in sensitive_info
        id_card_matches = sensitive_info['id_card']
        assert len(id_card_matches) > 0
        id_card_contents = [match[0] for match in id_card_matches]
        assert '110101199001011234' in id_card_contents
    
    def test_identify_company(self, sample_sensitive_text):
        """测试识别公司名称"""
        sensitive_info = self.service.identify_sensitive_info(sample_sensitive_text)
        
        # 检查是否识别到公司
        assert 'company' in sensitive_info
        company_matches = sensitive_info['company']
        assert len(company_matches) > 0
    
    def test_identify_address(self, sample_sensitive_text):
        """测试识别地址"""
        sensitive_info = self.service.identify_sensitive_info(sample_sensitive_text)
        
        # 检查是否识别到地址
        assert 'address' in sensitive_info
        address_matches = sensitive_info['address']
        assert len(address_matches) > 0
    
    def test_anonymize_text_replaces_phone(self):
        """测试脱敏文本中的电话号码"""
        text = "我的手机号是13812345678，请联系我。"
        anonymized, replacement_map = self.service.anonymize_text(text)
        
        # 检查电话是否被替换
        assert '13812345678' not in anonymized
        assert '[电话]' in anonymized
        # 检查替换映射
        assert 'phone' in replacement_map
        assert '13812345678' in replacement_map['phone']
    
    def test_anonymize_text_replaces_email(self):
        """测试脱敏文本中的邮箱"""
        text = "我的邮箱是test@example.com，请发送邮件。"
        anonymized, replacement_map = self.service.anonymize_text(text)
        
        # 检查邮箱是否被替换
        assert 'test@example.com' not in anonymized
        assert '[邮箱]' in anonymized
        # 检查替换映射
        assert 'email' in replacement_map
        assert 'test@example.com' in replacement_map['email']
    
    def test_anonymize_text_replaces_id_card(self):
        """测试脱敏文本中的身份证号"""
        text = "我的身份证号是110101199001011234。"
        anonymized, replacement_map = self.service.anonymize_text(text)
        
        # 检查身份证号是否被替换
        assert '110101199001011234' not in anonymized
        assert '[身份证号]' in anonymized
        # 检查替换映射
        assert 'id_card' in replacement_map
    
    def test_anonymize_json(self, sample_interview_data):
        """测试脱敏JSON数据"""
        json_text = json.dumps(sample_interview_data, ensure_ascii=False)
        anonymized, replacement_map = self.service.anonymize_json(json_text)
        
        # 检查是否成功解析JSON
        anonymized_data = json.loads(anonymized)
        
        # 检查敏感信息是否被替换
        respondent_info = anonymized_data.get('respondent_info', {})
        # 电话应该被替换
        assert respondent_info.get('phone') != '13812345678'
        # 邮箱应该被替换
        assert respondent_info.get('email') != 'test@example.com'
        
        # 检查替换映射
        assert 'phone' in replacement_map or 'email' in replacement_map
    
    def test_anonymize_text_with_multiple_sensitive_info(self):
        """测试同时处理多种敏感信息"""
        text = """
        我叫李明，手机号是13812345678，邮箱是liming@example.com。
        我在北京市海淀区科技有限公司工作，身份证号是110101199001011234。
        """
        
        anonymized, replacement_map = self.service.anonymize_text(text)
        
        # 检查所有敏感信息是否被替换
        assert '李明' not in anonymized or '[姓名]' in anonymized
        assert '13812345678' not in anonymized
        assert 'liming@example.com' not in anonymized
        assert '110101199001011234' not in anonymized
        
        # 检查替换映射包含多种类型
        assert 'phone' in replacement_map
        assert 'email' in replacement_map
        assert 'id_card' in replacement_map
    
    def test_anonymize_text_preserves_non_sensitive_info(self):
        """测试保留非敏感信息"""
        text = "今天天气很好，我们讨论了产品的用户体验。"
        anonymized, replacement_map = self.service.anonymize_text(text)
        
        # 检查非敏感信息是否保留
        assert '今天天气很好' in anonymized
        assert '用户体验' in anonymized
        # 检查没有替换任何内容
        assert len(replacement_map) == 0
    
    def test_is_likely_name_with_indicator(self):
        """测试带有姓名指示词的情况"""
        text = "我叫李明，很高兴认识你。"
        start = text.find('李明')
        end = start + 2
        
        result = self.service._is_likely_name('李明', text, start, end)
        
        # 因为有"我叫"这个指示词，应该返回True
        assert result is True
    
    def test_is_likely_name_without_indicator(self):
        """测试没有姓名指示词的情况"""
        text = "这是一个测试句子。"
        # 这里"测试"不是姓名，且没有指示词
        start = text.find('测试')
        end = start + 2
        
        result = self.service._is_likely_name('测试', text, start, end)
        
        # 没有指示词，应该返回False
        assert result is False
