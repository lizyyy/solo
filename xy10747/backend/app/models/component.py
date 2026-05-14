from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.core.database import Base


class Component(Base):
    __tablename__ = "components"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    type = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    current_version = Column(String(50))

    schemas = relationship("ComponentSchema", back_populates="component", cascade="all, delete-orphan")
    property_panels = relationship("PropertyPanel", back_populates="component", cascade="all, delete-orphan")
    versions = relationship("ComponentVersion", back_populates="component", cascade="all, delete-orphan")
    dependency_checks = relationship("DependencyCheck", back_populates="component", cascade="all, delete-orphan")
    example_previews = relationship("ExamplePreview", back_populates="component", cascade="all, delete-orphan")
    compatibility_reports = relationship("CompatibilityReport", back_populates="component", cascade="all, delete-orphan")
    processing_chains = relationship("ProcessingChain", back_populates="component", cascade="all, delete-orphan")


class ComponentSchema(Base):
    __tablename__ = "component_schemas"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    version = Column(String(50), nullable=False)
    schema_content = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100))
    is_active = Column(Boolean, default=True)

    component = relationship("Component", back_populates="schemas")


class PropertyPanel(Base):
    __tablename__ = "property_panels"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    schema_version = Column(String(50), nullable=False)
    panel_config = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = Column(Integer, default=1)

    component = relationship("Component", back_populates="property_panels")


class ComponentVersion(Base):
    __tablename__ = "component_versions"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    version = Column(String(50), nullable=False)
    release_notes = Column(Text)
    status = Column(String(50), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    released_at = Column(DateTime)
    released_by = Column(String(100))

    component = relationship("Component", back_populates="versions")


class DependencyCheck(Base):
    __tablename__ = "dependency_checks"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    version = Column(String(50), nullable=False)
    property_panel_version = Column(Integer)
    status = Column(String(50), default="pending")
    dependencies = Column(JSON)
    errors = Column(JSON)
    warnings = Column(JSON)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    check_id = Column(String(100), unique=True)
    retry_count = Column(Integer, default=0)

    component = relationship("Component", back_populates="dependency_checks")


class ExamplePreview(Base):
    __tablename__ = "example_previews"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    version = Column(String(50), nullable=False)
    property_panel_version = Column(Integer)
    status = Column(String(50), default="pending")
    preview_data = Column(JSON)
    errors = Column(JSON)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    preview_id = Column(String(100), unique=True)
    retry_count = Column(Integer, default=0)

    component = relationship("Component", back_populates="example_previews")


class CompatibilityReport(Base):
    __tablename__ = "compatibility_reports"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    version = Column(String(50), nullable=False)
    property_panel_version = Column(Integer)
    dependency_check_id = Column(Integer, ForeignKey("dependency_checks.id"))
    example_preview_id = Column(Integer, ForeignKey("example_previews.id"))
    status = Column(String(50), default="pending")
    report_content = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    manual_override = Column(Boolean, default=False)
    override_by = Column(String(100))
    override_notes = Column(Text)

    component = relationship("Component", back_populates="compatibility_reports")


class ProcessingChain(Base):
    __tablename__ = "processing_chains"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    version = Column(String(50), nullable=False)
    property_panel_version = Column(Integer)
    chain_id = Column(String(100), unique=True, nullable=False)
    status = Column(String(50), default="idle")
    current_step = Column(String(100))
    steps = Column(JSON)
    current_step_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_action_hash = Column(String(64))

    component = relationship("Component", back_populates="processing_chains")
