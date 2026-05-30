from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./monte_carlo_options.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class OptionContract(Base):
    __tablename__ = "option_contracts"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(String, unique=True, index=True)
    source_reference = Column(String, index=True)
    option_type = Column(String)
    underlying_price = Column(Float)
    strike_price = Column(Float)
    risk_free_rate = Column(Float)
    volatility = Column(Float)
    maturity_days = Column(Integer)
    dividend_yield = Column(Float, default=0.0)
    random_seed = Column(Integer, nullable=True)
    num_simulations = Column(Integer, default=10000)
    num_steps = Column(Integer, default=252)
    status = Column(String, default="imported")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(Text, nullable=True)
    requires_manual_review = Column(Boolean, default=False)
    review_reason = Column(String, nullable=True)

    pricing_results = relationship("PricingResult", back_populates="contract", cascade="all, delete-orphan")
    simulation_paths = relationship("SimulationPath", back_populates="contract", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="contract", cascade="all, delete-orphan")
    exceptions = relationship("PricingException", back_populates="contract", cascade="all, delete-orphan")

class PricingResult(Base):
    __tablename__ = "pricing_results"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("option_contracts.id"))
    option_price = Column(Float)
    standard_error = Column(Float)
    confidence_level = Column(Float)
    ci_lower = Column(Float)
    ci_upper = Column(Float)
    discount_factor = Column(Float)
    expected_payoff = Column(Float)
    variance = Column(Float)
    skewness = Column(Float)
    kurtosis = Column(Float)
    calculation_time_ms = Column(Float)
    actual_random_seed = Column(Integer, nullable=True)
    discount_method = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    contract = relationship("OptionContract", back_populates="pricing_results")

class SimulationPath(Base):
    __tablename__ = "simulation_paths"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("option_contracts.id"))
    path_index = Column(Integer)
    final_price = Column(Float)
    payoff = Column(Float)
    discounted_payoff = Column(Float)
    path_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    contract = relationship("OptionContract", back_populates="simulation_paths")

class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("option_contracts.id"))
    from_status = Column(String)
    to_status = Column(String)
    transition_reason = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    contract = relationship("OptionContract", back_populates="status_history")

class PricingException(Base):
    __tablename__ = "pricing_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("option_contracts.id"))
    exception_type = Column(String)
    error_message = Column(Text)
    stack_trace = Column(Text)
    is_recoverable = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    contract = relationship("OptionContract", back_populates="exceptions")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
