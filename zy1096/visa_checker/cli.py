import os
import sys
from datetime import date
from pathlib import Path
from typing import List, Optional

import click

from .models import RiskLevel, ValidationResult
from .parser import parse_applicants, parse_itinerary, parse_rules, ParserError
from .matcher import scan_materials
from .validator import validate_all
from .reporter import generate_report
from .exporter import preview_renames, execute_renames, export_materials


def get_default_paths() -> dict:
    cwd = os.getcwd()
    return {
        'applicants': os.path.join(cwd, 'applicants.csv'),
        'itinerary': os.path.join(cwd, 'itinerary.csv'),
        'rules': os.path.join(cwd, 'rules.json'),
        'materials': os.path.join(cwd, 'materials'),
        'output': os.path.join(cwd, 'output'),
    }


def print_risk_summary(result: ValidationResult):
    click.echo("\n" + "=" * 60)
    click.echo("风险等级汇总")
    click.echo("=" * 60)
    
    risk_counts = {
        RiskLevel.CRITICAL: 0,
        RiskLevel.HIGH: 0,
        RiskLevel.MEDIUM: 0,
        RiskLevel.LOW: 0,
        RiskLevel.OK: 0,
    }
    
    for applicant in result.applicants:
        risk_counts[applicant.risk_level] += 1
    
    risk_order = [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.OK]
    risk_names = {
        RiskLevel.CRITICAL: ('严重', 'red'),
        RiskLevel.HIGH: ('高', 'yellow'),
        RiskLevel.MEDIUM: ('中', 'yellow'),
        RiskLevel.LOW: ('低', 'blue'),
        RiskLevel.OK: ('正常', 'green'),
    }
    
    for risk in risk_order:
        name, color = risk_names[risk]
        count = risk_counts[risk]
        if count > 0 or risk == RiskLevel.OK:
            click.echo(f"  [{name}] {count} 人")
    
    click.echo(f"\n  总问题数: {result.total_issues}")
    if result.has_critical_issues:
        click.secho("  ⚠️ 存在严重问题！", fg='red', bold=True)


def print_applicant_status(result: ValidationResult):
    click.echo("\n" + "=" * 60)
    click.echo("申请人状态详情")
    click.echo("=" * 60)
    
    for applicant in result.applicants:
        risk_color = {
            RiskLevel.CRITICAL: 'red',
            RiskLevel.HIGH: 'yellow',
            RiskLevel.MEDIUM: 'yellow',
            RiskLevel.LOW: 'blue',
            RiskLevel.OK: 'green',
        }[applicant.risk_level]
        
        risk_name = {
            RiskLevel.CRITICAL: '严重',
            RiskLevel.HIGH: '高',
            RiskLevel.MEDIUM: '中',
            RiskLevel.LOW: '低',
            RiskLevel.OK: '正常',
        }[applicant.risk_level]
        
        click.echo(f"\n  [{applicant.applicant_id}] {applicant.name}")
        click.secho(f"    风险等级: {risk_name}", fg=risk_color)
        click.echo(f"    护照有效期: {applicant.passport_expiry_date}")
        click.echo(f"    材料数量: {len(applicant.materials)}")
        click.echo(f"    问题数量: {len(applicant.issues)}")
        
        if applicant.missing_docs:
            click.echo("    ⚠️  缺少材料:")
            for doc in applicant.missing_docs:
                click.echo(f"      - {doc}")
        
        if applicant.issues:
            click.echo("    问题列表:")
            for issue in applicant.issues:
                issue_color = {
                    RiskLevel.CRITICAL: 'red',
                    RiskLevel.HIGH: 'yellow',
                    RiskLevel.MEDIUM: 'yellow',
                    RiskLevel.LOW: 'blue',
                    RiskLevel.OK: 'green',
                }[issue.severity]
                click.secho(f"      [{issue.severity.value.upper()}] {issue.message}", fg=issue_color)
                if issue.evidence:
                    click.echo(f"         证据: {issue.evidence}")
    
    if result.unmatched_materials:
        click.echo("\n" + "-" * 60)
        click.echo("无法匹配的文件:")
        for m in result.unmatched_materials:
            click.echo(f"  - {m.filename}")
    
    if result.global_issues:
        click.echo("\n" + "-" * 60)
        click.echo("全局问题:")
        for issue in result.global_issues:
            issue_color = {
                RiskLevel.CRITICAL: 'red',
                RiskLevel.HIGH: 'yellow',
                RiskLevel.MEDIUM: 'yellow',
                RiskLevel.LOW: 'blue',
                RiskLevel.OK: 'green',
            }[issue.severity]
            click.secho(f"  [{issue.severity.value.upper()}] {issue.message}", fg=issue_color)
            if issue.evidence:
                click.echo(f"     证据: {issue.evidence}")


