#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据校验器
"""

from typing import List, Dict, Any, Tuple
from models.data_models import Clause, RedlineRule, ApprovalComment, RiskItem


class ValidationError:
    """校验错误"""
    
    def __init__(self, error_type: str, message: str, severity: str = "warning"):
        self.error_type = error_type
        self.message = message
        self.severity = severity
    
    def __str__(self):
        return f"[{self.severity.upper()}] {self.error_type}: {self.message}"


class DataValidator:
    """数据校验器"""
    
    @staticmethod
    def validate_clauses(clauses: List[Clause]) -> List[ValidationError]:
        """校验条款数据"""
        errors = []
        
        if not clauses:
            errors.append(ValidationError(
                "empty_clauses", "条款列表为空", severity="warning"
            ))
            return errors
        
        all_clauses = Clause.flatten.__self__.func(clauses)
        clause_ids = set()
        
        for clause in all_clauses:
            if not clause.clause_id:
                errors.append(ValidationError(
                    "missing_id", f"条款 '{clause.title}' 缺少ID", severity="error"
                ))
            elif clause.clause_id in clause_ids:
                errors.append(ValidationError(
                    "duplicate_id", f"条款ID重复: {clause.clause_id}", severity="error"
                ))
            clause_ids.add(clause.clause_id)
            
            if not clause.title:
                errors.append(ValidationError(
                    "missing_title", f"条款ID {clause.clause_id} 缺少标题", severity="warning"
                ))
            
            if not clause.content:
                errors.append(ValidationError(
                    "missing_content", f"条款 '{clause.title}' 缺少内容", severity="warning"
                ))
        
        return errors
    
    @staticmethod
    def validate_rules(rules: List[RedlineRule]) -> List[ValidationError]:
        """校验红线规则"""
        errors = []
        
        if not rules:
            errors.append(ValidationError(
                "empty_rules", "红线规则列表为空", severity="warning"
            ))
            return errors
        
        rule_ids = set()
        for rule in rules:
            if not rule.rule_id:
                errors.append(ValidationError(
                    "missing_id", f"规则 '{rule.description}' 缺少ID", severity="error"
                ))
            elif rule.rule_id in rule_ids:
                errors.append(ValidationError(
                    "duplicate_id", f"规则ID重复: {rule.rule_id}", severity="error"
                ))
            rule_ids.add(rule.rule_id)
            
            if not rule.keywords:
                errors.append(ValidationError(
                    "missing_keywords", f"规则 {rule.rule_id} 缺少关键词", severity="warning"
                ))
            
            if rule.is_mandatory and rule.risk_level.value != "critical":
                errors.append(ValidationError(
                    "inconsistent_risk", f"必改规则 {rule.rule_id} 风险级别不是critical", severity="warning"
                ))
        
        return errors
    
    @staticmethod
    def validate_comments(comments: List[ApprovalComment]) -> List[ValidationError]:
        """校验审批意见"""
        errors = []
        
        if not comments:
            errors.append(ValidationError(
                "empty_comments", "审批意见列表为空", severity="info"
            ))
            return errors
        
        comment_ids = set()
        for comment in comments:
            if not comment.comment_id:
                errors.append(ValidationError(
                    "missing_id", f"意见 '{comment.comment_text[:30]}...' 缺少ID", severity="error"
                ))
            elif comment.comment_id in comment_ids:
                errors.append(ValidationError(
                    "duplicate_id", f"意见ID重复: {comment.comment_id}", severity="error"
                ))
            comment_ids.add(comment.comment_id)
            
            if not comment.clause_id:
                errors.append(ValidationError(
                    "missing_clause", f"意见 {comment.comment_id} 缺少关联条款", severity="warning"
                ))
            
            if not comment.comment_text:
                errors.append(ValidationError(
                    "missing_text", f"意见 {comment.comment_id} 缺少内容", severity="warning"
                ))
        
        return errors
    
    @staticmethod
    def validate_integrity(
        clauses: List[Clause],
        rules: List[RedlineRule],
        comments: List[ApprovalComment]
    ) -> List[ValidationError]:
        """校验数据完整性"""
        errors = []
        
        all_clauses = DataValidator._flatten_clauses(clauses)
        clause_ids = {c.clause_id for c in all_clauses if c.clause_id}
        
        for comment in comments:
            if comment.clause_id and comment.clause_id not in clause_ids:
                errors.append(ValidationError(
                    "broken_reference",
                    f"意见 {comment.comment_id} 引用的条款 {comment.clause_id} 不存在",
                    severity="error"
                ))
        
        return errors
    
    @staticmethod
    def _flatten_clauses(clauses: List[Clause]) -> List[Clause]:
        """扁平化条款列表"""
        result = []
        for clause in clauses:
            result.append(clause)
            result.extend(DataValidator._flatten_clauses(clause.children))
        return result
    
    @staticmethod
    def has_errors(errors: List[ValidationError]) -> bool:
        """检查是否有错误级别的问题"""
        return any(e.severity == "error" for e in errors)
    
    @staticmethod
    def get_error_summary(errors: List[ValidationError]) -> Dict[str, int]:
        """获取错误统计"""
        summary = {"error": 0, "warning": 0, "info": 0}
        for e in errors:
            summary[e.severity] = summary.get(e.severity, 0) + 1
        return summary
