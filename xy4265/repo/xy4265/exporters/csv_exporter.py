#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV风险表导出器
"""

import csv
from datetime import datetime
from typing import List, Dict, Any, Optional

from models.data_models import (
    Project, Clause, RiskItem, RiskLevel, RiskStatus
)


class CSVExporter:
    """CSV风险表导出器"""
    
    def __init__(self):
        self.include_duplicates = False
    
    def export(self, project: Project, output_path: str):
        """导出CSV风险表"""
        risks = project.risks
        
        if not self.include_duplicates:
            risks = [r for r in risks if not r.is_duplicate]
        
        rows = []
        
        for risk in risks:
            clause = self._find_clause(project.clauses, risk.clause_id)
            clause_title = clause.title if clause else f"条款 {risk.clause_id}"
            
            level_map = {
                RiskLevel.CRITICAL: "严重",
                RiskLevel.HIGH: "高",
                RiskLevel.MEDIUM: "中",
                RiskLevel.LOW: "低"
            }
            
            status_map = {
                RiskStatus.PENDING: "待处理",
                RiskStatus.CONFIRMED: "已确认",
                RiskStatus.RESOLVED: "已解决",
                RiskStatus.DISMISSED: "已驳回"
            }
            
            row = {
                "风险ID": risk.risk_id,
                "条款ID": risk.clause_id,
                "条款标题": clause_title,
                "风险级别": level_map.get(risk.risk_level, str(risk.risk_level)),
                "处理状态": status_map.get(risk.status, str(risk.status)),
                "风险类型": risk.risk_type,
                "命中关键词": ", ".join(risk.matched_keywords) if risk.matched_keywords else "",
                "规则ID": risk.rule_id or "",
                "意见ID": risk.comment_id or "",
                "复核备注": risk.reviewer_note,
                "是否重复": "是" if risk.is_duplicate else "否",
                "重复自": risk.duplicate_of or "",
                "创建时间": risk.created_at.strftime("%Y-%m-%d %H:%M:%S") if risk.created_at else "",
                "更新时间": risk.updated_at.strftime("%Y-%m-%d %H:%M:%S") if risk.updated_at else ""
            }
            rows.append(row)
        
        fieldnames = [
            "风险ID", "条款ID", "条款标题", "风险级别", "处理状态",
            "风险类型", "命中关键词", "规则ID", "意见ID", "复核备注",
            "是否重复", "重复自", "创建时间", "更新时间"
        ]
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    
    def export_summary(self, project: Project, output_path: str):
        """导出汇总统计CSV"""
        risks = project.risks
        
        level_map = {
            RiskLevel.CRITICAL: "严重",
            RiskLevel.HIGH: "高",
            RiskLevel.MEDIUM: "中",
            RiskLevel.LOW: "低"
        }
        
        status_map = {
            RiskStatus.PENDING: "待处理",
            RiskStatus.CONFIRMED: "已确认",
            RiskStatus.RESOLVED: "已解决",
            RiskStatus.DISMISSED: "已驳回"
        }
        
        rows = []
        rows.append({
            "统计维度": "按风险级别",
            "类别": "严重",
            "数量": sum(1 for r in risks if r.risk_level == RiskLevel.CRITICAL)
        })
        rows.append({
            "统计维度": "按风险级别",
            "类别": "高",
            "数量": sum(1 for r in risks if r.risk_level == RiskLevel.HIGH)
        })
        rows.append({
            "统计维度": "按风险级别",
            "类别": "中",
            "数量": sum(1 for r in risks if r.risk_level == RiskLevel.MEDIUM)
        })
        rows.append({
            "统计维度": "按风险级别",
            "类别": "低",
            "数量": sum(1 for r in risks if r.risk_level == RiskLevel.LOW)
        })
        
        rows.append({
            "统计维度": "按处理状态",
            "类别": "待处理",
            "数量": sum(1 for r in risks if r.status == RiskStatus.PENDING)
        })
        rows.append({
            "统计维度": "按处理状态",
            "类别": "已确认",
            "数量": sum(1 for r in risks if r.status == RiskStatus.CONFIRMED)
        })
        rows.append({
            "统计维度": "按处理状态",
            "类别": "已解决",
            "数量": sum(1 for r in risks if r.status == RiskStatus.RESOLVED)
        })
        rows.append({
            "统计维度": "按处理状态",
            "类别": "已驳回",
            "数量": sum(1 for r in risks if r.status == RiskStatus.DISMISSED)
        })
        
        rows.append({
            "统计维度": "其他",
            "类别": "重复风险",
            "数量": sum(1 for r in risks if r.is_duplicate)
        })
        rows.append({
            "统计维度": "其他",
            "类别": "总风险数",
            "数量": len(risks)
        })
        
        fieldnames = ["统计维度", "类别", "数量"]
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    
    def _find_clause(self, clauses: List[Clause], clause_id: str) -> Optional[Clause]:
        """查找条款"""
        for clause in clauses:
            if clause.clause_id == clause_id:
                return clause
            found = self._find_clause(clause.children, clause_id)
            if found:
                return found
        return None
