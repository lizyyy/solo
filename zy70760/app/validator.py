import re
from typing import Dict, List, Tuple
from packaging.specifiers import SpecifierSet, InvalidSpecifier
from packaging.version import Version
import importlib.util
import sys


class WheelValidator:
    PLATFORM_TAG_PATTERNS = [
        r'^any$',
        r'^win32$',
        r'^win_amd64$',
        r'^win_arm64$',
        r'^manylinux1_\w+$',
        r'^manylinux2010_\w+$',
        r'^manylinux2014_\w+$',
        r'^manylinux_2_\d+_\w+$',
        r'^musllinux_1_\d+_\w+$',
        r'^macosx_\d+_\d+_\w+$',
    ]

    def __init__(self, extracted_data: Dict, extracted_path: str = None):
        self.data = extracted_data
        self.extracted_path = extracted_path
        self.errors = []
        self.warnings = []

    def validate_platform_tag(self) -> Tuple[bool, str]:
        platform_tag = self.data.get('platform_tag', '')
        platform_tags = self.data.get('platform_tags', [])

        if not platform_tag:
            return False, "Platform tag is missing from filename"

        if platform_tag == 'any':
            return True, "Platform tag 'any' is valid for pure Python wheels"

        invalid_tags = []
        for tag in platform_tags:
            matched = False
            for pattern in self.PLATFORM_TAG_PATTERNS:
                if re.match(pattern, tag):
                    matched = True
                    break
            if not matched:
                invalid_tags.append(tag)

        if invalid_tags:
            return False, f"Invalid platform tag(s): {', '.join(invalid_tags)}"

        return True, f"Platform tag(s) '{platform_tag}' are valid"

    def validate_entry_points(self) -> Tuple[bool, str]:
        entry_points = self.data.get('entry_points', [])
        errors = []

        if not entry_points:
            return True, "No entry points defined"

        for ep in entry_points:
            group = ep.get('group', '')
            name = ep.get('name', '')
            module = ep.get('module', '')

            if not group:
                errors.append(f"Entry point '{name}' has no group")
                continue

            if not module:
                errors.append(f"Entry point '{name}' has no module")
                continue

            if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$', module):
                errors.append(f"Entry point '{name}' has invalid module format: {module}")

            attr = ep.get('attr')
            if attr:
                if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$', attr):
                    errors.append(f"Entry point '{name}' has invalid attribute format: {attr}")

        if errors:
            return False, "; ".join(errors)

        return True, f"All {len(entry_points)} entry points are valid"

    def validate_dependencies(self) -> Tuple[bool, str]:
        dependencies = self.data.get('dependencies', [])
        errors = []
        warnings = []

        if not dependencies:
            return True, "No dependencies defined"

        for dep in dependencies:
            name = dep.get('name', '')
            specifier = dep.get('specifier', '')

            if not name:
                errors.append("Dependency has no package name")
                continue

            if not re.match(r'^[a-zA-Z0-9_-]+$', name):
                errors.append(f"Dependency '{name}' has invalid package name format")

            if specifier:
                try:
                    spec = SpecifierSet(specifier)
                except InvalidSpecifier:
                    errors.append(f"Dependency '{name}' has invalid version specifier: {specifier}")
                    continue

                if not specifier:
                    warnings.append(f"Dependency '{name}' has no version constraint (unbounded)")

                if specifier.startswith('==') and '*' not in specifier:
                    warnings.append(f"Dependency '{name}' uses exact version pinning: {specifier}")

        if errors:
            return False, "; ".join(errors)

        if warnings:
            return True, "Dependencies are valid but with warnings: " + "; ".join(warnings)

        return True, f"All {len(dependencies)} dependencies are valid"

    def validate_metadata(self) -> Tuple[bool, str]:
        metadata = self.data.get('metadata', {})
        errors = []

        required_fields = ['name', 'version']
        for field in required_fields:
            if not metadata.get(field):
                errors.append(f"Missing required metadata field: {field}")

        name = metadata.get('name', '')
        if name and not re.match(r'^[a-zA-Z0-9_-]+$', name):
            errors.append(f"Invalid package name format: {name}")

        version = metadata.get('version', '')
        if version:
            try:
                Version(version)
            except:
                errors.append(f"Invalid version format: {version}")

        if errors:
            return False, "; ".join(errors)

        return True, "Metadata is valid"

    def validate_all(self) -> Dict:
        platform_ok, platform_msg = self.validate_platform_tag()
        entry_points_ok, entry_points_msg = self.validate_entry_points()
        dependencies_ok, dependencies_msg = self.validate_dependencies()
        metadata_ok, metadata_msg = self.validate_metadata()

        all_checks = [platform_ok, entry_points_ok, dependencies_ok, metadata_ok]
        overall_status = "passed" if all(all_checks) else "failed"

        return {
            'overall_status': overall_status,
            'platform_tag_check': platform_ok,
            'platform_tag_message': platform_msg,
            'entry_points_check': entry_points_ok,
            'entry_points_message': entry_points_msg,
            'dependencies_check': dependencies_ok,
            'dependencies_message': dependencies_msg,
            'metadata_check': metadata_ok,
            'metadata_message': metadata_msg,
            'raw_report': f"""
Wheel Validation Report
=======================
Platform Tag:    {'PASS' if platform_ok else 'FAIL'} - {platform_msg}
Entry Points:    {'PASS' if entry_points_ok else 'FAIL'} - {entry_points_msg}
Dependencies:    {'PASS' if dependencies_ok else 'FAIL'} - {dependencies_msg}
Metadata:        {'PASS' if metadata_ok else 'FAIL'} - {metadata_msg}

Overall Status:  {overall_status.upper()}
            """.strip()
        }
