import click
import sys
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .core import CertificateInspector
from .output import OutputFormatter
from .models import RiskType

console = Console()


@click.group()
@click.option('--data-dir', default='data', help='数据存储目录')
@click.pass_context
def cli(ctx, data_dir):
    """证书过期巡检工具"""
    ctx.ensure_object(dict)
    ctx.obj['inspector'] = CertificateInspector(data_dir=data_dir)


@cli.command()
@click.argument('cert_file', type=click.Path(exists=True))
@click.option('--partition-file', '-p', type=click.Path(exists=True), help='分区清单文件')
@click.option('--inspector', '-i', default='system', help='巡检人')
@click.option('--format', '-f', type=click.Choice(['json', 'markdown', 'console']), default='console', help='输出格式')
@click.option('--output', '-o', help='输出文件路径')
@click.pass_context
def inspect(ctx, cert_file, partition_file, inspector, format, output):
    """执行证书过期巡检"""
    inspector_obj = ctx.obj['inspector']
    
    certificates = inspector_obj.load_certificates(cert_file)
    partitions = None
    
    if partition_file:
        partitions = inspector_obj.load_partitions(partition_file)
    
    result = inspector_obj.inspect_certificates(certificates, partitions, inspector)
    result_dict = result.model_dump(mode="json")
    
    if format == 'console':
        _print_result_console(result_dict)
    elif format == 'json':
        json_output = OutputFormatter.to_json(result_dict)
        if output:
            OutputFormatter.save_json(result_dict, output)
            console.print(f"[green]结果已保存到: {output}[/green]")
        else:
            console.print(json_output)
    elif format == 'markdown':
        md_output = OutputFormatter.to_markdown(result_dict)
        if output:
            OutputFormatter.save_markdown(result_dict, output)
            console.print(f"[green]结果已保存到: {output}[/green]")
        else:
            console.print(md_output)


def _print_result_console(result: dict):
    console.print(Panel.fit(
        f"[bold blue]证书过期巡检报告[/bold blue]\n"
        f"巡检批次: {result['batch_id']}\n"
        f"巡检人: {result['inspector']}\n"
        f"巡检时间: {result['inspection_time']}\n"
        f"证书总数: {result['total_certs']}\n"
        f"[red]已过期: {result['expired_count']}[/red] | "
        f"[yellow]即将过期: {result['expiring_soon_count']}[/yellow]"
    ))

    batch_conflicts = result.get('batch_conflicts', [])
    if batch_conflicts:
        console.print("\n[bold red]批次号冲突:[/bold red]")
        for conflict in batch_conflicts:
            console.print(f"  - {conflict['batch_no']}: {conflict['conflict_count']} 个分区冲突")

    risk_details = result.get('risk_details', [])
    if risk_details:
        table = Table(title="风险证书详情")
        table.add_column("证书ID")
        table.add_column("证书类型")
        table.add_column("持有人")
        table.add_column("到期日期")
        table.add_column("剩余天数")
        table.add_column("风险类型")
        
        for risk in risk_details:
            days = risk['days_until_expiry']
            style = "red" if days < 0 else "yellow"
            table.add_row(
                risk['cert_id'],
                risk['cert_type'],
                risk['holder'],
                risk['expiry_date'],
                f"[{style}]{days}[/{style}]",
                risk['risk_type']
            )
        console.print(table)


@cli.command()
@click.option('--batch-id', '-b', help='按批次ID过滤')
@click.option('--operator', '-o', help='按操作者过滤')
@click.option('--risk-type', '-r', type=click.Choice([t.value for t in RiskType]), help='按风险类型过滤')
@click.option('--format', '-f', type=click.Choice(['json', 'console']), default='console', help='输出格式')
@click.pass_context
def history(ctx, batch_id, operator, risk_type, format):
    """查询巡检历史记录"""
    inspector_obj = ctx.obj['inspector']
    
    risk_enum = RiskType(risk_type) if risk_type else None
    records = inspector_obj.get_history(batch_id, operator, risk_enum)
    
    if not records:
        console.print("[yellow]未找到匹配的记录[/yellow]")
        return
    
    if format == 'json':
        console.print(OutputFormatter.to_json(records))
    else:
        console.print(f"[green]找到 {len(records)} 条记录:[/green]")
        for record in records:
            console.print(f"\n  批次: {record['batch_id']}")
            console.print(f"  巡检人: {record['inspector']}")
            console.print(f"  时间: {record['inspection_time']}")
            console.print(f"  证书总数: {record['total_certs']}, 已过期: {record['expired_count']}, 即将过期: {record['expiring_soon_count']}")


