"""
规则引擎模块
"""

import re
import yaml
import json
from pathlib import Path
from typing import Dict, List, Any, Callable, Optional


def load_rules(file_path: Path) -> Dict[str, Any]:
    """
    从文件加载规则（支持YAML或JSON）
    
    Args:
        file_path: 规则文件路径
        
    Returns:
        规则数据字典
    """
    content = file_path.read_text(encoding='utf-8')
    
    if file_path.suffix.lower() in ['.yaml', '.yml']:
        return yaml.safe_load(content)
    elif file_path.suffix.lower() == '.json':
        return json.loads(content)
    else:
        try:
            return yaml.safe_load(content)
        except:
            return json.loads(content)


class RuleEngine:
    """规则引擎，根据定义的规则扫描合同变更中的风险"""
    
    def __init__(self):
        self.rules: Dict[str, Dict] = {}
        self.builtin_checks: Dict[str, Callable] = {
            'amount_increase': self._check_amount_increase,
            'payment_period_change': self._check_payment_period_change,
            'auto_renewal': self._check_auto_renewal,
            'jurisdiction_change': self._check_jurisdiction_change,
            'penalty_change': self._check_penalty_change,
            'keyword_match': self._check_keyword_match,
        }
    
    def load_rules(self, rules_data: Dict[str, Any]):
        """
        加载规则数据
        
        Args:
            rules_data: 规则数据字典
        """
        rules_list = rules_data.get('rules', [])
        for rule in rules_list:
            rule_id = rule.get('id')
            if rule_id:
                self.rules[rule_id] = rule
    
    def scan(self, old_content: str, new_content: str, 
             diff_result: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """
        扫描合同变更中的风险
        
        Args:
            old_content: 旧版合同原文
            new_content: 新版合同原文
            diff_result: 差异计算结果
            
        Returns:
            按规则ID分组的风险列表
        """
        results = {}
        
        from contract_inspector.diff import ContractDiffer
        differ = ContractDiffer()
        changes = differ.extract_all_changes(diff_result)
        
        for rule_id, rule in self.rules.items():
            if not rule.get('enabled', True):
                continue
            
            risks = self._apply_rule(rule, old_content, new_content, changes)
            if risks:
                results[rule_id] = risks
        
        return results
    
    def _apply_rule(self, rule: Dict, old_content: str, new_content: str,
                    changes: List[Dict]) -> List[Dict[str, Any]]:
        """
        应用单个规则
        
        Args:
            rule: 规则定义
            old_content: 旧版合同原文
            new_content: 新版合同原文
            changes: 变更列表
            
        Returns:
            命中的风险列表
        """
        risks = []
        check_type = rule.get('check_type')
        
        if check_type in self.builtin_checks:
            check_func = self.builtin_checks[check_type]
            rule_risks = check_func(rule, old_content, new_content, changes)
            risks.extend(rule_risks)
        elif check_type == 'custom':
            risks.extend(self._check_custom(rule, old_content, new_content, changes))
        
        return risks
    
    def _check_amount_increase(self, rule: Dict, old_content: str, new_content: str,
                                changes: List[Dict]) -> List[Dict[str, Any]]:
        """检查金额上浮"""
        risks = []
        threshold = rule.get('threshold', 0.2)
        
        for change in changes:
            old_text = change.get('old_text', '') or ''
            new_text = change.get('new_text', '') or ''
            
            old_amounts = self._extract_amounts(old_text)
            new_amounts = self._extract_amounts(new_text)
            
            for old_amt in old_amounts:
                for new_amt in new_amounts:
                    if old_amt > 0 and new_amt > old_amt:
                        increase_rate = (new_amt - old_amt) / old_amt
                        if increase_rate > threshold:
                            risks.append({
                                'rule_id': rule.get('id'),
                                'rule_name': rule.get('name'),
                                'level': rule.get('level', 'medium'),
                                'old_text': old_text,
                                'new_text': new_text,
                                'old_amount': old_amt,
                                'new_amount': new_amt,
                                'increase_rate': increase_rate,
                                'suggestion': rule.get('suggestion', '建议复核金额上浮幅度')
                            })
        
        return risks
    
    def _check_payment_period_change(self, rule: Dict, old_content: str, new_content: str,
                                      changes: List[Dict]) -> List[Dict[str, Any]]:
        """检查付款周期变化"""
        risks = []
        
        for change in changes:
            old_text = change.get('old_text', '') or ''
            new_text = change.get('new_text', '') or ''
            
            old_days = self._extract_days(old_text)
            new_days = self._extract_days(new_text)
            
            if old_days and new_days and old_days != new_days:
                from_patterns = rule.get('from_days', [30])
                to_patterns = rule.get('to_days', [60])
                
                if old_days in from_patterns and new_days in to_patterns:
                    risks.append({
                        'rule_id': rule.get('id'),
                        'rule_name': rule.get('name'),
                        'level': rule.get('level', 'high'),
                        'old_text': old_text,
                        'new_text': new_text,
                        'old_days': old_days,
                        'new_days': new_days,
                        'suggestion': rule.get('suggestion', '建议复核付款周期延长的影响')
                    })
        
        return risks
    
    def _check_auto_renewal(self, rule: Dict, old_content: str, new_content: str,
                             changes: List[Dict]) -> List[Dict[str, Any]]:
        """检查自动续约条款"""
        risks = []
        
        keywords = rule.get('keywords', ['自动续约', '自动续期', '自动顺延'])
        
        for change in changes:
            old_text = change.get('old_text', '') or ''
            new_text = change.get('new_text', '') or ''
            
            new_has_keyword = any(kw in new_text for kw in keywords)
            old_has_keyword = any(kw in old_text for kw in keywords)
            
            if new_has_keyword and not old_has_keyword:
                notice_pattern = rule.get('notice_days_pattern', r'提前\s*(\d+)\s*天')
                notice_match = re.search(notice_pattern, new_text)
                
                if not notice_match:
                    risks.append({
                        'rule_id': rule.get('id'),
                        'rule_name': rule.get('name'),
                        'level': rule.get('level', 'high'),
                        'old_text': old_text,
                        'new_text': new_text,
                        'has_notice_days': False,
                        'suggestion': rule.get('suggestion', '自动续约条款未约定提前通知天数，建议补充')
                    })
        
        return risks
    
    def _check_jurisdiction_change(self, rule: Dict, old_content: str, new_content: str,
                                    changes: List[Dict]) -> List[Dict[str, Any]]:
        """检查管辖地变化"""
        risks = []
        
        local_patterns = rule.get('local_patterns', ['本合同签订地', '甲方住所地', '乙方住所地', '本市'])
        
        for change in changes:
            old_text = change.get('old_text', '') or ''
            new_text = change.get('new_text', '') or ''
            
            if '管辖' in new_text or '法院' in new_text:
                old_is_local = any(p in old_text for p in local_patterns)
                new_is_local = any(p in new_text for p in local_patterns)
                
                if old_is_local and not new_is_local:
                    risks.append({
                        'rule_id': rule.get('id'),
                        'rule_name': rule.get('name'),
                        'level': rule.get('level', 'high'),
                        'old_text': old_text,
                        'new_text': new_text,
                        'suggestion': rule.get('suggestion', '管辖地变更为外地法院，建议评估诉讼成本')
                    })
        
        return risks
    
    def _check_penalty_change(self, rule: Dict, old_content: str, new_content: str,
                               changes: List[Dict]) -> List[Dict[str, Any]]:
        """检查违约金变化"""
        risks = []
        
        for change in changes:
            old_text = change.get('old_text', '') or ''
            new_text = change.get('new_text', '') or ''
            
            if '违约金' in new_text or '违约' in new_text:
                old_rates = self._extract_percentages(old_text)
                new_rates = self._extract_percentages(new_text)
                
                for old_rate in old_rates:
                    for new_rate in new_rates:
                        if new_rate > old_rate:
                            risks.append({
                                'rule_id': rule.get('id'),
                                'rule_name': rule.get('name'),
                                'level': rule.get('level', 'medium'),
                                'old_text': old_text,
                                'new_text': new_text,
                                'old_rate': old_rate,
                                'new_rate': new_rate,
                                'suggestion': rule.get('suggestion', '违约金比例提高，建议评估风险承受能力')
                            })
        
        return risks
    
    def _check_keyword_match(self, rule: Dict, old_content: str, new_content: str,
                             changes: List[Dict]) -> List[Dict[str, Any]]:
        """检查关键词匹配"""
        risks = []
        keywords = rule.get('keywords', [])
        must_include = rule.get('must_include', False)
        
        for change in changes:
            old_text = change.get('old_text', '') or ''
            new_text = change.get('new_text', '') or ''
            
            for keyword in keywords:
                in_old = keyword in old_text
                in_new = keyword in new_text
                
                if must_include:
                    if in_old and not in_new:
                        risks.append({
                            'rule_id': rule.get('id'),
                            'rule_name': rule.get('name'),
                            'level': rule.get('level', 'medium'),
                            'old_text': old_text,
                            'new_text': new_text,
                            'keyword': keyword,
                            'suggestion': rule.get('suggestion', f'关键词「{keyword}」被删除，建议复核')
                        })
                else:
                    if in_new and not in_old:
                        risks.append({
                            'rule_id': rule.get('id'),
                            'rule_name': rule.get('name'),
                            'level': rule.get('level', 'medium'),
                            'old_text': old_text,
                            'new_text': new_text,
                            'keyword': keyword,
                            'suggestion': rule.get('suggestion', f'新增关键词「{keyword}」，建议复核')
                        })
        
        return risks
    
    def _check_custom(self, rule: Dict, old_content: str, new_content: str,
                      changes: List[Dict]) -> List[Dict[str, Any]]:
        """检查自定义规则（基于正则表达式）"""
        risks = []
        patterns = rule.get('patterns', [])
        
        for pattern in patterns:
            try:
                regex = re.compile(pattern, re.MULTILINE | re.IGNORECASE)
                
                for change in changes:
                    old_text = change.get('old_text', '') or ''
                    new_text = change.get('new_text', '') or ''
                    
                    old_matches = list(regex.finditer(old_text))
                    new_matches = list(regex.finditer(new_text))
                    
                    if new_matches and not old_matches:
                        for match in new_matches:
                            risks.append({
                                'rule_id': rule.get('id'),
                                'rule_name': rule.get('name'),
                                'level': rule.get('level', 'medium'),
                                'old_text': old_text,
                                'new_text': new_text,
                                'matched_text': match.group(),
                                'pattern': pattern,
                                'suggestion': rule.get('suggestion', '匹配到新增规则模式')
                            })
            except re.error:
                continue
        
        return risks
    
    def _extract_amounts(self, text: str) -> List[float]:
        """从文本中提取金额"""
        amounts = []
        patterns = [
            r'(\d+(?:\.\d+)?)\s*(?:万|千|百)?\s*(?:元|人民币|RMB)',
            r'(?:人民币|RMB)\s*(\d+(?:\.\d+)?)',
            r'金额\s*[：:]\s*(\d+(?:\.\d+)?)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                try:
                    amount = float(match)
                    if '万' in text and amount < 10000:
                        amount *= 10000
                    amounts.append(amount)
                except ValueError:
                    continue
        
        return amounts
    
    def _extract_days(self, text: str) -> Optional[int]:
        """从文本中提取天数"""
        patterns = [
            r'(\d+)\s*天',
            r'(\d+)\s*工作日',
            r'(\d+)\s*日内',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    return int(match.group(1))
                except ValueError:
                    continue
        
        return None
    
    def _extract_percentages(self, text: str) -> List[float]:
        """从文本中提取百分比"""
        percentages = []
        patterns = [
            r'(\d+(?:\.\d+)?)\s*%',
            r'(\d+(?:\.\d+)?)\s*百分之',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                try:
                    pct = float(match)
                    percentages.append(pct)
                except ValueError:
                    continue
        
        return percentages
