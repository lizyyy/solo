"""
CLI 入口模块 - 命令行界面
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click

from . import __version__
from .models import Workspace, OrderCase, OrderStatus
from .csv_parser import CSVParser
from .file_scanner import FileScanner
from .rules_engine import RulesEngine
from .quarantine import QuarantineManager
from .packer import Packer
from .reporter import Reporter
from .sample_data import SampleDataGenerator, SelfTestRunner


pass_workspace = click.make_pass_decorator(dict, ensure=True)


@click.group()
@click.version_option(__version__, '--version', '-v')
@click.option('--workspace', '-w', 
              type=click.Path(exists=False, file_okay=False, dir_okay=True),
              help='工作区路径 (默认: 当前目录)')
@click.pass_context
def cli(ctx, workspace):
    """
    义齿打印交付核对员 - 口腔义齿加工室用本地校验工具
    
    用于校验义齿订单、模型文件、树脂批号和后处理记录的一致性。
    """
    ctx.ensure_object(dict)
    
    if workspace:
        workspace_path = os.path.abspath(workspace)
    else:
        workspace_path = os.getcwd()
    
    ctx.obj['workspace_path'] = workspace_path
    ctx.obj['workspace'] = Workspace(
        root_path=workspace_path,
        creation_date=datetime.now()
    )


@cli.command()
@click.option('--force', '-f', is_flag=True, 
              help='强制初始化 (覆盖现有配置)')
@pass_workspace
def init(ctx, force):
    """
    初始化工作区目录结构
    
    创建标准的工作区目录结构:
    - orders/: 订单CSV文件
    - models/: STL/3MF模型文件
    - records/: 后处理记录
    - quarantine/: 隔离区
    - output/: 输出目录
    - reports/: 报告目录
    """
    workspace_path = ctx['workspace_path']
    ws = ctx['workspace']
    
    config_file = ws.config_file
    
    if os.path.exists(config_file) and not force:
        click.echo(f"错误: 工作区已存在于 {workspace_path}")
        click.echo("使用 --force 选项覆盖现有配置")
        sys.exit(1)
    
    directories = [
        ws.orders_dir,
        ws.models_dir,
        ws.records_dir,
        ws.quarantine_dir,
        ws.output_dir,
        ws.reports_dir
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
    
    config = {
        "workspace_id": ws.workspace_id,
        "created_at": datetime.now().isoformat(),
        "version": __version__,
        "settings": {
            "default_material_validation": True,
            "strict_tooth_position": True,
            "quarantine_on_critical": True
        }
    }
    
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    
    click.echo(f"✓ 工作区初始化完成: {workspace_path}")
    click.echo("")
    click.echo("目录结构:")
    for directory in directories:
        rel_path = os.path.relpath(directory, workspace_path)
        click.echo(f"  ├── {rel_path}/")


@cli.command('import-order')
@click.argument('csv_file', type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option('--encoding', '-e', default='utf-8', 
              help='CSV文件编码 (默认: utf-8)')
@pass_workspace
def import_order(ctx, csv_file, encoding):
    """
    导入订单CSV文件
    
    CSV_FILE: 订单CSV文件路径
    
    支持的字段名 (中英文均可):
    - case_id / 病例编号 / 订单编号
    - patient_id / 患者编号 / 患者ID
    - patient_name / 患者姓名 / 姓名
    - tooth_position / 牙位
    - material_type / 材料类型 / 材料
    - color_shade / 色号 / 颜色
    - resin_batch / 树脂批号 / 批号
    - resin_expiration / 有效期
    """
    workspace_path = ctx['workspace_path']
    
    click.echo(f"正在解析订单文件: {csv_file}")
    
    try:
        parser = CSVParser()
        cases = parser.parse_file(csv_file, encoding=encoding)
        
        summary = parser.get_import_summary()
        
        click.echo(f"✓ 成功导入 {summary['total_cases']} 个病例")
        click.echo("")
        click.echo("材料类型分布:")
        for mt, count in summary.get('material_types', {}).items():
            click.echo(f"  - {mt}: {count} 例")
        
        click.echo("")
        click.echo("病例列表:")
        for i, case_info in enumerate(summary.get('cases', []), 1):
            click.echo(f"  {i}. {case_info['case_id']} - {case_info['patient_name']} "
                      f"(牙位: {case_info['tooth_position']}, 材料: {case_info['material_type']}/{case_info['color_shade']})")
        
        ctx['imported_cases'] = cases
        
    except Exception as e:
        click.echo(f"✗ 导入失败: {e}")
        sys.exit(1)


@cli.command()
@click.option('--models-dir', '-m', 
              type=click.Path(exists=True, file_okay=False, dir_okay=True),
              help='模型文件目录 (默认: workspace/models)')
@click.option('--records-dir', '-r', 
              type=click.Path(exists=True, file_okay=False, dir_okay=True),
              help='记录文件目录 (默认: workspace/records)')
@click.option('--output', '-o', type=click.Path(), 
              help='扫描结果输出JSON文件')
@pass_workspace
def scan(ctx, models_dir, records_dir, output):
    """
    扫描模型文件和后处理记录
    
    扫描支持的模型文件 (STL, 3MF, OBJ, PLY) 和后处理记录 (JSON, CSV, TXT)。
    自动计算文件哈希，从文件名提取患者ID和牙位信息。
    """
    workspace_path = ctx['workspace_path']
    ws = ctx['workspace']
    
    models_path = models_dir or ws.models_dir
    records_path = records_dir or ws.records_dir
    
    click.echo("开始扫描...")
    click.echo(f"  模型目录: {models_path}")
    click.echo(f"  记录目录: {records_path}")
    
    scanner = FileScanner(workspace_path)
    
    model_files = []
    if os.path.exists(models_path):
        model_files = scanner.scan_directory_for_models(models_path)
        click.echo(f"✓ 扫描到 {len(model_files)} 个模型文件")
    else:
        click.echo(f"⚠ 模型目录不存在: {models_path}")
    
    records = []
    if os.path.exists(records_path):
        records = scanner.scan_directory_for_records(records_path)
        click.echo(f"✓ 扫描到 {len(records)} 条后处理记录")
    else:
        click.echo(f"⚠ 记录目录不存在: {records_path}")
    
    summary = scanner.get_scan_summary()
    
    if summary['model_file_types']:
        click.echo("")
        click.echo("模型文件类型分布:")
        for ft, count in summary['model_file_types'].items():
            click.echo(f"  - {ft}: {count} 个")
    
    if output:
        with open(output, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        click.echo(f"")
        click.echo(f"✓ 扫描结果已保存到: {output}")
    
    ctx['scanned_files'] = model_files
    ctx['scanned_records'] = records


@cli.command()
@click.option('--case-id', '-c', multiple=True,
              help='指定要校验的病例ID (可多次指定)')
@click.option('--rules', '-r', multiple=True,
              help='指定要执行的规则 (默认: 所有规则)')
@click.option('--list-rules', is_flag=True,
              help='列出所有可用的校验规则')
@pass_workspace
def check(ctx, case_id, rules, list_rules):
    """
    执行校验规则
    
    校验内容包括:
    - 牙位格式正确性
    - 文件哈希一致性
    - 材料与色号匹配
    - 树脂批号有效期
    - 后处理时长
    - 重复病例检测
    - 患者ID一致性
    
    有严重问题的病例将被写入隔离区。
    """
    workspace_path = ctx['workspace_path']
    ws = ctx['workspace']
    
    engine = RulesEngine()
    
    if list_rules:
        click.echo("可用的校验规则:")
        for rule in engine.get_rules_summary():
            click.echo(f"  - {rule['rule_name']}: {rule['description']} (严重程度: {rule['severity']})")
        return
    
    imported_cases = ctx.get('imported_cases', [])
    scanned_files = ctx.get('scanned_files', [])
    scanned_records = ctx.get('scanned_records', [])
    
    if not imported_cases:
        click.echo("⚠ 没有导入的订单，请先运行 import-order 命令")
        click.echo("尝试从 orders 目录查找订单文件...")
        
        orders_dir = ws.orders_dir
        if os.path.exists(orders_dir):
            csv_files = [f for f in os.listdir(orders_dir) if f.endswith('.csv')]
            if csv_files:
                csv_path = os.path.join(orders_dir, csv_files[0])
                click.echo(f"找到订单文件: {csv_path}")
                parser = CSVParser()
                imported_cases = parser.parse_file(csv_path)
                click.echo(f"自动导入了 {len(imported_cases)} 个病例")
            else:
                click.echo("✗ orders 目录中没有CSV文件")
                sys.exit(1)
        else:
            click.echo("✗ 未找到订单文件")
            sys.exit(1)
    
    for case in imported_cases:
        for model_file in scanned_files:
            if (model_file.extracted_patient_id == case.patient.patient_id or
                model_file.associated_case_id == case.case_id):
                case.model_files.append(model_file)
        
        for record in scanned_records:
            if record.case_id == case.case_id:
                case.post_processing = record
    
    if case_id:
        imported_cases = [c for c in imported_cases if c.case_id in case_id]
        if not imported_cases:
            click.echo(f"✗ 未找到指定的病例ID: {case_id}")
            sys.exit(1)
    
    click.echo(f"开始校验 {len(imported_cases)} 个病例...")
    
    validated_cases, validation_result = engine.validate_all_cases(imported_cases)
    
    click.echo("")
    click.echo("=" * 50)
    click.echo("校验结果摘要")
    click.echo("=" * 50)
    click.echo(f"总病例数: {validation_result.total_cases}")
    click.echo(f"通过: {validation_result.passed_cases}")
    click.echo(f"隔离: {validation_result.quarantined_cases}")
    click.echo("")
    
    if validation_result.issues_by_severity:
        click.echo("问题统计:")
        for severity, count in validation_result.issues_by_severity.items():
            if count > 0:
                label = {"critical": "关键", "warning": "警告", "info": "信息"}.get(severity, severity)
                click.echo(f"  - {label}: {count}")
    
    quarantine_dir = ws.quarantine_dir
    quarantine_manager = QuarantineManager(quarantine_dir)
    quarantined_count = quarantine_manager.quarantine_cases(validated_cases)
    
    if quarantined_count > 0:
        click.echo("")
        click.echo(f"⚠ {quarantined_count} 个病例已被隔离到: {quarantine_dir}")
        click.echo(f"  隔离记录: {quarantine_manager.quarantine_file}")
    
    ctx['validated_cases'] = validated_cases
    ctx['validation_result'] = validation_result
    
    passed = [c for c in validated_cases if c.status == OrderStatus.PASSED]
    quarantined = [c for c in validated_cases if c.status == OrderStatus.QUARANTINED]
    
    if passed:
        click.echo("")
        click.echo("通过的病例:")
        for i, case in enumerate(passed, 1):
            issues = len(case.validation_issues)
            click.echo(f"  {i}. {case.case_id} - {case.patient.patient_name} "
                      f"(牙位: {case.tooth_position.raw_position})"
                      f"{f' [警告: {issues}]' if issues > 0 else ''}")
    
    if quarantined:
        click.echo("")
        click.echo("隔离的病例 (存在关键问题):")
        for i, case in enumerate(quarantined, 1):
            click.echo(f"  {i}. {case.case_id} - {case.patient.patient_name}")
            for issue in case.validation_issues:
                if issue.severity == "critical":
                    click.echo(f"     🔴 {issue.rule_name}: {issue.message}")


@cli.command()
@click.option('--output-dir', '-o', 
              type=click.Path(file_okay=False, dir_okay=True),
              help='输出目录 (默认: workspace/output)')
@pass_workspace
def pack(ctx, output_dir):
    """
    打包通过校验的病例
    
    只复制通过所有校验的病例到输出目录，并生成交付清单。
    """
    workspace_path = ctx['workspace_path']
    ws = ctx['workspace']
    
    validated_cases = ctx.get('validated_cases', [])
    
    if not validated_cases:
        click.echo("⚠ 没有校验过的病例，请先运行 check 命令")
        sys.exit(1)
    
    output_path = output_dir or ws.output_dir
    
    packer = Packer(output_path)
    pack_result = packer.pack_passed_cases(validated_cases)
    
    if pack_result['packed_count'] == 0:
        click.echo("⚠ 没有通过校验的病例可以打包")
        return
    
    click.echo(f"✓ 成功打包 {pack_result['packed_count']} 个病例")
    click.echo(f"  输出目录: {pack_result.get('pack_dir', output_path)}")
    click.echo(f"  交付清单 (CSV): {pack_result.get('manifest_csv', 'N/A')}")
    click.echo(f"  交付清单 (JSON): {pack_result.get('manifest_json', 'N/A')}")
    
    click.echo("")
    click.echo("打包的病例:")
    for i, case_info in enumerate(pack_result.get('cases', []), 1):
        click.echo(f"  {i}. {case_info['case_id']} - {case_info['patient_name']} "
                  f"(文件数: {case_info['files_count']})")


@cli.command()
@click.option('--format', '-f', multiple=True, 
              default=['markdown', 'csv', 'json'],
              type=click.Choice(['markdown', 'csv', 'json']),
              help='报告格式 (可多次指定，默认: 所有格式)')
@click.option('--name', '-n', help='报告文件名 (不含扩展名)')
@click.option('--output-dir', '-o', 
              type=click.Path(file_okay=False, dir_okay=True),
              help='报告输出目录 (默认: workspace/reports)')
@pass_workspace
def report(ctx, format, name, output_dir):
    """
    导出校验报告
    
    支持导出 Markdown、CSV 和 JSON 格式的报告。
    """
    workspace_path = ctx['workspace_path']
    ws = ctx['workspace']
    
    validated_cases = ctx.get('validated_cases', [])
    validation_result = ctx.get('validation_result')
    
    if not validated_cases:
        click.echo("⚠ 没有校验过的病例，请先运行 check 命令")
        sys.exit(1)
    
    reports_path = output_dir or ws.reports_dir
    
    reporter = Reporter(reports_path)
    report_files = reporter.generate_report(
        validated_cases,
        validation_result,
        report_name=name,
        formats=list(format)
    )
    
    click.echo("✓ 报告生成完成:")
    for fmt, path in report_files.items():
        click.echo(f"  - {fmt.upper()}: {path}")


@cli.command('self-test')
@click.option('--workspace', '-w', 
              type=click.Path(file_okay=False, dir_okay=True),
              help='测试工作区路径 (默认: 临时目录)')
@click.option('--keep', '-k', is_flag=True,
              help='测试完成后保留工作区')
def self_test(workspace, keep):
    """
    运行自检程序
    
    生成测试数据并执行完整的校验流程，验证系统功能是否正常。
    """
    click.echo("=" * 50)
    click.echo("义齿打印交付核对员 - 自检程序")
    click.echo("=" * 50)
    click.echo("")
    
    runner = SelfTestRunner()
    
    if workspace:
        workspace_path = os.path.abspath(workspace)
        click.echo(f"使用指定工作区: {workspace_path}")
    else:
        import tempfile
        workspace_path = os.path.join(tempfile.gettempdir(), "denture_checker_self_test")
        click.echo(f"使用临时工作区: {workspace_path}")
    
    click.echo("")
    click.echo("开始自检...")
    click.echo("")
    
    results = runner.run_all_tests(workspace_path if keep else None)
    
    click.echo("")
    click.echo("=" * 50)
    click.echo("自检结果")
    click.echo("=" * 50)
    
    for test in results['tests']:
        status_icon = {
            "passed": "✓",
            "failed": "✗",
            "error": "✗",
            "warning": "⚠"
        }.get(test['status'], "?")
        
        status_color = {
            "passed": "green",
            "failed": "red",
            "error": "red",
            "warning": "yellow"
        }.get(test['status'], "white")
        
        click.echo(f"{status_icon} {test['test']}: {test['details']}")
    
    click.echo("")
    summary = results['summary']
    click.echo(f"总计: {summary['total_tests']} 个测试")
    click.echo(f"通过: {summary['passed']}")
    click.echo(f"失败: {summary['failed']}")
    click.echo(f"错误: {summary['errors']}")
    click.echo(f"成功率: {summary['success_rate']}")
    
    if keep and workspace:
        click.echo("")
        click.echo(f"测试工作区已保留: {workspace_path}")
    
    if summary['failed'] > 0 or summary['errors'] > 0:
        sys.exit(1)


@cli.command('generate-sample')
@click.argument('output_dir', type=click.Path(file_okay=False, dir_okay=True))
@click.option('--count', '-c', default=5, help='生成病例数 (默认: 5)')
@click.option('--include-errors', '-e', is_flag=True, 
              help='包含错误病例用于测试校验功能')
def generate_sample(output_dir, count, include_errors):
    """
    生成示例数据
    
    创建包含订单CSV、模型文件和后处理记录的示例工作区。
    用于测试和演示目的。
    """
    output_path = os.path.abspath(output_dir)
    
    click.echo(f"正在生成示例数据到: {output_path}")
    click.echo(f"  病例数: {count}")
    click.echo(f"  包含错误病例: {'是' if include_errors else '否'}")
    
    generator = SampleDataGenerator(output_path)
    workspace_info = generator.create_complete_sample_workspace(
        output_path,
        include_errors=include_errors
    )
    
    click.echo("")
    click.echo("✓ 示例数据生成完成")
    click.echo("")
    click.echo("生成的文件:")
    click.echo(f"  - 订单CSV: {workspace_info['orders_csv']}")
    click.echo(f"  - 模型文件: {len(workspace_info['model_files'])} 个")
    click.echo(f"  - 后处理记录: {len(workspace_info['record_files'])} 个")
    
    click.echo("")
    click.echo("下一步操作:")
    click.echo(f"  1. cd {output_path}")
    click.echo(f"  2. denture-checker scan")
    click.echo(f"  3. denture-checker check")


if __name__ == '__main__':
    cli()
