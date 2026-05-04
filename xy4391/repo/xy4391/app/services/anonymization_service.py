import re
import json
from typing import Dict, List, Tuple

class AnonymizationService:
    # 默认占位符配置
    DEFAULT_PLACEHOLDERS = {
        'name': '[姓名]',
        'phone': '[电话]',
        'company': '[公司]',
        'address': '[地址]',
        'email': '[邮箱]',
        'id_card': '[身份证号]'
    }
    
    def __init__(self, placeholders=None):
        # 使用提供的占位符或默认占位符
        self.placeholders = placeholders if placeholders else self.DEFAULT_PLACEHOLDERS.copy()
        
        # 预定义的敏感信息正则表达式模式
        self.patterns = {
            'phone': [
                # 中国手机号
                r'1[3-9]\d{9}',
                # 固定电话（带区号）
                r'\d{3,4}-?\d{7,8}',
                # 国际电话格式
                r'\+?\d{1,4}[-.\s]?\d{1,14}'
            ],
            'email': [
                r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
            ],
            'id_card': [
                # 18位身份证号
                r'\d{17}[\dXx]',
                # 15位身份证号
                r'\d{15}'
            ],
            'address': [
                # 中国地址模式（省/市/区/县/街道/路/号）
                r'[\u4e00-\u9fa5]{2,}(?:省|市|区|县|镇|街道|路|街|巷|弄|号|楼|层|室)',
                # 更通用的地址模式
                r'[\u4e00-\u9fa5]{2,}(?:小区|大厦|公寓|广场|中心)'
            ],
            'company': [
                # 公司名称模式
                r'[\u4e00-\u9fa5]{2,}(?:公司|集团|企业|有限责任|股份有限|科技|信息|网络)',
                # 英文公司名称
                r'[A-Z][a-zA-Z\s]*(?:Inc|LLC|Ltd|Corporation|Company|Group)'
            ]
        }
        
        # 中文姓名模式（2-4个汉字）
        self.chinese_name_pattern = r'[\u4e00-\u9fa5]{2,4}'
    
    def identify_sensitive_info(self, text: str) -> Dict[str, List[Tuple[str, int, int]]]:
        """
        识别文本中的敏感信息
        返回: {类型: [(内容, 开始位置, 结束位置), ...]}
        """
        sensitive_info = {}
        
        # 处理预定义的模式
        for info_type, patterns in self.patterns.items():
            matches = []
            for pattern in patterns:
                for match in re.finditer(pattern, text):
                    matches.append((match.group(), match.start(), match.end()))
            if matches:
                sensitive_info[info_type] = matches
        
        # 识别中文姓名（需要结合上下文，这里简化处理）
        # 注意：这是一个简化的姓名识别，实际应用中可能需要更复杂的NLP模型
        name_matches = []
        for match in re.finditer(self.chinese_name_pattern, text):
            name = match.group()
            # 简单的过滤：排除明显不是姓名的情况
            if not self._is_likely_name(name, text, match.start(), match.end()):
                continue
            name_matches.append((name, match.start(), match.end()))
        
        if name_matches:
            sensitive_info['name'] = name_matches
        
        return sensitive_info
    
    def _is_likely_name(self, name: str, context: str, start: int, end: int) -> bool:
        """
        判断是否可能是姓名的辅助函数
        """
        # 检查上下文关键词
        name_indicators = ['我叫', '我是', '名字是', '姓名是', '受访者', '被访者', '先生', '女士', '小姐', '同志', '经理', '总监', '总', '教授', '医生']
        
        # 检查前后的上下文
        before_context = context[max(0, start-10):start]
        after_context = context[end:min(len(context), end+10)]
        
        for indicator in name_indicators:
            if indicator in before_context or indicator in after_context:
                return True
        
        # 检查是否是专有名词（简化处理）
        # 实际应用中可能需要使用分词和命名实体识别
        return False
    
    def anonymize_text(self, text: str, sensitive_info: Dict[str, List[Tuple[str, int, int]]] = None) -> Tuple[str, Dict[str, List[str]]]:
        """
        对文本进行脱敏处理
        返回: (脱敏后的文本, 替换映射)
        """
        if sensitive_info is None:
            sensitive_info = self.identify_sensitive_info(text)
        
        # 按位置排序，从后往前替换，避免位置偏移问题
        all_matches = []
        for info_type, matches in sensitive_info.items():
            for content, start, end in matches:
                all_matches.append((start, end, info_type, content))
        
        # 按开始位置降序排序
        all_matches.sort(key=lambda x: x[0], reverse=True)
        
        # 记录替换映射
        replacement_map = {}
        anonymized_text = text
        
        for start, end, info_type, content in all_matches:
            placeholder = self.placeholders.get(info_type, f'[{info_type}]')
            
            # 记录替换
            if info_type not in replacement_map:
                replacement_map[info_type] = []
            replacement_map[info_type].append(content)
            
            # 替换文本
            anonymized_text = anonymized_text[:start] + placeholder + anonymized_text[end:]
        
        return anonymized_text, replacement_map
    
    def anonymize_json(self, json_content: str) -> Tuple[str, Dict]:
        """
        对JSON格式的访谈内容进行脱敏
        """
        try:
            data = json.loads(json_content)
        except json.JSONDecodeError:
            # 如果不是有效的JSON，尝试直接处理文本
            return self.anonymize_text(json_content)
        
        # 递归处理JSON中的字符串值
        def process_value(value):
            if isinstance(value, str):
                anonymized, _ = self.anonymize_text(value)
                return anonymized
            elif isinstance(value, dict):
                return {k: process_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [process_value(item) for item in value]
            else:
                return value
        
        anonymized_data = process_value(data)
        
        # 收集所有替换的敏感信息
        # 简化实现：重新扫描原始JSON文本
        _, replacement_map = self.anonymize_text(json_content)
        
        return json.dumps(anonymized_data, ensure_ascii=False, indent=2), replacement_map
