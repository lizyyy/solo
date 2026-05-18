from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Enum, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class WaitlistStatus(str, enum.Enum):
    WAITING = "等待候补"
    CONFIRMING = "确认中"
    CONFIRMED = "已确认转正"
    CANCELLED = "已取消"
    SKIPPED = "已跳过"
    NO_SHOW = "未出席"


class ImportRecordStatus(str, enum.Enum):
    PENDING = "待处理"
    SUCCESS = "导入成功"
    FAILED = "导入失败"
    NEEDS_REVIEW = "需人工审核"
    REVIEWED = "已审核通过"


class BadRowReason(str, enum.Enum):
    MISSING_FIELD = "必填字段缺失"
    INVALID_STATUS = "状态无效"
    STATUS_SKIP = "状态越级"
    DUPLICATE_RECORD = "重复记录"
    INVALID_MEMBER = "会员不存在"
    INVALID_CLASS = "课程不存在"
    ORDER_MISMATCH = "候补顺序不一致"
    QUOTA_ERROR = "名额释放错误"


class ClassSchedule(Base):
    __tablename__ = "class_schedules"

    id = Column(Integer, primary_key=True, index=True)
    class_name = Column(String(100), nullable=False, comment="课程名称")
    class_type = Column(String(50), comment="课程类型：流瑜伽/阴瑜伽/阿斯汤加等")
    instructor = Column(String(50), comment="授课老师")
    studio_room = Column(String(50), comment="教室编号")
    class_date = Column(DateTime, nullable=False, comment="上课日期")
    start_time = Column(String(10), nullable=False, comment="开始时间")
    end_time = Column(String(10), nullable=False, comment="结束时间")
    total_quota = Column(Integer, nullable=False, comment="总名额")
    used_quota = Column(Integer, default=0, comment="已用名额")
    waitlist_count = Column(Integer, default=0, comment="候补人数")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    member_no = Column(String(20), unique=True, nullable=False, comment="会员编号")
    member_name = Column(String(50), nullable=False, comment="会员姓名")
    phone = Column(String(20), comment="联系电话")
    membership_type = Column(String(50), comment="会员卡类型")
    membership_expiry = Column(DateTime, comment="会员到期日")
    created_at = Column(DateTime, server_default=func.now())


class WaitlistRecord(Base):
    __tablename__ = "waitlist_records"

    id = Column(Integer, primary_key=True, index=True)
    waitlist_no = Column(String(30), unique=True, nullable=False, comment="候补编号")
    class_schedule_id = Column(Integer, ForeignKey("class_schedules.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    waitlist_order = Column(Integer, nullable=False, comment="候补顺序号")
    status = Column(Enum(WaitlistStatus), default=WaitlistStatus.WAITING, comment="候补状态")
    apply_time = Column(DateTime, nullable=False, comment="申请候补时间")
    confirm_deadline = Column(DateTime, comment="确认截止时间")
    confirm_time = Column(DateTime, comment="确认时间")
    cancel_time = Column(DateTime, comment="取消时间")
    cancel_reason = Column(Text, comment="取消原因")
    manual_remark = Column(Text, comment="人工备注")
    operator = Column(String(50), comment="操作人")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    class_schedule = relationship("ClassSchedule", backref="waitlist_records")
    member = relationship("Member", backref="waitlist_records")


class ConversionRecord(Base):
    __tablename__ = "conversion_records"

    id = Column(Integer, primary_key=True, index=True)
    conversion_no = Column(String(30), unique=True, nullable=False, comment="转正编号")
    waitlist_id = Column(Integer, ForeignKey("waitlist_records.id"), nullable=False)
    original_status = Column(String(50), comment="原状态")
    target_status = Column(String(50), comment="目标状态")
    converted_quota = Column(Integer, default=1, comment="转正名额")
    quota_source = Column(String(100), comment="名额来源说明")
    conversion_time = Column(DateTime, server_default=func.now())
    operator = Column(String(50), comment="操作人")
    remark = Column(Text, comment="备注")

    waitlist_record = relationship("WaitlistRecord", backref="conversions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(50), nullable=False, comment="操作类型")
    table_name = Column(String(50), comment="表名")
    record_id = Column(Integer, comment="记录ID")
    field_name = Column(String(50), comment="字段名")
    old_value = Column(Text, comment="旧值")
    new_value = Column(Text, comment="新值")
    operator = Column(String(50), comment="操作人")
    operation_time = Column(DateTime, server_default=func.now())
    ip_address = Column(String(50), comment="IP地址")
    user_agent = Column(String(200), comment="用户代理")


class ImportBadRow(Base):
    __tablename__ = "import_bad_rows"

    id = Column(Integer, primary_key=True, index=True)
    import_batch_no = Column(String(50), nullable=False, comment="导入批次号")
    row_number = Column(Integer, nullable=False, comment="行号")
    original_data = Column(Text, nullable=False, comment="原始数据(JSON)")
    error_reason = Column(Enum(BadRowReason), nullable=False, comment="错误原因")
    error_detail = Column(Text, comment="错误详情")
    suggestion = Column(Text, comment="处理建议")
    manual_remark = Column(Text, comment="人工备注")
    status = Column(Enum(ImportRecordStatus), default=ImportRecordStatus.NEEDS_REVIEW)
    reviewed_by = Column(String(50), comment="审核人")
    reviewed_at = Column(DateTime, comment="审核时间")
    created_at = Column(DateTime, server_default=func.now())


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, nullable=False, comment="批次号")
    file_name = Column(String(200), comment="文件名")
    total_count = Column(Integer, default=0, comment="总记录数")
    success_count = Column(Integer, default=0, comment="成功数")
    failed_count = Column(Integer, default=0, comment="失败数")
    review_count = Column(Integer, default=0, comment="待审核数")
    operator = Column(String(50), comment="操作人")
    import_time = Column(DateTime, server_default=func.now())
    status = Column(String(20), default="processing", comment="导入状态")
