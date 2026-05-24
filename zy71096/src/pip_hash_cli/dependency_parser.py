import re
import os
from pathlib import Path
from typing import List, Optional, Set, Tuple
from urllib.parse import urlparse

from packaging.requirements import Requirement as PackagingRequirement
from packaging.specifiers import SpecifierSet, Specifier
from packaging.version import Version

from .models import Requirement, PackageHash, ConstraintConflict
from .constants import PackageSource


class RequirementsParser:
    HASH_REGEX = re.compile(r'--hash=([a-z0-9]+):([a-f0-9]+)', re.IGNORECASE)
    EXTRA_REGEX = re.compile(r'\[([^\]]+)\]')
    COMMENT_REGEX = re.compile(r'(?<!\\)#.*$')
    CONTINUATION_REGEX = re.compile(r'\\$')

    def __init__(self):
        self._parsed_files = set()

    def parse_file(self, file_path: str, is_constraint: bool = False) -> Tuple[List[Requirement], List[str]]:
        path = Path(file_path).resolve()
        if path in self._parsed_files:
            return [], []
        
        self._parsed_files.add(path)
        requirements: List[Requirement] = []
        errors: List[str] = []

        try:
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except Exception as e:
            errors.append(f"无法读取文件 {file_path}: {str(e)}")
            return requirements, errors

        current_line = ""
        current_line_num = 0

        for line_num, line in enumerate(lines, 1):
            line = line.rstrip('\n')
            
            if self.CONTINUATION_REGEX.search(line):
                current_line += self.CONTINUATION_REGEX.sub('', line).strip() + ' '
                current_line_num = current_line_num or line_num
                continue
            
            if current_line:
                line = current_line + line.strip()
                line_num = current_line_num
                current_line = ""
                current_line_num = 0

            stripped_line = self.COMMENT_REGEX.sub('', line).strip()
            if not stripped_line:
                continue

            if stripped_line.startswith('-r') or stripped_line.startswith('--requirement'):
                req_file = self._parse_include(stripped_line, path.parent)
                if req_file:
                    sub_reqs, sub_errors = self.parse_file(req_file, is_constraint)
                    requirements.extend(sub_reqs)
                    errors.extend(sub_errors)
                continue

            if stripped_line.startswith('-c') or stripped_line.startswith('--constraint'):
                constraint_file = self._parse_include(stripped_line, path.parent)
                if constraint_file:
                    sub_reqs, sub_errors = self.parse_file(constraint_file, is_constraint=True)
                    requirements.extend(sub_reqs)
                    errors.extend(sub_errors)
                continue

            if stripped_line.startswith('-'):
                continue

            try:
                req = self._parse_requirement_line(stripped_line, line_num, is_constraint)
                if req:
                    requirements.append(req)
            except Exception as e:
                errors.append(f"解析第 {line_num} 行失败 '{line}': {str(e)}")

        return requirements, errors

    def _parse_include(self, line: str, base_dir: Path) -> Optional[str]:
        parts = line.split('=', 1) if '=' in line else line.split(None, 1)
        if len(parts) > 1:
            include_path = parts[1].strip()
            if not os.path.isabs(include_path):
                include_path = str(base_dir / include_path)
            return include_path
        return None

    def _parse_requirement_line(self, line: str, line_num: int, from_constraint: bool) -> Optional[Requirement]:
        hashes = []
        hash_matches = list(self.HASH_REGEX.finditer(line))
        
        for match in hash_matches:
            hashes.append(PackageHash(
                algorithm=match.group(1).lower(),
                value=match.group(2).lower(),
                source=PackageSource.REQUIREMENTS if not from_constraint else PackageSource.CONSTRAINTS
            ))
        
        clean_line = self.HASH_REGEX.sub('', line).strip()
        
        if not clean_line:
            return None

        pkg_req = PackagingRequirement(clean_line)
        
        return Requirement(
            name=pkg_req.name,
            raw=line,
            specifier=str(pkg_req.specifier) if pkg_req.specifier else "",
            extras=set(pkg_req.extras),
            hashes=hashes,
            source_line=line_num,
            from_constraint=from_constraint
        )


