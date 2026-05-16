from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class NotificationStatus(str, enum.Enum):
    PENDING = "pending"
    MATCHED = "matched"
    FILTERED = "filtered"
    DEDUPLICATED = "deduplicated"
    NOTIFIED = "notified"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    MANUALLY_FIXED = "manually_fixed"

class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PAUSED = "paused"

class BloodlineSubscription(Base):
    __tablename__ = "bloodline_subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    team_name = Column(String(100), index=True, nullable=False)
    contact_person = Column(String(100), nullable=False)
    contact_email = Column(String(200), nullable=False)
    field_name_pattern = Column(String(500), nullable=False, comment="字段名称匹配模式，支持通配符*")
    upstream_table_pattern = Column(String(500), nullable=False, comment="上游表匹配模式，支持通配符*")
    downstream_report_pattern = Column(String(500), nullable=False, comment="下游报表匹配模式，支持通配符*")
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE)
    notify_channels = Column(JSON, comment="通知渠道配置，如钉钉、邮件等")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    notifications = relationship("Notification", back_populates="subscription")

class BloodlineRelation(Base):
    __tablename__ = "bloodline_relations"
    
    id = Column(Integer, primary_key=True, index=True)
    field_name = Column(String(200), index=True, nullable=False)
    upstream_table = Column(String(200), index=True, nullable=False)
    downstream_report = Column(String(200), index=True, nullable=False)
    bloodline_path = Column(JSON, comment="完整血缘路径JSON")
    change_type = Column(String(50), comment="变更类型：新增、修改、删除")
    change_description = Column(Text)
    change_time = Column(DateTime(timezone=True), server_default=func.now())
    batch_id = Column(String(100), index=True)
    
    notifications = relationship("Notification", back_populates="bloodline_relation")

class NotificationBatch(Base):
    __tablename__ = "notification_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True, nullable=False)
    total_count = Column(Integer, default=0)
    matched_count = Column(Integer, default=0)
    filtered_count = Column(Integer, default=0)
    notified_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(String(50), default="processing")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("bloodline_subscriptions.id"))
    bloodline_relation_id = Column(Integer, ForeignKey("bloodline_relations.id"))
    batch_id = Column(String(100), index=True)
    team_name = Column(String(100), index=True)
    status = Column(Enum(NotificationStatus), default=NotificationStatus.PENDING, index=True)
    match_reason = Column(String(500), comment="匹配原因")
    filter_reason = Column(String(500), comment="过滤原因")
    deduplication_key = Column(String(300), index=True, comment="去重键")
    notified_at = Column(DateTime(timezone=True))
    confirmed_at = Column(DateTime(timezone=True))
    confirmed_by = Column(String(100))
    confirm_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    subscription = relationship("BloodlineSubscription", back_populates="notifications")
    bloodline_relation = relationship("BloodlineRelation", back_populates="notifications")
    failure_record = relationship("FailureRecord", back_populates="notification", uselist=False)

class FailureRecord(Base):
    __tablename__ = "failure_records"
    
    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, ForeignKey("notifications.id"), unique=True)
    original_input = Column(JSON, nullable=False, comment="原始输入数据")
    processing_rules = Column(JSON, comment="处理依据规则")
    error_message = Column(Text, nullable=False)
    error_stack = Column(Text)
    final_conclusion = Column(Text)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    notification = relationship("Notification", back_populates="failure_record")

class ImpactReport(Base):
    __tablename__ = "impact_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(String(100), index=True)
    team_name = Column(String(100), index=True)
    report_type = Column(String(50), comment="报告类型：团队、全量、自定义")
    report_content = Column(JSON, nullable=False)
    generated_by = Column(String(100))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    exported_count = Column(Integer, default=0)
