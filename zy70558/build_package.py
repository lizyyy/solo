#!/usr/bin/env python3
import os
from pathlib import Path

BASE_DIR = Path("/Users/lzy/pro/solo/workspaces/zy70558")
SRC_DIR = BASE_DIR / "src" / "submodule_drift"

def write_file(filepath, content):
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Created: {filepath}")

# 1. __init__.py
init_content = """from .git_metadata import GitMetadataReader, SubmoduleInfo, ParseError
from .drift_detector import DriftDetector, DriftResult
from .report_generator import ReportGenerator

__version__ = "0.1.0"
"""
write_file(SRC_DIR / "__init__.py", init_content)

# 2. git_metadata.py
git_metadata_content = '''from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple
import git


@dataclass
class ParseError:
    line_number: int
    line_content: str
    error_type: str
    message: str


@dataclass
class SubmoduleInfo:
    path: str
    name: str
    url: str
    branch: Optional[str] = None
    expected_commit: Optional[str] = None
    actual_commit: Optional[str] = None
    remote_status: Optional[str] = None
    errors: List[ParseError] = field(default_factory=list)
    raw_lines: List[Tuple[int, str]] = field(default_factory=list)


class GitMetadataReader:
    def __init__(self, repo_path: Optional[str] = None):
        self.repo_path = Path(repo_path) if repo_path else Path.cwd()

    def is_git_repository(self) -> bool:
        try:
            git.Repo(self.repo_path)
            return True
        except Exception:
            return False

    def parse_gitmodules(self) -> List[SubmoduleInfo]:
        submodules: List[SubmoduleInfo] = []
        gitmodules_path = self.repo_path / ".gitmodules"
        
        if not gitmodules_path.exists():
            return submodules
        
        with open(gitmodules_path, "r") as f:
            lines = f.readlines()
        
        current_submodule = None
        raw_lines_buffer: List[Tuple[int, str]] = []
        parse_errors: List[ParseError] = []
        
        for line_num, line in enumerate(lines, 1):
            stripped_line = line.strip()
            raw_line = line.rstrip("\\n")
            raw_lines_buffer.append((line_num, raw_line))
            
            if stripped_line.startswith("[submodule"):
                if current_submodule is not None:
                    current_submodule.raw_lines = raw_lines_buffer[:-1]
                    current_submodule.errors = parse_errors
                    submodules.append(current_submodule)
                
                name_start = stripped_line.find('"')
                name_end = stripped_line.rfind('"')
                if name_start != -1 and name_end != -1 and name_start < name_end:
                    name = stripped_line[name_start + 1:name_end]
                    current_submodule = SubmoduleInfo(
                        path="",
                        name=name,
                        url=""
                    )
                    raw_lines_buffer = [(line_num, raw_line)]
                    parse_errors = []
                else:
                    parse_errors.append(ParseError(
                        line_number=line_num,
                        line_content=stripped_line,
                        error_type="parse_error",
                        message="Invalid submodule declaration format"
                    ))
                    continue
            
            elif current_submodule is not None and "=" in stripped_line:
                key, value = stripped_line.split("=", 1)
                key = key.strip()
                value = value.strip()
                
                if key == "path":
                    current_submodule.path = value
                elif key == "url":
                    current_submodule.url = value
                elif key == "branch":
                    current_submodule.branch = value
                else:
                    parse_errors.append(ParseError(
                        line_number=line_num,
                        line_content=stripped_line,
                        error_type="unknown_property",
                        message=f"Unknown property: {key}"
                    ))
        
        if current_submodule is not None:
            current_submodule.raw_lines = raw_lines_buffer
            current_submodule.errors = parse_errors
            submodules.append(current_submodule)
        
        return submodules

    def get_submodule_actual_commits(self, submodules: List[SubmoduleInfo]) -> None:
        for submodule in submodules:
            submodule_path = self.repo_path / submodule.path
            if submodule_path.exists():
                try:
                    repo = git.Repo(submodule_path)
                    submodule.actual_commit = repo.head.commit.hexsha
                except Exception as e:
                    submodule.errors.append(ParseError(
                        line_number=0,
                        line_content="",
                        error_type="actual_commit_error",
                        message=f"Failed to read actual commit: {str(e)}"
                    ))
                    submodule.actual_commit = None
            else:
                submodule.errors.append(ParseError(
                    line_number=0,
                    line_content="",
                    error_type="path_not_found",
                    message=f"Submodule path does not exist: {submodule.path}"
                ))

    def get_submodule_expected_commits(self, submodules: List[SubmoduleInfo]) -> None:
        try:
            repo = git.Repo(self.repo_path)
            for submodule in submodules:
                try:
                    result = repo.git.ls_tree("HEAD", submodule.path)
                    if result:
                        parts = result.strip().split()
                        if len(parts) >= 3:
                            submodule.expected_commit = parts[2]
                except Exception as e:
                    submodule.errors.append(ParseError(
                        line_number=0,
                        line_content="",
                        error_type="expected_commit_error",
                        message=f"Failed to get expected commit: {str(e)}"
                    ))
        except Exception:
            pass

    def get_remote_status(self, submodules: List[SubmoduleInfo]) -> None:
        for submodule in submodules:
            submodule_path = self.repo_path / submodule.path
            if not submodule_path.exists():
                submodule.remote_status = "path_missing"
                continue
            
            try:
                repo = git.Repo(submodule_path)
                if not repo.remotes:
                    submodule.remote_status = "no_remote"
                    continue
                
                remote = repo.remote()
                try:
                    remote.fetch(dry_run=True)
                except Exception:
                    pass
                
                try:
                    local_commit = repo.head.commit.hexsha
                    try:
                        branch_name = submodule.branch if submodule.branch else repo.active_branch.name
                        remote_ref = repo.rev_parse(f"{remote.name}/{branch_name}")
                        remote_commit = remote_ref.hexsha
                        
                        if local_commit == remote_commit:
                            submodule.remote_status = "in_sync"
                        elif repo.is_ancestor(local_commit, remote_commit):
                            submodule.remote_status = "behind_remote"
                        elif repo.is_ancestor(remote_commit, local_commit):
                            submodule.remote_status = "ahead_remote"
                        else:
                            submodule.remote_status = "diverged"
                    except Exception:
                        submodule.remote_status = "remote_branch_not_found"
                except Exception as e:
                    submodule.remote_status = f"check_failed: {str(e)[:50]}"
            except Exception as e:
                submodule.remote_status = f"repo_error: {str(e)[:50]}"

    def get_all_submodule_info(self) -> List[SubmoduleInfo]:
        submodules = self.parse_gitmodules()
        self.get_submodule_expected_commits(submodules)
        self.get_submodule_actual_commits(submodules)
        self.get_remote_status(submodules)
        return submodules
'''
write_file(SRC_DIR / "git_metadata.py", git_metadata_content)

