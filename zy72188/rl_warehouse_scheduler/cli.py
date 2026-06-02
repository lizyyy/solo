import json
import os
from pathlib import Path
from typing import Optional

import click
from tabulate import tabulate

from .data_loader import DataLoader
from .engine import EvaluationEngine
from .models import EvaluationReport, RecordStatus
from .storage import ModelVersionManager, ReportStorage


BASE_DIR = Path(__file__).parent.parent
SAMPLES_DIR = os.environ.get("SAMPLES_DIR", str(BASE_DIR / "samples"))
REPORTS_DIR = os.environ.get("REPORTS_DIR", str(BASE_DIR / "reports"))
MODEL_CONFIG = os.environ.get("MODEL_CONFIG", str(BASE_DIR / "data" / "model_versions.json"))


@click.group()
def cli():
    """强化学习仓库调度沙盒评测系统"""
    pass


@cli.group()
def model():
    """模型版本管理"""
    pass


@model.command("list")
def list_models():
    """列出所有模型版本"""
    manager = ModelVersionManager(MODEL_CONFIG)
    versions = manager.list_versions()
    
    if not versions:
        click.echo("暂无模型版本")
        return
    
    table = []
    for v in versions:
        table.append([
            "✓" if v.is_active else "",
            v.version,
            v.description,
            v.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        ])
    
    click.echo(tabulate(table, headers=["活跃", "版本", "描述", "创建时间"], tablefmt="simple"))


@model.command("add")
@click.argument("version")
@click.option("--description", "-d", required=True, help="版本描述")
@click.option("--set-active", "-a", is_flag=True, help="设为活跃版本")
@click.option("--threshold-config", "-t", help="阈值配置(JSON格式)")
def add_model(version: str, description: str, set_active: bool, threshold_config: Optional[str]):
    """添加新模型版本"""
    manager = ModelVersionManager(MODEL_CONFIG)
    
    config = None
    if threshold_config:
        config = json.loads(threshold_config)
    
    try:
        model_version = manager.add_version(version, description, config, set_active)
        click.echo(f"已添加模型版本: {model_version.version}")
        if set_active:
            click.echo(f"已设为活跃版本")
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)


@model.command("use")
@click.argument("version")
def use_model(version: str):
    """切换活跃模型版本"""
    manager = ModelVersionManager(MODEL_CONFIG)
    
    if manager.set_active(version):
        click.echo(f"已切换到模型版本: {version}")
    else:
        click.echo(f"错误: 模型版本 {version} 不存在", err=True)


@cli.command("evaluate")
@click.option("--samples", "-s", default=SAMPLES_DIR, help="样本目录路径")
@click.option("--model-version", "-m", help="指定模型版本(默认使用活跃版本)")
@click.option("--save-report/--no-save-report", default=True, help="是否保存报告")
def evaluate(samples: str, model_version: Optional[str], save_report: bool):
    """运行评测"""
    manager = ModelVersionManager(MODEL_CONFIG)
    
    if model_version:
        mv = manager.get_version(model_version)
        if not mv:
            click.echo(f"错误: 模型版本 {model_version} 不存在", err=True)
            return
    else:
        mv = manager.get_active_version()
        if not mv:
            click.echo("错误: 没有活跃的模型版本，请先使用 'model add' 添加版本", err=True)
            return
    
    model_version = mv.version
    click.echo(f"使用模型版本: {model_version}")
    
    click.echo(f"加载样本目录: {samples}")
    try:
        records = DataLoader.load_samples(samples)
        click.echo(f"已加载 {len(records)} 条记录")
    except Exception as e:
        click.echo(f"错误: 加载样本失败 - {e}", err=True)
        return
    
    engine = EvaluationEngine(mv.threshold_config)
    evaluated_records, stats = engine.evaluate_records(records)
    
    click.echo("\n" + "=" * 60)
    click.echo("评测结果统计:")
    click.echo("=" * 60)
    click.echo(f"总记录数: {stats['total']}")
    click.echo(f"成功: {stats['success']}")
    click.echo(f"需人工确认: {stats['needs_review']}")
    click.echo(f"冲突: {stats['conflict']}")
    click.echo(f"无效(含重复): {stats['invalid']}")
    click.echo(f"旧口径数据: {stats['legacy']}")
    click.echo(f"准确率: {stats['accuracy']:.2%}")
    
    if stats["conflict"] > 0 or stats["needs_review"] > 0:
        click.echo("\n" + "-" * 60)
        click.echo("冲突/待确认记录清单:")
        click.echo("-" * 60)
        
        for r in evaluated_records:
            if r.status in (RecordStatus.CONFLICT, RecordStatus.NEEDS_REVIEW):
                click.echo(f"\n[{r.record_id}] {r.status.value}")
                click.echo(f"  原因: {r.conflict_reason}")
                click.echo(f"  模型决策: {r.scheduling_decision.warehouse_id}, "
                          f"优先级={r.scheduling_decision.priority}, "
                          f"成本={r.scheduling_decision.estimated_cost}")
                if r.ground_truth:
                    click.echo(f"  标注结果: {r.ground_truth.warehouse_id}, "
                              f"优先级={r.ground_truth.priority}, "
                              f"成本={r.ground_truth.estimated_cost}")
    
    if save_report:
        report_storage = ReportStorage(REPORTS_DIR)
        report_id = report_storage.generate_report_id(model_version)
        
        conflict_records = []
        for r in evaluated_records:
            if r.status in (RecordStatus.CONFLICT, RecordStatus.NEEDS_REVIEW, RecordStatus.INVALID):
                conflict_records.append({
                    "record_id": r.record_id,
                    "status": r.status.value,
                    "reason": r.conflict_reason,
                    "model_decision": r.scheduling_decision.model_dump(),
                    "ground_truth": r.ground_truth.model_dump() if r.ground_truth else None,
                })
        
        report = EvaluationReport(
            report_id=report_id,
            model_version=model_version,
            total_records=stats["total"],
            success_count=stats["success"],
            needs_review_count=stats["needs_review"],
            conflict_count=stats["conflict"],
            invalid_count=stats["invalid"],
            legacy_count=stats["legacy"],
            accuracy=stats["accuracy"],
            conflict_records=conflict_records,
            summary={
                "threshold_config": mv.threshold_config,
                "source_files": [str(p) for p in Path(samples).iterdir() if p.is_file()],
            },
        )
        
        report_path = report_storage.save_report(report, evaluated_records)
        click.echo(f"\n报告已保存至: {report_path}")


