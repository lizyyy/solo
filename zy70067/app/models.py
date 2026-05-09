from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .config import Base


class OperationStatus(enum.Enum):
    PENDING = "待处理"
    PROCESSING = "处理中"
    SUCCESS = "已完成"
    FAILED = "失败"
    PARTIAL = "部分完成"
    NEEDS_CONFIRM = "待确认"
    CONFIRMED = "已确认"
    CANCELLED = "已取消"


class MaterialCategory(enum.Enum):
    CHEMICAL = "化学试剂"
    EQUIPMENT = "实验器材"
    GLASSWARE = "玻璃仪器"
    CONSUMABLE = "易耗品"
    OTHER = "其他"


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, comment="耗材名称")
    category = Column(Enum(MaterialCategory), nullable=False, comment="耗材类别")
    specification = Column(String(100), comment="规格型号")
    unit = Column(String(20), nullable=False, comment="计量单位")
    safety_level = Column(Integer, default=1, comment="安全等级 1-5")
    description = Column(Text, comment="备注说明")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    inventory = relationship("Inventory", back_populates="material", uselist=False)
    planned_items = relationship("CoursePlanItem", back_populates="material")
    usage_items = relationship("UsageItem", back_populates="material")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), unique=True, nullable=False)
    total_qty = Column(Float, default=0, comment="库存总量")
    available_qty = Column(Float, default=0, comment="可用数量")
    reserved_qty = Column(Float, default=0, comment="已预留数量")
    min_stock = Column(Float, default=0, comment="最小库存量")
    location = Column(String(100), comment="存放位置")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    material = relationship("Material", back_populates="inventory")


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, comment="教师姓名")
    employee_no = Column(String(20), unique=True, nullable=False, comment="工号")
    phone = Column(String(20), comment="联系电话")
    email = Column(String(100), comment="邮箱")
    department = Column(String(100), comment="所属院系")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plans = relationship("CoursePlan", back_populates="teacher")


