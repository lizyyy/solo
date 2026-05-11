from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from enum import Enum
import json


class RiskLevel(Enum):
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"
    CRITICAL = "严重"


class RiskType(Enum):
    DELAY = "延期风险"
    DEFECT_BACKLOG = "缺陷堆积"
    OWNER_OVERLOAD = "负责人过载"
    MILESTONE_DEVIATION = "里程碑偏差"
    TASK_CLOSED_DEFECT_OPEN = "任务关闭缺陷未修复"
    MILESTONE_BEFORE_TASK = "里程碑早于任务计划"
    OWNER_MISSING = "负责人缺失"


class RiskStatus(Enum):
    IDENTIFIED = "已识别"
    EXPLAINED = "已解释"
    MITIGATED = "已缓解"
    RESOLVED = "已解决"


@dataclass
class Task:
    id: str
    title: str
    status: str
    owner: Optional[str]
    planned_start: date
    planned_end: date
    actual_start: Optional[date] = None
    actual_end: Optional[date] = None
    week_number: int = 0
    project: str = ""
    description: str = ""
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d['planned_start'] = self.planned_start.isoformat()
        d['planned_end'] = self.planned_end.isoformat()
        if self.actual_start:
            d['actual_start'] = self.actual_start.isoformat()
        if self.actual_end:
            d['actual_end'] = self.actual_end.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'Task':
        return cls(
            id=d['id'],
            title=d['title'],
            status=d['status'],
            owner=d.get('owner'),
            planned_start=date.fromisoformat(d['planned_start']),
            planned_end=date.fromisoformat(d['planned_end']),
            actual_start=date.fromisoformat(d['actual_start']) if d.get('actual_start') else None,
            actual_end=date.fromisoformat(d['actual_end']) if d.get('actual_end') else None,
            week_number=d.get('week_number', 0),
            project=d.get('project', ''),
            description=d.get('description', ''),
            tags=d.get('tags', [])
        )


@dataclass
class Defect:
    id: str
    title: str
    severity: str
    status: str
    owner: Optional[str]
    related_task_id: Optional[str] = None
    created_date: Optional[date] = None
    resolved_date: Optional[date] = None
    week_number: int = 0
    project: str = ""
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if self.created_date:
            d['created_date'] = self.created_date.isoformat()
        if self.resolved_date:
            d['resolved_date'] = self.resolved_date.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'Defect':
        return cls(
            id=d['id'],
            title=d['title'],
            severity=d['severity'],
            status=d['status'],
            owner=d.get('owner'),
            related_task_id=d.get('related_task_id'),
            created_date=date.fromisoformat(d['created_date']) if d.get('created_date') else None,
            resolved_date=date.fromisoformat(d['resolved_date']) if d.get('resolved_date') else None,
            week_number=d.get('week_number', 0),
            project=d.get('project', ''),
            description=d.get('description', '')
        )


@dataclass
class Milestone:
    id: str
    title: str
    planned_date: date
    actual_date: Optional[date] = None
    status: str = "未开始"
    week_number: int = 0
    project: str = ""
    description: str = ""
    dependent_tasks: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d['planned_date'] = self.planned_date.isoformat()
        if self.actual_date:
            d['actual_date'] = self.actual_date.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'Milestone':
        return cls(
            id=d['id'],
            title=d['title'],
            planned_date=date.fromisoformat(d['planned_date']),
            actual_date=date.fromisoformat(d['actual_date']) if d.get('actual_date') else None,
            status=d.get('status', '未开始'),
            week_number=d.get('week_number', 0),
            project=d.get('project', ''),
            description=d.get('description', ''),
            dependent_tasks=d.get('dependent_tasks', [])
        )


@dataclass
class BlockerNote:
    id: str
    content: str
    owner: Optional[str]
    created_date: date
    resolved_date: Optional[date] = None
    week_number: int = 0
    project: str = ""
    related_task_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d['created_date'] = self.created_date.isoformat()
        if self.resolved_date:
            d['resolved_date'] = self.resolved_date.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'BlockerNote':
        return cls(
            id=d['id'],
            content=d['content'],
            owner=d.get('owner'),
            created_date=date.fromisoformat(d['created_date']),
            resolved_date=date.fromisoformat(d['resolved_date']) if d.get('resolved_date') else None,
            week_number=d.get('week_number', 0),
            project=d.get('project', ''),
            related_task_id=d.get('related_task_id')
        )


@dataclass
class RiskEvidence:
    source_type: str
    source_id: str
    source_title: str
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'RiskEvidence':
        return cls(
            source_type=d['source_type'],
            source_id=d['source_id'],
            source_title=d['source_title'],
            details=d.get('details', {})
        )


@dataclass
class Risk:
    id: str
    risk_type: RiskType
    level: RiskLevel
    status: RiskStatus
    week_number: int
    project: str
    title: str
    description: str
    evidence: List[RiskEvidence] = field(default_factory=list)
    owner: Optional[str] = None
    explanation: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d['risk_type'] = self.risk_type.value
        d['level'] = self.level.value
        d['status'] = self.status.value
        d['created_at'] = self.created_at.isoformat()
        d['evidence'] = [e.to_dict() for e in self.evidence]
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'Risk':
        return cls(
            id=d['id'],
            risk_type=RiskType(d['risk_type']),
            level=RiskLevel(d['level']),
            status=RiskStatus(d['status']),
            week_number=d['week_number'],
            project=d['project'],
            title=d['title'],
            description=d['description'],
            evidence=[RiskEvidence.from_dict(e) for e in d.get('evidence', [])],
            owner=d.get('owner'),
            explanation=d.get('explanation'),
            created_at=datetime.fromisoformat(d['created_at']) if d.get('created_at') else datetime.now()
        )


@dataclass
class ProjectRiskReport:
    week_number: int
    project: str
    generated_at: datetime = field(default_factory=datetime.now)
    overall_risk_level: RiskLevel = RiskLevel.LOW
    risks: List[Risk] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d['generated_at'] = self.generated_at.isoformat()
        d['overall_risk_level'] = self.overall_risk_level.value
        d['risks'] = [r.to_dict() for r in self.risks]
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'ProjectRiskReport':
        return cls(
            week_number=d['week_number'],
            project=d['project'],
            generated_at=datetime.fromisoformat(d['generated_at']) if d.get('generated_at') else datetime.now(),
            overall_risk_level=RiskLevel(d['overall_risk_level']),
            risks=[Risk.from_dict(r) for r in d.get('risks', [])],
            summary=d.get('summary', {})
        )
