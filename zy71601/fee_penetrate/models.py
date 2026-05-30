from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional, Dict, Any
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Numeric, Boolean, Text,
    ForeignKey, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.ext.declarative import declared_attr

Base = declarative_base()


class ImportStatus(str, Enum):
    NEW = "new"
    SKIP = "skip"
    UPDATE = "update"
    CONFLICT = "conflict"


class FeeType(str, Enum):
    MANAGEMENT = "management"
    CUSTODIAN = "custodian"
    SALES_SERVICE = "sales_service"


class ShareCaliber(str, Enum):
    BEGINNING = "beginning"
    ENDING = "ending"
    AVERAGE = "average"
    DAILY = "daily"


class AccrualMethod(str, Enum):
    DAILY = "daily"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class BaseModel:
    @declared_attr
    def __tablename__(cls):
        return cls.__name__.lower()

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    import_batch_id = Column(Integer, ForeignKey("importbatch.id"), nullable=True)
    memo = Column(Text, nullable=True)


class ImportBatch(Base):
    __tablename__ = "importbatch"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_no = Column(String(50), unique=True, nullable=False)
    source_type = Column(String(50), nullable=False)
    source_file = Column(String(255), nullable=True)
    operator = Column(String(50), nullable=False)
    import_time = Column(DateTime, default=datetime.now, nullable=False)
    total_records = Column(Integer, default=0)
    new_records = Column(Integer, default=0)
    skip_records = Column(Integer, default=0)
    update_records = Column(Integer, default=0)
    conflict_records = Column(Integer, default=0)
    remark = Column(Text, nullable=True)

    changes = relationship("ChangeHistory", back_populates="batch")


class ChangeHistory(Base):
    __tablename__ = "changehistory"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(Integer, ForeignKey("importbatch.id"), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    change_type = Column(String(20), nullable=False)
    change_time = Column(DateTime, default=datetime.now, nullable=False)
    operator = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)

    batch = relationship("ImportBatch", back_populates="changes")

    __table_args__ = (
        Index("idx_entity", "entity_type", "entity_id"),
    )


class Product(BaseModel, Base):
    __tablename__ = "product"

    product_code = Column(String(50), unique=True, nullable=False)
    product_name = Column(String(200), nullable=False)
    product_type = Column(String(50), nullable=True)
    manager = Column(String(100), nullable=True)
    custodian = Column(String(100), nullable=True)
    establish_date = Column(Date, nullable=True)
    expire_date = Column(Date, nullable=True)
    contract_no = Column(String(100), nullable=True)
    contract_version = Column(String(20), nullable=True)
    contract_effective_date = Column(Date, nullable=True)
    risk_level = Column(String(20), nullable=True)

    fee_rules = relationship("FeeRule", back_populates="product")
    nav_flows = relationship("NavFlow", back_populates="product")
    customer_shares = relationship("CustomerShare", back_populates="product")
    fee_accruals = relationship("FeeAccrual", back_populates="product")

    __table_args__ = (
        Index("idx_product_code", "product_code"),
    )


class FeeRule(BaseModel, Base):
    __tablename__ = "feerule"

    product_id = Column(Integer, ForeignKey("product.id"), nullable=False)
    fee_type = Column(String(20), nullable=False)
    rate = Column(Numeric(20, 8), nullable=False)
    effective_date = Column(Date, nullable=False)
    expire_date = Column(Date, nullable=True)
    share_caliber = Column(String(20), nullable=False)
    accrual_method = Column(String(20), nullable=False)
    calculation_basis = Column(String(50), nullable=True)
    payer = Column(String(100), nullable=True)
    receiver = Column(String(100), nullable=True)
    tax_rate = Column(Numeric(10, 6), default=0)
    min_fee = Column(Numeric(20, 2), nullable=True)
    max_fee = Column(Numeric(20, 2), nullable=True)

    product = relationship("Product", back_populates="fee_rules")
    channel_allocations = relationship("ChannelAllocation", back_populates="fee_rule")

    __table_args__ = (
        UniqueConstraint(
            "product_id", "fee_type", "effective_date",
            name="uq_fee_rule_product_type_date"
        ),
    )


class SalesChannel(BaseModel, Base):
    __tablename__ = "saleschannel"

    channel_code = Column(String(50), unique=True, nullable=False)
    channel_name = Column(String(200), nullable=False)
    channel_type = Column(String(50), nullable=True)
    settlement_method = Column(String(50), nullable=True)
    settlement_cycle = Column(String(20), nullable=True)
    contact_person = Column(String(50), nullable=True)
    contact_info = Column(String(100), nullable=True)

    customer_shares = relationship("CustomerShare", back_populates="channel")
    channel_rebates = relationship("ChannelRebate", back_populates="channel")
    allocations = relationship("ChannelAllocation", back_populates="channel")


class NavFlow(BaseModel, Base):
    __tablename__ = "navflow"

    product_id = Column(Integer, ForeignKey("product.id"), nullable=False)
    nav_date = Column(Date, nullable=False)
    unit_nav = Column(Numeric(20, 8), nullable=False)
    cumulative_nav = Column(Numeric(20, 8), nullable=True)
    total_share = Column(Numeric(20, 4), nullable=False)
    total_asset = Column(Numeric(20, 2), nullable=False)
    daily_profit = Column(Numeric(20, 2), nullable=True)
    dividend_amount = Column(Numeric(20, 2), nullable=True)

    product = relationship("Product", back_populates="nav_flows")

    __table_args__ = (
        UniqueConstraint("product_id", "nav_date", name="uq_nav_product_date"),
    )


