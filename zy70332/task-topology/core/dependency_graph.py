import sys
from pathlib import Path
CORE_DIR = Path(__file__).resolve().parent
ROOT_DIR = CORE_DIR.parent
sys.path.insert(0, str(ROOT_DIR))

from typing import Dict, List, Set, Optional
from collections import deque
from core.models import TaskDefinition, GraphAnalysis, TaskStatus, SkipType
from core.parser import load_task_definitions


class DependencyGraph:
    def __init__(self, tasks: Dict[str, TaskDefinition]):
        self.tasks = tasks
        self.adjacency: Dict[str, List[str]] = {}
        self.reverse_adjacency: Dict[str, List[str]] = {}
        self._build_graph()
    
    def _build_graph(self):
        for task_id in self.tasks:
            self.adjacency[task_id] = []
            self.reverse_adjacency[task_id] = []
        
        for task_id, task in self.tasks.items():
            for dep_id in task.dependencies:
                if dep_id in self.adjacency:
                    self.adjacency[dep_id].append(task_id)
                if task_id in self.reverse_adjacency:
                    self.reverse_adjacency[task_id].append(dep_id)
    
    def get_downstream(self, task_id: str) -> List[str]:
        if task_id not in self.adjacency:
            return []
        
        visited = set()
        result = []
        queue = deque([task_id])
        visited.add(task_id)
        
        while queue:
            current = queue.popleft()
            for neighbor in self.adjacency.get(current, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    result.append(neighbor)
                    queue.append(neighbor)
        
        return result
    
    def get_upstream(self, task_id: str) -> List[str]:
        if task_id not in self.reverse_adjacency:
            return []
        
        visited = set()
        result = []
        queue = deque([task_id])
        visited.add(task_id)
        
        while queue:
            current = queue.popleft()
            for neighbor in self.reverse_adjacency.get(current, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    result.append(neighbor)
                    queue.append(neighbor)
        
        return result
    
    def get_direct_dependencies(self, task_id: str) -> List[str]:
        if task_id not in self.tasks:
            return []
        return self.tasks[task_id].dependencies
    
    def get_direct_dependents(self, task_id: str) -> List[str]:
        return self.adjacency.get(task_id, [])
    
    def analyze_graph(self) -> GraphAnalysis:
        analysis = GraphAnalysis()
        
        all_task_ids = set(self.tasks.keys())
        referenced = set()
        for task_id, task in self.tasks.items():
            for dep in task.dependencies:
                referenced.add(dep)
        
        analysis.missing_dependencies = sorted(list(referenced - all_task_ids))
        
        has_dependents = set()
        for deps in self.adjacency.values():
            for d in deps:
                has_dependents.add(d)
        analysis.orphan_tasks = sorted([
            tid for tid in all_task_ids
            if not self.tasks[tid].dependencies and tid not in has_dependents
        ])
        
        cycles = self._find_cycles()
        analysis.cycles = cycles
        
        analysis.topological_order = self._topological_sort()
        
        return analysis
    
    def _find_cycles(self) -> List[List[str]]:
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {tid: WHITE for tid in self.tasks}
        parent = {tid: None for tid in self.tasks}
        cycles = []
        
        def dfs(node, path):
            color[node] = GRAY
            path.append(node)
            
            for neighbor in self.adjacency.get(node, []):
                if neighbor not in color:
                    continue
                if color[neighbor] == WHITE:
                    parent[neighbor] = node
                    dfs(neighbor, path)
                elif color[neighbor] == GRAY:
                    cycle_start = path.index(neighbor)
                    cycle = path[cycle_start:] + [neighbor]
                    cycles.append(cycle)
            
            color[node] = BLACK
            path.pop()
        
        for node in self.tasks:
            if color[node] == WHITE:
                dfs(node, [])
        
        return cycles
    
    def _topological_sort(self) -> List[str]:
        in_degree = {tid: 0 for tid in self.tasks}
        for tid in self.tasks:
            for neighbor in self.adjacency.get(tid, []):
                if neighbor in in_degree:
                    in_degree[neighbor] += 1
        
        queue = deque([tid for tid in in_degree if in_degree[tid] == 0])
        result = []
        
        while queue:
            node = queue.popleft()
            result.append(node)
            for neighbor in self.adjacency.get(node, []):
                if neighbor in in_degree:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        queue.append(neighbor)
        
        return result
    
    def has_cycle(self) -> bool:
        return len(self._find_cycles()) > 0
    
    def is_dag(self) -> bool:
        return not self.has_cycle()
