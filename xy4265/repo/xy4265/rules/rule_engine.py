#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
规则引擎 - 风险匹配和重复检测
"""

import re
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from models.data_models import (
    Clause, RedlineRule, ApprovalComment, RiskItem,
    RiskLevel, RiskStatus
)


class RiskMatcher:
    """风险匹配器"""
    
    def __init__(self, case_sensitive: bool = False):
        self.case_sensitive = case_sensitive
    
    def match_clause(self, clause: Clause, rules: List[RedlineRule]) -> List[RiskItem]:
        """匹配单个条款的风险"""
        risks = []
        text = clause.title + " " + clause.content
        
        if not self.case_sensitive:
            text = text.lower()
        
        for rule in rules:
            matched_keywords = self._match_keywords(text, rule.keywords)
            
            if matched_keywords:
                risk = RiskItem(
                    risk_id=f"risk_{clause.clause_id}_{rule.rule_id}",
                    clause_id=clause.clause_id,
                    rule_id=rule.rule_id,
                    risk_type="rule_match",
                    risk_level=rule.risk_level,
                    status=RiskStatus.PENDING,
                    matched_keywords=matched_keywords
                )
                risks.append(risk)
        
        return risks
    
    def _match_keywords(self, text: str, keywords: List[str]) -> List[str]:
        """匹配关键词"""
        matched = []
        for keyword in keywords:
            if not self.case_sensitive:
                keyword = keyword.lower()
            
            pattern = re.escape(keyword)
            if re.search(r'\b' + pattern + r'\b', text) or pattern in text:
                matched.append(keyword)
        
        return matched


class DuplicateDetector:
    """重复风险检测器"""
    
    @staticmethod
    def detect_duplicates(risks: List[RiskItem], clauses: List[Clause]) -> List[RiskItem]:
        """检测重复风险"""
        updated_risks = [risk for risk in risks]
        clause_map = DuplicateDetector._build_clause_map(clauses)
        
        groups = DuplicateDetector._group_risks(updated_risks)
        
        for group_key, group_risks in groups.items():
            if len(group_risks) > 1:
                primary_risk = max(
                    group_risks,
                    key=lambda r: (
                        RiskLevel.CRITICAL.value == r.risk_level.value,
                        RiskLevel.HIGH.value == r.risk_level.value,
                        RiskLevel.MEDIUM.value == r.risk_level.value,
                        r.created_at
                    )
                )
                
                for risk in group_risks:
                    if risk.risk_id != primary_risk.risk_id:
                        risk.is_duplicate = True
                        risk.duplicate_of = primary_risk.risk_id
        
        return updated_risks
    
    @staticmethod
    def _build_clause_map(clauses: List[Clause]) -> Dict[str, Clause]:
        """构建条款ID映射"""
        clause_map = {}
        for clause in clauses:
            clause_map[clause.clause_id] = clause
            clause_map.update(DuplicateDetector._build_clause_map(clause.children))
        return clause_map
    
    @staticmethod
    def _group_risks(risks: List[RiskItem]) -> Dict[Tuple, List[RiskItem]]:
        """按规则和关键词分组"""
        groups = {}
        for risk in risks:
            key = (
                risk.rule_id,
                risk.comment_id,
                tuple(sorted(risk.matched_keywords)) if risk.matched_keywords else None
            )
            if key not in groups:
                groups[key] = []
            groups[key].append(risk)
        return groups
    
    @staticmethod
    def consolidate_duplicates(risks: List[RiskItem]) -> Tuple[List[RiskItem], int]:
        """合并重复风险"""
        primary_risks = [r for r in risks if not r.is_duplicate]
        duplicate_count = len(risks) - len(primary_risks)
        return primary_risks, duplicate_count


class RuleEngine:
    """规则引擎主类"""
    
    def __init__(self):
        self.matcher = RiskMatcher()
        self.detector = DuplicateDetector()
    
    def analyze_project(
        self,
        clauses: List[Clause],
        rules: List[RedlineRule],
        comments: List[ApprovalComment]
    ) -> List[RiskItem]:
        """分析整个项目，生成风险项"""
        all_risks = []
        
        all_clauses = self._flatten_clauses(clauses)
        
        for clause in all_clauses:
            clause_risks = self.matcher.match_clause(clause, rules)
            all_risks.extend(clause_risks)
        
        comment_risks = self._generate_risks_from_comments(comments, all_clauses)
        all_risks.extend(comment_risks)
        
        all_risks = self.detector.detect_duplicates(all_risks, clauses)
        
        all_risks.sort(
            key=lambda r: (
                -1 if r.risk_level == RiskLevel.CRITICAL else
                -2 if r.risk_level == RiskLevel.HIGH else
                -3 if r.risk_level == RiskLevel.MEDIUM else -4,
                r.created_at
            )
        )
        
        return all_risks
    
    def _flatten_clauses(self, clauses: List[Clause]) -> List[Clause]:
        """扁平化条款列表"""
        result = []
        for clause in clauses:
            result.append(clause)
            result.extend(self._flatten_clauses(clause.children))
        return result
    
    def _generate_risks_from_comments(
        self,
        comments: List[ApprovalComment],
        clauses: List[Clause]
    ) -> List[RiskItem]:
        """从审批意见生成风险项"""
        risks = []
        clause_ids = {c.clause_id for c in clauses}
        
        for comment in comments:
            if comment.clause_id and comment.clause_id not in clause_ids:
                continue
            
            risk = RiskItem(
                risk_id=f"comment_risk_{comment.comment_id}",
                clause_id=comment.clause_id,
                comment_id=comment.comment_id,
                risk_type="comment_based",
                risk_level=comment.risk_level,
                status=RiskStatus.PENDING,
                matched_keywords=[]
            )
            risks.append(risk)
        
        return risks
    
    @staticmethod
    def get_mandatory_risks(risks: List[RiskItem], rules: List[RedlineRule]) -> List[RiskItem]:
        """获取必改风险项"""
        mandatory_rule_ids = {r.rule_id for r in rules if r.is_mandatory}
        return [r for r in risks if r.rule_id in mandatory_rule_ids]
    
    @staticmethod
    def get_unresolved_risks(risks: List[RiskItem]) -> List[RiskItem]:
        """获取未处理的风险项"""
        return [r for r in risks if r.status in (RiskStatus.PENDING, RiskStatus.CONFIRMED)]
    
    @staticmethod
    def get_duplicate_risks(risks: List[RiskItem]) -> List[RiskItem]:
        """获取重复风险项"""
        return [r for r in risks if r.is_duplicate]
    
    def update_risk_status(
        self,
        risk: RiskItem,
        new_status: RiskStatus,
        reviewer_note: str = ""
    ) -> RiskItem:
        """更新风险项状态"""
        risk.status = new_status
        if reviewer_note:
            risk.reviewer_note = reviewer_note
        risk.updated_at = datetime.now()
        return risk
