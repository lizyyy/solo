from __future__ import annotations

import time
from datetime import date
from typing import Dict, Any

from task_compensation.models import Task
from task_compensation.core.task_registry import TaskRegistry


def task_extract_data(context: Dict[str, Any]) -> Dict[str, Any]:
    print(f"[TASK] 执行数据抽取: {context['execution_date']}")
    time.sleep(0.5)
    return {
        "status": "success",
        "records_extracted": 1000,
        "source": "database"
    }


def task_transform_data(context: Dict[str, Any]) -> Dict[str, Any]:
    print(f"[TASK] 执行数据转换: {context['execution_date']}")
    time.sleep(0.3)
    return {
        "status": "success",
        "records_transformed": 950,
        "rejects": 50
    }


def task_load_data(context: Dict[str, Any]) -> Dict[str, Any]:
    print(f"[TASK] 执行数据加载: {context['execution_date']}")
    time.sleep(0.8)
    return {
        "status": "success",
        "records_loaded": 950,
        "target": "warehouse"
    }


def task_generate_report(context: Dict[str, Any]) -> Dict[str, Any]:
    print(f"[TASK] 生成报表: {context['execution_date']}")
    time.sleep(0.4)
    return {
        "status": "success",
        "report_path": "/reports/daily.pdf"
    }


def task_cleanup_temp(context: Dict[str, Any]) -> Dict[str, Any]:
    print(f"[TASK] 清理临时文件: {context['execution_date']}")
    time.sleep(0.2)
    return {
        "status": "success",
        "files_cleaned": 15
    }


def create_example_tasks() -> TaskRegistry:
    registry = TaskRegistry()
    
    tasks = [
        Task(
            task_id="extract_data",
            task_name="数据抽取",
            task_type="batch",
            cron_expression="0 2 * * *",
            timeout=3600,
            retries=2,
            dependencies=[],
            idempotency_key="extract_{date}",
            handler=task_extract_data,
            metadata={"estimated_duration_seconds": 60, "priority": 1}
        ),
        Task(
            task_id="transform_data",
            task_name="数据转换",
            task_type="batch",
            cron_expression="0 3 * * *",
            timeout=1800,
            retries=1,
            dependencies=["extract_data"],
            idempotency_key="transform_{date}",
            handler=task_transform_data,
            metadata={"estimated_duration_seconds": 45, "priority": 2}
        ),
        Task(
            task_id="load_data",
            task_name="数据加载",
            task_type="batch",
            cron_expression="0 4 * * *",
            timeout=7200,
            retries=3,
            dependencies=["transform_data"],
            idempotency_key="load_{date}",
            handler=task_load_data,
            metadata={"estimated_duration_seconds": 120, "priority": 3}
        ),
        Task(
            task_id="generate_report",
            task_name="生成日报表",
            task_type="report",
            cron_expression="0 5 * * *",
            timeout=600,
            retries=1,
            dependencies=["load_data"],
            idempotency_key="report_{date}",
            handler=task_generate_report,
            metadata={"estimated_duration_seconds": 30, "priority": 4}
        ),
        Task(
            task_id="cleanup_temp",
            task_name="清理临时文件",
            task_type="maintenance",
            cron_expression="0 6 * * *",
            timeout=300,
            retries=0,
            dependencies=["load_data", "generate_report"],
            idempotency_key="cleanup_{date}",
            handler=task_cleanup_temp,
            metadata={"estimated_duration_seconds": 20, "priority": 5}
        )
    ]
    
    registry.register_batch(tasks)
    return registry


if __name__ == "__main__":
    registry = create_example_tasks()
    
    print("已注册的任务:")
    for task in registry.get_all_tasks():
        print(f"  - {task.task_id}: {task.task_name}")
        if task.dependencies:
            print(f"    依赖: {', '.join(task.dependencies)}")
    
    print("\n执行顺序:")
    order = registry.get_execution_order()
    for i, task_id in enumerate(order, 1):
        print(f"  {i}. {task_id}")
