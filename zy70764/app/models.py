from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    postman_id = Column(String, index=True)
    schema_version = Column(String)
    raw_content = Column(JSON)
    status = Column(String, default="pending")
    total_requests = Column(Integer, default=0)
    requests_with_assertions = Column(Integer, default=0)
    requests_with_examples = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    requests = relationship("Request", back_populates="collection", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="collection", cascade="all, delete-orphan")


class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id"))
    name = Column(String, index=True)
    method = Column(String)
    url = Column(String)
    path = Column(String, index=True)
    folder_path = Column(String)
    has_assertions = Column(Boolean, default=False)
    has_examples = Column(Boolean, default=False)
    assertion_count = Column(Integer, default=0)
    example_count = Column(Integer, default=0)
    status = Column(String, default="pending")
    raw_request = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    collection = relationship("Collection", back_populates="requests")
    assertions = relationship("Assertion", back_populates="request", cascade="all, delete-orphan")
    examples = relationship("Example", back_populates="request", cascade="all, delete-orphan")
    variables = relationship("VariableReference", back_populates="request", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="request", cascade="all, delete-orphan")


class Assertion(Base):
    __tablename__ = "assertions"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id"))
    type = Column(String)
    content = Column(Text)
    line_number = Column(Integer)
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("Request", back_populates="assertions")


class Example(Base):
    __tablename__ = "examples"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id"))
    name = Column(String)
    status_code = Column(Integer)
    content_type = Column(String)
    body = Column(Text)
    raw_example = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("Request", back_populates="examples")


class VariableReference(Base):
    __tablename__ = "variable_references"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id"))
    name = Column(String)
    context = Column(String)
    line_number = Column(Integer)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("Request", back_populates="variables")


class Environment(Base):
    __tablename__ = "environments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    postman_id = Column(String, index=True)
    variables = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id"))
    type = Column(String)
    status = Column(String, default="generated")
    content = Column(JSON)
    file_path = Column(String)
    generated_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    collection = relationship("Collection", back_populates="reports")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id"))
    action = Column(String)
    previous_status = Column(String)
    new_status = Column(String)
    handler = Column(String)
    conclusion = Column(Text)
    raw_input = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("Request", back_populates="audit_logs")
