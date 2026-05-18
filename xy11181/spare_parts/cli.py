import os
import sys
import click

from .processor import PartProcessor


def print_separator(char="=", length=60):
    click.echo(char * length)


def print_result_summary(result):
    print_separator()
    click.echo("📊 处理结果汇总")
    print_separator()
    click.echo(f"  总备件数: {result.total_parts}")
    click.echo(f"  需采购备件: {result.parts_needing_purchase}")
    click.echo(f"  含替代件: {result.parts_with_alternatives}")
    click.echo(f"  含最小包装量: {result.parts_with_min_package}")
    print_separator()

    if result.warnings:
        click.echo("⚠️  警告:")
        for w in result.warnings:
            click.echo(f"  - {w}")

    if result.errors:
        click.echo("❌ 错误:")
        for e in result.errors:
            click.echo(f"  - {e}")
    print_separator()


def print_issues_section(title, issue_type, suggestions):
    parts_with_issue = [s for s in suggestions if any(i.issue_type == issue_type for i in s.issues)]
    if not parts_with_issue:
        return

    click.echo(f"\n{title}")
    print_separator("-")
    for sug in parts_with_issue:
        click.echo(f"  [{sug.part_code}] {sug.part_name}")
        for issue in sug.issues:
            if issue.issue_type == issue_type:
                click.echo(f"    → {issue.description}")


@click.group()
@click.version_option(version="1.0.0", prog_name="维修备件小库采购建议工具")
def cli():
    """维修备件小库备件采购建议 CLI

    处理重点: 替代件、最小包装量、可复跑输出
    """
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=False))
@click.option('--output-dir', '-o', default='./output', help='输出目录')
@click.option('--config', '-c', type=click.Path(exists=True), help='自定义规则配置文件')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，只输出错误')
def process(input_file, output_dir, config, quiet):
    """处理备件采购建议

    INPUT_FILE: 输入CSV文件路径
    """
    if not quiet:
        click.echo("🔧 维修备件小库备件采购建议处理中...")
        click.echo(f"   输入文件: {input_file}")

    processor = PartProcessor(config_path=config)
    result = processor.process_file(input_file)

    if not quiet:
        print_result_summary(result)

    if result.suggestions and not result.errors:
        output_path = processor.generate_output(output_dir)
        if not quiet:
            click.echo(f"✅ 输出文件: {output_path}")

            print_issues_section("🔄 替代件清单", "替代件提示", result.suggestions)
            print_issues_section("📦 最小包装量处理", "包装取整", result.suggestions)
            print_issues_section("⚠️  大包装警告", "大包装警告", result.suggestions)

    exit_code = processor.get_exit_code()
    sys.exit(exit_code)


@cli.command()
@click.option('--output-dir', '-o', default='./sample_data', help='样例输出目录')
def sample(output_dir):
    """生成业务样例数据"""
    os.makedirs(output_dir, exist_ok=True)

    import csv
    sample_file = os.path.join(output_dir, "维修备件采购样例.csv")

    with open(sample_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            '备件编码', '备件名称', '数量', '单位', '最小库存',
            '当前库存', '供应商', '单价', '最小包装量', '替代件'
        ])
        writer.writerow(['BJ-001', '轴承6205', 50, '个', 30, 12, '轴承供应商A', 25.5, 10, 'BJ-002'])
        writer.writerow(['BJ-002', '轴承6205-2RS', 30, '个', 30, 45, '轴承供应商B', 28.0, 5, ''])
        writer.writerow(['BJ-003', '油封30*50*10', 100, '个', 50, 8, '密封件厂', 3.5, 20, 'BJ-004'])
        writer.writerow(['BJ-004', '油封32*52*10', 50, '个', 50, 60, '密封件厂', 4.0, 20, ''])
        writer.writerow(['BJ-005', 'O型圈φ20', 200, '个', 100, 150, '密封件厂', 0.5, 100, ''])
        writer.writerow(['BJ-006', '液压油46#', 20, '桶', 10, 3, '油品供应商', 350.0, 4, ''])
        writer.writerow(['BJ-007', '滤清器滤芯', 80, '个', 40, 15, '过滤器材厂', 45.0, 1, ''])
        writer.writerow(['BJ-008', '三角带A型', 100, '条', 50, 22, '传动件厂', 8.5, 10, ''])

    click.echo(f"✅ 样例数据已生成: {sample_file}")
    click.echo("\n💡 使用方法:")
    click.echo(f"   spare-parts process {sample_file}")
    sys.exit(0)


@cli.command()
def rules():
    """显示当前业务规则配置"""
    processor = PartProcessor()
    config = processor.config

    print_separator()
    click.echo("📋 维修备件小库备件采购规则")
    print_separator()

    click.echo("\n默认口径说明:")
    for key, value in config.get('默认口径说明', {}).items():
        click.echo(f"  {value}")

    click.echo("\n最小包装量规则:")
    for key, value in config.get('最小包装量规则', {}).items():
        click.echo(f"  {key}: {value}")

    click.echo("\n替代件规则:")
    for key, value in config.get('替代件规则', {}).items():
        click.echo(f"  {key}: {value}")

    click.echo("\n输出配置:")
    for key, value in config.get('输出配置', {}).items():
        click.echo(f"  {key}: {value}")

    click.echo("\n退出码说明:")
    click.echo("  0: 成功")
    click.echo("  1: 通用错误")
    click.echo("  2: 输入文件不存在")
    click.echo("  3: 数据格式错误")
    click.echo("  4: 配置错误")
    click.echo("  5: 输出错误")
    click.echo("  6: 验证错误")

    sys.exit(0)


if __name__ == '__main__':
    cli()
