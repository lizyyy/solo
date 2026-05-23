from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Cabinet(Base):
    __tablename__ = "cabinets"

    id = Column(Integer, primary_key=True, index=True)
    cabinet_no = Column(String, unique=True, index=True, nullable=False)
    location = Column(String)
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    skus = relationship("SKUStock", back_populates="cabinet")
    replenishments = relationship("ReplenishmentBatch", back_populates="cabinet")
    settlements = relationship("SettlementSummary", back_populates="cabinet")


class SKUStock(Base):
    __tablename__ = "sku_stocks"

    id = Column(Integer, primary_key=True, index=True)
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"))
    sku_code = Column(String, nullable=False, index=True)
    sku_name = Column(String)
    current_quantity = Column(Integer, default=0)
    unit_price = Column(Float, default=0.0)
    expiration_date = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    cabinet = relationship("Cabinet", back_populates="skus")


class ReplenishmentBatch(Base):
    __tablename__ = "replenishment_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"))
    operator_id = Column(String)
    operator_name = Column(String)
    status = Column(String, default="pending")
    idempotent_key = Column(String, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    cabinet = relationship("Cabinet", back_populates="replenishments")
    items = relationship("ReplenishmentItem", back_populates="batch")
    damages = relationship("DamageRecord", back_populates="batch")
    confirmations = relationship("OperatorConfirmation", back_populates="batch")

    @property
    def cabinet_no(self):
        return self.cabinet.cabinet_no if self.cabinet else None


class ReplenishmentItem(Base):
    __tablename__ = "replenishment_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("replenishment_batches.id"))
    sku_code = Column(String, nullable=False)
    sku_name = Column(String)
    replenish_quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, default=0.0)
    before_quantity = Column(Integer, default=0)
    after_quantity = Column(Integer, default=0)
    expiration_date = Column(DateTime)

    batch = relationship("ReplenishmentBatch", back_populates="items")


class DamageRecord(Base):
    __tablename__ = "damage_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("replenishment_batches.id"))
    sku_code = Column(String, nullable=False)
    sku_name = Column(String)
    damage_type = Column(String)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    reason = Column(String)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("ReplenishmentBatch", back_populates="damages")


class ExpiredRemoval(Base):
    __tablename__ = "expired_removals"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("replenishment_batches.id"))
    sku_code = Column(String, nullable=False)
    sku_name = Column(String)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    expiration_date = Column(DateTime)
    removed_at = Column(DateTime(timezone=True), server_default=func.now())


class OperatorConfirmation(Base):
    __tablename__ = "operator_confirmations"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("replenishment_batches.id"))
    operator_id = Column(String, nullable=False)
    operator_name = Column(String)
    confirm_type = Column(String)
    signature = Column(String)
    remark = Column(String)
    confirmed_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("ReplenishmentBatch", back_populates="confirmations")


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("replenishment_batches.id"))
    cabinet_no = Column(String)
    snapshot_type = Column(String)
    snapshot_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SettlementSummary(Base):
    __tablename__ = "settlement_summaries"

    id = Column(Integer, primary_key=True, index=True)
    settlement_no = Column(String, unique=True, index=True, nullable=False)
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"))
    batch_id = Column(Integer, ForeignKey("replenishment_batches.id"))
    total_replenishment_amount = Column(Float, default=0.0)
    total_damage_amount = Column(Float, default=0.0)
    total_expired_amount = Column(Float, default=0.0)
    final_settlement_amount = Column(Float, default=0.0)
    status = Column(String, default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    cabinet = relationship("Cabinet", back_populates="settlements")
    batch = relationship("ReplenishmentBatch")

    @property
    def cabinet_no(self):
        return self.cabinet.cabinet_no if self.cabinet else None

    @property
    def batch_no(self):
        return self.batch.batch_no if self.batch else None


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, index=True)
    endpoint = Column(String)
    raw_input = Column(Text)
    error_message = Column(String)
    processing_result = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ManualCorrection(Base):
    __tablename__ = "manual_corrections"

    id = Column(Integer, primary_key=True, index=True)
    target_type = Column(String)
    target_id = Column(Integer)
    operator_id = Column(String)
    operator_name = Column(String)
    before_data = Column(Text)
    after_data = Column(Text)
    reason = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
