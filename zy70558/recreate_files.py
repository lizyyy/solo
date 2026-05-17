def create_git_metadata():
    content = '''from __future__ import annotations

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
    GITMODULES_PATTERN = re.compile(r'\\[submodule\\s+"([^"]+)"\\]')

    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
        self.gitmodules_path = self.repo_path / ".gitmodules"

    def parse_gitmodules(self) -> ParseResult:
        result = ParseResult(submodules=[])
        
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
'''
    with open("src/submodule_drift/git_metadata.py", "w") as f:
        f.write(content)
    print("Created git_metadata.py")


def create_drift_detector():
    content = '''from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

import git

from .git_metadata import SubmoduleInfo


@dataclass
class DriftResult:
    submodule: SubmoduleInfo
    has_drift: bool
    is_missing: bool
    commits_ahead: int
    commits_behind: int
    drift_type: Optional[str] = None
    last_updated: Optional[datetime] = None
    remote_status: Optional[str] = None
    errors: List[Dict[str, Any]] = field(default_factory=list)
    raw_context: Dict[str, Any] = field(default_factory=dict)


class DriftDetector:
    def __init__(self, repo_path: Optional[str] = None):
        self.repo_path = Path(repo_path) if repo_path else Path.cwd()

    def detect_drift(self, submodules: List[SubmoduleInfo]) -> List[DriftResult]:
        results: List[DriftResult] = []
        
        for submodule in submodules:
            result = self._detect_single_drift(submodule)
            results.append(result)
        
        return results

    def _detect_single_drift(self, submodule: SubmoduleInfo) -> DriftResult:
        is_missing = self._is_submodule_missing(submodule)
        has_drift = False
        commits_ahead = 0
        commits_behind = 0
        drift_type = None
        errors: List[Dict[str, Any]] = []
        raw_context: Dict[str, Any] = {}

        raw_context["raw_lines"] = submodule.raw_lines
        raw_context["parse_errors"] = submodule.errors

        if submodule.errors:
            errors.extend([{
                "type": e.get("type", "unknown"),
                "message": e.get("message", ""),
                "line_number": e.get("line_number"),
                "line_content": e.get("line_content"),
                "source": "parse"
            } for e in submodule.errors])

        if not is_missing:
            try:
                has_drift, commits_ahead, commits_behind, drift_type, drift_errors = self._analyze_commit_drift(submodule)
                errors.extend([{**e, "source": "drift_detection"} for e in drift_errors])
            except Exception as e:
                errors.append({
                    "type": "analysis_failed",
                    "message": f"Commit drift analysis failed: {str(e)}",
                    "source": "drift_detection"
                })
                has_drift = True
                drift_type = "error"
        else:
            errors.append({
                "type": "submodule_missing",
                "message": f"Submodule directory not found or invalid: {submodule.path}",
                "source": "existence_check"
            })

        return DriftResult(
            submodule=submodule,
            has_drift=has_drift,
            is_missing=is_missing,
            commits_ahead=commits_ahead,
            commits_behind=commits_behind,
            drift_type=drift_type,
            last_updated=datetime.now(),
            errors=errors,
            raw_context=raw_context
        )

    def _is_submodule_missing(self, submodule: SubmoduleInfo) -> bool:
        if not submodule.path:
            return True
            
        submodule_path = self.repo_path / submodule.path
        if not submodule_path.exists():
            return True
        try:
            git.Repo(submodule_path)
            return False
        except Exception:
            return True

    def _analyze_commit_drift(self, submodule: SubmoduleInfo) -> tuple:
        errors: List[Dict[str, Any]] = []

        if not submodule.expected_commit:
            errors.append({
                "type": "missing_expected_commit",
                "message": "Expected commit could not be determined from git index",
                "submodule_name": submodule.name
            })
            return True, 0, 0, "unknown", errors

        if not submodule.actual_commit:
            errors.append({
                "type": "missing_actual_commit",
                "message": "Actual commit could not be determined from submodule",
                "submodule_name": submodule.name
            })
            return True, 0, 0, "unknown", errors

        if submodule.expected_commit == submodule.actual_commit:
            return False, 0, 0, None, errors

        commits_ahead, commits_behind, count_errors = self._count_commit_difference(submodule)
        errors.extend(count_errors)

        if commits_ahead > 0 and commits_behind > 0:
            drift_type = "diverged"
        elif commits_ahead > 0:
            drift_type = "ahead"
        elif commits_behind > 0:
            drift_type = "behind"
        else:
            drift_type = "modified"

        return True, commits_ahead, commits_behind, drift_type, errors

    def _count_commit_difference(self, submodule: SubmoduleInfo) -> tuple:
        errors: List[Dict[str, Any]] = []
        submodule_path = self.repo_path / submodule.path
        
        try:
            repo = git.Repo(submodule_path)
            
            commits_ahead = 0
            try:
                for commit in repo.iter_commits(f"{submodule.expected_commit}..{submodule.actual_commit}"):
                    commits_ahead += 1
            except Exception as e:
                errors.append({
                    "type": "count_ahead_failed",
                    "message": f"Failed to count commits ahead: {str(e)}",
                    "expected_commit": submodule.expected_commit,
                    "actual_commit": submodule.actual_commit
                })

            commits_behind = 0
            try:
                for commit in repo.iter_commits(f"{submodule.actual_commit}..{submodule.expected_commit}"):
                    commits_behind += 1
            except Exception as e:
                errors.append({
                    "type": "count_behind_failed",
                    "message": f"Failed to count commits behind: {str(e)}",
                    "expected_commit": submodule.expected_commit,
                    "actual_commit": submodule.actual_commit
                })

            return commits_ahead, commits_behind, errors
        except Exception as e:
            errors.append({
                "type": "repo_access_failed",
                "message": f"Failed to access submodule repository: {str(e)}",
                "path": str(submodule_path)
            })
            return 0, 0, errors

    def analyze_remote_status(self, submodules: List[SubmoduleInfo]) -> Dict[str, Dict[str, Any]]:
        remote_status: Dict[str, Dict[str, Any]] = {}
        
        for submodule in submodules:
            result: Dict[str, Any] = {
                "status": "unknown",
                "local_commit": None,
                "remote_commit": None,
                "error": None
            }
            
            submodule_path = self.repo_path / submodule.path
            if not submodule_path.exists():
                result["status"] = "missing"
                remote_status[submodule.name] = result
                continue

            try:
                repo = git.Repo(submodule_path)
                if not repo.remotes:
                    result["status"] = "no_remote"
                    remote_status[submodule.name] = result
                    continue

                remote = repo.remote()
                try:
                    remote.fetch()
                    result["local_commit"] = repo.head.commit.hexsha
                    
                    try:
                        remote_commit = repo.rev_parse(f"{remote.name}/{repo.active_branch.name}")
                        result["remote_commit"] = remote_commit.hexsha
                        
                        if result["local_commit"] == result["remote_commit"]:
                            result["status"] = "in_sync"
                        else:
                            result["status"] = "out_of_sync"
                    except Exception as e:
                        result["status"] = "branch_error"
                        result["error"] = f"Failed to get remote branch: {str(e)}"
                except Exception as e:
                    result["status"] = "remote_error"
                    result["error"] = f"Failed to fetch remote: {str(e)}"
            except Exception as e:
                result["status"] = "error"
                result["error"] = f"Failed to access repo: {str(e)}"

            remote_status[submodule.name] = result

        return remote_status

    def detect_with_remote(self, submodules: List[SubmoduleInfo]) -> List[DriftResult]:
        results = self.detect_drift(submodules)
        remote_statuses = self.analyze_remote_status(submodules)
        
        for result in results:
            if result.submodule.name in remote_statuses:
                result.remote_status = remote_statuses[result.submodule.name]["status"]
        
        return results
'''
    with open("src/submodule_drift/drift_detector.py", "w") as f:
        f.write(content)
    print("Created drift_detector.py")


