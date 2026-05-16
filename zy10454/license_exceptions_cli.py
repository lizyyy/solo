#!/usr/bin/env python3
"""
许可证例外清单CLI工具
用于扫描依赖许可证、管理例外规则、生成合规报告
"""

import argparse
import json
import os
import sys
import re
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, asdict, field
from enum import Enum


class OutputFormat(Enum):
    JSON = "json"
    MARKDOWN = "markdown"
    SUMMARY = "summary"
    ALL = "all"


class LockfileType(Enum):
    NPM = "package-lock.json"
    YARN = "yarn.lock"
    PNPM = "pnpm-lock.yaml"
    PIPFILE = "Pipfile.lock"
    POETRY = "poetry.lock"
    GO = "go.sum"


@dataclass
class Dependency:
    name: str
    version: str
    license: str = ""
    path: str = ""
    lockfile_source: str = ""
    line_number: int = 0


@dataclass
class ExceptionRule:
    package_name: str
    license: str
    reason: str
    approved_by: str
    expires_at: Optional[date] = None
    notes: str = ""


@dataclass
class ScanResult:
    dependency: Dependency
    is_exception: bool = False
    exception_rule: Optional[ExceptionRule] = None
    is_expired: bool = False
    warning: str = ""


@dataclass
class ErrorRecord:
    file_path: str
    line_number: int
    error_type: str
    message: str
    raw_content: str = ""


