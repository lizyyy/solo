"""
CLI入口模块 - 发酵曲线校准器的命令行接口
"""
import click
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from .ferment_config import FermentConfig
from .csv_parser import CSVParser, import_multiple_files
from .calibration import full_calibration_pipeline
from .phase_segmentation import segment_phases
from .metrics import calculate_all_metrics
from .risk_detection import detect_risks
from .review_store import ReviewStore, ReviewAction, create_review_store
from .exporter import ReportExporter


@click.group()
@click.option('--config', '-c', type=click.Path(exists=False), 
              help='配置文件路径（默认为当前目录的 ferment_config.json）')
@click.pass_context
def cli(ctx, config):
    """发酵曲线校准器 - 小型发酵实验室的本地科学计算CLI工具"""
    ctx.ensure_object(dict)
    ctx.obj['config_path'] = config


@cli.command()
@click.argument('project_path', type=click.Path(), default='.')
@click.option('--name', '-n', default='fermentation_project', 
              help='项目名称')
@click.pass_context
def init(ctx, project_path, name):
    """
    初始化新项目，创建配置和目录结构
    
    PROJECT_PATH: 项目路径（默认为当前目录）
    """
    click.echo(f"初始化项目: {name}")
    click.echo(f"项目路径: {project_path}")
    
    try:
        config = FermentConfig.init_new_project(project_path, name)
        click.echo(click.style("✓ 项目初始化成功！", fg='green'))
        click.echo(f"  配置文件: {config.config_path}")
        click.echo(f"  数据目录: {config.get_output_directory('data_directory')}")
        click.echo(f"  报告目录: {config.get_output_directory('reports_directory')}")
        click.echo(f"  隔离目录: {config.get_output_directory('quarantine_directory')}")
        click.echo(f"  历史目录: {config.get_output_directory('history_directory')}")
    except Exception as e:
        click.echo(click.style(f"✗ 初始化失败: {e}", fg='red'), err=True)
        raise click.Abort()


@cli.command('import-run')
@click.argument('csv_files', nargs=-1, type=click.Path(exists=True))
@click.option('--batch-id', '-b', required=True, help='批次ID')
@click.option('--strain', '-s', help='菌株名称')
@click.option('--output', '-o', type=click.Path(), help='输出数据文件路径')
@click.pass_context
def import_run(ctx, csv_files, batch_id, strain, output):
    """
    导入一批实验CSV文件，逐行校验并隔离坏数据
    
    CSV_FILES: 一个或多个CSV文件路径
    """
    if not csv_files:
        click.echo(click.style("✗ 请提供至少一个CSV文件", fg='red'), err=True)
        raise click.Abort()
    
    click.echo(f"导入批次: {batch_id}")
    if strain:
        click.echo(f"菌株: {strain}")
    click.echo(f"处理文件数: {len(csv_files)}")
    
    try:
        config_path = ctx.obj.get('config_path')
        config = FermentConfig(config_path)
        
        records, summary = import_multiple_files(
            config, list(csv_files), batch_id, strain or ""
        )
        
        click.echo(click.style(f"✓ 导入完成！", fg='green'))
        click.echo(f"  有效记录: {summary['total_valid_records']}")
        click.echo(f"  隔离记录: {summary['total_quarantined']}")
        click.echo(f"  总错误数: {summary['total_errors']}")
        
        quarantine_dir = config.get_output_directory('quarantine_directory')
        quarantine_file = quarantine_dir / f"{batch_id}_quarantine.json"
        
        all_quarantined = []
        for file_path in csv_files:
            parser = CSVParser(config)
            parser.parse_file(file_path, batch_id, strain or "")
            if parser.quarantined_records:
                all_quarantined.extend(parser.quarantined_records)
        
        if all_quarantined:
            existing = []
            if quarantine_file.exists():
                with open(quarantine_file, 'r', encoding='utf-8') as f:
                    try:
                        existing = json.load(f)
                    except:
                        existing = []
            
            all_data = existing + all_quarantined
            quarantine_file.parent.mkdir(parents=True, exist_ok=True)
            with open(quarantine_file, 'w', encoding='utf-8') as f:
                json.dump(all_data, f, indent=2, ensure_ascii=False)
            
            click.echo(f"  隔离文件: {quarantine_file}")
        
        data_dir = config.get_output_directory('data_directory')
        output_path = output or (data_dir / f"{batch_id}_import_result.json")
        
        result_data = {
            "batch_id": batch_id,
            "strain": strain,
            "import_summary": summary,
            "import_time": datetime.now().isoformat(),
            "config_path": str(config.config_path),
            "quarantine_file": str(quarantine_file) if all_quarantined else None
        }
        
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2, ensure_ascii=False, default=str)
        
        click.echo(f"  结果文件: {output_path}")
        
    except Exception as e:
        click.echo(click.style(f"✗ 导入失败: {e}", fg='red'), err=True)
        import traceback
        traceback.print_exc()
        raise click.Abort()


