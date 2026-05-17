import uuid
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, BigInteger, DECIMAL, Text, DateTime, JSON, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import config

Base = declarative_base()

def generate_id():
    return str(uuid.uuid4()).replace('-', '')[:32]

class Sku(Base):
    __tablename__ = 'sku'
    
    sku_id = Column(String(64), primary_key=True, default=generate_id)
    sku_name = Column(String(255), nullable=False)
    category = Column(String(128))
    unit = Column(String(32), default='件')
    spec = Column(String(255))
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class BatchInventory(Base):
    __tablename__ = 'batch_inventory'
    
    batch_id = Column(String(64), primary_key=True, default=generate_id)
    sku_id = Column(String(64), nullable=False)
    batch_no = Column(String(128), nullable=False)
    warehouse_code = Column(String(64), nullable=False)
    warehouse_name = Column(String(128))
    location_code = Column(String(64))
    production_date = Column(DateTime)
    expiry_date = Column(DateTime)
    supplier_code = Column(String(64))
    supplier_name = Column(String(128))
    total_qty = Column(DECIMAL(18, 4), default=0)
    available_qty = Column(DECIMAL(18, 4), default=0)
    frozen_qty = Column(DECIMAL(18, 4), default=0)
    released_qty = Column(DECIMAL(18, 4), default=0)
    quality_status = Column(String(32), default='PENDING')
    inventory_status = Column(String(32), default='AVAILABLE')
    is_locked = Column(Integer, default=0)
    lock_reason = Column(String(255))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    __table_args__ = (
        Index('idx_sku_id', 'sku_id'),
        Index('idx_batch_no', 'batch_no'),
        Index('idx_warehouse_code', 'warehouse_code'),
        Index('idx_inventory_status', 'inventory_status'),
    )

class FreezeReason(Base):
    __tablename__ = 'freeze_reason'
    
    reason_code = Column(String(64), primary_key=True)
    reason_name = Column(String(255), nullable=False)
    reason_type = Column(String(64), nullable=False)
    description = Column(Text)
    is_active = Column(Integer, default=1)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class InventoryFreeze(Base):
    __tablename__ = 'inventory_freeze'
    
    freeze_id = Column(String(64), primary_key=True, default=generate_id)
    freeze_no = Column(String(128), nullable=False, unique=True)
    sku_id = Column(String(64), nullable=False)
    batch_id = Column(String(64), nullable=False)
    batch_no = Column(String(128), nullable=False)
    warehouse_code = Column(String(64), nullable=False)
    reason_code = Column(String(64), nullable=False)
    reason_name = Column(String(255))
    freeze_qty = Column(DECIMAL(18, 4), nullable=False)
    freeze_operator = Column(String(64))
    freeze_time = Column(DateTime)
    freeze_remark = Column(Text)
    evidence_attachments = Column(JSON)
    status = Column(String(32), default='FROZEN')
    release_audit_operator = Column(String(64))
    release_audit_time = Column(DateTime)
    release_audit_remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    __table_args__ = (
        Index('idx_freeze_no', 'freeze_no'),
        Index('idx_sku_id', 'sku_id'),
        Index('idx_batch_id', 'batch_id'),
        Index('idx_status', 'status'),
    )

class ReleaseVoucher(Base):
    __tablename__ = 'release_voucher'
    
    voucher_id = Column(String(64), primary_key=True, default=generate_id)
    voucher_no = Column(String(128), nullable=False, unique=True)
    freeze_id = Column(String(64), nullable=False)
    freeze_no = Column(String(128), nullable=False)
    sku_id = Column(String(64), nullable=False)
    batch_id = Column(String(64), nullable=False)
    release_qty = Column(DECIMAL(18, 4), nullable=False)
    release_type = Column(String(64), nullable=False)
    release_reason = Column(String(255))
    release_operator = Column(String(64))
    release_time = Column(DateTime)
    release_remark = Column(Text)
    evidence_attachments = Column(JSON)
    related_order_no = Column(String(128))
    related_order_type = Column(String(64))
    status = Column(String(32), default='COMPLETED')
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    __table_args__ = (
        Index('idx_voucher_no', 'voucher_no'),
        Index('idx_freeze_id', 'freeze_id'),
        Index('idx_freeze_no', 'freeze_no'),
    )

