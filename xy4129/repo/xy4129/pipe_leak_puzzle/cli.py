# -*- coding: utf-8 -*-
"""
CLI 命令调度器
"""

from pathlib import Path
from datetime import datetime
import json

from .network_model import PipeNetwork, create_template_network
from .parser import DataParser, parse_pressure_csv, parse_acoustic_csv, parse_valve_csv, parse_flow_csv
from .time_series import TimeSeriesAnalyzer, AnalysisResult
from .valve_isolation import IsolationPlanner, IsolationResult
from .review_storage import ReviewManager, ReviewRecord
from .report import ReportExporter
from .sample_data import generate_sample_data, generate_sample_project


def main(args):
    """
    主命令调度函数
    """
    command = args.command
    
    if command == "init":
        cmd_init(args)
    elif command == "import":
        cmd_import(args)
    elif command == "analyze":
        cmd_analyze(args)
    elif command == "plan":
        cmd_plan(args)
    elif command == "review":
        cmd_review(args)
    elif command == "report":
        cmd_report(args)
    elif command == "self-test":
        cmd_self_test(args)
    else:
        raise ValueError(f"未知命令: {command}")


def cmd_init(args):
    """
    初始化项目命令
    """
    project_dir = Path(args.output).absolute()
    template = args.template
    
    print(f"初始化管网项目: {project_dir}")
    print(f"使用模板: {template}")
    
    # 创建项目目录结构
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # 创建子目录
    subdirs = ["config", "data", "analysis", "reports", "review"]
    for subdir in subdirs:
        (project_dir / subdir).mkdir(exist_ok=True)
    
    # 创建管网配置
    network = create_template_network(template_type=template)
    
    # 保存配置
    network_config_path = project_dir / "config" / "network.json"
    network.save(network_config_path)
    print(f"管网配置已保存: {network_config_path}")
    
    # 创建项目元数据
    metadata = {
        "project_name": f"管网漏点分析项目_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "created_at": datetime.now().isoformat(),
        "template": template,
        "version": "1.0.0",
        "nodes_count": len(network.nodes),
        "valves_count": len(network.valves),
        "sensors_count": len(network.sensors)
    }
    
    metadata_path = project_dir / "config" / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"项目元数据已保存: {metadata_path}")
    
    print("\n项目初始化完成！")
    print(f"项目路径: {project_dir}")
    print(f"节点数: {len(network.nodes)}, 阀门数: {len(network.valves)}, 传感器数: {len(network.sensors)}")


def cmd_import(args):
    """
    导入数据命令
    """
    project_dir = Path(args.project).absolute()
    
    if not project_dir.exists():
        raise FileNotFoundError(f"项目目录不存在: {project_dir}")
    
    print(f"导入数据到项目: {project_dir}")
    
    data_dir = project_dir / "data"
    
    # 加载管网配置
    network_path = project_dir / "config" / "network.json"
    if network_path.exists():
        network = PipeNetwork.load(network_path)
    else:
        network = None
    
    parser = DataParser()
    
    # 导入压力数据
    if args.pressure:
        pressure_path = Path(args.pressure).absolute()
        if not pressure_path.exists():
            raise FileNotFoundError(f"压力数据文件不存在: {pressure_path}")
        
        print(f"读取压力数据: {pressure_path}")
        pressure_data = parse_pressure_csv(pressure_path, network=network)
        output_path = data_dir / "pressure_data.json"
        parser.save_json(pressure_data, output_path)
        print(f"压力数据已保存: {output_path} (记录数: {len(pressure_data)})")
    
    # 导入听漏仪数据
    if args.acoustic:
        acoustic_path = Path(args.acoustic).absolute()
        if not acoustic_path.exists():
            raise FileNotFoundError(f"听漏仪数据文件不存在: {acoustic_path}")
        
        print(f"读取听漏仪数据: {acoustic_path}")
        acoustic_data = parse_acoustic_csv(acoustic_path, network=network)
        output_path = data_dir / "acoustic_data.json"
        parser.save_json(acoustic_data, output_path)
        print(f"听漏仪数据已保存: {output_path} (记录数: {len(acoustic_data)})")
    
    # 导入阀门台账
    if args.valve:
        valve_path = Path(args.valve).absolute()
        if not valve_path.exists():
            raise FileNotFoundError(f"阀门台账文件不存在: {valve_path}")
        
        print(f"读取阀门台账: {valve_path}")
        valve_data = parse_valve_csv(valve_path, network=network)
        output_path = data_dir / "valve_data.json"
        parser.save_json(valve_data, output_path)
        print(f"阀门台账已保存: {output_path} (记录数: {len(valve_data)})")
    
    # 导入流量数据
    if args.flow:
        flow_path = Path(args.flow).absolute()
        if not flow_path.exists():
            raise FileNotFoundError(f"流量数据文件不存在: {flow_path}")
        
        print(f"读取流量数据: {flow_path}")
        flow_data = parse_flow_csv(flow_path, network=network)
        output_path = data_dir / "flow_data.json"
        parser.save_json(flow_data, output_path)
        print(f"流量数据已保存: {output_path} (记录数: {len(flow_data)})")
    
    # 更新项目元数据
    metadata_path = project_dir / "config" / "metadata.json"
    if metadata_path.exists():
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        metadata["last_import"] = datetime.now().isoformat()
        if args.pressure:
            metadata["has_pressure_data"] = True
        if args.acoustic:
            metadata["has_acoustic_data"] = True
        if args.valve:
            metadata["has_valve_data"] = True
        if args.flow:
            metadata["has_flow_data"] = True
        
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    print("\n数据导入完成！")


