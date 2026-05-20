from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import SessionStatus, DiscrepancyType


class FilmContractBase(BaseModel):
    film_name: str
    film_code: str
    start_date: datetime
    end_date: datetime
    minimum_boxoffice: float = 0
    subsidy_per_ticket: float = 0
    subsidy_daily_cap: float = 0
    subsidy_total_cap: float = 0
    refund_deduction_rate: float = 0.05
    boxoffice_share_rate: float = 0.43


class FilmContractCreate(FilmContractBase):
    pass


class FilmContractResponse(FilmContractBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SessionBase(BaseModel):
    session_code: str
    film_name: str
    film_code: str
    hall_name: str
    show_time: datetime
    end_time: Optional[datetime] = None
    is_cross_day: bool = False
    scheduled_seats: int = 0
    ticket_price: float = 0


class SessionCreate(SessionBase):
    pass


class SessionResponse(SessionBase):
    id: int
    contract_id: Optional[int] = None
    source_file: Optional[str] = None
    imported_at: datetime

    class Config:
        from_attributes = True


class BoxOfficeBase(BaseModel):
    session_code: str
    film_name: str
    film_code: str
    show_time: datetime
    tickets_sold: int = 0
    tickets_refunded: int = 0
    gross_boxoffice: float = 0
    refund_amount: float = 0
    net_boxoffice: float = 0
    service_fee: float = 0


class BoxOfficeCreate(BoxOfficeBase):
    pass


class BoxOfficeResponse(BoxOfficeBase):
    id: int
    contract_id: Optional[int] = None
    source_file: Optional[str] = None
    imported_at: datetime

    class Config:
        from_attributes = True


class ReviewLogResponse(BaseModel):
    id: int
    previous_status: Optional[SessionStatus]
    new_status: SessionStatus
    reviewer: Optional[str]
    notes: Optional[str]
    discrepancy_explanation: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReconciliationRecordResponse(BaseModel):
    id: int
    reconciliation_batch: str
    session_id: int
    boxoffice_id: int
    contract_id: Optional[int] = None
    
    expected_subsidy: float
    actual_subsidy: float
    subsidy_discrepancy: float
    
    expected_min_boxoffice: float
    actual_boxoffice: float
    min_boxoffice_discrepancy: float
    
    refund_deduction: float
    
    total_discrepancy: float
    discrepancy_types: Optional[str]
    discrepancy_explanation: Optional[str]
    
    status: SessionStatus
    reviewer_notes: Optional[str]
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    
    session: Optional[SessionResponse]
    boxoffice: Optional[BoxOfficeResponse]
    review_logs: List[ReviewLogResponse] = []

    class Config:
        from_attributes = True


class ReconciliationSummaryResponse(BaseModel):
    id: int
    reconciliation_batch: str
    total_sessions: int
    matched_sessions: int
    disputed_sessions: int
    approved_sessions: int
    rejected_sessions: int
    
    total_expected_subsidy: float
    total_actual_subsidy: float
    total_subsidy_discrepancy: float
    
    total_expected_min_boxoffice: float
    total_actual_boxoffice: float
    total_min_boxoffice_discrepancy: float
    
    total_refund_deduction: float
    grand_total_discrepancy: float
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewRequest(BaseModel):
    status: SessionStatus
    reviewer: str
    notes: Optional[str] = None
    discrepancy_explanation: Optional[str] = None
    adjust_expected_subsidy: Optional[float] = None
    adjust_actual_subsidy: Optional[float] = None
    adjust_min_boxoffice: Optional[float] = None
    adjust_refund_deduction: Optional[float] = None


class ImportResponse(BaseModel):
    success: bool
    message: str
    imported_count: int
    errors: List[str] = []


class ReconciliationResult(BaseModel):
    batch_id: str
    total_processed: int
    matched: int
    disputed: int
    discrepancies_found: List[str]
