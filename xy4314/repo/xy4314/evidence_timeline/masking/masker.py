"""脱敏处理模块"""
import re
from typing import Any, Dict, List, Callable, Optional
from dataclasses import dataclass, field


@dataclass
class MaskingRule:
    """脱敏规则"""
    name: str
    pattern: re.Pattern
    mask_function: Callable[[str], str]
    description: str = ""


class Masker:
    """
    脱敏处理器
    
    支持多种敏感信息的脱敏处理：
    - 身份证号码
    - 手机号码
    - 银行卡号
    - 电子邮箱
    - 地址信息
    - 姓名信息
    """
    
    def __init__(self):
        self.rules: List[MaskingRule] = []
        self._init_default_rules()
    
    def _init_default_rules(self):
        """初始化默认脱敏规则"""
        
        self.rules.extend([
            MaskingRule(
                name="身份证号码",
                pattern=re.compile(
                    r'\b([1-9]\d{5})(19|20)(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(\d{3})([\dXx])\b'
                ),
                mask_function=self._mask_id_card,
                description="身份证号码脱敏：保留前6位和后4位，中间用*替换"
            ),
            
            MaskingRule(
                name="手机号码",
                pattern=re.compile(r'\b(1[3-9]\d)(\d{4})(\d{4})\b'),
                mask_function=self._mask_phone,
                description="手机号码脱敏：保留前3位和后4位，中间用*替换"
            ),
            
            MaskingRule(
                name="银行卡号",
                pattern=re.compile(r'\b(\d{4})(\d{8,11})(\d{4})\b'),
                mask_function=self._mask_bank_card,
                description="银行卡号脱敏：保留前4位和后4位，中间用*替换"
            ),
            
            MaskingRule(
                name="电子邮箱",
                pattern=re.compile(
                    r'\b([a-zA-Z0-9._%+-]{1,2})[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b'
                ),
                mask_function=self._mask_email,
                description="邮箱脱敏：保留用户名前2位和域名"
            ),
            
            MaskingRule(
                name="地址信息",
                pattern=re.compile(
                    r'([\u4e00-\u9fa5]{2,}(?:省|市|区|县))([\u4e00-\u9fa5\d]{2,})(?:镇|乡|村|街道|路|号|楼|单元|室)([\u4e00-\u9fa5\d]*)'
                ),
                mask_function=self._mask_address,
                description="地址脱敏：保留省市县区，其他用*替换"
            ),
            
            MaskingRule(
                name="姓名信息",
                pattern=re.compile(
                    r'([\u4e00-\u9fa5])([\u4e00-\u9fa5]{1,2})(?:先生|女士|小姐|同志|经理|总监|老板|员工|客户|当事人|被告|原告|证人)'
                ),
                mask_function=self._mask_name,
                description="姓名脱敏：保留姓氏，名字用*替换"
            )
        ])
    
    def _mask_id_card(self, match: re.Match) -> str:
        """身份证号码脱敏"""
        groups = match.groups()
        return f"{groups[0]}{groups[1]}****{groups[5]}{groups[6]}"
    
    def _mask_phone(self, match: re.Match) -> str:
        """手机号码脱敏"""
        groups = match.groups()
        return f"{groups[0]}****{groups[2]}"
    
    def _mask_bank_card(self, match: re.Match) -> str:
        """银行卡号脱敏"""
        groups = match.groups()
        return f"{groups[0]}{'*' * len(groups[1])}{groups[2]}"
    
    def _mask_email(self, match: re.Match) -> str:
        """电子邮箱脱敏"""
        groups = match.groups()
        return f"{groups[0]}***{groups[1]}"
    
    def _mask_address(self, match: re.Match) -> str:
        """地址信息脱敏"""
        groups = match.groups()
        return f"{groups[0]}***{groups[2]}"
    
    def _mask_name(self, match: re.Match) -> str:
        """姓名信息脱敏"""
        groups = match.groups()
        return f"{groups[0]}{'*' * len(groups[1])}"
    
    def mask_text(self, text: str) -> str:
        """
        对文本进行脱敏处理
        
        Args:
            text: 原始文本
            
        Returns:
            脱敏后的文本
        """
        result = text
        
        for rule in self.rules:
            def replace_func(match, r=rule):
                return r.mask_function(match)
            
            result = rule.pattern.sub(replace_func, result)
        
        return result
    
    def mask_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        对数据列表进行脱敏处理
        
        Args:
            data: 解析后的数据列表
            
        Returns:
            脱敏后的数据列表
        """
        masked_data = []
        
        for item in data:
            masked_item = item.copy()
            
            if 'content' in masked_item and isinstance(masked_item['content'], str):
                masked_item['content'] = self.mask_text(masked_item['content'])
            
            if 'metadata' in masked_item and isinstance(masked_item['metadata'], dict):
                masked_item['metadata'] = self._mask_dict(masked_item['metadata'])
            
            masked_data.append(masked_item)
        
        return masked_data
    
    def _mask_dict(self, d: Dict[str, Any]) -> Dict[str, Any]:
        """
        递归脱敏字典中的字符串值
        
        Args:
            d: 原始字典
            
        Returns:
            脱敏后的字典
        """
        result = {}
        
        for key, value in d.items():
            if isinstance(value, str):
                result[key] = self.mask_text(value)
            elif isinstance(value, dict):
                result[key] = self._mask_dict(value)
            elif isinstance(value, list):
                result[key] = [
                    self._mask_dict(item) if isinstance(item, dict) 
                    else self.mask_text(item) if isinstance(item, str)
                    else item
                    for item in value
                ]
            else:
                result[key] = value
        
        return result
    
    def add_custom_rule(
        self, 
        name: str, 
        pattern: str, 
        mask_function: Callable[[re.Match], str],
        description: str = ""
    ):
        """
        添加自定义脱敏规则
        
        Args:
            name: 规则名称
            pattern: 正则表达式模式字符串
            mask_function: 脱敏函数，接收re.Match对象，返回脱敏后的字符串
            description: 规则描述
        """
        compiled_pattern = re.compile(pattern)
        self.rules.append(MaskingRule(
            name=name,
            pattern=compiled_pattern,
            mask_function=mask_function,
            description=description
        ))
    
    def get_available_rules(self) -> List[Dict[str, str]]:
        """
        获取所有可用的脱敏规则
        
        Returns:
            规则列表，包含名称和描述
        """
        return [
            {"name": rule.name, "description": rule.description}
            for rule in self.rules
        ]
