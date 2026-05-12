import click
import json
import sys
from pathlib import Path
from typing import Optional

from storage import Storage
from importer import DataImporter
from rules import CleaningEngine
from reporter import Reporter


def get_storage(data_dir: str = "./data") -> Storage:
    return Storage(data_dir)


def get_importer(storage: Storage) -> DataImporter:
    return DataImporter(storage)


def get_engine(storage: Storage) -> CleaningEngine:
    return CleaningEngine(storage)


def get_reporter(storage: Storage) -> Reporter:
    return Reporter(storage)


@click.group()
@click.option('--data-dir', default='./data', help='数据存储目录')
@click.pass_context
def cli(ctx, data_dir: str):
    """客服外呼名单清洗 CLI"""
    ctx.ensure_object(dict)
    ctx.obj['data_dir'] = data_dir


@cli.command()
@click.option('--with-examples', is_flag=True, help='同时导入内置样例数据')
@click.pass_context
def init(ctx, with_examples: bool):
    """初始化工作目录和数据库"""
    click.echo("=" * 60)
    click.echo("初始化客服外呼名单清洗系统")
    click.echo("=" * 60)
    
    data_dir = ctx.obj['data_dir']
    storage = get_storage(data_dir)
    
    click.echo(f"数据目录: {Path(data_dir).absolute()}")
    click.echo(f"数据库路径: {storage.db_path}")
    
    if with_examples:
        click.echo("")
        click.echo("正在导入内置样例数据...")
        importer = get_importer(storage)
        results = importer.import_all_examples("./examples")
        
        total_leads = 0
        for r in results['leads']:
            total_leads += r.get('imported', 0)
        
        click.echo(f"  销售/售后/续费线索: {total_leads} 条")
        click.echo(f"  黑名单: {results['blacklist'].get('imported', 0)} 条")
        click.echo(f"  外呼历史: {results['call_history'].get('imported', 0)} 条")
        click.echo(f"  预约回拨: {results['callbacks'].get('imported', 0)} 条")
        click.echo(f"  时区规则: {results['timezone_rules'].get('imported', 0)} 条")
        click.echo(f"  合规规则: {results['compliance_rules'].get('imported', 0)} 条")
    
    click.echo("")
    click.echo("✓ 初始化完成")
    click.echo("")
    click.echo("下一步:")
    click.echo("  1. python cli.py import --help   查看导入选项")
    click.echo("  2. python cli.py check            执行名单清洗")
    click.echo("  3. python cli.py report           生成清洗报告")


@cli.group()
@click.pass_context
def import_cmd(ctx):
    """导入数据"""
    pass


@import_cmd.command(name='leads')
@click.argument('file_path', type=click.Path(exists=True))
@click.pass_context
def import_leads(ctx, file_path: str):
    """导入线索数据"""
    storage = get_storage(ctx.obj['data_dir'])
    importer = get_importer(storage)
    
    click.echo(f"导入线索文件: {file_path}")
    result = importer.import_leads_from_file(file_path)
    
    if not result.get('success'):
        click.echo(f"✗ 失败: {result.get('error')}")
        sys.exit(1)
    
    if 'message' in result:
        click.echo(f"ℹ {result['message']}")
    else:
        click.echo(f"✓ 成功: 新增 {result['imported']} 条，更新 {result['updated']} 条")
        if result.get('errors'):
            click.echo(f"  错误: {len(result['errors'])} 条")
            for err in result['errors']:
                click.echo(f"    - {err}")


@import_cmd.command(name='blacklist')
@click.argument('file_path', type=click.Path(exists=True))
@click.pass_context
def import_blacklist(ctx, file_path: str):
    """导入黑名单"""
    storage = get_storage(ctx.obj['data_dir'])
    importer = get_importer(storage)
    
    click.echo(f"导入黑名单文件: {file_path}")
    result = importer.import_blacklist_from_file(file_path)
    
    if not result.get('success'):
        click.echo(f"✗ 失败: {result.get('error')}")
        sys.exit(1)
    
    if 'message' in result:
        click.echo(f"ℹ {result['message']}")
    else:
        click.echo(f"✓ 成功: 新增 {result['imported']} 条")
        if result.get('errors'):
            click.echo(f"  错误: {len(result['errors'])} 条")


