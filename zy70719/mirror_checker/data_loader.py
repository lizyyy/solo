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
            
            fallback_data = data.copy()
            if 'sync_frequency_hours' not in data or data.get('sync_frequency_hours', 0) <= 0:
                fallback_data['sync_frequency_hours'] = 4.0
                self._add_issue('sync_frequency_hours', data.get('sync_frequency_hours'), 'fallback_applied', '使用默认同步频率 4.0 小时')
            
            if 'name' not in data or not data.get('name'):
                fallback_data['name'] = '未命名镜像源'
            if 'url' not in data or not data.get('url'):
                fallback_data['url'] = 'unknown://unknown'
            if 'type' not in data or not data.get('type'):
                fallback_data['type'] = 'unknown'
            
            try:
                return MirrorSource(**fallback_data)
            except:
                self._add_issue('mirror_source', fallback_data, 'critical_fallback_failed', '无法创建镜像源对象，使用完全默认配置')
                return MirrorSource(
                    name='默认镜像源',
                    url='unknown://default',
                    type='unknown',
                    sync_frequency_hours=4.0
                )

    def load_packages(self, file_path: str) -> List[PackageVersion]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        packages = []
        for idx, item in enumerate(data):
            try:
                item_copy = item.copy()
                
                if 'upstream_updated_at' in item_copy and item_copy['upstream_updated_at']:
                    try:
                        item_copy['upstream_updated_at'] = datetime.fromisoformat(item_copy['upstream_updated_at'])
                    except ValueError as e:
                        self._add_issue(f"packages[{idx}].upstream_updated_at", item_copy.get('upstream_updated_at'), 'format_error', f"上游时间格式错误: {e}")
                        item_copy['upstream_updated_at'] = None
                
                if 'mirror_updated_at' in item_copy and item_copy['mirror_updated_at']:
                    try:
                        item_copy['mirror_updated_at'] = datetime.fromisoformat(item_copy['mirror_updated_at'])
                    except ValueError as e:
                        self._add_issue(f"packages[{idx}].mirror_updated_at", item_copy.get('mirror_updated_at'), 'format_error', f"镜像时间格式错误: {e}")
                        item_copy['mirror_updated_at'] = None

                packages.append(PackageVersion(**item_copy))
            except ValidationError as e:
                for error in e.errors():
                    field = f"packages[{idx}].{error['loc'][0]}" if error['loc'] else f"packages[{idx}]"
                    self._add_issue(field, item, 'validation_error', error['msg'])
                
                fallback_name = item.get('name') or f"unknown-package-{idx}"
                fallback_upstream = item.get('upstream_version') or '0.0.0'
                if not fallback_upstream.strip():
                    fallback_upstream = '0.0.0'
                
                try:
                    pkg = PackageVersion(
                        name=fallback_name,
                        upstream_version=fallback_upstream,
                        mirror_version=item.get('mirror_version'),
                        is_available=item.get('is_available', True)
                    )
                    packages.append(pkg)
                    self._add_issue(f"packages[{idx}]", fallback_name, 'partial_valid', '使用部分字段创建包对象')
                except Exception as e2:
                    self._add_issue(f"packages[{idx}]", item, 'load_failed', f"无法加载包: {e2}")
            except Exception as e:
                self._add_issue(f"packages[{idx}]", item, 'unexpected_error', f"加载包时发生意外错误: {e}")

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
                
                fallback_name = item.get('project_name') or f"unknown-project-{idx}"
                fallback_priority = item.get('priority', 3)
                if fallback_priority < 1 or fallback_priority > 5:
                    fallback_priority = 3
                
                try:
                    proj = BlockedProject(
                        project_name=fallback_name,
                        required_packages=item.get('required_packages', []),
                        priority=fallback_priority,
                        contact=item.get('contact'),
                        description=item.get('description'),
                        is_manually_confirmed=item.get('is_manually_confirmed', False)
                    )
                    projects.append(proj)
                    self._add_issue(f"projects[{idx}]", fallback_name, 'partial_valid', '使用部分字段创建项目对象')
                except Exception as e2:
                    self._add_issue(f"projects[{idx}]", item, 'load_failed', f"无法加载项目: {e2}")
            except Exception as e:
                self._add_issue(f"projects[{idx}]", item, 'unexpected_error', f"加载项目时发生意外错误: {e}")

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
            base_config["name"] = ""
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
                },
                {
                    "name": "bad-timestamp",
                    "upstream_version": "1.0.0",
                    "mirror_version": "0.9.0",
                    "upstream_updated_at": "not-a-timestamp",
                    "mirror_updated_at": "also-not-a-timestamp",
                    "is_available": True
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
                },
                {
                    "project_name": "project-with-missing-pkgs",
                    "required_packages": ["nonexistent-pkg", "another-missing"],
                    "priority": 2,
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
