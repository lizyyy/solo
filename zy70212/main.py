from pathlib import Path
from data_manager import DataManager
from order_matcher import OrderMatcher
from detour_detector import DetourDetector
from report_generator import ReportGenerator


def run_demo():
    print("=" * 60)
    print("城配司机绕路稽核器 - 演示模式")
    print("=" * 60)
    
    dm = DataManager()
    matcher = OrderMatcher(dm)
    detector = DetourDetector()
    reporter = ReportGenerator(dm)
    
    samples_dir = Path(__file__).parent / "samples"
    
    print("\n[步骤1] 生成样例数据...")
    import sys
    import subprocess
    subprocess.run([sys.executable, str(samples_dir / "generate_samples.py")], check=True)
    
    print("\n[步骤2] 导入订单数据...")
    orders_count = dm.import_orders(str(samples_dir / "orders.csv"))
    print(f"  已导入 {orders_count} 条订单")
    
    print("\n[步骤3] 导入轨迹数据...")
    traj1_count = dm.import_trajectories(str(samples_dir / "normal_trajectory.csv"))
    print(f"  正常轨迹: {traj1_count} 个点")
    traj2_count = dm.import_trajectories(str(samples_dir / "anomaly_trajectory.csv"))
    print(f"  异常轨迹: {traj2_count} 个点")
    
    print("\n[步骤4] 订单轨迹匹配...")
    matches = matcher.match_all_orders()
    for m in matches:
        print(f"  {m.order_id}: 匹配分数 {m.match_score:.2%} - {m.match_reason}")
    
    print("\n[步骤5] 绕路检测分析...")
    analyses = []
    match_dict = {m.order_id: m for m in matches}
    for m in matches:
        order = dm.get_order(m.order_id)
        if order and m.matched_trajectories:
            analysis = detector.analyze(m, order)
            if analysis:
                analyses.append(analysis)
                print(f"\n  订单 {m.order_id}:")
                print(f"    风险评分: {analysis.overall_risk_score:.1f}/100")
                for c in analysis.conclusions:
                    print(f"    - {c}")
    
    print("\n[步骤6] 生成分析报告...")
    report = reporter.generate_report(analyses, match_dict, "demo_report")
    print(f"  报告已生成: {report['summary_table']}")
    for order_id, chart_path in report['charts'].items():
        print(f"  {order_id} 图表: {chart_path}")
    
    print("\n[步骤7] 模拟数据变更 - 测试历史记录...")
    print("  修改订单 ORD003 的计划距离...")
    dm.update_order("ORD003", {"planned_distance": 3.5}, "客户补录：发现原始距离有误")
    
    print("  删除订单 ORD003...")
    dm.delete_order("ORD003", "订单取消，客户撤回")
    
    print("\n[步骤8] 查看历史变更记录...")
    history = dm.get_history()
    for h in history[-3:]:
        print(f"  [{h.timestamp.strftime('%H:%M:%S')}] {h.action.upper()} {h.record_type}:{h.record_id} - {h.reason}")
    
    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)
    print(f"\n输出文件位置:")
    print(f"  - 汇总表格: {report['summary_table']}")
    print(f"  - 历史记录: {report.get('history_table', 'N/A')}")
    print(f"  - JSON报告: {Path(report['summary_table']).parent / 'report.json'}")
    for order_id, chart_path in report['charts'].items():
        print(f"  - {order_id} 分析图: {chart_path}")


def run_anomaly_demo():
    print("=" * 60)
    print("城配司机绕路稽核器 - 异常触发路径")
    print("=" * 60)
    
    dm = DataManager()
    matcher = OrderMatcher(dm)
    detector = DetourDetector()
    reporter = ReportGenerator(dm)
    
    samples_dir = Path(__file__).parent / "samples"
    
    print("\n[1] 导入异常订单和轨迹...")
    orders_path = samples_dir / "orders.csv"
    trajectory_path = samples_dir / "anomaly_trajectory.csv"
    
    dm.import_orders(str(orders_path))
    dm.import_trajectories(str(trajectory_path))
    
    print("\n[2] 匹配订单 ORD002 (已知异常)...")
    order = dm.get_order("ORD002")
    match = matcher.match_order(order)
    
    print(f"  匹配结果: {match.match_score:.2%} - {match.match_reason}")
    print(f"  轨迹点数: {len(match.matched_trajectories)}")
    
    print("\n[3] 触发绕路检测...")
    analysis = detector.analyze(match, order)
    
    print(f"\n  检测结果:")
    print(f"    实际距离: {analysis.actual_distance/1000:.2f} km")
    print(f"    计划距离: {analysis.planned_distance/1000:.2f} km")
    print(f"    距离比例: {analysis.distance_ratio:.2%}")
    print(f"    实际时间: {analysis.actual_duration/60:.1f} 分钟")
    print(f"    预期时间: {analysis.expected_duration/60:.1f} 分钟")
    print(f"    时间比例: {analysis.time_ratio:.2%}")
    print(f"    绕行距离: {analysis.detour_distance/1000:.2f} km")
    
    print(f"\n  异常明细:")
    for i, seg in enumerate(analysis.detour_segments, 1):
        print(f"    绕行{i}: {seg.description}")
    
    for i, seg in enumerate(analysis.stationary_segments, 1):
        print(f"    停留{i}: {seg['duration_seconds']/60:.1f}分钟")
    
    print(f"\n  风险评分: {analysis.overall_risk_score:.1f}/100")
    print(f"  结论:")
    for c in analysis.conclusions:
        print(f"    - {c}")
    
    print("\n[4] 生成异常报告...")
    match_dict = {"ORD002": match}
    report = reporter.generate_report([analysis], match_dict, "anomaly_report")
    
    print("\n" + "=" * 60)
    print("异常路径触发完成！")
    print("=" * 60)
    print(f"\n输出: {Path(report['summary_table']).parent}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "anomaly":
        run_anomaly_demo()
    else:
        run_demo()
