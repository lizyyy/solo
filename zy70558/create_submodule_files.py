import os

base_path = os.path.join(os.path.dirname(__file__), 'src', 'submodule_drift')
os.makedirs(base_path, exist_ok=True)

# __init__.py
init_content = '''from .git_metadata import GitMetadataReader
from .drift_detector import DriftDetector
from .report_generator import ReportGenerator

__version__ = "0.1.0"
'''

with open(os.path.join(base_path, '__init__.py'), 'w') as f:
    f.write(init_content)
print('Created __init__.py')

# git_metadata.py
git_metadata_content = '''from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import git


@dataclass
class SubmoduleInfo:
    name: str
    path: str
    url: str
    branch: Optional[str] = None
    expected_commit: Optional[str] = None
    actual_commit: Optional[str] = None
    remote_url: Optional[str] = None


class GitMetadataReader:
    def __init__(self, repo_path: Optional[str] = None):
        self.repo_path = Path(repo_path) if repo_path else Path.cwd()
        self.repo = git.Repo(self.repo_path)

    def parse_gitmodules(self) -> List[SubmoduleInfo]:
        gitmodules_path = self.repo_path / ".gitmodules"
        if not gitmodules_path.exists():
            return []

        submodules: List[SubmoduleInfo] = []
        config = git.GitConfigParser(str(gitmodules_path))
        
        for section in config.sections():
            if section.startswith('submodule "'):
                name = section.split('"')[1]
                path = config.get_value(section, "path")
                url = config.get_value(section, "url")
                branch = config.get_value(section, "branch", None)
                
                submodules.append(SubmoduleInfo(
                    name=name,
                    path=path,
                    url=url,
                    branch=branch
                ))
        
        return submodules

    def get_expected_commits(self, submodules: List[SubmoduleInfo]) -> None:
        for submodule in submodules:
            try:
                submodule_path = self.repo_path / submodule.path
                rel_path = os.path.relpath(submodule_path, self.repo_path)
                
                for item in self.repo.tree().traverse():
                    if item.path == rel_path and item.type == "commit":
                        submodule.expected_commit = item.hexsha
                        break
            except Exception:
                submodule.expected_commit = None

    def get_actual_commits(self, submodules: List[SubmoduleInfo]) -> None:
        for submodule in submodules:
            submodule_path = self.repo_path / submodule.path
            if not submodule_path.exists():
                submodule.actual_commit = None
                continue
            
            try:
                submodule_repo = git.Repo(submodule_path)
                submodule.actual_commit = submodule_repo.head.commit.hexsha
                submodule.remote_url = self._get_remote_url(submodule_repo)
            except Exception:
                submodule.actual_commit = None

    def _get_remote_url(self, repo: git.Repo) -> Optional[str]:
        try:
            remote = repo.remote()
            return remote.url if remote else None
        except Exception:
            return None

    def get_all_submodule_info(self) -> List[SubmoduleInfo]:
        submodules = self.parse_gitmodules()
        self.get_expected_commits(submodules)
        self.get_actual_commits(submodules)
        return submodules
'''

with open(os.path.join(base_path, 'git_metadata.py'), 'w') as f:
    f.write(git_metadata_content)
print('Created git_metadata.py')

# drift_detector.py
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
        if not submodule_path.exists():
            return True
        try:
            git.Repo(submodule_path)
            return False
        except Exception:
            return True

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
            for commit in repo.iter_commits(f"{submodule.expected_commit}..{submodule.actual_commit}"):
                commits_ahead += 1
            
            commits_behind = 0
            for commit in repo.iter_commits(f"{submodule.actual_commit}..{submodule.expected_commit}"):
                commits_behind += 1
            
            return commits_ahead, commits_behind
        except Exception:
            return 0, 0

    def analyze_remote_status(self, submodules: List[SubmoduleInfo]) -> dict:
        remote_status = {}
        for submodule in submodules:
            submodule_path = self.repo_path / submodule.path
            if not submodule_path.exists():
                remote_status[submodule.name] = "missing"
                continue
            
            try:
                repo = git.Repo(submodule_path)
                if not repo.remotes:
                    remote_status[submodule.name] = "no_remote"
                    continue
                
                remote = repo.remote()
                try:
                    remote.fetch()
                    local_commit = repo.head.commit.hexsha
                    remote_commit = repo.rev_parse(f"{remote.name}/{repo.active_branch.name}")
                    
                    if local_commit == remote_commit.hexsha:
                        remote_status[submodule.name] = "in_sync"
                    else:
                        remote_status[submodule.name] = "out_of_sync"
                except Exception:
                    remote_status[submodule.name] = "remote_error"
            except Exception:
                remote_status[submodule.name] = "error"
        
        return remote_status
'''

with open(os.path.join(base_path, 'drift_detector.py'), 'w') as f:
    f.write(drift_detector_content)
print('Created drift_detector.py')

# report_generator.py
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
        table.add_column("Expected Commit", style="blue")
        table.add_column("Actual Commit", style="blue")
        
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
            
            table.add_row(
                result.submodule.name,
                status,
                drift_type,
                ahead,
                behind,
                expected,
                actual
            )
        
        self.console.print(table)
        
        total = len(results)
        missing = sum(1 for r in results if r.is_missing)
        drifted = sum(1 for r in results if r.has_drift and not r.is_missing)
        ok = total - missing - drifted
        
        self.console.print(f"\\nSummary: [green]{ok} OK[/green] | [red]{drifted} DRIFT[/red] | [yellow]{missing} MISSING[/yellow] | Total: {total}")

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
                "has_drift": result.has_drift,
                "is_missing": result.is_missing,
                "commits_ahead": result.commits_ahead,
                "commits_behind": result.commits_behind,
                "drift_type": result.drift_type
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
            "| Submodule | Status | Drift Type | Ahead | Behind | Expected Commit | Actual Commit |",
            "|-----------|--------|------------|-------|--------|-----------------|---------------|",
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
            
            lines.append(f"| {result.submodule.name} | {status} | {drift_type} | {ahead} | {behind} | {expected} | {actual} |")
        
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
                ""
            ])
        
        markdown_output = "\\n".join(lines)
        
        if output_path:
            Path(output_path).write_text(markdown_output)
        
        return markdown_output
'''

with open(os.path.join(base_path, 'report_generator.py'), 'w') as f:
    f.write(report_generator_content)
print('Created report_generator.py')

# cli.py
cli_content = '''from __future__ import annotations

import os
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
        if not quiet:
            console.print(f"[cyan]Analyzing repository: {repo_path}[/cyan]")
        
        reader = GitMetadataReader(repo_path)
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
        sys.exit(1)


@main.command(name="self-test")
@main.command(name="selftest", hidden=True)
def selftest():
    """Run self-test to verify installation"""
    console.print("[cyan]Running self-test...[/cyan]")
    
    checks = [
        ("Python version", lambda: sys.version_info >= (3, 8)),
        ("GitMetadataReader import", lambda: GitMetadataReader is not None),
        ("DriftDetector import", lambda: DriftDetector is not None),
        ("ReportGenerator import", lambda: ReportGenerator is not None),
    ]
    
    all_passed = True
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
    
    if all_passed:
        console.print("[green]\\nAll checks passed! The tool is ready to use.[/green]")
    else:
        console.print("[red]\\nSome checks failed. Please check your installation.[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
'''

with open(os.path.join(base_path, 'cli.py'), 'w') as f:
    f.write(cli_content)
print('Created cli.py')

print('\nAll files created successfully!')