def cmd_analyze(args):
    """
    时序分析命令
    """
    project_dir = Path(args.project).absolute()
    
    if not project_dir.exists():
        raise FileNotFoundError(f"项目目录不存在: {project_dir}")
    
    print(f"分析项目: {project_dir}")
    
    data_dir = project_dir / "data"
    analysis_dir = project_dir / "analysis"
    
    # 加载数据
    analyzer = TimeSeriesAnalyzer()
    
    # 加载管网配置
    network_path = project_dir / "config" / "network.json"
    if network_path.exists():
        network = PipeNetwork.load(network_path)
        analyzer.set_network(network)
    else:
        network = None
    
    # 加载压力数据
    pressure_data = []
    pressure_path = data_dir / "pressure_data.json"
    if pressure_path.exists():
        with open(pressure_path, "r", encoding="utf-8") as f:
            pressure_data = json.load(f)
        print(f"已加载压力数据: {len(pressure_data)} 条记录")
    
    # 加载听漏仪数据
    acoustic_data = []
    acoustic_path = data_dir / "acoustic_data.json"
    if acoustic_path.exists():
        with open(acoustic_path, "r", encoding="utf-8") as f:
            acoustic_data = json.load(f)
        print(f"已加载听漏仪数据: {len(acoustic_data)} 条记录")
    
    if not pressure_data and not acoustic_data:
        raise ValueError("没有可分析的数据。请先运行 import 命令导入数据。")
    
    # 设置分析参数
    analyzer.pressure_threshold = args.pressure_threshold
    analyzer.acoustic_threshold = args.acoustic_threshold
    analyzer.time_window_seconds = args.time_window
    
    print(f"\n分析参数:")
    print(f"  压力骤降阈值: {analyzer.pressure_threshold}")
    print(f"  声纹异常阈值: {analyzer.acoustic_threshold}")
    print(f"  时间对齐窗口: {analyzer.time_window_seconds} 秒")
    
    # 执行分析
    print("\n开始时序分析...")
    
    # 时间轴对齐
    print("1. 时间轴对齐...")
    aligned_data = analyzer.align_time_series(pressure_data, acoustic_data)
    print(f"   对齐后时间点数量: {len(aligned_data)}")
    
    # 压力骤降检测
    print("2. 压力骤降检测...")
    pressure_anomalies = analyzer.detect_pressure_drop(pressure_data)
    print(f"   检测到压力异常事件: {len(pressure_anomalies)}")
    for i, anomaly in enumerate(pressure_anomalies[:5]):  # 只显示前5个
        print(f"      - {anomaly.get('timestamp', 'N/A')}: 传感器 {anomaly.get('sensor_id', 'N/A')}, 降幅 {anomaly.get('drop_percent', 0):.1%}")
    if len(pressure_anomalies) > 5:
        print(f"      ... 还有 {len(pressure_anomalies) - 5} 个事件")
    
    # 声纹异常检测
    print("3. 声纹异常检测...")
    acoustic_anomalies = analyzer.detect_acoustic_anomaly(acoustic_data)
    print(f"   检测到声纹异常事件: {len(acoustic_anomalies)}")
    for i, anomaly in enumerate(acoustic_anomalies[:5]):  # 只显示前5个
        print(f"      - {anomaly.get('timestamp', 'N/A')}: 位置 {anomaly.get('location', 'N/A')}, 异常分数 {anomaly.get('anomaly_score', 0):.2f}")
    if len(acoustic_anomalies) > 5:
        print(f"      ... 还有 {len(acoustic_anomalies) - 5} 个事件")
    
    # 传播延迟分析
    print("4. 传播延迟分析...")
    propagation_delays = analyzer.analyze_propagation_delay(pressure_anomalies, network=network)
    print(f"   分析到传播延迟事件: {len(propagation_delays)}")
    
    # 用水峰排除
    print("5. 正常用水峰排除...")
    filtered_anomalies = analyzer.filter_normal_usage(pressure_anomalies, acoustic_anomalies)
    print(f"   排除后可疑事件: {len(filtered_anomalies)}")
    
    # 保存分析结果
    analysis_result = AnalysisResult(
        aligned_data=aligned_data,
        pressure_anomalies=pressure_anomalies,
        acoustic_anomalies=acoustic_anomalies,
        propagation_delays=propagation_delays,
        filtered_anomalies=filtered_anomalies,
        parameters={
            "pressure_threshold": args.pressure_threshold,
            "acoustic_threshold": args.acoustic_threshold,
            "time_window": args.time_window
        }
    )
    
    output_path = analysis_dir / "analysis_result.json"
    analysis_result.save(output_path)
    print(f"\n分析结果已保存: {output_path}")
    
    # 更新元数据
    metadata_path = project_dir / "config" / "metadata.json"
    if metadata_path.exists():
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        metadata["last_analysis"] = datetime.now().isoformat()
        metadata["analysis_summary"] = {
            "pressure_anomalies": len(pressure_anomalies),
            "acoustic_anomalies": len(acoustic_anomalies),
            "filtered_anomalies": len(filtered_anomalies),
            "propagation_delays": len(propagation_delays)
        }
        
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    print("\n时序分析完成！")
    if filtered_anomalies:
        print(f"发现 {len(filtered_anomalies)} 个可疑漏点事件，请运行 plan 命令进行漏点定位。")
    else:
        print("未发现明确的漏点信号，请检查数据或调整分析阈值。")


