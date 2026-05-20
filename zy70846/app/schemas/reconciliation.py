from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from .common import ReconciliationStatus, DiscrepancyType, ReviewAction


class DiscrepancyDetail(BaseModel):
    id: str
    sku: str
    sku_name: str
    discrepancy_type: DiscrepancyType
    discrepancy_qty: int
    discrepancy_value: float
    
    inventory_qty: int
    sales_qty: int
    replenish_qty: int
    expected_qty: int
    actual_qty: int
    
    explanation: str = ""
    source_records: List[str] = []
    is_sku_alias: bool = False
    is_expiring_soon: bool = False
    expiry_date: Optional[date] = None
    
    is_resolved: bool = False
    review_action: Optional[ReviewAction] = None
    reviewer: Optional[str] = None
    review_remark: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class ReconciliationSummary(BaseModel):
    total_skus: int = 0
    matched_skus: int = 0
    discrepant_skus: int = 0
    resolved_skus: int = 0
    
    total_inventory_qty: int = 0
    total_sales_qty: int = 0
    total_replenish_qty: int = 0
    expected_inventory: int = 0
    actual_inventory: int = 0
    
    total_discrepancy_qty: int = 0
    total_discrepancy_value: float = 0.0
    
    overstock_qty: int = 0
    understock_qty: int = 0
    expiring_skus: int = 0
    alias_skus: int = 0


class ReconciliationRecord(BaseModel):
    id: str
    store_id: str
    store_name: str
    reconciliation_date: date
    operator: str
    
    inventory_record_id: str
    sales_record_id: str
    replenishment_record_id: str
    
    status: ReconciliationStatus = ReconciliationStatus.PENDING
    summary: ReconciliationSummary = Field(default_factory=ReconciliationSummary)
    discrepancies: List[DiscrepancyDetail] = Field(default_factory=list)
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    
    review_history: List[Dict[str, Any]] = Field(default_factory=list)
    remark: Optional[str] = None