def create_report_generator():
    content = '''from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List

from rich.console import Console
from rich.table import Table

from .drift_detector import DriftResult


class ReportGenerator:
    def __init__(self):
        self.console = Console()

    def generate_terminal_summary(self, results: List[DriftResult]) -> None:
        has_errors = any(r.errors for r in results)
        
        if has_errors:
            self._print_error_summary(results)
        
        table = Table(title="Git Submodule Drift Detection Report")
        
        table.add_column("Submodule", style="cyan")
        table.add_column("Status", style="magenta")
        table.add_column("Drift Type", style="yellow")
        table.add_column("Ahead", style="green")
        table.add_column("Behind", style="red")
        table.add_column("Expected", style="blue")
        table.add_column("Actual", style="blue")
        table.add_column("Remote", style="dim")
        
        for result in results:
            if result.is_missing:
                status = "[red]MISSING[/red]"
                drift_type = "-"
                ahead = "-"
                behind = "-"
            elif result.has_drift:
                status = "[red]DRIFT[/red]"
                drift_type = result.drift_type or "unknown"
                ahead = str(result.commits_ahead)
                behind = str(result.commits_behind)
            else:
                status = "[green]OK[/green]"
                drift_type = "-"
                ahead = "-"
                behind = "-"
            
            expected = result.submodule.expected_commit[:8] if result.submodule.expected_commit else "N/A"
            actual = result.submodule.actual_commit[:8] if result.submodule.actual_commit else "N/A"
            remote = result.remote_status or "-"
            
            table.add_row(
                result.submodule.name,
                status,
                drift_type,
                ahead,
                behind,
                expected,
                actual,
                remote
            )
        
        self.console.print(table)
        
        total = len(results)
        missing = sum(1 for r in results if r.is_missing)
        drifted = sum(1 for r in results if r.has_drift and not r.is_missing)
        ok = total - missing - drifted
        with_errors = sum(1 for r in results if r.errors)
        
        summary_line = (
            f"\\nSummary: [green]{ok} OK[/green] | "
            f"[red]{drifted} DRIFT[/red] | "
            f"[yellow]{missing} MISSING[/yellow] | "
            f"[dim]{with_errors} with errors[/dim] | "
            f"Total: {total}"
        )
        self.console.print(summary_line)

    def _print_error_summary(self, results: List[DriftResult]) -> None:
        all_errors = []
        for result in results:
            for error in result.errors:
                all_errors.append((result.submodule.name, error))
        
        if all_errors:
            error_panel = Panel.fit(
                "\\n".join([f"[cyan]{name}[/cyan]: {error.get('message', 'Unknown error')}" 
                          for name, error in all_errors[:5]]),
                title=f"⚠️  {len(all_errors)} Errors Found",
                border_style="yellow"
            )
            self.console.print(error_panel)

    def generate_json(self, results: List[DriftResult], output_path: str = None) -> str:
        data = {
            "generated_at": datetime.now().isoformat(),
            "summary": self._build_summary(results),
            "results": [],
            "errors": []
        }
        
        for result in results:
            result_data = {
                "name": result.submodule.name,
                "path": result.submodule.path,
                "url": result.submodule.url,
                "branch": result.submodule.branch,
                "expected_commit": result.submodule.expected_commit,
                "actual_commit": result.submodule.actual_commit,
                "has_drift": result.has_drift,
                "is_missing": result.is_missing,
                "commits_ahead": result.commits_ahead,
                "commits_behind": result.commits_behind,
                "drift_type": result.drift_type,
                "remote_status": result.remote_status,
                "errors": result.errors,
                "raw_lines": result.raw_context.get("raw_lines", [])
            }
            data["results"].append(result_data)
            
            for error in result.errors:
                data["errors"].append({
                    "submodule": result.submodule.name,
                    **error
                })
        
        json_output = json.dumps(data, indent=2, ensure_ascii=False)
        
        if output_path:
            Path(output_path).write_text(json_output, encoding="utf-8")
        
        return json_output

    def generate_markdown(self, results: List[DriftResult], output_path: str = None) -> str:
        lines = [
            "# Git Submodule Drift Detection Report",
            "",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## Summary",
            ""
        ]
        
        summary = self._build_summary(results)
        lines.extend([
            "| Metric | Count |",
            "|--------|-------|",
            f"| OK | {summary['ok']} |",
            f"| With Drift | {summary['drifted']} |",
            f"| Missing | {summary['missing']} |",
            f"| With Errors | {summary['with_errors']} |",
            f"| **Total** | **{summary['total']}** |",
            "",
            "## Detailed Results",
            "",
            "| Submodule | Status | Drift Type | Ahead | Behind | Expected | Actual | Remote |",
            "|-----------|--------|------------|-------|--------|----------|--------|--------|"
        ])
        
        for result in results:
            if result.is_missing:
                status = "MISSING"
                drift_type = "-"
                ahead = "-"
                behind = "-"
            elif result.has_drift:
                status = "DRIFT"
                drift_type = result.drift_type or "unknown"
                ahead = str(result.commits_ahead)
                behind = str(result.commits_behind)
            else:
                status = "OK"
                drift_type = "-"
                ahead = "-"
                behind = "-"
            
            expected = result.submodule.expected_commit[:8] if result.submodule.expected_commit else "N/A"
            actual = result.submodule.actual_commit[:8] if result.submodule.actual_commit else "N/A"
            remote = result.remote_status or "-"
            
            lines.append(f"| {result.submodule.name} | {status} | {drift_type} | {ahead} | {behind} | {expected} | {actual} | {remote} |")
        
        error_count = sum(len(r.errors) for r in results)
        if error_count > 0:
            lines.extend([
                "",
                "## Errors Found",
                "",
                "| Submodule | Type | Line | Message |",
                "|-----------|------|------|---------|"
            ])
            
            for result in results:
                for error in result.errors:
                    line_num = error.get("line_number", "-")
                    msg = error.get("message", "Unknown error").replace("|", "\\|")
                    lines.append(f"| {result.submodule.name} | {error.get('type', 'unknown')} | {line_num} | {msg} |")
        
        lines.extend([
            "",
            "## Submodule Details",
            ""
        ])
        
        for result in results:
            lines.extend([
                f"### {result.submodule.name}",
                "",
                f"- Path: `{result.submodule.path}`",
                f"- URL: `{result.submodule.url}`",
                f"- Branch: `{result.submodule.branch or 'default'}`"
            ])
            
            if result.submodule.expected_commit:
                lines.append(f"- Expected Commit: `{result.submodule.expected_commit}`")
            if result.submodule.actual_commit:
                lines.append(f"- Actual Commit: `{result.submodule.actual_commit}`")
            
            if result.raw_context.get("raw_lines"):
                lines.append("")
                lines.append("Raw .gitmodules lines:")
                lines.append("```")
                for line_info in result.raw_context["raw_lines"]:
                    lines.append(f"Line {line_info.get('line_number', '?')}: {line_info.get('content', '')}")
                lines.append("```")
            
            lines.append("")
        
        markdown_output = "\\n".join(lines)
        
        if output_path:
            Path(output_path).write_text(markdown_output, encoding="utf-8")
        
        return markdown_output

    def _build_summary(self, results: List[DriftResult]) -> dict:
        total = len(results)
        missing = sum(1 for r in results if r.is_missing)
        drifted = sum(1 for r in results if r.has_drift and not r.is_missing)
        ok = total - missing - drifted
        with_errors = sum(1 for r in results if r.errors)
        
        return {
            "total": total,
            "ok": ok,
            "drifted": drifted,
            "missing": missing,
            "with_errors": with_errors
        }

    def generate_team_email_content(self, results: List[DriftResult]) -> str:
        drifted = [r for r in results if r.has_drift and not r.is_missing]
        missing = [r for r in results if r.is_missing]
        ok = [r for r in results if not r.has_drift and not r.is_missing]
        
        lines = [
            "Hi Team,",
            "",
            "This is an automated submodule drift detection report. Please review the issues below.",
            ""
        ]
        
        if drifted:
            lines.extend([
                "### ⚠️ Submodules with Commit Drift",
                "",
                "| Submodule | Drift Type | Ahead | Behind |",
                "|-----------|------------|-------|--------|"
            ])
            for r in drifted:
                lines.append(f"| {r.submodule.name} | {r.drift_type} | {r.commits_ahead} | {r.commits_behind} |")
            lines.append("")
        
        if missing:
            lines.extend([
                "### ❌ Missing Submodules",
                "",
                "The following submodules could not be found:",
                ""
            ])
            for r in missing:
                lines.append(f"- {r.submodule.name} (`{r.submodule.path}`)")
            lines.append("")
        
        lines.extend([
            "### Action Items",
            "",
            "1. Please verify the drifted submodules and update .gitmodules if needed",
            "2. Run `git submodule update --init --recursive` to initialize missing submodules",
            "3. If you made local changes, please commit them or stash them before updating",
            "",
            "Best regards,",
            "Submodule Drift Bot"
        ])
        
        return "\\n".join(lines)
'''
    with open("src/submodule_drift/report_generator.py", "w") as f:
        f.write(content)
    print("Created report_generator.py")