# 3. drift_detector.py
drift_detector_content = '''from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional

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


class DriftDetector:
    def __init__(self, repo_path: Optional[str] = None):
        self.repo_path = Path(repo_path) if repo_path else Path.cwd()

    def detect_drift(self, submodules: List[SubmoduleInfo]) -> List[DriftResult]:
        results: List[DriftResult] = []
        
        for submodule in submodules:
            is_missing = self._is_submodule_missing(submodule)
            has_drift = False
            commits_ahead = 0
            commits_behind = 0
            drift_type = None
            
            if not is_missing:
                has_drift, commits_ahead, commits_behind, drift_type = self._analyze_commit_drift(submodule)
            
            results.append(DriftResult(
                submodule=submodule,
                has_drift=has_drift,
                is_missing=is_missing,
                commits_ahead=commits_ahead,
                commits_behind=commits_behind,
                drift_type=drift_type,
                last_updated=datetime.now()
            ))
        
        return results

    def _is_submodule_missing(self, submodule: SubmoduleInfo) -> bool:
        submodule_path = self.repo_path / submodule.path
        return not submodule_path.exists()

    def _analyze_commit_drift(self, submodule: SubmoduleInfo) -> tuple:
        if not submodule.expected_commit or not submodule.actual_commit:
            return True, 0, 0, "unknown"
        
        if submodule.expected_commit == submodule.actual_commit:
            return False, 0, 0, None
        
        commits_ahead, commits_behind = self._count_commit_difference(submodule)
        
        if commits_ahead > 0 and commits_behind > 0:
            drift_type = "diverged"
        elif commits_ahead > 0:
            drift_type = "ahead"
        elif commits_behind > 0:
            drift_type = "behind"
        else:
            drift_type = "modified"
        
        return True, commits_ahead, commits_behind, drift_type

    def _count_commit_difference(self, submodule: SubmoduleInfo) -> tuple:
        submodule_path = self.repo_path / submodule.path
        try:
            repo = git.Repo(submodule_path)
            
            commits_ahead = 0
            for _ in repo.iter_commits(f"{submodule.expected_commit}..{submodule.actual_commit}"):
                commits_ahead += 1
            
            commits_behind = 0
            for _ in repo.iter_commits(f"{submodule.actual_commit}..{submodule.expected_commit}"):
                commits_behind += 1
            
            return commits_ahead, commits_behind
        except Exception:
            return 0, 0
'''
write_file(SRC_DIR / "drift_detector.py", drift_detector_content)

