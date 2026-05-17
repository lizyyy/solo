import click
import sys
import os
from .yaml_parser import parse_files
from .port_mapper import PortMapper
from .reporter import Reporter


@click.group()
def cli():
    """K8s 服务端口映射检查工具"""
    pass


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@click.option('--output', '-o', default='./reports', help='报告输出目录')
@click.option('--json/--no-json', default=True, help='是否生成JSON报告')
@click.option('--markdown/--no-markdown', default=True, help='是否生成Markdown报告')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，不输出终端摘要')
def check(files, output, json, markdown, quiet):
    """检查K8s YAML文件中的端口映射问题"""
    if not files:
        click.echo("错误: 请指定至少一个YAML文件")
        sys.exit(1)

    try:
        parse_result = parse_files(list(files))

        mapper = PortMapper()
        mapping_result = mapper.analyze(parse_result)

        reporter = Reporter(output_dir=output)
        reports = reporter.generate_all(parse_result, mapping_result)

        if not quiet:
            click.echo(reports["terminal"])
            click.echo("")
            click.echo("报告已生成:")
            if json:
                click.echo(f"  - JSON: {reports['json']}")
            if markdown:
                click.echo(f"  - Markdown: {reports['markdown']}")

        errors = [g for g in mapping_result.gaps if g.severity == 'ERROR']
        if errors:
            sys.exit(2)

    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        click.echo("请检查输入文件格式是否正确", err=True)
        sys.exit(1)


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
def parse(files):
    """仅解析YAML文件，显示资源信息"""
    parse_result = parse_files(list(files))

    click.echo(f"解析结果:")
    click.echo(f"  资源: {len(parse_result.resources)} 个")
    click.echo(f"  坏行: {len(parse_result.bad_lines)} 行")
    click.echo(f"  错误: {len(parse_result.errors)} 个")

    for r in parse_result.resources:
        click.echo(f"  - {r.kind}: {r.name} ({r.file_path}:{r.line_start})")

    if parse_result.bad_lines:
        click.echo("\n坏行详情:")
        for bl in parse_result.bad_lines:
            click.echo(f"  L{bl.line_number}: {bl.content[:60]}...")


def main():
    cli()


if __name__ == '__main__':
    main()
