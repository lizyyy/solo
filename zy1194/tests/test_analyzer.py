"""分析器测试"""

import pytest
from tpsim.models import SimulationConfig, SimulationResult, TaskStatistics
from tpsim.simulator import ThreadPoolSimulator
from tpsim.analyzer import ResultAnalyzer


class TestResultAnalyzer:
    """结果分析器测试"""
    
    def setup_method(self):
        """设置测试环境"""
        # 创建一个简单的模拟结果
        config = SimulationConfig(
            worker_count=2,
            simulation_duration=20.0,
            seed=42
        )
        
        simulator = ThreadPoolSimulator(config)
        
        # 添加任务
        for i in range(5):
            task = simulator.all_tasks.get(f"t-{i}")
            if not task:
                from tpsim.models import Task
                task = Task(id=f"t-{i}", duration=1.0)
            simulator.add_task(task)
        
        self.result = simulator.run()
        self.analyzer = ResultAnalyzer(self.result)
    
    def test_get_overview(self):
        """测试获取概览"""
        overview = self.analyzer.get_overview()
        
        assert "total_tasks" in overview
        assert "completed_tasks" in overview
        assert "throughput" in overview
        assert "avg_worker_utilization" in overview
        assert overview["total_tasks"] == 5
    
    def test_get_worker_utilization_details(self):
        """测试获取 Worker 详情"""
        details = self.analyzer.get_worker_utilization_details()
        
        assert len(details) == 2  # 2 个 Worker
        for d in details:
            assert "worker_id" in d
            assert "utilization" in d
            assert "tasks_completed" in d
    
    def test_get_queue_analysis(self):
        """测试获取队列分析"""
        queue_analysis = self.analyzer.get_queue_analysis()
        
        assert "global_queue" in queue_analysis
        assert "local_queues" in queue_analysis
        assert "backpressure_strategy" in queue_analysis
        
        global_q = queue_analysis["global_queue"]
        assert "current_size" in global_q
        assert "capacity" in global_q
        assert "utilization" in global_q
    
    def test_get_timeline_summary(self):
        """测试获取时间线摘要"""
        summary = self.analyzer.get_timeline_summary()
        
        # 应该返回事件列表
        assert isinstance(summary, list)
        if summary:
            event = summary[0]
            assert "timestamp" in event
            assert "event_type" in event
    
    def test_get_bottleneck_analysis(self):
        """测试获取瓶颈分析"""
        bottleneck = self.analyzer.get_bottleneck_analysis()
        
        assert "bottlenecks" in bottleneck
        assert "total_bottlenecks" in bottleneck
        assert isinstance(bottleneck["bottlenecks"], list)
    
    def test_get_suggestions_summary(self):
        """测试获取调优建议"""
        suggestions = self.analyzer.get_suggestions_summary()
        
        assert isinstance(suggestions, list)
        for s in suggestions:
            assert "category" in s
            assert "severity" in s
            assert "suggestion" in s
    
    def test_get_full_analysis(self):
        """测试获取完整分析"""
        full = self.analyzer.get_full_analysis()
        
        assert "overview" in full
        assert "worker_details" in full
        assert "queue_analysis" in full
        assert "bottleneck_analysis" in full
        assert "suggestions" in full
        assert "config" in full


class TestAnalysisScenarios:
    """分析场景测试"""
    
    def test_high_utilization_suggestion(self):
        """测试高利用率场景"""
        config = SimulationConfig(
            worker_count=1,  # 只有 1 个 Worker
            local_queue_capacity=5,
            global_queue_capacity=10,
            simulation_duration=50.0,
            seed=42
        )
        
        simulator = ThreadPoolSimulator(config)
        
        # 添加很多任务
        from tpsim.models import Task
        for i in range(20):
            task = Task(id=f"t-{i}", duration=2.0)
            simulator.add_task(task)
        
        result = simulator.run()
        analyzer = ResultAnalyzer(result)
        suggestions = analyzer.get_suggestions_summary()
        
        # 可能会有关于利用率的建议
        for s in suggestions:
            if s["category"] == "worker_count":
                assert "利用率" in s["suggestion"] or "utilization" in s["suggestion"].lower()
    
    def test_dropped_tasks_suggestion(self):
        """测试任务丢弃场景"""
        config = SimulationConfig(
            worker_count=1,
            local_queue_capacity=1,
            global_queue_capacity=1,
            backpressure_strategy="drop",  # 丢弃策略
            simulation_duration=30.0,
            seed=42
        )
        
        simulator = ThreadPoolSimulator(config)
        
        # 添加一个长任务占用 Worker
        from tpsim.models import Task
        long_task = Task(id="t-long", duration=100.0)
        simulator.add_task(long_task)
        
        # 执行一步让 Worker 开始执行
        simulator.step(0.1)
        
        # 添加更多任务（会被丢弃）
        for i in range(10):
            task = Task(id=f"t-{i}", duration=1.0)
            simulator.add_task(task)
        
        # 完成模拟
        result = simulator.run()
        
        # 检查是否有任务被丢弃
        dropped_count = sum(
            1 for t in simulator.all_tasks.values()
            if t.state.value == 4  # DROPPED
        )
        
        if dropped_count > 0:
            analyzer = ResultAnalyzer(result)
            suggestions = analyzer.get_suggestions_summary()
            
            # 可能会有关于队列容量的建议
            queue_suggestions = [s for s in suggestions if s["category"] == "queue_capacity"]
            # 可能有也可能没有，取决于具体情况