@cli.command()
@click.argument('cert_id')
@click.option('--original-risk', required=True, type=click.Choice([t.value for t in RiskType]), help='原始风险类型')
@click.option('--corrected-risk', required=True, type=click.Choice([t.value for t in RiskType]), help='修正后风险类型')
@click.option('--operator', required=True, help='操作者')
@click.option('--remark', required=True, help='修正备注')
@click.option('--batch-id', required=True, help='所属巡检批次ID')
@click.pass_context
def correct(ctx, cert_id, original_risk, corrected_risk, operator, remark, batch_id):
    """添加人工修正备注"""
    inspector_obj = ctx.obj['inspector']
    
    correction = inspector_obj.add_manual_correction(
        cert_id=cert_id,
        original_risk=RiskType(original_risk),
        corrected_risk=RiskType(corrected_risk),
        operator=operator,
        remark=remark,
        batch_id=batch_id
    )
    
    console.print(f"[green]人工修正已添加:[/green] {correction.correction_id}")
    console.print(f"  证书: {cert_id}")
    console.print(f"  原始风险: {original_risk} -> 修正后: {corrected_risk}")
    console.print(f"  备注: {remark}")


@cli.command('list-corrections')
@click.option('--cert-id', help='按证书ID过滤')
@click.pass_context
def list_corrections(ctx, cert_id):
    """查看人工修正记录"""
    inspector_obj = ctx.obj['inspector']
    corrections = inspector_obj.get_manual_corrections(cert_id)
    
    if not corrections:
        console.print("[yellow]未找到修正记录[/yellow]")
        return
    
    table = Table(title="人工修正记录")
    table.add_column("修正ID")
    table.add_column("证书ID")
    table.add_column("原始风险")
    table.add_column("修正后")
    table.add_column("操作者")
    table.add_column("备注")
    
    for corr in corrections:
        table.add_row(
            corr['correction_id'],
            corr['cert_id'],
            corr['original_risk'],
            corr['corrected_risk'],
            corr['operator'],
            corr['remark']
        )
    console.print(table)


@cli.command('trace-redemption')
@click.argument('environment')
@click.option('--redemption-file', '-f', type=click.Path(exists=True), help='发票红冲记录文件')
@click.option('--format', '-F', type=click.Choice(['json', 'markdown', 'console']), default='console', help='输出格式')
@click.option('--output', '-o', help='输出文件路径')
@click.pass_context
def trace_redemption(ctx, environment, redemption_file, format, output):
    """按环境追溯发票红冲记录"""
    inspector_obj = ctx.obj['inspector']
    
    records = inspector_obj.find_redemption_by_environment(environment, redemption_file)
    
    if not records:
        console.print(f"[yellow]在环境 {environment} 中未找到发票红冲记录[/yellow]")
        return
    
    if format == 'json':
        records_dict = [r.model_dump(mode="json") for r in records]
        if output:
            OutputFormatter.save_json({"records": records_dict}, output)
            console.print(f"[green]结果已保存到: {output}[/green]")
        else:
            console.print(OutputFormatter.to_json({"records": records_dict}))
    elif format == 'markdown':
        md_output = OutputFormatter.redemption_to_markdown(records)
        if output:
            Path(output).parent.mkdir(parents=True, exist_ok=True)
            Path(output).write_text(md_output, encoding='utf-8')
            console.print(f"[green]结果已保存到: {output}[/green]")
        else:
            console.print(md_output)
    else:
        console.print(f"[green]在环境 {environment} 中找到 {len(records)} 条红冲记录:[/green]")
        for record in records:
            console.print(f"\n  记录ID: {record.record_id}")
            console.print(f"  发票号码: {record.invoice_no}")
            console.print(f"  红冲金额: {record.amount:,.2f}")
            console.print(f"  操作人: {record.operator}")
            console.print(f"  部门: {record.department}")


