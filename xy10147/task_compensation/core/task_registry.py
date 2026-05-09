from __future__ import annotations

import json
import os
from typing import Dict, List, Optional, Callable, Any
from datetime import datetime

from task_compensation.models import Task, DependencyGraph


class TaskRegistry:
    def __init__(self):
        self._tasks: Dict[str, Task] = {}
        self._graph: DependencyGraph = DependencyGraph()
    
    def register(self, task: Task) -> None:
        if task.task_id in self._tasks:
            raise ValueError(f"任务 {task.task_id} 已存在")
        
        self._tasks[task.task_id] = task
        self._graph.add_task(task)
    
    def register_batch(self, tasks: List[Task]) -> None:
        for task in tasks:
            self.register(task)
    
    def get_task(self, task_id: str) -> Optional[Task]:
        return self._tasks.get(task_id)
    
    def get_all_tasks(self) -> List[Task]:
        return list(self._tasks.values())
    
    def get_active_tasks(self) -> List[Task]:
        return [t for t in self._tasks.values() if t.active]
    
    def remove_task(self, task_id: str) -> None:
        if task_id not in self._tasks:
            raise ValueError(f"任务 {task_id} 不存在")
        
        del self._tasks[task_id]
        self._rebuild_graph()
    
    def get_dependency_graph(self) -> DependencyGraph:
        return self._graph
    
    def validate_dependencies(self) -> List[str]:
        errors = []
        
        for task_id, task in self._tasks.items():
            for dep in task.dependencies:
                if dep not in self._tasks:
                    errors.append(f"任务 {task_id} 依赖不存在的任务 {dep}")
        
        if not self._graph.validate_no_cycles():
            errors.append("检测到循环依赖")
        
        return errors
    
    def _rebuild_graph(self) -> None:
        self._graph = DependencyGraph()
        for task in self._tasks.values():
            self._graph.add_task(task)
    
    def get_execution_order(self, task_ids: Optional[List[str]] = None) -> List[str]:
        if task_ids is None:
            task_ids = list(self._tasks.keys())
        
        return self._graph.topological_sort(task_ids)
    
    def export_to_json(self, file_path: str) -> None:
        data = []
        for task in self._tasks.values():
            task_dict = task.dict(exclude={"handler"})
            if task.handler is not None:
                task_dict["handler_name"] = task.handler.__name__
            data.append(task_dict)
        
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    
    @classmethod
    def load_from_json(cls, file_path: str, handlers: Optional[Dict[str, Callable]] = None) -> 'TaskRegistry':
        handlers = handlers or {}
        registry = cls()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            tasks_data = json.load(f)
        
        for task_data in tasks_data:
            handler_name = task_data.pop('handler_name', None)
            handler = handlers.get(handler_name) if handler_name else None
            
            task = Task(**task_data)
            if handler:
                task.handler = handler
            registry.register(task)
        
        return registry
    
    def get_task_by_name(self, task_name: str) -> Optional[Task]:
        for task in self._tasks.values():
            if task.task_name == task_name:
                return task
        return None
    
    def __contains__(self, task_id: str) -> bool:
        return task_id in self._tasks
    
    def __len__(self) -> int:
        return len(self._tasks)
