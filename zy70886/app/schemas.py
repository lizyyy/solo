from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.models import ReconciliationStatus, DiscrepancyType, ReviewAction


class ContractApplicationBase(BaseModel):
    application_no: str
    contract_name: str
    contract_amount: Optional[float] = None
    applicant: Optional[str] = None
    department: Optional[str] = None
    application_date: Optional[datetime] = None
    counterparty: Optional[str] = None
    stamp_type: Optional[str] = None
    stamp_count: Optional[int] = 1
    is_urgent: Optional[bool] = False
    remarks: Optional[str] = None


class ContractApplicationCreate(ContractApplicationBase):
    pass


class ContractApplication(ContractApplicationBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StampRecordBase(BaseModel):
    application_no: str
    stamp_date: Optional[datetime] = None
    stamp_operator: Optional[str] = None
    stamp_type: Optional[str] = None
    stamp_count: Optional[int] = 1
    is_supplementary: Optional[bool] = False
    supplementary_reason: Optional[str] = None
    is_withdrawn: Optional[bool] = False
    withdrawal_reason: Optional[str] = None
    remarks: Optional[str] = None


class StampRecordCreate(StampRecordBase):
    pass


class StampRecord(StampRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalRecordBase(BaseModel):
    application_no: str
    approval_level: Optional[str] = None
    approver: Optional[str] = None
    approval_date: Optional[datetime] = None
    approval_result: Optional[str] = None
    approval_opinion: Optional[str] = None
    is_authorised: Optional[bool] = False
    authorisation_scope: Optional[str] = None


class ApprovalRecordCreate(ApprovalRecordBase):
    pass


class ApprovalRecord(ApprovalRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExpressRecordBase(BaseModel):
    application_no: str
    express_company: Optional[str] = None
    tracking_no: Optional[str] = None
    recipient: Optional[str] = None
    recipient_phone: Optional[str] = None
    recipient_address: Optional[str] = None
    send_date: Optional[datetime] = None
    receive_date: Optional[datetime] = None
    is_received: Optional[bool] = False
    remarks: Optional[str] = None


class ExpressRecordCreate(ExpressRecordBase):
    pass


class ExpressRecord(ExpressRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReconciliationResultBase(BaseModel):
    application_no: str
    batch_id: str
    status: ReconciliationStatus = ReconciliationStatus.PENDING
    discrepancy_types: Optional[str] = None
    discrepancy_description: Optional[str] = None
    is_unauthorized_stamp: Optional[bool] = False
    is_supplementary_attachment: Optional[bool] = False
    is_withdrawal_resubmit: Optional[bool] = False
    has_missing_approval: Optional[bool] = False
    has_missing_stamp: Optional[bool] = False
    has_missing_express: Optional[bool] = False
    review_status: Optional[str] = None
    review_action: Optional[str] = None
    reviewer: Optional[str] = None
    review_date: Optional[datetime] = None
    review_opinion: Optional[str] = None
    final_disposition: Optional[str] = None


class ReconciliationResultCreate(ReconciliationResultBase):
    pass


class ReconciliationResult(ReconciliationResultBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReviewHistoryBase(BaseModel):
    reconciliation_result_id: int
    action: ReviewAction
    reviewer: str
    opinion: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    change_summary: Optional[str] = None


class ReviewHistoryCreate(ReviewHistoryBase):
    pass


class ReviewHistory(ReviewHistoryBase):
    id: int
    review_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ReconciliationBatchBase(BaseModel):
    batch_id: str
    batch_name: Optional[str] = None
    created_by: Optional[str] = None


class ReconciliationBatchCreate(ReconciliationBatchBase):
    pass


class ReconciliationBatch(ReconciliationBatchBase):
    id: int
    total_records: int = 0
    matched_count: int = 0
    discrepancy_count: int = 0
    reviewed_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    status: str = "processing"
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReconciliationDetail(BaseModel):
    reconciliation_result: ReconciliationResult
    application: ContractApplication
    stamp_records: List[StampRecord]
    approval_records: List[ApprovalRecord]
    express_records: List[ExpressRecord]
    review_histories: List[ReviewHistory]


class ReviewRequest(BaseModel):
    reconciliation_result_id: int
    action: ReviewAction
    reviewer: str
    opinion: Optional[str] = None
    change_summary: Optional[str] = None


class ReconciliationSummary(BaseModel):
    batch_id: str
    batch_name: Optional[str] = None
    total_records: int
    matched_count: int
    discrepancy_count: int
    reviewed_count: int
    approved_count: int
    rejected_count: int
    pending_count: int
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ImportResponse(BaseModel):
    success: bool
    message: str
    imported_count: int
    errors: List[str] = []