@cli.command()
def demo():
    """运行完整演示"""
    from .core import CertificateInspector as CI
    import tempfile
    
    console.print("[bold blue]=== 证书过期巡检工具演示 ===[/bold blue]\n")
    
    inspector = CI(data_dir=tempfile.mkdtemp())
    
    console.print("[green]1. 加载样例数据...[/green]")
    cert_file = Path(__file__).parent.parent / "sample_data" / "certificates_sample.json"
    partition_normal = Path(__file__).parent.parent / "sample_data" / "lake_partitions_normal.json"
    partition_conflict = Path(__file__).parent.parent / "sample_data" / "lake_partitions_with_conflicts.json"
    
    certificates = inspector.load_certificates(str(cert_file))
    partitions_normal = inspector.load_partitions(str(partition_normal))
    partitions_conflict = inspector.load_partitions(str(partition_conflict))
    
    console.print(f"  - 证书数量: {len(certificates)}")
    console.print(f"  - 正常分区数量: {len(partitions_normal)}")
    console.print(f"  - 含冲突分区数量: {len(partitions_conflict)}")
    
    console.print("\n[green]2. 执行正常巡检（无批次冲突）...[/green]")
    result_normal = inspector.inspect_certificates(certificates, partitions_normal, "demo-user")
    console.print(f"  - 批次ID: {result_normal.batch_id}")
    console.print(f"  - 已过期: {result_normal.expired_count}, 即将过期: {result_normal.expiring_soon_count}")
    console.print(f"  - 批次冲突: {len(result_normal.batch_conflicts)}")
    
    console.print("\n[green]3. 执行含冲突数据的巡检...[/green]")
    result_conflict = inspector.inspect_certificates(certificates, partitions_conflict, "demo-user")
    console.print(f"  - 批次ID: {result_conflict.batch_id}")
    console.print(f"  - 已过期: {result_conflict.expired_count}, 即将过期: {result_conflict.expiring_soon_count}")
    console.print(f"  - 批次冲突: {len(result_conflict.batch_conflicts)}")
    for c in result_conflict.batch_conflicts:
        console.print(f"    - {c['batch_no']}: {c['conflict_count']} 个分区")
    
    console.print("\n[green]4. 添加人工修正...[/green]")
    correction = inspector.add_manual_correction(
        cert_id="CERT-FIN-003",
        original_risk=RiskType.EXPIRED,
        corrected_risk=RiskType.NORMAL,
        operator="审核员张三",
        remark="该证书已完成续期审批，系统数据尚未同步",
        batch_id=result_conflict.batch_id
    )
    console.print(f"  - 修正ID: {correction.correction_id}")
    
    console.print("\n[green]5. 查询历史记录...[/green]")
    history_records = inspector.get_history()
    console.print(f"  - 历史记录数: {len(history_records)}")
    
    console.print("\n[green]6. 按风险类型过滤查询...[/green]")
    expired_records = inspector.get_history(risk_type=RiskType.EXPIRED)
    console.print(f"  - 含已过期风险的记录数: {len(expired_records)}")
    
    console.print("\n[green]7. 追溯发票红冲记录...[/green]")
    redemption_file = Path(__file__).parent.parent / "sample_data" / "invoice_redemption_records.json"
    redemption_records = inspector.find_redemption_by_environment("UAT环境", str(redemption_file))
    console.print(f"  - UAT环境红冲记录数: {len(redemption_records)}")
    
    console.print("\n[bold green]=== 演示完成 ===[/bold green]")
    console.print("完整功能命令:")
    console.print("  python -m cert_inspector inspect --help")
    console.print("  python -m cert_inspector history --help")
    console.print("  python -m cert_inspector correct --help")
    console.print("  python -m cert_inspector trace-redemption --help")


if __name__ == '__main__':
    cli()
