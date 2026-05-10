import click
import json
from decimal import Decimal
from .services import RecalculationService, DepreciationService
from .storage import storage


def format_result(result: dict, indent: int = 2) -> str:
    if result.get('success'):
        status = '✓ 成功'
    else:
        status = '✗ 失败'
    
    if result.get('is_idempotent'):
        status += '（幂等性保护）'
    
    output = f"\n{'='*60}"
    output += f"\n{status}"
    output += f"\n业务说明：{result.get('message', '')}"
    output += f"\n{'='*60}"
    
    if result.get('data'):
        data = result['data']
        if isinstance(data, dict):
            output += "\n详细数据："
            for key, value in data.items():
                if key in ['differences', 'audit_logs', 'versions']:
                    continue
                output += f"\n  {key}: {value}"
        else:
            output += f"\n详细数据：{data}"
    
    output += f"\n{'='*60}\n"
    return output


@click.group()
def cli():
    """固定资产折旧重算服务 - 业务命令行工具"""
    pass


@click.command('setup-demo')
def setup_demo():
    """设置演示数据（成本中心、折旧规则）"""
    result = RecalculationService.setup_demo_data()
    click.echo(format_result(result))


@click.command('init-asset')
@click.option('--code', required=True, help='资产编码')
@click.option('--name', required=True, help='资产名称')
@click.option('--value', required=True, help='原值')
@click.option('--rule', required=True, help='折旧规则编码')
@click.option('--cost-center', required=True, help='成本中心编码')
@click.option('--purchase-date', required=True, help='购入日期（YYYY-MM-DD）')
@click.option('--start-month', required=True, help='开始折旧月份（YYYY-MM）')
def init_asset(code, name, value, rule, cost_center, purchase_date, start_month):
    """初始化资产卡片"""
    result = RecalculationService.initialize_asset(
        asset_code=code,
        asset_name=name,
        original_value=Decimal(value),
        rule_code=rule,
        cost_center_code=cost_center,
        purchase_date=purchase_date,
        start_depreciation_month=start_month
    )
    click.echo(format_result(result))


@click.command('generate-depreciation')
@click.option('--asset-code', required=True, help='资产编码')
@click.option('--start', required=True, help='开始期间（YYYY-MM）')
@click.option('--end', required=True, help='结束期间（YYYY-MM）')
def generate_depreciation(asset_code, start, end):
    """生成原始折旧记录"""
    result = RecalculationService.create_depreciation_records(
        asset_code=asset_code,
        start_period=start,
        end_period=end
    )
    click.echo(format_result(result))


@click.command('recalculate')
@click.option('--asset-code', required=True, help='资产编码')
@click.option('--effective-period', required=True, help='重算生效期间（YYYY-MM）')
@click.option('--new-rule', default=None, help='新折旧规则编码（可选）')
@click.option('--new-cost-center', default=None, help='新成本中心编码（可选）')
@click.option('--operator', default='system', help='操作人')
@click.option('--reason', default='', help='重算原因')
def recalculate(asset_code, effective_period, new_rule, new_cost_center, operator, reason):
    """执行折旧重算（资产类别或成本中心调整后）"""
    result = RecalculationService.recalculate_depreciation(
        asset_code=asset_code,
        effective_period=effective_period,
        new_rule_code=new_rule,
        new_cost_center=new_cost_center,
        operator=operator,
        reason=reason
    )
    click.echo(format_result(result))


