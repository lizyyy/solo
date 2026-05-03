"""
命令行界面模块
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from .models import DosingResult
from .csv_reader import CSVReader, DataValidationError
from .calculator import DosingCalculator
from .exporter import Exporter


def run_calculator(
    tank_params_path: str,
    readings_path: str,
    supplement_path: Optional[str] = None,
    output_dir: Optional[str] = None,
    days: int = 7,
    verbose: bool = False
) -> int:
    """
    运行投加计算
    
    Args:
        tank_params_path: 缸体参数CSV路径
        readings_path: 检测数据CSV路径
        supplement_path: 补剂配置CSV路径（可选）
        output_dir: 输出目录（可选）
        days: 计算天数
        verbose: 详细输出模式
    
    Returns:
        退出码 (0=成功, 1=错误)
    """
    all_warnings: List[str] = []
    
    print("=" * 60)
    print("🌊 补剂配平助手 - 海水缸维护科学计算工具")
    print("=" * 60)
    print()
    
    # 读取数据
    print("[1/5] 读取数据文件...")
    print("-" * 40)
    
    reader = CSVReader()
    
    try:
        # 读取缸体参数
        tank_params = reader.read_tank_params(tank_params_path)
        warnings = reader.get_warnings()
        if warnings:
            all_warnings.extend(warnings)
            if verbose:
                for w in warnings:
                    print(f"  ⚠️  {w}")
        
        print(f"  ✓ 缸体参数: {tank_params.tank_name}")
        print(f"  ✓ 总水量: {tank_params.total_volume:.1f} L")
        
        # 读取检测数据
        readings = reader.read_daily_readings(readings_path)
        warnings = reader.get_warnings()
        if warnings:
            all_warnings.extend(warnings)
            if verbose:
                for w in warnings:
                    print(f"  ⚠️  {w}")
        
        if not readings:
            print("  ✗ 错误: 没有有效的检测数据")
            return 1
        
        print(f"  ✓ 检测数据: {len(readings)} 条记录")
        if readings:
            print(f"  ✓ 数据范围: {readings[0].date.strftime('%Y-%m-%d')} 至 {readings[-1].date.strftime('%Y-%m-%d')}")
        
        # 读取补剂配置（可选）
        supplement_configs = None
        if supplement_path and Path(supplement_path).exists():
            supplement_configs = reader.read_supplement_config(supplement_path)
            warnings = reader.get_warnings()
            if warnings:
                all_warnings.extend(warnings)
                if verbose:
                    for w in warnings:
                        print(f"  ⚠️  {w}")
            print(f"  ✓ 补剂配置: 已加载 {len(supplement_configs)} 种补剂")
        else:
            print("  ℹ️ 使用默认补剂配置")
    
    except DataValidationError as e:
        print(f"  ✗ 数据验证错误: {e}")
        return 1
    except Exception as e:
        print(f"  ✗ 读取数据失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        return 1
    
    print()
    
    # 计算投加计划
    print(f"[2/5] 计算未来 {days} 天投加计划...")
    print("-" * 40)
    
    try:
        calculator = DosingCalculator(
            tank_params=tank_params,
            historical_readings=readings,
            supplement_configs=supplement_configs,
        )
        
        warnings = calculator.get_warnings()
        if warnings:
            all_warnings.extend(warnings)
            if verbose:
                for w in warnings:
                    print(f"  ⚠️  {w}")
        
        result = calculator.calculate_dosing_plan(days=days)
        
        # 统计需要投加的天数
        kh_days = sum(1 for p in result.future_plans if p.kh_dosage and p.kh_dosage > 0)
        ca_days = sum(1 for p in result.future_plans if p.ca_dosage and p.ca_dosage > 0)
        mg_days = sum(1 for p in result.future_plans if p.mg_dosage and p.mg_dosage > 0)
        
        print(f"  ✓ KH: {kh_days} 天需要投加")
        print(f"  ✓ 钙: {ca_days} 天需要投加")
        print(f"  ✓ 镁: {mg_days} 天需要投加")
        
        # 显示计算的消耗速率
        if calculator.consumption_rates:
            print()
            print("  计算得到的消耗速率:")
            if calculator.consumption_rates.get('kh', 0) > 0:
                print(f"    - KH: {calculator.consumption_rates['kh']:.2f} dKH/天")
            if calculator.consumption_rates.get('ca', 0) > 0:
                print(f"    - 钙: {calculator.consumption_rates['ca']:.0f} ppm/天")
            if calculator.consumption_rates.get('mg', 0) > 0:
                print(f"    - 镁: {calculator.consumption_rates['mg']:.0f} ppm/天")
            if calculator.avg_evaporation > 0:
                print(f"    - 蒸发: {calculator.avg_evaporation:.1f} L/天")
    
    except Exception as e:
        print(f"  ✗ 计算失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        return 1
    
    print()
    
    # 显示简要结果
    print("[3/5] 投加计划摘要:")
    print("-" * 40)
    
    total_kh = sum(p.kh_dosage or 0 for p in result.future_plans)
    total_ca = sum(p.ca_dosage or 0 for p in result.future_plans)
    total_mg = sum(p.mg_dosage or 0 for p in result.future_plans)
    total_water = sum(p.top_up_water or 0 for p in result.future_plans)
    
    if total_kh > 0:
        print(f"  KH: 总计 {total_kh:.2f} mL (日均 {total_kh/days:.2f} mL)")
    if total_ca > 0:
        print(f"  钙: 总计 {total_ca:.2f} mL (日均 {total_ca/days:.2f} mL)")
    if total_mg > 0:
        print(f"  镁: 总计 {total_mg:.2f} mL (日均 {total_mg/days:.2f} mL)")
    if total_water > 0:
        print(f"  补水: 总计 {total_water:.1f} L (日均 {total_water/days:.1f} L)")
    
    print()
    
    # 显示警告
    if result.has_warnings() or all_warnings:
        print("[4/5] ⚠️ 警告信息:")
        print("-" * 40)
        
        # 收集所有警告
        all_warns = list(all_warnings)
        all_warns.extend(result.overall_warnings)
        for plan in result.future_plans:
            all_warns.extend(plan.get_all_warnings())
        
        # 去重
        unique_warns = list(dict.fromkeys(all_warns))
        for warn in unique_warns:
            print(f"  ⚠️  {warn}")
    else:
        print("[4/5] ✓ 无警告信息")
    
    print()
    
    # 导出文件
    print("[5/5] 导出结果文件...")
    print("-" * 40)
    
    try:
        # 确定输出目录
        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
        else:
            # 使用当前目录
            output_path = Path.cwd()
        
        # 生成文件名（基于当前时间）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        tank_name = result.tank_params.tank_name.replace(" ", "_")
        
        md_filename = f"{tank_name}_维护单_{timestamp}.md"
        csv_filename = f"{tank_name}_投加计划_{timestamp}.csv"
        
        md_path = output_path / md_filename
        csv_path = output_path / csv_filename
        
        # 导出Markdown
        Exporter.export_markdown(result, str(md_path))
        print(f"  ✓ Markdown维护单: {md_path}")
        
        # 导出CSV
        Exporter.export_csv(result, str(csv_path))
        print(f"  ✓ CSV投加计划: {csv_path}")
    
    except Exception as e:
        print(f"  ✗ 导出失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        return 1
    
    print()
    print("=" * 60)
    print("✅ 计算完成！")
    print("=" * 60)
    print()
    print("建议:")
    print("  1. 请仔细核对导出的维护单和投加计划")
    print("  2. 投加前确认补剂浓度和投加量")
    print("  3. 建议分多次投加，每次间隔1-2小时")
    print("  4. 投加后24小时检测参数变化")
    print()
    
    return 0


def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        description="🌊 补剂配平助手 - 海水缸维护科学计算工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本用法
  python -m reef_dosing_helper --params tank_params.csv --readings daily_readings.csv
  
  # 指定输出目录和计算天数
  python -m reef_dosing_helper --params tank_params.csv --readings daily_readings.csv --output ./output --days 7
  
  # 使用自定义补剂配置
  python -m reef_dosing_helper --params tank_params.csv --readings daily_readings.csv --supplement supplements.csv
  
  # 详细输出模式
  python -m reef_dosing_helper --params tank_params.csv --readings daily_readings.csv --verbose
        """
    )
    
    parser.add_argument(
        '--params', '-p',
        required=True,
        help='缸体参数CSV文件路径'
    )
    
    parser.add_argument(
        '--readings', '-r',
        required=True,
        help='每日检测数据CSV文件路径'
    )
    
    parser.add_argument(
        '--supplement', '-s',
        default=None,
        help='补剂配置CSV文件路径（可选，默认使用内置配置）'
    )
    
    parser.add_argument(
        '--output', '-o',
        default=None,
        help='输出目录路径（可选，默认当前目录）'
    )
    
    parser.add_argument(
        '--days', '-d',
        type=int,
        default=7,
        help='计算未来天数（默认7天）'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='详细输出模式'
    )
    
    parser.add_argument(
        '--version',
        action='version',
        version='补剂配平助手 v1.0.0'
    )
    
    args = parser.parse_args()
    
    # 验证参数
    if args.days < 1 or args.days > 30:
        print("错误: 计算天数必须在 1-30 天之间")
        sys.exit(1)
    
    # 运行计算
    exit_code = run_calculator(
        tank_params_path=args.params,
        readings_path=args.readings,
        supplement_path=args.supplement,
        output_dir=args.output,
        days=args.days,
        verbose=args.verbose
    )
    
    sys.exit(exit_code)


if __name__ == '__main__':
    main()
