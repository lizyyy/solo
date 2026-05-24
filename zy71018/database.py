from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./battery_declaration.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TimestampMixin:
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BatteryType(Base, TimestampMixin):
    __tablename__ = "battery_types"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    un_code = Column(String(20))
    packing_group = Column(String(10))
    is_lithium = Column(Boolean, default=True)
    watt_hour = Column(String(50))
    weight_per_unit = Column(String(50))
    is_active = Column(Boolean, default=True)
    
    declarations = relationship("Declaration", back_populates="battery_type")


class Carrier(Base, TimestampMixin):
    __tablename__ = "carriers"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    contact_info = Column(Text)
    is_active = Column(Boolean, default=True)
    
    rules = relationship("CarrierRule", back_populates="carrier")
    declarations = relationship("Declaration", back_populates="carrier")


class CarrierRule(Base, TimestampMixin):
    __tablename__ = "carrier_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    carrier_id = Column(Integer, ForeignKey("carriers.id"), nullable=False)
    rule_code = Column(String(50), nullable=False)
    rule_name = Column(String(200), nullable=False)
    description = Column(Text)
    allowed_battery_types = Column(String(500))
    max_watt_hour = Column(String(50))
    max_weight = Column(String(50))
    packaging_requirements = Column(Text)
    effective_date = Column(Date, nullable=False)
    expiry_date = Column(Date)
    is_active = Column(Boolean, default=True)
    
    carrier = relationship("Carrier", back_populates="rules")


class Product(Base, TimestampMixin):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    battery_type_code = Column(String(50), ForeignKey("battery_types.code"))
    battery_quantity = Column(Integer)
    weight = Column(String(50))
    origin_country = Column(String(50))
    hs_code = Column(String(50))
    
    declarations = relationship("DeclarationItem", back_populates="product")


class Declaration(Base, TimestampMixin):
    __tablename__ = "declarations"
    
    id = Column(Integer, primary_key=True, index=True)
    business_no = Column(String(100), unique=True, index=True, nullable=False)
    declaration_no = Column(String(100), unique=True, index=True)
    status = Column(String(50), nullable=False, default="DRAFT")
    warehouse_code = Column(String(50))
    carrier_id = Column(Integer, ForeignKey("carriers.id"))
    battery_type_id = Column(Integer, ForeignKey("battery_types.id"))
    destination_country = Column(String(50))
    total_weight = Column(String(50))
    total_battery_count = Column(Integer)
    applicant = Column(String(100))
    reviewer = Column(String(100))
    review_time = Column(DateTime)
    processor = Column(String(100))
    process_time = Column(DateTime)
    closer = Column(String(100))
    close_time = Column(DateTime)
    remarks = Column(Text)
    
    battery_type = relationship("BatteryType", back_populates="declarations")
    carrier = relationship("Carrier", back_populates="declarations")
    items = relationship("DeclarationItem", back_populates="declaration", cascade="all, delete-orphan")
    return_receipts = relationship("ReturnReceipt", back_populates="declaration")
    audit_trails = relationship("AuditTrail", back_populates="declaration")
    reports = relationship("DeclarationReport", back_populates="declaration")


class DeclarationItem(Base, TimestampMixin):
    __tablename__ = "declaration_items"
    
    id = Column(Integer, primary_key=True, index=True)
    declaration_id = Column(Integer, ForeignKey("declarations.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(String(50))
    battery_info_override = Column(Text)
    
    declaration = relationship("Declaration", back_populates="items")
    product = relationship("Product", back_populates="declarations")


class ReturnReceipt(Base, TimestampMixin):
    __tablename__ = "return_receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    declaration_id = Column(Integer, ForeignKey("declarations.id"), nullable=False)
    receipt_no = Column(String(100), unique=True, index=True, nullable=False)
    return_date = Column(DateTime, default=datetime.utcnow)
    return_reason = Column(String(200), nullable=False)
    return_reason_code = Column(String(50))
    detailed_reason = Column(Text)
    attributed_to = Column(String(100))
    attribution_notes = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100))
    resolved_time = Column(DateTime)
    
    declaration = relationship("Declaration", back_populates="return_receipts")


class AuditTrail(Base, TimestampMixin):
    __tablename__ = "audit_trails"
    
    id = Column(Integer, primary_key=True, index=True)
    declaration_id = Column(Integer, ForeignKey("declarations.id"), nullable=False)
    action = Column(String(50), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50))
    operator = Column(String(100))
    reason = Column(String(500))
    details = Column(Text)
    ip_address = Column(String(50))
    
    declaration = relationship("Declaration", back_populates="audit_trails")


class DeclarationReport(Base, TimestampMixin):
    __tablename__ = "declaration_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    declaration_id = Column(Integer, ForeignKey("declarations.id"), nullable=False)
    report_type = Column(String(50), nullable=False)
    report_content = Column(Text, nullable=False)
    generated_by = Column(String(100))
    generated_at = Column(DateTime, default=datetime.utcnow)
    
    declaration = relationship("Declaration", back_populates="reports")


def init_db():
    Base.metadata.create_all(bind=engine)
