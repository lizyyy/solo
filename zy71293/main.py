#!/usr/bin/env python3
import sys
from models import PatientPriority
from simulator import SimulationConfig, MonteCarloSimulator, ParameterValidator
from strategies import STRATEGY_CLASSES
from metrics import MetricsAnalyzer
from analyzer import StrategyComparator, ChartExporter
from version_manager import ConfigVersionManager, ReportGenerator


def print_header(title: str):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def demo_parameter_validation():
    print_header("演示1: 参数验证（会失败的操作）")
    print("\n尝试配置一个明显不合理的参数...")
    
    bad_config = SimulationConfig(
        num_patients=-100,
        num_windows=0,
        arrival_rate=-5.0,
        avg_service_time=-10.0,
        std_service_time=-3.0,
        sim_duration=0,
    )
    
    print(f"\n配置内容:")
    print(f"  患者数量: {bad_config.num_patients}")
    print(f"  窗口数量: {bad_config.num_windows}")
    print(f"  到达率: {bad_config.arrival_rate}")
    print(f"  平均服务时间: {bad_config.avg_service_time}")
    print(f"  服务时间标准差: {bad_config.std_service_time}")
    print(f"  模拟时长: {bad_config.sim_duration}")
    
    validation = ParameterValidator.validate(bad_config)
    
    print(f"\n验证结果: {'✗ 失败' if not validation.is_valid else '✓ 通过'}")
    if validation.errors:
        print("\n❌ 错误原因:")
        for err in validation.errors:
            print(f"   - {err}")
    if validation.warnings:
        print("\n⚠️  警告:")
        for warn in validation.warnings:
            print(f"   - {warn}")
    
    print("\n💡 说明: 系统拦住了这些不合理的参数，避免无意义的计算。")
    return not validation.is_valid


def demo_strategy_comparison():
    print_header("演示2: 叫号策略对比")
    print("\n门诊主任想比较不同叫号规则的效果...")
    
    base_config = SimulationConfig(
        num_patients=200,
        num_windows=3,
        arrival_rate=2.5,
        avg_service_time=8.0,
        std_service_time=3.0,
        sim_duration=480.0,
        random_seed=42,
        strategy_name='FCFS',
    )
    
    validation = ParameterValidator.validate(base_config)
    if not validation.is_valid:
        print("参数验证失败!")
        return False
    
    if validation.warnings:
        print("\n⚠️  参数警告:")
        for warn in validation.warnings:
            print(f"   - {warn}")
    
    print(f"\n基础配置:")
    print(f"  患者数量: {base_config.num_patients}")
    print(f"  窗口数量: {base_config.num_windows}")
    print(f"  到达率: {base_config.arrival_rate}人/分钟")
    print(f"  平均服务时间: {base_config.avg_service_time}分钟")
    print(f"  随机种子: {base_config.random_seed} (结果可复现)")
    
    strategies = ['FCFS', 'Priority', 'WaitTimePriority', 'MLFQ']
    
    print(f"\n对比策略: {', '.join(strategies)}")
    print(f"模拟中... (每策略30次蒙特卡洛试验)")
    
    result = StrategyComparator.compare_strategies(
        base_config, strategies, num_runs=30
    )
    
    print(f"\n{'=' * 60}")
    print("策略对比结果:")
    print(f"{'=' * 60}")
    print(result.comparison_df.to_string(index=False))
    
    best_strategy, best_value = result.get_best_strategy('P95等待')
    print(f"\n🏆 最佳策略 (按P95等待时间): {best_strategy} ({best_value:.2f}分钟)")
    
    print("\n📊 导出图表...")
    charts = ChartExporter.export_all_charts(result)
    for name, path in charts.items():
        print(f"   - {name}: {path}")
    
    print("\n📋 生成Excel报告...")
    reporter = ReportGenerator()
    report_path = reporter.generate_comparison_report(result, 'strategy_comparison.xlsx')
    print(f"   报告: {report_path}")
    
    return True


def demo_window_scaling():
    print_header("演示3: 护士台增派人手效果分析")
    print("\n门诊主任问: 增加1个窗口能缩短长尾等待吗?")
    
    base_config = SimulationConfig(
        num_patients=300,
        num_windows=3,
        arrival_rate=3.0,
        avg_service_time=9.0,
        std_service_time=4.0,
        sim_duration=480.0,
        random_seed=12345,
        strategy_name='FCFS',
    )
    
    validation = ParameterValidator.validate(base_config)
    if not validation.is_valid:
        print("参数验证失败!")
        return False
    
    traffic_intensity = base_config.arrival_rate * base_config.avg_service_time / base_config.num_windows
    print(f"\n当前情况:")
    print(f"  窗口数量: {base_config.num_windows}")
    print(f"  交通强度: {traffic_intensity:.2f} (建议 < 0.9)")
    
    window_counts = [2, 3, 4, 5]
    print(f"\n测试窗口数量: {window_counts}")
    print(f"模拟中... (每配置20次蒙特卡洛试验)")
    
    result = StrategyComparator.compare_window_counts(
        base_config, window_counts, num_runs=20
    )
    
    print(f"\n{'=' * 60}")
    print("窗口数对比结果:")
    print(f"{'=' * 60}")
    print(result.comparison_df.to_string(index=False))
    
    df = result.comparison_df
    baseline_p95 = df.iloc[1]['P95等待']
    improved_p95 = df.iloc[2]['P95等待']
    improvement = (baseline_p95 - improved_p95) / baseline_p95 * 100
    
    print(f"\n📈 分析结论:")
    print(f"  3窗口时P95等待: {baseline_p95:.2f}分钟")
    print(f"  4窗口时P95等待: {improved_p95:.2f}分钟")
    print(f"  改善幅度: {improvement:.1f}%")
    
    if improvement > 20:
        print(f"  ✅ 建议: 增加1个窗口能显著缩短长尾等待!")
    else:
        print(f"  ⚠️  建议: 改善有限，可考虑优化叫号策略。")
    
    print("\n📊 导出窗口扩展分析图表...")
    charts = ChartExporter.export_all_charts(result)
    for name, path in charts.items():
        print(f"   - {name}: {path}")
    
    return True


