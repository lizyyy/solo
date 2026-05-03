"""
CLI入口模块 - 命令行界面
"""

import click
import sys
from pathlib import Path
from typing import Optional

from .parser import DataParser
from .analyzer import PumpAnalyzer
from .reporter import ReportExporter


@click.group()
@click.version_option(version='0.1.0')
def cli():
    """工业泵振动模型告警复核工具"""
    pass


@cli.command()
@click.option('--ledger', '-l', type=click.Path(exists=True), help='泵组台账 CSV 文件路径')
@click.option('--features', '-f', type=click.Path(exists=True), help='振动特征 CSV 文件路径')
@click.option('--scores', '-s', type=click.Path(exists=True), help='模型告警分数 JSONL 文件路径')
@click.option('--maintenance', '-m', type=click.Path(exists=True), help='检修记录 YAML 文件路径')
@click.option('--sample', '-S', is_flag=True, help='使用内置示例数据运行')
@click.option('--sample-dir', type=click.Path(exists=True), help='示例数据目录路径')
@click.option('--output', '-o', type=click.Path(), default='./output', help='输出目录路径 (默认: ./output)')
@click.option('--score-threshold', type=float, default=0.6, help='告警分数阈值 (默认: 0.6)')
@click.option('--n-clusters', type=int, default=3, help='聚类数量 (默认: 3)')
@click.option('--verbose', '-v', is_flag=True, help='显示详细输出')
def run(
    ledger: Optional[str],
    features: Optional[str],
    scores: Optional[str],
    maintenance: Optional[str],
    sample: bool,
    sample_dir: Optional[str],
    output: str,
    score_threshold: float,
    n_clusters: int,
    verbose: bool
):
    """
    运行完整的泵振动告警复核分析流程
    
    示例:
        pump-review run --sample -o ./output
        pump-review run -l ledger.csv -f features.csv -s scores.jsonl -m maintenance.yaml
    """
    click.echo("=" * 60)
    click.echo("工业泵振动模型告警复核工具")
    click.echo("=" * 60)
    
    parser = DataParser()
    
    if sample or sample_dir:
        click.echo("\n[1/5] 加载示例数据...")
        if sample_dir:
            click.echo(f"  从目录加载: {sample_dir}")
            parser.load_sample_data(sample_dir)
        else:
            click.echo("  使用内置示例数据")
            parser.load_sample_data()
    else:
        if not all([ledger, features, scores, maintenance]):
            click.echo("\n错误: 必须提供所有数据文件路径或使用 --sample 选项")
            click.echo("\n用法示例:")
            click.echo("  pump-review run --sample                    # 使用内置示例数据")
            click.echo("  pump-review run -l ledger.csv -f features.csv -s scores.jsonl -m maintenance.yaml")
            sys.exit(1)
        
        click.echo("\n[1/5] 解析输入数据...")
        
        click.echo(f"  解析泵组台账: {ledger}")
        parser.parse_pump_ledger(ledger)
        
        click.echo(f"  解析振动特征: {features}")
        parser.parse_vibration_features(features)
        
        click.echo(f"  解析告警分数: {scores}")
        parser.parse_alarm_scores(scores)
        
        click.echo(f"  解析检修记录: {maintenance}")
        parser.parse_maintenance_records(maintenance)
    
    if verbose:
        click.echo(f"\n  泵数量: {len(parser.pump_ledger)}")
        click.echo(f"  振动特征记录数: {len(parser.vibration_features)}")
        click.echo(f"  告警分数记录数: {len(parser.alarm_scores)}")
        click.echo(f"  检修记录数: {len(parser.maintenance_records)}")
    
    click.echo("\n[2/5] 执行分析...")
    analyzer = PumpAnalyzer(
        parser=parser,
        score_threshold=score_threshold,
        n_clusters=n_clusters
    )
    
    results = analyzer.run_full_analysis()
    
    if verbose:
        summary = results.get('summary', {})
        click.echo(f"\n  分析摘要:")
        click.echo(f"    - 总泵数: {summary.get('total_pumps', 0)}")
        click.echo(f"    - 型号数: {summary.get('total_models', 0)}")
        click.echo(f"    - 漂移案例: {summary.get('drift_cases_count', 0)}")
        click.echo(f"    - 边界案例: {summary.get('boundary_cases_count', 0)}")
    
    click.echo("\n[3/5] 导出报告...")
    
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    reporter = ReportExporter(analyzer=analyzer)
    
    drift_csv_path = output_path / "drift_cases.csv"
    reporter.export_drift_cases_csv(str(drift_csv_path))
    
    boundary_csv_path = output_path / "boundary_cases.csv"
    reporter.export_boundary_cases_csv(str(boundary_csv_path))
    
    report_path = output_path / "pump_drift_review.md"
    reporter.generate_markdown_report(str(report_path))
    
    click.echo("\n[4/5] 分析完成!")
    click.echo("=" * 60)
    
    drift_cases = analyzer.get_drift_cases_df()
    boundary_cases = analyzer.get_boundary_cases_df()
    
    click.echo(f"\n检测结果摘要:")
    click.echo(f"  - 漂移案例数: {len(drift_cases)}")
    click.echo(f"  - 边界案例数: {len(boundary_cases)}")
    
    if not drift_cases.empty:
        significant = drift_cases[drift_cases['is_significant'] == True]
        if not significant.empty:
            click.echo(f"\n  ⚠️  显著漂移泵: {', '.join(significant['pump_id'].tolist())}")
    
    click.echo(f"\n输出文件:")
    click.echo(f"  - 漂移案例: {drift_csv_path}")
    click.echo(f"  - 边界案例: {boundary_csv_path}")
    click.echo(f"  - 复核报告: {report_path}")
    
    click.echo("\n" + "=" * 60)


