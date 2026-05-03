"""未脱敏字段检查规则"""
import re
from typing import Any, Dict, List
from .base_rule import BaseRule, Issue, Severity


class UnmaskedRule(BaseRule):
    """检查是否存在未脱敏的敏感信息"""
    
    def __init__(self):
        super().__init__(
            name="未脱敏字段检查",
            description="检查是否存在未脱敏的敏感信息",
            severity=Severity.HIGH
        )
        
        self.patterns = {
            'id_card': re.compile(
                r'\b[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b'
            ),
            'phone': re.compile(
                r'\b1[3-9]\d{9}\b'
            ),
            'bank_card': re.compile(
                r'\b\d{16,19}\b'
            ),
            'email': re.compile(
                r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
            ),
            'address': re.compile(
                r'[\u4e00-\u9fa5]{2,}(?:省|市|区|县|镇|乡|村|街道|路|号|楼|单元|室)[\u4e00-\u9fa5\d]*'
            ),
            'name': re.compile(
                r'[\u4e00-\u9fa5]{2,4}(?:'
                r'先生|女士|小姐|同志|经理|总监|老板|员工|客户|当事人|被告|原告|证人'
                r')'
            )
        }
        
        self.masked_patterns = [
            re.compile(r'\*{3,}'),
            re.compile(r'[Xx]{3,}'),
            re.compile(r'□{3,}')
        ]
    
    def check(self, data: List[Dict[str, Any]]) -> List[Issue]:
        """
        执行未脱敏字段检查
        
        检查逻辑：
        1. 扫描所有文本内容，查找敏感信息模式
        2. 排除已经脱敏的内容（包含***等）
        3. 报告找到的未脱敏敏感信息
        """
        issues = []
        
        for item in data:
            content = item.get('content', '')
            metadata = item.get('metadata', {})
            
            issues.extend(self._check_content(content, item))
            
            for key, value in metadata.items():
                if isinstance(value, str):
                    issues.extend(self._check_content(value, item, field_name=key))
        
        return issues
    
    def _check_content(
        self, 
        content: str, 
        item: Dict[str, Any], 
        field_name: str = "content"
    ) -> List[Issue]:
        """
        检查单个内容中的未脱敏敏感信息
        
        Args:
            content: 要检查的内容
            item: 数据项
            field_name: 字段名称
            
        Returns:
            问题列表
        """
        issues = []
        
        if self._is_already_masked(content):
            return issues
        
        for pattern_name, pattern in self.patterns.items():
            matches = pattern.findall(content)
            for match in matches:
                if not self._is_already_masked(match):
                    issues.append(self._create_issue(
                        description=f"发现未脱敏的{self._get_pattern_description(pattern_name)}",
                        location=f"{item.get('type', 'unknown')}: {item.get('id', 'unknown')} - {field_name}",
                        evidence_id=item.get('id') if item.get('type') == 'evidence' else None,
                        details={
                            "pattern": pattern_name,
                            "match": match[:3] + "***" + match[-3:] if len(match) > 6 else "***",
                            "context": self._get_context(content, match),
                            "item_type": item.get('type'),
                            "item_id": item.get('id')
                        },
                        severity=Severity.HIGH if pattern_name in ['id_card', 'phone', 'bank_card'] else Severity.MEDIUM
                    ))
        
        return issues
    
    def _is_already_masked(self, content: str) -> bool:
        """
        检查内容是否已经脱敏
        
        Args:
            content: 要检查的内容
            
        Returns:
            是否已经脱敏
        """
        for pattern in self.masked_patterns:
            if pattern.search(content):
                return True
        return False
    
    def _get_pattern_description(self, pattern_name: str) -> str:
        """
        获取模式的中文描述
        
        Args:
            pattern_name: 模式名称
            
        Returns:
            中文描述
        """
        descriptions = {
            'id_card': '身份证号码',
            'phone': '手机号码',
            'bank_card': '银行卡号',
            'email': '电子邮箱',
            'address': '地址信息',
            'name': '姓名信息'
        }
        return descriptions.get(pattern_name, pattern_name)
    
    def _get_context(self, content: str, match: str, context_length: int = 30) -> str:
        """
        获取匹配内容的上下文
        
        Args:
            content: 完整内容
            match: 匹配的字符串
            context_length: 上下文长度
            
        Returns:
            上下文字符串
        """
        try:
            index = content.index(match)
            start = max(0, index - context_length)
            end = min(len(content), index + len(match) + context_length)
            return content[start:end].replace(match, "***")
        except ValueError:
            return "上下文不可用"
