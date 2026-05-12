from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, Float,
    ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Model(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, index=True)
    model_code = Column(String(50), unique=True, nullable=False, index=True)
    model_name = Column(String(100), nullable=False)
    product_line = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)


class SparePart(Base):
    __tablename__ = "spare_parts"

    id = Column(Integer, primary_key=True, index=True)
    part_code = Column(String(50), unique=True, nullable=False, index=True)
    part_name = Column(String(100), nullable=False)
    model_compatible = Column(JSON, default=list)
    stock_quantity = Column(Integer, default=0)
    safety_stock = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Knowledge(Base):
    __tablename__ = "knowledge"

    id = Column(Integer, primary_key=True, index=True)
    knowledge_code = Column(String(50), unique=True, nullable=False, index=True)
    error_code = Column(String(50), nullable=False, index=True)
    model_codes = Column(JSON, default=list)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    suggested_parts = Column(JSON, default=list)
    effective_date = Column(DateTime, nullable=True)
    expiration_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    success_count = Column(Integer, default=0)
    total_usage = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, nullable=False, index=True)
    model_code = Column(String(50), nullable=False)
    error_code = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=False)
    status = Column(String(30), default="CREATED", index=True)
    engineer_id = Column(String(50), nullable=True)
    current_recommendation_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    histories = relationship("OrderHistory", back_populates="work_order",
                             order_by="OrderHistory.sequence")
    recommendations = relationship("Recommendation", back_populates="work_order")


class OrderHistory(Base):
    __tablename__ = "order_histories"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), ForeignKey("work_orders.order_no"),
                      nullable=False, index=True)
    sequence = Column(Integer, nullable=False)
    status = Column(String(30), nullable=False)
    operator = Column(String(50), nullable=True)
    action = Column(String(200), nullable=False)
    reason = Column(Text, nullable=True)
    data_before = Column(JSON, nullable=True)
    data_after = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    work_order = relationship("WorkOrder", back_populates="histories")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), ForeignKey("work_orders.order_no"),
                      nullable=False, index=True)
    round_no = Column(Integer, nullable=False)
    is_idempotent = Column(Boolean, default=False)
    status = Column(String(30), default="GENERATED", index=True)
    recommended_knowledge = Column(JSON, default=list)
    similar_histories = Column(JSON, default=list)
    part_availability = Column(JSON, default=list)
    feedback = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    work_order = relationship("WorkOrder", back_populates="recommendations")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(Integer, ForeignKey("recommendations.id"),
                               nullable=False, index=True)
    knowledge_code = Column(String(50), nullable=False)
    effectiveness = Column(Integer, default=0)
    comment = Column(Text, nullable=True)
    operator = Column(String(50), nullable=True)
    is_manual_correction = Column(Boolean, default=False)
    manual_diff_before = Column(JSON, nullable=True)
    manual_diff_after = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
