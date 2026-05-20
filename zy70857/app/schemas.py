from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class CaseBase(BaseModel):
    case_no: str
    case_name: Optional[str] = None
    case_type: Optional[str] = None
    is_secret: bool = False
    secret_level: Optional[str] = None
    create_date: Optional[datetime] = None


class PersonBase(BaseModel):
    person_id: str
    name: str
    department: Optional[str] = None
    position: Optional[str] = None
    permission_level: int = 1
    can_access_secret: bool = False


class BorrowRecordBase(BaseModel):
    record_no: Optional[str] = None
    case_no: str
    person_id: str
    person_name: Optional[str] = None
    borrow_date: datetime
    due_date: Optional[datetime] = None
    return_date: Optional[datetime] = None
    renew_count: int = 0
    action_type: Optional[str] = None


class ImportResultItem(BaseModel):
    record_no: Optional[str] = None
    original_data: Dict[str, Any]
    result_type: str
    rule_code: Optional[str] = None
    rule_name: Optional[str] = None
    message: str
    suggestion: Optional[str] = None


class ImportResponse(BaseModel):
    batch_id: str
    import_time: datetime
    summary: Dict[str, int]
    success_items: List[Dict[str, Any]]
    confirm_items: List[ImportResultItem]
    fail_items: List[ImportResultItem]


class BatchReportResponse(BaseModel):
    batch_id: str
    import_time: datetime
    filename: Optional[str] = None
    import_type: str
    total_records: int
    success_count: int
    confirm_count: int
    fail_count: int
    status: str
    records: List[Dict[str, Any]]


class RecordTraceResponse(BaseModel):
    record_no: str
    batch_id: str
    borrow_record: Dict[str, Any]
    case_info: Optional[Dict[str, Any]] = None
    person_info: Optional[Dict[str, Any]] = None
    check_results: List[Dict[str, Any]]
    suggestions: List[str]


class BatchListResponse(BaseModel):
    batches: List[Dict[str, Any]]
    total: int


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime