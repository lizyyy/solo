from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Contestant(Base):
    __tablename__ = "contestants"

    id = Column(Integer, primary_key=True, index=True)
    contestant_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    group = Column(String, nullable=True)
    info = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scores = relationship("JudgeScore", back_populates="contestant")
    appeals = relationship("Appeal", back_populates="contestant")


class JudgeScore(Base):
    __tablename__ = "judge_scores"

    id = Column(Integer, primary_key=True, index=True)
    contestant_id = Column(String, ForeignKey("contestants.contestant_id"), nullable=False)
    judge_id = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    is_dropped = Column(Boolean, default=False)
    original_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contestant = relationship("Contestant", back_populates="scores")


class RankRule(Base):
    __tablename__ = "rank_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String, unique=True, nullable=False)
    drop_highest = Column(Integer, default=0)
    drop_lowest = Column(Integer, default=0)
    ranking_mode = Column(String, default="competition")
    promotion_threshold = Column(Integer, nullable=True)
    promotion_score = Column(Float, nullable=True)
    categories = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Appeal(Base):
    __tablename__ = "appeals"

    id = Column(Integer, primary_key=True, index=True)
    contestant_id = Column(String, ForeignKey("contestants.contestant_id"), nullable=False)
    judge_id = Column(String, nullable=True)
    original_score = Column(Float, nullable=False)
    new_score = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String, default="pending")
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    contestant = relationship("Contestant", back_populates="appeals")


class RankingResult(Base):
    __tablename__ = "ranking_results"

    id = Column(Integer, primary_key=True, index=True)
    contestant_id = Column(String, ForeignKey("contestants.contestant_id"), nullable=False)
    final_score = Column(Float, nullable=False)
    rank = Column(Integer, nullable=False)
    rank_display = Column(String, nullable=False)
    category = Column(String, nullable=True)
    is_promoted = Column(Boolean, default=False)
    promotion_status = Column(String, nullable=True)
    appeal_impact = Column(String, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
