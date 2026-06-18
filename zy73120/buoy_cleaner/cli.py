import os
import sys
import click
from datetime import datetime

from .cleaner import BuoyDataCleaner
from .models import CleanResult


def _print_header(title: str):
    click.echo("=" * 60)
    click.echo(f"  {title}")
    click.echo("=" * 60)


def _print_import_result(result: CleanResult):
    _print_header("数据导入完成")
    click.echo(f"总记录数: {result.total_records}")
    click.echo(f"有效记录: {result.valid_records}")
    click.echo(f"无效记录: {result.invalid_records}")
    click.echo(f"待确认记录: {len(result.pending_confirmation)}")
    click.echo(f"重复采样瓶组: {len(result.duplicate_groups)}")
    click.echo("")

    if result.duplicate_groups:
        _print_header("待确认重复记录")
        for idx, group in enumerate(result.duplicate_groups, 1):
            click.echo(f"\n【重复组 {idx}】采样瓶号: {group.sample_bottle_no}")
            click.echo(f"  原因: {group.reason}")
            click.echo(f"  受影响记录数: {group.affected_count}")
            for rec_idx, rec in enumerate(group.records, 1):
                click.echo(f"    记录 {rec_idx}: ID={rec.record_id}")
                click.echo(f"      原始纬度: {rec.latitude_raw}")
                click.echo(f"      原始经度: {rec.longitude_raw}")
                click.echo(f"      标准化纬度: {round(rec.latitude_std, 6) if rec.latitude_std else '无效'}")
                click.echo(f"      标准化经度: {round(rec.longitude_std, 6) if rec.longitude_std else '无效'}")
                click.echo(f"      采集时间: {rec.collect_time.strftime('%Y-%m-%d %H:%M:%S') if rec.collect_time else '未知'}")

    click.echo("")
    _print_header("筛选口径说明")
    for k, v in result.filter_criteria.items():
        click.echo(f"  {k}: {v}")


@click.group()
@click.option('--data-dir', default='./data', help='数据存储目录')
@click.pass_context
def cli(ctx, data_dir):
    """浮标海况数据清洗系统"""
    ctx.ensure_object(dict)
    ctx.obj['data_dir'] = data_dir
    ctx.obj['cleaner'] = BuoyDataCleaner(data_dir=data_dir)


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--source-name', default=None, help='数据来源名称')
@click.pass_context
def import_data(ctx, input_file, source_name):
    """导入并清洗数据

    INPUT_FILE: 输入数据文件路径 (.csv 或 .xlsx)
    """
    cleaner: BuoyDataCleaner = ctx.obj['cleaner']
    try:
        result = cleaner.import_data(input_file, source_name)
        cleaner._save_state()
        cleaner._save_audit_log()
        _print_import_result(result)

        click.echo("")
        click.echo("提示: 使用 'pending' 命令查看待确认记录")
        click.echo("提示: 使用 'confirm' 命令处理重复记录")
        click.echo("提示: 使用 'export' 命令导出清洗结果")
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.pass_context
def pending(ctx):
    """查看待确认记录列表"""
    cleaner: BuoyDataCleaner = ctx.obj['cleaner']
    pending_records = cleaner.get_pending_confirmation()

    if not pending_records:
        click.echo("当前没有待确认的记录")
        return

    _print_header(f"待确认记录 ({len(pending_records)} 条)")
    for idx, rec in enumerate(pending_records, 1):
        click.echo(f"\n【{idx}】记录ID: {rec.record_id}")
        click.echo(f"  采样瓶号: {rec.sample_bottle_no}")
        click.echo(f"  原始坐标: {rec.latitude_raw}, {rec.longitude_raw}")
        click.echo(f"  标准化坐标: {round(rec.latitude_std, 6) if rec.latitude_std else '无效'}, {round(rec.longitude_std, 6) if rec.longitude_std else '无效'}")
        click.echo(f"  采集时间: {rec.collect_time.strftime('%Y-%m-%d %H:%M:%S') if rec.collect_time else '未知'}")
        click.echo(f"  是否重复: {'是' if rec.is_duplicate else '否'}")
        if rec.duplicate_reason:
            click.echo(f"  重复原因: {rec.duplicate_reason}")
        if rec.confirmation_reason:
            click.echo(f"  待确认原因: {rec.confirmation_reason}")
        if rec.manual_note:
            click.echo(f"  人工备注: {rec.manual_note}")


