from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class PackageStatus(str, enum.Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"


class ViolationStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    WONTFIX = "wontfix"
    CLOSED = "closed"


class RuleType(str, enum.Enum):
    FORBID_IMPORT = "forbid_import"
    ALLOW_IMPORT = "allow_import"
    LAYERED = "layered"
    CIRCULAR = "circular"


class ViolationType(str, enum.Enum):
    CROSS_BOUNDARY = "cross_boundary"
    CIRCULAR_DEPENDENCY = "circular_dependency"
    LAYER_VIOLATION = "layer_violation"
    UNKNOWN = "unknown"


class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    path = Column(String(500), nullable=False)
    description = Column(Text)
    layer = Column(String(100))
    status = Column(Enum(PackageStatus), default=PackageStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    source_files = relationship("SourceFile", back_populates="package", cascade="all, delete-orphan")
    outgoing_rules = relationship("BoundaryRule", foreign_keys="BoundaryRule.from_package_id", back_populates="from_package")
    incoming_rules = relationship("BoundaryRule", foreign_keys="BoundaryRule.to_package_id", back_populates="to_package")


class SourceFile(Base):
    __tablename__ = "source_files"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)
    file_path = Column(String(500), nullable=False)
    language = Column(String(50), default="python")
    content_hash = Column(String(64))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    package = relationship("Package", back_populates="source_files")
    outgoing_imports = relationship("ImportPath", foreign_keys="ImportPath.from_file_id", back_populates="from_file")
    incoming_imports = relationship("ImportPath", foreign_keys="ImportPath.to_file_id", back_populates="to_file")
    violations = relationship("Violation", back_populates="source_file")


class ImportPath(Base):
    __tablename__ = "import_paths"

    id = Column(Integer, primary_key=True, index=True)
    from_file_id = Column(Integer, ForeignKey("source_files.id"), nullable=False)
    to_file_id = Column(Integer, ForeignKey("source_files.id"), nullable=False)
    import_statement = Column(String(500), nullable=False)
    line_number = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    from_file = relationship("SourceFile", foreign_keys=[from_file_id], back_populates="outgoing_imports")
    to_file = relationship("SourceFile", foreign_keys=[to_file_id], back_populates="incoming_imports")


class BoundaryRule(Base):
    __tablename__ = "boundary_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_type = Column(Enum(RuleType), nullable=False)
    from_package_id = Column(Integer, ForeignKey("packages.id"))
    to_package_id = Column(Integer, ForeignKey("packages.id"))
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    from_package = relationship("Package", foreign_keys=[from_package_id], back_populates="outgoing_rules")
    to_package = relationship("Package", foreign_keys=[to_package_id], back_populates="incoming_rules")


class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    violation_type = Column(Enum(ViolationType), default=ViolationType.UNKNOWN)
    source_file_id = Column(Integer, ForeignKey("source_files.id"))
    import_path_id = Column(Integer, ForeignKey("import_paths.id"))
    rule_id = Column(Integer, ForeignKey("boundary_rules.id"))
    description = Column(Text)
    status = Column(Enum(ViolationStatus), default=ViolationStatus.OPEN)
    assignee = Column(String(255))
    fix_suggestion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    source_file = relationship("SourceFile", back_populates="violations")
    status_history = relationship("ViolationStatusHistory", back_populates="violation", cascade="all, delete-orphan")


class ViolationStatusHistory(Base):
    __tablename__ = "violation_status_history"

    id = Column(Integer, primary_key=True, index=True)
    violation_id = Column(Integer, ForeignKey("violations.id"), nullable=False)
    from_status = Column(Enum(ViolationStatus))
    to_status = Column(Enum(ViolationStatus), nullable=False)
    handler = Column(String(255), nullable=False)
    conclusion = Column(Text)
    original_input = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    violation = relationship("Violation", back_populates="status_history")


class DependencyGraphCache(Base):
    __tablename__ = "dependency_graph_cache"

    id = Column(Integer, primary_key=True, index=True)
    graph_data = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
