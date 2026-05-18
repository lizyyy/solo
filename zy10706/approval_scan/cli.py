import click
from pathlib import Path
import sys

from .parser import ApprovalParser
from .reporter import ReportGenerator


@click.group()
def main():
    """审批导出包加签超时扫描 CLI - 解析、校验、汇总、异常报告"""
    pass


@main.command()
@click.argument('input_paths', nargs=-1, type=click.Path(exists=True, path_type=Path))
@click.option('--output', '-o', type=click.Path(path_type=Path), default=Path('./output'),
              help='输出目录，默认 ./output')
@click.option('--timeout', '-t', type=int, default=72,
              help='超时阈值（小时），默认72小时')
@click.option('--force', '-f', is_flag=True,
              help='强制重新扫描，忽略已处理标记')
@click.option('--report-name', '-n', default=None,
              help='报告名称，默认自动生成带时间戳的名称')
def scan(input_paths, output, timeout, force, report_name):
    """扫描审批导出文件，检测超时节点、离职节点和异常情况"""
    if not input_paths:
        click.echo("错误: 请指定至少一个输入文件或目录")
        sys.exit(1)
    
    files = []
    for path in input_paths:
        if path.is_file():
            files.append(path)
        elif path.is_dir():
            files.extend(path.glob('*.txt'))
            files.extend(path.glob('*.tsv'))
    
    if not files:
        click.echo("错误: 未找到任何审批导出文件（.txt, .tsv）")
        sys.exit(1)
    
    reporter = ReportGenerator(output)
    
    if not force:
        unprocessed = reporter.filter_unprocessed_files(files)
        if len(unprocessed) < len(files):
            click.echo(f"发现 {len(files) - len(unprocessed)} 个已处理文件，将跳过")
        files = unprocessed
        if not files:
            click.echo("所有文件均已处理，使用 -f 参数强制重新扫描")
            return
    
    click.echo(f"开始扫描 {len(files)} 个文件...")
    
    parser = ApprovalParser(timeout_hours=timeout)
    result = parser.parse_files(files)
    
    click.echo(reporter.generate_text_summary(result))
    
    if files:
        report_path = reporter.generate_report(result, files, report_name)
        click.echo(f"\n报告已生成: {report_path}")
    else:
        click.echo("\n未扫描任何新文件，未生成报告")


@main.command()
@click.argument('sample_dir', type=click.Path(path_type=Path), default=Path('./samples'))
def create_samples(sample_dir):
    """创建样例文件，包括正常文件、坏行文件"""
    sample_dir.mkdir(parents=True, exist_ok=True)
    
    normal_content = """AP001	部门经理审批	张三	U002	2026-05-15 10:30:00	否
AP001	总监审批	李四	U003	2026-05-16 14:20:00	否
AP002	部门经理审批	王五	U004	2026-05-01 09:00:00	否
AP002	总监审批	赵六	U005	2026-05-02 11:00:00	是	孙七
AP003	部门经理审批	周八	U006	2026-05-10 08:00:00+08:00	否
AP003	总监审批	吴九	U007	2026-05-09 17:00:00	否
AP004	部门经理审批	郑十	U001	2026-05-14 16:00:00	否
"""
    
    normal_file = sample_dir / "正常审批记录.txt"
    with open(normal_file, 'w', encoding='utf-8') as f:
        f.write(normal_content)
    click.echo(f"已创建正常文件: {normal_file}")
    
    bad_content = """AP005	部门经理审批	用户A	U008	2026-05-15 10:30:00	否
这是一行坏数据，字段不足
AP006	总监审批	用户B	U009	这不是一个有效的时间	否
AP007	部门经理审批	用户C	U010		否
AP008	财务审批
"""
    
    bad_file = sample_dir / "包含坏行的审批记录.txt"
    with open(bad_file, 'w', encoding='utf-8') as f:
        f.write(bad_content)
    click.echo(f"已创建坏行文件: {bad_file}")
    
    click.echo(f"\n样例文件已创建在 {sample_dir}")
    click.echo("运行以下命令进行扫描测试:")
    click.echo(f"  approval-scan scan {sample_dir}")
    click.echo("重复运行以验证复跑稳定性（不会重复处理相同文件）")


