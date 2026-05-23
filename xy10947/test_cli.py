#!/usr/bin/env python3
"""测试CLI工具"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from food_waste.cli import cli

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'init':
        print("生成示例数据...")
        from pathlib import Path
        import csv
        
        output_dir = Path('./sample_data')
        output_dir.mkdir(parents=True, exist_ok=True)
        
        materials_csv = output_dir / 'materials.csv'
        with open(materials_csv, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['material_id', 'material_name', 'category', 'unit', 'unit_conversion', 'price_per_unit'])
            writer.writerow(['M001', '猪肉', '肉类', '千克', '斤:0.5;克:0.001', 30.0])
            writer.writerow(['M002', '牛肉', '肉类', '千克', '斤:0.5;克:0.001', 60.0])
            writer.writerow(['M003', '青菜', '蔬菜', '千克', '斤:0.5;克:0.001', 5.0])
            writer.writerow(['M004', '西红柿', '蔬菜', '千克', '斤:0.5;克:0.001', 4.0])
            writer.writerow(['M005', '鸡蛋', '蛋类', '千克', '个:0.05;斤:0.5', 10.0])
        
        stores_csv = output_dir / 'stores.csv'
        with open(stores_csv, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['store_id', 'store_name', 'region', 'manager'])
            writer.writerow(['S001', '北京朝阳店', '北京', '张三'])
            writer.writerow(['S002', '上海浦东店', '上海', '李四'])
            writer.writerow(['S003', '广州天河店', '广州', '王五'])
        
        purchases_csv = output_dir / 'purchases.csv'
        with open(purchases_csv, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['purchase_id', 'store_id', 'material_id', 'purchase_date', 'quantity', 'unit', 'total_price'])
            writer.writerow(['P001', 'S001', 'M001', '2024-01-15', 100, '千克', 3000.0])
            writer.writerow(['P002', 'S001', 'M003', '2024-01-15', 50, '千克', 250.0])
            writer.writerow(['P003', 'S002', 'M001', '2024-01-15', 80, '千克', 2400.0])
            writer.writerow(['P004', 'S002', 'M002', '2024-01-16', 50, '千克', 3000.0])
            writer.writerow(['P005', 'S003', 'M005', '2024-01-16', 200, '千克', 2000.0])
        
        usages_csv = output_dir / 'usages.csv'
        with open(usages_csv, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['usage_id', 'store_id', 'material_id', 'usage_date', 'quantity', 'unit', 'department'])
            writer.writerow(['U001', 'S001', 'M001', '2024-01-15', 80, '千克', '厨房'])
            writer.writerow(['U002', 'S001', 'M003', '2024-01-15', 40, '千克', '厨房'])
            writer.writerow(['U003', 'S002', 'M001', '2024-01-15', 70, '千克', '厨房'])
            writer.writerow(['U004', 'S002', 'M002', '2024-01-16', 45, '千克', '厨房'])
            writer.writerow(['U005', 'S003', 'M005', '2024-01-16', 180, '千克', '厨房'])
        
        wastes_csv = output_dir / 'wastes.csv'
        with open(wastes_csv, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['waste_id', 'store_id', 'material_id', 'waste_date', 'quantity', 'unit', 'reason'])
            writer.writerow(['W001', 'S001', 'M001', '2024-01-16', 8, '千克', '过期'])
            writer.writerow(['W002', 'S001', 'M003', '2024-01-16', 5, '千克', '变质'])
            writer.writerow(['W003', 'S002', 'M001', '2024-01-16', 2, '千克', '过期'])
            writer.writerow(['W004', 'S002', 'M002', '2024-01-17', 3, '千克', '变质'])
            writer.writerow(['W005', 'S003', 'M005', '2024-01-17', 15, '千克', '破损'])
        
        print(f"示例数据已生成到: {output_dir.absolute()}")
        print("\n使用示例命令:")
        print(f"  python test_cli.py analyze "
              f"-m {output_dir}/materials.csv "
              f"-s {output_dir}/stores.csv "
              f"-p {output_dir}/purchases.csv "
              f"-u {output_dir}/usages.csv "
              f"-w {output_dir}/wastes.csv")
    
    elif len(sys.argv) > 1 and sys.argv[1] == 'analyze':
        print("开始分析...")
        
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument('-m', '--materials', required=True)
        parser.add_argument('-s', '--stores', required=True)
        parser.add_argument('-p', '--purchases', required=True)
        parser.add_argument('-u', '--usages', required=True)
        parser.add_argument('-w', '--wastes', required=True)
        parser.add_argument('-o', '--output-dir', default='./output')
        parser.add_argument('-t', '--threshold', type=float, default=5.0)
        parser.add_argument('--overwrite', action='store_true')
        parser.add_argument('-q', '--quiet', action='store_true', help='静默模式，不输出终端摘要')
        
        args = parser.parse_args(sys.argv[2:])
        
        from food_waste.data_loader import DataLoader
        from food_waste.processor import WasteCalculator
        from food_waste.models import ProcessConfig
        from food_waste.output import OutputGenerator
        
        loader = DataLoader()
        
        print("正在加载数据...")
        
        materials_dict, material_errors = loader.load_materials(args.materials)
        print(f"  原料数据: {len(materials_dict)} 条成功, {len(material_errors)} 条错误")
        
        stores_dict, store_errors = loader.load_stores(args.stores)
        print(f"  门店数据: {len(stores_dict)} 条成功, {len(store_errors)} 条错误")
        
        purchases_list, purchase_errors = loader.load_purchases(args.purchases)
        print(f"  采购数据: {len(purchases_list)} 条成功, {len(purchase_errors)} 条错误")
        
        usages_list, usage_errors = loader.load_usages(args.usages)
        print(f"  领用数据: {len(usages_list)} 条成功, {len(usage_errors)} 条错误")
        
        wastes_list, waste_errors = loader.load_wastes(args.wastes)
        print(f"  报损数据: {len(wastes_list)} 条成功, {len(waste_errors)} 条错误")
        
        all_errors = loader.get_all_errors()
        if all_errors:
            print(f"  总计 {len(all_errors)} 条数据校验错误")
        
        config = ProcessConfig(threshold_waste_rate=args.threshold)
        
        print("正在计算损耗数据...")
        calculator = WasteCalculator(
            materials=materials_dict,
            stores=stores_dict,
            purchases=purchases_list,
            usages=usages_list,
            wastes=wastes_list,
            config=config
        )
        
        report = calculator.generate_report(all_errors)
        
        print("正在生成输出文件...")
        generator = OutputGenerator(report, args.output_dir, overwrite=args.overwrite)
        
        json_path = generator.export_json()
        csv_paths = generator.export_csv()
        md_path = generator.generate_markdown_report()
        
        if not args.quiet:
            generator.print_terminal_summary()
        
        print(f"报告已生成到: {args.output_dir}")
        print(f"  JSON报告: {json_path.name}")
        print(f"  CSV文件: {len(csv_paths)}个")
        print(f"  Markdown报告: {md_path.name}")
        
        if report.summary['abnormal_items_count'] > 0:
            print(f"\n警告: 发现 {report.summary['abnormal_items_count']} 项异常损耗！")
    
    else:
        print("餐饮原料损耗 CLI 工具")
        print("\n用法:")
        print("  python test_cli.py init [output_dir]  - 生成示例数据")
        print("  python test_cli.py analyze [options]   - 分析原料损耗数据")
        print("\n示例:")
        print("  python test_cli.py init")
        print("  python test_cli.py analyze -m sample_data/materials.csv -s sample_data/stores.csv -p sample_data/purchases.csv -u sample_data/usages.csv -w sample_data/wastes.csv")
