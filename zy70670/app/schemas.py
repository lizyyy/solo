from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import ProductStatus, ReferenceStatus, FailureReason


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    status: ProductStatus = ProductStatus.ACTIVE
    description: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[ProductStatus] = None
    description: Optional[str] = None


class Product(ProductBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class KnowledgeDirectoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    path: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    parent_id: Optional[int] = None


class KnowledgeDirectoryCreate(KnowledgeDirectoryBase):
    pass


class KnowledgeDirectory(KnowledgeDirectoryBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class ArticleBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str
    file_path: str = Field(..., min_length=1, max_length=500)
    product_id: Optional[int] = None
    directory_id: Optional[int] = None


class ArticleCreate(ArticleBase):
    pass


class ArticleUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    product_id: Optional[int] = None
    directory_id: Optional[int] = None


class Article(ArticleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    last_scanned_at: Optional[datetime]

    class Config:
        orm_mode = True


class ArticleReferenceBase(BaseModel):
    source_article_id: int
    target_url: str = Field(..., min_length=1, max_length=500)
    link_text: Optional[str] = None


class ArticleReferenceCreate(ArticleReferenceBase):
    pass


class ArticleReferenceUpdate(BaseModel):
    status: Optional[ReferenceStatus] = None
    failure_reason: Optional[FailureReason] = None
    failure_detail: Optional[str] = None


class ArticleReference(ArticleReferenceBase):
    id: int
    target_article_id: Optional[int]
    reference_count: int
    status: ReferenceStatus
    failure_reason: Optional[FailureReason]
    failure_detail: Optional[str]
    processed_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class HealthReportBase(BaseModel):
    report_type: str = Field(..., min_length=1, max_length=50)


class HealthReportCreate(HealthReportBase):
    total_articles: int = 0
    total_references: int = 0
    invalid_references: int = 0
    deprecated_product_references: int = 0
    broken_links: int = 0
    needs_review_count: int = 0
    report_data: Optional[str] = None
    generated_by: Optional[str] = None


class HealthReport(HealthReportBase):
    id: int
    total_articles: int
    total_references: int
    invalid_references: int
    deprecated_product_references: int
    broken_links: int
    needs_review_count: int
    report_data: Optional[str]
    generated_at: datetime
    generated_by: Optional[str]

    class Config:
        orm_mode = True


class ScanRequest(BaseModel):
    directory_path: Optional[str] = None
    article_ids: Optional[List[int]] = None
    scan_all: bool = False


class ScanResult(BaseModel):
    scanned_count: int
    new_references: int
    updated_references: int


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None
