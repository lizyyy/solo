import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class Region:
    id: str
    name: str
    endpoint: str
    type: str = "redis"
    timeout: int = 5


@dataclass
class Task:
    id: str
    template: str
    variables: Dict[str, str]
    expected_value: str
    skip_regions: List[str] = field(default_factory=list)
    skip_reason: Optional[str] = None


class ConfigLoader:
    def __init__(self, regions_file: str, templates_file: str, tasks_file: str):
        self.regions_file = Path(regions_file)
        self.templates_file = Path(templates_file)
        self.tasks_file = Path(tasks_file)

    def load_regions(self) -> Dict[str, Region]:
        with open(self.regions_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        regions = {}
        for item in data.get('regions', []):
            region = Region(
                id=item['id'],
                name=item['name'],
                endpoint=item['endpoint'],
                type=item.get('type', 'redis'),
                timeout=item.get('timeout', 5)
            )
            regions[region.id] = region
        return regions

    def load_tasks(self) -> List[Task]:
        with open(self.tasks_file, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        tasks = []
        for item in data.get('tasks', []):
            task = Task(
                id=item['id'],
                template=item['template'],
                variables=item.get('variables', {}),
                expected_value=item['expected_value'],
                skip_regions=item.get('skip_regions', []),
                skip_reason=item.get('skip_reason')
            )
            tasks.append(task)
        return tasks
