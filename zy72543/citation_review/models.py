"""数据模型定义"""
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ReviewStatus(str, Enum):
    """复核状态"""
    PENDING = "pending"           
    DUPLICATE_DETECTED = "duplicate_detected"  
    CONFIRMED_DUPLICATE = "confirmed_duplicate"  
    NORMAL = "normal"             
    NEED_MORE_INFO = "need_more_info"  


class NextOwner(str, Enum):
    """下一步负责人"""
    ANNOTATION_LEAD = "annotation_lead"      
    AI_PRODUCT_MANAGER = "ai_product_manager" 
    SYSTEM = "system"                       


class FeedbackTicket(BaseModel):
    """线上反馈工单"""
    model_config = {"protected_namespaces": ()}

    ticket_id: str
    user_id: str
    user_feedback: str
    submit_time: datetime
    source_channel: str = "app"
    model_version: Optional[str] = None
    raw_payload: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.now)


class DesensitizationNote(BaseModel):
    """脱敏规则备注"""
    note_id: str
    ticket_id: str
    noted_by: str = "ai_product_manager_ning"
    desensitization_rule: str
    additional_context: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class EvidencePlayback(BaseModel):
    """证据回放"""
    why_kept: str                   
    missing_materials: List[str]    
    next_owner: NextOwner           
    next_action: str                
    confidence_score: float = 0.0   
    duplicate_ticket_ids: List[str] = Field(default_factory=list)
    reasoning_detail: str = ""


class ReviewRecord(BaseModel):
    """复核记录"""
    review_id: str
    ticket_id: str
    status: ReviewStatus
    duplicate_group_id: Optional[str] = None
    evidence: EvidencePlayback
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)


class DuplicateGroup(BaseModel):
    """重复工单分组"""
    group_id: str
    user_id: str
    ticket_ids: List[str]
    similarity_score: float
    merged_summary: str
    created_at: datetime = Field(default_factory=datetime.now)


class ReviewReport(BaseModel):
    """复核报告 - 学术摘要风格"""
    report_id: str
    generated_at: datetime = Field(default_factory=datetime.now)
    total_tickets: int
    duplicate_groups_count: int
    duplicate_tickets_count: int
    normal_tickets_count: int
    need_more_info_count: int
    summary: str
    key_findings: List[str]
    review_records: List[ReviewRecord]
    duplicate_groups: List[DuplicateGroup]