def run_validation(
    applicants_path: str,
    itinerary_path: str,
    rules_path: str,
    materials_path: str,
    today: Optional[date] = None
) -> ValidationResult:
    if today is None:
        today = date.today()
    
    click.echo(f"📋 签证材料核对工具")
    click.echo(f"   核对日期: {today}")
    click.echo("")
    
    try:
        click.echo(f"🔍 读取申请人数据: {applicants_path}")
        applicants, applicant_issues = parse_applicants(applicants_path)
        click.echo(f"   找到 {len(applicants)} 位申请人")
    except ParserError as e:
        click.secho(f"❌ 错误: {e}", fg='red')
        sys.exit(1)
    
    try:
        click.echo(f"🔍 读取行程数据: {itinerary_path}")
        itineraries, itinerary_issues = parse_itinerary(itinerary_path)
        click.echo(f"   找到 {len(itineraries)} 份行程")
    except ParserError as e:
        click.secho(f"⚠️  警告: {e}", fg='yellow')
        itineraries = {}
        itinerary_issues = []
    
    try:
        click.echo(f"🔍 读取规则配置: {rules_path}")
        rules, rules_issues = parse_rules(rules_path)
        click.echo(f"   必检材料: {', '.join(rules.required_documents)}")
    except Exception as e:
        click.secho(f"⚠️  警告: {e}", fg='yellow')
        rules = type(rules).default()
        rules_issues = []
    
    try:
        click.echo(f"🔍 扫描材料目录: {materials_path}")
        materials, material_issues = scan_materials(materials_path)
        click.echo(f"   找到 {len(materials)} 个材料文件")
    except Exception as e:
        click.secho(f"❌ 错误: {e}", fg='red')
        sys.exit(1)
    
    click.echo("")
    click.echo("⚙️  执行校验...")
    
    result = validate_all(applicants, itineraries, materials, rules, today)
    
    result.global_issues.extend(applicant_issues)
    result.global_issues.extend(itinerary_issues)
    result.global_issues.extend(rules_issues)
    result.global_issues.extend(material_issues)
    
    return result


@click.group()
@click.version_option(version='1.0.0')
def main():
    """签证材料核对工具 - 本地运行，无需联网"""
    pass


@main.command()
@click.option('--applicants', '-a', help='申请人 CSV 文件路径')
@click.option('--itinerary', '-i', help='行程 CSV 文件路径')
@click.option('--rules', '-r', help='规则 JSON 文件路径')
@click.option('--materials', '-m', help='材料目录路径')
@click.option('--date', '-d', 'check_date', help='核对日期 (YYYY-MM-DD，默认今天)')
@click.option('--output', '-o', help='输出目录路径')
@click.option('--format', '-f', multiple=True, default=['json', 'md', 'html'],
              type=click.Choice(['json', 'md', 'markdown', 'html']),
              help='报告格式 (可多次指定)')
