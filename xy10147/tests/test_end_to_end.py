import pytest
import tempfile
import os
import shutil
from datetime import date, timedelta

from task_compensation.models import Task, SystemConfig
from task_compensation.core.task_registry import TaskRegistry
from task_compensation.core.compensation_workflow import CompensationWorkflow


class TestEndToEnd:
    def setup_method(self):
        self.test_dir = tempfile.mkdtemp()
        self.records_dir = os.path.join(self.test_dir, "records")
        self.reports_dir = os.path.join(self.test_dir, "reports")
        self.idempotency_dir = os.path.join(self.test_dir, "idempotency")
        os.makedirs(self.records_dir, exist_ok=True)
        os.makedirs(self.reports_dir, exist_ok=True)
        os.makedirs(self.idempotency_dir, exist_ok=True)
    
    def teardown_method(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
    
    def test_full_workflow(self):
        registry = TaskRegistry()
        
        success_count = {"extract": 0, "transform": 0, "load": 0}
        
        def success_handler(context):
            task_name = context["task_id"]
            if task_name in success_count:
                success_count[task_name] += 1
            return {"status": "ok", "task": task_name}
        
        tasks = [
            Task(
                task_id="extract",
                task_name="Extract",
                cron_expression="0 2 * * *",
                timeout=60,
                retries=1,
                dependencies=[],
                idempotency_key="extract",
                handler=success_handler
            ),
            Task(
                task_id="transform",
                task_name="Transform",
                cron_expression="0 3 * * *",
                timeout=60,
                retries=1,
                dependencies=["extract"],
                idempotency_key="transform",
                handler=success_handler
            ),
            Task(
                task_id="load",
                task_name="Load",
                cron_expression="0 4 * * *",
                timeout=60,
                retries=1,
                dependencies=["transform"],
                idempotency_key="load",
                handler=success_handler
            )
        ]
        
        registry.register_batch(tasks)
        
        config = SystemConfig(
            data_dir=self.test_dir,
            records_dir=self.records_dir,
            reports_dir=self.reports_dir,
            enable_idempotency_check=True
        )
        
        workflow = CompensationWorkflow(registry=registry, config=config)
        
        target_date = date.today() - timedelta(days=1)
        
        report = workflow.run(
            target_date=target_date,
            dry_run=False,
            export_formats=["json"]
        )
        
        assert report is not None
        assert report.total_tasks == 3
        assert report.success_count == 3
        assert report.failed_count == 0
        assert report.get_success_rate() == 100.0
        
        assert success_count["extract"] == 1
        assert success_count["transform"] == 1
        assert success_count["load"] == 1
    
    def test_already_successful_task_not_detected_as_missed(self):
        registry = TaskRegistry()
        
        success_count = {"task_a": 0}
        
        def handler(context):
            success_count["task_a"] += 1
            return {"status": "ok"}
        
        task = Task(
            task_id="task_a",
            task_name="Task A",
            cron_expression="0 2 * * *",
            timeout=60,
            retries=0,
            dependencies=[],
            idempotency_key="task_a",
            handler=handler
        )
        
        registry.register(task)
        
        config = SystemConfig(
            data_dir=self.test_dir,
            records_dir=self.records_dir,
            reports_dir=self.reports_dir,
            enable_idempotency_check=True
        )
        
        workflow = CompensationWorkflow(registry=registry, config=config)
        
        target_date = date.today() - timedelta(days=1)
        
        report1 = workflow.run(
            target_date=target_date,
            specific_task_ids=["task_a"],
            dry_run=False,
            export_formats=[]
        )
        
        assert report1.success_count == 1
        assert success_count["task_a"] == 1
        
        report2 = workflow.run(
            target_date=target_date,
            dry_run=False,
            export_formats=[]
        )
        
        assert report2.total_tasks == 0
        assert report2.success_count == 0
        assert success_count["task_a"] == 1
    
    def test_missing_dependency_included(self):
        registry = TaskRegistry()
        
        executed = []
        
        def handler(context):
            executed.append(context["task_id"])
            return {"status": "ok"}
        
        task_a = Task(
            task_id="A",
            task_name="A",
            cron_expression="0 2 * * *",
            timeout=60,
            dependencies=[],
            idempotency_key="A",
            handler=handler
        )
        
        task_b = Task(
            task_id="B",
            task_name="B",
            cron_expression="0 3 * * *",
            timeout=60,
            dependencies=["A"],
            idempotency_key="B",
            handler=handler
        )
        
        task_c = Task(
            task_id="C",
            task_name="C",
            cron_expression="0 4 * * *",
            timeout=60,
            dependencies=["B"],
            idempotency_key="C",
            handler=handler
        )
        
        registry.register(task_a)
        registry.register(task_b)
        registry.register(task_c)
        
        config = SystemConfig(
            data_dir=self.test_dir,
            records_dir=self.records_dir,
            reports_dir=self.reports_dir,
            enable_idempotency_check=False
        )
        
        workflow = CompensationWorkflow(registry=registry, config=config)
        
        target_date = date.today() - timedelta(days=1)
        
        report = workflow.run(
            target_date=target_date,
            specific_task_ids=["C"],
            dry_run=False,
            export_formats=[]
        )
        
        assert report.total_tasks == 3
        assert report.success_count == 3
        
        assert executed.index("A") < executed.index("B")
        assert executed.index("B") < executed.index("C")
