import datetime
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SensitiveWord(Base):
    __tablename__ = "sensitive_words"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    word: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    normalized_word: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    pinyin: Mapped[str] = mapped_column(String(500), nullable=True)
    
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    
    description: Mapped[str] = mapped_column(Text, nullable=True)
    suggestion: Mapped[str] = mapped_column(String(255), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_regex: Mapped[bool] = mapped_column(Boolean, default=False)
    
    match_count: Mapped[int] = mapped_column(Integer, default=0)
    false_positive_count: Mapped[int] = mapped_column(Integer, default=0)
    
    version_id: Mapped[int] = mapped_column(Integer, ForeignKey("lexicon_versions.id"), nullable=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False
    )
    
    synonyms = relationship("Synonym", back_populates="sensitive_word", cascade="all, delete-orphan")
    variants = relationship("Variant", back_populates="sensitive_word", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_sensitive_word_normalized", "normalized_word"),
        Index("idx_sensitive_word_category", "category"),
        Index("idx_sensitive_word_severity", "severity"),
    )


class Synonym(Base):
    __tablename__ = "synonyms"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensitive_word_id: Mapped[int] = mapped_column(Integer, ForeignKey("sensitive_words.id"), nullable=False)
    
    synonym: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_synonym: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    
    sensitive_word = relationship("SensitiveWord", back_populates="synonyms")


class Variant(Base):
    __tablename__ = "variants"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensitive_word_id: Mapped[int] = mapped_column(Integer, ForeignKey("sensitive_words.id"), nullable=False)
    
    variant: Mapped[str] = mapped_column(String(255), nullable=False)
    variant_type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    
    sensitive_word = relationship("SensitiveWord", back_populates="variants")


class Whitelist(Base):
    __tablename__ = "whitelist"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    term: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    normalized_term: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    context: Mapped[str] = mapped_column(String(255), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False
    )
    
    __table_args__ = (
        Index("idx_whitelist_normalized", "normalized_term"),
    )


class ContextRule(Base):
    __tablename__ = "context_rules"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    rule_name: Mapped[str] = mapped_column(String(100), nullable=False)
    sensitive_word_id: Mapped[int] = mapped_column(Integer, ForeignKey("sensitive_words.id"), nullable=True)
    
    trigger_words: Mapped[str] = mapped_column(Text, nullable=False)
    context_words: Mapped[str] = mapped_column(Text, nullable=True)
    exemption_words: Mapped[str] = mapped_column(Text, nullable=True)
    
    rule_type: Mapped[str] = mapped_column(String(50), default="enhance")
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )


class LexiconVersion(Base):
    __tablename__ = "lexicon_versions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    version: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    synonym_count: Mapped[int] = mapped_column(Integer, default=0)
    whitelist_count: Mapped[int] = mapped_column(Integer, default=0)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    is_rollback_point: Mapped[bool] = mapped_column(Boolean, default=False)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    
    __table_args__ = (
        Index("idx_lexicon_version_active", "is_active"),
    )
