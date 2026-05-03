#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JSON审计包导出器
"""

import json
import os
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from models.data_models import Project
from storage.project_store import ProjectSerializer


class JSONAuditExporter:
    """JSON审计包导出器"""
    
    def __init__(self):
        self.include_session_data = True
        self.compress = True
    
    def export(self, project: Project, output_path: str):
        """导出JSON审计包"""
        audit_package = self._build_audit_package(project)
        
        if self.compress:
            self._export_zip(audit_package, output_path)
        else:
            self._export_json(audit_package, output_path)
    
    def _build_audit_package(self, project: Project) -> Dict[str, Any]:
        """构建审计包"""
        serializer = ProjectSerializer()
        project_data = serializer.to_dict(project)
        
        summary = self._generate_audit_summary(project)
        
        audit_package = {
            "audit_info": {
                "exported_at": datetime.now().isoformat(),
                "version": "1.0",
                "tool": "条款红线落点器"
            },
            "summary": summary,
            "project": project_data,
            "decisions": self._extract_decisions(project)
        }
        
        return audit_package
    
    def _generate_audit_summary(self, project: Project) -> Dict[str, Any]:
        """生成审计摘要"""
        risks = project.risks
        
        critical_count = sum(1 for r in risks if r.risk_level.value == "critical")
        high_count = sum(1 for r in risks if r.risk_level.value == "high")
        medium_count = sum(1 for r in risks if r.risk_level.value == "medium")
        low_count = sum(1 for r in risks if r.risk_level.value == "low")
        
        pending_count = sum(1 for r in risks if r.status.value == "pending")
        confirmed_count = sum(1 for r in risks if r.status.value == "confirmed")
        resolved_count = sum(1 for r in risks if r.status.value == "resolved")
        dismissed_count = sum(1 for r in risks if r.status.value == "dismissed")
        
        duplicate_count = sum(1 for r in risks if r.is_duplicate)
        
        mandatory_rules = [r for r in project.rules if r.is_mandatory]
        mandatory_risks = [
            r for r in risks 
            if r.rule_id in [mr.rule_id for mr in mandatory_rules]
        ]
        unresolved_mandatory = [
            r for r in mandatory_risks 
            if r.status.value in ["pending", "confirmed"]
        ]
        
        return {
            "project_name": project.name,
            "project_id": project.project_id,
            "version": project.version,
            "review_status": project.review_status.value if project.review_status else "not_reviewed",
            "risk_statistics": {
                "by_level": {
                    "critical": critical_count,
                    "high": high_count,
                    "medium": medium_count,
                    "low": low_count,
                    "total": len(risks)
                },
                "by_status": {
                    "pending": pending_count,
                    "confirmed": confirmed_count,
                    "resolved": resolved_count,
                    "dismissed": dismissed_count
                }
            },
            "duplicate_risks": {
                "count": duplicate_count,
                "total_risk_count": len(risks)
            },
            "mandatory_check": {
                "mandatory_rules_count": len(mandatory_rules),
                "mandatory_risks_count": len(mandatory_risks),
                "unresolved_mandatory_count": len(unresolved_mandatory),
                "all_mandatory_resolved": len(unresolved_mandatory) == 0
            },
            "clause_count": len(self._flatten_clauses(project.clauses)),
            "rule_count": len(project.rules),
            "comment_count": len(project.comments)
        }
    
    def _extract_decisions(self, project: Project) -> Dict[str, Any]:
        """提取复核决策"""
        decisions = []
        
        for risk in project.risks:
            if risk.reviewer_note or risk.status.value != "pending":
                decision = {
                    "risk_id": risk.risk_id,
                    "clause_id": risk.clause_id,
                    "final_status": risk.status.value,
                    "reviewer_note": risk.reviewer_note,
                    "updated_at": risk.updated_at.isoformat() if risk.updated_at else None
                }
                decisions.append(decision)
        
        return {
            "total_decisions": len(decisions),
            "decisions": decisions
        }
    
    def _flatten_clauses(self, clauses) -> list:
        """扁平化条款列表"""
        result = []
        for clause in clauses:
            result.append(clause)
            result.extend(self._flatten_clauses(clause.children))
        return result
    
    def _export_json(self, audit_package: Dict[str, Any], output_path: str):
        """导出为单个JSON文件"""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2)
    
    def _export_zip(self, audit_package: Dict[str, Any], output_path: str):
        """导出为ZIP压缩包"""
        import tempfile
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            project_json = temp_path / "project.json"
            with open(project_json, 'w', encoding='utf-8') as f:
                json.dump(audit_package["project"], f, ensure_ascii=False, indent=2)
            
            summary_json = temp_path / "summary.json"
            with open(summary_json, 'w', encoding='utf-8') as f:
                json.dump(audit_package["summary"], f, ensure_ascii=False, indent=2)
            
            decisions_json = temp_path / "decisions.json"
            with open(decisions_json, 'w', encoding='utf-8') as f:
                json.dump(audit_package["decisions"], f, ensure_ascii=False, indent=2)
            
            audit_info_json = temp_path / "audit_info.json"
            with open(audit_info_json, 'w', encoding='utf-8') as f:
                json.dump(audit_package["audit_info"], f, ensure_ascii=False, indent=2)
            
            zip_path = output_path if output_path.endswith('.zip') else output_path + '.zip'
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.write(project_json, "project.json")
                zf.write(summary_json, "summary.json")
                zf.write(decisions_json, "decisions.json")
                zf.write(audit_info_json, "audit_info.json")
