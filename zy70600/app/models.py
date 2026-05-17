from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ColdChainBox(Base):
    __tablename__ = "cold_chain_boxes"

    id = Column(Integer, primary_key=True, index=True)
    box_code = Column(String, unique=True, index=True, nullable=False)
    batch_no = Column(String, index=True)
    product_name = Column(String)
    temperature_min = Column(Float, default=-25.0)
    temperature_max = Column(Float, default=-15.0)
    expected_arrival = Column(DateTime)
    status = Column(String, default="CREATED")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    temperature_samples = relationship("TemperatureSample", back_populates="box")
    signoffs = relationship("StoreSignoff", back_populates="box")
    photos = relationship("PhotoEvidence", back_populates="box")
    reviews = relationship("ExceptionReview", back_populates="box")
    compensations = relationship("CompensationConclusion", back_populates="box")


class TemperatureSample(Base):
    __tablename__ = "temperature_samples"

    id = Column(Integer, primary_key=True, index=True)
    box_id = Column(Integer, ForeignKey("cold_chain_boxes.id"))
    sample_time = Column(DateTime, nullable=False)
    temperature = Column(Float, nullable=False)
    probe_id = Column(String, index=True)
    is_anomaly = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    box = relationship("ColdChainBox", back_populates="temperature_samples")


class StoreSignoff(Base):
    __tablename__ = "store_signoffs"

    id = Column(Integer, primary_key=True, index=True)
    box_id = Column(Integer, ForeignKey("cold_chain_boxes.id"))
    store_code = Column(String, index=True)
    store_name = Column(String)
    signoff_person = Column(String)
    signoff_time = Column(DateTime)
    temperature_arrival = Column(Float)
    has_exception = Column(Boolean, default=False)
    exception_desc = Column(Text)
    status = Column(String, default="DRAFT")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    box = relationship("ColdChainBox", back_populates="signoffs")


class PhotoEvidence(Base):
    __tablename__ = "photo_evidences"

    id = Column(Integer, primary_key=True, index=True)
    box_id = Column(Integer, ForeignKey("cold_chain_boxes.id"))
    signoff_id = Column(Integer, ForeignKey("store_signoffs.id"))
    photo_key = Column(String, unique=True, index=True)
    photo_type = Column(String)
    photo_url = Column(String)
    upload_time = Column(DateTime(timezone=True), server_default=func.now())
    uploader = Column(String)
    description = Column(Text)

    box = relationship("ColdChainBox", back_populates="photos")


class ExceptionReview(Base):
    __tablename__ = "exception_reviews"

    id = Column(Integer, primary_key=True, index=True)
    box_id = Column(Integer, ForeignKey("cold_chain_boxes.id"))
    signoff_id = Column(Integer, ForeignKey("store_signoffs.id"))
    reviewer = Column(String)
    review_time = Column(DateTime(timezone=True), server_default=func.now())
    original_input = Column(Text)
    review_result = Column(String)
    review_comment = Column(Text)
    temperature_violation = Column(Boolean, default=False)
    compensation_eligible = Column(Boolean, default=False)
    status = Column(String, default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    box = relationship("ColdChainBox", back_populates="reviews")


class CompensationConclusion(Base):
    __tablename__ = "compensation_conclusions"

    id = Column(Integer, primary_key=True, index=True)
    box_id = Column(Integer, ForeignKey("cold_chain_boxes.id"))
    review_id = Column(Integer, ForeignKey("exception_reviews.id"))
    compensation_amount = Column(Float, default=0.0)
    compensation_reason = Column(Text)
    processor = Column(String)
    approved_by = Column(String)
    conclusion_time = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="DRAFT")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    box = relationship("ColdChainBox", back_populates="compensations")