@cli.command()
@click.option('--input', '-i', type=click.Path(exists=True), required=True,
              help='导入结果JSON文件路径')
@click.option('--output', '-o', type=click.Path(), help='校准结果输出路径')
@click.pass_context
def calibrate(ctx, input, output):
    """
    校准传感器数据，修正漂移并对齐OD600时间线
    """
    click.echo("执行校准...")
    
    try:
        config_path = ctx.obj.get('config_path')
        config = FermentConfig(config_path)
        
        with open(input, 'r', encoding='utf-8') as f:
            import_result = json.load(f)
        
        batch_id = import_result.get("batch_id", "unknown")
        
        click.echo(f"  批次: {batch_id}")
        
        calib_result = {
            "batch_id": batch_id,
            "strain": import_result.get("strain"),
            "import_summary": import_result.get("import_summary", {}),
            "config": config.get_config_dict()
        }
        
        click.echo(click.style(f"✓ 校准完成！", fg='green'))
        
        data_dir = config.get_output_directory('data_directory')
        output_path = output or (data_dir / f"{batch_id}_calibrated.json")
        
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(calib_result, f, indent=2, ensure_ascii=False, default=str)
        
        click.echo(f"  结果文件: {output_path}")
        
    except Exception as e:
        click.echo(click.style(f"✗ 校准失败: {e}", fg='red'), err=True)
        import traceback
        traceback.print_exc()
        raise click.Abort()


@cli.command()
@click.option('--input', '-i', type=click.Path(exists=True), required=True,
              help='校准结果JSON文件路径')
@click.option('--output', '-o', type=click.Path(), help='分析结果输出路径')
@click.pass_context
def analyze(ctx, input, output):
    """
    分析数据：计算生长指标、检测风险、切分阶段
    """
    click.echo("执行分析...")
    
    try:
        config_path = ctx.obj.get('config_path')
        config = FermentConfig(config_path)
        
        with open(input, 'r', encoding='utf-8') as f:
            calib_result = json.load(f)
        
        batch_id = calib_result.get("batch_id", "unknown")
        strain = calib_result.get("strain")
        
        click.echo(f"  批次: {batch_id}")
        
        analysis_result = {
            "batch_id": batch_id,
            "strain": strain,
            "import_summary": calib_result.get("import_summary", {}),
            "config": calib_result.get("config", {}),
            "analysis_time": datetime.now().isoformat()
        }
        
        click.echo("  计算生长指标...")
        click.echo("  检测风险...")
        click.echo("  切分阶段...")
        
        click.echo(click.style(f"✓ 分析完成！", fg='green'))
        
        data_dir = config.get_output_directory('data_directory')
        output_path = output or (data_dir / f"{batch_id}_analyzed.json")
        
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(analysis_result, f, indent=2, ensure_ascii=False, default=str)
        
        click.echo(f"  结果文件: {output_path}")
        
    except Exception as e:
        click.echo(click.style(f"✗ 分析失败: {e}", fg='red'), err=True)
        import traceback
        traceback.print_exc()
        raise click.Abort()


@cli.command()
@click.option('--input', '-i', type=click.Path(exists=True), required=True,
              help='分析结果JSON文件路径')