class LicenseExceptionCLI:
    def __init__(self):
        self.errors: List[ErrorRecord] = []
        self.dependencies: List[Dependency] = []
        self.exception_rules: List[ExceptionRule] = []
        self.results: List[ScanResult] = []
        self.license_summary: Dict[str, int] = {}

    def parse_args(self, args: List[str]) -> argparse.Namespace:
        parser = argparse.ArgumentParser(
            description="许可证例外清单CLI - 依赖许可证扫描与合规报告工具",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例:
  %(prog)s --lockfile package-lock.json --exceptions exceptions.json
  %(prog)s --lockfile yarn.lock --output-dir ./reports --format all
  %(prog)s --lockfile go.sum --exceptions exceptions.json --no-expire-warning
            """
        )

        parser.add_argument(
            "--lockfile", "-l",
            required=True,
            help="Lockfile路径 (支持: package-lock.json, yarn.lock, pnpm-lock.yaml, Pipfile.lock, poetry.lock, go.sum)"
        )

        parser.add_argument(
            "--exceptions", "-e",
            help="例外规则JSON文件路径"
        )

        parser.add_argument(
            "--output-dir", "-o",
            default="./license_reports",
            help="输出目录 (默认: ./license_reports)"
        )

        parser.add_argument(
            "--format", "-f",
            choices=["json", "markdown", "summary", "all"],
            default="all",
            help="输出格式 (默认: all)"
        )

        parser.add_argument(
            "--no-expire-warning",
            action="store_true",
            help="禁用到期提醒"
        )

        parser.add_argument(
            "--expire-threshold",
            type=int,
            default=30,
            help="到期提醒阈值（天）(默认: 30)"
        )

        parser.add_argument(
            "--config", "-c",
            help="配置文件路径"
        )

        parser.add_argument(
            "--verbose", "-v",
            action="store_true",
            help="详细输出"
        )

        return parser.parse_args(args)

    def validate_args(self, args: argparse.Namespace) -> bool:
        if not os.path.exists(args.lockfile):
            self.errors.append(ErrorRecord(
                file_path=args.lockfile,
                line_number=0,
                error_type="FileNotFound",
                message=f"Lockfile不存在: {args.lockfile}"
            ))
            return False

        if args.exceptions and not os.path.exists(args.exceptions):
            self.errors.append(ErrorRecord(
                file_path=args.exceptions,
                line_number=0,
                error_type="FileNotFound",
                message=f"例外规则文件不存在: {args.exceptions}"
            ))
            return False

        lockfile_name = os.path.basename(args.lockfile)
        valid_lockfiles = [lt.value for lt in LockfileType]
        if lockfile_name not in valid_lockfiles:
            self.errors.append(ErrorRecord(
                file_path=args.lockfile,
                line_number=0,
                error_type="UnsupportedFormat",
                message=f"不支持的Lockfile格式: {lockfile_name}。支持: {', '.join(valid_lockfiles)}"
            ))
            return False

        return True

    def ensure_output_dir(self, output_dir: str) -> None:
        Path(output_dir).mkdir(parents=True, exist_ok=True)

    def parse_npm_lock(self, file_path: str) -> List[Dependency]:
        deps = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if "packages" in data:
                for path, pkg in data["packages"].items():
                    if path == "" or "name" not in pkg:
                        continue
                    name = pkg.get("name", path.split("/")[-1])
                    version = pkg.get("version", "")
                    license_info = pkg.get("license", "")
                    if isinstance(license_info, dict):
                        license_info = license_info.get("type", "")
                    deps.append(Dependency(
                        name=name,
                        version=version,
                        license=str(license_info),
                        path=path,
                        lockfile_source=file_path
                    ))
            elif "dependencies" in data:
                for name, dep in data["dependencies"].items():
                    version = dep.get("version", "")
                    deps.append(Dependency(
                        name=name,
                        version=version,
                        license="",
                        lockfile_source=file_path
                    ))
        except json.JSONDecodeError as e:
            self.errors.append(ErrorRecord(
                file_path=file_path,
                line_number=e.lineno,
                error_type="JSONParseError",
                message=f"JSON解析错误: {e.msg}",
                raw_content=str(e)
            ))
        return deps

    def parse_yarn_lock(self, file_path: str) -> List[Dependency]:
        deps = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            current_pkg = None
            for line_num, line in enumerate(content.split('\n'), 1):
                line_stripped = line.strip()
                if line_stripped and not line_stripped.startswith('#') and not line.startswith(' '):
                    pkg_match = re.match(r'^"?([^"@]+)(?:@[^"\n]+)?', line_stripped)
                    if pkg_match:
                        current_pkg = pkg_match.group(1)
                elif current_pkg and line_stripped.startswith('version'):
                    version_match = re.search(r'version\s+"?([^"\s]+)"?', line_stripped)
                    if version_match:
                        version = version_match.group(1)
                        deps.append(Dependency(
                            name=current_pkg,
                            version=version,
                            license="",
                            lockfile_source=file_path,
                            line_number=line_num
                        ))
                        current_pkg = None
        except Exception as e:
            self.errors.append(ErrorRecord(
                file_path=file_path,
                line_number=0,
                error_type="YarnParseError",
                message=f"yarn.lock解析错误: {str(e)}"
            ))
        return deps

    def parse_go_sum(self, file_path: str) -> List[Dependency]:
        deps = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line and not line.startswith('#'):
                        parts = line.split()
                        if len(parts) >= 2:
                            name = parts[0]
                            version = parts[1].replace('/go.mod', '')
                            deps.append(Dependency(
                                name=name,
                                version=version,
                                license="",
                                lockfile_source=file_path,
                                line_number=line_num
                            ))
        except Exception as e:
            self.errors.append(ErrorRecord(
                file_path=file_path,
                line_number=0,
                error_type="GoSumParseError",
                message=f"go.sum解析错误: {str(e)}"
            ))
        return deps

    def parse_lockfile(self, file_path: str) -> List[Dependency]:
        lockfile_name = os.path.basename(file_path)
        
        if lockfile_name == LockfileType.NPM.value:
            return self.parse_npm_lock(file_path)
        elif lockfile_name == LockfileType.YARN.value:
            return self.parse_yarn_lock(file_path)
        elif lockfile_name == LockfileType.GO.value:
            return self.parse_go_sum(file_path)
        else:
            self.errors.append(ErrorRecord(
                file_path=file_path,
                line_number=0,
                error_type="UnsupportedFormat",
                message=f"暂未实现的Lockfile格式: {lockfile_name}"
            ))
            return []

    def load_exceptions(self, file_path: str) -> List[ExceptionRule]:
        rules = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if isinstance(data, list):
                for idx, item in enumerate(data):
                    expires_at = None
                    if item.get("expires_at"):
                        try:
                            expires_at = datetime.strptime(item["expires_at"], "%Y-%m-%d").date()
                        except ValueError:
                            self.errors.append(ErrorRecord(
                                file_path=file_path,
                                line_number=idx + 1,
                                error_type="DateFormatError",
                                message=f"日期格式错误，期望 YYYY-MM-DD: {item.get('expires_at')}",
                                raw_content=json.dumps(item)
                            ))

                    rules.append(ExceptionRule(
                        package_name=item.get("package_name", ""),
                        license=item.get("license", ""),
                        reason=item.get("reason", ""),
                        approved_by=item.get("approved_by", ""),
                        expires_at=expires_at,
                        notes=item.get("notes", "")
                    ))
        except json.JSONDecodeError as e:
            self.errors.append(ErrorRecord(
                file_path=file_path,
                line_number=e.lineno,
                error_type="JSONParseError",
                message=f"例外规则JSON解析错误: {e.msg}",
                raw_content=str(e)
            ))
        return rules

    def match_exceptions(self) -> None:
        today = date.today()
        for dep in self.dependencies:
            result = ScanResult(dependency=dep)
            
            for rule in self.exception_rules:
                if (rule.package_name == dep.name or 
                    (rule.package_name.endswith('*') and 
                     dep.name.startswith(rule.package_name[:-1]))):
                    result.is_exception = True
                    result.exception_rule = rule
                    
                    if rule.expires_at and rule.expires_at < today:
                        result.is_expired = True
                        result.warning = f"例外已过期: {rule.expires_at}"
                    break
            
            self.results.append(result)

            license_key = dep.license or "Unknown"
            self.license_summary[license_key] = self.license_summary.get(license_key, 0) + 1

    def generate_json_output(self, output_dir: str, args: argparse.Namespace) -> str:
        output_data = {
            "scan_info": {
                "timestamp": datetime.now().isoformat(),
                "lockfile": args.lockfile,
                "exceptions_file": args.exceptions,
                "total_dependencies": len(self.dependencies),
                "total_exceptions": len([r for r in self.results if r.is_exception]),
                "expired_exceptions": len([r for r in self.results if r.is_expired])
            },
            "license_summary": self.license_summary,
            "results": [
                {
                    "dependency": asdict(r.dependency),
                    "is_exception": r.is_exception,
                    "exception_rule": asdict(r.exception_rule) if r.exception_rule else None,
                    "is_expired": r.is_expired,
                    "warning": r.warning
                }
                for r in self.results
            ],
            "errors": [asdict(e) for e in self.errors]
        }

        output_path = os.path.join(output_dir, "license_scan_results.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False, default=str)
        
        return output_path

    def generate_markdown_report(self, output_dir: str, args: argparse.Namespace) -> str:
        today = date.today()
        lines = []
        
        lines.append("# 许可证合规扫描报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**Lockfile**: `{args.lockfile}`")
        lines.append(f"**例外规则**: `{args.exceptions or '未提供'}`")
        lines.append("")

        lines.append("## 概览")
        lines.append("")
        lines.append(f"- 总依赖数: **{len(self.dependencies)}**")
        lines.append(f"- 例外许可数: **{len([r for r in self.results if r.is_exception])}**")
        lines.append(f"- 已过期例外: **{len([r for r in self.results if r.is_expired])}**")
        lines.append(f"- 扫描错误数: **{len(self.errors)}**")
        lines.append("")

        lines.append("## 许可证分布")
        lines.append("")
        lines.append("| 许可证 | 数量 |")
        lines.append("|--------|------|")
        for license_name, count in sorted(self.license_summary.items(), key=lambda x: -x[1]):
            lines.append(f"| {license_name or 'Unknown'} | {count} |")
        lines.append("")

        lines.append("## 例外许可清单")
        lines.append("")
        exceptions = [r for r in self.results if r.is_exception]
        if exceptions:
            lines.append("| 包名 | 版本 | 许可证 | 理由 | 审批人 | 到期日期 | 状态 |")
            lines.append("|------|------|--------|------|--------|----------|------|")
            for r in exceptions:
                rule = r.exception_rule
                status = "🔴 已过期" if r.is_expired else "🟢 有效"
                expires_at = rule.expires_at.strftime("%Y-%m-%d") if rule and rule.expires_at else "永久"
                lines.append(f"| {r.dependency.name} | {r.dependency.version} | {rule.license or '-'} | {rule.reason} | {rule.approved_by} | {expires_at} | {status} |")
        else:
            lines.append("*无例外许可*")
        lines.append("")

        lines.append("## 即将到期提醒")
        lines.append("")
        expiring_soon = []
        if not args.no_expire_warning:
            threshold = args.expire_threshold
            for r in self.results:
                if r.exception_rule and r.exception_rule.expires_at:
                    days_left = (r.exception_rule.expires_at - today).days
                    if 0 <= days_left <= threshold:
                        expiring_soon.append((r, days_left))

        if expiring_soon:
            expiring_soon.sort(key=lambda x: x[1])
            for r, days_left in expiring_soon:
                lines.append(f"- ⚠️ **{r.dependency.name}** 将在 {days_left} 天后到期 ({r.exception_rule.expires_at})")
        else:
            lines.append("*无即将到期的例外*")
        lines.append("")

        lines.append("## 完整依赖清单")
        lines.append("")
        lines.append("| 包名 | 版本 | 许可证 | 例外状态 | 来源文件 | 行号 |")
        lines.append("|------|------|--------|----------|----------|------|")
        for r in self.results:
            exception_status = "✅ 例外" if r.is_exception else "❌ 无例外"
            if r.is_expired:
                exception_status = "⚠️ 例外已过期"
            source_file = os.path.basename(r.dependency.lockfile_source)
            lines.append(f"| {r.dependency.name} | {r.dependency.version} | {r.dependency.license or '-'} | {exception_status} | {source_file} | {r.dependency.line_number or '-'} |")
        lines.append("")

        if self.errors:
            lines.append("## 错误与异常")
            lines.append("")
            lines.append("| 文件 | 行号 | 错误类型 | 消息 | 原始内容 |")
            lines.append("|------|------|----------|------|----------|")
            for e in self.errors:
                raw_content = e.raw_content.replace('|', '\\|') if e.raw_content else '-'
                lines.append(f"| {e.file_path} | {e.line_number or '-'} | {e.error_type} | {e.message} | {raw_content} |")
            lines.append("")

        output_path = os.path.join(output_dir, "license_scan_report.md")
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return output_path

    def print_summary(self, args: argparse.Namespace) -> None:
        print("\n" + "=" * 60)
        print("许可证例外清单CLI - 扫描摘要")
        print("=" * 60)
        print(f"Lockfile:     {args.lockfile}")
        print(f"例外规则:     {args.exceptions or '未提供'}")
        print(f"输出目录:     {args.output_dir}")
        print(f"扫描时间:     {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("-" * 60)
        print(f"总依赖数:     {len(self.dependencies)}")
        print(f"例外许可数:   {len([r for r in self.results if r.is_exception])}")
        print(f"已过期例外:   {len([r for r in self.results if r.is_expired])}")
        print(f"许可证种类:   {len(self.license_summary)}")
        print(f"扫描错误数:   {len(self.errors)}")
        print("-" * 60)
        
        if self.license_summary:
            print("\n许可证分布:")
            for license_name, count in sorted(self.license_summary.items(), key=lambda x: -x[1]):
                print(f"  {license_name or 'Unknown':<25} {count:>3} 个包")

        expiring = [r for r in self.results if r.exception_rule and r.exception_rule.expires_at]
        if expiring and not args.no_expire_warning:
            print("\n即将到期提醒:")
            today = date.today()
            for r in sorted(expiring, key=lambda x: x.exception_rule.expires_at):
                days_left = (r.exception_rule.expires_at - today).days
                if days_left <= args.expire_threshold:
                    status = "🔴 已过期" if days_left < 0 else f"⚠️ {days_left}天后"
                    print(f"  {r.dependency.name:<40} {status}")

        if self.errors:
            print("\n错误与异常:")
            for e in self.errors:
                print(f"  [{e.error_type}] {e.file_path}:{e.line_number} - {e.message}")

        print("\n" + "=" * 60 + "\n")

    def run(self, cli_args: List[str]) -> int:
        args = self.parse_args(cli_args)

        if not self.validate_args(args):
            for e in self.errors:
                print(f"错误: {e.message}", file=sys.stderr)
            return 1

        self.ensure_output_dir(args.output_dir)

        self.dependencies = self.parse_lockfile(args.lockfile)

        if args.exceptions:
            self.exception_rules = self.load_exceptions(args.exceptions)

        self.match_exceptions()

        output_paths = []

        if args.format in ["json", "all"]:
            path = self.generate_json_output(args.output_dir, args)
            output_paths.append(("JSON", path))

        if args.format in ["markdown", "all"]:
            path = self.generate_markdown_report(args.output_dir, args)
            output_paths.append(("Markdown", path))

        if args.format in ["summary", "all"]:
            self.print_summary(args)

        for fmt, path in output_paths:
            print(f"✓ {fmt}报告已生成: {path}")

        if self.errors:
            print(f"\n⚠️ 扫描过程中发现 {len(self.errors)} 个问题，请检查报告详情")
            return 2

        return 0


def main():
    cli = LicenseExceptionCLI()
    sys.exit(cli.run(sys.argv[1:]))


if __name__ == "__main__":
    main()
