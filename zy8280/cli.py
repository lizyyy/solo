import json
from pathlib import Path

import click

from lab_guardian import Guardian


@click.group()
@click.pass_context
def cli(ctx):
    """实验室传感器数据复核工具"""
    ctx.ensure_object(dict)


@cli.command()
@click.option("--samples", "-s", required=True, type=click.Path(exists=True), help="样本数据CSV文件")
@click.option("--aliases", "-a", type=click.Path(exists=True), help="单位别名YAML文件")
@click.option("--thresholds", "-t", type=click.Path(exists=True), help="阈值配置JSON文件")
@click.pass_context
def validate(ctx, samples, aliases, thresholds):
    """验证数据完整性和格式正确性"""
    click.echo("正在验证数据...")
    
    try:
        guardian = Guardian(
            samples_file=samples,
            alias_file=aliases,
            threshold_file=thresholds,
        )
        
        click.echo(f"✓ 成功加载 {len(guardian.samples)} 条样本数据")
        
        if aliases:
            click.echo("✓ 成功加载单位别名配置")
        
        if thresholds:
            click.echo(f"✓ 成功加载 {len(guardian.threshold_validator.thresholds)} 个参数的阈值配置")
        
        click.echo("\n数据验证通过！")
        ctx.obj["guardian"] = guardian
        
    except Exception as e:
        click.echo(f"✗ 验证失败: {e}", err=True)
        raise click.Abort()


@cli.command()
@click.option("--samples", "-s", required=True, type=click.Path(exists=True), help="样本数据CSV文件")
@click.option("--aliases", "-a", type=click.Path(exists=True), help="单位别名YAML文件")
@click.option("--thresholds", "-t", type=click.Path(exists=True), help="阈值配置JSON文件")
@click.option("--output", "-o", type=click.Path(), help="输出JSON结果文件")
@click.pass_context
def analyze(ctx, samples, aliases, thresholds, output):
    """分析数据并判定状态"""
    click.echo("正在分析数据...")
    
    try:
        guardian = Guardian(
            samples_file=samples,
            alias_file=aliases,
            threshold_file=thresholds,
        )
        
        results = guardian.analyze()
        stats = guardian.get_statistics()
        
        click.echo(f"\n分析完成！共处理 {stats['total']} 条记录")
        click.echo("\n状态分布:")
        for status, count in stats["by_status"].items():
            percentage = (count / stats["total"] * 100) if stats["total"] > 0 else 0
            click.echo(f"  - {status}: {count} ({percentage:.1f}%)")
        
        click.echo("\n按参数分布:")
        for param, data in stats["by_parameter"].items():
            click.echo(f"\n  {param}:")
            for status, count in data["by_status"].items():
                click.echo(f"    - {status}: {count}")
        
        if output:
            output_data = {
                "statistics": stats,
                "results": [
                    {
                        "id": r.sample.id,
                        "parameter": r.sample.parameter,
                        "original_value": r.sample.value,
                        "original_unit": r.sample.unit,
                        "normalized_value": r.normalized_value,
                        "target_unit": r.target_unit,
                        "status": r.status.value,
                        "message": r.message,
                        "source": r.sample.source,
                    }
                    for r in results
                ]
            }
            
            with open(output, "w", encoding="utf-8") as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            
            click.echo(f"\n✓ 结果已保存到: {output}")
        
        ctx.obj["guardian"] = guardian
        
    except Exception as e:
        click.echo(f"✗ 分析失败: {e}", err=True)
        raise click.Abort()


@cli.command()
@click.option("--samples", "-s", required=True, type=click.Path(exists=True), help="样本数据CSV文件")
@click.option("--aliases", "-a", type=click.Path(exists=True), help="单位别名YAML文件")
@click.option("--thresholds", "-t", type=click.Path(exists=True), help="阈值配置JSON文件")
@click.option("--markdown", "-m", type=click.Path(), help="输出Markdown报告文件")
@click.option("--csv", "-c", type=click.Path(), help="输出CSV明细文件")
@click.pass_context
def export(ctx, samples, aliases, thresholds, markdown, csv):
    """导出分析结果为Markdown报告和CSV明细"""
    click.echo("正在导出数据...")
    
    try:
        guardian = Guardian(
            samples_file=samples,
            alias_file=aliases,
            threshold_file=thresholds,
        )
        
        guardian.analyze()
        
        if markdown:
            guardian.export_markdown(markdown)
            click.echo(f"✓ Markdown报告已保存到: {markdown}")
        
        if csv:
            guardian.export_csv(csv)
            click.echo(f"✓ CSV明细已保存到: {csv}")
        
        if not markdown and not csv:
            click.echo("警告: 未指定输出格式，请使用 --markdown 或 --csv 选项")
        
    except Exception as e:
        click.echo(f"✗ 导出失败: {e}", err=True)
        raise click.Abort()


if __name__ == "__main__":
    cli()
