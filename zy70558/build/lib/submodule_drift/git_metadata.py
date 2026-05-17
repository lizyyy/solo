from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any

import git


class ParseError(Exception):
    """Raised when parsing .gitmodules fails"""
    def __init__(self, message: str, line_number: Optional[int] = None, line_content: Optional[str] = None):
        self.line_number = line_number
        self.line_content = line_content
        super().__init__(message)


@dataclass
class SubmoduleInfo:
    name: str
    path: str
    url: str
    branch: Optional[str] = None
    expected_commit: Optional[str] = None
    actual_commit: Optional[str] = None
    errors: List[Dict[str, Any]] = field(default_factory=list)
    raw_lines: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ParseResult:
    submodules: List[SubmoduleInfo]
    errors: List[Dict[str, Any]] = field(default_factory=list)
    raw_content: Optional[str] = None


class GitMetadataReader:
    GITMODULES_PATTERN = re.compile(r'\[submodule\s+"([^"]+)"\]')

    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
        self.gitmodules_path = self.repo_path / ".gitmodules"

    def parse_gitmodules(self) -> ParseResult:
        result = ParseResult()
        
        if not self.gitmodules_path.exists():
            result.errors.append({
                "type": "file_missing",
                "message": ".gitmodules file not found",
                "path": str(self.gitmodules_path)
            })
            return result

        try:
            content = self.gitmodules_path.read_text()
            result.raw_content = content
        except Exception as e:
            result.errors.append({
                "type": "file_read_error",
                "message": f"Failed to read .gitmodules: {str(e)}",
                "path": str(self.gitmodules_path)
            })
            return result

        lines = content.splitlines()
        
        submodules: Dict[str, SubmoduleInfo] = {}
        current_submodule: Optional[str] = None
        
        for line_num, line in enumerate(lines, 1):
            original_line = line
            line = line.strip()
            
            if not line or line.startswith("#"):
                continue

            match = self.GITMODULES_PATTERN.match(line)
            if match:
                current_submodule = match.group(1)
                if current_submodule not in submodules:
                    submodules[current_submodule] = SubmoduleInfo(
                        name=current_submodule,
                        path="",
                        url=""
                    )
                submodules[current_submodule].raw_lines.append({
                    "line_number": line_num,
                    "content": original_line,
                    "field": "section"
                })
                continue

            if current_submodule is None:
                if "=" in line:
                    result.errors.append({
                        "type": "orphan_line",
                        "message": "Property found outside submodule section",
                        "line_number": line_num,
                        "line_content": original_line
                    })
                continue

            if "=" not in line:
                submodules[current_submodule].errors.append({
                    "type": "malformed_line",
                    "message": "Line does not contain '=' separator",
                    "line_number": line_num,
                    "line_content": original_line
                })
                continue

            try:
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()

                submodules[current_submodule].raw_lines.append({
                    "line_number": line_num,
                    "content": original_line,
                    "field": key
                })

                if key == "path":
                    submodules[current_submodule].path = value
                elif key == "url":
                    submodules[current_submodule].url = value
                elif key == "branch":
                    submodules[current_submodule].branch = value
                else:
                    submodules[current_submodule].errors.append({
                        "type": "unknown_field",
                        "message": f"Unknown field '{key}'",
                        "line_number": line_num,
                        "line_content": original_line,
                        "field": key,
                        "value": value
                    })
            except Exception as e:
                submodules[current_submodule].errors.append({
                    "type": "parse_error",
                    "message": f"Failed to parse line: {str(e)}",
                    "line_number": line_num,
                    "line_content": original_line
                })

        for name, submodule in submodules.items():
            if not submodule.path:
                submodule.errors.append({
                    "type": "missing_path",
                    "message": "Submodule missing 'path' property"
                })
            if not submodule.url:
                submodule.errors.append({
                    "type": "missing_url",
                    "message": "Submodule missing 'url' property"
                })

        result.submodules = list(submodules.values())
        return result

    def get_expected_commits(self, submodules: List[SubmoduleInfo]) -> List[SubmoduleInfo]:
        try:
            repo = git.Repo(self.repo_path)
            
            for submodule in submodules:
                if not submodule.path:
                    continue
                    
                try:
                    for sm in repo.submodules:
                        if sm.path == submodule.path or sm.name == submodule.name:
                            submodule.expected_commit = sm.hexsha
                            break
                except Exception as e:
                    submodule.errors.append({
                        "type": "expected_commit_error",
                        "message": f"Failed to get expected commit: {str(e)}"
                    })
        except Exception as e:
            for submodule in submodules:
                submodule.errors.append({
                    "type": "repo_error",
                    "message": f"Failed to access main repo: {str(e)}"
                })
        
        return submodules

    def get_actual_commits(self, submodules: List[SubmoduleInfo]) -> List[SubmoduleInfo]:
        for submodule in submodules:
            if not submodule.path:
                continue
                
            submodule_path = self.repo_path / submodule.path
            
            if not submodule_path.exists():
                submodule.errors.append({
                    "type": "path_not_found",
                    "message": f"Submodule path does not exist: {submodule.path}"
                })
                continue

            try:
                sm_repo = git.Repo(submodule_path)
                submodule.actual_commit = sm_repo.head.commit.hexsha
            except git.InvalidGitRepositoryError:
                submodule.errors.append({
                    "type": "not_a_git_repo",
                    "message": f"Path is not a git repository: {submodule.path}"
                })
            except Exception as e:
                submodule.errors.append({
                    "type": "actual_commit_error",
                    "message": f"Failed to get actual commit: {str(e)}",
                    "path": str(submodule_path)
                })

        return submodules

    def get_all_submodule_info(self) -> List[SubmoduleInfo]:
        parse_result = self.parse_gitmodules()
        
        submodules = parse_result.submodules
        
        submodules = self.get_expected_commits(submodules)
        submodules = self.get_actual_commits(submodules)
        
        for error in parse_result.errors:
            if submodules:
                submodules[0].errors.append(error)
            else:
                dummy = SubmoduleInfo(name="_parse_errors", path="", url="")
                dummy.errors.append(error)
                submodules.append(dummy)
        
        return submodules

        return submodules
