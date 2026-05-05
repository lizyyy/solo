"""模拟器核心测试"""

import pytest
from tpsim.models import (
    SimulationConfig, Task, Worker, TaskState, WorkerState, DropReason
)
from tpsim.simulator import ThreadPoolSimulator


class TestTask:
    """任务模型测试"""
    
    def test_task_creation(self):
        """测试任务创建"""
        task = Task(
            id="t-0",
            name="test-task",
            duration=2.0,
            priority=1
        )
        
        assert task.id == "t-0"
        assert task.name == "test-task"
        assert task.duration == 2.0
        assert task.priority == 1
        assert task.state == TaskState.PENDING
        assert task.is_ready is True
    
    def test_task_with_dependencies(self):
        """测试带依赖的任务"""
        task = Task(
            id="t-1",
            duration=1.0,
            dependencies=["t-0"]
        )
        
        assert len(task.dependencies) == 1
        assert task.is_ready is False
    
    def test_task_wait_time(self):
        """测试等待时间计算"""
        task = Task(id="t-0", duration=1.0)
        task.queued_time = 10.0
        task.start_time = 15.0
        
        assert task.wait_time == 5.0
    
    def test_task_turnaround_time(self):
        """测试周转时间计算"""
        task = Task(id="t-0", duration=1.0)
        task.created_time = 10.0
        task.end_time = 20.0
        
        assert task.turnaround_time == 10.0


class TestWorker:
    """Worker 模型测试"""
    
    def test_worker_creation(self):
        """测试 Worker 创建"""
        worker = Worker(
            id="w-0",
            name="Worker-0",
            local_queue_capacity=10
        )
        
        assert worker.id == "w-0"
        assert worker.state == WorkerState.IDLE
        assert worker.local_queue_capacity == 10
        assert worker.local_queue_size == 0
        assert worker.is_local_queue_full is False
    
    def test_worker_utilization(self):
        """测试利用率计算"""
        worker = Worker(id="w-0")
        worker.total_busy_time = 60.0
        worker.total_idle_time = 40.0
        
        assert worker.utilization == 0.6


class TestSimulatorBasic:
    """模拟器基础测试"""
    
    def test_simulator_creation(self):
        """测试模拟器创建"""
        config = SimulationConfig(
            worker_count=4,
            local_queue_capacity=10,
            global_queue_capacity=100
        )
        
        simulator = ThreadPoolSimulator(config)
        
        assert len(simulator.workers) == 4
        assert simulator.global_queue_capacity == 100
        assert simulator.current_time == 0.0
    
    def test_add_task(self):
        """测试添加任务"""
        config = SimulationConfig(worker_count=2, global_queue_capacity=10)
        simulator = ThreadPoolSimulator(config)
        
        task = Task(id="t-0", duration=1.0)
        result = simulator.add_task(task)
        
        assert result is True
        assert "t-0" in simulator.all_tasks
    
    def test_task_with_dependencies_blocked(self):
        """测试带依赖的任务被阻塞"""
        config = SimulationConfig(worker_count=2)
        simulator = ThreadPoolSimulator(config)
        
        # t-1 依赖 t-0
        task0 = Task(id="t-0", duration=1.0)
        task1 = Task(id="t-1", duration=1.0, dependencies=["t-0"])
        
        simulator.add_task(task0)
        simulator.add_task(task1)
        
        assert task1.state == TaskState.BLOCKED
        assert task1.is_ready is False


class TestSimulatorExecution:
    """模拟器执行测试"""
    
    def test_simple_simulation(self):
        """测试简单模拟"""
        config = SimulationConfig(
            worker_count=2,
            global_queue_capacity=10,
            simulation_duration=10.0,
            seed=42
        )
        
        simulator = ThreadPoolSimulator(config)
        
        # 添加一些简单任务
        for i in range(5):
            task = Task(
                id=f"t-{i}",
                duration=1.0
            )
            simulator.add_task(task)
        
        result = simulator.run()
        
        # 所有任务应该都能完成
        assert result.task_stats.total_tasks == 5
        assert result.task_stats.completed > 0
        assert simulator.current_time > 0
    
    def test_task_completion(self):
        """测试任务完成"""
        config = SimulationConfig(
            worker_count=1,
            global_queue_capacity=10,
            simulation_duration=20.0
        )
        
        simulator = ThreadPoolSimulator(config)
        
        # 添加一个任务
        task = Task(id="t-0", duration=3.0)
        simulator.add_task(task)
        
        result = simulator.run()
        
        # 任务应该已完成
        assert result.task_stats.completed == 1
        assert task.state == TaskState.COMPLETED
        assert task.start_time is not None
        assert task.end_time is not None


class TestBackpressure:
    """背压测试"""
    
    def test_drop_strategy(self):
        """测试丢弃策略"""
        config = SimulationConfig(
            worker_count=1,
            local_queue_capacity=1,
            global_queue_capacity=1,
            backpressure_strategy="drop"
        )
        
        simulator = ThreadPoolSimulator(config)
        
        # Worker 正在执行一个长任务
        running_task = Task(id="t-long", duration=100.0)
        simulator.add_task(running_task)
        
        # 快速执行一步让 Worker 开始执行
        simulator.step(0.1)
        
        # 现在添加更多任务，队列会满
        for i in range(10):
            task = Task(id=f"t-{i}", duration=1.0)
            simulator.add_task(task)
        
        # 应该有任务被丢弃
        assert len(simulator.completed_tasks) == 0  # 长任务还在运行
        
        # 检查有任务被丢弃
        dropped_count = sum(
            1 for t in simulator.all_tasks.values() 
            if t.state == TaskState.DROPPED
        )
        assert dropped_count > 0


class TestWorkStealing:
    """工作窃取测试"""
    
    def test_work_stealing_enabled(self):
        """测试工作窃取启用"""
        config = SimulationConfig(
            worker_count=4,
            use_work_stealing=True,
            steal_from="random"
        )
        
        simulator = ThreadPoolSimulator(config)
        assert simulator.config.use_work_stealing is True
    
    def test_work_stealing_disabled(self):
        """测试工作窃取禁用"""
        config = SimulationConfig(
            worker_count=4,
            use_work_stealing=False
        )
        
        simulator = ThreadPoolSimulator(config)
        assert simulator.config.use_work_stealing is False


class TestStatistics:
    """统计测试"""
    
    def test_worker_stats(self):
        """测试 Worker 统计"""
        config = SimulationConfig(
            worker_count=2,
            simulation_duration=10.0
        )
        
        simulator = ThreadPoolSimulator(config)
        
        # 添加任务
        for i in range(4):
            task = Task(id=f"t-{i}", duration=1.0)
            simulator.add_task(task)
        
        result = simulator.run()
        
        # 应该有 Worker 统计
        assert len(result.worker_stats) == 2
        for ws in result.worker_stats:
            assert ws.worker_id.startswith("w-")
    
    def test_task_stats(self):
        """测试任务统计"""
        config = SimulationConfig(
            worker_count=2,
            simulation_duration=20.0
        )
        
        simulator = ThreadPoolSimulator(config)
        
        # 添加 10 个任务
        for i in range(10):
            task = Task(id=f"t-{i}", duration=1.0)
            simulator.add_task(task)
        
        result = simulator.run()
        
        assert result.task_stats.total_tasks == 10
        assert result.task_stats.completed <= 10
        assert result.task_stats.throughput >= 0
