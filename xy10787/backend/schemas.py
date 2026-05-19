from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import TranslationStatus


class LanguageKeyBase(BaseModel):
    key: str = Field(..., max_length=255)
    description: Optional[str] = None
    default_value: str
    placeholder_pattern: Optional[str] = None


class LanguageKeyCreate(LanguageKeyBase):
    pass


class LanguageKeyUpdate(BaseModel):
    description: Optional[str] = None
    default_value: Optional[str] = None
    placeholder_pattern: Optional[str] = None


class LanguageKeyResponse(LanguageKeyBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class LanguagePackBase(BaseModel):
    language_code: str = Field(..., max_length=10)
    language_name: str = Field(..., max_length=50)
    is_active: bool = True


class LanguagePackCreate(LanguagePackBase):
    pass


class LanguagePackResponse(LanguagePackBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TranslationBase(BaseModel):
    translated_text: Optional[str] = None
    review_comment: Optional[str] = None


class TranslationCreate(TranslationBase):
    language_key_id: int
    language_pack_id: int


class TranslationUpdate(BaseModel):
    translated_text: Optional[str] = None
    review_comment: Optional[str] = None


class TranslationResponse(TranslationBase):
    id: int
    language_key_id: int
    language_pack_id: int
    status: TranslationStatus
    placeholder_valid: bool
    placeholder_errors: Optional[str]
    is_missing: bool
    last_modified_by: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    language_key: Optional[LanguageKeyResponse]
    language_pack: Optional[LanguagePackResponse]

    class Config:
        from_attributes = True


class TranslationDetailResponse(TranslationResponse):
    pass


class VersionReleaseBase(BaseModel):
    version: str = Field(..., max_length=50)
    description: Optional[str] = None


class VersionReleaseCreate(VersionReleaseBase):
    language_pack_id: int


class VersionReleaseResponse(VersionReleaseBase):
    id: int
    language_pack_id: int
    is_published: bool
    published_at: Optional[datetime]
    published_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    language_pack: Optional[LanguagePackResponse] = None

    class Config:
        from_attributes = True


class CoverageReportResponse(BaseModel):
    id: int
    version_release_id: int
    language_pack_id: Optional[int] = None
    total_keys: int
    translated_keys: int
    missing_keys: int
    coverage_rate: float
    placeholder_error_count: int
    generated_at: datetime
    version: Optional[str] = None
    language_code: Optional[str] = None

    class Config:
        from_attributes = True


class OperationLogResponse(BaseModel):
    id: int
    translation_id: Optional[int]
    operation_type: str
    operator: str
    old_value: Optional[str]
    new_value: Optional[str]
    old_status: Optional[str]
    new_status: Optional[str]
    operation_time: datetime

    class Config:
        from_attributes = True


class TranslationCompareRequest(BaseModel):
    language_key_id: int
    language_pack_id: int
    candidate_translation: str


class TranslationCompareResponse(BaseModel):
    is_new: bool
    similarity_score: float
    existing_translation: Optional[str]
    suggestion: str


class IdempotentRequest(BaseModel):
    idempotency_key: str


class TranslationReviewRequest(IdempotentRequest):
    approved: bool
    comment: Optional[str] = None


class ExportRequest(BaseModel):
    language_pack_id: Optional[int] = None
    version_release_id: Optional[int] = None
    format: str = Field(default="json", description="导出格式: json, csv, xlsx")


class PlaceholderValidationResult(BaseModel):
    is_valid: bool
    errors: List[str]
    missing_placeholders: List[str]
    extra_placeholders: List[str]


class BatchOperationResponse(BaseModel):
    success: int
    failed: int
    total: int
    errors: List[str]
