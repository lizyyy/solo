from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    DECIMAL,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class HazardLevel(str, Enum):
    LOW = "低危"
    MEDIUM = "中危"
    HIGH = "高危"
    EXTREME = "剧毒"


class StorageGroup(str, Enum):
    ACID = "酸类"
    BASE = "碱类"
    OXIDIZER = "氧化剂"
    REDUCER = "还原剂"
    ORGANIC = "有机物"
    METAL = "金属"
    CYANIDE = "氰化物"
    FLAMMABLE = "易燃物"
    OTHER = "其他"


class UsageStatus(str, Enum):
    PENDING = "待审批"
    APPROVED = "已批准"
    REJECTED = "已拒绝"
    IN_USE = "领用中"
    RETURNED = "已归还"
    DISPOSED = "已废弃"


class UserRole(str, Enum):
    TEACHER = "教师"
    LAB_ADMIN = "库管"
    ADMIN = "管理员"


class Reagent(Base):
    __tablename__ = "reagents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="试剂名称")
    cas_number: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, comment="CAS号")
    english_name: Mapped[Optional[str]] = mapped_column(String(200), comment="英文名称")
    molecular_formula: Mapped[Optional[str]] = mapped_column(String(100), comment="分子式")
    molecular_weight: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(10, 4), comment="分子量")
    hazard_level: Mapped[HazardLevel] = mapped_column(Enum(HazardLevel), nullable=False, comment="危险等级")
    storage_group: Mapped[StorageGroup] = mapped_column(Enum(StorageGroup), nullable=False, comment="储存分组")
    cabinet_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="储柜分类")
    min_authorization_level: Mapped[int] = mapped_column(default=1, comment="最低授权等级")
    safety_info: Mapped[Optional[str]] = mapped_column(Text, comment="安全信息")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    batches: Mapped[list["Batch"]] = relationship("Batch", back_populates="reagent")

    __table_args__ = (
        Index("idx_reagent_cas", "cas_number"),
        Index("idx_reagent_hazard", "hazard_level"),
    )


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reagent_id: Mapped[int] = mapped_column(ForeignKey("reagents.id", ondelete="CASCADE"), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, comment="批号")
    manufacturer: Mapped[Optional[str]] = mapped_column(String(200), comment="生产厂家")
    purity: Mapped[Optional[str]] = mapped_column(String(50), comment="纯度")
    concentration: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(10, 4), comment="浓度值")
    concentration_unit: Mapped[str] = mapped_column(String(20), comment="浓度单位")
    package_unit: Mapped[str] = mapped_column(String(20), default="ml", comment="包装单位")
    initial_quantity: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), nullable=False, comment="初始数量")
    current_quantity: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), nullable=False, comment="当前库存")
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, comment="有效期")
    production_date: Mapped[Optional[date]] = mapped_column(Date, comment="生产日期")
    storage_location: Mapped[Optional[str]] = mapped_column(String(100), comment="存放位置")
    cabinet_number: Mapped[Optional[str]] = mapped_column(String(50), comment="储柜编号")
    is_active: Mapped[bool] = mapped_column(default=True, comment="是否可用")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    reagent: Mapped["Reagent"] = relationship("Reagent", back_populates="batches")
    usage_items: Mapped[list["UsageItem"]] = relationship("UsageItem", back_populates="batch")

    __table_args__ = (
        Index("idx_batch_number", "batch_number"),
        Index("idx_batch_expiry", "expiry_date"),
        Index("idx_batch_reagent", "reagent_id"),
    )


