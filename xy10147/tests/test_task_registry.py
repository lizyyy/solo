import pytest
from datetime import date
from task_compensation.models import Task
from task_compensation.core.task_registry import TaskRegistry


class TestTaskRegistry:
    def test_register_task(self):
        registry = TaskRegistry()
        task = Task(
            task_id="test_task",
            task_name="测试任务",
            cron_expression="0 2 * * *"
        )
        
        registry.register(task)
        
        assert len(registry) == 1
        assert "test_task" in registry
        assert registry.get_task("test_task") is task
    
    def test_register_duplicate_task(self):
        registry = TaskRegistry()
        task1 = Task(task_id="test", task_name="任务1", cron_expression="0 2 * * *")
        task2 = Task(task_id="test", task_name="任务2", cron_expression="0 3 * * *")
        
        registry.register(task1)
        
        with pytest.raises(ValueError, match="已存在"):
            registry.register(task2)
    
    def test_register_batch(self):
        registry = TaskRegistry()
        tasks = [
            Task(task_id=f"task{i}", task_name=f"任务{i}", cron_expression="0 2 * * *")
            for i in range(3)
        ]
        
        registry.register_batch(tasks)
        
        assert len(registry) == 3
    
    def test_get_all_tasks(self):
        registry = TaskRegistry()
        task1 = Task(task_id="active", task_name="活跃", cron_expression="0 2 * * *", active=True)
        task2 = Task(task_id="inactive", task_name="禁用", cron_expression="0 2 * * *", active=False)
        
        registry.register(task1)
        registry.register(task2)
        
        assert len(registry.get_all_tasks()) == 2
        assert len(registry.get_active_tasks()) == 1
    
    def test_remove_task(self):
        registry = TaskRegistry()
        task = Task(task_id="test", task_name="测试", cron_expression="0 2 * * *")
        
        registry.register(task)
        registry.remove_task("test")
        
        assert len(registry) == 0
        assert "test" not in registry
    
    def test_dependency_graph(self):
        registry = TaskRegistry()
        
        task_a = Task(task_id="A", task_name="A", cron_expression="0 2 * * *", dependencies=[])
        task_b = Task(task_id="B", task_name="B", cron_expression="0 3 * * *", dependencies=["A"])
        task_c = Task(task_id="C", task_name="C", cron_expression="0 4 * * *", dependencies=["A", "B"])
        
        registry.register(task_a)
        registry.register(task_b)
        registry.register(task_c)
        
        graph = registry.get_dependency_graph()
        deps = graph.get_transitive_dependencies("C")
        
        assert deps == {"A", "B"}
    
    def test_topological_sort(self):
        registry = TaskRegistry()
        
        task_a = Task(task_id="A", task_name="A", cron_expression="0 2 * * *")
        task_b = Task(task_id="B", task_name="B", cron_expression="0 3 * * *", dependencies=["A"])
        task_c = Task(task_id="C", task_name="C", cron_expression="0 4 * * *", dependencies=["B"])
        
        registry.register(task_a)
        registry.register(task_b)
        registry.register(task_c)
        
        order = registry.get_execution_order()
        
        assert order.index("A") < order.index("B")
        assert order.index("B") < order.index("C")
    
    def test_circular_dependency_detection(self):
        from task_compensation.models import DependencyGraph
        
        task_a = Task(task_id="A", task_name="A", cron_expression="0 2 * * *", dependencies=["C"])
        task_b = Task(task_id="B", task_name="B", cron_expression="0 3 * * *", dependencies=["A"])
        task_c = Task(task_id="C", task_name="C", cron_expression="0 4 * * *", dependencies=["B"])
        
        graph = DependencyGraph()
        graph.add_task(task_a)
        graph.add_task(task_b)
        graph.add_task(task_c)
        
        assert graph.validate_no_cycles() == False
    
    def test_missing_dependency_detection(self):
        registry = TaskRegistry()
        
        task = Task(
            task_id="A",
            task_name="A",
            cron_expression="0 2 * * *",
            dependencies=["B"]
        )
        
        registry.register(task)
        
        errors = registry.validate_dependencies()
        
        assert len(errors) > 0
        assert any("依赖不存在的任务 B" in err for err in errors)
    
    def test_export_and_load_json(self, tmp_path):
        registry = TaskRegistry()
        task = Task(
            task_id="test",
            task_name="测试任务",
            cron_expression="0 2 * * *",
            timeout=60,
            retries=2,
            metadata={"key": "value"}
        )
        registry.register(task)
        
        file_path = tmp_path / "tasks.json"
        registry.export_to_json(str(file_path))
        
        loaded = TaskRegistry.load_from_json(str(file_path))
        
        assert len(loaded) == 1
        loaded_task = loaded.get_task("test")
        assert loaded_task.task_name == "测试任务"
        assert loaded_task.timeout == 60
        assert loaded_task.retries == 2
        assert loaded_task.metadata == {"key": "value"}