@click.command('version-details')
@click.option('--version-id', required=True, help='重算版本号')
@click.option('--show-diffs', is_flag=True, help='显示差异明细')
@click.option('--show-audit', is_flag=True, help='显示审计日志')
def version_details(version_id, show_diffs, show_audit):
    """查看重算版本详情"""
    result = RecalculationService.get_version_details(version_id)
    
    if not result.get('success'):
        click.echo(format_result(result))
        return
    
    data = result['data']
    version = data['version']
    summary = data['summary']
    
    output = f"\n{'='*70}"
    output += f"\n✓ 重算版本详情"
    output += f"\n{'='*70}"
    output += f"\n版本号：{version['version_id']}"
    output += f"\n资产：{data['asset']['asset_name']}（{data['asset']['asset_code']}）"
    output += f"\n状态：{version['status']}"
    output += f"\n变更类型：{version['change_type']}"
    output += f"\n生效期间：{version['effective_period']}"
    output += f"\n创建人：{version['created_by']}"
    output += f"\n创建时间：{version['created_at']}"
    if version.get('completed_at'):
        output += f"\n完成时间：{version['completed_at']}"
    
    output += f"\n\n--- 变更内容 ---"
    if summary['has_rule_change']:
        output += f"\n折旧规则：{version['old_depreciation_rule_code']} → {version['new_depreciation_rule_code']}"
    if summary['has_cost_center_change']:
        output += f"\n成本中心：{version['old_cost_center_code']} → {version['new_cost_center_code']}"
    
    output += f"\n\n--- 重算摘要 ---"
    output += f"\n重算期间数：{summary['total_periods']}"
    output += f"\n总差异金额：{summary['total_difference']} 元"
    
    if show_diffs and data['differences']:
        output += f"\n\n--- 差异明细（{len(data['differences'])}条）---"
        for diff in data['differences']:
            output += f"\n  期间：{diff['period']}"
            output += f"\n    原折旧：{diff['original_depreciation']} 元"
            output += f"\n    新折旧：{diff['new_depreciation']} 元"
            output += f"\n    差异：{diff['difference_amount']} 元"
            output += f"\n    原成本中心：{diff['original_cost_center']}"
            output += f"\n    新成本中心：{diff['new_cost_center']}"
            output += f"\n    差异原因：{diff['explanation']}"
            output += "\n"
    
    if show_audit and data['audit_logs']:
        output += f"\n--- 审计日志（{len(data['audit_logs'])}条）---"
        for log in data['audit_logs']:
            output += f"\n  [{log['operation_time']}] {log['action']} - {log['operator']}"
            output += f"\n    业务说明：{log['business_description']}"
    
    output += f"\n{'='*70}\n"
    click.echo(output)


@click.command('audit-trail')
@click.option('--asset-code', required=True, help='资产编码')
@click.option('--show-logs', is_flag=True, help='显示所有审计日志')
@click.option('--show-versions', is_flag=True, help='显示所有重算版本')
def audit_trail(asset_code, show_logs, show_versions):
    """查看资产审计轨迹"""
    result = RecalculationService.get_audit_trail(asset_code)
    
    if not result.get('success'):
        click.echo(format_result(result))
        return
    
    data = result['data']
    asset = data['asset']
    summary = data['summary']
    
    output = f"\n{'='*70}"
    output += f"\n✓ 资产审计轨迹"
    output += f"\n{'='*70}"
    output += f"\n资产名称：{asset['asset_name']}"
    output += f"\n资产编码：{asset['asset_code']}"
    output += f"\n原值：{asset['original_value']} 元"
    output += f"\n累计折旧：{asset['accumulated_depreciation']} 元"
    output += f"\n净值：{asset['net_value']} 元"
    output += f"\n当前折旧规则：{asset['depreciation_rule_code']}"
    output += f"\n当前成本中心：{asset['cost_center_code']}"
    output += f"\n\n--- 审计摘要 ---"
    output += f"\n总操作次数：{summary['total_operations']}"
    output += f"\n重算总次数：{summary['total_recalculations']}"
    output += f"\n成功重算次数：{summary['successful_recalculations']}"
    
    if show_versions and data['versions']:
        output += f"\n\n--- 重算版本历史（{len(data['versions'])}条）---"
        for v in data['versions']:
            status_emoji = '✓' if v['status'] == 'completed' else '○' if v['status'] == 'processing' else '✗'
            output += f"\n  {status_emoji} [{v['created_at']}] {v['version_id']}"
            output += f"\n    变更：{v['change_type']}，生效期间：{v['effective_period']}"
            output += f"\n    状态：{v['status']}"
    
    if show_logs and data['audit_logs']:
        output += f"\n\n--- 审计日志明细（{len(data['audit_logs'])}条）---"
        for log in data['audit_logs']:
            output += f"\n  [{log['operation_time']}] {log['action']}"
            output += f"\n    操作人：{log['operator']}"
            output += f"\n    业务说明：{log['business_description']}"
            if log.get('version_id'):
                output += f"\n    关联版本：{log['version_id']}"
            output += "\n"
    
    if asset.get('cost_center_history'):
        output += f"\n--- 成本中心历史轨迹 ---"
        for idx, history in enumerate(asset['cost_center_history']):
            period = f"{history['effective_from']} 至 {history.get('effective_to') or '至今'}"
            current = '（当前）' if history.get('is_current') else ''
            output += f"\n  {idx+1}. {history['cost_center_code']} {current}"
            output += f"\n     生效期间：{period}"
    
    output += f"\n{'='*70}\n"
    click.echo(output)


