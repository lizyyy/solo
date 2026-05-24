import os
import sys
from pathlib import Path
from typing import List, Optional, Tuple

import click

from . import __version__
from .constants import ExitCode, EXIT_CODE_DESCRIPTIONS, DEFAULT_OUTPUT_DIR, PackageSource
from .models import ValidationReport
from .dependency_parser import DependencyResolver
from .wheel_scanner import WheelScanner, SourceAttributor
from .hash_validator import HashChecker
from .report_generator import ReportWriter


class InputValidator:
    @staticmethod
    def validate_file(ctx, param, value):
        if value is None:
            return value
        path = Path(value)
        if not path.exists():
            raise click.BadParameter(f"文件不存在: {value}")
        if not path.is_file():
            raise click.BadParameter(f"不是文件: {value}")
        return str(path.resolve())

    @staticmethod
    def validate_directory(ctx, param, value):
        if value is None:
            return value
        path = Path(value)
        if not path.exists():
            raise click.BadParameter(f"目录不存在: {value}")
        if not path.is_dir():
            raise click.BadParameter(f"不是目录: {value}")
        return str(path.resolve())

    @staticmethod
    def validate_hash(ctx, param, values):
        if not values:
            return values
        validated = []
        for h in values:
            if ':' not in h:
                raise click.BadParameter(f"哈希格式错误，需要 'algorithm:hash' 格式: {h}")
            algo, hash_val = h.split(':', 1)
            if len(hash_val) < 32:
                raise click.BadParameter(f"哈希值太短: {h}")
            validated.append(h.lower())
        return validated


class HashCheckOrchestrator:
    def __init__(
        self,
        requirements_file: Optional[str] = None,
        constraints_file: Optional[str] = None,
        wheelhouse_dir: Optional[str] = None,
        package_name: Optional[str] = None,
        package_version: Optional[str] = None,
        hashes: Optional[List[str]] = None,
        strict: bool = True,
    ):
        self.requirements_file = requirements_file
        self.constraints_file = constraints_file
        self.wheelhouse_dir = wheelhouse_dir
        self.package_name = package_name
        self.package_version = package_version
        self.hashes = hashes or []
        self.strict = strict

    def run(self) -> Tuple[ValidationReport, ExitCode]:
        report = ValidationReport()
        
        try:
            self._record_inputs(report)
            
            wheel_scanner = WheelScanner(self.wheelhouse_dir)
            wheel_packages = wheel_scanner.scan()
            
            dependency_resolver = DependencyResolver()
            requirements, conflicts, errors = dependency_resolver.resolve_requirements_and_constraints(
                requirements_file=self.requirements_file,
                constraints_file=self.constraints_file
            )
            
            report.requirements = requirements
            report.constraint_conflicts = conflicts
            report.errors.extend(errors)
            
            attributor = SourceAttributor(wheel_scanner=wheel_scanner)
            report.packages = attributor.merge_package_sources(wheel_packages, requirements)
            
            hash_checker = HashChecker(strict=self.strict)
            self._perform_hash_checks(report, requirements, hash_checker, wheel_packages, wheel_scanner, attributor)
            
            exit_code = self._determine_exit_code(report)
            
        except Exception as e:
            report.errors.append(f"执行过程中发生错误: {str(e)}")
            exit_code = ExitCode.UNKNOWN_ERROR
        
        report.exit_code = int(exit_code)
        report.exit_code_description = EXIT_CODE_DESCRIPTIONS.get(exit_code, "未知错误")
        
        return report, exit_code

    def _record_inputs(self, report: ValidationReport):
        if self.requirements_file:
            report.input_files['requirements'] = self.requirements_file
        if self.constraints_file:
            report.input_files['constraints'] = self.constraints_file
        if self.wheelhouse_dir:
            report.input_files['wheelhouse'] = self.wheelhouse_dir

    def _perform_hash_checks(
        self,
        report: ValidationReport,
        requirements,
        hash_checker: HashChecker,
        wheel_packages: dict,
        wheel_scanner: WheelScanner,
        attributor: SourceAttributor
    ):
        for req in requirements:
            canonical = req.canonical_name()
            version = None
            
            if req.specifier and req.specifier.startswith('=='):
                version = req.specifier[2:].strip()
            
            wheel_pkg = None
            if canonical in wheel_packages:
                versions = wheel_packages[canonical]
                if version and version in versions:
                    wheel_pkg = versions[version]
                elif versions:
                    wheel_pkg = next(iter(versions.values()))
            
            if req.hashes:
                if wheel_pkg:
                    result, passed = hash_checker.check_requirement_against_package(req, wheel_pkg)
                    if result:
                        report.hash_checks.append(result)
                    
                    actual_hashes = wheel_pkg.hashes
                    attr = attributor.attribute_source(req.name, wheel_pkg.version, actual_hashes)
                    report.source_attributions.append(attr)
                else:
                    report.missing_packages.append({
                        'name': req.name,
                        'specifier': req.specifier,
                        'reason': '在 wheelhouse 中未找到匹配版本，无法验证实际哈希'
                    })
            else:
                report.missing_hashes.append({
                    'name': req.name,
                    'specifier': req.specifier,
                    'reason': 'requirements/constraints 中未提供哈希'
                })
        
        if self.package_name and self.hashes:
            pkg_version = wheel_scanner.get_package_version(self.package_name, self.package_version)
            version = self.package_version or (pkg_version.version if pkg_version else "unknown")
            
            result = hash_checker.check_hash_list(
                package_name=self.package_name,
                version=version,
                expected_hash_strings=self.hashes,
                actual_package=pkg_version
            )
            report.hash_checks.append(result)
            
            if pkg_version:
                all_hashes = pkg_version.hashes + []
                attr = attributor.attribute_source(self.package_name, version, all_hashes)
                report.source_attributions.append(attr)

    def _determine_exit_code(self, report: ValidationReport) -> ExitCode:
        if report.errors:
            return ExitCode.INPUT_ERROR
        
        if report.constraint_conflicts:
            return ExitCode.CONSTRAINT_CONFLICT
        
        hash_mismatches = [
            c for c in report.hash_checks 
            if not c.match and "找不到匹配的包版本" not in str(c.mismatch_details)
        ]
        if hash_mismatches:
            return ExitCode.HASH_MISMATCH
        
        if report.missing_packages:
            return ExitCode.MISSING_PACKAGE
        
        return ExitCode.SUCCESS