@import_cmd.command(name='history')
@click.argument('file_path', type=click.Path(exists=True))
@click.pass_context
def import_history(ctx, file_path: str):
    """导入外呼历史"""
    storage = get_storage(ctx.obj['data_dir'])
    importer = get_importer(storage)
    
    click.echo(f"导入外呼历史: {file_path}")
    result = importer.import_call_history_from_file(file_path)
    
    if not result.get('success'):
        click.echo(f"✗ 失败: {result.get('error')}")
        sys.exit(1)
    
    if 'message' in result:
        click.echo(f"ℹ {result['message']}")
    else:
        click.echo(f"✓ 成功: 新增 {result['imported']} 条")


@import_cmd.command(name='callbacks')
@click.argument('file_path', type=click.Path(exists=True))
@click.pass_context
def import_callbacks(ctx, file_path: str):
    """导入预约回拨"""
    storage = get_storage(ctx.obj['data_dir'])
    importer = get_importer(storage)
    
    click.echo(f"导入预约回拨: {file_path}")
    result = importer.import_callbacks_from_file(file_path)
    
    if not result.get('success'):
        click.echo(f"✗ 失败: {result.get('error')}")
        sys.exit(1)
    
    if 'message' in result:
        click.echo(f"ℹ {result['message']}")
    else:
        click.echo(f"✓ 成功: 新增 {result['imported']} 条")


@import_cmd.command(name='rules')
@click.argument('rules_file', type=click.Path(exists=True))
@click.option('--type', type=click.Choice(['timezone', 'compliance']), required=True)
@click.pass_context
def import_rules(ctx, rules_file: str, type: str):
    """导入规则"""
    storage = get_storage(ctx.obj['data_dir'])
    importer = get_importer(storage)
    
    if type == 'timezone':
        result = importer.import_timezone_rules_from_file(rules_file)
        name = "时区规则"
    else:
        result = importer.import_compliance_rules_from_file(rules_file)
        name = "合规规则"
    
    click.echo(f"导入{name}: {rules_file}")
    
    if not result.get('success'):
        click.echo(f"✗ 失败: {result.get('error')}")
        sys.exit(1)
    
    if 'message' in result:
        click.echo(f"ℹ {result['message']}")
    else:
        click.echo(f"✓ 成功: 新增 {result['imported']} 条")


@import_cmd.command(name='examples')
@click.pass_context
def import_examples(ctx):
    """导入所有内置样例数据"""
    storage = get_storage(ctx.obj['data_dir'])
    importer = get_importer(storage)
    
    click.echo("导入所有内置样例数据...")
    results = importer.import_all_examples("./examples")
    
    total_leads = 0
    for r in results['leads']:
        total_leads += r.get('imported', 0)
    
    click.echo(f"  线索: {total_leads} 条 (销售+售后+续费)")
    click.echo(f"  黑名单: {results['blacklist'].get('imported', 0)} 条")
    click.echo(f"  外呼历史: {results['call_history'].get('imported', 0)} 条")
    click.echo(f"  预约回拨: {results['callbacks'].get('imported', 0)} 条")
    click.echo(f"  时区规则: {results['timezone_rules'].get('imported', 0)} 条")
    click.echo(f"  合规规则: {results['compliance_rules'].get('imported', 0)} 条")
    click.echo("✓ 导入完成")


