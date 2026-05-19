import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any
from pydantic import ValidationError
from .models import (
    MirrorSource,
    PackageVersion,
    BlockedProject,
    SyncWindow,
    DirtyDataIssue,
)


class DataLoader:
    def __init__(self):
        self._issues: List[DirtyDataIssue] = []

    def has_issues(self) -> bool:
        return len(self._issues) > 0

    def get_issues(self) -> List[DirtyDataIssue]:
        return self._issues

    def _add_issue(self, field: str, value: Any, issue_type: str, message: str):
        self._issues.append(DirtyDataIssue(
            field=field,
            value=value,
            issue_type=issue_type,
            message=message
        ))

    def load_mirror_source(self, file_path: str) -> MirrorSource:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        try:
            return MirrorSource(**data)
        except ValidationError as e:
            for error in e.errors():
                field = str(error['loc'][0]) if error['loc'] else 'unknown'
                self._add_issue(field, data.get(field), 'validation_error', error['msg'])
            raise

    def load_packages(self, file_path: str) -> List[PackageVersion]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        packages = []
        for idx, item in enumerate(data):
            try:
                if 'upstream_updated_at' in item and item['upstream_updated_at']:
                    item['upstream_updated_at'] = datetime.fromisoformat(item['upstream_updated_at'])
                if 'mirror_updated_at' in item and item['mirror_updated_at']:
                    item['mirror_updated_at'] = datetime.fromisoformat(item['mirror_updated_at'])

                packages.append(PackageVersion(**item))
            except ValidationError as e:
                for error in e.errors():
                    field = f"packages[{idx}].{error['loc'][0]}" if error['loc'] else f"packages[{idx}]"
                    self._add_issue(field, item, 'validation_error', error['msg'])
            except ValueError as e:
                field = f"packages[{idx}].timestamp"
                self._add_issue(field, item, 'format_error', f"时间格式错误: {e}")

        return packages

    def load_projects(self, file_path: str) -> List[BlockedProject]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        projects = []
        for idx, item in enumerate(data):
            try:
                projects.append(BlockedProject(**item))
            except ValidationError as e:
                for error in e.errors():
                    field = f"projects[{idx}].{error['loc'][0]}" if error['loc'] else f"projects[{idx}]"
                    self._add_issue(field, item, 'validation_error', error['msg'])

        return projects

    def generate_sample_data(self, sample_type: str, output_dir: str) -> List[str]:
        os.makedirs(output_dir, exist_ok=True)

        mirror_config = self._generate_mirror_config(sample_type)
        packages = self._generate_packages(sample_type)
        projects = self._generate_projects(sample_type)

        mirror_file = os.path.join(output_dir, f"{sample_type}_mirror.json")
        packages_file = os.path.join(output_dir, f"{sample_type}_packages.json")
        projects_file = os.path.join(output_dir, f"{sample_type}_projects.json")

        with open(mirror_file, 'w', encoding='utf-8') as f:
            json.dump(mirror_config, f, ensure_ascii=False, indent=2)

        with open(packages_file, 'w', encoding='utf-8') as f:
            json.dump(packages, f, ensure_ascii=False, indent=2)

        with open(projects_file, 'w', encoding='utf-8') as f:
            json.dump(projects, f, ensure_ascii=False, indent=2)

        return [mirror_file, packages_file, projects_file]

    def _generate_mirror_config(self, sample_type: str) -> Dict[str, Any]:
        base_config = {
            "name": "内网PyPI镜像源",
            "url": "https://pypi-internal.example.com/simple",
            "type": "pypi",
            "sync_frequency_hours": 4.0,
            "last_sync_time": (datetime.now() - timedelta(hours=2)).isoformat(),
        }

        if sample_type == "dirty":
            base_config["sync_frequency_hours"] = -1.0
        elif sample_type == "boundary":
            base_config["sync_window"] = {
                "name": "夜间同步窗口",
                "start_time": "00:00",
                "end_time": "06:00",
                "max_delay_hours": 6.0
            }

        return base_config

    def _generate_packages(self, sample_type: str) -> List[Dict[str, Any]]:
        now = datetime.now()

        if sample_type == "empty":
            return []

        if sample_type == "normal":
            return [
                {
                    "name": "requests",
                    "upstream_version": "2.31.0",
                    "mirror_version": "2.31.0",
                    "upstream_updated_at": (now - timedelta(hours=1)).isoformat(),
                    "mirror_updated_at": (now - timedelta(hours=1)).isoformat(),
                    "is_available": True
                },
                {
                    "name": "fastapi",
                    "upstream_version": "0.104.0",
                    "mirror_version": "0.103.0",
                    "upstream_updated_at": (now - timedelta(hours=5)).isoformat(),
                    "mirror_updated_at": (now - timedelta(hours=29)).isoformat(),
                    "is_available": True
                },
                {
                    "name": "pandas",
                    "upstream_version": "2.1.3",
                    "mirror_version": "1.5.3",
                    "upstream_updated_at": (now - timedelta(hours=12)).isoformat(),
                    "mirror_updated_at": (now - timedelta(hours=72)).isoformat(),
                    "is_available": True
                },
                {
                    "name": "numpy",
                    "upstream_version": "1.26.0",
                    "mirror_version": "1.25.2",
                    "upstream_updated_at": (now - timedelta(hours=3)).isoformat(),
                    "mirror_updated_at": (now - timedelta(hours=15)).isoformat(),
                    "is_available": True
                }
            ]

        if sample_type == "dirty":
            return [
                {
                    "name": "",
                    "upstream_version": "2.31.0",
                    "mirror_version": "2.31.0",
                    "is_available": True
                },
                {
                    "name": "fastapi",
                    "upstream_version": "",
                    "mirror_version": "0.103.0",
                    "is_available": True
                },
                {
                    "name": "invalid-package",
                    "upstream_version": "not-a-version",
                    "mirror_version": "also-invalid",
                    "is_available": True
                },
                {
                    "name": "missing-mirror",
                    "upstream_version": "1.0.0",
                    "mirror_version": None,
                    "is_available": False
                }
            ]

        if sample_type == "boundary":
            return [
                {
                    "name": "package-fresh",
                    "upstream_version": "1.0.0",
                    "mirror_version": "1.0.0",
                    "upstream_updated_at": now.isoformat(),
                    "mirror_updated_at": now.isoformat(),
                    "is_available": True
                },
                {
                    "name": "package-warning",
                    "upstream_version": "1.3.0",
                    "mirror_version": "1.0.0",
                    "upstream_updated_at": (now - timedelta(hours=5)).isoformat(),
                    "mirror_updated_at": (now - timedelta(hours=9)).isoformat(),
                    "is_available": True
                },
                {
                    "name": "package-critical",
                    "upstream_version": "3.0.0",
                    "mirror_version": "1.0.0",
                    "upstream_updated_at": (now - timedelta(hours=25)).isoformat(),
                    "mirror_updated_at": (now - timedelta(hours=49)).isoformat(),
                    "is_available": True
                },
                {
                    "name": "package-unavailable",
                    "upstream_version": "2.0.0",
                    "mirror_version": None,
                    "is_available": False
                }
            ]

        return []

    def _generate_projects(self, sample_type: str) -> List[Dict[str, Any]]:
        if sample_type == "empty":
            return []

        if sample_type == "normal":
            return [
                {
                    "project_name": "web-backend",
                    "required_packages": ["requests", "fastapi"],
                    "priority": 1,
                    "contact": "team-a@example.com",
                    "description": "Web服务后端项目",
                    "is_manually_confirmed": False
                },
                {
                    "project_name": "data-pipeline",
                    "required_packages": ["pandas", "numpy"],
                    "priority": 2,
                    "contact": "team-b@example.com",
                    "description": "数据处理流水线",
                    "is_manually_confirmed": False
                }
            ]

        if sample_type == "dirty":
            return [
                {
                    "project_name": "",
                    "required_packages": ["requests"],
                    "priority": 0,
                    "is_manually_confirmed": False
                },
                {
                    "project_name": "test-project",
                    "required_packages": [],
                    "priority": 6,
                    "is_manually_confirmed": False
                }
            ]

        if sample_type == "boundary":
            return [
                {
                    "project_name": "all-blocked",
                    "required_packages": ["package-critical", "package-unavailable"],
                    "priority": 1,
                    "contact": "urgent@example.com",
                    "description": "所有依赖都阻塞的项目",
                    "is_manually_confirmed": False
                },
                {
                    "project_name": "partially-blocked",
                    "required_packages": ["package-fresh", "package-warning"],
                    "priority": 2,
                    "contact": "normal@example.com",
                    "description": "部分依赖阻塞",
                    "is_manually_confirmed": False
                },
                {
                    "project_name": "confirmed-project",
                    "required_packages": ["package-critical"],
                    "priority": 3,
                    "contact": "confirmed@example.com",
                    "description": "已人工确认放行",
                    "is_manually_confirmed": True
                }
            ]

        return []