@cli.group()
def report():
    """报告管理"""
    pass


@report.command("list")
@click.option("--model-version", "-m", help="按模型版本筛选")
def list_reports(model_version: Optional[str]):
    """列出评测报告"""
    storage = ReportStorage(REPORTS_DIR)
    reports = storage.list_reports(model_version)
    
    if not reports:
        click.echo("暂无评测报告")
        return
    
    table = []
    for report_id in reports:
        r = storage.load_report(report_id)
        if r:
            table.append([
                r.report_id[:40] + "..." if len(r.report_id) > 40 else r.report_id,
                r.model_version,
                r.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                f"{r.accuracy:.2%}",
                f"{r.conflict_count}/{r.total_records}",
            ])
    
    click.echo(tabulate(table, headers=["报告ID", "模型版本", "评测时间", "准确率", "冲突/总数"], tablefmt="simple"))


@report.command("show")
@click.argument("report_id")
@click.option("--details", "-d", is_flag=True, help="显示详细记录")
def show_report(report_id: str, details: bool):
    """查看评测报告详情"""
    storage = ReportStorage(REPORTS_DIR)
    report = storage.load_report(report_id)
    
    if not report:
        click.echo(f"错误: 报告 {report_id} 不存在", err=True)
        return
    
    click.echo("=" * 60)
    click.echo(f"报告ID: {report.report_id}")
    click.echo(f"模型版本: {report.model_version}")
    click.echo(f"评测时间: {report.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo("=" * 60)
    click.echo(f"总记录数: {report.total_records}")
    click.echo(f"成功: {report.success_count}")
    click.echo(f"需人工确认: {report.needs_review_count}")
    click.echo(f"冲突: {report.conflict_count}")
    click.echo(f"无效: {report.invalid_count}")
    click.echo(f"旧口径数据: {report.legacy_count}")
    click.echo(f"准确率: {report.accuracy:.2%}")
    
    if details:
        records = storage.load_report_records(report_id)
        click.echo("\n" + "-" * 60)
        click.echo("详细记录:")
        click.echo("-" * 60)
        
        for r in records:
            click.echo(f"\n[{r.record_id}] {r.status.value}")
            click.echo(f"  来源: {r.source.value}")
            click.echo(f"  模型决策: 仓库={r.scheduling_decision.warehouse_id}, "
                      f"优先级={r.scheduling_decision.priority}, "
                      f"成本={r.scheduling_decision.estimated_cost}")
            click.echo(f"  推理过程: {r.scheduling_decision.model_reasoning}")
            if r.ground_truth:
                click.echo(f"  标注结果: 仓库={r.ground_truth.warehouse_id}, "
                          f"优先级={r.ground_truth.priority}, "
                          f"成本={r.ground_truth.estimated_cost}")
            if r.conflict_reason:
                click.echo(f"  原因: {r.conflict_reason}")


if __name__ == "__main__":
    cli()