@click.command('run-demo')
def run_demo():
    """运行完整演示流程"""
    click.echo("="*70)
    click.echo("固定资产折旧重算服务 - 完整演示")
    click.echo("="*70)
    
    click.echo("\n[1/6] 设置演示数据...")
    result = RecalculationService.setup_demo_data()
    click.echo(f"    → {result['message']}")
    
    click.echo("\n[2/6] 初始化资产卡片...")
    result = RecalculationService.initialize_asset(
        asset_code='ASSET001',
        asset_name='生产设备-数控机床',
        original_value=Decimal('120000.00'),
        rule_code='RULE001',
        cost_center_code='CC001',
        purchase_date='2023-01-15',
        start_depreciation_month='2023-02'
    )
    click.echo(f"    → {result['message']}")
    
    click.echo("\n[3/6] 生成12个月原始折旧记录...")
    result = RecalculationService.create_depreciation_records(
        asset_code='ASSET001',
        start_period='2023-02',
        end_period='2024-01'
    )
    click.echo(f"    → {result['message']}")
    
    click.echo("\n[4/6] 执行折旧重算（折旧规则+成本中心变更）...")
    result = RecalculationService.recalculate_depreciation(
        asset_code='ASSET001',
        effective_period='2023-08',
        new_rule_code='RULE002',
        new_cost_center='CC002',
        operator='张三',
        reason='资产类别调整：从电子设备调整为机器设备，同时调拨至生产二部'
    )
    click.echo(f"    → {result['message']}")
    
    version_id = result['data']['version_id']
    
    click.echo("\n[5/6] 查看重算版本详情...")
    result = RecalculationService.get_version_details(version_id)
    if result['success']:
        summary = result['data']['summary']
        differences = result['data']['differences']
        click.echo(f"    → 重算期间数：{summary['total_periods']}")
        click.echo(f"    → 总差异金额：{summary['total_difference']} 元")
        if differences:
            first_diff = differences[0]
            click.echo(f"    → 首条差异：{first_diff['period']}，差异 {first_diff['difference_amount']} 元，原因：{first_diff['explanation'][:50]}...")
    
    click.echo("\n[6/6] 查看资产审计轨迹...")
    result = RecalculationService.get_audit_trail('ASSET001')
    if result['success']:
        summary = result['data']['summary']
        click.echo(f"    → 总操作次数：{summary['total_operations']}")
        click.echo(f"    → 重算次数：{summary['successful_recalculations']}")
    
    click.echo("\n" + "="*70)
    click.echo("演示完成！")
    click.echo("="*70)
    click.echo(f"\n关键数据：")
    click.echo(f"  - 资产编码：ASSET001")
    click.echo(f"  - 重算版本号：{version_id}")
    click.echo(f"\n您可以使用以下命令进一步查看：")
    click.echo(f"  - python -m depreciation_service.cli version-details --version-id {version_id} --show-diffs --show-audit")
    click.echo(f"  - python -m depreciation_service.cli audit-trail --asset-code ASSET001 --show-logs --show-versions")


cli.add_command(setup_demo)
cli.add_command(init_asset)
cli.add_command(generate_depreciation)
cli.add_command(recalculate)
cli.add_command(version_details)
cli.add_command(audit_trail)
cli.add_command(run_demo)


if __name__ == '__main__':
    cli()
