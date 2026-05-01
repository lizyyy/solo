from collections import deque
from typing import Any, Dict, List, Optional, Set


class DependencySorter:
    def __init__(self, schema_config: Any):
        self.schema = schema_config
    
    def sort_tables(self, tables: List[str]) -> List[str]:
        in_degree: Dict[str, int] = {t: 0 for t in tables}
        graph: Dict[str, List[str]] = {t: [] for t in tables}
        table_set = set(tables)
        
        for table in tables:
            dependencies = self.schema.get_dependencies(table)
            for dep in dependencies:
                if dep in table_set:
                    graph[dep].append(table)
                    in_degree[table] += 1
        
        queue = deque([t for t in tables if in_degree[t] == 0])
        result: List[str] = []
        
        while queue:
            current = queue.popleft()
            result.append(current)
            
            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        if len(result) != len(tables):
            remaining = set(tables) - set(result)
            for t in remaining:
                result.append(t)
        
        return result
    
    def sort_for_rollback(self, tables: List[str]) -> List[str]:
        sorted_forward = self.sort_tables(tables)
        return list(reversed(sorted_forward))
