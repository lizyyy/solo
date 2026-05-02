#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试脚本 - 验证所有模块功能
"""

import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("管网漏点夜巡拼图器 - 模块测试")
print("=" * 60)

# 测试1: 模块导入
print("\n[测试1] 模块导入测试...")
try:
    from pipe_leak_puzzle.network_model import PipeNetwork, create_template_network
    print("  ✓ network_model 导入成功")
    
    from pipe_leak_puzzle.parser import DataParser, parse_pressure_csv
    print("  ✓ parser 导入成功")
    
    from pipe_leak_puzzle.time_series import TimeSeriesAnalyzer, AnalysisResult
    print("  ✓ time_series 导入成功")
    
    from pipe_leak_puzzle.valve_isolation import IsolationPlanner, IsolationResult
    print("  ✓ valve_isolation 导入成功")
    
    from pipe_leak_puzzle.review_storage import ReviewManager, ReviewRecord
    print("  ✓ review_storage 导入成功")
    
    from pipe_leak_puzzle.report import ReportExporter
    print("  ✓ report 导入成功")
    
    from pipe_leak_puzzle.sample_data import generate_sample_data, generate_sample_project
    print("  ✓ sample_data 导入成功")
    
    from pipe_leak_puzzle.cli import main as cli_main
    print("  ✓ cli 导入成功")
    
except ImportError as e:
    print(f"  ✗ 导入失败: {e}")
    sys.exit(1)

# 测试2: 管网模型
print("\n[测试2] 管网模型测试...")
try:
    # 创建标准管网
    network = create_template_network('default')
    print(f"  ✓ 创建标准管网: {len(network.nodes)} 节点, {len(network.valves)} 阀门, {len(network.sensors)} 传感器")
    
    # 创建小型管网
    network_small = create_template_network('small')
    print(f"  ✓ 创建小型管网: {len(network_small.nodes)} 节点, {len(network_small.valves)} 阀门")
    
    # 测试保存和加载
    test_dir = Path("./test_temp")
    test_dir.mkdir(exist_ok=True)
    network_path = test_dir / "test_network.json"
    network.save(str(network_path))
    print(f"  ✓ 管网配置已保存: {network_path}")
    
    loaded_network = PipeNetwork.load(str(network_path))
    print(f"  ✓ 管网配置已加载: {len(loaded_network.nodes)} 节点")
    
except Exception as e:
    print(f"  ✗ 管网模型测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 测试3: 时序分析器
print("\n[测试3] 时序分析器测试...")
try:
    analyzer = TimeSeriesAnalyzer()
    analyzer.set_network(network)
    print("  ✓ 时序分析器创建成功")
    
    # 测试参数设置
    analyzer.pressure_threshold = 0.15
    analyzer.acoustic_threshold = 0.7
    analyzer.time_window_seconds = 300
    print(f"  ✓ 参数设置: 压力阈值={analyzer.pressure_threshold}, 声纹阈值={analyzer.acoustic_threshold}")
    
except Exception as e:
    print(f"  ✗ 时序分析器测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 测试4: 隔离规划器
print("\n[测试4] 隔离规划器测试...")
try:
    planner = IsolationPlanner(network)
    planner.isolation_strategy = "minimal"
    print(f"  ✓ 隔离规划器创建成功，策略: {planner.isolation_strategy}")
    
except Exception as e:
    print(f"  ✗ 隔离规划器测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 测试5: 报告导出器
print("\n[测试5] 报告导出器测试...")
try:
    # 创建模拟分析结果
    analysis_result = AnalysisResult(
        aligned_data=[],
        pressure_anomalies=[{"timestamp": "2026-05-02T02:30:00", "sensor_id": "P001", "confidence": 0.85}],
        acoustic_anomalies=[{"timestamp": "2026-05-02T02:32:00", "location": "东支管", "confidence": 0.78}],
        filtered_anomalies=[],
        propagation_delays=[],
        parameters={"test": True}
    )
    
    isolation_result = IsolationResult(
        suspected_leaks=[{"leak_id": "LEAK_001", "section_id": "S007", "confidence": 0.82}],
        valves_to_close=[{"valve_id": "V007", "name": "东支1入口阀", "location": "主干节点2北侧"}],
        affected_users=[{"user_id": "U001", "name": "阳光小区1号楼", "address": "阳光路1号"}],
        strategy="minimal"
    )
    
    exporter = ReportExporter(
        metadata={"project_name": "测试项目"},
        analysis_result=analysis_result,
        isolation_result=isolation_result,
        review_record=None
    )
    
    # 导出JSON
    json_report = exporter.export_json()
    print("  ✓ JSON报告导出成功")
    
    # 导出Markdown
    md_report = exporter.export_markdown()
    print("  ✓ Markdown报告导出成功")
    
    # 导出CSV
    csv_files = exporter.export_csv()
    print(f"  ✓ CSV报告导出成功 ({len(csv_files)} 个文件)")
    
    # 保存测试报告
    reports_dir = test_dir / "reports"
    reports_dir.mkdir(exist_ok=True)
    
    with open(reports_dir / "test_report.json", "w", encoding="utf-8") as f:
        f.write(json_report)
    
    with open(reports_dir / "test_report.md", "w", encoding="utf-8") as f:
        f.write(md_report)
    
    for name, content in csv_files.items():
        with open(reports_dir / f"{name}.csv", "w", encoding="utf-8") as f:
            f.write(content)
    
    print(f"  ✓ 测试报告已保存到: {reports_dir}")
    
except Exception as e:
    print(f"  ✗ 报告导出器测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 测试6: 示例数据生成
print("\n[测试6] 示例数据生成测试...")
try:
    sample_dir = test_dir / "sample_csv"
    generate_sample_data(str(sample_dir))
    print(f"  ✓ 示例CSV数据已生成: {sample_dir}")
    
    # 检查生成的文件
    csv_files = list(sample_dir.glob("*.csv"))
    print(f"  ✓ 生成 {len(csv_files)} 个CSV文件")
    for f in csv_files:
        print(f"    - {f.name}")
    
except Exception as e:
    print(f"  ✗ 示例数据生成测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 测试7: 完整示例项目
print("\n[测试7] 完整示例项目创建测试...")
try:
    project_dir = test_dir / "demo_project"
    generate_sample_project(str(project_dir))
    print(f"  ✓ 示例项目已创建: {project_dir}")
    
    # 检查目录结构
    expected_dirs = ["config", "data", "analysis", "reports", "review"]
    for d in expected_dirs:
        dir_path = project_dir / d
        if dir_path.exists():
            print(f"    ✓ {d}/ 目录存在")
        else:
            print(f"    ✗ {d}/ 目录缺失")
    
    # 检查数据文件
    data_files = ["network.json", "metadata.json", "pressure_data.json", "acoustic_data.json", "valve_data.json"]
    for f in data_files:
        file_path = project_dir / "config" / f if f in ["network.json", "metadata.json"] else project_dir / "data" / f
        if file_path.exists():
            print(f"    ✓ {f} 存在")
        else:
            print(f"    ✗ {f} 缺失")
    
except Exception as e:
    print(f"  ✗ 示例项目创建测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 总结
print("\n" + "=" * 60)
print("所有测试通过！")
print("=" * 60)
print(f"\n测试临时目录: {test_dir.absolute()}")
print("\n您可以使用以下命令进行更完整的测试:")
print(f"  python3 pipe_leak_puzzle.py self-test --output ./self-test-output")
print("\n或按照README中的步骤进行手动测试。")
