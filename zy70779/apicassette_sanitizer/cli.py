import click
import os
import sys
from typing import Optional

from .rules_engine import RulesEngine
from .cassette_parser import CassetteParser
from .report_exporter import ReportExporter, ReChecker


@click.group()
@click.version_option(version="1.0.0", prog_name="apicassette-sanitizer")
def cli():
    """APIcassette 脱敏排查 CLI - 清除 HTTP 录制文件中的敏感数据"""
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=True, readable=True))
@click.option('--output', '-o', type=click.Path(writable=True), help='输出脱敏后的 cassette 文件')
@click.option('--json-report', type=click.Path(writable=True), help='输出机器可读 JSON 报告')
@click.option('--human-report', type=click.Path(writable=True), help='输出人读文本报告')
@click.option('--rules', '-r', type=click.Path(exists=True), help='自定义规则文件 (JSON/YAML)')
@click.option('--no-recheck', is_flag=True, help='跳过脱敏后复检')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，不输出控制台摘要')
def sanitize(input_file, output, json_report, human_report, rules, no_recheck, quiet):
    """扫描并脱敏 cassette 文件中的敏感数据"""
    try:
        custom_rules = None
        if rules:
            import json as _json
            import yaml as _yaml
            _, ext = os.path.splitext(rules)
            with open(rules, 'r', encoding='utf-8') as f:
                if ext.lower() == '.json':
                    custom_rules = _json.load(f)
                else:
                    custom_rules = _yaml.safe_load(f)
        
        rules_engine = RulesEngine(custom_rules=custom_rules)
        parser = CassetteParser(rules_engine)
        
        result = parser.sanitize_cassette(input_file, output)
        
        if not no_recheck and output:
            rechecker = ReChecker(rules_engine)
            recheck_result = rechecker.check_file(output)
            result["recheck_passed"] = recheck_result["is_clean"]
            result["recheck_leaks"] = recheck_result["leak_count"]
        
        exporter = ReportExporter(result)
        
        if json_report:
            exporter.generate_json_report(json_report)
            if not quiet:
                click.echo(f"📄 已生成 JSON 报告: {json_report}")
        
        if human_report:
            exporter.generate_human_report(human_report)
            if not quiet:
                click.echo(f"📄 已生成文本报告: {human_report}")
        
        if not quiet:
            exporter.print_console_summary()
        
        if result.get("remaining_leaks", 0) > 0:
            sys.exit(2)
            
    except Exception as e:
        click.echo(f"❌ 错误: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('input_file', type=click.Path(exists=True, readable=True))
@click.option('--rules', '-r', type=click.Path(exists=True), help='自定义规则文件')
@click.option('--output', '-o', type=click.Path(writable=True), help='输出扫描结果 JSON')
def scan(input_file, rules, output):
    """仅扫描敏感数据，不修改原文件"""
    try:
        custom_rules = None
        if rules:
            import json as _json
            import yaml as _yaml
            _, ext = os.path.splitext(rules)
            with open(rules, 'r', encoding='utf-8') as f:
                if ext.lower() == '.json':
                    custom_rules = _json.load(f)
                else:
                    custom_rules = _yaml.safe_load(f)
        
        rules_engine = RulesEngine(custom_rules=custom_rules)
        parser = CassetteParser(rules_engine)
        
        cassette = parser.parse_file(input_file)
        matches, scan_report = parser.scan_cassette(cassette)
        
        result = {
            "input_file": os.path.basename(input_file),
            "total_matches": len(matches),
            "scan_report": scan_report,
            "matches": [m.__dict__ for m in matches]
        }
        
        if output:
            import json as _json
            with open(output, 'w', encoding='utf-8') as f:
                _json.dump(result, f, indent=2, ensure_ascii=False)
            click.echo(f"📄 扫描结果已保存: {output}")
        
        click.echo()
        click.echo(f"🔍 扫描完成: 发现 {result['total_matches']} 处敏感数据")
        for loc, count in scan_report.items():
            if count > 0:
                click.echo(f"   - {loc}: {count} 处")
        click.echo()
        
        if matches:
            click.echo("敏感数据详情:")
            for i, m in enumerate(matches[:10], 1):
                click.echo(f"  {i}. [{m.rule_name}] {m.field_path}")
            if len(matches) > 10:
                click.echo(f"  ... 还有 {len(matches) - 10} 处")
        
    except Exception as e:
        click.echo(f"❌ 错误: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('file_to_check', type=click.Path(exists=True, readable=True))
@click.option('--depth', '-d', default=10, help='检查深度')
def recheck(file_to_check, depth):
    """对文件进行深度复检，确认无敏感数据残留"""
    try:
        rules_engine = RulesEngine()
        rechecker = ReChecker(rules_engine)
        
        result = rechecker.check_file(file_to_check, depth=depth)
        
        click.echo()
        click.echo("=" * 50)
        click.echo("        深度复检结果")
        click.echo("=" * 50)
        click.echo()
        click.echo(f"📁 检查文件: {result['file']}")
        click.echo()
        
        if result['is_clean']:
            click.echo("✅ 复检通过 - 未发现敏感数据残留")
        else:
            click.echo(f"❌ 复检失败 - 发现 {result['leak_count']} 处敏感数据:")
            for i, leak in enumerate(result['leaks'], 1):
                click.echo(f"  {i}. [{leak['rule_name']}] {leak['field_path']}")
                click.echo(f"     值预览: {leak['original_value'][:40]}...")
            sys.exit(2)
            
        click.echo()
        
    except Exception as e:
        click.echo(f"❌ 错误: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
def list_rules():
    """列出当前可用的脱敏规则"""
    rules_engine = RulesEngine()
    
    click.echo()
    click.echo("=" * 50)
    click.echo("        可用脱敏规则列表")
    click.echo("=" * 50)
    click.echo()
    
    for i, rule in enumerate(rules_engine.rules, 1):
        click.echo(f"{i:2d}. {rule.name}")
    
    click.echo()
    click.echo(f"总计: {len(rules_engine.rules)} 条规则")
    click.echo()


if __name__ == '__main__':
    cli()