def cmd_plan(args):
    """
    漏点定位与关阀计划命令
    """
    project_dir = Path(args.project).absolute()
    
    if not project_dir.exists():
        raise FileNotFoundError(f"项目目录不存在: {project_dir}")
    
    print(f"制定关阀计划: {project_dir}")
    
    analysis_dir = project_dir / "analysis"
    
    # 加载分析结果
    analysis_path = analysis_dir / "analysis_result.json"
    if not analysis_path.exists():
        raise FileNotFoundError(f"分析结果不存在，请先运行 analyze 命令。")
    
    analysis_result = AnalysisResult.load(analysis_path)
    
    # 加载管网配置
    network_path = project_dir / "config" / "network.json"
    if network_path.exists():
        network = PipeNetwork.load(network_path)
    else:
        raise FileNotFoundError("管网配置不存在，请先运行 init 命令。")
    
    # 创建隔离规划器
    planner = IsolationPlanner(network)
    planner.isolation_strategy = args.isolation_strategy
    
    print(f"隔离策略: {planner.isolation_strategy}")
    
    # 执行漏点定位
    print("\n1. 漏点定位...")
    suspected_leaks = planner.locate_leak_points(
        analysis_result.filtered_anomalies,
        analysis_result.propagation_delays
    )
    print(f"   定位到疑似漏点: {len(suspected_leaks)} 个")
    for i, leak in enumerate(suspected_leaks):
        print(f"      {i+1}. 区段 {leak.get('section_id', 'N/A')}, 置信度 {leak.get('confidence', 0):.1%}")
    
    # 制定关阀计划
    print("\n2. 制定关阀计划...")
    valves_to_close = planner.plan_valve_closure(suspected_leaks)
    print(f"   需要关闭的阀门: {len(valves_to_close)} 个")
    for i, valve in enumerate(valves_to_close):
        print(f"      {i+1}. 阀门 {valve.get('valve_id', 'N/A')} ({valve.get('location', 'N/A')})")
    
    # 评估影响范围
    print("\n3. 评估影响范围...")
    affected_users = planner.estimate_affected_users(valves_to_close)
    print(f"   受影响用户数: {len(affected_users)}")
    
    # 汇总结果
    isolation_result = IsolationResult(
        suspected_leaks=suspected_leaks,
        valves_to_close=valves_to_close,
        affected_users=affected_users,
        strategy=args.isolation_strategy,
        network_summary={
            "total_nodes": len(network.nodes),
            "total_valves": len(network.valves),
            "total_sections": len(network.sections)
        }
    )
    
    # 保存结果
    output_path = analysis_dir / "isolation_result.json"
    isolation_result.save(output_path)
    print(f"\n关阀计划已保存: {output_path}")
    
    # 更新元数据
    metadata_path = project_dir / "config" / "metadata.json"
    if metadata_path.exists():
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        metadata["last_plan"] = datetime.now().isoformat()
        metadata["plan_summary"] = {
            "suspected_leaks": len(suspected_leaks),
            "valves_to_close": len(valves_to_close),
            "affected_users": len(affected_users),
            "strategy": args.isolation_strategy
        }
        
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    print("\n关阀计划制定完成！")
    print(f"疑似漏点: {len(suspected_leaks)} 个")
    print(f"需关阀门: {len(valves_to_close)} 个")
    print(f"受影响用户: {len(affected_users)} 户")


