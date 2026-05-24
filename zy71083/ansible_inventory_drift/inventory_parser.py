import re
import os
from typing import Dict, List, Optional, Tuple, Set
from pathlib import Path
import configparser

from .models import Host, InventoryGroup, ParsedInventory


class InventoryParser:
    def __init__(self, decommissioned_patterns: Optional[List[str]] = None):
        self.decommissioned_patterns = decommissioned_patterns or [
            r"^deprecated",
            r"^retired",
            r"^decomm",
            r"\.deprecated$",
            r"\.retired$",
            r"_deprecated$",
            r"_retired$",
        ]
        self._compiled_patterns = [re.compile(p, re.IGNORECASE) for p in self.decommissioned_patterns]

    def parse(self, inventory_path: str) -> ParsedInventory:
        path = Path(inventory_path)
        if not path.exists():
            raise FileNotFoundError(f"Inventory file not found: {inventory_path}")

        if path.is_dir():
            return self._parse_directory(path)
        else:
            return self._parse_file(path)

    def _parse_file(self, path: Path) -> ParsedInventory:
        content = path.read_text()
        if self._is_yaml(content):
            return self._parse_yaml_inventory(content, str(path))
        else:
            return self._parse_ini_inventory(content, str(path))

    def _parse_directory(self, path: Path) -> ParsedInventory:
        parsed = ParsedInventory(source_file=str(path))
        for file_path in sorted(path.rglob("*")):
            if file_path.is_file() and not file_path.name.startswith("."):
                if file_path.suffix in (".ini", ".yml", ".yaml", "") or "hosts" in file_path.name:
                    try:
                        file_parsed = self._parse_file(file_path)
                        self._merge_parsed(parsed, file_parsed)
                    except Exception as e:
                        print(f"Warning: Could not parse {file_path}: {e}")
        return parsed

    def _is_yaml(self, content: str) -> bool:
        stripped = content.strip()
        return stripped.startswith("---") or stripped.startswith("{") or stripped.startswith("all:")

    def _parse_ini_inventory(self, content: str, source: str) -> ParsedInventory:
        parsed = ParsedInventory(source_file=source)

        current_group = "all"
        current_section_type = "hosts"

        for line in content.split("\n"):
            line = line.strip()
            if not line or line.startswith("#") or line.startswith(";"):
                continue

            if line.startswith("[") and line.endswith("]"):
                section_name = line[1:-1]
                if section_name.endswith(":vars"):
                    current_group = section_name[:-5]
                    current_section_type = "vars"
                elif section_name.endswith(":children"):
                    current_group = section_name[:-9]
                    current_section_type = "children"
                else:
                    current_group = section_name
                    current_section_type = "hosts"
                continue

            if current_section_type == "vars":
                self._handle_group_var_line(parsed, current_group, line)
            elif current_section_type == "children":
                self._handle_group_child_line(parsed, current_group, line)
            else:
                self._handle_host_line(parsed, current_group, line)

        self._resolve_inheritance(parsed)
        self._mark_decommissioned(parsed)
        return parsed

    def _handle_host_line(self, parsed: ParsedInventory, group_name: str, line: str):
        parts = line.split(None, 1)
        if not parts:
            return

        host_name = parts[0]
        host_vars = parts[1] if len(parts) > 1 else None
        self._handle_host_entry(parsed, group_name, host_name, host_vars)

    def _handle_group_var_line(self, parsed: ParsedInventory, group_name: str, line: str):
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("\"'")
        if group_name not in parsed.groups:
            parsed.groups[group_name] = InventoryGroup(name=group_name)
        parsed.groups[group_name].vars[key] = value

    def _handle_group_child_line(self, parsed: ParsedInventory, group_name: str, line: str):
        child_name = line.strip()
        self._handle_group_children(parsed, group_name, [child_name])



    def _parse_yaml_inventory(self, content: str, source: str) -> ParsedInventory:
        import yaml
        parsed = ParsedInventory(source_file=source)

        try:
            data = yaml.safe_load(content)
        except yaml.YAMLError as e:
            raise ValueError(f"YAML parse error: {e}")

        if not isinstance(data, dict):
            raise ValueError("Inventory YAML must be a dictionary")

        self._process_yaml_group(parsed, "all", data.get("all", {}))
        self._resolve_inheritance(parsed)
        self._mark_decommissioned(parsed)
        return parsed

    def _process_yaml_group(self, parsed: ParsedInventory, group_name: str, group_data: dict):
        if group_name not in parsed.groups:
            parsed.groups[group_name] = InventoryGroup(name=group_name)

        group = parsed.groups[group_name]

        if "vars" in group_data and isinstance(group_data["vars"], dict):
            group.vars.update(group_data["vars"])

        if "children" in group_data and isinstance(group_data["children"], dict):
            for child_name, child_data in group_data["children"].items():
                group.children.append(child_name)
                self._process_yaml_group(parsed, child_name, child_data or {})

        if "hosts" in group_data and isinstance(group_data["hosts"], dict):
            for host_name, host_data in group_data["hosts"].items():
                group.hosts.append(host_name)
                self._add_host_from_yaml(parsed, host_name, host_data or {}, [group_name])

    def _add_host_from_yaml(self, parsed: ParsedInventory, host_name: str, host_data: dict, groups: List[str]):
        if host_name not in parsed.hosts:
            parsed.hosts[host_name] = Host(hostname=host_name, source=parsed.source_file)
            parsed.all_hosts.add(host_name)

        host = parsed.hosts[host_name]
        host.groups = list(set(host.groups + groups))

        if isinstance(host_data, dict):
            host.raw_data.update(host_data)

            if "ansible_host" in host_data:
                host.aliases.append(host_data["ansible_host"])
                host.ip_address = host_data["ansible_host"]

            if "ansible_alias" in host_data:
                host.aliases.append(host_data["ansible_alias"])

            self._extract_host_metadata(host, host_data)

    def _handle_host_entry(self, parsed: ParsedInventory, group_name: str, host_name: str, host_vars):
        if host_name not in parsed.hosts:
            parsed.hosts[host_name] = Host(hostname=host_name, source=parsed.source_file)
            parsed.all_hosts.add(host_name)

        host = parsed.hosts[host_name]
        if group_name not in host.groups:
            host.groups.append(group_name)

        if group_name not in parsed.groups:
            parsed.groups[group_name] = InventoryGroup(name=group_name)
        if host_name not in parsed.groups[group_name].hosts:
            parsed.groups[group_name].hosts.append(host_name)

        if host_vars:
            var_dict = self._parse_host_vars(host_vars)
            host.raw_data.update(var_dict)

            if "ansible_host" in var_dict:
                host.aliases.append(var_dict["ansible_host"])
                host.ip_address = var_dict["ansible_host"]

            if "ansible_alias" in var_dict:
                host.aliases.append(var_dict["ansible_alias"])

            self._extract_host_metadata(host, var_dict)

    def _parse_host_vars(self, vars_str: str) -> Dict[str, str]:
        result = {}
        if not vars_str:
            return result

        for match in re.finditer(r'(\w+)\s*=\s*("[^"]*"|\'[^\']*\'|\S+)', vars_str):
            key = match.group(1)
            value = match.group(2).strip("\"'")
            result[key] = value
        return result

    def _extract_host_metadata(self, host: Host, data: dict):
        role_keys = ["role", "roles", "server_role", "host_role", "ansible_role"]
        env_keys = ["env", "environment", "stage", "tier", "env_type"]

        for key in role_keys:
            if key in data:
                value = data[key]
                if isinstance(value, str):
                    host.roles.extend([r.strip() for r in value.split(",") if r.strip()])
                elif isinstance(value, list):
                    host.roles.extend([str(r) for r in value])

        for key in env_keys:
            if key in data and not host.environment:
                host.environment = str(data[key])

        for key, value in data.items():
            if isinstance(value, (str, int, float, bool)):
                host.labels[key] = str(value)

    def _handle_group_vars(self, parsed: ParsedInventory, group_name: str, vars_dict: dict):
        if group_name not in parsed.groups:
            parsed.groups[group_name] = InventoryGroup(name=group_name)
        parsed.groups[group_name].vars.update(vars_dict)

    def _handle_group_children(self, parsed: ParsedInventory, group_name: str, children: List[str]):
        if group_name not in parsed.groups:
            parsed.groups[group_name] = InventoryGroup(name=group_name)
        parsed.groups[group_name].children.extend(children)
        for child in children:
            if child not in parsed.groups:
                parsed.groups[child] = InventoryGroup(name=child)
            if group_name not in parsed.groups[child].parent_groups:
                parsed.groups[child].parent_groups.append(group_name)

    def _resolve_inheritance(self, parsed: ParsedInventory):
        for host_name, host in parsed.hosts.items():
            all_groups = set(host.groups)
            self._get_parent_groups(parsed, host.groups, all_groups)
            host.groups = list(all_groups)

            for group_name in all_groups:
                if group_name in parsed.groups:
                    group = parsed.groups[group_name]
                    self._extract_host_metadata(host, group.vars)

    def _get_parent_groups(self, parsed: ParsedInventory, groups: List[str], result: Set[str]):
        for group_name in groups:
            if group_name in parsed.groups:
                group = parsed.groups[group_name]
                for parent in group.parent_groups:
                    if parent not in result:
                        result.add(parent)
                        self._get_parent_groups(parsed, [parent], result)

    def _mark_decommissioned(self, parsed: ParsedInventory):
        for host in parsed.hosts.values():
            for pattern in self._compiled_patterns:
                if pattern.search(host.hostname):
                    host.is_decommissioned = True
                    break

            for group in host.groups:
                for pattern in self._compiled_patterns:
                    if pattern.search(group):
                        host.is_decommissioned = True
                        break
                if host.is_decommissioned:
                    break

    def _merge_parsed(self, target: ParsedInventory, source: ParsedInventory):
        for host_name, host in source.hosts.items():
            if host_name in target.hosts:
                target.hosts[host_name].groups = list(set(target.hosts[host_name].groups + host.groups))
                target.hosts[host_name].aliases = list(set(target.hosts[host_name].aliases + host.aliases))
                target.hosts[host_name].labels.update(host.labels)
                target.hosts[host_name].raw_data.update(host.raw_data)
            else:
                target.hosts[host_name] = host
                target.all_hosts.add(host_name)

        for group_name, group in source.groups.items():
            if group_name in target.groups:
                target.groups[group_name].hosts = list(set(target.groups[group_name].hosts + group.hosts))
                target.groups[group_name].children = list(set(target.groups[group_name].children + group.children))
                target.groups[group_name].vars.update(group.vars)
            else:
                target.groups[group_name] = group
