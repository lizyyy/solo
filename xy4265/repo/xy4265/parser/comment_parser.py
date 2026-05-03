#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
审批意见CSV解析器
"""

import csv
from datetime import datetime
from typing import List, Dict, Any
from models.data_models import ApprovalComment, RiskLevel


class CommentParser:
    """审批意见解析器"""
    
    @staticmethod
    def parse_file(file_path: str) -> List[ApprovalComment]:
        """从CSV文件解析审批意见"""
        comments = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                comment = CommentParser._parse_row(row)
                if comment:
                    comments.append(comment)
        
        return comments
    
    @staticmethod
    def _parse_row(row: Dict[str, Any]) -> ApprovalComment:
        """解析单行数据"""
        risk_level_str = row.get('risk_level', 'medium').lower()
        risk_level = CommentParser._parse_risk_level(risk_level_str)
        
        created_at_str = row.get('created_at', '')
        try:
            created_at = datetime.fromisoformat(created_at_str) if created_at_str else datetime.now()
        except (ValueError, TypeError):
            created_at = datetime.now()
        
        return ApprovalComment(
            comment_id=row.get('comment_id', row.get('id', '')),
            clause_id=row.get('clause_id', row.get('clause', '')),
            reviewer=row.get('reviewer', row.get('author', '匿名')),
            comment_text=row.get('comment_text', row.get('text', row.get('content', ''))),
            risk_level=risk_level,
            action_required=row.get('action_required', row.get('action', '')),
            created_at=created_at,
            version=row.get('version', 'v1')
        )
    
    @staticmethod
    def _parse_risk_level(level: str) -> RiskLevel:
        """解析风险级别"""
        level_map = {
            'critical': RiskLevel.CRITICAL,
            'severe': RiskLevel.CRITICAL,
            'high': RiskLevel.HIGH,
            'medium': RiskLevel.MEDIUM,
            'normal': RiskLevel.MEDIUM,
            'low': RiskLevel.LOW,
            'minor': RiskLevel.LOW
        }
        return level_map.get(level.lower(), RiskLevel.MEDIUM)