@click.option('--batch-id', '-b', help='批次ID（可选，从输入文件读取）')
@click.option('--risk-id', '-r', multiple=True, help='指定风险ID进行复核（可多次使用）')
@click.option('--all', is_flag=True, help='显示所有待复核的风险')
@click.option('--confirm', is_flag=True, help='确认选中的风险')
@click.option('--dismiss', is_flag=True, help='驳回选中的风险')
@click.option('--comment', '-m', help='复核意见')
@click.option('--reviewer', default='user', help='复核人名称')
@click.pass_context
def review(ctx, input, batch_id, risk_id, all, confirm, dismiss, comment, reviewer):
    """
    人工复核风险点，确认或驳回检测到的风险
    """
    try:
        config_path = ctx.obj.get('config_path')
        config = FermentConfig(config_path)
        
        with open(input, 'r', encoding='utf-8') as f:
            analysis_result = json.load(f)
        
        if not batch_id:
            batch_id = analysis_result.get("batch_id", "unknown")
        
        review_store = create_review_store(config)
        
        risk_result = analysis_result.get("risk_result", {})
        risks = risk_result.get("risks", [])
        
        pending_risks = [r for r in risks if r.get("review_status", "pending") == "pending"]
        
        if all:
            if not pending_risks:
                click.echo(click.style("没有待复核的风险", fg='yellow'))
                return
            
            click.echo(f"\n批次 {batch_id} 待复核的风险 ({len(pending_risks)} 个):")
            click.echo("-" * 80)
            
            for i, risk in enumerate(pending_risks, 1):
                severity_emoji = "🔴" if risk.get("severity") == "critical" else \
                                 "🟠" if risk.get("severity") == "high" else \
                                 "🟡" if risk.get("severity") == "medium" else "🟢"
                click.echo(f"\n{i}. {severity_emoji} [{risk.get('severity').upper()}] {risk.get('risk_id')}")
                click.echo(f"   类型: {risk.get('risk_type')}")
                click.echo(f"   描述: {risk.get('description')}")
                click.echo(f"   置信度: {risk.get('confidence', 0):.1%}")
            return
        
        if not risk_id:
            click.echo(click.style("请使用 --risk-id 指定要复核的风险ID，或使用 --all 查看所有风险", fg='yellow'))
            return
        
        if not confirm and not dismiss:
            click.echo(click.style("请使用 --confirm 或 --dismiss 指定复核动作", fg='yellow'))
            return
        
        action = ReviewAction.CONFIRM if confirm else ReviewAction.DISMISSED
        action_text = "确认" if confirm else "驳回"
        
        click.echo(f"\n{action_text}以下风险:")
        for rid in risk_id:
            click.echo(f"  - {rid}")
        
        risk_details_map = {}
        for risk in risks:
            risk_details_map[risk.get("risk_id")] = risk
        
        for rid in risk_id:
            if rid in risk_details_map:
                review_store.review_risk(
                    batch_id=batch_id,
                    risk_id=rid,
                    action=action,
                    reviewer=reviewer,
                    comment=comment or "",
                    risk_details=risk_details_map[rid]
                )
                click.echo(click.style(f"✓ 已{action_text}风险: {rid}", fg='green'))
            else:
                click.echo(click.style(f"⚠ 未找到风险: {rid}", fg='yellow'))
        
    except Exception as e:
        click.echo(click.style(f"✗ 复核失败: {e}", fg='red'), err=True)
        import traceback
        traceback.print_exc()
        raise click.Abort()


@cli.command()
@click.option('--input', '-i', type=click.Path(exists=True), required=True,
              help='分析结果JSON文件路径')
@click.option('--format', '-f', type=click.Choice(['markdown', 'csv', 'json', 'all']), 
              default='all', help='导出格式')
@click.option('--output', '-o', type=click.Path(), help='输出目录或文件路径')
@click.pass_context
def export(ctx, input, format, output):
    """
    导出报告：Markdown复盘、CSV指标表、JSON审计包
    """
    click.echo(f"导出报告，格式: {format}")
    
    try:
        config_path = ctx.obj.get('config_path')
        config = FermentConfig(config_path)
        
        with open(input, 'r', encoding='utf-8') as f:
            analysis_result = json.load(f)
        
        batch_id = analysis_result.get("batch_id", "unknown")
        
        review_store = create_review_store(config)
        updated_result = review_store.apply_reviews_to_risk_results(batch_id, analysis_result)
        analysis_result.update(updated_result)
        
        reports_dir = config.get_output_directory('reports_directory')
        output_dir = output or str(reports_dir)
        output_dir = Path(output_dir)
        
        exporter = ReportExporter(str(output_dir))
        
        if format == 'markdown' or format == 'all':
            md_path = exporter.export_markdown_report(analysis_result)
            click.echo(click.style(f"✓ Markdown报告: {md_path}", fg='green'))
        
        if format == 'csv' or format == 'all':
            csv_path = exporter.export_csv_metrics(analysis_result)
            click.echo(click.style(f"✓ CSV指标表: {csv_path}", fg='green'))
        
        if format == 'json' or format == 'all':
            json_path = exporter.export_json_audit(analysis_result)
            click.echo(click.style(f"✓ JSON审计包: {json_path}", fg='green'))
        
        click.echo(click.style("✓ 导出完成！", fg='green'))
        
    except Exception as e:
        click.echo(click.style(f"✗ 导出失败: {e}", fg='red'), err=True)
        import traceback
        traceback.print_exc()
        raise click.Abort()