def check(applicants, itinerary, rules, materials, check_date, output, format):
    """核对材料并生成报告"""
    paths = get_default_paths()
    
    applicants_path = applicants or paths['applicants']
    itinerary_path = itinerary or paths['itinerary']
    rules_path = rules or paths['rules']
    materials_path = materials or paths['materials']
    output_dir = output or paths['output']
    
    today = date.today()
    if check_date:
        from .utils import parse_date as parse_date_util
        parsed, error = parse_date_util(check_date)
        if error:
            click.secho(f"❌ 日期格式错误: {error}", fg='red')
            sys.exit(1)
        today = parsed
    
    result = run_validation(applicants_path, itinerary_path, rules_path, materials_path, today)
    
    print_risk_summary(result)
    print_applicant_status(result)
    
    click.echo("")
    click.echo("📄 生成报告...")
    
    formats_list = list(format)
    report_paths = generate_report(result, output_dir, formats_list, today)
    
    click.echo(f"   报告已生成到: {output_dir}")
    for fmt, path in report_paths.items():
        click.echo(f"   - {fmt.upper()}: {os.path.relpath(path)}")
    
    if result.has_critical_issues:
        click.secho("\n⚠️  存在严重问题，请先解决后再打包导出。", fg='yellow')
        sys.exit(2)


@main.command('dry-run')
@click.option('--applicants', '-a', help='申请人 CSV 文件路径')
@click.option('--itinerary', '-i', help='行程 CSV 文件路径')
@click.option('--rules', '-r', help='规则 JSON 文件路径')
@click.option('--materials', '-m', help='材料目录路径')
@click.option('--date', '-d', 'check_date', help='核对日期 (YYYY-MM-DD)')
def dry_run(applicants, itinerary, rules, materials, check_date):
    """预览重命名建议和核对结果（不实际修改文件）"""
    paths = get_default_paths()
    
    applicants_path = applicants or paths['applicants']
    itinerary_path = itinerary or paths['itinerary']
    rules_path = rules or paths['rules']
    materials_path = materials or paths['materials']
    
    today = date.today()
    if check_date:
        from .utils import parse_date as parse_date_util
        parsed, error = parse_date_util(check_date)
        if error:
            click.secho(f"❌ 日期格式错误: {error}", fg='red')
            sys.exit(1)
        today = parsed
    
    result = run_validation(applicants_path, itinerary_path, rules_path, materials_path, today)
    
    print_risk_summary(result)
    print_applicant_status(result)
    
    renames = preview_renames(result)
    if renames:
        click.echo("\n" + "=" * 60)
        click.echo("文件重命名建议 (dry-run)")
        click.echo("=" * 60)
        
        for rename in renames:
            click.echo(f"\n  [{rename['applicant_id']}] {rename['applicant_name']}")
            click.echo(f"    原文件名: {rename['original']}")
            click.secho(f"    建议改为: {rename['target']}", fg='cyan')
        
        click.echo(f"\n  共 {len(renames)} 个文件建议重命名")
        click.echo("  运行 'visa-checker rename' 执行重命名")
    else:
        click.echo("\n✅ 所有文件命名规范，无需重命名")


