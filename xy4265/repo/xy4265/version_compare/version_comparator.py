#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
版本对比模块 - 检测签署版与审批版差异
"""

import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Tuple, Optional

from models.data_models import (
    Clause, RiskItem, RedlineRule, RiskStatus, RiskLevel
)


class DiffType(Enum):
    """差异类型"""
    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    UNCHANGED = "unchanged"


@dataclass
class VersionDiff:
    """版本差异"""
    clause_id: str
    field: str
    old_value: Any
    new_value: Any
    diff_type: DiffType
    description: str = ""


class VersionComparator:
    """版本比较器"""
    
    def __init__(self):
        self.ignore_whitespace = True
        self.ignore_case = False
    
    def compare_clauses(
        self,
        old_clauses: List[Clause],
        new_clauses: List[Clause]
    ) -> List[VersionDiff]:
        """比较两个版本的条款"""
        diffs = []
        
        old_clause_map = self._build_clause_map(old_clauses)
        new_clause_map = self._build_clause_map(new_clauses)
        
        for clause_id in set(old_clause_map.keys()) | set(new_clause_map.keys()):
            old_clause = old_clause_map.get(clause_id)
            new_clause = new_clause_map.get(clause_id)
            
            if old_clause is None:
                diffs.append(VersionDiff(
                    clause_id=clause_id,
                    field="clause",
                    old_value=None,
                    new_value=new_clause.title if new_clause else "",
                    diff_type=DiffType.ADDED,
                    description=f"新增条款: {new_clause.title if new_clause else clause_id}"
                ))
            elif new_clause is None:
                diffs.append(VersionDiff(
                    clause_id=clause_id,
                    field="clause",
                    old_value=old_clause.title,
                    new_value=None,
                    diff_type=DiffType.REMOVED,
                    description=f"删除条款: {old_clause.title}"
                ))
            else:
                field_diffs = self._compare_clause_fields(old_clause, new_clause)
                diffs.extend(field_diffs)
        
        return diffs
    
    def _build_clause_map(self, clauses: List[Clause]) -> Dict[str, Clause]:
        """构建条款ID映射"""
        result = {}
        for clause in clauses:
            result[clause.clause_id] = clause
            result.update(self._build_clause_map(clause.children))
        return result
    
    def _compare_clause_fields(self, old_clause: Clause, new_clause: Clause) -> List[VersionDiff]:
        """比较单个条款的字段"""
        diffs = []
        
        if old_clause.title != new_clause.title:
            diffs.append(VersionDiff(
                clause_id=old_clause.clause_id,
                field="title",
                old_value=old_clause.title,
                new_value=new_clause.title,
                diff_type=DiffType.MODIFIED,
                description=f"标题修改: '{old_clause.title}' -> '{new_clause.title}'"
            ))
        
        if self._content_changed(old_clause.content, new_clause.content):
            diffs.append(VersionDiff(
                clause_id=old_clause.clause_id,
                field="content",
                old_value=old_clause.content,
                new_value=new_clause.content,
                diff_type=DiffType.MODIFIED,
                description=f"条款内容已修改"
            ))
        
        if old_clause.order != new_clause.order:
            diffs.append(VersionDiff(
                clause_id=old_clause.clause_id,
                field="order",
                old_value=old_clause.order,
                new_value=new_clause.order,
                diff_type=DiffType.MODIFIED,
                description=f"排序变更: {old_clause.order} -> {new_clause.order}"
            ))
        
        return diffs
    
    def _content_changed(self, old_content: str, new_content: str) -> bool:
        """检查内容是否变化"""
        old = old_content or ""
        new = new_content or ""
        
        if self.ignore_whitespace:
            old = re.sub(r'\s+', ' ', old).strip()
            new = re.sub(r'\s+', ' ', new).strip()
        
        if self.ignore_case:
            old = old.lower()
            new = new.lower()
        
        return old != new
    
    def compare_risks(
        self,
        old_risks: List[RiskItem],
        new_risks: List[RiskItem]
    ) -> Tuple[List[RiskItem], List[RiskItem], List[Tuple[RiskItem, RiskItem]]]:
        """比较风险项变化
        
        Returns:
            (新增风险, 已解决风险, 状态变更风险对)
        """
        old_risk_map = {r.risk_id: r for r in old_risks}
        new_risk_map = {r.risk_id: r for r in new_risks}
        
        new_risks_found = []
        resolved_risks = []
        status_changed = []
        
        for risk_id, new_risk in new_risk_map.items():
            if risk_id not in old_risk_map:
                new_risks_found.append(new_risk)
            else:
                old_risk = old_risk_map[risk_id]
                if old_risk.status != new_risk.status:
                    status_changed.append((old_risk, new_risk))
        
        for risk_id, old_risk in old_risk_map.items():
            if risk_id not in new_risk_map:
                resolved_risks.append(old_risk)
        
        return new_risks_found, resolved_risks, status_changed
    
    def generate_diff_summary(
        self,
        clause_diffs: List[VersionDiff],
        risks: Tuple[List[RiskItem], List[RiskItem], List[Tuple[RiskItem, RiskItem]]]
    ) -> Dict[str, Any]:
        """生成差异摘要"""
        new_risks, resolved_risks, status_changed = risks
        
        clause_summary = {
            "added": sum(1 for d in clause_diffs if d.diff_type == DiffType.ADDED),
            "removed": sum(1 for d in clause_diffs if d.diff_type == DiffType.REMOVED),
            "modified": sum(1 for d in clause_diffs if d.diff_type == DiffType.MODIFIED),
            "total": len(clause_diffs)
        }
        
        risk_summary = {
            "new_risks": len(new_risks),
            "resolved_risks": len(resolved_risks),
            "status_changes": len(status_changed)
        }
        
        return {
            "clauses": clause_summary,
            "risks": risk_summary,
            "has_significant_changes": (
                clause_summary["added"] > 0 or 
                clause_summary["removed"] > 0 or
                clause_summary["modified"] > 0 or
                risk_summary["new_risks"] > 0
            ),
            "generated_at": datetime.now().isoformat()
        }
