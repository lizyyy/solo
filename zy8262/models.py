from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Tree(Base):
    __tablename__ = "trees"
    
    id = Column(Integer, primary_key=True, index=True)
    tree_id = Column(String, unique=True, index=True)
    latitude = Column(Float, index=True)
    longitude = Column(Float, index=True)
    species = Column(String, default="")
    address = Column(String, default="")
    district = Column(String, default="")
    status = Column(String, default="healthy")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    inspections = relationship("Inspection", back_populates="tree", cascade="all, delete-orphan")
    treatments = relationship("Treatment", back_populates="tree", cascade="all, delete-orphan")


class Inspection(Base):
    __tablename__ = "inspections"
    
    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(String, unique=True, index=True)
    tree_id = Column(String, ForeignKey("trees.tree_id"), index=True)
    inspector = Column(String, default="")
    inspection_date = Column(DateTime, index=True)
    photo_paths = Column(Text, default="[]")
    pest_damage = Column(Boolean, default=False)
    disease_present = Column(Boolean, default=False)
    health_status = Column(String, default="normal")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    tree = relationship("Tree", back_populates="inspections")


class Treatment(Base):
    __tablename__ = "treatments"
    
    id = Column(Integer, primary_key=True, index=True)
    treatment_id = Column(String, unique=True, index=True)
    tree_id = Column(String, ForeignKey("trees.tree_id"), index=True)
    inspector = Column(String, default="")
    treatment_date = Column(DateTime, index=True)
    chemical_used = Column(String, default="")
    dosage = Column(String, default="")
    treatment_type = Column(String, default="")
    notes = Column(Text, default="")
    is_effective = Column(Boolean, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    tree = relationship("Tree", back_populates="treatments")


class Rule(Base):
    __tablename__ = "rules"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_type = Column(String, index=True)
    name = Column(String, index=True)
    value = Column(Text)
    description = Column(Text, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Risk(Base):
    __tablename__ = "risks"
    
    id = Column(Integer, primary_key=True, index=True)
    risk_type = Column(String, index=True)
    severity = Column(String, default="medium")
    tree_id = Column(String, index=True, nullable=True)
    inspection_id = Column(String, nullable=True)
    treatment_id = Column(String, nullable=True)
    description = Column(Text)
    details = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String, default="")
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
