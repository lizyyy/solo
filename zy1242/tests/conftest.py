"""
测试配置
"""

import pytest
import tempfile
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from perf_attrib.database import Base


@pytest.fixture
def temp_db():
    """创建临时数据库"""
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(db_fd)
    
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    yield session, db_path
    
    session.close()
    engine.dispose()
    
    if os.path.exists(db_path):
        os.unlink(db_path)


@pytest.fixture
def sample_functions():
    """提供样例函数数据"""
    return [
        {
            "filename": "slow_script.py",
            "lineno": 15,
            "function": "slow_calculation",
            "ncalls": 1,
            "tottime": 8.234,
            "percall_tottime": 8.234,
            "cumtime": 12.344,
            "percall_cumtime": 12.344,
            "callers": ["main"]
        },
        {
            "filename": "slow_script.py",
            "lineno": 28,
            "function": "repeated_file_io",
            "ncalls": 100,
            "tottime": 1.500,
            "percall_tottime": 0.015,
            "cumtime": 2.500,
            "percall_cumtime": 0.025,
            "callers": ["main"]
        },
        {
            "filename": "slow_script.py",
            "lineno": 45,
            "function": "excessive_memory_allocation",
            "ncalls": 1,
            "tottime": 1.200,
            "percall_tottime": 1.200,
            "cumtime": 1.200,
            "percall_cumtime": 1.200,
            "callers": ["main"]
        },
        {
            "filename": "slow_script.py",
            "lineno": 70,
            "function": "function_a",
            "ncalls": 50,
            "tottime": 0.500,
            "percall_tottime": 0.010,
            "cumtime": 1.000,
            "percall_cumtime": 0.020,
            "callers": ["main", "deep_call_chain"]
        }
    ]


@pytest.fixture
def sample_pystats_functions():
    """提供样例 py-spy 函数数据"""
    return [
        {
            "filename": "slow_script.py",
            "lineno": 15,
            "function": "slow_calculation",
            "samples": 45,
            "percentage": 28.8,
            "sample_type": "cpu"
        },
        {
            "filename": "slow_script.py",
            "lineno": 45,
            "function": "excessive_memory_allocation",
            "samples": 30,
            "percentage": 19.2,
            "sample_type": "cpu"
        },
        {
            "filename": "slow_script.py",
            "lineno": 28,
            "function": "repeated_file_io",
            "samples": 25,
            "percentage": 16.0,
            "sample_type": "cpu"
        }
    ]
