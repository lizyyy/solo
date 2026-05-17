from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class RecallStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    NEEDS_REVIEW = "needs_review"
    FAILED = "failed"


class InboundOrder(Base):
    __tablename__ = "inbound_orders"
    
    id = Column(String, primary_key=True)
    batch_number = Column(String, index=True, nullable=False)
    product_code = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, default="pcs")
    supplier = Column(String)
    warehouse = Column(String)
    inbound_date = Column(DateTime, nullable=False)
    status = Column(String, default="received")
    created_at = Column(DateTime, default=datetime.utcnow)
    remarks = Column(Text)
    
    unpack_records = relationship("UnpackRecord", back_populates="inbound_order")


class UnpackRecord(Base):
    __tablename__ = "unpack_records"
    
    id = Column(String, primary_key=True)
    inbound_order_id = Column(String, ForeignKey("inbound_orders.id"), nullable=False)
    parent_batch_number = Column(String, index=True, nullable=False)
    child_batch_number = Column(String, index=True, nullable=False)
    quantity = Column(Float, nullable=False)
    unpack_date = Column(DateTime, nullable=False)
    operator = Column(String)
    warehouse = Column(String)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    inbound_order = relationship("InboundOrder", back_populates="unpack_records")


class OutboundOrder(Base):
    __tablename__ = "outbound_orders"
    
    id = Column(String, primary_key=True)
    batch_number = Column(String, index=True, nullable=False)
    product_code = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, default="pcs")
    customer_id = Column(String, nullable=False)
    customer_name = Column(String, nullable=False)
    warehouse = Column(String)
    outbound_date = Column(DateTime, nullable=False)
    status = Column(String, default="shipped")
    logistics_company = Column(String)
    tracking_number = Column(String)
    destination_address = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    remarks = Column(Text)


class RecallTask(Base):
    __tablename__ = "recall_tasks"
    
    id = Column(String, primary_key=True)
    batch_number = Column(String, index=True, nullable=False)
    reason = Column(Text)
    status = Column(String, default=RecallStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    operator = Column(String)
    requires_manual_review = Column(Boolean, default=False)
    review_notes = Column(Text)
    total_affected_quantity = Column(Float, default=0)
    total_customers_affected = Column(Integer, default=0)
    
    reports = relationship("RecallReport", back_populates="recall_task")


class RecallReport(Base):
    __tablename__ = "recall_reports"
    
    id = Column(String, primary_key=True)
    recall_task_id = Column(String, ForeignKey("recall_tasks.id"), nullable=False)
    batch_number = Column(String, index=True, nullable=False)
    level = Column(Integer, nullable=False)
    path_type = Column(String, nullable=False)
    related_batch_number = Column(String)
    quantity = Column(Float, nullable=False)
    customer_id = Column(String)
    customer_name = Column(String)
    outbound_order_id = Column(String)
    outbound_date = Column(DateTime)
    warehouse = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    recall_task = relationship("RecallTask", back_populates="reports")


class InboundOrderCreate(BaseModel):
    id: str
    batch_number: str
    product_code: str
    product_name: str
    quantity: float
    unit: str = "pcs"
    supplier: Optional[str] = None
    warehouse: Optional[str] = None
    inbound_date: datetime
    status: str = "received"
    remarks: Optional[str] = None


class UnpackRecordCreate(BaseModel):
    id: str
    inbound_order_id: str
    parent_batch_number: str
    child_batch_number: str
    quantity: float
    unpack_date: datetime
    operator: Optional[str] = None
    warehouse: Optional[str] = None
    remarks: Optional[str] = None


class OutboundOrderCreate(BaseModel):
    id: str
    batch_number: str
    product_code: str
    product_name: str
    quantity: float
    unit: str = "pcs"
    customer_id: str
    customer_name: str
    warehouse: Optional[str] = None
    outbound_date: datetime
    status: str = "shipped"
    logistics_company: Optional[str] = None
    tracking_number: Optional[str] = None
    destination_address: Optional[str] = None
    remarks: Optional[str] = None


class RecallTaskCreate(BaseModel):
    batch_number: str
    reason: Optional[str] = None
    operator: Optional[str] = None


class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"
    RESOURCE_NOT_FOUND = "resource_not_found"
    DUPLICATE_ENTRY = "duplicate_entry"


class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[dict] = None


class BatchChainNode(BaseModel):
    batch_number: str
    level: int
    quantity: float
    path_type: str


class CustomerDestination(BaseModel):
    customer_id: str
    customer_name: str
    quantity: float
    outbound_order_ids: List[str]
    latest_outbound_date: Optional[datetime]
    destination_addresses: List[str]


class RecallResult(BaseModel):
    recall_task_id: str
    batch_number: str
    status: RecallStatus
    total_affected_quantity: float
    total_customers_affected: int
    customer_destinations: List[CustomerDestination]
    batch_chain: List[BatchChainNode]
    requires_manual_review: bool
    created_at: datetime
