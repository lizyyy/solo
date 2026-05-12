from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict, deque
from datetime import datetime

from .models import (
    TableField, SQLTask, Report, APIEndpoint, Owner, Confirmation,
    DependencyNode, DependencyEdge, ImpactResult, DependencyType, NodeType
)
from .sql_parser import SQLParser


class LineageAnalyzer:
    def __init__(
        self,
        table_fields: List[TableField],
        sql_tasks: List[SQLTask],
        reports: List[Report],
        apis: List[APIEndpoint],
        owners: Dict[str, Owner],
        confirmations: Dict[str, Confirmation]
    ):
        self.table_fields = table_fields
        self.sql_tasks = sql_tasks
        self.reports = reports
        self.apis = apis
        self.owners = owners
        self.confirmations = confirmations
        self.sql_parser = SQLParser()
        
        self.field_index: Dict[str, TableField] = {}
        self.task_index: Dict[str, SQLTask] = {}
        self.report_index: Dict[str, Report] = {}
        self.api_index: Dict[str, APIEndpoint] = {}
        
        self.adjacency_list: Dict[str, List[Tuple[str, DependencyType]]] = defaultdict(list)
        self.reverse_adjacency: Dict[str, List[Tuple[str, DependencyType]]] = defaultdict(list)
        
        self.parsed_tasks: Dict[str, Dict] = {}
        
        self._build_indexes()
        self._build_lineage_graph()
    
    def _build_indexes(self):
        for field in self.table_fields:
            self.field_index[field.id] = field
            full_name = f"{field.database}.{field.table_name}.{field.field_name}"
            self.field_index[full_name] = field
            short_name = f"{field.table_name}.{field.field_name}"
            self.field_index[short_name] = field
        
        for task in self.sql_tasks:
            self.task_index[task.id] = task
        
        for report in self.reports:
            self.report_index[report.id] = report
        
        for api in self.apis:
            self.api_index[api.id] = api
    
    def _build_lineage_graph(self):
        for task in self.sql_tasks:
            self._process_sql_task(task)
        
        for report in self.reports:
            self._process_report(report)
        
        for api in self.apis:
            self._process_api(api)
    
    def _process_sql_task(self, task: SQLTask):
        result = self.sql_parser.parse(
            task.sql,
            target_table=task.target_table,
            target_fields=task.target_fields
        )
        
        self.parsed_tasks[task.id] = {
            'result': result,
            'source_fields': result.source_fields,
            'target_fields': result.target_fields,
            'field_dependencies': result.field_dependencies
        }
        
        if result.parse_error:
            task.parse_error = result.parse_error
        
        for target_field_name in result.target_fields:
            target_full_name = f"{result.target_table}.{target_field_name}"
            if target_full_name not in self.field_index:
                self._add_virtual_field(target_full_name)
            
            dependencies = result.field_dependencies.get(target_field_name, [])
            for source_table, source_field in dependencies:
                source_full_name = f"{source_table}.{source_field}"
                matched_source = self._find_field_match(source_full_name)
                if matched_source:
                    self._add_edge(matched_source.id, task.id, DependencyType.DIRECT)
                    self._add_edge(task.id, target_full_name, DependencyType.DIRECT)
    
    def _process_report(self, report: Report):
        for field_name in report.fields:
            matched_field = self._find_field_match(field_name)
            if matched_field:
                self._add_edge(matched_field.id, report.id, DependencyType.DIRECT)
        
        for derived_name, derived_expr in report.derived_fields.items():
            for field_name in self._extract_fields_from_expr(derived_expr):
                matched_field = self._find_field_match(field_name)
                if matched_field:
                    self._add_edge(matched_field.id, report.id, DependencyType.INDIRECT)
    
    def _process_api(self, api: APIEndpoint):
        for api_field, source_field in api.field_mappings.items():
            matched_field = self._find_field_match(source_field)
            if matched_field:
                self._add_edge(matched_field.id, api.id, DependencyType.DIRECT)
    
    def _add_virtual_field(self, field_name: str):
        parts = field_name.split('.')
        if len(parts) >= 2:
            field = TableField(
                id=field_name,
                table_name='.'.join(parts[:-1]),
                field_name=parts[-1],
                description="虚拟字段（从SQL任务派生）"
            )
            self.field_index[field_name] = field
    
    def _find_field_match(self, field_name: str) -> Optional[TableField]:
        if field_name in self.field_index:
            return self.field_index[field_name]
        
        parts = field_name.split('.')
        if len(parts) == 2:
            table_name, col_name = parts
            for fid, field in self.field_index.items():
                if field.table_name == table_name and field.field_name == col_name:
                    return field
        elif len(parts) == 3:
            db, table_name, col_name = parts
            for fid, field in self.field_index.items():
                if (field.database == db and field.table_name == table_name 
                    and field.field_name == col_name):
                    return field
        
        return None
    
    def _extract_fields_from_expr(self, expr: str) -> List[str]:
        import re
        pattern = r'([\w.]+)'
        fields = []
        for match in re.finditer(pattern, expr):
            candidate = match.group(1)
            if '.' in candidate and not candidate.isdigit():
                fields.append(candidate)
        return fields
    
    def _add_edge(self, source: str, target: str, dep_type: DependencyType):
        if (target, dep_type) not in self.adjacency_list[source]:
            self.adjacency_list[source].append((target, dep_type))
        
        if (source, dep_type) not in self.reverse_adjacency[target]:
            self.reverse_adjacency[target].append((source, dep_type))
    
    def analyze_impact(self, field_id: str) -> ImpactResult:
        field = self._find_field_match(field_id)
        if not field:
            return ImpactResult(target_field=field_id)
        
        start_id = field.id
        
        visited_direct: Set[str] = set()
        visited_indirect: Set[str] = set()
        all_visited: Set[str] = set()
        
        queue: deque = deque()
        queue.append((start_id, 0, None))
        
        lineage_chains: Dict[str, List[str]] = defaultdict(list)
        lineage_chains[start_id] = [start_id]
        
        direct_nodes: List[DependencyNode] = []
        indirect_nodes: List[DependencyNode] = []
        
        owners_affected: Set[str] = set()
        unconfirmed_tasks: List[str] = []
        parse_errors: List[str] = []
        missing_owners: List[str] = []
        
        while queue:
            current, level, incoming_type = queue.popleft()
            
            if current in all_visited:
                continue
            all_visited.add(current)
            
            if current != start_id:
                node = self._create_dependency_node(current)
                if node:
                    if level == 1 and incoming_type == DependencyType.DIRECT:
                        if current not in visited_direct:
                            visited_direct.add(current)
                            direct_nodes.append(node)
                    else:
                        if current not in visited_indirect and current not in visited_direct:
                            visited_indirect.add(current)
                            indirect_nodes.append(node)
                    
                    self._check_owner_and_confirmation(
                        node, owners_affected, unconfirmed_tasks, 
                        parse_errors, missing_owners
                    )
            
            for neighbor, dep_type in self.adjacency_list[current]:
                if neighbor not in all_visited:
                    if neighbor not in lineage_chains:
                        lineage_chains[neighbor] = lineage_chains[current] + [neighbor]
                    
                    new_type = incoming_type if incoming_type == DependencyType.INDIRECT else dep_type
                    queue.append((neighbor, level + 1, new_type))
        
        sorted_direct = self._sort_by_type(direct_nodes)
        sorted_indirect = self._sort_by_type(indirect_nodes)
        
        return ImpactResult(
            target_field=field_id,
            direct_dependencies=sorted_direct,
            indirect_dependencies=sorted_indirect,
            owners_affected=sorted(list(owners_affected)),
            unconfirmed_tasks=sorted(unconfirmed_tasks),
            parse_errors=sorted(parse_errors),
            missing_owners=sorted(missing_owners),
            lineage_chain=dict(lineage_chains)
        )
    
    def _create_dependency_node(self, node_id: str) -> Optional[DependencyNode]:
        if node_id in self.task_index:
            task = self.task_index[node_id]
            return DependencyNode(
                id=node_id,
                node_type=NodeType.SQL_TASK,
                name=task.name,
                metadata={'owner': task.owner, 'parse_error': task.parse_error}
            )
        elif node_id in self.report_index:
            report = self.report_index[node_id]
            return DependencyNode(
                id=node_id,
                node_type=NodeType.REPORT,
                name=report.name,
                metadata={'owner': report.owner, 'dashboard': report.dashboard}
            )
        elif node_id in self.api_index:
            api = self.api_index[node_id]
            return DependencyNode(
                id=node_id,
                node_type=NodeType.API,
                name=api.name,
                metadata={'owner': api.owner, 'path': api.path}
            )
        elif node_id in self.field_index:
            field = self.field_index[node_id]
            return DependencyNode(
                id=node_id,
                node_type=NodeType.TABLE_FIELD,
                name=field.full_name,
                metadata={'description': field.description}
            )
        return None
    
    def _check_owner_and_confirmation(
        self,
        node: DependencyNode,
        owners_affected: Set[str],
        unconfirmed_tasks: List[str],
        parse_errors: List[str],
        missing_owners: List[str]
    ):
        owner_id = node.metadata.get('owner', '')
        if owner_id:
            if owner_id not in self.owners:
                missing_owners.append(node.id)
            else:
                owners_affected.add(owner_id)
        else:
            missing_owners.append(node.id)
        
        if node.id in self.confirmations:
            conf = self.confirmations[node.id]
            if not conf.confirmed:
                unconfirmed_tasks.append(node.id)
        else:
            unconfirmed_tasks.append(node.id)
        
        if node.metadata.get('parse_error'):
            parse_errors.append(node.id)
    
    def _sort_by_type(self, nodes: List[DependencyNode]) -> List[DependencyNode]:
        type_order = {
            NodeType.SQL_TASK: 0,
            NodeType.API: 1,
            NodeType.REPORT: 2,
            NodeType.TABLE_FIELD: 3
        }
        return sorted(nodes, key=lambda n: (type_order.get(n.node_type, 99), n.name))
    
    def get_owner_summary(self, owner_id: str) -> Dict:
        owner = self.owners.get(owner_id)
        if not owner:
            return {'owner': None, 'tasks': [], 'reports': [], 'apis': []}
        
        tasks = [t for t in self.sql_tasks if t.owner == owner_id]
        reports = [r for r in self.reports if r.owner == owner_id]
        apis = [a for a in self.apis if a.owner == owner_id]
        
        return {
            'owner': owner,
            'tasks': tasks,
            'reports': reports,
            'apis': apis
        }
    
    def confirm_migration(self, node_id: str, confirmed_by: str, notes: str = "") -> Confirmation:
        node = self._create_dependency_node(node_id)
        if not node:
            raise ValueError(f"节点 {node_id} 不存在")
        
        conf = Confirmation(
            node_id=node_id,
            node_type=node.node_type,
            confirmed=True,
            confirmed_at=datetime.now(),
            confirmed_by=confirmed_by,
            notes=notes
        )
        self.confirmations[node_id] = conf
        return conf
    
    def get_unconfirmed_by_owner(self) -> Dict[str, List[DependencyNode]]:
        result = defaultdict(list)
        unassigned = []
        
        for task_id, task in self.task_index.items():
            if task_id not in self.confirmations or not self.confirmations[task_id].confirmed:
                node = self._create_dependency_node(task_id)
                if node:
                    if task.owner and task.owner in self.owners:
                        result[task.owner].append(node)
                    else:
                        unassigned.append(node)
        
        for report_id, report in self.report_index.items():
            if report_id not in self.confirmations or not self.confirmations[report_id].confirmed:
                node = self._create_dependency_node(report_id)
                if node:
                    if report.owner and report.owner in self.owners:
                        result[report.owner].append(node)
                    else:
                        unassigned.append(node)
        
        if unassigned:
            result['unassigned'] = unassigned
        
        return dict(result)
    
    def get_lineage_chain(self, node_id: str, max_depth: int = 2) -> Dict:
        upstream = self._get_upstream(node_id, max_depth)
        downstream = self._get_downstream(node_id, max_depth)
        return {
            'node': self._create_dependency_node(node_id),
            'upstream': upstream,
            'downstream': downstream
        }
    
    def _get_upstream(self, node_id: str, depth: int) -> List[DependencyNode]:
        result = []
        visited = set()
        queue = deque([(node_id, 0)])
        
        while queue:
            current, level = queue.popleft()
            if current in visited or level > depth:
                continue
            visited.add(current)
            
            if level > 0:
                node = self._create_dependency_node(current)
                if node:
                    result.append(node)
            
            for neighbor, _ in self.reverse_adjacency[current]:
                queue.append((neighbor, level + 1))
        
        return result
    
    def _get_downstream(self, node_id: str, depth: int) -> List[DependencyNode]:
        result = []
        visited = set()
        queue = deque([(node_id, 0)])
        
        while queue:
            current, level = queue.popleft()
            if current in visited or level > depth:
                continue
            visited.add(current)
            
            if level > 0:
                node = self._create_dependency_node(current)
                if node:
                    result.append(node)
            
            for neighbor, _ in self.adjacency_list[current]:
                queue.append((neighbor, level + 1))
        
        return result