@click.group(invoke_without_command=True)
@click.version_option(__version__, '-V', '--version')
@click.pass_context
def cli(ctx):
    """Pip 依赖哈希 CLI 工具 - 验证 Python 包的完整性和来源"""
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@cli.command()
@click.option('-r', '--requirements', 'requirements_file',
              callback=InputValidator.validate_file,
              help='requirements.txt 文件路径')
@click.option('-c', '--constraints', 'constraints_file',
              callback=InputValidator.validate_file,
              help='constraints.txt 文件路径')
@click.option('-w', '--wheelhouse', 'wheelhouse_dir',
              callback=InputValidator.validate_directory,
              help='wheelhouse 目录路径')
@click.option('-o', '--output-dir', 'output_dir',
              default=DEFAULT_OUTPUT_DIR,
              help='输出报告目录 (默认: pip-hash-reports)')
@click.option('--strict/--no-strict', default=True,
              help='严格模式 (默认启用)')
@click.option('--color/--no-color', default=True,
              help='终端输出颜色 (默认启用)')
@click.option('--report-name', default='pip-hash-report',
              help='报告文件名前缀')
def check(requirements_file, constraints_file, wheelhouse_dir, output_dir, strict, color, report_name):
    """检查 requirements/constraints 中的包哈希"""
    
    if not any([requirements_file, constraints_file]):
        click.echo("错误: 必须至少提供 --requirements 或 --constraints", err=True)
        sys.exit(ExitCode.INPUT_ERROR)
    
    orchestrator = HashCheckOrchestrator(
        requirements_file=requirements_file,
        constraints_file=constraints_file,
        wheelhouse_dir=wheelhouse_dir,
        strict=strict
    )
    
    report, exit_code = orchestrator.run()
    
    report_writer = ReportWriter(output_dir)
    report_writer.print_terminal_summary(report, use_colors=color)
    
    output_files = report_writer.write_all(report, base_name=report_name)
    
    click.echo()
    click.echo(f"报告已生成:")
    for fmt, path in output_files.items():
        click.echo(f"  {fmt}: {path}")
    
    sys.exit(int(exit_code))