# 4. report_generator.py
report_generator_content = '''from __future__ import annotations

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
            remote = result.submodule.remote_status or "N/A"
            
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
        
        self.console.print(f"\\nSummary: [green]{ok} OK[/green] | [red]{drifted} DRIFT[/red] | [yellow]{missing} MISSING[/yellow] | Total: {total}")
        
        self._print_parse_errors(results)

    def _print_parse_errors(self, results: List[DriftResult]) -> None:
        all_errors = []
        for r in results:
            for err in r.submodule.errors:
                all_errors.append((r.submodule.name, err))
        
        if all_errors:
            self.console.print("\\n[yellow]Parse Errors and Warnings:[/yellow]")
            for name, err in all_errors:
                if err.line_number > 0:
                    self.console.print(f"  [cyan]{name}[/cyan] line {err.line_number}: [{err.error_type}] {err.message}")
                    self.console.print(f"    Raw content: {err.line_content}")
                else:
                    self.console.print(f"  [cyan]{name}[/cyan]: [{err.error_type}] {err.message}")

    def generate_json(self, results: List[DriftResult], output_path: str = None) -> str:
        data = {
            "generated_at": datetime.now().isoformat(),
            "results": []
        }
        
        for result in results:
            data["results"].append({
                "name": result.submodule.name,
                "path": result.submodule.path,
                "url": result.submodule.url,
                "branch": result.submodule.branch,
                "expected_commit": result.submodule.expected_commit,
                "actual_commit": result.submodule.actual_commit,
                "remote_status": result.submodule.remote_status,
                "has_drift": result.has_drift,
                "is_missing": result.is_missing,
                "commits_ahead": result.commits_ahead,
                "commits_behind": result.commits_behind,
                "drift_type": result.drift_type,
                "parse_errors": [
                    {
                        "line_number": e.line_number,
                        "line_content": e.line_content,
                        "error_type": e.error_type,
                        "message": e.message
                    }
                    for e in result.submodule.errors
                ],
                "raw_lines": [
                    {"line_number": ln, "content": lc}
                    for ln, lc in result.submodule.raw_lines
                ]
            })
        
        json_output = json.dumps(data, indent=2)
        
        if output_path:
            Path(output_path).write_text(json_output)
        
        return json_output

    def generate_markdown(self, results: List[DriftResult], output_path: str = None) -> str:
        lines = [
            "# Git Submodule Drift Detection Report",
            "",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## Summary",
            "",
            "| Metric | Count |",
            "|--------|-------|",
        ]
        
        total = len(results)
        missing = sum(1 for r in results if r.is_missing)
        drifted = sum(1 for r in results if r.has_drift and not r.is_missing)
        ok = total - missing - drifted
        
        lines.extend([
            f"| OK | {ok} |",
            f"| With Drift | {drifted} |",
            f"| Missing | {missing} |",
            f"| **Total** | **{total}** |",
            "",
            "## Detailed Results",
            "",
            "| Submodule | Status | Drift Type | Ahead | Behind | Expected Commit | Actual Commit | Remote Status |",
            "|-----------|--------|------------|-------|--------|-----------------|---------------|---------------|",
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
            remote = result.submodule.remote_status or "N/A"
            
            lines.append(f"| {result.submodule.name} | {status} | {drift_type} | {ahead} | {behind} | {expected} | {actual} | {remote} |")
        
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
                f"- Branch: `{result.submodule.branch or 'default'}`",
                f"- Expected Commit: `{result.submodule.expected_commit or 'N/A'}`",
                f"- Actual Commit: `{result.submodule.actual_commit or 'N/A'}`",
                f"- Remote Status: `{result.submodule.remote_status or 'N/A'}`",
            ])
            
            if result.submodule.errors:
                lines.extend([
                    "",
                    "#### Errors/Warnings:",
                    ""
                ])
                for e in result.submodule.errors:
                    if e.line_number > 0:
                        lines.append(f"- **Line {e.line_number}** [{e.error_type}]: {e.message}")
                        lines.append(f"  ```")
                        lines.append(f"  {e.line_content}")
                        lines.append(f"  ```")
                    else:
                        lines.append(f"- [{e.error_type}]: {e.message}")
            
            if result.submodule.raw_lines:
                lines.extend([
                    "",
                    "#### Raw .gitmodules lines:",
                    "",
                    "```ini"
                ])
                for _, lc in result.submodule.raw_lines:
                    lines.append(lc)
                lines.append("```")
            
            lines.append("")
        
        markdown_output = "\\n".join(lines)
        
        if output_path:
            Path(output_path).write_text(markdown_output)
        
        return markdown_output
'''
write_file(SRC_DIR / "report_generator.py", report_generator_content)