@cli.command()
@click.option('--lead-id', help='仅检查指定线索ID')
@click.pass_context
def check(ctx, lead_id: Optional[str]):
    """执行名单清洗检查"""
    click.echo("=" * 60)
    click.echo("执行名单清洗检查")
    click.echo("=" * 60)
    
    storage = get_storage(ctx.obj['data_dir'])
    engine = get_engine(storage)
    
    if lead_id:
        lead = storage.get_lead(lead_id)
        if not lead:
            click.echo(f"✗ 线索不存在: {lead_id}")
            sys.exit(1)
        
        result = engine.clean_single(lead)
        click.echo(f"")
        click.echo(f"线索: {result['name']} ({result['phone']})")
        click.echo(f"状态: {result['status']}")
        if result.get('block_reason'):
            click.echo(f"禁呼原因: {result['block_reason']}")
        click.echo(f"")
        click.echo("检查详情:")
        for detail in result['details']:
            click.echo(f"  {detail}")
    else:
        result = engine.clean_all()
        
        click.echo(f"")
        click.echo(f"总线索数: {result['total']}")
        click.echo(f"可拨打: {len(result['callable'])} 条")
        click.echo(f"暂缓: {len(result['deferred'])} 条")
        click.echo(f"禁呼: {len(result['blocked'])} 条")
        click.echo("")
        
        if result['callable']:
            click.echo("可拨打名单:")
            for item in result['callable']:
                callback_note = ""
                if item.get('callback_info'):
                    callback_note = " [预约回拨优先级]"
                click.echo(f"  {item['lead_id']} | {item['phone']} | {item['name']} | {item['type']}{callback_note}")
        
        if result['deferred']:
            click.echo("")
            click.echo("暂缓名单:")
            for item in result['deferred']:
                click.echo(f"  {item['lead_id']} | {item['phone']} | {item['name']} | 原因: {item['block_reason']}")
        
        if result['blocked']:
            click.echo("")
            click.echo("禁呼名单:")
            for item in result['blocked']:
                click.echo(f"  {item['lead_id']} | {item['phone']} | {item['name']} | 原因: {item['block_reason']}")
    
    click.echo("")
    click.echo("✓ 检查完成")


@cli.command()
@click.argument('lead_id')
@click.option('--json-output', 'json_output', is_flag=True, help='以JSON格式输出')
@click.pass_context
def detail(ctx, lead_id: str, json_output: bool):
    """查看线索详情和操作历史"""
    storage = get_storage(ctx.obj['data_dir'])
    reporter = get_reporter(storage)
    
    detail_data = reporter.get_lead_detail(lead_id)
    
    if not detail_data.get('success'):
        click.echo(f"✗ {detail_data.get('error')}")
        sys.exit(1)
    
    if json_output:
        click.echo(json.dumps(detail_data, ensure_ascii=False, indent=2))
        return
    
    lead = detail_data['lead']
    click.echo("=" * 60)
    click.echo(f"线索详情: {lead_id}")
    click.echo("=" * 60)
    click.echo(f"姓名: {lead['name']}")
    click.echo(f"电话: {lead['phone']}")
    click.echo(f"类型: {lead['type']}")
    click.echo(f"地区: {lead['region']}")
    click.echo(f"时区: {lead['timezone']}")
    click.echo(f"状态: {lead['status']}")
    if lead.get('block_reason'):
        click.echo(f"禁呼原因: {lead['block_reason']}")
    if lead.get('manual_release_reason'):
        click.echo(f"人工放行原因: {lead['manual_release_reason']}")
    click.echo(f"来源文件: {lead['source_file']}")
    
    if detail_data.get('operation_logs'):
        click.echo("")
        click.echo("操作历史:")
        for i, log in enumerate(detail_data['operation_logs'], 1):
            click.echo(f"  [{i}] {log['timestamp']}")
            click.echo(f"      操作者: {log['operator']}")
            click.echo(f"      操作: {log['operation_type']}")
            click.echo(f"      状态变更: {log['previous_state']} -> {log['new_state']}")
            if log.get('reason'):
                click.echo(f"      原因: {log['reason']}")
    
    if detail_data.get('active_callbacks'):
        click.echo("")
        click.echo("活跃预约回拨:")
        for cb in detail_data['active_callbacks']:
            click.echo(f"  - 预约时间: {cb['scheduled_time']}")
            click.echo(f"    原因: {cb['reason']}")
            click.echo(f"    创建人: {cb['created_by']}")
    
    if detail_data.get('call_history'):
        click.echo("")
        click.echo("外呼历史:")
        for h in detail_data['call_history']:
            click.echo(f"  - {h['call_time']} | {h['result']} | {h['agent']}")
            if h.get('notes'):
                click.echo(f"    备注: {h['notes']}")
    
    if detail_data.get('blacklist_entry'):
        click.echo("")
        click.echo("黑名单记录:")
        bl = detail_data['blacklist_entry']
        click.echo(f"  原因: {bl['reason']}")
        click.echo(f"  来源: {bl['source']}")
        click.echo(f"  创建时间: {bl['created_at']}")


