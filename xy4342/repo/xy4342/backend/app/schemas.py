from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class IssueStatus(str, Enum):
    OPEN = "open"
    DISMISSED = "dismissed"
    CONFIRMED = "confirmed"
    FIXED = "fixed"

class IssueCategory(str, Enum):
    COSTUME = "costume"
    PROP = "prop"
    TIMELINE = "timeline"
    ADDRESS = "address"
    SIMILARITY = "similarity"
    OTHER = "other"

class CharacterBase(BaseModel):
    name: str
    full_name: Optional[str] = None
    aliases: Optional[str] = None
    costume_default: Optional[str] = None
    costume_variants: Optional[str] = None
    props_default: Optional[str] = None
    description: Optional[str] = None

class CharacterCreate(CharacterBase):
    pass

class Character(CharacterBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PanelBase(BaseModel):
    panel_number: int
    page_number: Optional[int] = None
    time_of_day: Optional[str] = None
    location: Optional[str] = None
    characters_present: Optional[str] = None
    costumes: Optional[str] = None
    props: Optional[str] = None
    action: Optional[str] = None
    sketch_path: Optional[str] = None
    notes: Optional[str] = None

class PanelCreate(PanelBase):
    chapter_id: int

class Panel(PanelBase):
    id: int
    chapter_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DialogueBase(BaseModel):
    speaker: Optional[str] = None
    address_to: Optional[str] = None
    content: str
    panel_number: Optional[int] = None

class DialogueCreate(DialogueBase):
    chapter_id: int
    panel_id: Optional[int] = None

class Dialogue(DialogueBase):
    id: int
    chapter_id: int
    panel_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChapterBase(BaseModel):
    chapter_number: int
    chapter_title: Optional[str] = None

class ChapterCreate(ChapterBase):
    pass

class Chapter(ChapterBase):
    id: int
    created_at: datetime
    updated_at: datetime
    panels: List[Panel] = []
    dialogues: List[Dialogue] = []

    class Config:
        from_attributes = True

class ReviewBase(BaseModel):
    issue_id: int
    reviewer: str = "主笔"
    comment: Optional[str] = None
    decision: Optional[str] = None

class ReviewCreate(ReviewBase):
    pass

class Review(ReviewBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class IssueBase(BaseModel):
    category: IssueCategory
    severity: IssueSeverity = IssueSeverity.MEDIUM
    status: IssueStatus = IssueStatus.OPEN
    title: str
    description: Optional[str] = None
    affected_panels: Optional[str] = None
    affected_chapters: Optional[str] = None
    rule_name: Optional[str] = None
    confidence: int = 100

class IssueCreate(IssueBase):
    pass

class IssueUpdate(BaseModel):
    status: Optional[IssueStatus] = None
    severity: Optional[IssueSeverity] = None
    title: Optional[str] = None
    description: Optional[str] = None

class Issue(IssueBase):
    id: int
    created_at: datetime
    updated_at: datetime
    reviews: List[Review] = []

    class Config:
        from_attributes = True

class ImportResult(BaseModel):
    success: bool
    message: str
    details: Optional[Dict[str, Any]] = None

class ValidationResult(BaseModel):
    total_issues: int
    by_category: Dict[str, int]
    by_severity: Dict[str, int]
    issues: List[Issue]

class ExportRequest(BaseModel):
    format: str
    include_statuses: Optional[List[str]] = None
    include_categories: Optional[List[str]] = None

class BatchUpdateRequest(BaseModel):
    issue_ids: List[int]
    status: Optional[IssueStatus] = None
