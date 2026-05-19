from datetime import datetime
from typing import Optional, List, Generic, TypeVar, Any
from pydantic import BaseModel, Field
from .enums import ApplicationStatus, ExceptionType


T = TypeVar('T')


class QueryFilter(BaseModel):
    applicant_id: Optional[str] = None
    applicant_name: Optional[str] = None
    department: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    exception_type: Optional[ExceptionType] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    contains_dangerous_goods: Optional[bool] = None
    operator_id: Optional[str] = None
    operator_name: Optional[str] = None


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20


class PaginatedResult(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class SummaryResult(BaseModel):
    total_applications: int = 0
    pending_approvals: int = 0
    approved_applications: int = 0
    rejected_applications: int = 0
    completed_applications: int = 0
    total_outbounds: int = 0
    total_returns: int = 0
    total_inventories: int = 0
    exception_count: int = 0
    dangerous_goods_count: int = 0


class ExportRequest(BaseModel):
    query_filter: QueryFilter
    export_format: str = "xlsx"
    include_summary: bool = True
    include_details: bool = True
