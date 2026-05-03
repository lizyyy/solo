#!/usr/bin/env python3
"""酸奶发酵预演工具 - CLI入口"""

import argparse
import sys
import json
import os
from datetime import datetime
from pathlib import Path

from yogurt_sim.parser import parse_input, validate_plan
from yogurt_sim.model import FermentationSimulator
from yogurt_sim.risk import RiskEvaluator
from yogurt_sim.reporter import ReportGenerator


def main():
    parser = argparse.ArgumentParser(
        description="酸奶发酵预演工具 - 模拟发酵过程，预估风险和最佳操作时间",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python yogurt_cli.py examples/samples.json
  python yogurt_cli.py examples/samples.csv -o reports/
  python yogurt_cli.py examples/samples.json --no-markdown --no-html
        """
    )
    
    parser.add_argument(
        "input_file",
        type=str,
        help="输入文件路径（支持 .json 或 .csv 格式）"
    )
    
    parser.add_argument(
        "-o", "--output-dir",
        type=str,
        default="output",
        help="输出目录路径（默认: output）"
    )
    
    parser.add_argument(
        "--no-json",
        action="store_true",
        help="不生成 JSON 格式报告"
    )
    
    parser.add_argument(
        "--no-markdown",
        action="store_true",
        help="不生成 Markdown 格式报告"
    )
    
    parser.add_argument(
        "--no-html",
        action="store_true",
        help="不生成 HTML 格式报告"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="显示详细模拟过程信息"
    )
    
    parser.add_argument(
        "--version",
        action="version",
        version=f"酸奶发酵预演工具 v{__import__('yogurt_sim').__version__}"
    )
    
    args = parser.parse_args()
    
    input_path = Path(args.input_file)
    
    if not input_path.exists():
        print(f"错误: 输入文件不存在: {input_path}")
        sys.exit(1)
    
    if not input_path.is_file():
        print(f"错误: 输入路径不是文件: {input_path}")
        sys.exit(1)
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 70)
    print("🍼 酸奶发酵预演工具")
    print("=" * 70)
    print(f"\n📁 输入文件: {input_path}")
    print(f"📂 输出目录: {output_dir}")
    print()
    
    try:
        print("🔍 解析输入文件...")
        if input_path.suffix.lower() == ".json":
            plans = parse_input(str(input_path), "json")
        elif input_path.suffix.lower() == ".csv":
            plans = parse_input(str(input_path), "csv")
        else:
            print(f"错误: 不支持的文件格式: {input_path.suffix}")
            print("支持的格式: .json, .csv")
            sys.exit(1)
        
        print(f"✅ 成功解析 {len(plans)} 个发酵方案\n")
        
        all_results = []
        
        for i, plan in enumerate(plans, 1):
            print(f"📋 方案 {i}: {plan.get('name', f'方案 {i}')}")
            
            print("  ✅ 验证方案参数...")
            validation = validate_plan(plan)
            if not validation["valid"]:
                print(f"  ❌ 验证失败:")
                for error in validation["errors"]:
                    print(f"     - {error}")
                continue
            
            print("  🔬 模拟发酵过程...")
            simulator = FermentationSimulator(plan)
            simulation = simulator.simulate()
            
            print("  ⚠️  评估风险...")
            evaluator = RiskEvaluator()
            risks = evaluator.evaluate(plan, simulation)
            
            result = {
                "plan_id": i,
                "plan_name": plan.get('name', f'方案 {i}'),
                "plan": plan,
                "simulation": simulation,
                "risks": risks
            }
            all_results.append(result)
            
            risk_count = sum(1 for r in risks if r["level"] in ["high", "medium"])
            coagulation_info = simulation.get("coagulation_window", {})
            if coagulation_info:
                start_time = coagulation_info.get("start_time", "未知")
                end_time = coagulation_info.get("end_time", "未知")
                print(f"  ✅ 凝固窗口: {start_time} ~ {end_time}")
            print(f"  ⚠️  风险项: {risk_count} 个中高风险")
            print()
        
        if not all_results:
            print("❌ 没有有效的发酵方案可以模拟")
            sys.exit(1)
        
        print("📊 生成报告...")
        reporter = ReportGenerator()
        
        base_filename = f"yogurt_simulation_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        if not args.no_json:
            json_path = output_dir / f"{base_filename}.json"
            reporter.export_json(all_results, str(json_path))
            print(f"  ✅ JSON 报告: {json_path}")
        
        if not args.no_markdown:
            md_path = output_dir / f"{base_filename}.md"
            reporter.export_markdown(all_results, str(md_path))
            print(f"  ✅ Markdown 报告: {md_path}")
        
        if not args.no_html:
            html_path = output_dir / f"{base_filename}.html"
            reporter.export_html(all_results, str(html_path))
            print(f"  ✅ HTML 报告: {html_path}")
        
        print("\n" + "=" * 70)
        print("📋 终端摘要")
        print("=" * 70)
        
        for result in all_results:
            plan_name = result["plan_name"]
            simulation = result["simulation"]
            risks = result["risks"]
            
            print(f"\n【{plan_name}】")
            
            key_metrics = simulation.get("key_metrics", {})
            if key_metrics:
                print(f"  最终 pH: {key_metrics.get('final_ph', 'N/A')}")
                print(f"  最终酸度: {key_metrics.get('final_acidity', 'N/A')} %")
                print(f"  菌活性保留: {key_metrics.get('viability_retention', 'N/A')} %")
            
            coagulation = simulation.get("coagulation_window", {})
            if coagulation:
                start_h = coagulation.get("start_hours", "N/A")
                end_h = coagulation.get("end_hours", "N/A")
                print(f"  凝固窗口: {start_h} ~ {end_h} 小时")
                optimal_h = coagulation.get("optimal_hours", "N/A")
                print(f"  建议停止时间: 约 {optimal_h} 小时")
            
            high_risks = [r for r in risks if r["level"] == "high"]
            medium_risks = [r for r in risks if r["level"] == "medium"]
            low_risks = [r for r in risks if r["level"] == "low"]
            
            if high_risks:
                print(f"\n  🔴 高风险 ({len(high_risks)} 项):")
                for r in high_risks:
                    print(f"     - {r['name']}: {r['description']}")
            
            if medium_risks:
                print(f"\n  🟡 中风险 ({len(medium_risks)} 项):")
                for r in medium_risks:
                    print(f"     - {r['name']}: {r['description']}")
            
            if low_risks:
                print(f"\n  🟢 低风险 ({len(low_risks)} 项):")
                for r in low_risks:
                    print(f"     - {r['name']}: {r['description']}")
            
            suggestions = simulation.get("suggestions", [])
            if suggestions:
                print(f"\n  💡 调整建议:")
                for s in suggestions:
                    print(f"     - {s}")
        
        print("\n" + "=" * 70)
        print("✅ 模拟完成！详细报告已保存到输出目录。")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ 执行过程中发生错误: {str(e)}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
