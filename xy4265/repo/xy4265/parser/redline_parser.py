#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
客户红线YAML解析器
"""

import yaml
from typing import List, Dict, Any
from models.data_models import RedlineRule, RiskLevel


class RedlineParser:
    """红线规则解析器"""
    
    @staticmethod
    def parse_file(file_path: str) -> List[RedlineRule]:
        """从YAML文件解析红线规则"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        rules = []
        if isinstance(data, list):
            for item in data:
                rule = RedlineParser._parse_rule(item)
                if rule:
                    rules.append(rule)
        elif isinstance(data, dict):
            rules_list = data.get('rules', data.get('redlines', []))
            for item in rules_list:
                rule = RedlineParser._parse_rule(item)
                if rule:
                    rules.append(rule)
        
        return rules
    
    @staticmethod
    def _parse_rule(item: Dict[str, Any]) -> RedlineRule:
        """解析单个规则"""
        risk_level_str = item.get('risk_level', 'medium').lower()
        risk_level = RedlineParser._parse_risk_level(risk_level_str)
        
        keywords = item.get('keywords', item.get('keyword', []))
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(',')]
        
        return RedlineRule(
            rule_id=item.get('rule_id', item.get('id', '')),
            category=item.get('category', item.get('type', '通用')),
            description=item.get('description', item.get('desc', '')),
            keywords=keywords,
            risk_level=risk_level,
            is_mandatory=item.get('is_mandatory', item.get('mandatory', False)),
            remediation=item.get('remediation', item.get('fix', '')),
            priority=item.get('priority', 0)
        )
    
    @staticmethod
    def _parse_risk_level(level: str) -> RiskLevel:
        """解析风险级别"""
        level_map = {
            'critical': RiskLevel.CRITICAL,
            'severe': RiskLevel.CRITICAL,
            'blocker': RiskLevel.CRITICAL,
            'high': RiskLevel.HIGH,
            'important': RiskLevel.HIGH,
            'medium': RiskLevel.MEDIUM,
            'normal': RiskLevel.MEDIUM,
            'low': RiskLevel.LOW,
            'minor': RiskLevel.LOW,
            'info': RiskLevel.LOW
        }
        return level_map.get(level.lower(), RiskLevel.MEDIUM)