class InventorySnapshot(Base):
    __tablename__ = 'inventory_snapshot'
    
    snapshot_id = Column(String(64), primary_key=True, default=generate_id)
    batch_id = Column(String(64), nullable=False)
    sku_id = Column(String(64), nullable=False)
    batch_no = Column(String(128), nullable=False)
    warehouse_code = Column(String(64), nullable=False)
    total_qty = Column(DECIMAL(18, 4), default=0)
    available_qty = Column(DECIMAL(18, 4), default=0)
    frozen_qty = Column(DECIMAL(18, 4), default=0)
    released_qty = Column(DECIMAL(18, 4), default=0)
    inventory_status = Column(String(32))
    action_type = Column(String(64), nullable=False)
    action_id = Column(String(64))
    action_no = Column(String(128))
    operator = Column(String(64))
    action_time = Column(DateTime)
    action_remark = Column(Text)
    before_snapshot = Column(JSON)
    after_snapshot = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
    
    __table_args__ = (
        Index('idx_batch_id', 'batch_id'),
        Index('idx_sku_id', 'sku_id'),
        Index('idx_action_type', 'action_type'),
    )

class InventoryConflict(Base):
    __tablename__ = 'inventory_conflict'
    
    conflict_id = Column(String(64), primary_key=True, default=generate_id)
    conflict_no = Column(String(128), nullable=False, unique=True)
    conflict_type = Column(String(64), nullable=False)
    sku_id = Column(String(64), nullable=False)
    batch_id = Column(String(64), nullable=False)
    batch_no = Column(String(128), nullable=False)
    warehouse_code = Column(String(64), nullable=False)
    related_order_no = Column(String(128))
    related_order_type = Column(String(64))
    conflict_qty = Column(DECIMAL(18, 4))
    quality_status = Column(String(32))
    conflict_detail = Column(Text)
    handler = Column(String(64))
    handle_time = Column(DateTime)
    handle_remark = Column(Text)
    handle_result = Column(String(32), default='PENDING')
    status = Column(String(32), default='OPEN')
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    __table_args__ = (
        Index('idx_conflict_no', 'conflict_no'),
        Index('idx_conflict_type', 'conflict_type'),
        Index('idx_sku_id', 'sku_id'),
    )

class ImportExportLog(Base):
    __tablename__ = 'import_export_log'
    
    log_id = Column(String(64), primary_key=True, default=generate_id)
    batch_no = Column(String(128), nullable=False, unique=True)
    operate_type = Column(String(32), nullable=False)
    business_type = Column(String(64), nullable=False)
    file_name = Column(String(255))
    file_path = Column(String(512))
    file_size = Column(BigInteger)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    error_details = Column(JSON)
    operator = Column(String(64))
    operate_time = Column(DateTime)
    status = Column(String(32), default='PROCESSING')
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class OperationHistory(Base):
    __tablename__ = 'operation_history'
    
    history_id = Column(String(64), primary_key=True, default=generate_id)
    business_type = Column(String(64), nullable=False)
    business_id = Column(String(64), nullable=False)
    business_no = Column(String(128))
    action = Column(String(64), nullable=False)
    before_data = Column(JSON)
    after_data = Column(JSON)
    operator = Column(String(64))
    operate_time = Column(DateTime, default=datetime.now)
    remark = Column(Text)

engine = create_engine(config.SQLALCHEMY_DATABASE_URI, echo=config.SQLALCHEMY_ECHO)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    Base.metadata.create_all(bind=engine)
    print("数据库表创建完成！")

if __name__ == '__main__':
    create_tables()
