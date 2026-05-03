#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
项目存储 - 本地持久化
"""

import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from models.data_models import (
    Project, Clause, RedlineRule, ApprovalComment, RiskItem,
    RiskLevel, RiskStatus, ReviewStatus
)


class ProjectSerializer:
    """项目序列化器"""
    
    @staticmethod
    def to_dict(project: Project) -> Dict[str, Any]:
        """将项目转换为字典"""
        return {
            "project_id": project.project_id,
            "name": project.name,
            "description": project.description,
            "created_at": project.created_at.isoformat() if project.created_at else None,
            "updated_at": project.updated_at.isoformat() if project.updated_at else None,
            "version": project.version,
            "clauses": ProjectSerializer._serialize_clauses(project.clauses),
            "rules": ProjectSerializer._serialize_rules(project.rules),
            "comments": ProjectSerializer._serialize_comments(project.comments),
            "risks": ProjectSerializer._serialize_risks(project.risks),
            "review_status": project.review_status.value if project.review_status else None
        }
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> Project:
        """从字典恢复项目"""
        created_at = datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now()
        updated_at = datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        
        review_status = ReviewStatus(data["review_status"]) if data.get("review_status") else ReviewStatus.NOT_REVIEWED
        
        project = Project(
            project_id=data["project_id"],
            name=data["name"],
            description=data.get("description", ""),
            created_at=created_at,
            updated_at=updated_at,
            version=data.get("version", "v1"),
            review_status=review_status
        )
        
        project.clauses = ProjectSerializer._deserialize_clauses(data.get("clauses", []))
        project.rules = ProjectSerializer._deserialize_rules(data.get("rules", []))
        project.comments = ProjectSerializer._deserialize_comments(data.get("comments", []))
        project.risks = ProjectSerializer._deserialize_risks(data.get("risks", []))
        
        return project
    
    @staticmethod
    def _serialize_clauses(clauses: List[Clause]) -> List[Dict[str, Any]]:
        """序列化条款"""
        result = []
        for clause in clauses:
            result.append({
                "clause_id": clause.clause_id,
                "title": clause.title,
                "content": clause.content,
                "parent_id": clause.parent_id,
                "order": clause.order,
                "metadata": clause.metadata,
                "children": ProjectSerializer._serialize_clauses(clause.children)
            })
        return result
    
    @staticmethod
    def _deserialize_clauses(data: List[Dict[str, Any]]) -> List[Clause]:
        """反序列化条款"""
        result = []
        for item in data:
            clause = Clause(
                clause_id=item["clause_id"],
                title=item["title"],
                content=item["content"],
                parent_id=item.get("parent_id"),
                order=item.get("order", 0),
                metadata=item.get("metadata", {})
            )
            clause.children = ProjectSerializer._deserialize_clauses(item.get("children", []))
            result.append(clause)
        return result
    
    @staticmethod
    def _serialize_rules(rules: List[RedlineRule]) -> List[Dict[str, Any]]:
        """序列化规则"""
        return [
            {
                "rule_id": r.rule_id,
                "category": r.category,
                "description": r.description,
                "keywords": r.keywords,
                "risk_level": r.risk_level.value,
                "is_mandatory": r.is_mandatory,
                "remediation": r.remediation,
                "priority": r.priority
            }
            for r in rules
        ]
    
    @staticmethod
    def _deserialize_rules(data: List[Dict[str, Any]]) -> List[RedlineRule]:
        """反序列化规则"""
        return [
            RedlineRule(
                rule_id=item["rule_id"],
                category=item["category"],
                description=item["description"],
                keywords=item["keywords"],
                risk_level=RiskLevel(item["risk_level"]),
                is_mandatory=item.get("is_mandatory", False),
                remediation=item.get("remediation", ""),
                priority=item.get("priority", 0)
            )
            for item in data
        ]
    
    @staticmethod
    def _serialize_comments(comments: List[ApprovalComment]) -> List[Dict[str, Any]]:
        """序列化审批意见"""
        return [
            {
                "comment_id": c.comment_id,
                "clause_id": c.clause_id,
                "reviewer": c.reviewer,
                "comment_text": c.comment_text,
                "risk_level": c.risk_level.value,
                "action_required": c.action_required,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "version": c.version
            }
            for c in comments
        ]
    
    @staticmethod
    def _deserialize_comments(data: List[Dict[str, Any]]) -> List[ApprovalComment]:
        """反序列化审批意见"""
        result = []
        for item in data:
            created_at = datetime.fromisoformat(item["created_at"]) if item.get("created_at") else datetime.now()
            result.append(
                ApprovalComment(
                    comment_id=item["comment_id"],
                    clause_id=item["clause_id"],
                    reviewer=item["reviewer"],
                    comment_text=item["comment_text"],
                    risk_level=RiskLevel(item["risk_level"]),
                    action_required=item.get("action_required", ""),
                    created_at=created_at,
                    version=item.get("version", "v1")
                )
            )
        return result
    
    @staticmethod
    def _serialize_risks(risks: List[RiskItem]) -> List[Dict[str, Any]]:
        """序列化风险项"""
        return [
            {
                "risk_id": r.risk_id,
                "clause_id": r.clause_id,
                "rule_id": r.rule_id,
                "comment_id": r.comment_id,
                "risk_type": r.risk_type,
                "risk_level": r.risk_level.value,
                "status": r.status.value,
                "matched_keywords": r.matched_keywords,
                "reviewer_note": r.reviewer_note,
                "assigned_to": r.assigned_to,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                "is_duplicate": r.is_duplicate,
                "duplicate_of": r.duplicate_of
            }
            for r in risks
        ]
    
    @staticmethod
    def _deserialize_risks(data: List[Dict[str, Any]]) -> List[RiskItem]:
        """反序列化风险项"""
        result = []
        for item in data:
            created_at = datetime.fromisoformat(item["created_at"]) if item.get("created_at") else datetime.now()
            updated_at = datetime.fromisoformat(item["updated_at"]) if item.get("updated_at") else datetime.now()
            
            result.append(
                RiskItem(
                    risk_id=item["risk_id"],
                    clause_id=item["clause_id"],
                    rule_id=item.get("rule_id"),
                    comment_id=item.get("comment_id"),
                    risk_type=item.get("risk_type", "rule_match"),
                    risk_level=RiskLevel(item["risk_level"]),
                    status=RiskStatus(item["status"]),
                    matched_keywords=item.get("matched_keywords", []),
                    reviewer_note=item.get("reviewer_note", ""),
                    assigned_to=item.get("assigned_to", ""),
                    created_at=created_at,
                    updated_at=updated_at,
                    is_duplicate=item.get("is_duplicate", False),
                    duplicate_of=item.get("duplicate_of")
                )
            )
        return result


class ProjectStore:
    """项目存储管理器"""
    
    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            home = Path.home()
            storage_dir = str(home / ".clause_redline" / "projects")
        
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.serializer = ProjectSerializer()
    
    def list_projects(self) -> List[Dict[str, Any]]:
        """列出所有项目"""
        projects = []
        
        for project_file in self.storage_dir.glob("*.json"):
            try:
                with open(project_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                projects.append({
                    "project_id": data.get("project_id"),
                    "name": data.get("name"),
                    "description": data.get("description", ""),
                    "updated_at": data.get("updated_at"),
                    "version": data.get("version", "v1"),
                    "review_status": data.get("review_status")
                })
            except Exception:
                continue
        
        projects.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return projects
    
    def save_project(self, project: Project) -> str:
        """保存项目"""
        project.updated_at = datetime.now()
        
        if not project.project_id:
            project.project_id = f"proj_{uuid.uuid4().hex[:8]}"
        
        data = self.serializer.to_dict(project)
        file_path = self.storage_dir / f"{project.project_id}.json"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return project.project_id
    
    def load_project(self, project_id: str) -> Optional[Project]:
        """加载项目"""
        file_path = self.storage_dir / f"{project_id}.json"
        
        if not file_path.exists():
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self.serializer.from_dict(data)
    
    def delete_project(self, project_id: str) -> bool:
        """删除项目"""
        file_path = self.storage_dir / f"{project_id}.json"
        
        if file_path.exists():
            file_path.unlink()
            return True
        
        return False
    
    def create_new_project(self, name: str, description: str = "") -> Project:
        """创建新项目"""
        project_id = f"proj_{uuid.uuid4().hex[:8]}"
        now = datetime.now()
        
        return Project(
            project_id=project_id,
            name=name,
            description=description,
            created_at=now,
            updated_at=now,
            version="v1"
        )
