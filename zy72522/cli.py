import click
import pandas as pd
from core import ColumnAmbiguityAnalyzer
from pathlib import Path

analyzer = ColumnAmbiguityAnalyzer()

@click.group()
def cli():
    """表格问答列名歧义分析工具"""
    pass

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='输出分析结果到文件')
def analyze(file_path, output):
    """导入人工改判表并分析，标出低置信度样本被平均指标盖住"""
    click.echo(f"📂 加载文件: {file_path}")
    df = analyzer.load_manual_review(file_path)
    click.echo(f"✅ 加载完成，共 {len(df)} 条样本")
    
    result = analyzer.analyze(df)
    
    click.echo("\n" + "=" * 60)
    click.echo("📊 分析结果概览")
    click.echo("=" * 60)
    click.echo(f"总样本数:     {result.metrics['total_samples']}")
    click.echo(f"低置信度数:   {result.metrics['low_confidence_count']}")
    click.echo(f"⚠️  被掩盖数:   {result.metrics['masked_count']}")
    if result.metrics['accuracy']:
        click.echo(f"整体准确率:   {result.metrics['accuracy']:.1%}")
    
    if len(result.masked_low_conf) > 0:
        click.echo("\n" + "=" * 60)
        click.echo("🚨 低置信度样本被平均指标盖住（需知识库编辑复核）")
        click.echo("=" * 60)
        for _, row in result.masked_low_conf.iterrows():
            click.echo(f"  样本 {row['sample_id']}: {row['question']}")
            click.echo(f"    置信度: {row['confidence']:.2f} | 列名: {row['column_name']}")
            click.echo(f"    原因: {row['_mask_reason']}")
    
    click.echo("\n" + "=" * 60)
    click.echo("📈 版本对比")
    click.echo("=" * 60)
    if not result.version_summary.empty:
        click.echo(result.version_summary.to_string(index=False))
    
    if output:
        result.data.to_csv(output, index=False)
        click.echo(f"\n💾 完整结果已保存到: {output}")

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--model', '-m', required=True, help='模型版本')
@click.option('--prompt', '-p', required=True, help='提示词版本号')
@click.option('--output', '-o', type=click.Path(), help='输出补录后的文件')
def fill_prompt(file_path, model, prompt, output):
    """补录提示词版本号，然后重跑分析"""
    click.echo(f"📂 加载文件: {file_path}")
    df = analyzer.load_manual_review(file_path)
    
    df_filled = analyzer.fill_prompt_version(df, model, prompt)
    click.echo(f"✅ 已为模型 {model} 补录 prompt 版本 {prompt}")
    
    result = analyzer.analyze(df_filled)
    
    click.echo("\n📈 更新后版本对比:")
    if not result.version_summary.empty:
        click.echo(result.version_summary.to_string(index=False))
    
    if output:
        df_filled.to_csv(output, index=False)
        click.echo(f"\n💾 已保存到: {output}")

@cli.command()
def demo():
    """运行完整演示流程（三步）"""
    SAMPLE_DIR = Path(__file__).parent / "sample_data"
    
    click.echo("=" * 70)
    click.echo("🎬 演示流程：表格问答列名歧义分析")
    click.echo("=" * 70)
    
    click.echo("\n📍 【第一步】导入人工改判表")
    click.echo("-" * 70)
    df = analyzer.load_manual_review(str(SAMPLE_DIR / "manual_review_initial.csv"))
    result = analyzer.analyze(df)
    click.echo(f"总样本: {result.metrics['total_samples']} | 低置信度: {result.metrics['low_confidence_count']} | 被掩盖: {result.metrics['masked_count']}")
    click.echo("\n被掩盖样本:")
    for _, row in result.masked_low_conf.iterrows():
        click.echo(f"  S006: 置信度 {row['confidence']:.2f} - {row['_mask_reason']}")
    
    click.echo("\n📍 【第二步】补录提示词版本号 (gpt-4-v1 → p-v1)")
    click.echo("-" * 70)
    df_filled = analyzer.fill_prompt_version(df, 'gpt-4-v1', 'p-v1')
    result_filled = analyzer.analyze(df_filled)
    click.echo(result_filled.version_summary.to_string(index=False))
    
    click.echo("\n📍 【第三步】人工修正重跑后完整对比")
    click.echo("-" * 70)
    df_final = analyzer.load_manual_review(str(SAMPLE_DIR / "manual_review_after_fix.csv"))
    result_final = analyzer.analyze(df_final)
    click.echo(result_final.version_summary.to_string(index=False))
    
    click.echo("\n" + "=" * 70)
    click.echo("🔍 三种处理结果对比:")
    click.echo("=" * 70)
    click.echo("✅ S001 顺利通过: 高置信度+正确，无问题")
    click.echo("⚠️  S006 被平均掩盖: 组准确率高掩盖低置信度，留知识库编辑复核")
    click.echo("🔧 S016 人工修正重跑: 原列名歧义，修正后重跑，从旧口径补来")
    click.echo("\n✅ 演示完成！")

if __name__ == '__main__':
    cli()