def create_cli():
    content = '''from __future__ import annotations

import os
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel

from . import __version__
from .git_metadata import GitMetadataReader
from .drift_detector import DriftDetector
from .report_generator import ReportGenerator

console = Console()


@click.group()
@click.version_option(version=__version__)
def main():
    """Git Submodule Drift Detection CLI Tool"""
    pass


@main.command()
@click.argument("repo_path", type=click.Path(exists=True), default=".")
@click.option("--json", "json_output", type=click.Path(), help="Output JSON report to file")
@click.option("--markdown", "markdown_output", type=click.Path(), help="Output Markdown report to file")
@click.option("--email", is_flag=True, help="Generate team email content")
@click.option("--remote", "-r", is_flag=True, help="Check remote status (requires network)")
@click.option("--quiet", "-q", is_flag=True, help="Suppress terminal output")
@click.option("--strict", is_flag=True, help="Exit with error if any issues found")
def check(repo_path, json_output, markdown_output, email, remote, quiet, strict):
    """Check submodules for commit drift"""
    try:
        reader = GitMetadataReader(repo_path)
        submodules = reader.get_all_submodule_info()
        
        if not submodules:
            if not quiet:
                console.print("[yellow]No submodules found in this repository[/yellow]")
            return
        
        detector = DriftDetector(repo_path)
        
        if remote:
            if not quiet:
                console.print("[cyan]Fetching remote status...[/cyan]")
            results = detector.detect_with_remote(submodules)
        else:
            results = detector.detect_drift(submodules)
        
        reporter = ReportGenerator()
        
        if not quiet:
            reporter.generate_terminal_summary(results)
        
        if json_output:
            reporter.generate_json(results, json_output)
            if not quiet:
                console.print(f"[green]JSON report written to: {json_output}[/green]")
        
        if markdown_output:
            reporter.generate_markdown(results, markdown_output)
            if not quiet:
                console.print(f"[green]Markdown report written to: {markdown_output}[/green]")
        
        if email:
            email_content = reporter.generate_team_email_content(results)
            console.print(Panel(email_content, title="Team Email Content", border_style="blue"))
        
        if strict:
            has_issues = any(r.has_drift or r.is_missing or r.errors for r in results)
            if has_issues:
                sys.exit(1)
        
    except Exception as e:
        console.print(f"[red]Error: {str(e)}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command(name="list")
@click.argument("repo_path", type=click.Path(exists=True), default=".")
@click.option("--raw", is_flag=True, help="Show raw .gitmodules lines")
def list_submodules(repo_path, raw):
    """List all submodules with basic info"""
    reader = GitMetadataReader(repo_path)
    parse_result = reader.parse_gitmodules()
    
    if not parse_result.submodules:
        console.print("[yellow]No submodules found[/yellow]")
        return
    
    table = Table(title="Submodules List")
    table.add_column("Name", style="cyan")
    table.add_column("Path", style="magenta")
    table.add_column("URL", style="blue")
    table.add_column("Branch", style="green")
    
    for sm in parse_result.submodules:
        table.add_row(
            sm.name,
            sm.path or "(none)",
            sm.url or "(none)",
            sm.branch or "default"
        )
    
    console.print(table)
    
    if raw and parse_result.raw_content:
        console.print(Panel(parse_result.raw_content, title="Raw .gitmodules Content", border_style="dim"))


@main.command()
@click.argument("repo_path", type=click.Path(exists=True), default=".")
@click.option("--no-fetch", is_flag=True, help="Skip fetching (use cached info)")
def remote(repo_path, no_fetch):
    """Check remote status for all submodules"""
    reader = GitMetadataReader(repo_path)
    submodules = reader.get_all_submodule_info()
    
    if not submodules:
        console.print("[yellow]No submodules found[/yellow]")
        return
    
    detector = DriftDetector(repo_path)
    
    with console.status("[cyan]Checking remote status...[/cyan]"):
        remote_statuses = detector.analyze_remote_status(submodules)
    
    table = Table(title="Remote Status")
    table.add_column("Submodule", style="cyan")
    table.add_column("Status", style="magenta")
    table.add_column("Local Commit", style="blue")
    table.add_column("Remote Commit", style="blue")
    
    for sm in submodules:
        status = remote_statuses.get(sm.name, {})
        status_str = status.get("status", "unknown")
        
        if status_str == "in_sync":
            status_display = "[green]IN SYNC[/green]"
        elif status_str == "out_of_sync":
            status_display = "[red]OUT OF SYNC[/red]"
        else:
            status_display = f"[yellow]{status_str.upper()}[/yellow]"
        
        local = status.get("local_commit", "")
        remote = status.get("remote_commit", "")
        
        table.add_row(
            sm.name,
            status_display,
            local[:8] if local else "-",
            remote[:8] if remote else "-"
        )
    
    console.print(table)


@main.command()
@click.argument("repo_path", type=click.Path(exists=True), default=".")
def parse(repo_path):
    """Parse .gitmodules and show detailed info"""
    reader = GitMetadataReader(repo_path)
    parse_result = reader.parse_gitmodules()
    
    console.print(f"[cyan]File:[/cyan] {reader.gitmodules_path}")
    console.print()
    
    if parse_result.errors:
        console.print(f"[red]{len(parse_result.errors)} parse errors:[/red]")
        for error in parse_result.errors:
            line_num = error.get("line_number", "?")
            line_content = error.get("line_content", "")
            msg = error.get("message", "Unknown error")
            console.print(f"  Line {line_num}: [yellow]{msg}[/yellow]")
            if line_content:
                console.print(f"    Content: {line_content}")
        console.print()
    
    for sm in parse_result.submodules:
        console.print(f"[cyan]Submodule: {sm.name}[/cyan]")
        console.print(f"  Path: {sm.path}")
        console.print(f"  URL: {sm.url}")
        console.print(f"  Branch: {sm.branch or 'default'}")
        
        if sm.errors:
            console.print(f"  [red]Errors: {len(sm.errors)}[/red]")
            for error in sm.errors:
                line_num = error.get("line_number", "?")
                msg = error.get("message", "Unknown error")
                console.print(f"    Line {line_num}: {msg}")
        
        if sm.raw_lines:
            console.print(f"  Raw lines:")
            for line_info in sm.raw_lines:
                console.print(f"    Line {line_info.get('line_number', '?')}: {line_info.get('content', '')}")
        
        console.print()


@main.command(name="self-test")
@click.option("--create-fixtures", is_flag=True, help="Create test fixtures")
@click.option("--run-tests", is_flag=True, help="Run actual unit tests")
def selftest(create_fixtures, run_tests):
    """Run self-test to verify installation"""
    console.print("[cyan]Running self-test...[/cyan]")
    console.print()
    
    all_passed = True
    
    checks = [
        ("Python version", lambda: sys.version_info >= (3, 8)),
        ("GitMetadataReader import", lambda: GitMetadataReader is not None),
        ("DriftDetector import", lambda: DriftDetector is not None),
        ("ReportGenerator import", lambda: ReportGenerator is not None),
        ("GitPython available", lambda: __import__("git") is not None),
        ("Click available", lambda: __import__("click") is not None),
        ("Rich available", lambda: __import__("rich") is not None),
    ]
    
    for name, check in checks:
        try:
            passed = check()
            if passed:
                console.print(f"[green]✓ {name}[/green]")
            else:
                console.print(f"[red]✗ {name}[/red]")
                all_passed = False
        except Exception as e:
            console.print(f"[red]✗ {name}: {str(e)}[/red]")
            all_passed = False
    
    console.print()
    
    if create_fixtures:
        console.print("[cyan]Creating test fixtures...[/cyan]")
        test_dir = Path("./test_fixtures")
        test_dir.mkdir(exist_ok=True)
        
        (test_dir / ".gitmodules").write_text("""[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
    branch = main
[submodule "module2"]
    path = lib/module2
    url = https://github.com/example/module2.git
malformed_line_here
[submodule "empty-path"]
    url = https://github.com/example/empty.git
""")
        console.print(f"[green]Created test fixtures in {test_dir}[/green]")
        console.print()
    
    if run_tests:
        console.print("[cyan]Running unit tests...[/cyan]")
        import pytest
        result = pytest.main(["-xvs", "src/submodule_drift/test.py"])
        if result != 0:
            all_passed = False
        console.print()
    
    if all_passed:
        console.print("[green]All checks passed! The tool is ready to use.[/green]")
    else:
        console.print("[red]Some checks failed. Please check your installation.[/red]")
        sys.exit(1)


@main.command()
@click.argument("repo_path", type=click.Path(exists=True), default=".")
@click.option("--output", "-o", type=click.Path(), help="Output directory")
def export(repo_path, output):
    """Export all report formats"""
    output_dir = Path(output) if output else Path("./submodule_reports")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    reader = GitMetadataReader(repo_path)
    submodules = reader.get_all_submodule_info()
    
    detector = DriftDetector(repo_path)
    results = detector.detect_drift(submodules)
    
    reporter = ReportGenerator()
    
    json_path = output_dir / "drift_report.json"
    md_path = output_dir / "drift_report.md"
    email_path = output_dir / "team_email.txt"
    
    reporter.generate_json(results, str(json_path))
    reporter.generate_markdown(results, str(md_path))
    email_path.write_text(reporter.generate_team_email_content(results), encoding="utf-8")
    
    console.print(f"[green]All reports exported to: {output_dir}[/green]")
    console.print(f"  - {json_path.name}")
    console.print(f"  - {md_path.name}")
    console.print(f"  - {email_path.name}")


if __name__ == "__main__":
    main()
'''
    with open("src/submodule_drift/cli.py", "w") as f:
        f.write(content)
    print("Created cli.py")


