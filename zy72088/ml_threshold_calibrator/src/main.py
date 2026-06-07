import click
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.calibration_engine import CalibrationEngine
from src.data_handler import DataHandler


@click.group()
def cli():
    """机器学习阈值校准工具 - 专为运营分析师阿乔打造"""
    pass


@cli.command()
@click.option('--param-table', '-p', required=True, help='参数表文件路径 (CSV/Excel)')
@click.option('--historical', '-H', default=None, help='历史记录文件路径 (可选)')
@click.option('--manual-notes', '-m', default=None, help='人工备注文件路径 (可选)')
@click.option('--samples', '-s', default=None, help='样本数据文件路径 (可选)')
@click.option('--import-data', '-i', default=None, help='待对比导入数据文件路径 (可选)')
@click.option('--output-dir', '-o', default='output', help='输出目录')
@click.option('--prefix', default='calibration', help='输出文件前缀')
def calibrate(param_table, historical, manual_notes, samples, import_data, output_dir, prefix):
    """执行阈值校准"""
    
    click.echo("=" * 60)
    click.echo("🚀 机器学习阈值校准工具启动")
    click.echo("=" * 60)
    
    engine = CalibrationEngine()
    handler = DataHandler(output_dir=output_dir)
    
    click.echo(f"\n📊 加载参数表: {param_table}")
    param_df = handler.load_data(param_table)
    engine.load_parameter_table(param_df)
    click.echo(f"   已加载 {len(engine.records)} 个指标")
    
    if historical:
        click.echo(f"\n📜 加载历史记录: {historical}")
        hist_df = handler.load_data(historical)
        engine.load_historical_records(hist_df)
        from_history = sum(1 for r in engine.records.values() if r.status.value == "历史口径补全")
        click.echo(f"   从历史口径补全 {from_history} 个指标")
    
    if manual_notes:
        click.echo(f"\n📝 加载人工备注: {manual_notes}")
        notes_df = handler.load_data(manual_notes)
        engine.load_manual_notes(notes_df)
        manual_count = sum(1 for r in engine.records.values() if r.manual_adjusted)
        click.echo(f"   标记为人工调整的有 {manual_count} 个指标")
    
    if samples:
        click.echo(f"\n📈 加载样本数据: {samples}")
        sample_df = handler.load_data(samples)
        engine.load_sample_data(sample_df)
        click.echo(f"   已加载 {len(sample_df)} 条样本记录")
    
    conflicts = []
    if import_data:
        click.echo(f"\n🔍 检测与导入数据的冲突: {import_data}")
        import_df = handler.load_data(import_data)
        conflicts = engine.detect_conflicts(import_df)
        if conflicts:
            click.echo(f"   ⚠️  发现 {len(conflicts)} 处参数冲突")
            for c in conflicts:
                click.echo(f"      - {c['metric_name']}: 参数表={c['param_table_threshold']}, 导入={c['imported_threshold']}")
        else:
            click.echo("   ✅ 未发现冲突")
    
    click.echo("\n🧠 生成校准建议...")
    engine.generate_suggestions()
    
    results_df = engine.get_results_dataframe()
    anomalies_df = engine.get_anomalies_list()
    
    click.echo("\n📋 校准结果统计:")
    status_counts = results_df['状态'].value_counts()
    for status, count in status_counts.items():
        click.echo(f"   {status}: {count} 个指标")
    
    click.echo("\n💾 保存结果...")
    output_files = handler.save_results(results_df, anomalies_df, conflicts, prefix)
    
    click.echo(f"\n✅ 校准完成!")
    click.echo(f"\n📄 输出文件:")
    for key, path in output_files.items():
        if path:
            click.echo(f"   {key}: {path}")
    
    if not anomalies_df.empty:
        click.echo(f"\n⚠️  需要人工处理的异常有 {len(anomalies_df)} 条，请查看 anomalies 文件")
    
    if conflicts:
        click.echo(f"\n⚖️  有 {len(conflicts)} 处参数冲突需要您裁决，请查看 conflicts 文件")
    
    click.echo("\n💡 提示: 人工调整过的参数不会被覆盖，如需重新计算请先在参数表中移除'人工调整过'标记")


