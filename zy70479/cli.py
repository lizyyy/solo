#!/usr/bin/env python3
import click
import json
from tabulate import tabulate
from sql_checker.processor import CheckProcessor


@click.group()
@click.option('--db', default='sql_checker.db', help='数据库文件路径')
@click.pass_context
def cli(ctx, db):
    """SQL参数化检查命令行工具"""
    ctx.ensure_object(dict)
    ctx.obj['processor'] = CheckProcessor(db)


@cli.command()
@click.option('--output', '-o', help='输出样例数据文件路径')
@click.pass_context
def generate(ctx, output):
    """生成复核支付渠道回执样例数据（包含脏行被吞场景）"""
    processor = ctx.obj['processor']
    filepath = processor.generate_sample_data(output)
    click.echo(f"✓ 样例数据已生成: {filepath}")
    click.echo("  数据包含：")
    click.echo("    - 10条正确参数化的SQL记录")
    click.echo("    - 4条存在注入风险的SQL记录（字符串拼接、f-string、format、%格式化）")
    click.echo("    - 1条脏数据（SQL为空，金额异常）")
    click.echo("    - 1条会被吞掉的记录（业务单号为空）")


@cli.command()
@click.argument('filepath')
@click.option('--rule-version', help='指定规则版本，默认使用最新版本')
@click.pass_context
def check(ctx, filepath, rule_version):
    """执行SQL参数化检查"""
    processor = ctx.obj['processor']

    click.echo(f"开始处理文件: {filepath}")
    click.echo("=" * 60)

    batch_no, results = processor.process_file(filepath, rule_version)

    click.echo(f"\n批次号: {batch_no}")
    click.echo(f"处理统计: 总{results['total']}条 | "
               f"成功{results['success']} | "
               f"失败{results['fail']} | "
               f"跳过{results['skipped']} | "
               f"被吞{results['swallowed']}")
    click.echo("=" * 60)

    click.echo("\n详细结果:")
    for rec in results['records']:
        status_icon = "✓" if rec['status'] == 'success' else "✗"
        click.echo(f"\n{status_icon} [{rec['status'].upper()}] {rec['business_no']}")
        if rec['errors']:
            for err in rec['errors']:
                click.echo(f"   错误: {err}")
        if rec['corrections']:
            for corr in set(rec['corrections']):
                click.echo(f"   建议: {corr}")

    click.echo("\n" + "=" * 60)
    click.echo("批次摘要:")
    batch_data = processor.query_batch(batch_no)
    click.echo(batch_data['batch_info']['summary'])


@cli.command()
@click.option('--limit', '-n', default=20, help='显示最近N条批次')
@click.pass_context
def batches(ctx, limit):
    """列出所有处理批次"""
    processor = ctx.obj['processor']
    batches = processor.list_batches(limit)

    if not batches:
        click.echo("暂无批次记录")
        return

    headers = ["批次号", "状态", "总数", "成功", "失败", "规则版本", "创建时间"]
    rows = []
    for b in batches:
        rows.append([
            b['batch_no'],
            b['status'],
            b['total_count'],
            b['success_count'],
            b['fail_count'],
            b['rule_version'],
            b['created_at']
        ])

    click.echo(tabulate(rows, headers=headers, tablefmt="simple"))


@cli.command()
@click.argument('batch_no')
@click.option('--json', 'as_json', is_flag=True, help='以JSON格式输出')
@click.pass_context
def batch(ctx, batch_no, as_json):
    """查询批次详情"""
    processor = ctx.obj['processor']
    result = processor.query_batch(batch_no)

    if 'error' in result:
        click.echo(click.style(result['error'], fg='red'))
        return

    if as_json:
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
        return

    batch_info = result['batch_info']
    rule_info = result['rule_info']

    click.echo(f"批次号: {batch_info['batch_no']}")
    click.echo(f"状态: {batch_info['status']}")
    click.echo(f"规则版本: {rule_info['version']} - {rule_info['description']}")
    click.echo(f"统计: 总{batch_info['total_count']}条 | "
               f"成功{batch_info['success_count']} | "
               f"失败{batch_info['fail_count']}")
    click.echo(f"源文件: {batch_info['source_file']}")
    click.echo(f"创建时间: {batch_info['created_at']}")
    click.echo("=" * 60)
    click.echo("\n批次摘要:")
    click.echo(batch_info['summary'])


