import os
import sys
import subprocess
from typing import Optional, List

import click

from . import __version__
from .parser import ProtoParser
from .detector import RiskDetector, RiskLevel
from .reporter import Reporter, CheckResult


def get_proto_from_git(proto_path: str, git_ref: str) -> Optional[str]:
    if not os.path.exists(proto_path):
        return None

    abs_path = os.path.abspath(proto_path)
    repo_root = find_git_root(os.path.dirname(abs_path))
    if not repo_root:
        return None

    rel_path = os.path.relpath(abs_path, repo_root)

    try:
        result = subprocess.run(
            ["git", "show", f"{git_ref}:{rel_path}"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=True
        )

        temp_path = os.path.join(os.path.dirname(abs_path), f".proto_checker_{git_ref}_{os.path.basename(proto_path)}")
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(result.stdout)
        return temp_path
    except subprocess.CalledProcessError:
        return None


def find_git_root(path: str) -> Optional[str]:
    current = os.path.abspath(path)
    while True:
        if os.path.isdir(os.path.join(current, '.git')):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return None
        current = parent


@click.group()
@click.version_option(version=__version__, prog_name="proto-reserved-checker")
def main():
    pass


@main.command()
@click.argument('proto_file', type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option('--historical', '-h', type=click.Path(exists=True, file_okay=True, dir_okay=False),
              help='历史版本 proto 文件路径，用于对比字段变化')
@click.option('--git-ref', '-g', type=str,
              help='Git 引用（如 commit hash、branch name、tag），用于获取历史版本')
@click.option('--json-output', '-j', type=click.Path(), help='JSON 报告输出路径')
@click.option('--markdown-output', '-m', type=click.Path(), help='Markdown 报告输出路径')
@click.option('--detailed', '-d', is_flag=True, help='显示详细信息')
@click.option('--fail-on-critical', is_flag=True, help='发现严重风险时以非零状态码退出')
def check(
    proto_file: str,
    historical: Optional[str] = None,
    git_ref: Optional[str] = None,
    json_output: Optional[str] = None,
    markdown_output: Optional[str] = None,
    detailed: bool = False,
    fail_on_critical: bool = False
):
    proto_file = os.path.abspath(proto_file)

    if git_ref and historical:
        click.echo("错误: 不能同时指定 --historical 和 --git-ref", err=True)
        sys.exit(1)

    historical_path = historical
    temp_historical_path = None
    if git_ref:
        historical_path = get_proto_from_git(proto_file, git_ref)
        temp_historical_path = historical_path
        if not historical_path:
            click.echo(f"警告: 无法从 git ref '{git_ref}' 获取 proto 文件", err=True)

    try:
        parser = ProtoParser()
        current_proto = parser.parse(proto_file)

        historical_proto = None
        if historical_path:
            try:
                historical_proto = parser.parse(historical_path)
            except Exception as e:
                click.echo(f"警告: 解析历史版本失败: {e}", err=True)

        detector = RiskDetector()
        risks = detector.detect_risks(current_proto, historical_proto)

        result = CheckResult(
            proto_file=current_proto,
            historical_file=historical_proto,
            risks=risks
        )

        reporter = Reporter()

        click.echo(reporter.generate_terminal_summary(result, detailed))

        if json_output:
            reporter.generate_json_report(result, json_output)
            click.echo(f"已生成 JSON 报告: {os.path.abspath(json_output)}")

        if markdown_output:
            reporter.generate_markdown_report(result, markdown_output)
            click.echo(f"已生成 Markdown 报告: {os.path.abspath(markdown_output)}")

        if fail_on_critical:
            has_critical = any(r.level == RiskLevel.CRITICAL for r in risks)
            if has_critical:
                sys.exit(1)

    finally:
        if temp_historical_path and os.path.exists(temp_historical_path):
            os.unlink(temp_historical_path)


@main.command()
@click.argument('proto_file', type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option('--output', '-o', type=click.Path(), help='输出文件路径（默认显示到终端）')
def parse(proto_file: str, output: Optional[str] = None):
    proto_file = os.path.abspath(proto_file)
    parser = ProtoParser()

    try:
        proto = parser.parse(proto_file)

        lines = []
        lines.append(f"文件: {proto.path}")
        lines.append(f"语法: {proto.syntax}")
        lines.append(f"包: {proto.package}")
        lines.append(f"消息数量: {len(proto.get_all_messages())}")
        lines.append("")

        for msg_name, msg in proto.get_all_messages().items():
            lines.append(f"消息: {msg_name}")
            lines.append(f"  字段 ({len(msg.fields)}):")
            for field in msg.fields:
                lines.append(f"    [{field.number}] {field.name}: {field.type}")

            if msg.reserved_numbers:
                lines.append("  保留编号:")
                for r in msg.reserved_numbers:
                    if r.end:
                        lines.append(f"    {r.start} to {r.end}")
                    else:
                        lines.append(f"    {r.start}")

            if msg.reserved_names:
                lines.append("  保留名称:")
                for name in msg.reserved_names:
                    lines.append(f'    "{name}"')
            lines.append("")

        content = "\n".join(lines)

        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(content)
            click.echo(f"解析结果已保存到: {os.path.abspath(output)}")
        else:
            click.echo(content)

    except Exception as e:
        click.echo(f"解析失败: {e}", err=True)
        sys.exit(1)


@main.command()
@click.argument('proto_file', type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.argument('historical_proto', type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option('--json-output', '-j', type=click.Path(), help='JSON 报告输出路径')
@click.option('--markdown-output', '-m', type=click.Path(), help='Markdown 报告输出路径')
@click.option('--detailed', '-d', is_flag=True, help='显示详细信息')
def compare(
    proto_file: str,
    historical_proto: str,
    json_output: Optional[str] = None,
    markdown_output: Optional[str] = None,
    detailed: bool = False
):
    proto_file = os.path.abspath(proto_file)
    historical_proto = os.path.abspath(historical_proto)

    parser = ProtoParser()
    current = parser.parse(proto_file)
    historical = parser.parse(historical_proto)

    detector = RiskDetector()
    risks = detector.detect_risks(current, historical)

    result = CheckResult(
        proto_file=current,
        historical_file=historical,
        risks=risks
    )

    reporter = Reporter()
    click.echo(reporter.generate_terminal_summary(result, detailed))

    if json_output:
        reporter.generate_json_report(result, json_output)
        click.echo(f"已生成 JSON 报告: {os.path.abspath(json_output)}")

    if markdown_output:
        reporter.generate_markdown_report(result, markdown_output)
        click.echo(f"已生成 Markdown 报告: {os.path.abspath(markdown_output)}")


@main.command()
def list_risks():
    from .detector import RiskType, RiskLevel

    click.echo("支持的风险类型:")
    click.echo("")

    for risk_type in RiskType:
        level = RiskLevel.CRITICAL
        if risk_type == RiskType.RESERVED_MISSING_FOR_DELETED:
            level = RiskLevel.HIGH

        descriptions = {
            RiskType.FIELD_NUMBER_REUSE: "字段编号被复用，删除字段后未添加 reserved，导致新旧版本不兼容",
            RiskType.RESERVED_MISSING_FOR_DELETED: "字段已删除，但未添加 reserved 声明",
            RiskType.FIELD_IN_RESERVED_RANGE: "字段使用了已被 reserved 的编号",
            RiskType.DUPLICATE_FIELD_NUMBER: "同一消息中存在重复的字段编号",
            RiskType.RESERVED_NAME_CONFLICT: "字段名与已 reserved 的名称冲突"
        }

        click.echo(f"  {risk_type.value} ({level.value.upper()})")
        click.echo(f"    {descriptions.get(risk_type, '')}")
        click.echo("")


if __name__ == "__main__":
    main()
