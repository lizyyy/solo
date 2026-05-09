import pytest
from datetime import date, timedelta
from task_compensation.models import Task
from task_compensation.core.input_validator import (
    TaskValidator, InputValidator, ValidationResult
)


class TestTaskValidator:
    def setup_method(self):
        self.validator = TaskValidator()
    
    def test_valid_task(self):
        task = Task(
            task_id="valid_task_123",
            task_name="有效任务",
            cron_expression="0 2 * * *",
            timeout=3600,
            retries=2
        )
        
        result = self.validator.validate(task)
        
        assert result.is_valid == True
        assert len(result.errors) == 0
    
    def test_invalid_task_id_empty(self):
        with pytest.raises(Exception):
            Task(
                task_id="",
                task_name="测试",
                cron_expression="0 2 * * *"
            )
    
    def test_invalid_task_id_format(self):
        task = Task(
            task_id="invalid@id!#",
            task_name="测试",
            cron_expression="0 2 * * *"
        )
        
        result = self.validator.validate(task)
        
        assert result.is_valid == False
        assert any("invalid_format" in (e.code or "") for e in result.errors)
    
    def test_invalid_task_id_too_long(self):
        with pytest.raises(Exception):
            Task(
                task_id="a" * 300,
                task_name="测试",
                cron_expression="0 2 * * *"
            )
    
    def test_invalid_cron_expression(self):
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="invalid"
        )
        
        result = self.validator.validate(task)
        
        assert result.is_valid == False
        assert any("cron_expression" in (e.field or "") for e in result.errors)
    
    def test_invalid_timeout(self):
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="0 2 * * *",
            timeout=0
        )
        
        result = self.validator.validate(task)
        
        assert result.is_valid == False
        assert any("timeout" in (e.field or "") for e in result.errors)
    
    def test_invalid_retries(self):
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="0 2 * * *",
            retries=-1
        )
        
        result = self.validator.validate(task)
        
        assert result.is_valid == False
        assert any("retries" in (e.field or "") for e in result.errors)
    
    def test_self_dependency(self):
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="0 2 * * *",
            dependencies=["test"]
        )
        
        result = self.validator.validate(task)
        
        assert result.is_valid == False
        assert any("self_dependency" in (e.code or "") for e in result.errors)


class TestInputValidator:
    def setup_method(self):
        self.validator = InputValidator()
    
    def test_validate_tasks_batch(self):
        tasks = [
            Task(task_id=f"task{i}", task_name=f"任务{i}", cron_expression="0 2 * * *")
            for i in range(3)
        ]
        
        result = self.validator.validate_tasks(tasks)
        
        assert result.is_valid == True
    
    def test_validate_valid_date(self):
        yesterday = date.today() - timedelta(days=1)
        
        result = self.validator.validate_date(yesterday)
        
        assert result.is_valid == True
    
    def test_validate_future_date(self):
        future = date.today() + timedelta(days=10)
        
        result = self.validator.validate_date(future, allow_future=False)
        
        assert result.is_valid == False
        assert any("future_date" in (e.code or "") for e in result.errors)
    
    def test_validate_future_date_allowed(self):
        future = date.today() + timedelta(days=10)
        
        result = self.validator.validate_date(future, allow_future=True)
        
        assert result.is_valid == True


class TestValidationResult:
    def test_is_valid_without_errors(self):
        result = ValidationResult()
        
        assert result.is_valid == True
    
    def test_is_valid_with_errors(self):
        result = ValidationResult()
        result.add_error("测试错误")
        
        assert result.is_valid == False
    
    def test_has_warnings(self):
        result = ValidationResult()
        
        assert result.has_warnings == False
        
        result.add_warning("测试警告")
        
        assert result.has_warnings == True
    
    def test_to_dict(self):
        result = ValidationResult()
        result.add_error("错误1", field="field1", code="code1")
        result.add_warning("警告1")
        
        d = result.to_dict()
        
        assert d["is_valid"] == False
        assert len(d["errors"]) == 1
        assert d["errors"][0]["field"] == "field1"
        assert d["errors"][0]["code"] == "code1"
        assert len(d["warnings"]) == 1