class CustomerShare(BaseModel, Base):
    __tablename__ = "customershare"

    product_id = Column(Integer, ForeignKey("product.id"), nullable=False)
    channel_id = Column(Integer, ForeignKey("saleschannel.id"), nullable=False)
    customer_id = Column(String(50), nullable=False)
    customer_name = Column(String(200), nullable=True)
    share_date = Column(Date, nullable=False)
    share_amount = Column(Numeric(20, 4), nullable=False)
    share_ratio = Column(Numeric(10, 6), nullable=True)
    cost_value = Column(Numeric(20, 2), nullable=True)
    profit_amount = Column(Numeric(20, 2), nullable=True)

    product = relationship("Product", back_populates="customer_shares")
    channel = relationship("SalesChannel", back_populates="customer_shares")

    __table_args__ = (
        UniqueConstraint(
            "product_id", "channel_id", "customer_id", "share_date",
            name="uq_share_product_channel_customer_date"
        ),
        Index("idx_share_date", "share_date"),
    )


class ChannelRebate(BaseModel, Base):
    __tablename__ = "channelrebate"

    channel_id = Column(Integer, ForeignKey("saleschannel.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("product.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    rebate_rate = Column(Numeric(10, 6), nullable=False)
    rebate_base = Column(String(50), nullable=True)
    rebate_amount = Column(Numeric(20, 2), nullable=True)
    settlement_status = Column(String(20), default="pending")
    settlement_date = Column(Date, nullable=True)
    invoice_no = Column(String(100), nullable=True)

    channel = relationship("SalesChannel", back_populates="channel_rebates")
    product = relationship("Product")

    __table_args__ = (
        UniqueConstraint(
            "channel_id", "product_id", "period_start", "period_end",
            name="uq_rebate_channel_product_period"
        ),
    )


class ChannelAllocation(BaseModel, Base):
    __tablename__ = "channelallocation"

    fee_rule_id = Column(Integer, ForeignKey("feerule.id"), nullable=False)
    channel_id = Column(Integer, ForeignKey("saleschannel.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    allocation_ratio = Column(Numeric(10, 6), nullable=False)
    allocation_amount = Column(Numeric(20, 2), nullable=False)
    allocation_basis = Column(Numeric(20, 4), nullable=True)
    remark = Column(Text, nullable=True)

    fee_rule = relationship("FeeRule", back_populates="channel_allocations")
    channel = relationship("SalesChannel", back_populates="allocations")

    __table_args__ = (
        UniqueConstraint(
            "fee_rule_id", "channel_id", "period_start", "period_end",
            name="uq_allocation_rule_channel_period"
        ),
    )


class FeeAccrual(BaseModel, Base):
    __tablename__ = "feeaccrual"

    product_id = Column(Integer, ForeignKey("product.id"), nullable=False)
    fee_type = Column(String(20), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    accrual_amount = Column(Numeric(20, 2), nullable=False)
    tax_amount = Column(Numeric(20, 2), default=0)
    net_amount = Column(Numeric(20, 2), nullable=False)
    calculation_basis = Column(Numeric(20, 4), nullable=False)
    applied_rate = Column(Numeric(20, 8), nullable=False)
    share_caliber = Column(String(20), nullable=False)
    accrual_method = Column(String(20), nullable=False)
    calculation_log = Column(Text, nullable=True)
    is_manual_adjusted = Column(Boolean, default=False)
    adjustment_reason = Column(Text, nullable=True)

    product = relationship("Product", back_populates="fee_accruals")

    __table_args__ = (
        UniqueConstraint(
            "product_id", "fee_type", "period_start", "period_end",
            name="uq_accrual_product_type_period"
        ),
    )


class AnomalyRecord(BaseModel, Base):
    __tablename__ = "anomalyrecord"

    anomaly_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    description = Column(Text, nullable=False)
    expected_value = Column(Text, nullable=True)
    actual_value = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(50), nullable=True)
    resolution_note = Column(Text, nullable=True)

    __table_args__ = (
        Index("idx_anomaly_entity", "entity_type", "entity_id"),
        Index("idx_anomaly_type", "anomaly_type"),
    )


class AuditReport(BaseModel, Base):
    __tablename__ = "auditreport"

    report_code = Column(String(50), unique=True, nullable=False)
    report_period = Column(String(20), nullable=False)
    report_date = Column(Date, nullable=False)
    operator = Column(String(50), nullable=False)
    reviewer = Column(String(50), nullable=True)
    report_status = Column(String(20), default="draft")
    product_count = Column(Integer, default=0)
    total_management_fee = Column(Numeric(20, 2), default=0)
    total_custodian_fee = Column(Numeric(20, 2), default=0)
    total_sales_service_fee = Column(Numeric(20, 2), default=0)
    total_anomalies = Column(Integer, default=0)
    unresolved_anomalies = Column(Integer, default=0)
    manual_adjustments = Column(Integer, default=0)
    report_content = Column(Text, nullable=True)
    signed_file_path = Column(String(255), nullable=True)

    __table_args__ = (
        Index("idx_report_period", "report_period"),
    )


class Attachment(BaseModel, Base):
    __tablename__ = "attachment"

    attachment_type = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)
    uploaded_by = Column(String(50), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.now, nullable=False)
    description = Column(Text, nullable=True)
    is_verbal_note = Column(Boolean, default=False)
    verbal_note_content = Column(Text, nullable=True)
    verbal_note_from = Column(String(100), nullable=True)

    __table_args__ = (
        Index("idx_attachment_entity", "entity_type", "entity_id"),
    )
