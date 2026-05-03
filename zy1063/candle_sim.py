#!/usr/bin/env python3
"""
香薰蜡烛配方预演工具 - 命令行入口
"""

import sys
import argparse
from pathlib import Path
from typing import List, Optional

from candle_simulator import __version__
from candle_simulator.models import Ingredient, Recipe, AnalysisResult
from candle_simulator.parsers import parse_ingredients, parse_recipe, ParserError
from candle_simulator.calculator import calculate_costs, calculate_load_ratio, CalculatorError
from candle_simulator.volatilization import simulate_volatilization, VolatilizationError
from candle_simulator.risk_detector import detect_risks
from candle_simulator.reporter import generate_markdown_report, generate_html_report


def print_error(message: str):
    """打印错误消息"""
    print(f"\n❌ 错误: {message}", file=sys.stderr)


def print_warning(message: str):
    """打印警告消息"""
    print(f"⚠️  警告: {message}")


def print_success(message: str):
    """打印成功消息"""
    print(f"✅ {message}")


def print_info(message: str):
    """打印信息消息"""
    print(f"ℹ️  {message}")


def analyze_recipe(recipe: Recipe, ingredients: dict) -> AnalysisResult:
    """
    分析单个配方
    """
    try:
        cost_result = calculate_costs(recipe)
    except CalculatorError as e:
        raise RuntimeError(f"成本计算失败: {e}")
    
    load_ratio_result = calculate_load_ratio(recipe)
    
    try:
        volatilization_result = simulate_volatilization(recipe)
    except VolatilizationError as e:
        print_warning(f"挥发模拟无法执行: {e}")
        from candle_simulator.models import VolatilizationResult, VolatilizationPoint
        volatilization_result = VolatilizationResult(
            time_points=[],
            longevity_hours=0.0,
            top_duration_hours=0.0,
            middle_duration_hours=0.0,
            base_duration_hours=0.0,
            scent_score=0.0
        )
    
    risk_result = detect_risks(recipe, load_ratio_result, cost_result, volatilization_result)
    
    return AnalysisResult(
        recipe=recipe,
        cost_result=cost_result,
        load_ratio_result=load_ratio_result,
        volatilization_result=volatilization_result,
        risk_result=risk_result
    )


def run_analysis(
    ingredients_path: str,
    recipe_paths: List[str],
    output_md: Optional[str] = None,
    output_html: Optional[str] = None,
    quiet: bool = False
) -> int:
    """
    执行配方分析
    """
    if not quiet:
        print("=" * 60)
        print(f"🔥 香薰蜡烛配方预演工具 v{__version__}")
        print("=" * 60)
    
    try:
        if not quiet:
            print_info(f"加载原料库: {ingredients_path}")
        ingredients = parse_ingredients(ingredients_path)
        if not quiet:
            print_success(f"成功加载 {len(ingredients)} 种原料")
    except ParserError as e:
        print_error(str(e))
        return 1
    
    results: List[AnalysisResult] = []
    
    for i, recipe_path in enumerate(recipe_paths):
        if not quiet:
            print(f"\n--- 分析配方 {i+1}/{len(recipe_paths)} ---")
            print_info(f"加载配方: {recipe_path}")
        
        try:
            recipe = parse_recipe(recipe_path, ingredients)
            if not quiet:
                print_success(f"成功加载配方: {recipe.name}")
        except ParserError as e:
            print_error(str(e))
            return 1
        
        try:
            result = analyze_recipe(recipe, ingredients)
            results.append(result)
            
            if not quiet:
                print_success(f"分析完成！")
                print(f"   - 总成本: {result.cost_result.total_batch_cost:.4f}")
                print(f"   - 单杯成本: {result.cost_result.per_cup_cost:.4f}")
                print(f"   - 香精负载: {result.load_ratio_result.fragrance_load_ratio:.2f}%")
                print(f"   - 留香评分: {result.volatilization_result.scent_score:.1f}/100")
                
                risk_summary = f"   - 风险: 高={result.risk_result.high_count}, 中={result.risk_result.medium_count}, 低={result.risk_result.low_count}"
                if result.risk_result.high_count > 0:
                    print_warning(risk_summary)
                else:
                    print(f"{risk_summary}")
        except Exception as e:
            print_error(f"配方分析失败: {e}")
            import traceback
            traceback.print_exc()
            return 1
    
    if output_md:
        try:
            if not quiet:
                print_info(f"\n生成 Markdown 报告: {output_md}")
            generate_markdown_report(results, output_md)
            if not quiet:
                print_success("Markdown 报告生成完成")
        except Exception as e:
            print_error(f"生成 Markdown 报告失败: {e}")
            return 1
    
    if output_html:
        try:
            if not quiet:
                print_info(f"生成 HTML 报告: {output_html}")
            generate_html_report(results, output_html)
            if not quiet:
                print_success("HTML 报告生成完成")
        except Exception as e:
            print_error(f"生成 HTML 报告失败: {e}")
            return 1
    
    if not quiet:
        print(f"\n{'=' * 60}")
        print_success("分析完成！")
        if output_md or output_html:
            print_info("请查看生成的报告文件获取详细结果")
        print("=" * 60)
    
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="🔥 香薰蜡烛配方预演工具 - 本地配方分析与风险检测",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 分析单个配方
  python candle_sim.py -i ingredients.json -r recipe.json -o report.md -h report.html
  
  # 对比多个配方
  python candle_sim.py -i ingredients.json -r recipe1.json recipe2.json recipe3.json
  
  # 使用 CSV 格式
  python candle_sim.py -i ingredients.csv -r recipe.csv
  
  # 仅生成 HTML 报告
  python candle_sim.py -i ingredients.json -r recipe.json --html report.html
        """
    )
    
    parser.add_argument(
        "-i", "--ingredients",
        required=True,
        help="原料库文件路径 (支持 JSON 或 CSV 格式)"
    )
    
    parser.add_argument(
        "-r", "--recipes",
        required=True,
        nargs="+",
        help="配方文件路径 (支持 JSON 或 CSV 格式，可指定多个进行对比)"
    )
    
    parser.add_argument(
        "-o", "--markdown",
        default=None,
        help="输出 Markdown 报告的路径"
    )
    
    parser.add_argument(
        "--html",
        default=None,
        help="输出 HTML 报告的路径"
    )
    
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="静默模式，减少输出信息"
    )
    
    parser.add_argument(
        "-v", "--version",
        action="version",
        version=f"candle_simulator v{__version__}"
    )
    
    args = parser.parse_args()
    
    if len(args.recipes) < 1:
        print_error("请至少指定一个配方文件")
        return 1
    
    if len(args.recipes) > 3:
        print_warning("一次建议最多对比 3 个配方，过多可能影响报告可读性")
    
    if not args.markdown and not args.html:
        output_name = "_".join([Path(r).stem for r in args.recipes])
        args.markdown = f"report_{output_name}.md"
        args.html = f"report_{output_name}.html"
        print_info(f"未指定输出文件，将自动生成: {args.markdown}, {args.html}")
    
    return run_analysis(
        ingredients_path=args.ingredients,
        recipe_paths=args.recipes,
        output_md=args.markdown,
        output_html=args.html,
        quiet=args.quiet
    )


if __name__ == "__main__":
    sys.exit(main())
