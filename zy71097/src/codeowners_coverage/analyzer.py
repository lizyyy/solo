from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set, Tuple
from pathlib import Path
from collections import defaultdict

from .parser import CodeOwnersParser, CodeOwnerRule
from .file_scanner import FileScanner
from .team_mapping import TeamMapping


@dataclass
class FileCoverageResult:
    file_path: str
    owners: List[str] = field(default_factory=list)
    matched_rule: Optional[CodeOwnerRule] = None
    is_covered: bool = False
    is_empty_dir: bool = False
    expanded_owners: List[str] = field(default_factory=list)


@dataclass
class OwnerStats:
    owner: str
    file_count: int = 0
    files: List[str] = field(default_factory=list)
    directories: List[str] = field(default_factory=list)


@dataclass
class CoverageReport:
    total_files: int = 0
    covered_files: int = 0
    uncovered_files: List[str] = field(default_factory=list)
    empty_dirs: List[str] = field(default_factory=list)
    file_coverage: List[FileCoverageResult] = field(default_factory=list)
    owner_stats: Dict[str, OwnerStats] = field(default_factory=dict)
    coverage_rate: float = 0.0
    rules_count: int = 0
    unique_owners: List[str] = field(default_factory=list)
    invalid_owners: List[str] = field(default_factory=list)
    repo_root: str = ""
    codeowners_path: str = ""


class CoverageAnalyzer:
    def __init__(
        self,
        repo_root: str = ".",
        codeowners_path: Optional[str] = None,
        team_mapping: Optional[TeamMapping] = None,
        exclude_patterns: Optional[List[str]] = None,
        include_empty_dirs: bool = False,
        valid_owners: Optional[Set[str]] = None,
    ):
        self.repo_root = Path(repo_root).resolve()
        self.codeowners_path = codeowners_path
        self.team_mapping = team_mapping or TeamMapping()
        self.exclude_patterns = exclude_patterns
        self.include_empty_dirs = include_empty_dirs
        self.valid_owners = valid_owners or set()

        self.parser = CodeOwnersParser(codeowners_path, repo_root)
        self.scanner = FileScanner(
            repo_root=repo_root,
            exclude_patterns=exclude_patterns,
            include_empty_dirs=include_empty_dirs,
        )

    def analyze(self) -> CoverageReport:
        rules = self.parser.parse()
        scan_result = self.scanner.scan()

        report = CoverageReport(
            repo_root=str(self.repo_root),
            codeowners_path=str(self.parser.codeowners_path),
            rules_count=len(rules),
        )

        all_files = scan_result["files"]
        report.total_files = len(all_files)

        owner_stats: Dict[str, OwnerStats] = defaultdict(
            lambda: OwnerStats(owner="")
        )

        for file_path in all_files:
            owners, matched_rule = self.parser.match_file(file_path)
            expanded_owners = self.team_mapping.expand_owners(owners)

            result = FileCoverageResult(
                file_path=file_path,
                owners=owners,
                matched_rule=matched_rule,
                is_covered=len(expanded_owners) > 0,
                expanded_owners=expanded_owners,
            )

            report.file_coverage.append(result)

            if result.is_covered:
                report.covered_files += 1
                for owner in expanded_owners:
                    if owner not in owner_stats:
                        owner_stats[owner] = OwnerStats(owner=owner)
                    owner_stats[owner].file_count += 1
                    owner_stats[owner].files.append(file_path)
            else:
                report.uncovered_files.append(file_path)

        if self.include_empty_dirs:
            report.empty_dirs = scan_result["empty_dirs"]
            for empty_dir in report.empty_dirs:
                owners, matched_rule = self.parser.match_file(empty_dir)
                expanded_owners = self.team_mapping.expand_owners(owners)

                result = FileCoverageResult(
                    file_path=empty_dir,
                    owners=owners,
                    matched_rule=matched_rule,
                    is_covered=len(expanded_owners) > 0,
                    is_empty_dir=True,
                    expanded_owners=expanded_owners,
                )
                report.file_coverage.append(result)

                if not result.is_covered:
                    report.uncovered_files.append(empty_dir)

        report.owner_stats = dict(owner_stats)
        report.unique_owners = sorted(owner_stats.keys())

        if report.total_files > 0:
            report.coverage_rate = report.covered_files / report.total_files

        if self.valid_owners:
            all_owners_from_rules = self.parser.get_all_owners()
            report.invalid_owners = self.team_mapping.validate_owners(
                all_owners_from_rules, self.valid_owners
            )

        return report