@cli.command()
@click.option('--results', '-r', required=True, help='校准结果文件路径')
@click.option('--original-param', '-p', required=True, help='原始参数表文件路径')
@click.option('--output-dir', '-o', default='output', help='输出目录')
@click.option('--preserve-manual/--no-preserve-manual', default=True, help='是否保留人工调整的参数(默认保留)')
def update_params(results, original_param, output_dir, preserve_manual):
    """用校准结果更新参数表"""
    
    click.echo("=" * 60)
    click.echo("🔄 更新参数表")
    click.echo("=" * 60)
    
    handler = DataHandler(output_dir=output_dir)
    
    click.echo(f"\n📊 加载校准结果: {results}")
    results_df = handler.load_data(results)
    
    click.echo(f"\n📜 加载原始参数表: {original_param}")
    
    backup_file = handler.backup_file(original_param)
    if backup_file:
        click.echo(f"   💾 已备份原始文件到: {backup_file}")
    
    click.echo(f"\n✍️  更新参数表{' (保留人工调整参数)' if preserve_manual else ''}...")
    updated_file = handler.save_updated_param_table(results_df, original_param, preserve_manual)
    
    click.echo(f"\n✅ 更新完成!")
    click.echo(f"   新参数表已保存到: {updated_file}")


@cli.command()
@click.option('--output-dir', '-o', default='output', help='输出目录')
def demo(output_dir):
    """运行示例演示"""
    
    click.echo("=" * 60)
    click.echo("🎬 运行机器学习阈值校准演示")
    click.echo("=" * 60)
    
    base_dir = Path(__file__).parent.parent
    
    param_table = base_dir / "data" / "parameter_table.csv"
    historical = base_dir / "data" / "historical_records.csv"
    manual_notes = base_dir / "data" / "manual_notes.csv"
    samples = base_dir / "data" / "outlier_samples.csv"
    import_data = base_dir / "data" / "import_conflict_data.csv"
    
    engine = CalibrationEngine()
    handler = DataHandler(output_dir=output_dir)
    
    click.echo(f"\n1️⃣  加载参数表...")
    param_df = handler.load_data(str(param_table))
    engine.load_parameter_table(param_df)
    click.echo(f"   已加载 {len(engine.records)} 个指标")
    
    click.echo(f"\n2️⃣  加载历史记录...")
    hist_df = handler.load_data(str(historical))
    engine.load_historical_records(hist_df)
    from_history = sum(1 for r in engine.records.values() if r.status.value == "历史口径补全")
    click.echo(f"   从历史口径补全 {from_history} 个指标")
    
    click.echo(f"\n3️⃣  加载人工备注...")
    notes_df = handler.load_data(str(manual_notes))
    engine.load_manual_notes(notes_df)
    manual_count = sum(1 for r in engine.records.values() if r.manual_adjusted)
    click.echo(f"   标记为人工调整的有 {manual_count} 个指标")
    
    click.echo(f"\n4️⃣  加载样本数据...")
    sample_df = handler.load_data(str(samples))
    engine.load_sample_data(sample_df)
    click.echo(f"   已加载 {len(sample_df)} 条样本记录")
    
    click.echo(f"\n5️⃣  检测参数冲突...")
    import_df = handler.load_data(str(import_data))
    conflicts = engine.detect_conflicts(import_df)
    if conflicts:
        click.echo(f"   ⚠️  发现 {len(conflicts)} 处参数冲突")
    else:
        click.echo("   ✅ 未发现冲突")
    
    click.echo(f"\n6️⃣  生成校准建议...")
    engine.generate_suggestions()
    
    results_df = engine.get_results_dataframe()
    anomalies_df = engine.get_anomalies_list()
    
    click.echo(f"\n📋 校准结果统计:")
    status_counts = results_df['状态'].value_counts()
    for status, count in status_counts.items():
        click.echo(f"   {status}: {count} 个指标")
    
    click.echo(f"\n💾 保存结果...")
    output_files = handler.save_results(results_df, anomalies_df, conflicts, "demo")
    
    click.echo(f"\n✅ 演示完成!")
    click.echo(f"\n📄 输出文件:")
    for key, path in output_files.items():
        if path:
            click.echo(f"   {key}: {path}")
    
    click.echo(f"\n✨ 演示包含了五种典型情况:")
    click.echo(f"   1. 顺利通过的记录 (如: 订单取消率)")
    click.echo(f"   2. 需人工确认的记录 (如: 客单价、用户注册转化率)")
    click.echo(f"   3. 从参数表补来的旧口径 (如: 复购率)")
    click.echo(f"   4. 样本越界的记录 (如: 页面加载时间、投诉率)")
    click.echo(f"   5. 参数冲突待裁决的记录 (如: DAU日活用户)")


if __name__ == '__main__':
    cli()