@cli.command()
@click.argument('business_no')
@click.pass_context
def business(ctx, business_no):
    """按业务单号查询历史记录"""
    processor = ctx.obj['processor']
    result = processor.query_business(business_no)

    if 'error' in result:
        click.echo(click.style(result['error'], fg='yellow'))
        return

    click.echo(f"业务单号: {business_no}")
    click.echo(f"历史处理记录数: {result['record_count']}")
    click.echo("=" * 60)

    for idx, rec in enumerate(result['history'], 1):
        click.echo(f"\n[{idx}] 批次: {rec['batch_id']} | 状态: {rec['status']}")
        if rec['errors']:
            errors = json.loads(rec['errors'])
            for err in errors:
                click.echo(f"    异常: {err}")
        if rec['corrections']:
            corrections = json.loads(rec['corrections'])
            for corr in set(corrections):
                click.echo(f"    修正: {corr}")
        if rec['conclusion']:
            click.echo(f"    结论: {rec['conclusion'].split(chr(10))[0]}")


@cli.command()
@click.pass_context
def rules(ctx):
    """列出所有规则版本"""
    processor = ctx.obj['processor']
    versions = processor.list_rule_versions()

    if not versions:
        click.echo("暂无规则版本")
        return

    headers = ["版本", "描述", "创建时间"]
    rows = [[v['version'], v['description'], v['created_at']] for v in versions]
    click.echo(tabulate(rows, headers=headers, tablefmt="simple"))


@cli.command()
def demo():
    """运行完整演示：生成样例数据 -> 执行检查 -> 查询结果"""
    import os

    click.echo(click.style("=== SQL参数化检查工具演示 ===", fg='cyan', bold=True))
    click.echo()

    processor = CheckProcessor()

    click.echo(click.style("步骤1: 生成复核支付渠道回执样例数据", fg='green'))
    filepath = processor.generate_sample_data()
    click.echo(f"✓ 样例数据已生成: {filepath}")
    click.echo()

    click.echo(click.style("步骤2: 执行SQL参数化检查", fg='green'))
    batch_no, results = processor.process_file(filepath)
    click.echo(f"✓ 批次处理完成: {batch_no}")
    click.echo()

    click.echo(click.style("步骤3: 显示批次摘要", fg='green'))
    batch_data = processor.query_batch(batch_no)
    click.echo(batch_data['batch_info']['summary'])
    click.echo()

    click.echo(click.style("步骤4: 演示失败路径查询 - 查找失败的业务单号", fg='green'))
    fail_records = [r for r in results['records'] if r['status'] == 'fail']
    if fail_records:
        first_fail = fail_records[0]
        click.echo(f"查询失败记录: {first_fail['business_no']}")
        biz_result = processor.query_business(first_fail['business_no'])
        if 'error' not in biz_result and biz_result['history']:
            last_rec = biz_result['history'][0]
            errors = json.loads(last_rec['errors'])
            click.echo(f"  异常详情: {errors[0] if errors else '无'}")
    click.echo()

    click.echo(click.style("步骤5: 演示重启后数据持久化验证", fg='green'))
    click.echo("  重新创建处理器实例（模拟重启）...")
    processor2 = CheckProcessor()
    batch_data2 = processor2.query_batch(batch_no)
    if 'error' not in batch_data2:
        click.echo(f"  ✓ 重启后成功查询到批次: {batch_data2['batch_info']['batch_no']}")
        click.echo(f"  ✓ 处理结论依然可用，规则版本为: {batch_data2['batch_info']['rule_version']}")
    click.echo()

    click.echo(click.style("=== 演示完成 ===", fg='cyan', bold=True))
    click.echo()
    click.echo("常用命令:")
    click.echo("  python cli.py generate          # 生成样例数据")
    click.echo("  python cli.py check <文件>      # 执行检查")
    click.echo("  python cli.py batches           # 查看所有批次")
    click.echo("  python cli.py batch <批次号>    # 查看批次详情")
    click.echo("  python cli.py business <单号>   # 查询业务单号历史")
    click.echo("  python cli.py rules             # 查看规则版本")


if __name__ == '__main__':
    cli()
