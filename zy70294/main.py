#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
便利店鲜食报废预测器 - 主入口
"""
import os
import sys
import argparse

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from predictor import FreshFoodWastePredictor

def main():
    parser = argparse.ArgumentParser(description='便利店鲜食报废预测器')
    parser.add_argument('--mode', type=str, default='predict', 
                       choices=['predict', 'validate', 'clean', 'demo'],
                       help='运行模式: predict=预测, validate=验证, clean=清洗数据, demo=完整演示')
    parser.add_argument('--sales-file', type=str, 
                       default=os.path.join(project_root, 'data', 'sales_data.csv'),
                       help='销量数据文件路径')
    parser.add_argument('--inventory-file', type=str,
                       default=os.path.join(project_root, 'data', 'inventory_data.csv'),
                       help='库存数据文件路径')
    parser.add_argument('--weather-file', type=str,
                       default=os.path.join(project_root, 'data', 'weather_data.csv'),
                       help='天气数据文件路径')
    parser.add_argument('--holiday-file', type=str,
                       default=os.path.join(project_root, 'data', 'holiday_data.csv'),
                       help='节假日数据文件路径')
    parser.add_argument('--output-file', type=str,
                       default=os.path.join(project_root, 'results', 'prediction_report.txt'),
                       help='输出报告文件路径')
    
    args = parser.parse_args()
    
    # 创建结果目录
    os.makedirs(os.path.dirname(args.output_file), exist_ok=True)
    
    # 初始化预测器
    predictor = FreshFoodWastePredictor(
        sales_file=args.sales_file,
        inventory_file=args.inventory_file,
        weather_file=args.weather_file,
        holiday_file=args.holiday_file
    )
    
    if args.mode == 'demo':
        print("="*60)
        print("便利店鲜食报废预测器 - 完整演示模式")
        print("="*60)
        predictor.run_full_demo(args.output_file)
    elif args.mode == 'clean':
        print("="*60)
        print("便利店鲜食报废预测器 - 数据清洗模式")
        print("="*60)
        predictor.clean_all_data()
    elif args.mode == 'validate':
        print("="*60)
        print("便利店鲜食报废预测器 - 数据验证模式")
        print("="*60)
        predictor.validate_all_data()
    else:
        print("="*60)
        print("便利店鲜食报废预测器 - 预测模式")
        print("="*60)
        predictor.predict_and_generate_report(args.output_file)
    
    print(f"\n处理完成！结果已保存到: {args.output_file}")

if __name__ == "__main__":
    main()