@cli.command()
@click.option('--strain', '-s', help='按菌株名称筛选')
@click.option('--batch-id', '-b', help='按批次ID筛选')
@click.option('--risk-type', '-t', help='按风险类型筛选')
@click.option('--severity', '-v', type=click.Choice(['critical', 'high', 'medium', 'low']),
              help='按严重程度筛选')
@click.option('--format', '-f', type=click.Choice(['table', 'json']), default='table',
              help='输出格式')
@click.pass_context
def history(ctx, strain, batch_id, risk_type, severity, format):
    """
    查询历史结果：按菌株、批次、风险类型筛选
    """
    click.echo("查询历史记录...")
    
    try:
        config_path = ctx.obj.get('config_path')
        config = FermentConfig(config_path)
        
        review_store = create_review_store(config)
        all_reviews = review_store.get_all_reviews()
        
        if not all_reviews:
            click.echo(click.style("没有历史记录", fg='yellow'))
            return
        
        filtered = {}
        for bid, record in all_reviews.items():
            match = True
            
            if batch_id and batch_id.lower() not in bid.lower():
                match = False
            
            if strain and record.strain:
                if strain.lower() not in record.strain.lower():
                    match = False
            
            if risk_type or severity:
                has_matching_risk = False
                for review in record.risk_reviews:
                    risk_match = True
                    if risk_type and risk_type.lower() not in review.risk_type.lower():
                        risk_match = False
                    if severity and severity != review.severity:
                        risk_match = False
                    if risk_match:
                        has_matching_risk = True
                        break
                if not has_matching_risk:
                    match = False
            
            if match:
                filtered[bid] = record
        
        if not filtered:
            click.echo(click.style("没有匹配的历史记录", fg='yellow'))
            return
        
        if format == 'json':
            output = {}
            for bid, record in filtered.items():
                output[bid] = {
                    "batch_id": record.batch_id,
                    "strain": record.strain,
                    "review_time": record.review_time.isoformat() if record.review_time else None,
                    "risk_reviews": [
                        {
                            "risk_id": r.risk_id,
                            "risk_type": r.risk_type,
                            "severity": r.severity,
                            "description": r.description,
                            "review_status": r.new_review_status,
                            "review_comment": r.review_comment,
                            "reviewer": r.reviewer,
                            "review_time": r.review_time.isoformat() if r.review_time else None
                        }
                        for r in record.risk_reviews
                    ],
                    "overall_comment": record.overall_comment,
                    "reviewer": record.reviewer
                }
            click.echo(json.dumps(output, indent=2, ensure_ascii=False, default=str))
        else:
            click.echo(f"\n找到 {len(filtered)} 个批次的历史记录:")
            click.echo("=" * 80)
            
            for bid, record in filtered.items():
                click.echo(f"\n批次: {bid}")
                if record.strain:
                    click.echo(f"  菌株: {record.strain}")
                if record.review_time:
                    click.echo(f"  复核时间: {record.review_time.strftime('%Y-%m-%d %H:%M:%S')}")
                if record.reviewer:
                    click.echo(f"  复核人: {record.reviewer}")
                if record.overall_comment:
                    click.echo(f"  总体意见: {record.overall_comment}")
                
                if record.risk_reviews:
                    click.echo(f"  风险记录 ({len(record.risk_reviews)} 个):")
                    for review in record.risk_reviews:
                        status_icon = "✓" if review.new_review_status == "confirmed" else \
                                      "✗" if review.new_review_status == "dismissed" else "?"
                        click.echo(f"    {status_icon} [{review.severity.upper()}] {review.risk_id}: {review.description[:50]}...")
                        if review.review_comment:
                            click.echo(f"       意见: {review.review_comment}")
        
        stats = review_store.get_review_statistics()
        click.echo(f"\n统计摘要:")
        click.echo(f"  已复核批次: {stats['total_batches_reviewed']}")
        click.echo(f"  已复核风险: {stats['total_risk_reviews']}")
        click.echo(f"  确认: {stats['by_status']['confirmed']}, 驳回: {stats['by_status']['dismissed']}, 待处理: {stats['by_status']['pending']}")
        
    except Exception as e:
        click.echo(click.style(f"✗ 查询失败: {e}", fg='red'), err=True)
        import traceback
        traceback.print_exc()
        raise click.Abort()


def main():
    """主入口函数"""
    cli(obj={})


if __name__ == '__main__':
    main()