@main.command()
@click.argument('sample_dir', type=click.Path(exists=True, path_type=Path), default=Path('./samples'))
@click.option('--output', '-o', type=click.Path(path_type=Path), default=Path('./output'))
def verify(sample_dir, output):
    """验证扫描功能：正常路径和异常路径验收测试"""
    click.echo("=" * 60)
    click.echo("  审批导出包加签超时扫描 - 验收测试")
    click.echo("=" * 60)
    click.echo("")
    
    import shutil
    if output.exists():
        shutil.rmtree(output)
    
    files = list(sample_dir.glob('*.txt'))
    
    click.echo("【第1轮扫描 - 首次处理】")
    parser = ApprovalParser(timeout_hours=72)
    result1 = parser.parse_files(files)
    
    reporter = ReportGenerator(output)
    summary1 = reporter.generate_text_summary(result1)
    click.echo(summary1)
    report_path1 = reporter.generate_report(result1, files, "验收测试_第1轮")
    click.echo(f"报告已生成: {report_path1}")
    click.echo("")
    
    click.echo("【第2轮扫描 - 重复运行验证】")
    unprocessed = reporter.filter_unprocessed_files(files)
    click.echo(f"待处理文件数: {len(unprocessed)} (预期: 0)")
    
    if len(unprocessed) == 0:
        click.echo("✓ 复跑稳定验证通过：所有文件均已标记为已处理")
    else:
        click.echo(f"✗ 复跑稳定验证失败：还有 {len(unprocessed)} 个文件待处理")
    
    click.echo("")
    click.echo("【业务规则验证】")
    
    has_timeout = any("超时" in r.status.value for r in result1.records)
    has_resigned = any("离职" in r.status.value for r in result1.records)
    has_proxy = any(r.is_proxy for r in result1.records)
    has_timezone = any("时区" in "".join(r.issues) for r in result1.records)
    has_rollback = any("回退" in "".join(r.issues) for r in result1.records)
    has_bad_lines = len(result1.bad_lines) > 0
    
    click.echo(f"超时节点检测: {'✓' if has_timeout else '✗'} (AP002 应为超时)")
    click.echo(f"离职节点检测: {'✓' if has_resigned else '✗'} (U001, U005 应为离职)")
    click.echo(f"代理审批检测: {'✓' if has_proxy else '✗'} (AP002 第2行应为代理)")
    click.echo(f"时区混乱检测: {'✓' if has_timezone else '✗'} (AP003 第1行含时区)")
    click.echo(f"节点回退检测: {'✓' if has_rollback else '✗'} (AP003 第2行时间回退)")
    click.echo(f"坏行记录检测: {'✓' if has_bad_lines else '✗'} (包含解析失败的行)")
    
    click.echo("")
    click.echo("【字段验证】")
    if result1.records:
        r = result1.records[0]
        click.echo(f"原始文件名: {'✓' if r.file_name else '✗'} = {r.file_name}")
        click.echo(f"行号: {'✓' if r.line_number else '✗'} = {r.line_number}")
        click.echo(f"审批编号: {'✓' if r.approval_id else '✗'} = {r.approval_id}")
        click.echo(f"节点名称: {'✓' if r.node_name else '✗'} = {r.node_name}")
        click.echo(f"审批人: {'✓' if r.approver else '✗'} = {r.approver}")
        click.echo(f"审批人ID: {'✓' if r.approver_id else '✗'} = {r.approver_id}")
        click.echo(f"操作时间: {'✓' if r.action_time else '✗'} = {r.action_time}")
        click.echo(f"原始时间字符串: {'✓' if r.raw_time_str else '✗'} = {r.raw_time_str}")
    
    click.echo("")
    click.echo("=" * 60)
    click.echo("  验收测试完成 - 这就是审批导出包加签超时扫描！")
    click.echo("=" * 60)


if __name__ == '__main__':
    main()