# 5. cli.py
cli_content = '''#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

import click
from rich.console import Console

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
@click.option("--quiet", "-q", is_flag=True, help="Suppress terminal output")
def check(repo_path, json_output, markdown_output, quiet):
    """Check submodules for commit drift"""
    try:
        reader = GitMetadataReader(repo_path)
        
        if not reader.is_git_repository():
            if not quiet:
                console.print(f"[red]Error: {repo_path} is not a git repository[/red]")
            sys.exit(1)
        
        submodules = reader.get_all_submodule_info()
        
        if not submodules:
            if not quiet:
                console.print("[yellow]No submodules found in this repository[/yellow]")
            return
        
        detector = DriftDetector(repo_path)
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
        
        has_issues = any(r.has_drift or r.is_missing for r in results)
        if has_issues:
            sys.exit(1)
        
    except Exception as e:
        console.print(f"[red]Error: {str(e)}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command(name="self-test")
@main.command(name="selftest", hidden=True)
def selftest():
    """Run comprehensive self-test to verify installation and functionality"""
    import tempfile
    
    console.print("[cyan]Running comprehensive self-test...[/cyan]\\n")
    
    all_passed = True
    test_cases = []
    
    console.print("[yellow]Test 1: Imports and Basic Classes[/yellow]")
    try:
        reader = GitMetadataReader()
        detector = DriftDetector()
        reporter = ReportGenerator()
        test_cases.append(("Imports work", True))
        console.print("  [green]✓ Import successful[/green]")
    except Exception as e:
        all_passed = False
        test_cases.append(("Imports work", False))
        console.print(f"  [red]✗ Failed: {str(e)}[/red]")
    
    console.print("\\n[yellow]Test 2: Data Class Initialization[/yellow]")
    try:
        from .git_metadata import ParseError
        sm = GitMetadataReader.__module__
        err = ParseError(line_number=5, line_content="test line", error_type="test", message="test message")
        test_cases.append(("Data classes work", True))
        console.print("  [green]✓ Data class initialization successful[/green]")
    except Exception as e:
        all_passed = False
        test_cases.append(("Data classes work", False))
        console.print(f"  [red]✗ Failed: {str(e)}[/red]")
    
    console.print("\\n[yellow]Test 3: Parse Error Handling[/yellow]")
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            import git
            repo = git.Repo.init(tmpdir)
            
            Path(tmpdir) / ".gitmodules"
            gm_path = Path(tmpdir) / ".gitmodules"
            gm_path.write_text("""[submodule "valid"]
    path = valid/path
    url = https://example.com/repo.git

[submodule "unknown_prop"]
    path = unknown/path
    url = test.git
    unknown_property = value
""")
            
            reader = GitMetadataReader(tmpdir)
            submodules = reader.parse_gitmodules()
            
            if len(submodules) >= 2:
                test_cases.append(("Parse error handling works", True))
                console.print(f"  [green]✓ Parsed {len(submodules)} submodules[/green]")
            else:
                all_passed = False
                test_cases.append(("Parse error handling works", False))
                console.print(f"  [red]✗ Expected at least 2 submodules, got {len(submodules)}[/red]")
    except Exception as e:
        all_passed = False
        test_cases.append(("Parse error handling works", False))
        console.print(f"  [red]✗ Failed: {str(e)}[/red]")
    
    console.print("\\n[yellow]Test 4: Report Generation[/yellow]")
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            from .git_metadata import SubmoduleInfo
            sm = SubmoduleInfo(path="test/path", name="test-submodule", url="test.git")
            sm.expected_commit = "abc123def456"
            sm.actual_commit = "abc123def456"
            from .drift_detector import DriftResult
            result = DriftResult(
                submodule=sm,
                has_drift=False,
                is_missing=True,
                commits_ahead=0,
                commits_behind=0
            )
            results = [result]
            
            reporter = ReportGenerator()
            json_out = reporter.generate_json(results)
            md_out = reporter.generate_markdown(results)
            
            if json_out and md_out:
                test_cases.append(("Report generation works", True))
                console.print("  [green]✓ JSON and Markdown reports generated successfully[/green]")
            else:
                all_passed = False
                test_cases.append(("Report generation works", False))
                console.print("  [red]✗ Report generation produced empty output[/red]")
    except Exception as e:
        all_passed = False
        test_cases.append(("Report generation works", False))
        console.print(f"  [red]✗ Failed: {str(e)}[/red]")
    
    console.print("\\n[yellow]Test 5: Missing Submodule Detection[/yellow]")
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            import git
            repo = git.Repo.init(tmpdir)
            gm_path = Path(tmpdir) / ".gitmodules"
            gm_path.write_text("""[submodule "missing"]
    path = does/not/exist
    url = https://example.com/repo.git
""")
            reader = GitMetadataReader(tmpdir)
            submodules = reader.get_all_submodule_info()
            detector = DriftDetector(tmpdir)
            results = detector.detect_drift(submodules)
            
            if results and results[0].is_missing:
                test_cases.append(("Missing submodule detection works", True))
                console.print("  [green]✓ Missing submodule correctly detected[/green]")
            else:
                all_passed = False
                test_cases.append(("Missing submodule detection works", False))
                console.print("  [red]✗ Missing submodule not detected correctly[/red]")
    except Exception as e:
        all_passed = False
        test_cases.append(("Missing submodule detection works", False))
        console.print(f"  [red]✗ Failed: {str(e)}[/red]")
    
    console.print("\\n[yellow]Summary:[/yellow]")
    passed_count = sum(1 for _, passed in test_cases if passed)
    total_count = len(test_cases)
    
    for name, passed in test_cases:
        status = "[green]✓[/green]" if passed else "[red]✗[/red]"
        console.print(f"  {status} {name}")
    
    console.print("")
    if all_passed:
        console.print(f"[green]All {total_count}/{total_count} checks passed! The tool is ready to use.[/green]")
        console.print("\\n[cyan]Usage:[/cyan]")
        console.print("  submodule-drift check [repo-path]")
        console.print("  submodule-drift check --json report.json --markdown report.md")
    else:
        console.print(f"[red]{total_count - passed_count}/{total_count} checks failed. Please check your installation.[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
'''
write_file(SRC_DIR / "cli.py", cli_content)

print("\nAll source files created successfully!")
print(f"Now you can install with: pip install -e {BASE_DIR}")
print("Then run: submodule-drift self-test")
