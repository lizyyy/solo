#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any


class RiskLevel(Enum):
    """风险级别"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RiskStatus(Enum):
    """风险状态"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"
    RESOLVED = "resolved"


class ReviewStatus(Enum):
    """复核状态"""
    NOT_REVIEWED = "not_reviewed"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass
class Clause:
    """合同条款"""
    clause_id: str
    title: str
    content: str
    parent_id: Optional[str] = None
    order: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    children: List['Clause'] = field(default_factory=list)


@dataclass
class RedlineRule:
    """客户红线规则"""
    rule_id: str
    category: str
    description: str
    keywords: List[str]
    risk_level: RiskLevel
    is_mandatory: bool
    remediation: str
    priority: int = 0


@dataclass
class ApprovalComment:
    """审批意见"""
    comment_id: str
    clause_id: str
    reviewer: str
    comment_text: str
    risk_level: RiskLevel
    action_required: str
    created_at: datetime = field(default_factory=datetime.now)
    version: str = "v1"


@dataclass
class RiskItem:
    """风险项"""
    risk_id: str
    clause_id: str
    rule_id: Optional[str] = None
    comment_id: Optional[str] = None
    risk_type: str = "rule_match"
    risk_level: RiskLevel = RiskLevel.MEDIUM
    status: RiskStatus = RiskStatus.PENDING
    matched_keywords: List[str] = field(default_factory=list)
    reviewer_note: str = ""
    assigned_to: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None


@dataclass
class Project:
    """项目/合同"""
    project_id: str
    name: str
    description: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    version: str = "v1"
    clauses: List[Clause] = field(default_factory=list)
    rules: List[RedlineRule] = field(default_factory=list)
    comments: List[ApprovalComment] = field(default_factory=list)
    risks: List[RiskItem] = field(default_factory=list)
    review_status: ReviewStatus = ReviewStatus.NOT_REVIEWED


@dataclass
class ReviewSession:
    """复核会话"""
    session_id: str
    project_id: str
    reviewer: str
    started_at: datetime = field(default_factory=datetime.now)
    ended_at: Optional[datetime] = None
    decisions: Dict[str, str] = field(default_factory=dict)
    notes: str = ""
