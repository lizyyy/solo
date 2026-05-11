#!/usr/bin/env python3
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_loader import (
    load_elderly_profiles,
    load_dishes,
    load_meal_orders,
    load_substitution_rules,
    load_all_from_json
)
from verification_engine import AllergenVerificationEngine
from report_generator import ReportGenerator


def main():
    parser = argparse.ArgumentParser(
        description="社区团餐过敏源核验器 - 用于核验社区团餐配送中的过敏源、忌口规则和替换餐"
    )
    
    parser.add_argument(
        "--json",
        type=str,
        help="包含所有数据的 JSON 文件路径（与单独指定 CSV 二选一）"
    )
    
    parser.add_argument(
        "--elderly",
        type=str,
        help="老人档案 CSV 文件路径"
    )
    
    parser.add_argument(
        "--dishes",
        type=str,
        help="菜品数据 CSV 文件路径"
    )
    
    parser.add_argument(
        "--rules",
        type=str,
        help="替换规则 CSV 文件路径"
    )
    
    parser.add_argument(
        "--orders",
        type=str,
        help="订单数据 CSV 文件路径"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        default="report.txt",
        help="文本报告输出路径（默认: report.txt）"
    )
    
    parser.add_argument(
        "--json-output",
        type=str,
        help="JSON 报告输出路径"
    )
    
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="显示详细输出"
    )
    
    args = parser.parse_args()
    
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    
    if args.json:
        if not os.path.exists(args.json):
            print(f"错误: 文件不存在: {args.json}")
            sys.exit(1)
        
        profiles, dishes, rules_by_source, orders, loading_issues = load_all_from_json(args.json)
    else:
        elderly_file = args.elderly or os.path.join(data_dir, "elderly_profiles.csv")
        dishes_file = args.dishes or os.path.join(data_dir, "dishes.csv")
        rules_file = args.rules or os.path.join(data_dir, "substitution_rules.csv")
        orders_file = args.orders or os.path.join(data_dir, "meal_orders.csv")
        
        for filepath in [elderly_file, dishes_file, rules_file, orders_file]:
            if not os.path.exists(filepath):
                print(f"错误: 文件不存在: {filepath}")
                sys.exit(1)
        
        loading_issues = []
        profiles, issues1 = load_elderly_profiles(elderly_file)
        dishes, issues2 = load_dishes(dishes_file)
        rules_by_source, issues3 = load_substitution_rules(rules_file)
        orders, issues4 = load_meal_orders(orders_file)
        
        loading_issues.extend(issues1)
        loading_issues.extend(issues2)
        loading_issues.extend(issues3)
        loading_issues.extend(issues4)
    
    if args.verbose:
        print(f"加载完成:")
        print(f"  老人档案: {len(profiles)} 条")
        print(f"  菜品数据: {len(dishes)} 条")
        print(f"  替换规则: {sum(len(r) for r in rules_by_source.values())} 条")
        print(f"  订单数据: {len(orders)} 条")
        if loading_issues:
            print(f"  数据加载问题: {len(loading_issues)} 条")
    
    engine = AllergenVerificationEngine(profiles, dishes, rules_by_source)
    results = engine.verify_all_orders(orders)
    
    summary = ReportGenerator.generate_summary(orders, results, loading_issues)
    text_report = ReportGenerator.generate_text_report(summary, results, orders)
    
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(text_report)
    
    print(f"\n{text_report}")
    print(f"\n文本报告已保存到: {args.output}")
    
    if args.json_output:
        json_report = ReportGenerator.generate_json_report(summary, results, orders)
        with open(args.json_output, 'w', encoding='utf-8') as f:
            json.dump(json_report, f, ensure_ascii=False, indent=2)
        print(f"JSON 报告已保存到: {args.json_output}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
