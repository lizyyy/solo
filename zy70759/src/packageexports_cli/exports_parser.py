import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from .models import (
    ExportEntry,
    Issue,
    IssueSeverity,
    IssueType,
    ValidationResult,
)


class ExportsParser:
    def __init__(self, package_root: Union[str, Path]):
        self.package_root = Path(package_root).resolve()
        self.package_json_path = self.package_root / "package.json"
        self.issues: List[Issue] = []
        self.exports_entries: List[ExportEntry] = []
        
    def parse(self) -> Tuple[Optional[Dict[str, Any]], List[Issue]]:
        if not self.package_json_path.exists():
            self.issues.append(Issue(
                severity=IssueSeverity.ERROR,
                issue_type=IssueType.FILE_NOT_FOUND,
                message=f"package.json not found at {self.package_json_path}",
                target_path=str(self.package_json_path),
            ))
            return None, self.issues
            
        try:
            with open(self.package_json_path, "r", encoding="utf-8") as f:
                package_data = json.load(f)
        except json.JSONDecodeError as e:
            self.issues.append(Issue(
                severity=IssueSeverity.ERROR,
                issue_type=IssueType.INVALID_JSON,
                message=f"Invalid JSON in package.json: {e}",
                target_path=str(self.package_json_path),
                details={"error": str(e), "line": e.lineno, "column": e.colno},
            ))
            return None, self.issues
            
        exports = package_data.get("exports")
        if exports is None:
            self.issues.append(Issue(
                severity=IssueSeverity.WARNING,
                issue_type=IssueType.MISSING_EXPORT_ENTRY,
                message="No 'exports' field found in package.json",
            ))
            return package_data, self.issues
            
        if not exports:
            self.issues.append(Issue(
                severity=IssueSeverity.WARNING,
                issue_type=IssueType.EMPTY_EXPORTS,
                message="'exports' field is empty",
            ))
            return package_data, self.issues
            
        self._parse_exports(exports, "")
        return package_data, self.issues
        
    def _parse_exports(
        self,
        exports_value: Any,
        current_path: str,
        conditions: Optional[List[str]] = None,
    ) -> None:
        conditions = conditions or []
        
        if isinstance(exports_value, str):
            self._add_export_entry(current_path, exports_value, conditions)
            
        elif isinstance(exports_value, dict):
            if not exports_value:
                self.issues.append(Issue(
                    severity=IssueSeverity.WARNING,
                    issue_type=IssueType.EMPTY_EXPORTS,
                    message=f"Empty export mapping at '{current_path or '.'}'",
                    export_path=current_path or ".",
                ))
                return
                
            for key, value in exports_value.items():
                if key.startswith("."):
                    new_path = key if current_path == "" else f"{current_path}/{key[1:]}"
                    self._parse_exports(value, new_path, conditions)
                else:
                    new_conditions = conditions + [key]
                    self._parse_exports(value, current_path, new_conditions)
                    
        elif isinstance(exports_value, list):
            for idx, item in enumerate(exports_value):
                self._parse_exports(item, current_path, conditions)
                
        elif exports_value is None:
            self.issues.append(Issue(
                severity=IssueSeverity.INFO,
                issue_type=IssueType.MISSING_CONDITION,
                message=f"Null export at '{current_path or '.'}' with conditions {conditions}",
                export_path=current_path or ".",
                details={"conditions": conditions},
            ))
        else:
            self.issues.append(Issue(
                severity=IssueSeverity.ERROR,
                issue_type=IssueType.INVALID_EXPORT_PATTERN,
                message=f"Invalid export value type '{type(exports_value).__name__}' at '{current_path or '.'}'",
                export_path=current_path or ".",
                details={"conditions": conditions, "type": type(exports_value).__name__},
            ))
            
    def _add_export_entry(
        self,
        export_path: str,
        target_path: str,
        conditions: List[str],
    ) -> None:
        is_wildcard = "*" in target_path
        is_directory = target_path.endswith("/")
        
        normalized_export_path = export_path or "."
        self.exports_entries.append(ExportEntry(
            export_path=normalized_export_path,
            target_path=target_path,
            conditions=conditions.copy(),
            is_directory=is_directory,
            is_wildcard=is_wildcard,
        ))
        
        self._check_pattern_conflicts(normalized_export_path, target_path)
        
    def _check_pattern_conflicts(self, export_path: str, target_path: str) -> None:
        for existing in self.exports_entries[:-1]:
            if existing.export_path == export_path and existing.target_path == target_path:
                continue
                
            if self._paths_conflict(existing.export_path, export_path):
                self.issues.append(Issue(
                    severity=IssueSeverity.WARNING,
                    issue_type=IssueType.CONFLICTING_PATTERN,
                    message=f"Potential pattern conflict: '{export_path}' may conflict with '{existing.export_path}'",
                    export_path=export_path,
                    details={"conflicting_with": existing.export_path},
                ))
                
    def _paths_conflict(self, path1: str, path2: str) -> bool:
        if path1 == path2:
            return False
            
        p1 = path1.replace("*", ".*") if "*" in path1 else path1
        p2 = path2.replace("*", ".*") if "*" in path2 else path2
        
        try:
            return bool(re.match(f"^{p1}$", path2)) or bool(re.match(f"^{p2}$", path1))
        except re.error:
            return False
