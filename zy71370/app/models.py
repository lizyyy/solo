from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class PaintInventory(Base):
    __tablename__ = "paint_inventory"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    brand = Column(String(50), nullable=False)
    color_space = Column(String(10), default="LAB")
    l_value = Column(Float, nullable=False)
    a_value = Column(Float, nullable=False)
    b_value = Column(Float, nullable=False)
    hex_code = Column(String(7))
    stock = Column(Integer, default=0)
    price = Column(Float, default=0.0)
    purchase_link = Column(String(500))
    is_discontinued = Column(Boolean, default=False)
    data_quality = Column(String(20), default="clean")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    purchase_items = relationship("PurchaseItem", back_populates="paint")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    student_no = Column(String(20), unique=True, index=True)
    budget = Column(Float, default=0.0)
    remaining_budget = Column(Float, default=0.0)
    grade = Column(String(10))
    notes = Column(Text)
    data_quality = Column(String(20), default="clean")
    created_at = Column(DateTime, default=datetime.utcnow)

    purchases = relationship("Purchase", back_populates="student")


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    status = Column(String(20), default="pending")
    total_amount = Column(Float, default=0.0)
    budget_warning = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    student = relationship("Student", back_populates="purchases")
    items = relationship("PurchaseItem", back_populates="purchase")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"))
    paint_id = Column(Integer, ForeignKey("paint_inventory.id"))
    original_paint_id = Column(Integer)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0.0)
    is_substitute = Column(Boolean, default=False)
    color_difference = Column(Float)
    substitute_reason = Column(String(200))

    purchase = relationship("Purchase", back_populates="items")
    paint = relationship("PaintInventory", back_populates="purchase_items")


class SubstitutionRecord(Base):
    __tablename__ = "substitution_records"

    id = Column(Integer, primary_key=True, index=True)
    original_paint_id = Column(Integer, nullable=False)
    original_paint_name = Column(String(100))
    substitute_paint_id = Column(Integer, nullable=False)
    substitute_paint_name = Column(String(100))
    color_difference = Column(Float, nullable=False)
    student_id = Column(Integer)
    status = Column(String(20), default="pending")
    review_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class DataIssue(Base):
    __tablename__ = "data_issues"

    id = Column(Integer, primary_key=True, index=True)
    issue_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="warning")
    table_name = Column(String(50))
    record_id = Column(Integer)
    description = Column(String(500), nullable=False)
    fix_suggestion = Column(String(500))
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(50), nullable=False)
    file_path = Column(String(500))
    generated_by = Column(String(50))
    parameters = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
