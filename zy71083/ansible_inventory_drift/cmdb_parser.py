import json
import csv
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Any
from dataclasses import asdict

from .models import Host


class LabelNormalizer:
    def __init__(self, custom_mappings: Optional[Dict[str, str]] = None):
        self.role_mappings = {
            "web": "web",
            "www": "web",
            "http": "web",
            "nginx": "web",
            "apache": "web",
            "app": "app",
            "application": "app",
            "api": "app",
            "db": "database",
            "database": "database",
            "mysql": "database",
            "postgres": "database",
            "redis": "cache",
            "cache": "cache",
            "worker": "worker",
            "celery": "worker",
            "queue": "worker",
            "proxy": "proxy",
            "loadbalancer": "lb",
            "lb": "lb",
            "haproxy": "lb",
        }

        self.env_mappings = {
            "prod": "production",
            "production": "production",
            "prd": "production",
            "live": "production",
            "staging": "staging",
            "stage": "staging",
            "stg": "staging",
            "preprod": "staging",
            "testing": "testing",
            "test": "testing",
            "qa": "testing",
            "dev": "development",
            "development": "development",
            "develop": "development",
            "sandbox": "sandbox",
            "demo": "demo",
            "dr": "dr",
        }

        self.label_key_mappings = {
            "server_role": "role",
            "host_role": "role",
            "instance_role": "role",
            "vm_role": "role",
            "server_env": "environment",
            "host_env": "environment",
            "instance_env": "environment",
            "env_type": "environment",
            "tier": "environment",
            "os_version": "os",
            "operating_system": "os",
            "ip": "ip_address",
            "private_ip": "ip_address",
            "public_ip": "public_ip",
            "az": "availability_zone",
            "zone": "availability_zone",
            "dc": "datacenter",
            "datacenter": "datacenter",
            "region": "region",
        }

        if custom_mappings:
            if "roles" in custom_mappings:
                self.role_mappings.update(custom_mappings["roles"])
            if "environments" in custom_mappings:
                self.env_mappings.update(custom_mappings["environments"])
            if "label_keys" in custom_mappings:
                self.label_key_mappings.update(custom_mappings["label_keys"])

    def normalize_role(self, role: str) -> str:
        role_lower = role.strip().lower()
        return self.role_mappings.get(role_lower, role_lower)

    def normalize_environment(self, env: str) -> str:
        env_lower = env.strip().lower()
        return self.env_mappings.get(env_lower, env_lower)

    def normalize_label_key(self, key: str) -> str:
        key_lower = key.strip().lower()
        return self.label_key_mappings.get(key_lower, key_lower)

    def normalize_roles(self, roles: List[str]) -> Set[str]:
        return {self.normalize_role(r) for r in roles if r and r.strip()}


