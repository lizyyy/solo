"""
测试数据库模型
"""

import pytest
from datetime import datetime

from perf_attrib.database import (
    Analysis, FunctionProfile, SampleProfile, BenchmarkResult,
    Hotspot, Suggestion, SourceSnippet, Comparison,
    init_db, get_session
)


class TestDatabaseModels:
    """测试数据库模型"""
    
    def test_analysis_creation(self, temp_db):
        """测试创建分析记录"""
        session, db_path = temp_db
        
        analysis = Analysis(
            name="测试分析",
            version="1.0.0",
            command="test command",
            notes="测试备注"
        )
        session.add(analysis)
        session.commit()
        
        assert analysis.id is not None
        assert analysis.name == "测试分析"
        assert analysis.version == "1.0.0"
        assert analysis.timestamp is not None
    
    def test_function_profile_creation(self, temp_db):
        """测试创建函数性能数据"""
        session, db_path = temp_db
        
        analysis = Analysis(name="测试")
        session.add(analysis)
        session.flush()
        
        fp = FunctionProfile(
            analysis_id=analysis.id,
            filename="test.py",
            lineno=10,
            function="test_func",
            ncalls=100,
            tottime=0.5,
            percall_tottime=0.005,
            cumtime=1.0,
            percall_cumtime=0.01
        )
        session.add(fp)
        session.commit()
        
        assert fp.id is not None
        assert fp.function == "test_func"
        assert fp.ncalls == 100
        assert fp.analysis_id == analysis.id
    
    def test_sample_profile_creation(self, temp_db):
        """测试创建采样数据"""
        session, db_path = temp_db
        
        analysis = Analysis(name="测试")
        session.add(analysis)
        session.flush()
        
        sp = SampleProfile(
            analysis_id=analysis.id,
            filename="test.py",
            lineno=15,
            function="sample_func",
            samples=100,
            percentage=25.5,
            sample_type="cpu"
        )
        session.add(sp)
        session.commit()
        
        assert sp.id is not None
        assert sp.samples == 100
        assert sp.percentage == 25.5
    
    def test_benchmark_result_creation(self, temp_db):
        """测试创建 Benchmark 结果"""
        session, db_path = temp_db
        
        analysis = Analysis(name="测试")
        session.add(analysis)
        session.flush()
        
        br = BenchmarkResult(
            analysis_id=analysis.id,
            name="test_benchmark",
            source="timeit",
            min_time=0.001,
            max_time=0.002,
            mean_time=0.0015,
            median_time=0.0014,
            std_time=0.0001,
            iterations=1000,
            rounds=5
        )
        session.add(br)
        session.commit()
        
        assert br.id is not None
        assert br.name == "test_benchmark"
        assert br.mean_time == 0.0015
    
    def test_hotspot_creation(self, temp_db):
        """测试创建热点记录"""
        session, db_path = temp_db
        
        analysis = Analysis(name="测试")
        session.add(analysis)
        session.flush()
        
        hs = Hotspot(
            analysis_id=analysis.id,
            hotspot_type="cpu",
            filename="test.py",
            lineno=20,
            function="hotspot_func",
            score=85.5,
            severity="high",
            description="CPU 热点函数"
        )
        session.add(hs)
        session.commit()
        
        assert hs.id is not None
        assert hs.hotspot_type == "cpu"
        assert hs.severity == "high"
        assert hs.score == 85.5
    
    def test_suggestion_creation(self, temp_db):
        """测试创建优化建议"""
        session, db_path = temp_db
        
        analysis = Analysis(name="测试")
        session.add(analysis)
        session.flush()
        
        sg = Suggestion(
            analysis_id=analysis.id,
            category="cpu",
            priority="high",
            title="优化循环",
            description="使用向量化加速",
            before_code="for i in range(n): pass",
            after_code="import numpy as np; np.arange(n)",
            expected_improvement="减少时间复杂度"
        )
        session.add(sg)
        session.commit()
        
        assert sg.id is not None
        assert sg.category == "cpu"
        assert sg.priority == "high"
    
    def test_source_snippet_creation(self, temp_db):
        """测试创建源码片段"""
        session, db_path = temp_db
        
        analysis = Analysis(name="测试")
        session.add(analysis)
        session.flush()
        
        ss = SourceSnippet(
            analysis_id=analysis.id,
            filename="test.py",
            start_line=1,
            end_line=10,
            code="def test():\n    pass\n",
            highlight_lines=[2]
        )
        session.add(ss)
        session.commit()
        
        assert ss.id is not None
        assert ss.filename == "test.py"
        assert ss.highlight_lines == [2]
    
    def test_comparison_creation(self, temp_db):
        """测试创建对比记录"""
        session, db_path = temp_db
        
        analysis1 = Analysis(name="基准")
        analysis2 = Analysis(name="目标")
        session.add_all([analysis1, analysis2])
        session.flush()
        
        comp = Comparison(
            analysis_id_1=analysis1.id,
            analysis_id_2=analysis2.id,
            name="对比测试",
            notes="测试对比",
            summary={"total_improvements": 2, "total_regressions": 1},
            regressions=[{"function": "slow_func", "change": "+50%"}],
            improvements=[{"function": "fast_func", "change": "-30%"}]
        )
        session.add(comp)
        session.commit()
        
        assert comp.id is not None
        assert comp.analysis_id_1 == analysis1.id
        assert comp.analysis_id_2 == analysis2.id
    
    def test_relationships(self, temp_db):
        """测试关系"""
        session, db_path = temp_db
        
        analysis = Analysis(name="测试关系")
        session.add(analysis)
        session.flush()
        
        fp = FunctionProfile(
            analysis_id=analysis.id,
            filename="test.py",
            function="test",
            ncalls=1,
            tottime=0.1,
            percall_tottime=0.1,
            cumtime=0.1,
            percall_cumtime=0.1
        )
        session.add(fp)
        session.commit()
        
        session.refresh(analysis)
        assert len(analysis.function_profiles) == 1
        assert analysis.function_profiles[0].function == "test"


class TestDatabaseInit:
    """测试数据库初始化"""
    
    def test_init_db_creates_tables(self, tmp_path):
        """测试初始化数据库创建表"""
        db_path = str(tmp_path / "test.db")
        
        init_db(db_path)
        
        session = get_session(db_path=db_path)
        
        from perf_attrib.database import Base
        
        inspector = session.bind.dialect.has_table
        
        assert inspector(session.connection(), "analysis")
        assert inspector(session.connection(), "function_profile")
        assert inspector(session.connection(), "sample_profile")
        assert inspector(session.connection(), "benchmark_result")
        assert inspector(session.connection(), "hotspot")
        assert inspector(session.connection(), "suggestion")
        assert inspector(session.connection(), "source_snippet")
        assert inspector(session.connection(), "comparison")
        
        session.close()
