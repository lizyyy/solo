import argparse
import sys
import os
from pathlib import Path
from typing import List, Optional, Set

from colorama import init, Fore, Style

from .analyzer import CoverageAnalyzer
from .reporter import Reporter
from .team_mapping import TeamMapping, TeamMappingLoader
from .constants import ExitCode, DEFAULT_EXCLUDE_PATTERNS
from .__init__ import __version__

init(autoreset=True)


class CLI:
    def __init__(self):
        self.parser = self._build_parser()

    def _build_parser(self) -> argparse.ArgumentParser:
        parser = argparse.ArgumentParser(
            prog="codeowners-coverage",
            description="GitHub CODEOWNERS Coverage Analyzer - Check which files have no owner assigned",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  codeowners-coverage                           # Analyze current directory
  codeowners-coverage --repo ./myproject        # Analyze specific repository
  codeowners-coverage --output ./reports        # Output to specific directory
  codeowners-coverage --team-aliases teams.yaml # Use team alias mapping
  codeowners-coverage --exclude tests --exclude docs
  codeowners-coverage --fail-on-uncovered       # Exit with error if uncovered files exist
            """,
        )

        parser.add_argument(
            "-V", "--version",
            action="version",
            version=f"%(prog)s {__version__}",
        )

        input_group = parser.add_argument_group("Input Options")
        input_group.add_argument(
            "-r", "--repo",
            dest="repo_root",
            default=".",
            help="Repository root directory (default: current directory)",
        )
        input_group.add_argument(
            "-c", "--codeowners",
            dest="codeowners_path",
            help="Path to CODEOWNERS file (default: auto-detect)",
        )
        input_group.add_argument(
            "-t", "--team-aliases",
            dest="team_aliases_path",
            help="YAML file with team aliases and renames",
        )

        exclude_group = parser.add_argument_group("Filter Options")
        exclude_group.add_argument(
            "-e", "--exclude",
            action="append",
            default=[],
            help="Exclude pattern (gitignore style), can be specified multiple times",
        )
        exclude_group.add_argument(
            "--no-default-excludes",
            action="store_true",
            help="Don't use default exclude patterns",
        )
        exclude_group.add_argument(
            "--include-empty-dirs",
            action="store_true",
            help="Include empty directories in coverage check",
        )

        output_group = parser.add_argument_group("Output Options")
        output_group.add_argument(
            "-o", "--output-dir",
            dest="output_dir",
            default=".",
            help="Output directory for reports (default: current directory)",
        )
        output_group.add_argument(
            "-f", "--format",
            choices=["terminal", "json", "markdown", "all"],
            default="all",
            help="Output format (default: all)",
        )
        output_group.add_argument(
            "--base-filename",
            default="codeowners_coverage",
            help="Base filename for output files",
        )
        output_group.add_argument(
            "--append-timestamp",
            action="store_true",
            help="Append timestamp to output filenames",
        )
        output_group.add_argument(
            "--no-overwrite",
            action="store_true",
            help="Don't overwrite existing output files",
        )

        validation_group = parser.add_argument_group("Validation Options")
        validation_group.add_argument(
            "--valid-owners",
            help="Comma-separated list of valid owner names for validation",
        )
        validation_group.add_argument(
            "--valid-owners-file",
            help="File containing valid owner names (one per line)",
        )

        behavior_group = parser.add_argument_group("Behavior Options")
        behavior_group.add_argument(
            "--fail-on-uncovered",
            action="store_true",
            help="Exit with non-zero code if uncovered files exist",
        )
        behavior_group.add_argument(
            "--fail-on-invalid",
            action="store_true",
            help="Exit with non-zero code if invalid owners are found",
        )
        behavior_group.add_argument(
            "--min-coverage",
            type=float,
            help="Minimum required coverage percentage (0-100)",
        )

        return parser

    def _validate_args(self, args: argparse.Namespace) -> Optional[ExitCode]:
        if not Path(args.repo_root).exists():
            print(f"{Fore.RED}✗ Repository directory not found: {args.repo_root}{Style.RESET_ALL}")
            return ExitCode.FILE_NOT_FOUND

        if args.codeowners_path and not Path(args.codeowners_path).exists():
            print(f"{Fore.RED}✗ CODEOWNERS file not found: {args.codeowners_path}{Style.RESET_ALL}")
            return ExitCode.FILE_NOT_FOUND

        if args.team_aliases_path and not Path(args.team_aliases_path).exists():
            print(f"{Fore.RED}✗ Team aliases file not found: {args.team_aliases_path}{Style.RESET_ALL}")
            return ExitCode.FILE_NOT_FOUND

        if args.min_coverage is not None:
            if args.min_coverage < 0 or args.min_coverage > 100:
                print(f"{Fore.RED}✗ --min-coverage must be between 0 and 100{Style.RESET_ALL}")
                return ExitCode.INPUT_ERROR

        if args.valid_owners_file and not Path(args.valid_owners_file).exists():
            print(f"{Fore.RED}✗ Valid owners file not found: {args.valid_owners_file}{Style.RESET_ALL}")
            return ExitCode.FILE_NOT_FOUND

        return None

    def _load_valid_owners(self, args: argparse.Namespace) -> Set[str]:
        valid_owners = set()

        if args.valid_owners:
            for owner in args.valid_owners.split(","):
                owner = owner.strip()
                if owner:
                    valid_owners.add(owner)

        if args.valid_owners_file:
            with open(args.valid_owners_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        valid_owners.add(line)

        return valid_owners

    def _build_exclude_patterns(self, args: argparse.Namespace) -> List[str]:
        patterns = [] if args.no_default_excludes else DEFAULT_EXCLUDE_PATTERNS.copy()
        patterns.extend(args.exclude)
        return patterns

    def run(self, argv: List[str] = None) -> ExitCode:
        args = self.parser.parse_args(argv)

        error_code = self._validate_args(args)
        if error_code is not None:
            return error_code

        try:
            team_mapping = TeamMapping()
            if args.team_aliases_path:
                team_mapping = TeamMappingLoader.from_yaml(args.team_aliases_path)

            valid_owners = self._load_valid_owners(args)
            exclude_patterns = self._build_exclude_patterns(args)

            print(f"{Fore.CYAN}🔍 Analyzing CODEOWNERS coverage...{Style.RESET_ALL}")
            print(f"{Fore.CYAN}  Repository: {args.repo_root}{Style.RESET_ALL}")

            analyzer = CoverageAnalyzer(
                repo_root=args.repo_root,
                codeowners_path=args.codeowners_path,
                team_mapping=team_mapping,
                exclude_patterns=exclude_patterns,
                include_empty_dirs=args.include_empty_dirs,
                valid_owners=valid_owners,
            )

            report = analyzer.analyze()

            reporter = Reporter(
                report=report,
                output_dir=args.output_dir,
                base_filename=args.base_filename,
                append_timestamp=args.append_timestamp,
                overwrite=not args.no_overwrite,
            )

            if args.format == "terminal":
                reporter.write_terminal()
            elif args.format == "json":
                reporter.write_json()
            elif args.format == "markdown":
                reporter.write_markdown()
            else:
                reporter.write_all()

            exit_code = ExitCode.SUCCESS

            if args.fail_on_uncovered and report.uncovered_files:
                print(f"\n{Fore.RED}✗ Found {len(report.uncovered_files)} uncovered files{Style.RESET_ALL}")
                exit_code = ExitCode.UNCOVERED_FILES

            if args.fail_on_invalid and report.invalid_owners:
                print(f"\n{Fore.RED}✗ Found {len(report.invalid_owners)} invalid owners{Style.RESET_ALL}")
                exit_code = ExitCode.VALIDATION_ERROR

            if args.min_coverage is not None:
                coverage_pct = report.coverage_rate * 100
                if coverage_pct < args.min_coverage:
                    print(f"\n{Fore.RED}✗ Coverage {coverage_pct:.2f}% is below required {args.min_coverage}%{Style.RESET_ALL}")
                    exit_code = ExitCode.VALIDATION_ERROR

            if exit_code == ExitCode.SUCCESS:
                print(f"\n{Fore.GREEN}✓ Analysis completed successfully{Style.RESET_ALL}")

            return exit_code

        except FileNotFoundError as e:
            print(f"{Fore.RED}✗ {e}{Style.RESET_ALL}")
            return ExitCode.FILE_NOT_FOUND
        except Exception as e:
            print(f"{Fore.RED}✗ Unexpected error: {e}{Style.RESET_ALL}")
            import traceback
            traceback.print_exc()
            return ExitCode.RUNTIME_ERROR


def main(argv: List[str] = None) -> int:
    cli = CLI()
    return cli.run(argv)


if __name__ == "__main__":
    sys.exit(main())
