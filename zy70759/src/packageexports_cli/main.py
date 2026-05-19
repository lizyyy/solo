import os
from pathlib import Path
from typing import Optional

import click
from rich.console import Console

from .example_generator import ExampleGenerator
from .exports_parser import ExportsParser
from .file_validator import FileValidator
from .models import ValidationResult
from .report import ReportGenerator


def run_check(
    package_path: str,
    json_output: bool = False,
    output_file: Optional[str] = None,
) -> tuple[ValidationResult, int]:
    package_root = Path(package_path).resolve()
    console = Console()
    
    parser = ExportsParser(package_root)
    package_data, parse_issues = parser.parse()
    
    if package_data is None:
        result = ValidationResult(
            package_name="unknown",
            package_version="unknown",
            issues=parse_issues,
        )
        return result, 1
        
    validator = FileValidator(package_root)
    file_checks, file_issues = validator.validate_entries(parser.exports_entries)
    
    example_generator = ExampleGenerator(package_data.get("name", "package"))
    import_examples = example_generator.generate_examples(
        parser.exports_entries,
        file_checks,
    )
    
    all_issues = parse_issues + file_issues
    
    result = ValidationResult(
        package_name=package_data.get("name", "unknown"),
        package_version=package_data.get("version", "unknown"),
        exports_entries=parser.exports_entries,
        issues=all_issues,
        import_examples=import_examples,
        file_checks=file_checks,
    )
    
    report_gen = ReportGenerator(console)
    
    if json_output or output_file:
        json_report = report_gen.generate_machine_readable(result)
        if output_file:
            output_path = Path(output_file).resolve()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(json_report, encoding="utf-8")
            if not json_output:
                console.print(f"[green]✅ 报告已写入: {output_path}[/green]")
        if json_output:
            if not output_file:
                console.print_json(json_report)
    
    if not json_output:
        report_gen.generate_human_readable(result)
        
    exit_code = 1 if result.has_errors else 0
    return result, exit_code


@click.command()
@click.argument(
    "package_path",
    type=click.Path(exists=True, file_okay=False, dir_okay=True),
    default=".",
)
@click.option(
    "--json",
    "-j",
    "json_output",
    is_flag=True,
    help="输出机器可读的 JSON 报告",
)
@click.option(
    "--output",
    "-o",
    "output_file",
    type=click.Path(),
    help="将 JSON 报告写入文件",
)
@click.option(
    "--strict",
    "-s",
    is_flag=True,
    help="严格模式：有警告也返回非 0 退出码",
)
def cli(
    package_path: str,
    json_output: bool = False,
    output_file: Optional[str] = None,
    strict: bool = False,
) -> None:
    """
    packageexports - Node.js package exports 入口体检排查工具
    
    检查 Node.js 包的 exports 配置是否正确，验证目标文件是否存在，
    生成导入样例，并提供详细的问题归因。
    
    PACKAGE_PATH: 包的根目录路径（包含 package.json），默认为当前目录
    """
    result, exit_code = run_check(package_path, json_output, output_file)
    
    if strict and result.warning_count > 0:
        exit_code = max(exit_code, 2)
        
    click.get_current_context().exit(exit_code)


if __name__ == "__main__":
    cli()
