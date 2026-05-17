from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./exception_orders.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Rider(Base):
    __tablename__ = "riders"
    
    id = Column(Integer, primary_key=True, index=True)
    rider_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    station = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    orders = relationship("Order", back_populates="rider")
    reassignments = relationship("Reassignment", back_populates="rider")

class ExceptionType(Base):
    __tablename__ = "exception_types"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    description = Column(Text)
    need_evidence = Column(Boolean, default=True)
    need_manual_review = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(100), unique=True, index=True, nullable=False)
    rider_id = Column(Integer, ForeignKey("riders.id"))
    customer_address = Column(String(255))
    customer_phone = Column(String(20))
    order_amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    exception_type_id = Column(Integer, ForeignKey("exception_types.id"))
    status = Column(String(50), default="normal")
    exception_time = Column(DateTime)
    
    rider = relationship("Rider", back_populates="orders")
    reassignments = relationship("Reassignment", back_populates="order")
    appeal_materials = relationship("AppealMaterial", back_populates="order")
    arbitration_results = relationship("ArbitrationResult", back_populates="order")

class Reassignment(Base):
    __tablename__ = "reassignments"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    rider_id = Column(Integer, ForeignKey("riders.id"), nullable=False)
    from_rider_id = Column(Integer)
    reason = Column(String(255))
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    processed_by = Column(String(100))
    remark = Column(Text)
    
    order = relationship("Order", back_populates="reassignments")
    rider = relationship("Rider", back_populates="reassignments")

class AppealMaterial(Base):
    __tablename__ = "appeal_materials"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    material_type = Column(String(50), nullable=False)
    file_path = Column(String(255))
    description = Column(Text)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    uploaded_by = Column(String(100))
    is_valid = Column(Boolean, default=True)
    
    order = relationship("Order", back_populates="appeal_materials")

class ArbitrationResult(Base):
    __tablename__ = "arbitration_results"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    result = Column(String(50), nullable=False)
    reason = Column(Text)
    handled_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    need_manual_review = Column(Boolean, default=False)
    review_status = Column(String(50), default="pending")
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    
    order = relationship("Order", back_populates="arbitration_results")

def init_db():
    Base.metadata.create_all(bind=engine)
    
    session = SessionLocal()
    
    if session.query(ExceptionType).count() == 0:
        exception_types = [
            ExceptionType(code="MEAL_SHORTAGE", name="少餐", category="food", need_evidence=True, need_manual_review=False),
            ExceptionType(code="OVERTIME", name="超时", category="time", need_evidence=True, need_manual_review=False),
            ExceptionType(code="REASSIGNMENT", name="改派", category="rider", need_evidence=True, need_manual_review=True),
            ExceptionType(code="DAMAGED", name="餐品破损", category="food", need_evidence=True, need_manual_review=False),
            ExceptionType(code="WRONG_ADDRESS", name="地址错误", category="address", need_evidence=True, need_manual_review=False),
            ExceptionType(code="CUSTOMER_REFUSE", name="客户拒收", category="customer", need_evidence=True, need_manual_review=True),
        ]
        session.add_all(exception_types)
        session.commit()
    
    session.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