@cli.command()
@click.option('--output-dir', default='./reports', help='报告输出目录')
@click.option('--json-output', 'json_output', is_flag=True, help='以JSON格式输出概要')
@click.pass_context
def report(ctx, output_dir: str, json_output: bool):
    """生成清洗报告"""
    storage = get_storage(ctx.obj['data_dir'])
    reporter = get_reporter(storage)
    
    click.echo("=" * 60)
    click.echo("外呼名单清洗报告")
    click.echo("=" * 60)
    
    result = reporter.generate_report(output_dir)
    summary = result['summary']
    
    if json_output:
        click.echo(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        click.echo(reporter.print_summary(summary))
    
    callable_leads = reporter.get_callable_leads()
    deferred_leads = reporter.get_deferred_leads()
    blocked_leads = reporter.get_blocked_leads()
    
    if callable_leads:
        click.echo("")
        click.echo("-" * 60)
        click.echo("【可拨打名单】")
        click.echo("-" * 60)
        for l in callable_leads:
            note = ""
            if l.get('manual_release_reason'):
                note = f" [人工放行: {l['manual_release_reason']}]"
            click.echo(f"  {l['lead_id']} | {l['phone']} | {l['name']} | {l['type']}{note}")
    
    if deferred_leads:
        click.echo("")
        click.echo("-" * 60)
        click.echo("【暂缓名单】")
        click.echo("-" * 60)
        for l in deferred_leads:
            click.echo(f"  {l['lead_id']} | {l['phone']} | {l['name']} | 原因: {l['block_reason']}")
    
    if blocked_leads:
        click.echo("")
        click.echo("-" * 60)
        click.echo("【禁呼名单】")
        click.echo("-" * 60)
        for l in blocked_leads:
            click.echo(f"  {l['lead_id']} | {l['phone']} | {l['name']} | 原因: {l['block_reason']}")
    
    click.echo("")
    click.echo(f"✓ 报告已生成: {result['report_file']}")


@cli.command()
@click.argument('lead_id')
@click.argument('reason')
@click.option('--operator', default='manual', help='操作者标识')
@click.pass_context
def release(ctx, lead_id: str, reason: str, operator: str):
    """人工放行一个被禁呼的线索"""
    storage = get_storage(ctx.obj['data_dir'])
    engine = get_engine(storage)
    
    click.echo(f"人工放行线索: {lead_id}")
    click.echo(f"操作者: {operator}")
    click.echo(f"放行原因: {reason}")
    click.echo("")
    
    result = engine.manual_release(lead_id, operator, reason)
    
    if not result.get('success'):
        click.echo(f"✗ {result.get('error')}")
        sys.exit(1)
    
    click.echo(f"✓ 成功放行")
    click.echo(f"  号码: {result['phone']}")
    click.echo(f"  原状态: {result['previous_status']}")
    if result.get('previous_block_reason'):
        click.echo(f"  原禁呼原因: {result['previous_block_reason']}")
    click.echo(f"  新状态: {result['new_status']}")
    click.echo("")
    click.echo("ℹ 操作已记录到审计日志，可通过 detail 命令查看")


@cli.command()
@click.option('--yes', is_flag=True, help='直接清除，不确认')
@click.pass_context
def reset(ctx, yes: bool):
    """清除所有数据（重置）"""
    if not yes:
        click.confirm("确定要清除所有数据吗？此操作不可恢复！", abort=True)
    
    storage = get_storage(ctx.obj['data_dir'])
    storage.clear_all()
    click.echo("✓ 所有数据已清除")


if __name__ == '__main__':
    cli(obj={})
