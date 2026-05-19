import glob
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

from .models import (
    ExportEntry,
    Issue,
    IssueSeverity,
    IssueType,
    ValidationResult,
)


class FileValidator:
    def __init__(self, package_root: Union[str, Path]):
        self.package_root = Path(package_root).resolve()
        self.file_checks: Dict[str, bool] = {}
        self.issues: List[Issue] = []
        
    def validate_entries(self, entries: List[ExportEntry]) -> Tuple[Dict[str, bool], List[Issue]]:
        self.file_checks.clear()
        self.issues.clear()
        
        for entry in entries:
            self._validate_entry(entry)
            
        return self.file_checks, self.issues
        
    def _validate_entry(self, entry: ExportEntry) -> None:
        target_path = entry.target_path
        
        if target_path.startswith("./"):
            target_path = target_path[2:]
        elif target_path.startswith("/"):
            target_path = target_path[1:]
            
        if entry.is_wildcard:
            self._validate_wildcard_entry(entry, target_path)
        elif entry.is_directory:
            self._validate_directory_entry(entry, target_path)
        else:
            self._validate_file_entry(entry, target_path)
            
    def _validate_file_entry(self, entry: ExportEntry, target_path: str) -> None:
        full_path = self.package_root / target_path
        path_key = entry.target_path
        
        exists = full_path.exists()
        self.file_checks[path_key] = exists
        
        if not exists:
            self.issues.append(Issue(
                severity=IssueSeverity.ERROR,
                issue_type=IssueType.FILE_NOT_FOUND,
                message=f"Target file not found: {entry.target_path}",
                export_path=entry.export_path,
                target_path=entry.target_path,
                details={
                    "full_path": str(full_path),
                    "conditions": entry.conditions,
                },
            ))
            
    def _validate_directory_entry(self, entry: ExportEntry, target_path: str) -> None:
        dir_path = target_path.rstrip("/")
        full_path = self.package_root / dir_path
        path_key = entry.target_path
        
        exists = full_path.is_dir()
        self.file_checks[path_key] = exists
        
        if not exists:
            self.issues.append(Issue(
                severity=IssueSeverity.ERROR,
                issue_type=IssueType.FILE_NOT_FOUND,
                message=f"Target directory not found: {entry.target_path}",
                export_path=entry.export_path,
                target_path=entry.target_path,
                details={
                    "full_path": str(full_path),
                    "conditions": entry.conditions,
                },
            ))
        else:
            files = list(full_path.glob("**/*"))
            files = [f for f in files if f.is_file()]
            if not files:
                self.issues.append(Issue(
                    severity=IssueSeverity.WARNING,
                    issue_type=IssueType.EMPTY_EXPORTS,
                    message=f"Target directory is empty: {entry.target_path}",
                    export_path=entry.export_path,
                    target_path=entry.target_path,
                ))
                
    def _validate_wildcard_entry(self, entry: ExportEntry, target_path: str) -> None:
        glob_pattern = target_path.replace("*", "**/*")
        if glob_pattern == target_path:
            glob_pattern = target_path
            
        full_glob = str(self.package_root / glob_pattern)
        matching_files = glob.glob(full_glob, recursive=True)
        
        path_key = entry.target_path
        has_matches = len(matching_files) > 0
        self.file_checks[path_key] = has_matches
        
        if not has_matches:
            self.issues.append(Issue(
                severity=IssueSeverity.ERROR,
                issue_type=IssueType.FILE_NOT_FOUND,
                message=f"No files match wildcard pattern: {entry.target_path}",
                export_path=entry.export_path,
                target_path=entry.target_path,
                details={
                    "glob_pattern": glob_pattern,
                    "conditions": entry.conditions,
                },
            ))
        else:
            for match_path in matching_files[:5]:
                rel_path = Path(match_path).relative_to(self.package_root)
                self.file_checks[f"./{rel_path}"] = True
                
    def resolve_import(self, import_path: str, entries: List[ExportEntry]) -> Tuple[Optional[str], List[Issue]]:
        issues: List[Issue] = []
        matched_entry: Optional[ExportEntry] = None
        
        for entry in entries:
            if self._matches_import(import_path, entry):
                matched_entry = entry
                break
                
        if not matched_entry:
            issues.append(Issue(
                severity=IssueSeverity.ERROR,
                issue_type=IssueType.UNRESOLVABLE_PATH,
                message=f"Import path '{import_path}' does not match any export entry",
                export_path=import_path,
            ))
            return None, issues
            
        resolved = self._resolve_target_path(import_path, matched_entry)
        return resolved, issues
        
    def _matches_import(self, import_path: str, entry: ExportEntry) -> bool:
        export_path = entry.export_path
        
        if export_path == ".":
            return import_path in ["", "."]
            
        if "*" in export_path:
            pattern = "^" + export_path.replace("*", "(.*)") + "$"
            import re
            try:
                return bool(re.match(pattern, import_path))
            except re.error:
                return False
                
        return import_path == export_path or import_path.startswith(f"{export_path}/")
        
    def _resolve_target_path(self, import_path: str, entry: ExportEntry) -> str:
        target_path = entry.target_path
        
        if "*" in target_path and "*" in entry.export_path:
            import re
            pattern = "^" + entry.export_path.replace("*", "(.*)") + "$"
            match = re.match(pattern, import_path)
            if match:
                wildcard_value = match.group(1)
                target_path = target_path.replace("*", wildcard_value)
                
        return target_path
