import json
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
from dataclasses import asdict

from colorama import init, Fore, Style
from tabulate import tabulate

from .analyzer import CoverageReport

init(autoreset=True)


class Reporter:
    def __init__(
        self,
        report: CoverageReport,
        output_dir: str = ".",
        base_filename: str = "codeowners_coverage",
        append_timestamp: bool = False,
        overwrite: bool = True,
    ):
        self.report = report
        self.output_dir = Path(output_dir)
        self.base_filename = base_filename
        self.append_timestamp = append_timestamp
        self.overwrite = overwrite

        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _get_output_path(self, extension: str) -> Path:
        filename = self.base_filename
        if self.append_timestamp:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{filename}_{timestamp}"
        filename = f"{filename}.{extension}"
        return self.output_dir / filename

    def _check_overwrite(self, path: Path) -> bool:
        if path.exists() and not self.overwrite:
            print(f"{Fore.YELLOW}⚠️  File exists, skipping: {path}")
            return False
        if path.exists():
            print(f"{Fore.BLUE}ℹ️  Overwriting existing file: {path}")
        return True

    def generate_terminal_summary(self) -> str:
        lines = []
        lines.append(f"\n{Fore.CYAN}{'='*60}")
        lines.append(f"{Fore.CYAN}  GitHub CODEOWNERS Coverage Report")
        lines.append(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}\n")

        lines.append(f"{Fore.GREEN}📁 Repository: {Style.RESET_ALL}{self.report.repo_root}")
        lines.append(f"{Fore.GREEN}📄 CODEOWNERS: {Style.RESET_ALL}{self.report.codeowners_path}")
        lines.append(f"{Fore.GREEN}📋 Rules parsed: {Style.RESET_ALL}{self.report.rules_count}\n")

        coverage_pct = self.report.coverage_rate * 100
        coverage_color = Fore.GREEN if coverage_pct >= 80 else (Fore.YELLOW if coverage_pct >= 50 else Fore.RED)

        lines.append(f"{Fore.CYAN}--- Coverage Summary ---{Style.RESET_ALL}")
        lines.append(f"  Total files:        {self.report.total_files}")
        lines.append(f"  Covered files:      {self.report.covered_files}")
        lines.append(f"  Uncovered files:    {len(self.report.uncovered_files)}")
        lines.append(f"  Coverage rate:      {coverage_color}{coverage_pct:.2f}%{Style.RESET_ALL}\n")

        if self.report.unique_owners:
            lines.append(f"{Fore.CYAN}--- Owner Distribution ---{Style.RESET_ALL}")
            table_data = []
            for owner in sorted(self.report.unique_owners):
                stats = self.report.owner_stats[owner]
                table_data.append([owner, stats.file_count, f"{stats.file_count/self.report.total_files*100:.1f}%"])
            lines.append(tabulate(table_data, headers=["Owner", "Files", "Share"], tablefmt="simple"))
            lines.append("")

        if self.report.uncovered_files:
            lines.append(f"{Fore.CYAN}--- Uncovered Files ({len(self.report.uncovered_files)}) ---{Style.RESET_ALL}")
            for uncovered in sorted(self.report.uncovered_files)[:20]:
                lines.append(f"  {Fore.RED}✗ {uncovered}{Style.RESET_ALL}")
            if len(self.report.uncovered_files) > 20:
                lines.append(f"  ... and {len(self.report.uncovered_files) - 20} more")
            lines.append("")

        if self.report.invalid_owners:
            lines.append(f"{Fore.RED}--- Invalid Owners ({len(self.report.invalid_owners)}) ---{Style.RESET_ALL}")
            for owner in self.report.invalid_owners:
                lines.append(f"  {Fore.RED}⚠️  {owner}{Style.RESET_ALL}")
            lines.append("")

        if self.report.empty_dirs:
            lines.append(f"{Fore.CYAN}--- Empty Directories ({len(self.report.empty_dirs)}) ---{Style.RESET_ALL}")
            for empty_dir in sorted(self.report.empty_dirs)[:10]:
                lines.append(f"  {Fore.YELLOW}📂 {empty_dir}{Style.RESET_ALL}")
            if len(self.report.empty_dirs) > 10:
                lines.append(f"  ... and {len(self.report.empty_dirs) - 10} more")
            lines.append("")

        lines.append(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}")
        return "\n".join(lines)

    def generate_json(self) -> str:
        def serialize(obj: Any) -> Any:
            if hasattr(obj, "__dataclass_fields__"):
                return asdict(obj)
            if isinstance(obj, Path):
                return str(obj)
            return str(obj)

        data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "repo_root": self.report.repo_root,
                "codeowners_path": self.report.codeowners_path,
            },
            "summary": {
                "total_files": self.report.total_files,
                "covered_files": self.report.covered_files,
                "uncovered_count": len(self.report.uncovered_files),
                "coverage_rate": self.report.coverage_rate,
                "rules_count": self.report.rules_count,
                "unique_owners_count": len(self.report.unique_owners),
            },
            "uncovered_files": self.report.uncovered_files,
            "empty_dirs": self.report.empty_dirs,
            "unique_owners": self.report.unique_owners,
            "owner_stats": {
                owner: {
                    "file_count": stats.file_count,
                    "files": stats.files,
                }
                for owner, stats in self.report.owner_stats.items()
            },
            "file_coverage": [
                {
                    "file_path": fc.file_path,
                    "owners": fc.owners,
                    "expanded_owners": fc.expanded_owners,
                    "is_covered": fc.is_covered,
                    "is_empty_dir": fc.is_empty_dir,
                    "matched_rule": {
                        "pattern": fc.matched_rule.pattern,
                        "owners": fc.matched_rule.owners,
                        "line_number": fc.matched_rule.line_number,
                    }
                    if fc.matched_rule
                    else None,
                }
                for fc in self.report.file_coverage
            ],
            "invalid_owners": self.report.invalid_owners,
        }
        return json.dumps(data, indent=2, default=serialize, ensure_ascii=False)

    def generate_markdown(self) -> str:
        lines = []
        lines.append("# GitHub CODEOWNERS Coverage Report\n")

        lines.append("## 📊 Overview\n")
        lines.append(f"- **Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- **Repository:** `{self.report.repo_root}`")
        lines.append(f"- **CODEOWNERS:** `{self.report.codeowners_path}`")
        lines.append(f"- **Rules:** {self.report.rules_count}\n")

        coverage_pct = self.report.coverage_rate * 100
        lines.append("## 📈 Coverage Summary\n")
        badge_color = "green" if coverage_pct >= 80 else ("yellow" if coverage_pct >= 50 else "red")
        lines.append(f"![Coverage](https://img.shields.io/badge/Coverage-{coverage_pct:.1f}%25-{badge_color})\n")

        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Total Files | {self.report.total_files} |")
        lines.append(f"| Covered Files | {self.report.covered_files} |")
        lines.append(f"| Uncovered Files | {len(self.report.uncovered_files)} |")
        lines.append(f"| **Coverage Rate** | **{coverage_pct:.2f}%** |")
        lines.append(f"| Unique Owners | {len(self.report.unique_owners)} |")
        lines.append("")

        if self.report.unique_owners:
            lines.append("## 👥 Owner Distribution\n")
            lines.append("| Owner | Files | Share |")
            lines.append("|-------|-------|-------|")
            for owner in sorted(self.report.unique_owners):
                stats = self.report.owner_stats[owner]
                share = stats.file_count / self.report.total_files * 100
                lines.append(f"| `{owner}` | {stats.file_count} | {share:.1f}% |")
            lines.append("")

        if self.report.uncovered_files:
            lines.append("## ❌ Uncovered Files\n")
            lines.append(f"> **{len(self.report.uncovered_files)}** files/directories have no CODEOWNERS assigned.\n")
            lines.append("```\n")
            for uncovered in sorted(self.report.uncovered_files):
                lines.append(uncovered)
            lines.append("```\n")

        if self.report.invalid_owners:
            lines.append("## ⚠️ Invalid Owners\n")
            lines.append(f"The following owners are not in the valid owners list:\n")
            lines.append("```\n")
            for owner in sorted(self.report.invalid_owners):
                lines.append(owner)
            lines.append("```\n")

        if self.report.empty_dirs:
            lines.append("## 📂 Empty Directories\n")
            lines.append(f"**{len(self.report.empty_dirs)}** empty directories found:\n")
            lines.append("```\n")
            for empty_dir in sorted(self.report.empty_dirs):
                lines.append(empty_dir)
            lines.append("```\n")

        lines.append("## 📋 Detailed File Coverage\n")
        lines.append("<details>")
        lines.append("<summary>Click to expand full file list</summary>\n")
        lines.append("| File | Owner(s) | Status |")
        lines.append("|------|----------|--------|")
        for fc in sorted(self.report.file_coverage, key=lambda x: x.file_path):
            owners = ", ".join(fc.expanded_owners) if fc.expanded_owners else "-"
            status = "✅ Covered" if fc.is_covered else "❌ Uncovered"
            lines.append(f"| `{fc.file_path}` | {owners} | {status} |")
        lines.append("")
        lines.append("</details>\n")

        return "\n".join(lines)

    def write_terminal(self) -> None:
        print(self.generate_terminal_summary())

    def write_json(self) -> Optional[Path]:
        output_path = self._get_output_path("json")
        if not self._check_overwrite(output_path):
            return None

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(self.generate_json())

        print(f"{Fore.GREEN}✓ JSON report written to: {output_path}{Style.RESET_ALL}")
        return output_path

    def write_markdown(self) -> Optional[Path]:
        output_path = self._get_output_path("md")
        if not self._check_overwrite(output_path):
            return None

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(self.generate_markdown())

        print(f"{Fore.GREEN}✓ Markdown report written to: {output_path}{Style.RESET_ALL}")
        return output_path

    def write_all(self) -> Dict[str, Optional[Path]]:
        self.write_terminal()
        return {
            "json": self.write_json(),
            "markdown": self.write_markdown(),
        }
