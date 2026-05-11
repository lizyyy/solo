from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import VersionStatus

class KnowledgeVersionBase(BaseModel):
    question: str
    answer: str
    keywords: Optional[str] = None

class KnowledgeVersionCreate(KnowledgeVersionBase):
    pass

class KnowledgeVersionUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    keywords: Optional[str] = None

class KnowledgeVersionResponse(KnowledgeVersionBase):
    id: int
    entry_id: int
    version_number: int
    status: VersionStatus
    created_at: datetime
    published_at: Optional[datetime] = None
    expired_at: Optional[datetime] = None
    expiry_reason: Optional[str] = None
    
    class Config:
        from_attributes = True

class KnowledgeEntryBase(BaseModel):
    title: str

class KnowledgeEntryCreate(KnowledgeEntryBase):
    question: str
    answer: str
    keywords: Optional[str] = None

class KnowledgeEntryUpdate(BaseModel):
    title: Optional[str] = None

class KnowledgeEntryResponse(KnowledgeEntryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    versions: List[KnowledgeVersionResponse] = []
    
    class Config:
        from_attributes = True

class PublishRequest(BaseModel):
    version_id: int

class ExpireRequest(BaseModel):
    version_id: int
    reason: Optional[str] = None

class QueryRequest(BaseModel):
    query: str
    query_id: Optional[str] = None

class CandidateAnswer(BaseModel):
    entry_id: int
    version_id: int
    question: str
    answer: str
    match_score: int

class QueryResponse(BaseModel):
    query_id: str
    query_text: str
    candidates: List[CandidateAnswer] = []
    has_answer: bool

class AdoptRequest(BaseModel):
    query_id: str
    version_id: int

class RewriteRequest(BaseModel):
    query_id: str
    version_id: int
    rewritten_answer: str

class NoAnswerRequest(BaseModel):
    query_id: str
    query: str
    feedback: Optional[str] = None

class StatisticsResponse(BaseModel):
    total_queries: int
    total_matches: int
    adoption_rate: float
    rewrite_rate: float
    hit_rate: float
    pending_update_entries: List[int] = []
    common_uncovered_queries: List[str] = []