def create_test():
    content = '''from __future__ import annotations

import os
import tempfile
from pathlib import Path
from unittest import TestCase

from .git_metadata import GitMetadataReader, SubmoduleInfo, ParseError
from .drift_detector import DriftDetector, DriftResult
from .report_generator import ReportGenerator


class TestSubmoduleInfo(TestCase):
    def test_submodule_info_creation(self):
        sm = SubmoduleInfo(
            name="test-module",
            path="lib/test",
            url="https://github.com/test/test.git",
            branch="main"
        )
        self.assertEqual(sm.name, "test-module")
        self.assertEqual(sm.path, "lib/test")
        self.assertEqual(sm.url, "https://github.com/test/test.git")
        self.assertEqual(sm.branch, "main")

    def test_submodule_info_defaults(self):
        sm = SubmoduleInfo(name="test", path="", url="")
        self.assertIsNone(sm.branch)
        self.assertIsNone(sm.expected_commit)
        self.assertIsNone(sm.actual_commit)
        self.assertEqual(sm.errors, [])
        self.assertEqual(sm.raw_lines, [])


class TestGitMetadataReader(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.repo_path = Path(self.temp_dir)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_parse_no_gitmodules_file(self):
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        self.assertEqual(len(result.submodules), 0)
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.errors[0]["type"], "file_missing")

    def test_parse_empty_gitmodules(self):
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text("")
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        self.assertEqual(len(result.submodules), 0)

    def test_parse_valid_submodule(self):
        gitmodules_content = """[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
    branch = main
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        self.assertEqual(len(result.submodules), 1)
        sm = result.submodules[0]
        self.assertEqual(sm.name, "module1")
        self.assertEqual(sm.path, "lib/module1")
        self.assertEqual(sm.url, "https://github.com/example/module1.git")
        self.assertEqual(sm.branch, "main")
        self.assertEqual(len(sm.errors), 0)

    def test_parse_multiple_submodules(self):
        gitmodules_content = """[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
[submodule "module2"]
    path = lib/module2
    url = https://github.com/example/module2.git
    branch = develop
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        self.assertEqual(len(result.submodules), 2)
        names = {sm.name for sm in result.submodules}
        self.assertEqual(names, {"module1", "module2"})

    def test_parse_orphan_line_outside_section(self):
        gitmodules_content = """orphan_property = value
[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.errors[0]["type"], "orphan_line")
        self.assertEqual(result.errors[0]["line_number"], 1)

    def test_parse_missing_path(self):
        gitmodules_content = """[submodule "module1"]
    url = https://github.com/example/module1.git
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        sm = result.submodules[0]
        self.assertEqual(len(sm.errors), 1)
        self.assertEqual(sm.errors[0]["type"], "missing_path")

    def test_parse_missing_url(self):
        gitmodules_content = """[submodule "module1"]
    path = lib/module1
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        sm = result.submodules[0]
        self.assertEqual(len(sm.errors), 1)
        self.assertEqual(sm.errors[0]["type"], "missing_url")

    def test_parse_unknown_field(self):
        gitmodules_content = """[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
    unknown_field = value
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        sm = result.submodules[0]
        self.assertEqual(len(sm.errors), 1)
        self.assertEqual(sm.errors[0]["type"], "unknown_field")
        self.assertEqual(sm.errors[0]["line_number"], 4)

    def test_parse_preserves_raw_lines(self):
        gitmodules_content = """[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        sm = result.submodules[0]
        self.assertGreater(len(sm.raw_lines), 0)
        line_numbers = {line["line_number"] for line in sm.raw_lines}
        self.assertEqual(line_numbers, {1, 2, 3})

    def test_parse_with_comments_and_empty_lines(self):
        gitmodules_content = """# This is a comment
[submodule "module1"]
    path = lib/module1
    # inline comment
    url = https://github.com/example/module1.git

"""
        gitmodules_path = self.repo_path / ".gitmodules"
        gitmodules_path.write_text(gitmodules_content)
        
        reader = GitMetadataReader(self.repo_path)
        result = reader.parse_gitmodules()
        
        self.assertEqual(len(result.submodules), 1)
        sm = result.submodules[0]
        self.assertEqual(sm.path, "lib/module1")
        self.assertEqual(sm.url, "https://github.com/example/module1.git")


class TestDriftDetector(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.repo_path = Path(self.temp_dir)
        self.detector = DriftDetector(self.repo_path)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_detect_drift_empty_list(self):
        results = self.detector.detect_drift([])
        self.assertEqual(len(results), 0)

    def test_detect_drift_missing_submodule(self):
        sm = SubmoduleInfo(
            name="missing-module",
            path="nonexistent/path",
            url="https://github.com/test/test.git"
        )
        
        results = self.detector.detect_drift([sm])
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0].is_missing)
        self.assertTrue(results[0].has_drift)

    def test_detect_result_preserves_errors(self):
        sm = SubmoduleInfo(name="test", path="", url="")
        sm.errors.append({
            "type": "test_error",
            "message": "Test error message",
            "line_number": 5
        })
        
        results = self.detector.detect_drift([sm])
        self.assertGreater(len(results[0].errors), 0)
        error_types = {e["type"] for e in results[0].errors}
        self.assertIn("test_error", error_types)

    def test_detect_result_preserves_raw_context(self):
        sm = SubmoduleInfo(name="test", path="", url="")
        sm.raw_lines.append({
            "line_number": 1,
            "content": '[submodule "test"]',
            "field": "section"
        })
        
        results = self.detector.detect_drift([sm])
        self.assertIn("raw_lines", results[0].raw_context)
        self.assertGreater(len(results[0].raw_context["raw_lines"]), 0)


class TestReportGenerator(TestCase):
    def setUp(self):
        self.generator = ReportGenerator()

    def _create_test_result(self, name="test-module", has_drift=False, is_missing=False):
        sm = SubmoduleInfo(
            name=name,
            path=f"lib/{name}",
            url=f"https://github.com/test/{name}.git",
            branch="main",
            expected_commit="abc123def4567890",
            actual_commit="abc123def4567890" if not has_drift else "def789abc0123456"
        )
        return DriftResult(
            submodule=sm,
            has_drift=has_drift,
            is_missing=is_missing,
            commits_ahead=1 if has_drift else 0,
            commits_behind=2 if has_drift else 0,
            drift_type="diverged" if has_drift else None
        )

    def test_generate_json(self):
        results = [self._create_test_result()]
        json_output = self.generator.generate_json(results)
        
        self.assertIsInstance(json_output, str)
        self.assertIn("generated_at", json_output)
        self.assertIn("results", json_output)
        self.assertIn("test-module", json_output)

    def test_generate_json_with_errors(self):
        result = self._create_test_result()
        result.errors.append({
            "type": "test_error",
            "message": "Test error",
            "line_number": 5
        })
        
        json_output = self.generator.generate_json([result])
        self.assertIn("errors", json_output)
        self.assertIn("test_error", json_output)

    def test_generate_markdown(self):
        results = [self._create_test_result()]
        md_output = self.generator.generate_markdown(results)
        
        self.assertIsInstance(md_output, str)
        self.assertIn("# Git Submodule Drift Detection Report", md_output)
        self.assertIn("## Summary", md_output)
        self.assertIn("## Detailed Results", md_output)

    def test_generate_markdown_with_errors(self):
        result = self._create_test_result()
        result.errors.append({
            "type": "parse_error",
            "message": "Test parse error",
            "line_number": 10
        })
        
        md_output = self.generator.generate_markdown([result])
        self.assertIn("## Errors Found", md_output)
        self.assertIn("parse_error", md_output)

    def test_build_summary(self):
        results = [
            self._create_test_result("ok1"),
            self._create_test_result("drift1", has_drift=True),
            self._create_test_result("missing1", is_missing=True)
        ]
        results[1].errors.append({"type": "error1", "message": "test"})
        
        summary = self.generator._build_summary(results)
        self.assertEqual(summary["total"], 3)
        self.assertEqual(summary["ok"], 1)
        self.assertEqual(summary["drifted"], 1)
        self.assertEqual(summary["missing"], 1)
        self.assertEqual(summary["with_errors"], 1)

    def test_generate_team_email_content(self):
        results = [
            self._create_test_result("ok1"),
            self._create_test_result("drift1", has_drift=True),
            self._create_test_result("missing1", is_missing=True)
        ]
        
        email = self.generator.generate_team_email_content(results)
        self.assertIn("Hi Team", email)
        self.assertIn("Submodules with Commit Drift", email)
        self.assertIn("Missing Submodules", email)
        self.assertIn("Action Items", email)


if __name__ == "__main__":
    import unittest
    unittest.main()
'''
    with open("src/submodule_drift/test.py", "w") as f:
        f.write(content)
    print("Created test.py")


if __name__ == "__main__":
    create_git_metadata()
    create_drift_detector()
    create_report_generator()
    create_cli()
    create_test()
    print("\nAll files created successfully!")
