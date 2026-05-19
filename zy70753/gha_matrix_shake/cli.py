import click
import sys
from pathlib import Path
from .parser import GitHubActionsLogParser
from .aggregator import MatrixAggregator
from .scoring import ShakeScorer
from .comparison import RerunComparer
from .report import ReportGenerator


@click.group()
def cli():
    """GitHub Actions 矩阵抖动分析工具"""
    pass


@cli.command()
@click.argument('log_path', type=click.Path(exists=True))
@click.option('--output', '-o', default='report.html', help='输出报告路径')
@click.option('--format', '-f', 'fmt', default='html', type=click.Choice(['html', 'csv']), help='输出格式')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def analyze(log_path, output, fmt, verbose):
    """分析日志并生成报告"""
    click.echo(f"🔍 正在解析日志: {log_path}")
    
    parser = GitHubActionsLogParser()
    if Path(log_path).is_dir():
        job_results = parser.parse_directory(log_path)
    else:
        job_results = parser.parse_file(log_path)
    
    if not job_results:
        click.echo("❌ 未找到有效的日志文件")
        sys.exit(1)
    
    click.echo(f"✅ 解析完成，共 {len(job_results)} 个作业记录")
    
    aggregator = MatrixAggregator()
    histories = aggregator.aggregate(job_results)
    click.echo(f"📊 聚合完成，共 {len(histories)} 个矩阵组合")
    
    scorer = ShakeScorer()
    scores = scorer.calculate_scores(histories)
    
    comparer = RerunComparer()
    comparisons = comparer.compare_runs(job_results)
    
    reporter = ReportGenerator()
    
    if fmt == 'html':
        reporter.generate_html(scores, comparisons, job_results, output)
        click.echo(f"🎉 HTML报告已生成: {Path(output).absolute()}")
    else:
        reporter.generate_csv(scores, comparisons, job_results, output)
        click.echo(f"🎉 CSV报告已生成到目录: {Path(output).absolute()}")
    
    if verbose:
        click.echo("\n📋 不稳定组合前10名:")
        for i, score in enumerate(scores[:10]):
            if score.grade in ['F', 'D', 'C']:
                click.echo(f"  {i+1}. [{score.grade}] {score.matrix_key} - {score.overall_score:.1f}分")


@cli.command()
@click.argument('log_path', type=click.Path(exists=True))
def list(log_path):
    """列出解析到的矩阵配置"""
    parser = GitHubActionsLogParser()
    if Path(log_path).is_dir():
        job_results = parser.parse_directory(log_path)
    else:
        job_results = parser.parse_file(log_path)
    
    aggregator = MatrixAggregator()
    histories = aggregator.aggregate(job_results)
    
    click.echo("📋 矩阵配置列表:")
    for key in sorted(histories.keys()):
        h = histories[key]
        click.echo(f"  {key}: {h.success_count}/{h.total_runs} 成功 ({h.success_rate*100:.1f}%)")


@cli.command()
@click.argument('log_path', type=click.Path(exists=True))
@click.option('--threshold', '-t', type=float, default=60.0, help='评分阈值')
def unstable(log_path, threshold):
    """显示不稳定的矩阵组合"""
    parser = GitHubActionsLogParser()
    if Path(log_path).is_dir():
        job_results = parser.parse_directory(log_path)
    else:
        job_results = parser.parse_file(log_path)
    
    aggregator = MatrixAggregator()
    histories = aggregator.aggregate(job_results)
    
    scorer = ShakeScorer()
    scores = scorer.calculate_scores(histories)
    
    unstable_scores = [s for s in scores if s.overall_score < threshold]
    
    click.echo(f"⚠️  不稳定矩阵组合 (评分 < {threshold}):")
    for score in unstable_scores:
        click.echo(f"  [{score.grade}] {score.matrix_key}")
        click.echo(f"      评分: {score.overall_score:.1f}, 成功率: {score.success_count}/{score.total_runs}")
        if score.flags:
            click.echo(f"      标记: {', '.join(score.flags)}")


def main():
    cli()


if __name__ == '__main__':
    main()
