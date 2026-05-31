from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class KnowledgeBase(BaseModel):
    name: str = Field(..., max_length=255, description="知识库名称")
    knowledge_type: Optional[str] = Field(None, max_length=50, description="知识库类型")
    content: str = Field(..., description="知识库内容")
    keywords: Optional[str] = Field(None, description="关键词，逗号分隔")


class KnowledgeCreate(KnowledgeBase):
    pass


class KnowledgeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255, description="知识库名称")
    knowledge_type: Optional[str] = Field(None, max_length=50, description="知识库类型")
    content: Optional[str] = Field(None, description="知识库内容")
    keywords: Optional[str] = Field(None, description="关键词，逗号分隔")
    change_description: Optional[str] = Field(None, max_length=500, description="变更描述")


class KnowledgeVersionResponse(BaseModel):
    id: int
    knowledge_id: int
    version: str
    content: str
    keywords: Optional[str]
    change_description: Optional[str]
    affected_questions: Optional[str]
    created_at: datetime
    user_friendly_message: str = "获取版本信息成功～"

    class Config:
        from_attributes = True


class KnowledgeResponse(KnowledgeBase):
    id: int
    version: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    versions: List[KnowledgeVersionResponse] = Field(default_factory=list)
    user_friendly_message: str = "获取知识库信息成功～"

    class Config:
        from_attributes = True


class KnowledgeListItem(BaseModel):
    id: int
    name: str
    knowledge_type: Optional[str]
    version: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    user_friendly_message: str = "获取知识库列表成功～"

    class Config:
        from_attributes = True


class VersionDiffResponse(BaseModel):
    knowledge_id: int
    old_version: str
    new_version: str
    diff_content: str
    change_description: str
    affected_question_count: int
    affected_question_ids: List[int] = Field(default_factory=list)
    user_friendly_message: str = "版本对比完成～"


class VersionMarkResponse(BaseModel):
    knowledge_id: int
    version: str
    marked_count: int
    user_friendly_message: str = "受影响问题标记完成～"
