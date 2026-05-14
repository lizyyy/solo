from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True)
    customer_name = Column(String)
    customer_address = Column(String)
    status = Column(String, default="pending")
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    raw_input = Column(Text)

    order_lines = relationship("OrderLine", back_populates="order")
    fulfillment_records = relationship("FulfillmentRecord", back_populates="order")
    warehouse_change_logs = relationship("WarehouseChangeLog", back_populates="order")


class OrderLine(Base):
    __tablename__ = "order_lines"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    sku = Column(String)
    product_name = Column(String)
    quantity = Column(Integer)
    unit_price = Column(Float)
    original_input = Column(Text)
    processed_result = Column(Text)
    status = Column(String, default="pending")
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    order = relationship("Order", back_populates="order_lines")
    fulfillment_records = relationship("FulfillmentRecord", back_populates="order_line")


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_code = Column(String, unique=True, index=True)
    warehouse_name = Column(String)
    address = Column(String)
    city = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inventories = relationship("Inventory", back_populates="warehouse")


class Inventory(Base):
    __tablename__ = "inventories"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    sku = Column(String, index=True)
    quantity = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    warehouse = relationship("Warehouse", back_populates="inventories")


class FulfillmentRecord(Base):
    __tablename__ = "fulfillment_records"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    order_line_id = Column(Integer, ForeignKey("order_lines.id"))
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    warehouse_code = Column(String)
    warehouse_name = Column(String)
    sku = Column(String)
    quantity = Column(Integer)
    shipping_fee = Column(Float, default=0)
    status = Column(String, default="assigned")
    shipping_rule_result = Column(Text)
    is_final = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))

    order = relationship("Order", back_populates="fulfillment_records")
    order_line = relationship("OrderLine", back_populates="fulfillment_records")


class WarehouseChangeLog(Base):
    __tablename__ = "warehouse_change_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    order_line_id = Column(Integer, ForeignKey("order_lines.id"))
    fulfillment_record_id = Column(Integer, ForeignKey("fulfillment_records.id"))
    old_warehouse_id = Column(Integer)
    old_warehouse_code = Column(String)
    new_warehouse_id = Column(Integer)
    new_warehouse_code = Column(String)
    reason = Column(Text)
    processed_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="warehouse_change_logs")


class ShippingRule(Base):
    __tablename__ = "shipping_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String)
    warehouse_code = Column(String)
    city = Column(String)
    min_weight = Column(Float)
    max_weight = Column(Float)
    shipping_fee = Column(Float)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SplitStrategy(Base):
    __tablename__ = "split_strategies"

    id = Column(Integer, primary_key=True, index=True)
    strategy_name = Column(String, unique=True)
    description = Column(Text)
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    config = Column(Text)