class ClassInfo(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    class_no = Column(String(20), unique=True, nullable=False, comment="班级编号")
    name = Column(String(100), nullable=False, comment="班级名称")
    student_count = Column(Integer, default=0, comment="学生人数")
    department = Column(String(100), comment="所属院系")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CoursePlan(Base):
    __tablename__ = "course_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_no = Column(String(30), unique=True, nullable=False, comment="计划编号")
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    course_name = Column(String(100), nullable=False, comment="课程名称")
    experiment_name = Column(String(100), nullable=False, comment="实验名称")
    experiment_date = Column(DateTime(timezone=True), nullable=False, comment="实验日期")
    status = Column(Enum(OperationStatus), default=OperationStatus.PENDING, comment="计划状态")
    total_groups = Column(Integer, default=1, comment="实验分组数")
    remarks = Column(Text, comment="备注")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    teacher = relationship("Teacher", back_populates="plans")
    class_info = relationship("ClassInfo")
    planned_items = relationship("CoursePlanItem", back_populates="plan", cascade="all, delete-orphan")
    usage_records = relationship("UsageRecord", back_populates="plan")


class CoursePlanItem(Base):
    __tablename__ = "course_plan_items"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("course_plans.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    qty_per_group = Column(Float, nullable=False, comment="每组用量")
    total_qty = Column(Float, nullable=False, comment="计划总用量")
    notes = Column(Text, comment="使用说明")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("CoursePlan", back_populates="planned_items")
    material = relationship("Material", back_populates="planned_items")


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(30), unique=True, nullable=False, comment="领用单号")
    plan_id = Column(Integer, ForeignKey("course_plans.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    operator_id = Column(Integer, comment="操作人ID")
    operator_name = Column(String(50), comment="操作人姓名")
    status = Column(Enum(OperationStatus), default=OperationStatus.PENDING, comment="领用状态")
    total_used_qty = Column(Float, default=0, comment="实际领用总量")
    total_returned_qty = Column(Float, default=0, comment="实际退料总量")
    total_loss_qty = Column(Float, default=0, comment="损耗总量")
    pickup_time = Column(DateTime(timezone=True), comment="领取时间")
    return_time = Column(DateTime(timezone=True), comment="归还时间")
    teacher_confirmed = Column(Integer, default=0, comment="教师确认状态 0未确认 1已确认")
    confirmed_by = Column(Integer, comment="确认人ID")
    confirmed_at = Column(DateTime(timezone=True), comment="确认时间")
    remarks = Column(Text, comment="备注")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    plan = relationship("CoursePlan", back_populates="usage_records")
    class_info = relationship("ClassInfo")
    teacher = relationship("Teacher")
    usage_items = relationship("UsageItem", back_populates="usage_record", cascade="all, delete-orphan")
    return_items = relationship("ReturnItem", back_populates="usage_record", cascade="all, delete-orphan")
    loss_items = relationship("LossItem", back_populates="usage_record", cascade="all, delete-orphan")
    compensations = relationship("CompensationRecord", back_populates="usage_record")


class UsageItem(Base):
    __tablename__ = "usage_items"

    id = Column(Integer, primary_key=True, index=True)
    usage_record_id = Column(Integer, ForeignKey("usage_records.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    plan_qty = Column(Float, comment="计划领用数量")
    actual_qty = Column(Float, nullable=False, comment="实际领用数量")
    returnable_qty = Column(Float, default=0, comment="可退料数量")
    status = Column(Enum(OperationStatus), default=OperationStatus.SUCCESS, comment="领用状态")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    usage_record = relationship("UsageRecord", back_populates="usage_items")
    material = relationship("Material", back_populates="usage_items")


class ReturnItem(Base):
    __tablename__ = "return_items"

    id = Column(Integer, primary_key=True, index=True)
    usage_record_id = Column(Integer, ForeignKey("usage_records.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    usage_item_id = Column(Integer, ForeignKey("usage_items.id"), nullable=False)
    returned_qty = Column(Float, nullable=False, comment="退料数量")
    status = Column(Enum(OperationStatus), default=OperationStatus.SUCCESS, comment="退料状态")
    condition = Column(String(50), default="完好", comment="耗材状态")
    notes = Column(Text, comment="退料备注")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    usage_record = relationship("UsageRecord", back_populates="return_items")
    material = relationship("Material")
    usage_item = relationship("UsageItem")


class LossItem(Base):
    __tablename__ = "loss_items"

    id = Column(Integer, primary_key=True, index=True)
    usage_record_id = Column(Integer, ForeignKey("usage_records.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    usage_item_id = Column(Integer, ForeignKey("usage_items.id"), nullable=False)
    loss_qty = Column(Float, nullable=False, comment="损耗数量")
    loss_reason = Column(String(200), nullable=False, comment="损耗原因")
    status = Column(Enum(OperationStatus), default=OperationStatus.SUCCESS, comment="损耗登记状态")
    notes = Column(Text, comment="损耗备注")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    usage_record = relationship("UsageRecord", back_populates="loss_items")
    material = relationship("Material")
    usage_item = relationship("UsageItem")


class CompensationRecord(Base):
    __tablename__ = "compensation_records"

    id = Column(Integer, primary_key=True, index=True)
    usage_record_id = Column(Integer, ForeignKey("usage_records.id"), nullable=False)
    operation_type = Column(String(50), nullable=False, comment="操作类型")
    step_name = Column(String(100), nullable=False, comment="步骤名称")
    error_message = Column(Text, comment="错误信息")
    status = Column(Enum(OperationStatus), default=OperationStatus.FAILED, comment="补偿状态")
    retry_count = Column(Integer, default=0, comment="重试次数")
    compensation_data = Column(Text, comment="补偿数据( JSON)")
    last_attempt_at = Column(DateTime(timezone=True), comment="最后尝试时间")
    resolved_at = Column(DateTime(timezone=True), comment="解决时间")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    usage_record = relationship("UsageRecord", back_populates="compensations")


class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    operation_type = Column(String(50), nullable=False, comment="操作类型")
    before_qty = Column(Float, nullable=False, comment="操作前数量")
    change_qty = Column(Float, nullable=False, comment="变更数量")
    after_qty = Column(Float, nullable=False, comment="操作后数量")
    related_type = Column(String(50), comment="关联业务类型")
    related_id = Column(Integer, comment="关联业务ID")
    operator_name = Column(String(50), comment="操作人")
    remarks = Column(Text, comment="备注")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    module = Column(String(50), nullable=False, comment="操作模块")
    action = Column(String(100), nullable=False, comment="操作动作")
    target_id = Column(Integer, comment="目标对象ID")
    operator_name = Column(String(50), comment="操作人")
    detail = Column(Text, comment="操作详情")
    result = Column(String(50), comment="操作结果")
    error_message = Column(Text, comment="错误信息")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
