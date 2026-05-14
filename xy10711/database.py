from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./pdf_review.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    fields = relationship("TemplateField", back_populates="template")
    forms = relationship("Form", back_populates="template")


class TemplateField(Base):
    __tablename__ = "template_fields"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id"))
    field_name = Column(String)
    x1 = Column(Float)
    y1 = Column(Float)
    x2 = Column(Float)
    y2 = Column(Float)
    page = Column(Integer, default=1)
    expected_value = Column(String, nullable=True)
    is_required = Column(Boolean, default=True)

    template = relationship("Template", back_populates="fields")


class Form(Base):
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id"))
    filename = Column(String)
    status = Column(String, default="pending")
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    template = relationship("Template", back_populates="forms")
    extractions = relationship("Extraction", back_populates="form")
    reviews = relationship("Review", back_populates="form")
    timeline = relationship("Timeline", back_populates="form")


class Extraction(Base):
    __tablename__ = "extractions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"))
    field_name = Column(String)
    extracted_value = Column(String)
    confidence = Column(Float, default=1.0)
    is_correct = Column(Boolean, nullable=True)
    corrected_value = Column(String, nullable=True)
    x1 = Column(Float)
    y1 = Column(Float)
    x2 = Column(Float)
    y2 = Column(Float)
    page = Column(Integer, default=1)

    form = relationship("Form", back_populates="extractions")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"))
    reviewer = Column(String)
    review_type = Column(String)
    status = Column(String)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    form = relationship("Form", back_populates="reviews")


class Timeline(Base):
    __tablename__ = "timeline"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id"))
    action = Column(String)
    actor = Column(String)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    form = relationship("Form", back_populates="timeline")


class TrainingVersion(Base):
    __tablename__ = "training_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String)
    description = Column(Text)
    trained_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    form_ids = Column(Text)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
