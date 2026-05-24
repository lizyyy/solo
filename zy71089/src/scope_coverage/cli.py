from __future__ import annotations

import sys
from pathlib import Path
from typing import List, Optional

import typer
from typing_extensions import Annotated

from .analyzer import CoverageAnalyzer
from .models import ExitCode, InputConfig, ReportConfig
from .reporter import ConsoleReporter, FileReporter, determine_exit_code

app = typer.Typer(
    name="scope-coverage",
    help="Auth Scope 覆盖检查工具 - 验证SDK示例、文档与真实接口权限一致性",
    no_args_is_help=True,
    add_completion=False,
)


def validate_path(path: Path, must_exist: bool = True) -> Path:
    if must_exist and not path.exists():
        raise typer.BadParameter(f"文件不存在: {path}")
    if must_exist and not path.is_file():
        raise typer.BadParameter(f"不是文件: {path}")
    return path


@app.command("check", help="执行 scope 覆盖检查")
def check(
    scopes: Annotated[
        Optional[List[Path]],
        typer.Option(
            "--scope",
            "-s",
            help="Scope 表文件 (YAML/JSON/TEXT)",
            callback=lambda x: [validate_path(p) for p in x] if x else [],
        ),
    ] = None,
    apis: Annotated[
        Optional[List[Path]],
        typer.Option(
            "--api",
            "-a",
            help="API 清单文件 (OpenAPI YAML/JSON/TEXT)",
            callback=lambda x: [validate_path(p) for p in x] if x else [],
        ),
    ] = None,
    sdks: Annotated[
        Optional[List[Path]],
        typer.Option(
            "--sdk",
            "-k",
            help="SDK 示例文件",
            callback=lambda x: [validate_path(p) for p in x] if x else [],
        ),
    ] = None,
    docs: Annotated[
        Optional[List[Path]],
        typer.Option(
            "--doc",
            "-d",
            help="文档片段文件 (Markdown/文本)",
            callback=lambda x: [validate_path(p) for p in x] if x else [],
        ),
    ] = None,
    logs: Annotated[
        Optional[List[Path]],
        typer.Option(
            "--log",
            "-l",
            help="调用日志文件",
            callback=lambda x: [validate_path(p) for p in x] if x else [],
        ),
    ] = None,
    output_dir: Annotated[
        Path,
        typer.Option(
            "--output",
            "-o",
            help="输出报告目录",
        ),
    ] = Path("./coverage_output"),
    no_json: Annotated[
        bool,
        typer.Option(
            "--no-json",
            help="不生成 JSON 报告",
        ),
    ] = False,
    no_md: Annotated[
        bool,
        typer.Option(
            "--no-md",
            help="不生成 Markdown 报告",
        ),
    ] = False,
    verbose: Annotated[
        bool,
        typer.Option(
            "--verbose",
            "-v",
            help="显示详细信息",
        ),
    ] = False,
) -> None:
    if not any([scopes, apis, sdks, docs, logs]):
        typer.echo("错误: 至少需要指定一个输入文件", err=True)
        raise typer.Exit(code=ExitCode.INPUT_ERROR.value)

    input_config = InputConfig(
        scope_table_files=scopes or [],
        api_list_files=apis or [],
        sdk_example_files=sdks or [],
        doc_fragment_files=docs or [],
        call_log_files=logs or [],
    )

    report_config = ReportConfig(
        output_dir=output_dir,
        include_json=not no_json,
        include_markdown=not no_md,
        verbose=verbose,
    )

    try:
        analyzer = CoverageAnalyzer()

        for file_path in input_config.scope_table_files:
            analyzer.load_scope_table(file_path)

        for file_path in input_config.api_list_files:
            analyzer.load_api_list(file_path)

        for file_path in input_config.sdk_example_files:
            analyzer.load_sdk_examples(file_path)

        for file_path in input_config.doc_fragment_files:
            analyzer.load_doc_fragments(file_path)

        for file_path in input_config.call_log_files:
            analyzer.load_call_logs(file_path)

        result = analyzer.analyze()

        console_reporter = ConsoleReporter(verbose=verbose)
        console_reporter.print_summary(result)

        file_reporter = FileReporter(report_config)
        file_reporter.generate(result)

        exit_code = determine_exit_code(result)
        raise typer.Exit(code=exit_code.value)

    except typer.Exit:
        raise
    except Exception as e:
        if verbose:
            import traceback
            traceback.print_exc()
        typer.echo(f"内部错误: {e}", err=True)
        raise typer.Exit(code=ExitCode.INTERNAL_ERROR.value)


@app.command("list-exit-codes", help="列出所有退出码及其含义")
def list_exit_codes() -> None:
    typer.echo("退出码列表:")
    typer.echo()
    for code in ExitCode:
        typer.echo(f"  {code.value:2d} - {code.name.replace('_', ' ').title()}")


@app.command("version", help="显示版本信息")
def version() -> None:
    typer.echo("scope-coverage v0.1.0")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
