from sqlalchemy import Column, Integer, String, Float, Date, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()


class Farmer(Base):
    __tablename__ = 'farmers'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    village = Column(String(100))
    id_number = Column(String(50), unique=True)
    source = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    plots = relationship('Plot', back_populates='farmer')
    work_records = relationship('WorkRecord', back_populates='farmer')
    historical_debts = relationship('HistoricalDebt', back_populates='farmer')


class Plot(Base):
    __tablename__ = 'plots'
    
    id = Column(Integer, primary_key=True)
    farmer_id = Column(Integer, ForeignKey('farmers.id'))
    plot_name = Column(String(100), nullable=False)
    plot_code = Column(String(50), unique=True)
    area = Column(Float, nullable=False)
    area_unit = Column(String(10), default='亩')
    location = Column(String(200))
    source = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    farmer = relationship('Farmer', back_populates='plots')
    work_records = relationship('WorkRecord', back_populates='plot')


class WorkType(Base):
    __tablename__ = 'work_types'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    unit_price = Column(Float, nullable=False)
    unit = Column(String(20), default='亩')
    description = Column(Text)
    source = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)


class WorkRecord(Base):
    __tablename__ = 'work_records'
    
    id = Column(Integer, primary_key=True)
    farmer_id = Column(Integer, ForeignKey('farmers.id'))
    plot_id = Column(Integer, ForeignKey('plots.id'))
    work_type_id = Column(Integer, ForeignKey('work_types.id'))
    work_date = Column(Date, nullable=False)
    area = Column(Float, nullable=False)
    area_unit = Column(String(10), default='亩')
    operator_name = Column(String(100))
    machine_name = Column(String(100))
    is_confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime)
    is_finalized = Column(Boolean, default=False)
    finalized_by = Column(String(100))
    finalized_at = Column(DateTime)
    source = Column(String(200))
    source_hash = Column(String(100), unique=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    farmer = relationship('Farmer', back_populates='work_records')
    plot = relationship('Plot', back_populates='work_records')
    work_type = relationship('WorkType')
    corrections = relationship('Correction', back_populates='work_record')


class OilSubsidyRule(Base):
    __tablename__ = 'oil_subsidy_rules'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    work_type_id = Column(Integer, ForeignKey('work_types.id'))
    subsidy_type = Column(String(20), default='percentage')
    value = Column(Float, nullable=False)
    max_amount = Column(Float)
    effective_date = Column(Date)
    expiration_date = Column(Date)
    is_active = Column(Boolean, default=True)
    source = Column(String(200))
    created_at = Column(DateTime, default=datetime.now)


class HistoricalDebt(Base):
    __tablename__ = 'historical_debts'
    
    id = Column(Integer, primary_key=True)
    farmer_id = Column(Integer, ForeignKey('farmers.id'))
    amount = Column(Float, nullable=False)
    debt_date = Column(Date)
    description = Column(Text)
    source = Column(String(200))
    source_hash = Column(String(100), unique=True)
    created_at = Column(DateTime, default=datetime.now)
    
    farmer = relationship('Farmer', back_populates='historical_debts')


class Correction(Base):
    __tablename__ = 'corrections'
    
    id = Column(Integer, primary_key=True)
    work_record_id = Column(Integer, ForeignKey('work_records.id'))
    field_name = Column(String(50), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    corrected_by = Column(String(100))
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    work_record = relationship('WorkRecord', back_populates='corrections')


class AuditLog(Base):
    __tablename__ = 'audit_logs'
    
    id = Column(Integer, primary_key=True)
    action = Column(String(50), nullable=False)
    table_name = Column(String(50))
    record_id = Column(Integer)
    details = Column(Text)
    operator = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)