@cli.command()
@click.argument('record_id')
@click.option('--operator', required=True, help='操作人姓名')
@click.option('--valid/--invalid', required=True, help='记录是否有效')
@click.option('--reason', required=True, help='确认原因说明')
@click.pass_context
def confirm(ctx, record_id, operator, valid, reason):
    """人工确认待处理记录

    RECORD_ID: 待确认的记录ID
    """
    cleaner: BuoyDataCleaner = ctx.obj['cleaner']
    rec = cleaner.confirm_duplicate(record_id, operator, valid, reason)

    if rec:
        click.echo(f"记录 {record_id} 已确认")
        click.echo(f"  判定结果: {'有效记录' if valid else '无效重复'}")
        click.echo(f"  操作人: {operator}")
        click.echo(f"  原因: {reason}")
    else:
        click.echo(f"未找到记录ID: {record_id}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('output_file')
@click.option('--include-pending', is_flag=True, default=False, help='是否包含待确认记录')
@click.option('--filter-note', default='', help='附加筛选说明')
@click.pass_context
def export(ctx, output_file, include_pending, filter_note):
    """导出清洗后的数据

    OUTPUT_FILE: 输出文件路径 (.csv 或 .xlsx)
    """
    cleaner: BuoyDataCleaner = ctx.obj['cleaner']

    filter_criteria = {
        '导出时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        '包含待确认': '是' if include_pending else '否',
        '数据目录': ctx.obj['data_dir'],
    }
    if filter_note:
        filter_criteria['附加说明'] = filter_note

    try:
        output_path, count = cleaner.export_data(output_file, filter_criteria, include_pending)
        click.echo(f"导出成功: {output_path}")
        click.echo(f"导出记录数: {count}")
        if output_file.endswith('.xlsx'):
            click.echo("Excel文件包含: 清洗结果、筛选口径说明、变更审计日志 三个工作表")
    except Exception as e:
        click.echo(f"导出失败: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.pass_context
def status(ctx):
    """查看系统当前状态"""
    cleaner: BuoyDataCleaner = ctx.obj['cleaner']
    cleaner._load_existing_records()
    cleaner._load_audit_log()

    _print_header("系统状态")
    click.echo(f"数据目录: {ctx.obj['data_dir']}")
    click.echo(f"总记录数: {len(cleaner.records)}")
    click.echo(f"待确认记录: {len([r for r in cleaner.records if r.needs_confirmation])}")
    click.echo(f"已确认记录: {len([r for r in cleaner.records if r.is_confirmed])}")
    click.echo(f"重复记录: {len([r for r in cleaner.records if r.is_duplicate])}")
    click.echo(f"审计日志条目: {len(cleaner.audit_log)}")

    pending = cleaner.get_pending_confirmation()
    if pending:
        click.echo(f"\n待确认记录摘要:")
        for rec in pending[:5]:
            click.echo(f"  - {rec.record_id} ({rec.sample_bottle_no})")
        if len(pending) > 5:
            click.echo(f"  ... 还有 {len(pending) - 5} 条待确认记录")


@cli.command()
@click.option('--yes', is_flag=True, default=False, help='不提示直接确认重置')
@click.pass_context
def reset(ctx, yes):
    """重置所有数据（清空状态和审计日志）"""
    data_dir = ctx.obj['data_dir']

    if not yes:
        click.echo("警告: 这将删除所有已清洗的数据和审计日志！")
        click.confirm("确定要重置吗?", abort=True)

    state_file = os.path.join(data_dir, "state", "cleaned_records.json")
    audit_file = os.path.join(data_dir, "audit", "audit_log.json")

    if os.path.exists(state_file):
        os.remove(state_file)
        click.echo("已删除状态文件")

    if os.path.exists(audit_file):
        os.remove(audit_file)
        click.echo("已删除审计日志")

    click.echo("重置完成")


@cli.command()
def demo():
    """一键演示完整流程（导入-查看-确认-导出）"""
    import subprocess
    import sys

    py = sys.executable
    demo_commands = [
        [py, "-m", "buoy_cleaner.cli", "reset", "--yes"],
        [py, "-m", "buoy_cleaner.cli", "import-data", "data/input/浮标海况数据_20260618.csv"],
        [py, "-m", "buoy_cleaner.cli", "status"],
    ]

    _print_header("浮标海况数据清洗 - 完整演示")

    for cmd in demo_commands:
        click.echo(f"\n>>> 执行: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.getcwd())
        if result.stdout:
            click.echo(result.stdout)
        if result.stderr:
            click.echo(result.stderr, err=True)
        if result.returncode != 0:
            click.echo(f"命令执行失败，返回码: {result.returncode}", err=True)
            break

    click.echo("\n" + "=" * 60)
    click.echo("  演示结束")
    click.echo("=" * 60)
    click.echo("\n下一步操作建议:")
    click.echo(f"  1. 运行 '{py} run_demo.py pending' 查看待确认记录")
    click.echo(f"  2. 运行 '{py} run_demo.py confirm <记录ID> --operator 小宋 --valid --reason 经核实有效' 确认记录")
    click.echo(f"  3. 运行 '{py} run_demo.py export data/output/清洗结果.xlsx' 导出结果")


def main():
    cli(obj={})


if __name__ == '__main__':
    main()
