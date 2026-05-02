from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
import enum


class AllergenType(enum.Enum):
    NUT = "坚果类"
    DAIRY = "乳制品"
    EGG = "蛋类"
    WHEAT = "小麦"
    SOY = "大豆"
    FISH = "鱼类"
    SHELLFISH = "甲壳类"
    PEANUT = "花生"
    SESAME = "芝麻"
    MUSTARD = "芥末"


class SubstitutionStatus(enum.Enum):
    PENDING = "待审批"
    APPROVED = "已批准"
    REJECTED = "已拒绝"
    IMPLEMENTED = "已执行"


class BatchStatus(enum.Enum):
    ACTIVE = "可用"
    RECALLED = "已召回"
    EXPIRED = "已过期"


class AuditAction(enum.Enum):
    CREATE = "创建"
    UPDATE = "更新"
    DELETE = "删除"
    IMPORT = "导入"
    APPROVE = "审批"
    REJECT = "拒绝"
    BLOCK = "阻断"
    SUBSTITUTE = "替餐"


class Child(Base):
    __tablename__ = "children"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    student_id = Column(String(50), unique=True, index=True, nullable=False)
    class_name = Column(String(50), nullable=False)
    allergens = Column(Text, nullable=True)
    forbidden_foods = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    substitution_requests = relationship("SubstitutionRequest", back_populates="child")


class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    batch_number = Column(String(100), index=True, nullable=False)
    supplier = Column(String(200), nullable=True)
    production_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    allergens = Column(Text, nullable=True)
    ingredients_list = Column(Text, nullable=True)
    status = Column(Enum(BatchStatus), default=BatchStatus.ACTIVE)
    recall_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        {"sqlite_autoincrement": True},
    )


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    menu_date = Column(Date, index=True, nullable=False)
    meal_type = Column(String(50), nullable=False)
    dish_name = Column(String(200), nullable=False)
    ingredients = Column(Text, nullable=True)
    allergens = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SubstitutionRequest(Base):
    __tablename__ = "substitution_requests"

    id = Column(Integer, primary_key=True, index=True)
    child_id = Column(Integer, ForeignKey("children.id"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=True)
    request_date = Column(Date, nullable=False)
    original_dish = Column(String(200), nullable=False)
    substitution_dish = Column(String(200), nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(Enum(SubstitutionStatus), default=SubstitutionStatus.PENDING)
    approver = Column(String(100), nullable=True)
    approval_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    child = relationship("Child", back_populates="substitution_requests")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(Enum(AuditAction), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    operator = Column(String(100), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


class BlockRecord(Base):
    __tablename__ = "block_records"

    id = Column(Integer, primary_key=True, index=True)
    child_id = Column(Integer, ForeignKey("children.id"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    block_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=False)
    allergens_found = Column(Text, nullable=True)
    is_substituted = Column(Boolean, default=False)
    substitution_id = Column(Integer, ForeignKey("substitution_requests.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