@cli.command()
@click.argument('package_name')
@click.argument('version', required=False)
@click.option('-H', '--hash', 'hashes', multiple=True,
              callback=InputValidator.validate_hash,
              help='预期的哈希值 (格式: algorithm:hash)，可多次指定')
@click.option('-f', '--file', 'file_path',
              callback=InputValidator.validate_file,
              help='要校验的本地文件路径 (wheel 或源码包)')
@click.option('-w', '--wheelhouse', 'wheelhouse_dir',
              callback=InputValidator.validate_directory,
              help='wheelhouse 目录路径')
@click.option('-o', '--output-dir', 'output_dir',
              default=DEFAULT_OUTPUT_DIR,
              help='输出报告目录 (默认: pip-hash-reports)')
@click.option('--color/--no-color', default=True,
              help='终端输出颜色 (默认启用)')
def verify(package_name, version, hashes, file_path, wheelhouse_dir, output_dir, color):
    """验证单个包的哈希值"""
    
    if not hashes and not file_path:
        click.echo("错误: 必须提供 --hash 或 --file", err=True)
        sys.exit(ExitCode.INPUT_ERROR)
    
    orchestrator = HashCheckOrchestrator(
        package_name=package_name,
        package_version=version,
        wheelhouse_dir=wheelhouse_dir,
        hashes=list(hashes),
        strict=True
    )
    
    report, exit_code = orchestrator.run()
    
    report_writer = ReportWriter(output_dir)
    report_writer.print_terminal_summary(report, use_colors=color)
    
    output_files = report_writer.write_all(report, base_name=f"verify-{package_name}")
    
    click.echo()
    click.echo(f"报告已生成:")
    for fmt, path in output_files.items():
        click.echo(f"  {fmt}: {path}")
    
    sys.exit(int(exit_code))


@cli.command()
@click.option('-w', '--wheelhouse', 'wheelhouse_dir',
              callback=InputValidator.validate_directory,
              required=True,
              help='wheelhouse 目录路径')
@click.option('-o', '--output-dir', 'output_dir',
              default=DEFAULT_OUTPUT_DIR,
              help='输出报告目录 (默认: pip-hash-reports)')
@click.option('--format', 'output_format',
              type=click.Choice(['json', 'txt', 'requirements']),
              default='requirements',
              help='输出格式')
@click.option('--algorithm', default='sha256',
              help='哈希算法 (默认: sha256)')
def generate(wheelhouse_dir, output_dir, output_format, algorithm):
    """为 wheelhouse 中的包生成哈希值"""
    
    wheel_scanner = WheelScanner(wheelhouse_dir)
    wheel_packages = wheel_scanner.scan()
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    lines = []
    for pkg_name, versions in wheel_packages.items():
        for version, pkg_info in versions.items():
            hashes = [h for h in pkg_info.hashes if h.algorithm == algorithm]
            if hashes:
                hash_str = f"--hash={algorithm}:{hashes[0].value}"
                lines.append(f"{pkg_name}=={version} {hash_str}")
    
    if output_format == 'requirements':
        file_name = 'requirements-with-hashes.txt'
        content = "\n".join(lines)
    elif output_format == 'json':
        import json
        file_name = 'hashes.json'
        data = {}
        for pkg_name, versions in wheel_packages.items():
            data[pkg_name] = {}
            for version, pkg_info in versions.items():
                data[pkg_name][version] = {
                    h.algorithm: h.value for h in pkg_info.hashes
                }
        content = json.dumps(data, indent=2, ensure_ascii=False)
    else:
        file_name = 'hashes.txt'
        content = "\n".join(lines)
    
    output_file = output_path / file_name
    output_file.write_text(content, encoding='utf-8')
    
    click.echo(f"已生成哈希文件: {output_file}")
    click.echo(f"共处理 {len(wheel_packages)} 个包")


def main():
    try:
        cli()
    except Exception as e:
        click.echo(f"致命错误: {e}", err=True)
        sys.exit(ExitCode.UNKNOWN_ERROR)


if __name__ == '__main__':
    main()
