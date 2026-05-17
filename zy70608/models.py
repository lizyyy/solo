from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Cabinet(Base):
    __tablename__ = "cabinets"

    id = Column(Integer, primary_key=True, index=True)
    cabinet_no = Column(String, unique=True, index=True, nullable=False)
    location = Column(String)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inventory_snapshots = relationship("InventorySnapshot", back_populates="cabinet")
    replenishments = relationship("Replenishment", back_populates="cabinet")
    damage_records = relationship("DamageRecord", back_populates="cabinet")
    expired_products = relationship("ExpiredProduct", back_populates="cabinet")
    settlements = relationship("Settlement", back_populates="cabinet")


class SKU(Base):
    __tablename__ = "skus"

    id = Column(Integer, primary_key=True, index=True)
    sku_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    unit = Column(String, default="件")
    created_at = Column(DateTime, default=datetime.utcnow)


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"), nullable=False)
    snapshot_time = Column(DateTime, default=datetime.utcnow)
    sku_id = Column(Integer, ForeignKey("skus.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    batch_no = Column(String)
    expiry_date = Column(DateTime)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    cabinet = relationship("Cabinet", back_populates="inventory_snapshots")
    sku = relationship("SKU")


class Replenishment(Base):
    __tablename__ = "replenishments"

    id = Column(Integer, primary_key=True, index=True)
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"), nullable=False)
    replenishment_no = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="pending")
    operator_id = Column(String)
    operator_name = Column(String)
    confirmed_at = Column(DateTime)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cabinet = relationship("Cabinet", back_populates="replenishments")
    items = relationship("ReplenishmentItem", back_populates="replenishment")


class ReplenishmentItem(Base):
    __tablename__ = "replenishment_items"

    id = Column(Integer, primary_key=True, index=True)
    replenishment_id = Column(Integer, ForeignKey("replenishments.id"), nullable=False)
    sku_id = Column(Integer, ForeignKey("skus.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    batch_no = Column(String)
    expiry_date = Column(DateTime)
    actual_quantity = Column(Integer)

    replenishment = relationship("Replenishment", back_populates="items")
    sku = relationship("SKU")


class DamageRecord(Base):
    __tablename__ = "damage_records"

    id = Column(Integer, primary_key=True, index=True)
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"), nullable=False)
    damage_no = Column(String, unique=True, index=True, nullable=False)
    sku_id = Column(Integer, ForeignKey("skus.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    damage_type = Column(String)
    reason = Column(Text)
    reporter_id = Column(String)
    reporter_name = Column(String)
    status = Column(String, default="pending")
    confirmed_at = Column(DateTime)
    confirmer_id = Column(String)
    confirmer_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    cabinet = relationship("Cabinet", back_populates="damage_records")
    sku = relationship("SKU")


class ExpiredProduct(Base):
    __tablename__ = "expired_products"

    id = Column(Integer, primary_key=True, index=True)
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"), nullable=False)
    record_no = Column(String, unique=True, index=True, nullable=False)
    sku_id = Column(Integer, ForeignKey("skus.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    batch_no = Column(String)
    expiry_date = Column(DateTime)
    operator_id = Column(String)
    operator_name = Column(String)
    status = Column(String, default="pending")
    confirmed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    cabinet = relationship("Cabinet", back_populates="expired_products")
    sku = relationship("SKU")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, index=True)
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"), nullable=False)
    settlement_no = Column(String, unique=True, index=True, nullable=False)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    status = Column(String, default="draft")
    total_sales = Column(Float, default=0)
    total_damage_loss = Column(Float, default=0)
    total_expired_loss = Column(Float, default=0)
    total_replenishment = Column(Integer, default=0)
    net_amount = Column(Float, default=0)
    created_by = Column(String)
    confirmed_by = Column(String)
    confirmed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cabinet = relationship("Cabinet", back_populates="settlements")
    details = relationship("SettlementDetail", back_populates="settlement")


class SettlementDetail(Base):
    __tablename__ = "settlement_details"

    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(Integer, ForeignKey("settlements.id"), nullable=False)
    sku_id = Column(Integer, ForeignKey("skus.id"), nullable=False)
    opening_inventory = Column(Integer, default=0)
    replenishment_quantity = Column(Integer, default=0)
    sales_quantity = Column(Integer, default=0)
    damage_quantity = Column(Integer, default=0)
    expired_quantity = Column(Integer, default=0)
    closing_inventory = Column(Integer, default=0)
    sales_amount = Column(Float, default=0)
    damage_loss = Column(Float, default=0)
    expired_loss = Column(Float, default=0)

    settlement = relationship("Settlement", back_populates="details")
    sku = relationship("SKU")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, nullable=False)
    ref_no = Column(String)
    original_input = Column(Text)
    operator_id = Column(String)
    operator_name = Column(String)
    conclusion = Column(Text)
    status = Column(String, default="success")
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
