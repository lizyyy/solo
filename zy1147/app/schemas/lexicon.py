from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from app.schemas.common import TimestampMixin


class SensitiveWordBase(BaseModel):
    word: str = Field(..., min_length=1, max_length=255, description="敏感词")
    category: str = Field(default="other", description="分类")
    severity: str = Field(default="medium", description="严重级别")
    description: Optional[str] = Field(None, description="描述")
    suggestion: Optional[str] = Field(None, description="建议处理动作")
    is_regex: bool = Field(default=False, description="是否正则表达式")
    is_active: bool = Field(default=True, description="是否启用")


class SensitiveWordCreate(SensitiveWordBase):
    pass


class SensitiveWordUpdate(BaseModel):
    word: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    suggestion: Optional[str] = None
    is_regex: Optional[bool] = None
    is_active: Optional[bool] = None


class SensitiveWordResponse(SensitiveWordBase, TimestampMixin):
    id: int
    normalized_word: str
    pinyin: Optional[str]
    match_count: int
    false_positive_count: int
    version_id: Optional[int]
    
    class Config:
        from_attributes = True


class SynonymBase(BaseModel):
    synonym: str = Field(..., min_length=1, max_length=255)


class SynonymCreate(SynonymBase):
    sensitive_word_id: int


class SynonymResponse(SynonymBase):
    id: int
    sensitive_word_id: int
    normalized_synonym: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class WhitelistBase(BaseModel):
    term: str = Field(..., min_length=1, max_length=255, description="白名单词条")
    reason: Optional[str] = Field(None, description="白名单原因")
    context: Optional[str] = Field(None, description="上下文限制")


class WhitelistCreate(WhitelistBase):
    pass


class WhitelistResponse(WhitelistBase, TimestampMixin):
    id: int
    normalized_term: str
    is_active: bool
    
    class Config:
        from_attributes = True


class ContextRuleBase(BaseModel):
    rule_name: str = Field(..., min_length=1, max_length=100)
    trigger_words: str = Field(..., description="触发词，逗号分隔")
    context_words: Optional[str] = Field(None, description="上下文词，逗号分隔")
    exemption_words: Optional[str] = Field(None, description="豁免词，逗号分隔")
    rule_type: str = Field(default="enhance", description="规则类型: enhance/exempt")
    description: Optional[str] = None
    is_active: bool = Field(default=True)


class ContextRuleCreate(ContextRuleBase):
    sensitive_word_id: Optional[int] = None


class ContextRuleResponse(ContextRuleBase):
    id: int
    sensitive_word_id: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class LexiconVersionResponse(BaseModel):
    id: int
    version: str
    description: Optional[str]
    word_count: int
    synonym_count: int
    whitelist_count: int
    is_active: bool
    is_rollback_point: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class LexiconImportResult(BaseModel):
    success: bool
    total_processed: int
    added: int
    updated: int
    skipped: int
    errors: List[dict]
    new_version: Optional[str] = None
