from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Wave(Base):
    __tablename__ = "waves"

    id = Column(Integer, primary_key=True, index=True)
    wave_code = Column(String(50), unique=True, index=True, nullable=False)
    status = Column(String(20), default="pending")
    priority = Column(Integer, default=1)
    total_orders = Column(Integer, default=0)
    total_skus = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    remarks = Column(Text)

    orders = relationship("Order", back_populates="wave")
    pick_tasks = relationship("PickTask", back_populates="wave")
    review_diffs = relationship("ReviewDiff", back_populates="wave")
    completion_report = relationship("CompletionReport", back_populates="wave", uselist=False)


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    location_code = Column(String(50), unique=True, index=True, nullable=False)
    aisle = Column(String(20))
    rack = Column(String(20))
    level = Column(Integer)
    position = Column(Integer)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    skus = relationship("SKUStock", back_populates="location")


class SKUStock(Base):
    __tablename__ = "sku_stocks"

    id = Column(Integer, primary_key=True, index=True)
    sku_code = Column(String(50), index=True, nullable=False)
    sku_name = Column(String(200))
    location_id = Column(Integer, ForeignKey("locations.id"))
    quantity = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)

    location = relationship("Location", back_populates="skus")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String(50), unique=True, index=True, nullable=False)
    wave_id = Column(Integer, ForeignKey("waves.id"))
    status = Column(String(20), default="pending")
    is_split = Column(Boolean, default=False)
    parent_order_id = Column(Integer, ForeignKey("orders.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    customer_name = Column(String(100))
    customer_phone = Column(String(20))
    shipping_address = Column(Text)

    wave = relationship("Wave", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")
    parent_order = relationship("Order", remote_side=[id])


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    sku_code = Column(String(50), nullable=False)
    sku_name = Column(String(200))
    ordered_quantity = Column(Integer, nullable=False)
    picked_quantity = Column(Integer, default=0)
    is_shortage = Column(Boolean, default=False)
    shortage_quantity = Column(Integer, default=0)

    order = relationship("Order", back_populates="items")


class PickTask(Base):
    __tablename__ = "pick_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_code = Column(String(50), unique=True, index=True, nullable=False)
    wave_id = Column(Integer, ForeignKey("waves.id"))
    location_id = Column(Integer, ForeignKey("locations.id"))
    sku_code = Column(String(50), nullable=False)
    sku_name = Column(String(200))
    required_quantity = Column(Integer, nullable=False)
    picked_quantity = Column(Integer, default=0)
    status = Column(String(20), default="pending")
    picker = Column(String(50))
    picked_at = Column(DateTime)
    is_shortage = Column(Boolean, default=False)

    wave = relationship("Wave", back_populates="pick_tasks")
    location = relationship("Location")


class ReviewDiff(Base):
    __tablename__ = "review_diffs"

    id = Column(Integer, primary_key=True, index=True)
    diff_code = Column(String(50), unique=True, index=True, nullable=False)
    wave_id = Column(Integer, ForeignKey("waves.id"))
    order_id = Column(Integer, ForeignKey("orders.id"))
    sku_code = Column(String(50), nullable=False)
    expected_quantity = Column(Integer, nullable=False)
    actual_quantity = Column(Integer, nullable=False)
    diff_quantity = Column(Integer, nullable=False)
    diff_type = Column(String(20))
    status = Column(String(20), default="pending")
    handler = Column(String(50))
    handled_at = Column(DateTime)
    remarks = Column(Text)

    wave = relationship("Wave", back_populates="review_diffs")
    order = relationship("Order")


class CompletionReport(Base):
    __tablename__ = "completion_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_code = Column(String(50), unique=True, index=True, nullable=False)
    wave_id = Column(Integer, ForeignKey("waves.id"), unique=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    total_orders = Column(Integer, default=0)
    completed_orders = Column(Integer, default=0)
    split_orders = Column(Integer, default=0)
    total_items = Column(Integer, default=0)
    picked_items = Column(Integer, default=0)
    shortage_items = Column(Integer, default=0)
    review_diffs = Column(Integer, default=0)
    resolved_diffs = Column(Integer, default=0)
    report_content = Column(Text)

    wave = relationship("Wave", back_populates="completion_report")