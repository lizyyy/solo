import sys
from pathlib import Path
CORE_DIR = Path(__file__).resolve().parent
ROOT_DIR = CORE_DIR.parent
sys.path.insert(0, str(ROOT_DIR))

import yaml
from typing import Dict, List
from core.models import TaskDefinition
from core.config import DEFINITIONS_FILE


def load_task_definitions(file_path: str = None) -> Dict[str, TaskDefinition]:
    path = file_path or DEFINITIONS_FILE
    if not path.exists():
        return {}
    
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f) or {}
    
    tasks = {}
    for task_id, task_data in data.get('tasks', {}).items():
        deps = task_data.get('dependencies', [])
        if isinstance(deps, str):
            deps = [deps]
        
        tasks[task_id] = TaskDefinition(
            task_id=task_id,
            name=task_data.get('name', task_id),
            dependencies=deps,
            description=task_data.get('description', ''),
            group=task_data.get('group', ''),
            category=task_data.get('category', '')
        )
    
    return tasks


def save_task_definitions(tasks: Dict[str, TaskDefinition], file_path: str = None):
    path = file_path or DEFINITIONS_FILE
    data = {'tasks': {}}
    
    for task_id, task in tasks.items():
        data['tasks'][task_id] = {
            'name': task.name,
            'dependencies': task.dependencies,
            'description': task.description,
            'group': task.group,
            'category': task.category
        }
    
    with open(path, 'w', encoding='utf-8') as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)
