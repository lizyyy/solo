"""铁路货运预检CLI主程序"""

import argparse
import os
import sys
from pathlib import Path
from typing import List, Dict, Any

from .data_loader import DataLoader
from .calculator import (
    LoadingCalculator, CalculationResult, 
    Cargo, Issue, IssueLevel
)
from .output import OutputGenerator


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description='铁路货运预检工具 - 用于在铁路货运封车前检查装车方案',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  # 使用示例数据运行预检
  python -m rail_freight_checker \\
    --vehicles samples/vehicles.csv \\
    --cargo samples/cargo.json \\
    --loading-plan samples/loading_plan.yaml \\
    --rules samples/rules.yaml \\
    --output-dir outputs/

  # 仅输出问题列表
  python -m rail_freight_checker \\
    -v vehicles.csv -c cargo.json -p loading_plan.yaml \\
    --issues-only
        '''
    )
    
    parser.add_argument(
        '-v', '--vehicles',
        required=True,
        help='车辆参数CSV文件路径'
    )
    
    parser.add_argument(
        '-c', '--cargo',
        required=True,
        help='货物尺寸重量JSON文件路径'
    )
    
    parser.add_argument(
        '-p', '--loading-plan',
        required=True,
        help='装载方案YAML文件路径'
    )
    
    parser.add_argument(
        '-r', '--rules',
        help='规则配置YAML文件路径（可选，使用默认规则）'
    )
    
    parser.add_argument(
        '-o', '--output-dir',
        default='./outputs',
        help='输出目录路径（默认: ./outputs）'
    )
    
    parser.add_argument(
        '--issues-only',
        action='store_true',
        help='仅输出问题列表，不生成完整报告'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='显示详细输出信息'
    )
    
    return parser.parse_args()


def main():
    """主函数"""
    args = parse_arguments()
    
    # 创建输出目录
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 初始化数据加载器
    loader = DataLoader()
    
    try:
        # 加载车辆数据
        if args.verbose:
            print(f"正在加载车辆数据: {args.vehicles}")
        vehicles = loader.load_vehicles_from_csv(args.vehicles)
        
        # 加载货物数据
        if args.verbose:
            print(f"正在加载货物数据: {args.cargo}")
        cargo_dict = loader.load_cargo_from_json(args.cargo)
        
        # 加载装载方案
        if args.verbose:
            print(f"正在加载装载方案: {args.loading_plan}")
        loading_plan = loader.load_loading_plan_from_yaml(args.loading_plan)
        
        # 加载规则配置
        if args.rules:
            if args.verbose:
                print(f"正在加载规则配置: {args.rules}")
            rules = loader.load_rules_from_yaml(args.rules)
        else:
            # 使用默认规则
            if args.verbose:
                print("使用默认规则配置")
            from .calculator import RuleConfig
            rules = RuleConfig(
                max_longitudinal_offset=100.0,
                max_lateral_offset=50.0,
                min_dangerous_goods_distance=1000.0,
                axle_weight_tolerance=0.05,
                over_weight_warning_threshold=0.9,
                over_weight_error_threshold=1.0,
                height_limit_tolerance=0.0,
                width_limit_tolerance=0.0
            )
        
        # 验证车辆ID
        if loading_plan.vehicle_id not in vehicles:
            print(f"错误: 装载方案中指定的车辆ID '{loading_plan.vehicle_id}' 在车辆数据中不存在")
            sys.exit(1)
        
        vehicle = vehicles[loading_plan.vehicle_id]
        
        # 构建货物列表（结合货物数据和装载位置）
        cargos = []
        for item in loading_plan.cargo_items:
            cargo_id = item['cargo_id']
            
            if cargo_id not in cargo_dict:
                loader.issues.append(Issue(
                    level=IssueLevel.WARNING,
                    category="data_loader",
                    message=f"装载方案中引用的货物ID '{cargo_id}' 在货物数据中不存在",
                    details={"cargo_id": cargo_id}
                ))
                continue
            
            # 复制货物数据并设置装载位置
            cargo = Cargo(
                id=cargo_dict[cargo_id].id,
                name=cargo_dict[cargo_id].name,
                weight=cargo_dict[cargo_id].weight,
                length=cargo_dict[cargo_id].length,
                width=cargo_dict[cargo_id].width,
                height=cargo_dict[cargo_id].height,
                x_position=item['x_position'],
                y_position=item['y_position'],
                z_position=item['z_position'],
                is_dangerous=cargo_dict[cargo_id].is_dangerous,
                dangerous_category=cargo_dict[cargo_id].dangerous_category,
                dangerous_class=cargo_dict[cargo_id].dangerous_class
            )
            cargos.append(cargo)
        
        # 执行计算
        if args.verbose:
            print("正在执行装载计算...")
        
        calculator = LoadingCalculator(vehicle, cargos, rules)
        result = calculator.calculate()
        
        # 合并所有问题（包括数据加载时的问题）
        all_issues = loader.issues + result.issues
        
        # 生成输出
        output_generator = OutputGenerator(output_dir)
        
        if args.issues_only:
            # 仅生成问题列表
            if args.verbose:
                print("正在生成问题列表...")
            issues_path = output_generator.generate_issues_csv(all_issues)
            print(f"问题列表已生成: {issues_path}")
        else:
            # 生成所有输出
            if args.verbose:
                print("正在生成输出文件...")
            
            issues_path = output_generator.generate_issues_csv(all_issues)
            report_path = output_generator.generate_report_md(
                result, vehicle, cargos, all_issues
            )
            preview_path = output_generator.generate_preview_html(
                result, vehicle, cargos, all_issues
            )
            
            print(f"\n预检完成！")
            print(f"  问题列表: {issues_path}")
            print(f"  详细报告: {report_path}")
            print(f"  预览页面: {preview_path}")
        
        # 统计问题
        error_count = sum(1 for issue in all_issues if issue.level == IssueLevel.ERROR)
        warning_count = sum(1 for issue in all_issues if issue.level == IssueLevel.WARNING)
        
        print(f"\n问题统计:")
        print(f"  错误: {error_count} 个")
        print(f"  警告: {warning_count} 个")
        
        if error_count > 0:
            print("\n⚠️  发现严重问题，建议检查后再封车！")
            sys.exit(2)
        elif warning_count > 0:
            print("\n⚠️  发现警告问题，建议关注。")
            sys.exit(0)
        else:
            print("\n✅ 预检通过，未发现问题。")
            sys.exit(0)
            
    except Exception as e:
        print(f"错误: {str(e)}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