@cli.command()
@click.option('--output', '-o', type=click.Path(), default='./sample_data', help='示例数据输出目录')
def generate_sample(output: str):
    """
    生成示例数据文件，用于测试
    
    创建:
    - pump_ledger.csv: 泵组台账
    - vibration_features.csv: 振动特征数据
    - alarm_scores.jsonl: 模型告警分数
    - maintenance_records.yaml: 检修记录
    """
    import json
    import yaml
    import numpy as np
    from datetime import datetime, timedelta
    
    click.echo(f"生成示例数据到: {output}")
    
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    np.random.seed(42)
    
    pump_models = ['Model-A', 'Model-B', 'Model-C']
    pump_ids = [f'PUMP-{i:03d}' for i in range(1, 7)]
    
    ledger_data = {
        'pump_id': pump_ids,
        'pump_name': [f'离心泵-{i}' for i in range(1, 7)],
        'model': [pump_models[i % 3] for i in range(6)],
        'location': ['1号车间', '1号车间', '2号车间', '2号车间', '3号车间', '3号车间'],
        'install_date': [
            '2022-01-15', '2022-04-20', '2022-07-10',
            '2022-10-05', '2023-01-12', '2023-04-18'
        ],
        'rated_power': [75, 75, 110, 110, 55, 55],
        'rated_flow': [300, 300, 450, 450, 200, 200],
        'status': ['运行', '运行', '运行', '备用', '运行', '运行']
    }
    
    ledger_df = pd.DataFrame(ledger_data)
    ledger_file = output_path / "pump_ledger.csv"
    ledger_df.to_csv(ledger_file, index=False, encoding='utf-8-sig')
    click.echo(f"  ✓ 泵组台账: {ledger_file}")
    
    start_time = datetime(2024, 1, 1, 0, 0, 0)
    timestamps = [start_time + timedelta(hours=i) for i in range(168)]
    
    vibration_records = []
    for pump_id in pump_ids:
        pump_idx = int(pump_id.split('-')[1]) - 1
        model = pump_models[pump_idx % 3]
        
        base_rms = {'Model-A': 2.5, 'Model-B': 3.0, 'Model-C': 2.0}[model]
        
        for ts in timestamps:
            hour = ts.hour
            is_night = hour < 6 or hour >= 22
            
            noise = np.random.normal(0, 0.3, 3)
            
            if pump_id == 'PUMP-004':
                if ts > datetime(2024, 1, 5):
                    current_base = base_rms * 1.8
                    noise = np.random.normal(0, 0.8, 3)
                else:
                    current_base = base_rms
            else:
                current_base = base_rms
            
            record = {
                'pump_id': pump_id,
                'timestamp': ts.strftime('%Y-%m-%d %H:%M:%S'),
                'rms_x': round(current_base + noise[0] + (0.5 if is_night else 0), 4),
                'rms_y': round(current_base * 1.2 + noise[1] + (0.3 if is_night else 0), 4),
                'rms_z': round(current_base * 0.8 + noise[2], 4),
                'peak_x': round(current_base * 3 + np.random.normal(0, 0.5), 4),
                'peak_y': round(current_base * 3.5 + np.random.normal(0, 0.6), 4),
                'peak_z': round(current_base * 2.5 + np.random.normal(0, 0.4), 4),
                'kurtosis_x': round(3.0 + np.random.normal(0, 0.5) + (1.0 if pump_id == 'PUMP-004' and ts > datetime(2024, 1, 5) else 0), 4),
                'kurtosis_y': round(3.2 + np.random.normal(0, 0.6), 4),
                'kurtosis_z': round(2.8 + np.random.normal(0, 0.4), 4),
                'crest_factor': round(3.0 + np.random.normal(0, 0.3), 4)
            }
            vibration_records.append(record)
    
    vibration_df = pd.DataFrame(vibration_records)
    vibration_file = output_path / "vibration_features.csv"
    vibration_df.to_csv(vibration_file, index=False, encoding='utf-8-sig')
    click.echo(f"  ✓ 振动特征: {vibration_file}")
    
    alarm_records = []
    for pump_id in pump_ids:
        pump_idx = int(pump_id.split('-')[1]) - 1
        
        for i, ts in enumerate(timestamps[::4]):
            base_score = 0.1 + np.random.normal(0, 0.05)
            
            if pump_id == 'PUMP-004':
                if ts > datetime(2024, 1, 5):
                    base_score = 0.7 + np.random.normal(0, 0.1)
                else:
                    base_score = 0.2 + np.random.normal(0, 0.05)
            
            if pump_id == 'PUMP-002':
                if ts > datetime(2024, 1, 3) and ts < datetime(2024, 1, 4):
                    base_score = 0.85
            
            record = {
                'pump_id': pump_id,
                'timestamp': ts.strftime('%Y-%m-%d %H:%M:%S'),
                'score': round(min(max(base_score, 0), 1), 4),
                'threshold': 0.6,
                'model_version': 'v1.2.0'
            }
            alarm_records.append(record)
    
    alarm_file = output_path / "alarm_scores.jsonl"
    with open(alarm_file, 'w', encoding='utf-8') as f:
        for record in alarm_records:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')
    click.echo(f"  ✓ 告警分数: {alarm_file}")
    
    maintenance_data = {
        'maintenance_records': [
            {
                'pump_id': 'PUMP-004',
                'maintenance_date': '2024-01-03',
                'maintenance_type': '预防性维护',
                'description': '常规检查，润滑脂补充，振动检测',
                'technician': '李四',
                'status': 'completed',
                'next_maintenance_date': '2024-07-03'
            },
            {
                'pump_id': 'PUMP-002',
                'maintenance_date': '2024-01-05',
                'maintenance_type': '纠正性维护',
                'description': '轴承更换，密封检查，联轴器对中',
                'technician': '王五',
                'status': 'completed',
                'next_maintenance_date': '2024-07-05'
            }
        ]
    }
    
    maintenance_file = output_path / "maintenance_records.yaml"
    with open(maintenance_file, 'w', encoding='utf-8') as f:
        yaml.dump(maintenance_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    click.echo(f"  ✓ 检修记录: {maintenance_file}")
    
    click.echo("\n示例数据生成完成!")
    click.echo(f"\n使用示例数据运行分析:")
    click.echo(f"  pump-review run --sample-dir {output} -o ./output")
    click.echo(f"\n或直接使用内置示例数据:")
    click.echo(f"  pump-review run --sample -o ./output")


@cli.command()
@click.argument('output_dir', type=click.Path())
@click.option('--sample-dir', type=click.Path(exists=True), help='示例数据目录(可选)')
def demo(output_dir: str, sample_dir: Optional[str]):
    """
    运行演示模式
    
    这是一个便捷命令，使用示例数据运行完整分析流程
    
    示例:
        pump-review demo ./output
        pump-review demo ./output --sample-dir ./my_sample_data
    """
    import subprocess
    
    click.echo("=" * 60)
    click.echo("泵振动告警复核工具 - 演示模式")
    click.echo("=" * 60)
    
    cmd = [sys.executable, '-m', 'pump_review.cli', 'run']
    
    if sample_dir:
        cmd.extend(['--sample-dir', sample_dir])
    else:
        cmd.append('--sample')
    
    cmd.extend(['-o', output_dir, '-v'])
    
    click.echo(f"\n执行命令: {' '.join(cmd)}")
    click.echo("\n" + "=" * 60)
    
    result = subprocess.run(cmd, cwd=Path(__file__).parent.parent.parent)
    
    if result.returncode == 0:
        click.echo("\n✓ 演示完成!")
        click.echo(f"\n输出文件位于: {output_dir}/")
        click.echo("  - drift_cases.csv: 漂移案例详情")
        click.echo("  - boundary_cases.csv: 边界案例详情")
        click.echo("  - pump_drift_review.md: 完整复核报告")
    else:
        click.echo(f"\n✗ 演示执行失败，返回码: {result.returncode}")
        sys.exit(result.returncode)


def main():
    """主入口函数"""
    cli()


if __name__ == '__main__':
    main()