def demo_version_management():
    print_header("演示4: 参数版本管理")
    print("\n备注和回执经常最后才补，不要丢版本...")
    
    version_manager = ConfigVersionManager()
    
    config1 = SimulationConfig(
        num_patients=150,
        num_windows=3,
        arrival_rate=2.0,
        avg_service_time=10.0,
        random_seed=999,
        notes="初稿 - 等待主任确认",
    )
    
    version1 = version_manager.save_config(config1)
    print(f"\n✓ 保存版本1: {version1.version_id}")
    print(f"  备注: {version1.notes}")
    
    config2 = SimulationConfig(
        num_patients=200,
        num_windows=4,
        arrival_rate=2.5,
        avg_service_time=8.0,
        random_seed=999,
        notes="第二稿 - 调整窗口数",
    )
    
    version2 = version_manager.save_config(config2)
    print(f"✓ 保存版本2: {version2.version_id}")
    print(f"  备注: {version2.notes}")
    
    print(f"\n补填回执信息到版本1...")
    version_manager.update_receipt(version1.version_id, "主任已阅，同意增加1个窗口")
    version_manager.update_notes(version1.version_id, "终稿 - 已批")
    
    print(f"\n版本列表 (最新在前):")
    versions = version_manager.list_versions()
    for v in versions[:3]:
        print(f"  {v.version_id[:15]}... | 备注: {v.notes or '(无)'} | 回执: {v.receipt_info or '(无)'}")
    
    print(f"\n💡 说明: 支持后补备注和回执，版本不丢失。")
    return True


def demo_issue_severity():
    print_header("演示5: 问题轻重分级")
    print("\n当随机种子不固定、极端等待、窗口休息漏算同时发生...")
    
    bad_config = SimulationConfig(
        num_patients=500,
        num_windows=2,
        arrival_rate=4.0,
        avg_service_time=10.0,
        std_service_time=5.0,
        sim_duration=480.0,
        random_seed=None,
        strategy_name='FCFS',
        window_breaks=[[(120, 180)]],
    )
    
    validation = ParameterValidator.validate(bad_config)
    print("\n参数警告:")
    for warn in validation.warnings:
        print(f"  ⚠️  {warn}")
    
    print("\n运行单次模拟...")
    simulator = MonteCarloSimulator(bad_config)
    from strategies import create_strategy
    strategy = create_strategy(bad_config.strategy_name, **bad_config.strategy_params)
    result = simulator.run_single(strategy)
    
    metrics, issues = MetricsAnalyzer.analyze_single_result(result)
    
    print(f"\n🔍 发现 {len(issues)} 个问题，按严重程度分级:")
    for issue in issues:
        icon = "🔴" if issue.level.value == "严重" else "🟡" if issue.level.value == "警告" else "🔵"
        print(f"\n  {icon} [{issue.level.value}] {issue.category}")
        print(f"     描述: {issue.message}")
        print(f"     影响: {issue.impact}")
    
    print(f"\n💡 说明: 问题按严重程度排序，🔴最严重，需优先处理。")
    return True


def print_usage():
    print_header("门诊排队蒙特卡洛试算系统")
    print("\n📋 启动方式:")
    print("  python main.py              # 运行全部演示")
    print("  python main.py validation   # 演示参数验证失败")
    print("  python main.py strategy     # 演示策略对比")
    print("  python main.py scaling      # 演示窗口扩展分析")
    print("  python main.py version      # 演示版本管理")
    print("  python main.py severity     # 演示问题分级")
    print("\n🎯 样例入口:")
    print("  1. 对比叫号策略: python main.py strategy")
    print("  2. 分析增派人手: python main.py scaling")
    print("\n❌ 会失败的操作:")
    print("  python main.py validation   # 故意传入不合理参数，验证拦截机制")
    print("\n📁 模块说明:")
    print("  models.py        - 患者、窗口、队列模型")
    print("  strategies.py    - 5种叫号策略实现")
    print("  simulator.py     - 蒙特卡洛模拟引擎和参数验证")
    print("  metrics.py       - 长尾指标和问题分级")
    print("  analyzer.py      - 策略对比和图表导出")
    print("  version_manager.py - 参数版本管理和报告生成")


def main():
    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()
        
        if cmd == 'validation':
            demo_parameter_validation()
        elif cmd == 'strategy':
            demo_strategy_comparison()
        elif cmd == 'scaling':
            demo_window_scaling()
        elif cmd == 'version':
            demo_version_management()
        elif cmd == 'severity':
            demo_issue_severity()
        else:
            print(f"未知命令: {cmd}")
            print_usage()
    else:
        print_usage()
        
        print("\n" + "=" * 60)
        print("  开始运行全部演示...")
        print("=" * 60)
        
        demo_parameter_validation()
        demo_strategy_comparison()
        demo_window_scaling()
        demo_version_management()
        demo_issue_severity()
        
        print_header("全部演示完成!")
        print("\n📊 生成的文件:")
        print("  - wait_time_distribution.png - 等待时间分布图")
        print("  - window_scaling.png         - 窗口扩展分析图")
        print("  - versions/reports/*.xlsx    - Excel报告")
        print("  - versions/configs/*.json    - 参数版本存档")
        print("\n💡 再次运行: python main.py")


if __name__ == '__main__':
    main()
