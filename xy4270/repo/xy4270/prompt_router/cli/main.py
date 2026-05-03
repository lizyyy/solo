"""
CLI 主入口
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import yaml

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from prompt_router.core.models import (
    ModelConfig,
    RoutingPolicy,
    TestCase,
)
from prompt_router.core.strategy_engine import StrategyEngine
from prompt_router.core.simulator import Orchestrator, SimulationConfig
from prompt_router.storage.store import ResultStore
from prompt_router.analysis.comparator import (
    MetricsCalculator,
    RunComparator,
)
from prompt_router.export.exporters import (
    MarkdownExporter,
    CSVExporter,
    JSONExporter,
)


def load_test_cases(file_path: str) -> List[TestCase]:
    """从 JSONL 文件加载测试用例"""
    test_cases = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                data = json.loads(line)
                test_cases.append(TestCase.from_dict(data))
    return test_cases


def load_models_config(file_path: str) -> Dict[str, ModelConfig]:
    """从 YAML 文件加载模型配置"""
    with open(file_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    
    models = {}
    models_data = data.get("models", {})
    for name, config_data in models_data.items():
        models[name] = ModelConfig.from_dict(name, config_data)
    
    return models


def load_routing_policy(file_path: str) -> RoutingPolicy:
    """从 YAML 文件加载路由策略"""
    with open(file_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return RoutingPolicy.from_dict(data)


def cmd_run(args: argparse.Namespace):
    """运行压测命令"""
    print("=" * 60)
    print("提示词路由压测台 - 运行模式")
    print("=" * 60)
    
    print(f"\n[加载配置]")
    print(f"  测试用例: {args.test_cases}")
    print(f"  模型配置: {args.models_config}")
    print(f"  路由策略: {args.routing_policy}")
    
    test_cases = load_test_cases(args.test_cases)
    print(f"  加载测试用例: {len(test_cases)} 条")
    
    models = load_models_config(args.models_config)
    print(f"  加载模型配置: {len(models)} 个")
    
    policy = load_routing_policy(args.routing_policy)
    print(f"  路由策略: {policy.name} v{policy.version}")
    
    print(f"\n[模拟配置]")
    sim_config = SimulationConfig(
        base_latency_ms=args.base_latency,
        latency_variance_ms=args.latency_variance,
        failure_rate=args.failure_rate,
        timeout_rate=args.timeout_rate,
        rate_limit_rate=args.rate_limit_rate,
        deterministic=args.deterministic,
        seed=args.seed,
    )
    print(f"  基础延迟: {sim_config.base_latency_ms}ms")
    print(f"  失败率: {sim_config.failure_rate * 100}%")
    print(f"  超时率: {sim_config.timeout_rate * 100}%")
    print(f"  限流率: {sim_config.rate_limit_rate * 100}%")
    
    print(f"\n[初始化引擎]")
    strategy_engine = StrategyEngine(policy, models)
    orchestrator = Orchestrator(strategy_engine, sim_config, models)
    print("  策略引擎已初始化")
    print("  模拟器已初始化")
    
    print(f"\n[执行压测]")
    def progress_callback(current: int, total: int):
        pct = (current / total) * 100
        print(f"  进度: {current}/{total} ({pct:.1f}%)\r", end="", flush=True)
    
    run_id, results = orchestrator.execute_batch(
        test_cases,
        progress_callback=progress_callback if not args.quiet else None
    )
    print(f"\n  运行完成，Run ID: {run_id}")
    
    summary = MetricsCalculator.calculate_run_summary(run_id, results)
    
    print(f"\n[运行摘要]")
    print(f"  总用例数: {summary.total_cases}")
    print(f"  成功数: {summary.success_count}")
    print(f"  失败数: {summary.failed_count}")
    print(f"  成功率: {summary.success_rate * 100:.2f}%")
    print(f"  总成本: ${summary.total_cost:.4f}")
    print(f"  平均延迟: {summary.avg_latency_ms:.1f}ms")
    print(f"  P50 延迟: {summary.p50_latency_ms:.1f}ms")
    print(f"  P95 延迟: {summary.p95_latency_ms:.1f}ms")
    
    if args.save:
        print(f"\n[保存结果]")
        store = ResultStore(args.results_dir)
        store.save_run(run_id, results, summary)
        print(f"  已保存到: {store.base_dir}/runs/{run_id}.jsonl")
    
    if args.export:
        print(f"\n[导出报告]")
        output_dir = args.export_dir or "./reports"
        
        formats = args.format.split(",") if args.format else ["md"]
        
        if "md" in formats or "markdown" in formats:
            md_exporter = MarkdownExporter(output_dir)
            md_content = md_exporter.export_run_summary(summary, results)
            md_file = md_exporter.save_to_file(md_content, f"report_{run_id}.md")
            print(f"  Markdown: {md_file}")
        
        if "csv" in formats:
            csv_exporter = CSVExporter(output_dir)
            csv_content = csv_exporter.export_run_results(results)
            csv_file = csv_exporter.save_to_file(csv_content, f"results_{run_id}.csv")
            print(f"  CSV 结果: {csv_file}")
            
            csv_attempts = csv_exporter.export_attempts(results)
            csv_attempts_file = csv_exporter.save_to_file(csv_attempts, f"attempts_{run_id}.csv")
            print(f"  CSV 尝试: {csv_attempts_file}")
        
        if "json" in formats:
            json_exporter = JSONExporter(output_dir)
            json_summary = json_exporter.export_run_summary(summary)
            json_summary_file = json_exporter.save_to_file(json_summary, f"summary_{run_id}.json")
            print(f"  JSON 摘要: {json_summary_file}")
            
            json_results = json_exporter.export_results(results)
            json_results_file = json_exporter.save_to_file(json_results, f"results_{run_id}.json")
            print(f"  JSON 结果: {json_results_file}")
    
    return run_id, results


def cmd_list(args: argparse.Namespace):
    """列出运行记录命令"""
    print("=" * 60)
    print("提示词路由压测台 - 运行记录列表")
    print("=" * 60)
    
    store = ResultStore(args.results_dir)
    runs = store.list_runs()
    
    if not runs:
        print("\n  暂无运行记录")
        return
    
    print(f"\n  共 {len(runs)} 条运行记录:\n")
    print(f"  {'Run ID':<12} {'策略':<20} {'用例数':<8} {'成功率':<10} {'成本':<10}")
    print("  " + "-" * 70)
    
    for run in runs:
        run_id = run.get("run_id", "unknown")[:12]
        policy_name = run.get("policy_name", "unknown")[:18]
        total_cases = run.get("total_cases", 0)
        success_rate = run.get("success_rate", 0) * 100 if run.get("success_rate") else 0
        total_cost = run.get("total_cost", 0)
        
        print(f"  {run_id:<12} {policy_name:<20} {total_cases:<8} {success_rate:>7.2f}%  ${total_cost:>8.4f}")


def cmd_compare(args: argparse.Namespace):
    """比较两次运行命令"""
    print("=" * 60)
    print("提示词路由压测台 - 策略比较")
    print("=" * 60)
    
    print(f"\n[加载数据]")
    print(f"  运行 A: {args.run_a}")
    print(f"  运行 B: {args.run_b}")
    
    store = ResultStore(args.results_dir)
    results_a = store.load_run(args.run_a)
    results_b = store.load_run(args.run_b)
    
    summary_a = MetricsCalculator.calculate_run_summary(args.run_a, results_a)
    summary_b = MetricsCalculator.calculate_run_summary(args.run_b, results_b)
    
    print(f"  策略 A: {summary_a.policy_name} v{summary_a.policy_version}")
    print(f"  策略 B: {summary_b.policy_name} v{summary_b.policy_version}")
    
    print(f"\n[执行比较]")
    comparator = RunComparator(results_a, results_b)
    comparison = comparator.compare()
    
    print(f"\n[比较摘要]")
    print(f"  总用例数: {comparison.total_cases}")
    print(f"  公共用例: {comparison.common_cases}")
    print(f"")
    print(f"  成本变化: {comparison.cost_difference:+.4f} ({comparison.cost_percentage_change:+.2f}%)")
    print(f"  延迟变化: {comparison.latency_difference_ms:+.1f}ms ({comparison.latency_percentage_change:+.2f}%)")
    print(f"  成功率变化: {comparison.success_rate_difference * 100:+.2f}%")
    print(f"")
    print(f"  模型切换数: {comparison.model_switch_count}")
    print(f"  状态变化数: {comparison.status_change_count}")
    
    if args.export:
        print(f"\n[导出比较报告]")
        output_dir = args.export_dir or "./reports"
        
        formats = args.format.split(",") if args.format else ["md"]
        
        if "md" in formats or "markdown" in formats:
            md_exporter = MarkdownExporter(output_dir)
            md_content = md_exporter.export_comparison(comparison)
            filename = f"compare_{args.run_a[:8]}_vs_{args.run_b[:8]}.md"
            md_file = md_exporter.save_to_file(md_content, filename)
            print(f"  Markdown: {md_file}")
        
        if "csv" in formats:
            csv_exporter = CSVExporter(output_dir)
            csv_content = csv_exporter.export_comparison(comparison)
            filename = f"compare_{args.run_a[:8]}_vs_{args.run_b[:8]}.csv"
            csv_file = csv_exporter.save_to_file(csv_content, filename)
            print(f"  CSV: {csv_file}")
        
        if "json" in formats:
            json_exporter = JSONExporter(output_dir)
            json_content = json_exporter.export_comparison(comparison)
            filename = f"compare_{args.run_a[:8]}_vs_{args.run_b[:8]}.json"
            json_file = json_exporter.save_to_file(json_content, filename)
            print(f"  JSON: {json_file}")
    
    return comparison


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="提示词路由压测台 - 本地可运行的路由策略测试工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 运行压测
  prompt-router run --test-cases examples/cases.jsonl --models-config examples/models.yaml --routing-policy examples/policy_v1.yaml --save --export
  
  # 列出运行记录
  prompt-router list
  
  # 比较两次运行
  prompt-router compare --run-a runid1 --run-b runid2 --export
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    run_parser = subparsers.add_parser("run", help="运行压测")
    run_parser.add_argument("--test-cases", required=True, help="测试用例 JSONL 文件路径")
    run_parser.add_argument("--models-config", required=True, help="模型配置 YAML 文件路径")
    run_parser.add_argument("--routing-policy", required=True, help="路由策略 YAML 文件路径")
    run_parser.add_argument("--save", action="store_true", help="保存运行结果")
    run_parser.add_argument("--results-dir", default="./results", help="结果存储目录")
    run_parser.add_argument("--export", action="store_true", help="导出报告")
    run_parser.add_argument("--export-dir", default="./reports", help="报告导出目录")
    run_parser.add_argument("--format", default="md,csv,json", help="导出格式 (md,csv,json)")
    run_parser.add_argument("--base-latency", type=int, default=500, help="基础延迟 (ms)")
    run_parser.add_argument("--latency-variance", type=int, default=300, help="延迟方差 (ms)")
    run_parser.add_argument("--failure-rate", type=float, default=0.05, help="失败率 (0-1)")
    run_parser.add_argument("--timeout-rate", type=float, default=0.03, help="超时率 (0-1)")
    run_parser.add_argument("--rate-limit-rate", type=float, default=0.02, help="限流率 (0-1)")
    run_parser.add_argument("--deterministic", action="store_true", help="确定性模式 (固定种子)")
    run_parser.add_argument("--seed", type=int, default=42, help="随机种子")
    run_parser.add_argument("--quiet", "-q", action="store_true", help="静默模式")
    
    list_parser = subparsers.add_parser("list", help="列出运行记录")
    list_parser.add_argument("--results-dir", default="./results", help="结果存储目录")
    
    compare_parser = subparsers.add_parser("compare", help="比较两次运行")
    compare_parser.add_argument("--run-a", required=True, help="运行 A 的 ID")
    compare_parser.add_argument("--run-b", required=True, help="运行 B 的 ID")
    compare_parser.add_argument("--results-dir", default="./results", help="结果存储目录")
    compare_parser.add_argument("--export", action="store_true", help="导出比较报告")
    compare_parser.add_argument("--export-dir", default="./reports", help="报告导出目录")
    compare_parser.add_argument("--format", default="md,csv,json", help="导出格式 (md,csv,json)")
    
    args = parser.parse_args()
    
    if args.command == "run":
        cmd_run(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "compare":
        cmd_compare(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
