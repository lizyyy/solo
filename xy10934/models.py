from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Wave(Base):
    __tablename__ = "waves"

    id = Column(Integer, primary_key=True, index=True)
    wave_code = Column(String(50), unique=True, index=True, nullable=False)
    status = Column(String(20), default="pending", index=True)
    priority = Column(Integer, default=1)
    total_orders = Column(Integer, default=0)
    total_skus = Column(Integer, default=0)
    total_qty = Column(Integer, default=0)
    picked_qty = Column(Integer, default=0)
    reviewed_qty = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(50), nullable=True)
    remarks = Column(Text, nullable=True)

    orders = relationship("Order", back_populates="wave")
    pick_tasks = relationship("PickTask", back_populates="wave")
    review_diffs = relationship("ReviewDiff", back_populates="wave")
    completion_report = relationship("CompletionReport", back_populates="wave", uselist=False)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    wave_id = Column(Integer, ForeignKey("waves.id"), nullable=True)
    status = Column(String(20), default="pending", index=True)
    customer = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    total_qty = Column(Integer, default=0)
    total_amount = Column(Float, default=0)
    is_split = Column(Boolean, default=False)
    parent_order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    split_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    wave = relationship("Wave", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order")
    pick_tasks = relationship("PickTask", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    sku = Column(String(50), nullable=False, index=True)
    sku_name = Column(String(200), nullable=True)
    qty = Column(Integer, default=1)
    picked_qty = Column(Integer, default=0)
    reviewed_qty = Column(Integer, default=0)
    price = Column(Float, default=0)
    location_code = Column(String(50), nullable=True)
    is_out_of_stock = Column(Boolean, default=False)

    order = relationship("Order", back_populates="order_items")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    location_code = Column(String(50), unique=True, index=True, nullable=False)
    zone = Column(String(50), nullable=True)
    aisle = Column(String(50), nullable=True)
    shelf = Column(String(50), nullable=True)
    level = Column(String(50), nullable=True)
    position = Column(String(50), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    sku = Column(String(50), nullable=True, index=True)
    sku_name = Column(String(200), nullable=True)
    stock_qty = Column(Integer, default=0)
    reserved_qty = Column(Integer, default=0)


class PickTask(Base):
    __tablename__ = "pick_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_code = Column(String(50), unique=True, index=True, nullable=False)
    wave_id = Column(Integer, ForeignKey("waves.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    sku = Column(String(50), nullable=False, index=True)
    sku_name = Column(String(200), nullable=True)
    location_code = Column(String(50), nullable=False)
    required_qty = Column(Integer, default=1)
    picked_qty = Column(Integer, default=0)
    status = Column(String(20), default="pending", index=True)
    picker = Column(String(50), nullable=True)
    picked_at = Column(DateTime(timezone=True), nullable=True)
    is_split = Column(Boolean, default=False)
    split_from_task_id = Column(Integer, ForeignKey("pick_tasks.id"), nullable=True)
    split_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    wave = relationship("Wave", back_populates="pick_tasks")
    order = relationship("Order", back_populates="pick_tasks")


class ReviewDiff(Base):
    __tablename__ = "review_diffs"

    id = Column(Integer, primary_key=True, index=True)
    diff_code = Column(String(50), unique=True, index=True, nullable=False)
    wave_id = Column(Integer, ForeignKey("waves.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    pick_task_id = Column(Integer, ForeignKey("pick_tasks.id"), nullable=False)
    sku = Column(String(50), nullable=False)
    expected_qty = Column(Integer, default=0)
    actual_qty = Column(Integer, default=0)
    diff_qty = Column(Integer, default=0)
    diff_type = Column(String(50), nullable=False)
    status = Column(String(20), default="pending", index=True)
    reviewer = Column(String(50), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolver = Column(String(50), nullable=True)
    resolution = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)

    wave = relationship("Wave", back_populates="review_diffs")


class CompletionReport(Base):
    __tablename__ = "completion_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_code = Column(String(50), unique=True, index=True, nullable=False)
    wave_id = Column(Integer, ForeignKey("waves.id"), nullable=False, unique=True)
    total_orders = Column(Integer, default=0)
    completed_orders = Column(Integer, default=0)
    total_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    total_qty = Column(Integer, default=0)
    picked_qty = Column(Integer, default=0)
    reviewed_qty = Column(Integer, default=0)
    diff_count = Column(Integer, default=0)
    resolved_diff_count = Column(Integer, default=0)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, default=0)
    generated_by = Column(String(50), nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    remarks = Column(Text, nullable=True)

    wave = relationship("Wave", back_populates="completion_report")


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    exception_code = Column(String(50), unique=True, index=True, nullable=False)
    wave_id = Column(Integer, ForeignKey("waves.id"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    pick_task_id = Column(Integer, ForeignKey("pick_tasks.id"), nullable=True)
    operation = Column(String(100), nullable=False)
    input_data = Column(Text, nullable=False)
    error_message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)
    handled_by = Column(String(50), nullable=True)
    handled_at = Column(DateTime(timezone=True), nullable=True)
    is_handled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    remarks = Column(Text, nullable=True)