class CMDBParser:
    def __init__(self, normalizer: Optional[LabelNormalizer] = None):
        self.normalizer = normalizer or LabelNormalizer()

    def parse(self, cmdb_path: str, format_type: Optional[str] = None) -> Dict[str, Host]:
        path = Path(cmdb_path)
        if not path.exists():
            raise FileNotFoundError(f"CMDB file not found: {cmdb_path}")

        if format_type is None:
            format_type = self._detect_format(path)

        if format_type == "json":
            return self._parse_json(path)
        elif format_type == "yaml":
            return self._parse_yaml(path)
        elif format_type == "csv":
            return self._parse_csv(path)
        else:
            raise ValueError(f"Unsupported format: {format_type}")

    def _detect_format(self, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix == ".json":
            return "json"
        elif suffix in (".yml", ".yaml"):
            return "yaml"
        elif suffix == ".csv":
            return "csv"
        else:
            content = path.read_text(encoding="utf-8", errors="ignore").strip()
            if content.startswith("{") or content.startswith("["):
                return "json"
            elif content.startswith("---") or content.startswith("all:"):
                return "yaml"
            elif "," in content.split("\n")[0]:
                return "csv"
            raise ValueError(f"Could not detect format for {path}")

    def _parse_json(self, path: Path) -> Dict[str, Host]:
        import json
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return self._parse_cmdb_data(data, str(path))

    def _parse_yaml(self, path: Path) -> Dict[str, Host]:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return self._parse_cmdb_data(data, str(path))

    def _parse_csv(self, path: Path) -> Dict[str, Host]:
        hosts = {}
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                host = self._row_to_host(row, str(path))
                if host:
                    hosts[host.hostname] = host
        return hosts

    def _row_to_host(self, row: Dict[str, str], source: str) -> Optional[Host]:
        hostname_keys = ["hostname", "host", "name", "server_name", "instance_name", "vm_name"]
        hostname = None
        for key in hostname_keys:
            if key in row and row[key].strip():
                hostname = row[key].strip()
                break

        if not hostname:
            return None

        host = Host(hostname=hostname, source=source)
        host.raw_data = dict(row)

        for key, value in row.items():
            if not value:
                continue
            normalized_key = self.normalizer.normalize_label_key(key)

            if normalized_key == "role":
                host.roles.extend([r.strip() for r in value.split(",") if r.strip()])
            elif normalized_key == "environment":
                host.environment = value.strip()
            elif normalized_key == "ip_address":
                host.ip_address = value.strip()
                host.aliases.append(value.strip())
            else:
                host.labels[key] = value.strip()

        return host

    def _parse_cmdb_data(self, data: Any, source: str) -> Dict[str, Host]:
        hosts = {}

        if isinstance(data, list):
            for item in data:
                host = self._item_to_host(item, source)
                if host:
                    hosts[host.hostname] = host
        elif isinstance(data, dict):
            if "hosts" in data and isinstance(data["hosts"], list):
                for item in data["hosts"]:
                    host = self._item_to_host(item, source)
                    if host:
                        hosts[host.hostname] = host
            elif "servers" in data and isinstance(data["servers"], list):
                for item in data["servers"]:
                    host = self._item_to_host(item, source)
                    if host:
                        hosts[host.hostname] = host
            elif "instances" in data and isinstance(data["instances"], list):
                for item in data["instances"]:
                    host = self._item_to_host(item, source)
                    if host:
                        hosts[host.hostname] = host
            else:
                for key, value in data.items():
                    if isinstance(value, dict):
                        host = self._item_to_host(value, source)
                        if host:
                            if "hostname" not in value:
                                host.hostname = key
                            hosts[host.hostname] = host
        return hosts

    def _item_to_host(self, item: Dict[str, Any], source: str) -> Optional[Host]:
        if not isinstance(item, dict):
            return None

        hostname_keys = ["hostname", "host", "name", "server_name", "instance_name", "vm_name"]
        hostname = None
        for key in hostname_keys:
            if key in item and item[key]:
                hostname = str(item[key]).strip()
                break

        if not hostname:
            return None

        host = Host(hostname=hostname, source=source)
        host.raw_data = dict(item)

        role_keys = ["role", "roles", "server_role", "host_role", "instance_role", "vm_role", "tags.role"]
        for key in role_keys:
            if key in item and item[key]:
                value = item[key]
                if isinstance(value, str):
                    host.roles.extend([r.strip() for r in value.split(",") if r.strip()])
                elif isinstance(value, list):
                    host.roles.extend([str(r) for r in value])

        env_keys = ["environment", "env", "stage", "tier", "env_type", "tags.env", "tags.environment"]
        for key in env_keys:
            if key in item and item[key] and not host.environment:
                host.environment = str(item[key])

        ip_keys = ["ip", "ip_address", "private_ip", "public_ip", "address"]
        for key in ip_keys:
            if key in item and item[key]:
                host.ip_address = str(item[key])
                host.aliases.append(str(item[key]))
                break

        alias_keys = ["aliases", "alternate_names", "dns_names"]
        for key in alias_keys:
            if key in item and item[key]:
                value = item[key]
                if isinstance(value, str):
                    host.aliases.extend([a.strip() for a in value.split(",") if a.strip()])
                elif isinstance(value, list):
                    host.aliases.extend([str(a) for a in value])

        if "tags" in item and isinstance(item["tags"], dict):
            for key, value in item["tags"].items():
                if isinstance(value, (str, int, float, bool)):
                    host.labels[key] = str(value)

        if "labels" in item and isinstance(item["labels"], dict):
            for key, value in item["labels"].items():
                if isinstance(value, (str, int, float, bool)):
                    host.labels[key] = str(value)

        if "decommissioned" in item:
            host.is_decommissioned = bool(item["decommissioned"])
        elif "status" in item:
            status = str(item["status"]).lower()
            host.is_decommissioned = status in ["decommissioned", "retired", "terminated", "deleted"]

        for key, value in item.items():
            if isinstance(value, (str, int, float, bool)):
                if key not in host.labels:
                    host.labels[key] = str(value)

        return host
