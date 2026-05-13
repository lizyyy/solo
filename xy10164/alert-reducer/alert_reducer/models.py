from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()

class Alert(Base):
    """告警表"""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(String(255), unique=True, nullable=False)
    
    # 告警基本信息
    alertname = Column(String(255), nullable=False)
    severity = Column(String(50), nullable=False)
    job = Column(String(255))
    instance = Column(String(255))
    summary = Column(Text)
    description = Column(Text)
    labels_json = Column(Text)  # 存储完整的标签JSON
    
    # 时间信息
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime)
    
    # 处理状态
    status = Column(String(50), default="pending")  # pending, merged, suppressed, escalated, resolved
    batch_id = Column(Integer, ForeignKey("process_batches.id"))
    
    # 关联
    merged_alert_id = Column(Integer, ForeignKey("merged_alerts.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MergedAlert(Base):
    """合并后的告警"""
    __tablename__ = "merged_alerts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    merge_key = Column(String(255), nullable=False)
    
    # 合并信息
    alert_count = Column(Integer, default=0)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime)
    
    # 告警信息（从合并的告警中提取）
    severity = Column(String(50))  # 合并告警的优先级
    alertname = Column(String(255))  # 合并告警的名称
    
    # 状态
    status = Column(String(50), default="active")  # active, escalated, resolved
    is_escalated = Column(Boolean, default=False)
    
    # 关联
    batch_id = Column(Integer, ForeignKey("process_batches.id"))
    alerts = relationship("Alert", backref="merged_alert")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SuppressedAlert(Base):
    """被抑制的告警"""
    __tablename__ = "suppressed_alerts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    
    # 抑制信息
    rule_id = Column(String(255), nullable=False)
    rule_name = Column(String(255))
    reason = Column(Text)
    
    # 关联
    batch_id = Column(Integer, ForeignKey("process_batches.id"))
    
    created_at = Column(DateTime, default=datetime.utcnow)


class EscalatedAlert(Base):
    """升级的告警"""
    __tablename__ = "escalated_alerts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 可以是单个告警或合并告警
    alert_id = Column(Integer, ForeignKey("alerts.id"))
    merged_alert_id = Column(Integer, ForeignKey("merged_alerts.id"))
    
    # 升级信息
    strategy_id = Column(String(255), nullable=False)
    strategy_name = Column(String(255))
    escalation_level = Column(String(50))  # critical, high, medium
    notify_list = Column(Text)  # JSON存储通知列表
    
    # 关联
    batch_id = Column(Integer, ForeignKey("process_batches.id"))
    
    created_at = Column(DateTime, default=datetime.utcnow)


class ProcessBatch(Base):
    """处理批次"""
    __tablename__ = "process_batches"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_uuid = Column(String(255), unique=True, nullable=False)
    
    # 处理信息
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    status = Column(String(50), default="running")  # running, completed, failed
    
    # 统计信息
    total_alerts = Column(Integer, default=0)
    merged_alerts = Column(Integer, default=0)
    suppressed_alerts = Column(Integer, default=0)
    escalated_alerts = Column(Integer, default=0)
    
    # 错误信息
    error_message = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class FailureLog(Base):
    """失败日志"""
    __tablename__ = "failure_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 失败信息
    operation = Column(String(255), nullable=False)  # import, process, query, etc.
    error_type = Column(String(255))
    error_message = Column(Text, nullable=False)
    stack_trace = Column(Text)
    
    # 关联
    batch_id = Column(Integer, ForeignKey("process_batches.id"))
    alert_id = Column(Integer, ForeignKey("alerts.id"))
    
    # 上下文
    context_json = Column(Text)  # JSON存储上下文信息
    
    created_at = Column(DateTime, default=datetime.utcnow)


class DutyHistory(Base):
    """值班历史"""
    __tablename__ = "duty_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 值班信息
    duty_date = Column(DateTime, nullable=False)
    oncall_name = Column(String(255))
    shift = Column(String(50))  # day, night
    
    # 统计
    total_alerts = Column(Integer, default=0)
    escalated_alerts = Column(Integer, default=0)
    response_time_avg = Column(Integer)  # 平均响应时间（秒）
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db(db_path="sqlite:///alerts.db"):
    """初始化数据库"""
    engine = create_engine(db_path)
    Base.metadata.create_all(engine)
    return engine


def get_session(engine):
    """获取数据库会话"""
    Session = sessionmaker(bind=engine)
    return Session()
