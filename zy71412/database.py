from sqlalchemy import create_engine, Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./collateral_reassessment.db"

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


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    material_type = Column(String(50), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False)
    uploaded_by = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.now)
    source = Column(String(255))
    remark = Column(Text)

    collateral_versions = relationship("CollateralVersion", back_populates="source_material")
    credit_contracts = relationship("CreditContract", back_populates="source_material")
    triggered_warnings = relationship("Warning", back_populates="trigger_material")


class Collateral(Base):
    __tablename__ = "collaterals"

    id = Column(Integer, primary_key=True, index=True)
    collateral_no = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    collateral_type = Column(String(50))
    address = Column(Text)
    owner = Column(String(255))
    id_card = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)

    versions = relationship("CollateralVersion", back_populates="collateral", order_by="CollateralVersion.version_no")
    occupancies = relationship("CreditOccupancy", back_populates="collateral")


class CollateralVersion(Base):
    __tablename__ = "collateral_versions"

    id = Column(Integer, primary_key=True, index=True)
    collateral_id = Column(Integer, ForeignKey("collaterals.id"), nullable=False)
    version_no = Column(Integer, nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"))
    appraised_value = Column(Float, nullable=False)
    appraisal_date = Column(Date, nullable=False)
    appraisal_expiry_date = Column(Date, nullable=False)
    mortgage_rate = Column(Float, nullable=False)
    appraiser = Column(String(255))
    appraisal_report_no = Column(String(100))
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True)

    collateral = relationship("Collateral", back_populates="versions")
    source_material = relationship("Material", back_populates="collateral_versions")
    occupancies = relationship("CreditOccupancy", back_populates="collateral_version")


class CreditContract(Base):
    __tablename__ = "credit_contracts"

    id = Column(Integer, primary_key=True, index=True)
    contract_no = Column(String(50), unique=True, nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"))
    borrower = Column(String(255), nullable=False)
    borrower_id_card = Column(String(50))
    credit_amount = Column(Float, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    bank = Column(String(255))
    account_manager = Column(String(100))
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    source_material = relationship("Material", back_populates="credit_contracts")
    occupancies = relationship("CreditOccupancy", back_populates="contract")


class CreditOccupancy(Base):
    __tablename__ = "credit_occupancies"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("credit_contracts.id"), nullable=False)
    collateral_id = Column(Integer, ForeignKey("collaterals.id"), nullable=False)
    collateral_version_id = Column(Integer, ForeignKey("collateral_versions.id"), nullable=False)
    occupancy_amount = Column(Float, nullable=False)
    occupancy_date = Column(Date, nullable=False)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True)

    contract = relationship("CreditContract", back_populates="occupancies")
    collateral = relationship("Collateral", back_populates="occupancies")
    collateral_version = relationship("CollateralVersion", back_populates="occupancies")


class Reassessment(Base):
    __tablename__ = "reassessments"

    id = Column(Integer, primary_key=True, index=True)
    reassessment_no = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(20), default="pending")
    triggered_by = Column(String(100))
    handler = Column(String(100))
    reviewer = Column(String(100))
    review_opinion = Column(Text)
    review_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    processed_at = Column(DateTime)

    tasks = relationship("ReassessmentTask", back_populates="reassessment")


class ReassessmentTask(Base):
    __tablename__ = "reassessment_tasks"

    id = Column(Integer, primary_key=True, index=True)
    reassessment_id = Column(Integer, ForeignKey("reassessments.id"), nullable=False)
    collateral_id = Column(Integer, ForeignKey("collaterals.id"), nullable=False)
    status = Column(String(20), default="pending")
    current_mortgage_rate = Column(Float)
    max_allowed_rate = Column(Float, default=0.7)
    calculated_balance = Column(Float)
    latest_appraised_value = Column(Float)
    remark = Column(Text)
    processed_at = Column(DateTime)

    reassessment = relationship("Reassessment", back_populates="tasks")
    collateral = relationship("Collateral")
    warnings = relationship("Warning", back_populates="task")


class Warning(Base):
    __tablename__ = "warnings"

    id = Column(Integer, primary_key=True, index=True)
    warning_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="error")
    task_id = Column(Integer, ForeignKey("reassessment_tasks.id"))
    material_id = Column(Integer, ForeignKey("materials.id"))
    collateral_id = Column(Integer, ForeignKey("collaterals.id"))
    collateral_version_id = Column(Integer, ForeignKey("collateral_versions.id"))
    contract_id = Column(Integer, ForeignKey("credit_contracts.id"))
    message = Column(Text, nullable=False)
    blocked_at = Column(Text)
    next_action = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)

    task = relationship("ReassessmentTask", back_populates="warnings")
    trigger_material = relationship("Material", back_populates="triggered_warnings")


Base.metadata.create_all(bind=engine)
