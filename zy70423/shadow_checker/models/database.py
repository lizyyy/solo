from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

Base = declarative_base()


class CloudResourceOrder(Base):
    __tablename__ = 'cloud_resource_orders'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(100), index=True, comment='批次ID')
    row_number = Column(Integer, comment='原始行号')
    order_no = Column(String(100), comment='申请单号')
    applicant = Column(String(100), comment='申请人')
    department = Column(String(100), comment='部门')
    apply_date = Column(String(50), comment='申请日期')
    resource_type = Column(String(100), comment='资源类型')
    specification = Column(String(500), comment='规格配置')
    quantity = Column(Integer, comment='数量')
    unit_price = Column(Float, comment='单价')
    total_amount = Column(Float, comment='总金额')
    usage_duration = Column(String(100), comment='使用时长')
    purpose = Column(Text, comment='用途说明')
    approval_status = Column(String(50), comment='审批状态')
    approver = Column(String(100), comment='审批人')
    approval_date = Column(String(50), comment='审批日期')
    payment_proof = Column(String(500), comment='支付凭证')
    rollback_evidence = Column(String(500), comment='回滚证据')
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class PurchaseInquiry(Base):
    __tablename__ = 'purchase_inquiries'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(100), index=True, comment='批次ID')
    row_number = Column(Integer, comment='原始行号')
    inquiry_no = Column(String(100), comment='询价单号')
    item_name = Column(String(200), comment='物品名称')
    specification = Column(String(500), comment='规格型号')
    quantity = Column(Integer, comment='数量')
    unit = Column(String(50), comment='单位')
    supplier = Column(String(200), comment='供应商')
    quoted_price = Column(Float, comment='报价')
    currency = Column(String(50), comment='币种')
    quotation_date = Column(String(50), comment='报价日期')
    manual_remark = Column(Text, comment='人工备注')
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class ValidationResult(Base):
    __tablename__ = 'validation_results'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(100), index=True, comment='批次ID')
    record_type = Column(String(50), comment='记录类型')
    record_id = Column(String(100), comment='记录ID')
    row_number = Column(Integer, comment='原始行号')
    check_item = Column(String(200), comment='校验项')
    is_pass = Column(Boolean, comment='是否通过')
    error_message = Column(Text, comment='错误信息')
    detail = Column(Text, comment='详细信息')
    created_at = Column(DateTime, default=datetime.now)


class FailedRecord(Base):
    __tablename__ = 'failed_records'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(100), index=True, comment='批次ID')
    record_type = Column(String(50), comment='记录类型')
    row_number = Column(Integer, comment='原始行号')
    original_data = Column(Text, comment='原始数据JSON')
    failure_reason = Column(Text, comment='失败原因')
    check_item = Column(String(200), comment='校验项')
    is_exported = Column(Boolean, default=False, comment='是否已导出')
    created_at = Column(DateTime, default=datetime.now)


class BatchInfo(Base):
    __tablename__ = 'batch_info'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(100), unique=True, index=True, comment='批次ID')
    submit_time = Column(DateTime, default=datetime.now, comment='提交时间')
    total_records = Column(Integer, comment='总记录数')
    passed_count = Column(Integer, comment='通过数')
    failed_count = Column(Integer, comment='失败数')
    status = Column(String(50), comment='状态')
    data_hash = Column(String(200), comment='数据哈希，用于重复检测')
    previous_batch_id = Column(String(100), comment='前一个批次ID（重复提交时）')
    remark = Column(Text, comment='备注')


DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///shadow_checker.db')
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