def cmd_review(args):
    """
    人工复核命令
    """
    project_dir = Path(args.project).absolute()
    
    if not project_dir.exists():
        raise FileNotFoundError(f"项目目录不存在: {project_dir}")
    
    print(f"人工复核: {project_dir}")
    
    review_dir = project_dir / "review"
    
    # 加载分析结果
    analysis_dir = project_dir / "analysis"
    analysis_path = analysis_dir / "analysis_result.json"
    isolation_path = analysis_dir / "isolation_result.json"
    
    analysis_result = None
    isolation_result = None
    
    if analysis_path.exists():
        analysis_result = AnalysisResult.load(analysis_path)
    if isolation_path.exists():
        isolation_result = IsolationResult.load(isolation_path)
    
    # 创建复核管理器
    review_manager = ReviewManager()
    
    # 显示当前状态
    print("\n当前分析状态:")
    if analysis_result:
        print(f"  压力异常事件: {len(analysis_result.pressure_anomalies)}")
        print(f"  声纹异常事件: {len(analysis_result.acoustic_anomalies)}")
        print(f"  过滤后可疑事件: {len(analysis_result.filtered_anomalies)}")
    
    if isolation_result:
        print(f"  疑似漏点: {len(isolation_result.suspected_leaks)}")
        print(f"  需关阀门: {len(isolation_result.valves_to_close)}")
        print(f"  受影响用户: {len(isolation_result.affected_users)}")
    
    # 处理复核操作
    if args.confirm or args.reject:
        status = "confirmed" if args.confirm else "rejected"
        print(f"\n{status} 分析结果...")
        
        review_record = ReviewRecord(
            status=status,
            notes=args.notes or "",
            adjusted_leak_location=args.adjust_leak_location,
            analysis_summary={
                "pressure_anomalies": len(analysis_result.pressure_anomalies) if analysis_result else 0,
                "acoustic_anomalies": len(analysis_result.acoustic_anomalies) if analysis_result else 0,
                "filtered_anomalies": len(analysis_result.filtered_anomalies) if analysis_result else 0,
                "suspected_leaks": len(isolation_result.suspected_leaks) if isolation_result else 0,
                "valves_to_close": len(isolation_result.valves_to_close) if isolation_result else 0,
                "affected_users": len(isolation_result.affected_users) if isolation_result else 0
            }
        )
        
        # 保存复核记录
        output_path = review_dir / f"review_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        review_record.save(output_path)
        print(f"复核记录已保存: {output_path}")
        
        # 更新元数据
        metadata_path = project_dir / "config" / "metadata.json"
        if metadata_path.exists():
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
            metadata["last_review"] = datetime.now().isoformat()
            metadata["review_status"] = status
            metadata["review_notes"] = args.notes or ""
            
            with open(metadata_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        print(f"\n复核完成！状态: {status}")
    else:
        # 仅显示状态，不执行操作
        print("\n使用 --confirm 或 --reject 参数进行复核确认。")


def cmd_report(args):
    """
    导出报告命令
    """
    project_dir = Path(args.project).absolute()
    
    if not project_dir.exists():
        raise FileNotFoundError(f"项目目录不存在: {project_dir}")
    
    print(f"导出报告: {project_dir}")
    
    reports_dir = args.output if args.output else (project_dir / "reports")
    reports_dir = Path(reports_dir).absolute()
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    # 加载数据
    analysis_dir = project_dir / "analysis"
    config_dir = project_dir / "config"
    review_dir = project_dir / "review"
    
    # 加载元数据
    metadata = {}
    metadata_path = config_dir / "metadata.json"
    if metadata_path.exists():
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
    
    # 加载分析结果
    analysis_result = None
    analysis_path = analysis_dir / "analysis_result.json"
    if analysis_path.exists():
        analysis_result = AnalysisResult.load(analysis_path)
    
    # 加载隔离结果
    isolation_result = None
    isolation_path = analysis_dir / "isolation_result.json"
    if isolation_path.exists():
        isolation_result = IsolationResult.load(isolation_path)
    
    # 加载最新复核记录
    review_records = list(review_dir.glob("review_*.json"))
    latest_review = None
    if review_records:
        latest_review = ReviewRecord.load(sorted(review_records)[-1])
    
    # 创建报告导出器
    exporter = ReportExporter(
        metadata=metadata,
        analysis_result=analysis_result,
        isolation_result=isolation_result,
        review_record=latest_review
    )
    
    # 导出报告
    formats = []
    if args.format == "all":
        formats = ["markdown", "csv", "json"]
    else:
        formats = [args.format]
    
    for fmt in formats:
        print(f"\n导出 {fmt.upper()} 格式报告...")
        
        if fmt == "markdown":
            output_path = reports_dir / "leak_analysis_report.md"
            md_content = exporter.export_markdown()
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(md_content)
            print(f"  已保存: {output_path}")
        
        elif fmt == "csv":
            csv_files = exporter.export_csv()
            for name, content in csv_files.items():
                output_path = reports_dir / f"{name}.csv"
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"  已保存: {output_path}")
        
        elif fmt == "json":
            output_path = reports_dir / "leak_analysis_report.json"
            json_content = exporter.export_json()
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(json_content)
            print(f"  已保存: {output_path}")
    
    print("\n报告导出完成！")
    print(f"报告目录: {reports_dir}")