class CourseUsage(Base):
    __tablename__ = "course_usages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usage_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="领用单号")
    course_name: Mapped[str] = mapped_column(String(200), nullable=False, comment="课程名称")
    teacher_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="教师姓名")
    teacher_id: Mapped[str] = mapped_column(String(50), nullable=False, comment="教师工号")
    class_name: Mapped[Optional[str]] = mapped_column(String(100), comment="班级")
    student_count: Mapped[int] = mapped_column(default=0, comment="学生人数")
    experiment_date: Mapped[date] = mapped_column(Date, nullable=False, comment="实验日期")
    status: Mapped[UsageStatus] = mapped_column(Enum(UsageStatus), default=UsageStatus.PENDING, comment="状态")
    approved_by: Mapped[Optional[str]] = mapped_column(String(100), comment="审批人")
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, comment="审批时间")
    waste_destination: Mapped[Optional[str]] = mapped_column(String(100), comment="废液去向")
    remarks: Mapped[Optional[str]] = mapped_column(Text, comment="备注")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    items: Mapped[list["UsageItem"]] = relationship("UsageItem", back_populates="course_usage")
    return_records: Mapped[list["ReturnRecord"]] = relationship("ReturnRecord", back_populates="course_usage")

    __table_args__ = (
        Index("idx_usage_number", "usage_number"),
        Index("idx_usage_teacher", "teacher_id"),
        Index("idx_usage_status", "status"),
        Index("idx_usage_date", "experiment_date"),
    )


class UsageItem(Base):
    __tablename__ = "usage_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    course_usage_id: Mapped[int] = mapped_column(ForeignKey("course_usages.id", ondelete="CASCADE"), nullable=False)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False)
    requested_quantity: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), nullable=False, comment="申请数量")
    approved_quantity: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(12, 4), comment="批准数量")
    issued_quantity: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(12, 4), comment="实际发放数量")
    returned_quantity: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), default=0, comment="已归还数量")
    waste_quantity: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), default=0, comment="废弃数量")
    unit: Mapped[str] = mapped_column(String(20), default="ml", comment="单位")
    remarks: Mapped[Optional[str]] = mapped_column(Text, comment="备注")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    course_usage: Mapped["CourseUsage"] = relationship("CourseUsage", back_populates="items")
    batch: Mapped["Batch"] = relationship("Batch", back_populates="usage_items")


class ReturnRecord(Base):
    __tablename__ = "return_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    course_usage_id: Mapped[int] = mapped_column(ForeignKey("course_usages.id", ondelete="CASCADE"), nullable=False)
    return_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="归还单号")
    return_type: Mapped[str] = mapped_column(String(20), default="归还", comment="类型：归还/废弃")
    handler: Mapped[str] = mapped_column(String(100), nullable=False, comment="处理人")
    total_returned_quantity: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), default=0, comment="总归还数量")
    total_waste_quantity: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), default=0, comment="总废弃数量")
    waste_destination: Mapped[Optional[str]] = mapped_column(String(100), comment="废液去向")
    container_status: Mapped[Optional[str]] = mapped_column(String(200), comment="容器状态")
    remarks: Mapped[Optional[str]] = mapped_column(Text, comment="备注")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    course_usage: Mapped["CourseUsage"] = relationship("CourseUsage", back_populates="return_records")
    items: Mapped[list["ReturnItem"]] = relationship("ReturnItem", back_populates="return_record")


class ReturnItem(Base):
    __tablename__ = "return_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    return_record_id: Mapped[int] = mapped_column(ForeignKey("return_records.id", ondelete="CASCADE"), nullable=False)
    usage_item_id: Mapped[int] = mapped_column(ForeignKey("usage_items.id", ondelete="RESTRICT"), nullable=False)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False)
    returned_quantity: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), default=0, comment="归还数量")
    waste_quantity: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), default=0, comment="废弃数量")
    unit: Mapped[str] = mapped_column(String(20), default="ml", comment="单位")
    condition: Mapped[Optional[str]] = mapped_column(String(100), comment="状况")
    remarks: Mapped[Optional[str]] = mapped_column(Text, comment="备注")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    return_record: Mapped["ReturnRecord"] = relationship("ReturnRecord", back_populates="items")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False, comment="操作类型")
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="资源类型")
    resource_id: Mapped[Optional[int]] = mapped_column(comment="资源ID")
    user_id: Mapped[Optional[str]] = mapped_column(String(50), comment="用户ID")
    user_name: Mapped[Optional[str]] = mapped_column(String(100), comment="用户名")
    details: Mapped[Optional[str]] = mapped_column(Text, comment="详细信息(JSON)")
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), comment="IP地址")
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), comment="用户代理")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_audit_action", "action"),
        Index("idx_audit_resource", "resource_type", "resource_id"),
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_time", "created_at"),
    )
