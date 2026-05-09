import pytest
from datetime import date
from task_compensation.models import Task
from task_compensation.core.task_registry import TaskRegistry
from task_compensation.core.compensation_planner import CompensationPlanner


class TestCompensationPlanner:
    def setup_method(self):
        self.registry = TaskRegistry()
        
        task_a = Task(
            task_id="A", task_name="任务A",
            cron_expression="0 2 * * *",
            dependencies=[]
        )
        task_b = Task(
            task_id="B", task_name="任务B",
            cron_expression="0 3 * * *",
            dependencies=["A"]
        )
        task_c = Task(
            task_id="C", task_name="任务C",
            cron_expression="0 4 * * *",
            dependencies=["B"]
        )
        
        self.registry.register(task_a)
        self.registry.register(task_b)
        self.registry.register(task_c)
        
        self.planner = CompensationPlanner(
            registry=self.registry,
            enable_idempotency_check=False
        )
    
    def test_create_plan_basic(self):
        target_date = date(2024, 1, 15)
        
        plan = self.planner.create_plan(
            target_date=target_date,
            missed_task_ids=["C"],
            include_dependencies=True
        )
        
        assert plan.target_date == target_date
        assert "C" in plan.missed_tasks
        assert len(plan.steps) == 3
    
    def test_create_plan_include_dependencies(self):
        target_date = date(2024, 1, 15)
        
        plan = self.planner.create_plan(
            target_date=target_date,
            missed_task_ids=["C"],
            include_dependencies=True
        )
        
        task_ids_in_plan = [step.task_id for step in plan.steps]
        
        assert "A" in task_ids_in_plan
        assert "B" in task_ids_in_plan
        assert "C" in task_ids_in_plan
    
    def test_create_plan_without_dependencies(self):
        target_date = date(2024, 1, 15)
        
        plan = self.planner.create_plan(
            target_date=target_date,
            missed_task_ids=["C"],
            include_dependencies=False
        )
        
        task_ids_in_plan = [step.task_id for step in plan.steps]
        
        assert "A" not in task_ids_in_plan
        assert "B" not in task_ids_in_plan
        assert "C" in task_ids_in_plan
    
    def test_execution_order(self):
        target_date = date(2024, 1, 15)
        
        plan = self.planner.create_plan(
            target_date=target_date,
            missed_task_ids=["C"],
            include_dependencies=True
        )
        
        task_ids = [step.task_id for step in plan.steps]
        
        assert task_ids.index("A") < task_ids.index("B")
        assert task_ids.index("B") < task_ids.index("C")
    
    def test_validate_plan_valid(self):
        target_date = date(2024, 1, 15)
        
        plan = self.planner.create_plan(
            target_date=target_date,
            missed_task_ids=["C"],
            include_dependencies=True
        )
        
        errors = self.planner.validate_plan(plan)
        
        assert len(errors) == 0
    
    def test_validate_plan_invalid_order(self):
        from task_compensation.models import CompensationPlan, CompensationStep
        import uuid
        
        target_date = date(2024, 1, 15)
        
        plan = CompensationPlan(
            plan_id=str(uuid.uuid4()),
            generated_at=__import__('datetime').datetime.now(),
            target_date=target_date,
            missed_tasks=["C"],
            steps=[
                CompensationStep(
                    step_id=1, task_id="C", task_name="任务C",
                    execution_date=target_date, dependencies=["B"],
                    action="execute"
                ),
                CompensationStep(
                    step_id=2, task_id="A", task_name="任务A",
                    execution_date=target_date, dependencies=[],
                    action="execute"
                ),
            ],
            total_steps=2
        )
        
        errors = self.planner.validate_plan(plan)
        
        assert len(errors) > 0
        assert any("依赖" in err for err in errors)
    
    def test_plan_has_warnings_for_missing_task(self):
        target_date = date(2024, 1, 15)
        
        plan = self.planner.create_plan(
            target_date=target_date,
            missed_task_ids=["non_existent_task"],
            include_dependencies=True
        )
        
        assert len(plan.warnings) > 0
        assert any("不存在" in w for w in plan.warnings)
