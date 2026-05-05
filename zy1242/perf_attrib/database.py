"""
数据库模型 - 用于存储性能分析数据、证据和建议
"""

import os
from datetime import datetime
from typing import Optional, List

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session

Base = declarative_base()


class Analysis(Base):
    """
    性能分析记录 - 每次 analyze 命令运行生成一条记录
    """
    __tablename__ = "analysis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    version = Column(String(50), nullable=True)
    command = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    function_profiles = relationship("FunctionProfile", back_populates="analysis", 
                                      cascade="all, delete-orphan")
    sample_profiles = relationship("SampleProfile", back_populates="analysis",
                                    cascade="all, delete-orphan")
    benchmark_results = relationship("BenchmarkResult", back_populates="analysis",
                                      cascade="all, delete-orphan")
    io_calls = relationship("IOCall", back_populates="analysis",
                             cascade="all, delete-orphan")
    memory_allocations = relationship("MemoryAllocation", back_populates="analysis",
                                       cascade="all, delete-orphan")
    hotspots = relationship("Hotspot", back_populates="analysis",
                            cascade="all, delete-orphan")
    suggestions = relationship("Suggestion", back_populates="analysis",
                               cascade="all, delete-orphan")
    source_snippets = relationship("SourceSnippet", back_populates="analysis",
                                    cascade="all, delete-orphan")


class FunctionProfile(Base):
    """
    函数性能分析 - 来自 cProfile/pstats
    """
    __tablename__ = "function_profile"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    
    filename = Column(String(512), nullable=False)
    lineno = Column(Integer, nullable=True)
    function = Column(String(255), nullable=False)
    
    ncalls = Column(Integer, nullable=False)
    tottime = Column(Float, nullable=False)
    percall_tottime = Column(Float, nullable=False)
    cumtime = Column(Float, nullable=False)
    percall_cumtime = Column(Float, nullable=False)
    
    analysis = relationship("Analysis", back_populates="function_profiles")


class SampleProfile(Base):
    """
    采样分析 - 来自 py-spy
    """
    __tablename__ = "sample_profile"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    
    filename = Column(String(512), nullable=False)
    lineno = Column(Integer, nullable=True)
    function = Column(String(255), nullable=False)
    
    samples = Column(Integer, nullable=False)
    percentage = Column(Float, nullable=False)
    sample_type = Column(String(50), default="cpu")
    
    analysis = relationship("Analysis", back_populates="sample_profiles")


class BenchmarkResult(Base):
    """
    Benchmark 结果 - 来自 timeit/pytest-benchmark
    """
    __tablename__ = "benchmark_result"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    
    name = Column(String(255), nullable=False)
    source = Column(String(50), default="timeit")
    
    min_time = Column(Float, nullable=True)
    max_time = Column(Float, nullable=True)
    mean_time = Column(Float, nullable=True)
    median_time = Column(Float, nullable=True)
    std_time = Column(Float, nullable=True)
    
    iterations = Column(Integer, nullable=True)
    rounds = Column(Integer, nullable=True)
    
    analysis = relationship("Analysis", back_populates="benchmark_results")


class IOCall(Base):
    """
    I/O 调用记录 - 用于检测重复 I/O
    """
    __tablename__ = "io_call"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    
    operation = Column(String(50), nullable=False)
    path = Column(String(512), nullable=False)
    count = Column(Integer, default=1)
    total_time = Column(Float, nullable=True)
    bytes_transferred = Column(Integer, nullable=True)
    
    call_stack = Column(Text, nullable=True)
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    
    analysis = relationship("Analysis", back_populates="io_calls")


class MemoryAllocation(Base):
    """
    内存分配记录 - 用于检测过度分配
    """
    __tablename__ = "memory_allocation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    
    filename = Column(String(512), nullable=False)
    lineno = Column(Integer, nullable=True)
    function = Column(String(255), nullable=True)
    
    allocations = Column(Integer, nullable=False)
    total_bytes = Column(Integer, nullable=False)
    peak_bytes = Column(Integer, nullable=True)
    
    analysis = relationship("Analysis", back_populates="memory_allocations")


class Hotspot(Base):
    """
    热点函数识别 - 分析引擎输出
    """
    __tablename__ = "hotspot"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    
    hotspot_type = Column(String(50), nullable=False)
    filename = Column(String(512), nullable=False)
    lineno = Column(Integer, nullable=True)
    function = Column(String(255), nullable=False)
    
    score = Column(Float, nullable=False)
    severity = Column(String(20), default="medium")
    description = Column(Text, nullable=True)
    
    evidence = Column(JSON, nullable=True)
    
    analysis = relationship("Analysis", back_populates="hotspots")


class Suggestion(Base):
    """
    优化建议 - 分析引擎输出
    """
    __tablename__ = "suggestion"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    
    category = Column(String(50), nullable=False)
    priority = Column(String(20), default="medium")
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    
    before_code = Column(Text, nullable=True)
    after_code = Column(Text, nullable=True)
    
    expected_improvement = Column(Text, nullable=True)
    references = Column(Text, nullable=True)
    
    analysis = relationship("Analysis", back_populates="suggestions")


class SourceSnippet(Base):
    """
    源码片段 - 用于证据展示
    """
    __tablename__ = "source_snippet"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    
    filename = Column(String(512), nullable=False)
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=False)
    
    code = Column(Text, nullable=False)
    highlight_lines = Column(JSON, nullable=True)
    
    analysis = relationship("Analysis", back_populates="source_snippets")


class Comparison(Base):
    """
    对比记录 - compare 命令生成
    """
    __tablename__ = "comparison"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    analysis_id_1 = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    analysis_id_2 = Column(Integer, ForeignKey("analysis.id"), nullable=False)
    
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    name = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    summary = Column(JSON, nullable=True)
    regressions = Column(JSON, nullable=True)
    improvements = Column(JSON, nullable=True)


def get_engine(db_path: Optional[str] = None):
    """
    获取数据库引擎
    
    Args:
        db_path: 数据库文件路径，默认为 ~/.perf_attrib.db
    
    Returns:
        SQLAlchemy Engine
    """
    if db_path is None:
        db_path = os.path.expanduser("~/.perf_attrib.db")
    
    return create_engine(f"sqlite:///{db_path}", echo=False)


def get_session(engine=None, db_path: Optional[str] = None) -> Session:
    """
    获取数据库会话
    
    Args:
        engine: 可选的已存在引擎
        db_path: 数据库文件路径
    
    Returns:
        SQLAlchemy Session
    """
    if engine is None:
        engine = get_engine(db_path)
    
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()


def init_db(db_path: Optional[str] = None):
    """
    初始化数据库 - 创建所有表
    
    Args:
        db_path: 数据库文件路径
    """
    engine = get_engine(db_path)
    Base.metadata.create_all(engine)