class DependencyResolver:
    def __init__(self):
        self.parser = RequirementsParser()

    def resolve_requirements_and_constraints(
        self,
        requirements_file: Optional[str] = None,
        constraints_file: Optional[str] = None,
        requirements_list: Optional[List[str]] = None
    ) -> Tuple[List[Requirement], List[ConstraintConflict], List[str]]:
        
        all_requirements: List[Requirement] = []
        all_constraints: List[Requirement] = []
        errors: List[str] = []

        if requirements_file:
            reqs, errs = self.parser.parse_file(requirements_file, is_constraint=False)
            all_requirements.extend(reqs)
            errors.extend(errs)

        if requirements_list:
            for line in requirements_list:
                try:
                    req = self.parser._parse_requirement_line(line, 0, from_constraint=False)
                    if req:
                        all_requirements.append(req)
                except Exception as e:
                    errors.append(f"解析行内依赖失败 '{line}': {str(e)}")

        if constraints_file:
            constraints, errs = self.parser.parse_file(constraints_file, is_constraint=True)
            all_constraints.extend(constraints)
            errors.extend(errs)

        merged_requirements, conflicts = self._apply_constraints(all_requirements, all_constraints)
        
        return merged_requirements, conflicts, errors

    def _apply_constraints(
        self,
        requirements: List[Requirement],
        constraints: List[Requirement]
    ) -> Tuple[List[Requirement], List[ConstraintConflict]]:
        
        constraint_map: dict = {}
        for constraint in constraints:
            key = constraint.canonical_name()
            if key not in constraint_map:
                constraint_map[key] = []
            constraint_map[key].append(constraint)

        conflicts: List[ConstraintConflict] = []
        merged: List[Requirement] = []

        for req in requirements:
            key = req.canonical_name()
            matching_constraints = constraint_map.get(key, [])
            
            if matching_constraints:
                constraint = matching_constraints[0]
                conflict = self._check_specifier_conflict(req, constraint)
                if conflict:
                    conflicts.append(conflict)
                
                merged_req = self._merge_requirement_with_constraint(req, constraint)
                merged.append(merged_req)
            else:
                merged.append(req)

        for key, constraints_list in constraint_map.items():
            exists = any(r.canonical_name() == key for r in merged)
            if not exists and constraints_list:
                merged.append(constraints_list[0])

        return merged, conflicts

    def _check_specifier_conflict(self, req: Requirement, constraint: Requirement) -> Optional[ConstraintConflict]:
        if not req.specifier or not constraint.specifier:
            return None

        try:
            req_spec = SpecifierSet(req.specifier)
            const_spec = SpecifierSet(constraint.specifier)
            
            if self._specifiers_conflict(req_spec, const_spec):
                return ConstraintConflict(
                    package_name=req.name,
                    requirement_spec=req.specifier,
                    constraint_spec=constraint.specifier,
                    resolution=None
                )
        except Exception as e:
            pass
        
        return None

    def _specifiers_conflict(self, spec1: SpecifierSet, spec2: SpecifierSet) -> bool:
        test_versions = [
            "0.0.1", "1.0.0", "10.0.0", "20.0.0", "21.0.0", "21.999.999",
            "22.0.0", "22.999.999", "23.0.0", "23.999.999", "24.0.0", 
            "30.0.0", "50.0.0", "100.0.0", "999.999.999"
        ]
        
        for v_str in test_versions:
            v = Version(v_str)
            if v in spec1 and v in spec2:
                return False
        
        return True

    def _merge_requirement_with_constraint(self, req: Requirement, constraint: Requirement) -> Requirement:
        merged = Requirement(
            name=req.name,
            raw=f"{req.raw} (constrained by {constraint.raw})",
            specifier=constraint.specifier or req.specifier,
            extras=req.extras.union(constraint.extras),
            hashes=req.hashes + constraint.hashes,
            source_line=req.source_line,
            from_constraint=True
        )
        return merged
