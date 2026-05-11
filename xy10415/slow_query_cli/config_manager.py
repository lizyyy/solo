import yaml
from typing import Dict, List, Set, Optional, Tuple
from .models import OwnerAssignment


class ConfigManager:
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.owner_assignments: Dict[str, OwnerAssignment] = {}
        self.table_to_owners: Dict[str, List[str]] = {}
        self.database_to_owners: Dict[str, List[str]] = {}
        self.conflicts: List[str] = []
        self.unknown_tables: Set[str] = set()

    def load_config(self) -> Tuple[Dict[str, OwnerAssignment], List[str]]:
        self.owner_assignments = {}
        self.table_to_owners = {}
        self.database_to_owners = {}
        self.conflicts = []

        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
        except FileNotFoundError:
            self.conflicts.append(f"配置文件不存在: {self.config_path}")
            return {}, self.conflicts
        except yaml.YAMLError as e:
            self.conflicts.append(f"配置文件格式错误: {str(e)}")
            return {}, self.conflicts

        if not isinstance(config, dict):
            self.conflicts.append("配置文件格式无效，应为字典格式")
            return {}, self.conflicts

        owners_config = config.get('owners', [])
        
        for owner_data in owners_config:
            name = owner_data.get('name')
            if not name:
                self.conflicts.append("发现未命名的负责人配置")
                continue

            service = owner_data.get('service', '未命名服务')
            tables = set(t.lower() for t in owner_data.get('tables', []))
            databases = set(d.lower() for d in owner_data.get('databases', []))

            if name in self.owner_assignments:
                self.conflicts.append(f"配置冲突: 负责人 '{name}' 被重复定义")
                continue

            assignment = OwnerAssignment(
                name=name,
                service=service,
                tables=tables,
                databases=databases
            )
            self.owner_assignments[name] = assignment

            for table in tables:
                if table not in self.table_to_owners:
                    self.table_to_owners[table] = []
                self.table_to_owners[table].append(name)

            for database in databases:
                if database not in self.database_to_owners:
                    self.database_to_owners[database] = []
                self.database_to_owners[database].append(name)

        for table, owners in self.table_to_owners.items():
            if len(owners) > 1:
                self.conflicts.append(
                    f"配置冲突: 表 '{table}' 被多个负责人负责: {', '.join(owners)}"
                )

        return self.owner_assignments, self.conflicts

    def get_owner_for_tables(self, tables: List[str], database: str = None) -> Optional[str]:
        matching_owners = set()
        
        for table in tables:
            table_lower = table.lower()
            if table_lower in self.table_to_owners:
                for owner in self.table_to_owners[table_lower]:
                    matching_owners.add(owner)
        
        if not matching_owners and database:
            db_lower = database.lower()
            if db_lower in self.database_to_owners:
                for owner in self.database_to_owners[db_lower]:
                    matching_owners.add(owner)

        if len(matching_owners) == 1:
            return next(iter(matching_owners))
        elif len(matching_owners) > 1:
            return None
        else:
            for table in tables:
                self.unknown_tables.add(table.lower())
            return None

    def get_all_owners(self) -> List[str]:
        return list(self.owner_assignments.keys())

    def get_owner_info(self, owner_name: str) -> Optional[OwnerAssignment]:
        return self.owner_assignments.get(owner_name)

    def get_unknown_tables(self) -> Set[str]:
        return self.unknown_tables

    def get_conflicts(self) -> List[str]:
        return self.conflicts
