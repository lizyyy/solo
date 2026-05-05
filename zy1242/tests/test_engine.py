"""
测试分析引擎
"""

import pytest

from perf_attrib.engine import (
    analyze_cpu_hotspots, analyze_function_fanout,
    analyze_io_patterns, analyze_memory_patterns
)


class TestCPUHotspots:
    """测试 CPU 热点分析"""
    
    def test_analyze_cpu_hotspots_cprofile(self, sample_functions):
        """测试分析 cProfile 格式的 CPU 热点"""
        hotspots = analyze_cpu_hotspots(sample_functions, "cprofile")
        
        assert len(hotspots) > 0
        
        slow_calc = next((h for h in hotspots if h["function"] == "slow_calculation"), None)
        assert slow_calc is not None
        assert slow_calc["type"] == "cpu"
        assert slow_calc["score"] > 0
    
    def test_analyze_cpu_hotspots_pystats(self, sample_pystats_functions):
        """测试分析 py-spy 格式的 CPU 热点"""
        hotspots = analyze_cpu_hotspots(sample_pystats_functions, "pystats")
        
        assert len(hotspots) > 0
        
        for hotspot in hotspots:
            assert "function" in hotspot
            assert "score" in hotspot
            assert "severity" in hotspot
    
    def test_analyze_cpu_hotspots_empty(self):
        """测试空函数列表"""
        hotspots = analyze_cpu_hotspots([], "cprofile")
        assert hotspots == []
    
    def test_high_tottime_function(self):
        """测试高耗时函数检测"""
        functions = [
            {
                "filename": "test.py",
                "lineno": 1,
                "function": "very_slow",
                "ncalls": 1,
                "tottime": 10.0,
                "percall_tottime": 10.0,
                "cumtime": 10.0,
                "percall_cumtime": 10.0
            }
        ]
        
        hotspots = analyze_cpu_hotspots(functions, "cprofile")
        
        assert len(hotspots) == 1
        assert hotspots[0]["severity"] == "high"
        assert "占用大量 CPU 时间" in hotspots[0]["description"]


class TestFunctionFanout:
    """测试函数调用扇出分析"""
    
    def test_analyze_function_fanout_basic(self, sample_functions):
        """测试基本的扇出分析"""
        result = analyze_function_fanout(sample_functions)
        
        assert "total_functions" in result
        assert "high_fanout_functions" in result
        assert "deep_call_chains" in result
        assert "recommendations" in result
    
    def test_analyze_function_fanout_empty(self):
        """测试空函数列表"""
        result = analyze_function_fanout([])
        
        assert result["total_functions"] == 0
        assert result["high_fanout_functions"] == []
        assert result["deep_call_chains"] == []


class TestIOPatterns:
    """测试 I/O 模式分析"""
    
    def test_analyze_io_patterns_with_io_functions(self):
        """测试包含 I/O 函数的分析"""
        functions = [
            {
                "filename": "test.py",
                "lineno": 1,
                "function": "repeated_file_io",
                "ncalls": 200,
                "tottime": 5.0,
                "cumtime": 10.0,
                "percall_tottime": 0.025
            },
            {
                "filename": "test.py",
                "lineno": 10,
                "function": "normal_func",
                "ncalls": 10,
                "tottime": 0.1,
                "cumtime": 0.2,
                "percall_tottime": 0.01
            }
        ]
        
        patterns = analyze_io_patterns(functions)
        
        assert len(patterns) > 0
        
        io_func = next((p for p in patterns if "repeated" in p["function"].lower()), None)
        if io_func:
            assert io_func["ncalls"] == 200
    
    def test_analyze_io_patterns_empty(self):
        """测试空列表"""
        patterns = analyze_io_patterns([])
        assert patterns == []
    
    def test_analyze_io_patterns_high_frequency(self):
        """测试高频率 I/O 检测"""
        functions = [
            {
                "filename": "test.py",
                "lineno": 1,
                "function": "open",
                "ncalls": 500,
                "tottime": 2.0,
                "cumtime": 5.0,
                "percall_tottime": 0.004
            }
        ]
        
        patterns = analyze_io_patterns(functions)
        
        assert len(patterns) == 1
        assert patterns[0]["is_issue"] is True
        assert patterns[0]["score"] > 0


class TestMemoryPatterns:
    """测试内存模式分析"""
    
    def test_analyze_memory_patterns_with_memory_functions(self):
        """测试包含内存操作的分析"""
        functions = [
            {
                "filename": "test.py",
                "lineno": 1,
                "function": "list.append",
                "ncalls": 10000,
                "tottime": 1.0,
                "cumtime": 1.0,
                "percall_tottime": 0.0001
            },
            {
                "filename": "test.py",
                "lineno": 10,
                "function": "copy.deepcopy",
                "ncalls": 100,
                "tottime": 2.0,
                "cumtime": 2.0,
                "percall_tottime": 0.02
            }
        ]
        
        patterns = analyze_memory_patterns(functions)
        
        assert len(patterns) > 0
    
    def test_analyze_memory_patterns_empty(self):
        """测试空列表"""
        patterns = analyze_memory_patterns([])
        assert patterns == []
    
    def test_analyze_memory_patterns_high_frequency_append(self):
        """测试高频 list.append 检测"""
        functions = [
            {
                "filename": "test.py",
                "lineno": 1,
                "function": "{method 'append' of 'list' objects}",
                "ncalls": 50000,
                "tottime": 0.5,
                "cumtime": 0.5,
                "percall_tottime": 0.00001
            }
        ]
        
        patterns = analyze_memory_patterns(functions)
        
        assert len(patterns) == 1
        assert patterns[0]["is_issue"] is True
        assert "频繁使用 list.append" in patterns[0]["description"]