@main.command()
@click.option('--applicants', '-a', help='申请人 CSV 文件路径')
@click.option('--itinerary', '-i', help='行程 CSV 文件路径')
@click.option('--rules', '-r', help='规则 JSON 文件路径')
@click.option('--materials', '-m', help='材料目录路径')
@click.option('--date', '-d', 'check_date', help='核对日期 (YYYY-MM-DD)')
@click.option('--yes', '-y', is_flag=True, help='直接执行，不确认')
def rename(applicants, itinerary, rules, materials, check_date, yes):
    """执行文件重命名（会修改原始文件）"""
    paths = get_default_paths()
    
    applicants_path = applicants or paths['applicants']
    itinerary_path = itinerary or paths['itinerary']
    rules_path = rules or paths['rules']
    materials_path = materials or paths['materials']
    
    today = date.today()
    if check_date:
        from .utils import parse_date as parse_date_util
        parsed, error = parse_date_util(check_date)
        if error:
            click.secho(f"❌ 日期格式错误: {error}", fg='red')
            sys.exit(1)
        today = parsed
    
    result = run_validation(applicants_path, itinerary_path, rules_path, materials_path, today)
    
    renames = preview_renames(result)
    if not renames:
        click.echo("✅ 所有文件命名规范，无需重命名")
        return
    
    click.echo(f"\n将重命名 {len(renames)} 个文件:")
    for rename in renames[:5]:
        click.echo(f"  {rename['original']} -> {rename['target']}")
    if len(renames) > 5:
        click.echo(f"  ... 还有 {len(renames) - 5} 个文件")
    
    if not yes:
        confirm = click.confirm("\n确认执行重命名？这将修改原始文件", default=False)
        if not confirm:
            click.echo("已取消")
            return
    
    executed, skipped = execute_renames(result, dry_run=False)
    
    click.echo(f"\n✅ 已执行 {len(executed)} 个重命名")
    if skipped:
        click.echo(f"⚠️  跳过 {len(skipped)} 个文件")
        for s in skipped:
            click.echo(f"  - {s['original']}: {s['reason']}")


@main.command()
@click.option('--applicants', '-a', help='申请人 CSV 文件路径')
@click.option('--itinerary', '-i', help='行程 CSV 文件路径')
@click.option('--rules', '-r', help='规则 JSON 文件路径')
@click.option('--materials', '-m', help='材料目录路径')
@click.option('--date', '-d', 'check_date', help='核对日期 (YYYY-MM-DD)')
@click.option('--output', '-o', help='输出目录/文件路径')
@click.option('--format', '-f', default='folder',
              type=click.Choice(['folder', 'zip']),
              help='导出格式')
@click.option('--skip-report', is_flag=True, help='不生成报告')
@click.option('--yes', '-y', is_flag=True, help='直接执行，忽略警告')
def package(applicants, itinerary, rules, materials, check_date, output, format, skip_report, yes):
    """打包导出材料包"""
    paths = get_default_paths()
    
    applicants_path = applicants or paths['applicants']
    itinerary_path = itinerary or paths['itinerary']
    rules_path = rules or paths['rules']
    materials_path = materials or paths['materials']
    output_dir = output or paths['output']
    
    today = date.today()
    if check_date:
        from .utils import parse_date as parse_date_util
        parsed, error = parse_date_util(check_date)
        if error:
            click.secho(f"❌ 日期格式错误: {error}", fg='red')
            sys.exit(1)
        today = parsed
    
    result = run_validation(applicants_path, itinerary_path, rules_path, materials_path, today)
    
    print_risk_summary(result)
    
    if result.has_critical_issues and not yes:
        click.secho("\n⚠️  存在严重问题！", fg='red')
        confirm = click.confirm("是否继续打包？建议先解决严重问题", default=False)
        if not confirm:
            click.echo("已取消")
            sys.exit(1)
    
    report_paths = None
    if not skip_report:
        click.echo("\n📄 生成报告...")
        report_paths = generate_report(result, output_dir, ['json', 'md', 'html'], today)
        click.echo(f"   报告已生成到: {output_dir}")
    
    click.echo(f"\n📦 打包导出材料 (格式: {format})...")
    
    if format == 'zip':
        output_path = os.path.join(output_dir, f"visa_package_{today.strftime('%Y%m%d')}")
    else:
        output_path = os.path.join(output_dir, f"visa_package_{today.strftime('%Y%m%d')}")
    
    export_result = export_materials(result, output_path, format, report_paths)
    
    click.echo(f"\n✅ 打包完成！")
    click.echo(f"   输出路径: {export_result['output_path']}")
    click.echo(f"   申请人数: {export_result['total_applicants']}")
    if format == 'folder':
        click.echo(f"   文件数量: {export_result['files_copied']}")


if __name__ == '__main__':
    main()