def cmd_self_test(args):
    """
    自检命令
    """
    output_dir = Path(args.output).absolute()
    
    print("=" * 60)
    print("管网漏点夜巡拼图器 - 自检程序")
    print("=" * 60)
    print(f"输出目录: {output_dir}")
    
    # 步骤1: 创建示例项目
    print("\n[步骤 1/6] 创建示例项目...")
    project_dir = output_dir / "demo_project"
    
    # 使用 sample_data 模块创建示例项目
    generate_sample_project(project_dir)
    
    # 步骤2: 检查文件结构
    print("\n[步骤 2/6] 检查项目结构...")
    expected_dirs = ["config", "data", "analysis", "reports", "review"]
    all_exist = True
    for d in expected_dirs:
        path = project_dir / d
        if path.exists():
            print(f"  ✓ {d}/ 目录存在")
        else:
            print(f"  ✗ {d}/ 目录缺失")
            all_exist = False
    
    # 步骤3: 验证管网配置
    print("\n[步骤 3/6] 验证管网配置...")
    network_path = project_dir / "config" / "network.json"
    if network_path.exists():
        network = PipeNetwork.load(network_path)
        print(f"  ✓ 加载成功")
        print(f"    节点数: {len(network.nodes)}")
        print(f"    阀门数: {len(network.valves)}")
        print(f"    传感器数: {len(network.sensors)}")
        print(f"    管段数: {len(network.sections)}")
    else:
        print(f"  ✗ 管网配置文件缺失")
        all_exist = False
    
    # 步骤4: 验证示例数据
    print("\n[步骤 4/6] 验证示例数据...")
    data_files = ["pressure_data.json", "acoustic_data.json", "valve_data.json"]
    for data_file in data_files:
        path = project_dir / "data" / data_file
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            print(f"  ✓ {data_file}: {len(data)} 条记录")
        else:
            print(f"  ✗ {data_file} 缺失")
            all_exist = False
    
    # 步骤5: 模拟完整流程
    print("\n[步骤 5/6] 模拟完整分析流程...")
    
    try:
        # 加载数据
        network = PipeNetwork.load(project_dir / "config" / "network.json")
        
        # 时序分析
        analyzer = TimeSeriesAnalyzer()
        analyzer.set_network(network)
        
        pressure_path = project_dir / "data" / "pressure_data.json"
        with open(pressure_path, "r", encoding="utf-8") as f:
            pressure_data = json.load(f)
        
        acoustic_path = project_dir / "data" / "acoustic_data.json"
        with open(acoustic_path, "r", encoding="utf-8") as f:
            acoustic_data = json.load(f)
        
        # 执行分析
        aligned = analyzer.align_time_series(pressure_data, acoustic_data)
        pressure_anom = analyzer.detect_pressure_drop(pressure_data)
        acoustic_anom = analyzer.detect_acoustic_anomaly(acoustic_data)
        filtered = analyzer.filter_normal_usage(pressure_anom, acoustic_anom)
        
        print(f"  ✓ 时序分析完成")
        print(f"    对齐时间点: {len(aligned)}")
        print(f"    压力异常: {len(pressure_anom)}")
        print(f"    声纹异常: {len(acoustic_anom)}")
        print(f"    过滤后可疑事件: {len(filtered)}")
        
        # 漏点定位
        planner = IsolationPlanner(network)
        leaks = planner.locate_leak_points(filtered, [])
        valves = planner.plan_valve_closure(leaks)
        users = planner.estimate_affected_users(valves)
        
        print(f"  ✓ 漏点定位完成")
        print(f"    疑似漏点: {len(leaks)}")
        print(f"    需关阀门: {len(valves)}")
        print(f"    受影响用户: {len(users)}")
        
    except Exception as e:
        print(f"  ✗ 流程模拟失败: {e}")
        all_exist = False
    
    # 步骤6: 生成报告
    print("\n[步骤 6/6] 生成测试报告...")
    try:
        # 模拟分析结果
        analysis_result = AnalysisResult(
            aligned_data=aligned if 'aligned' in dir() else [],
            pressure_anomalies=pressure_anom if 'pressure_anom' in dir() else [],
            acoustic_anomalies=acoustic_anom if 'acoustic_anom' in dir() else [],
            propagation_delays=[],
            filtered_anomalies=filtered if 'filtered' in dir() else [],
            parameters={"test": True}
        )
        
        isolation_result = IsolationResult(
            suspected_leaks=leaks if 'leaks' in dir() else [],
            valves_to_close=valves if 'valves' in dir() else [],
            affected_users=users if 'users' in dir() else [],
            strategy="test",
            network_summary={}
        )
        
        exporter = ReportExporter(
            metadata={"project_name": "自检测试项目"},
            analysis_result=analysis_result,
            isolation_result=isolation_result,
            review_record=None
        )
        
        # 导出所有格式
        md_content = exporter.export_markdown()
        csv_files = exporter.export_csv()
        json_content = exporter.export_json()
        
        # 保存报告
        report_dir = output_dir / "test_reports"
        report_dir.mkdir(parents=True, exist_ok=True)
        
        with open(report_dir / "test_report.md", "w", encoding="utf-8") as f:
            f.write(md_content)
        
        for name, content in csv_files.items():
            with open(report_dir / f"{name}.csv", "w", encoding="utf-8") as f:
                f.write(content)
        
        with open(report_dir / "test_report.json", "w", encoding="utf-8") as f:
            f.write(json_content)
        
        print(f"  ✓ 报告生成成功")
        print(f"    报告目录: {report_dir}")
        
    except Exception as e:
        print(f"  ✗ 报告生成失败: {e}")
        all_exist = False
    
    # 自检总结
    print("\n" + "=" * 60)
    print("自检完成")
    print("=" * 60)
    
    if all_exist:
        print("\n✓ 所有检查通过！")
        print("  管网漏点夜巡拼图器运行正常。")
        print(f"\n  测试项目位置: {project_dir}")
        print(f"  测试报告位置: {output_dir / 'test_reports'}")
        print("\n您可以使用以下命令进行实际测试:")
        print(f"  python pipe_leak_puzzle.py analyze {project_dir}")
        print(f"  python pipe_leak_puzzle.py plan {project_dir}")
        print(f"  python pipe_leak_puzzle.py report {project_dir} --format all")
    else:
        print("\n✗ 部分检查失败，请检查错误信息。")
