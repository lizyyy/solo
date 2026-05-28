import argparse
import json
import csv
import sys
from datetime import datetime, date, timedelta
from typing import Dict, List
import uuid

from .models import (
    SalesRecord,
    LeadTimeRecord,
    SKUResult,
    TrialRunReport,
    DataQualityStatus,
)
from .calculator import (
    calculate_demand_statistics,
    calculate_lead_time_statistics,
    calculate_safety_stock,
    calculate_sensitivity_analysis,
    get_recommended_action,
)
from .validator import DataValidator, filter_clean_sales_data
from .reporter import Reporter


def load_sales_data(filepath: str) -> List[SalesRecord]:
    records = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(SalesRecord(
                sku=row["sku"],
                date=datetime.strptime(row["date"], "%Y-%m-%d").date(),
                quantity=int(row["quantity"]),
                is_promotion=row.get("is_promotion", "False").lower() == "true",
                promotion_flag=row.get("promotion_flag", None)
            ))
    return records


def load_lead_time_data(filepath: str) -> List[LeadTimeRecord]:
    records = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(LeadTimeRecord(
                sku=row["sku"],
                supplier=row["supplier"],
                order_date=datetime.strptime(row["order_date"], "%Y-%m-%d").date(),
                receive_date=datetime.strptime(row["receive_date"], "%Y-%m-%d").date(),
            ))
    return records


def load_inventory_data(filepath: str) -> Dict[str, dict]:
    inventory = {}
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            inventory[row["sku"]] = {
                "supplier": row["supplier"],
                "current_inventory": int(row["current_inventory"]),
                "service_level": float(row.get("service_level", "0.95")),
            }
    return inventory


def run_trial(
    sales_file: str,
    lead_time_file: str,
    inventory_file: str,
    output_dir: str = "./output",
    exclude_promotions: bool = True,
) -> TrialRunReport:
    print(f"正在加载销售数据: {sales_file}")
    all_sales = load_sales_data(sales_file)
    print(f"  加载了 {len(all_sales)} 条销售记录")
    
    print(f"正在加载到货周期数据: {lead_time_file}")
    all_lead_times = load_lead_time_data(lead_time_file)
    print(f"  加载了 {len(all_lead_times)} 条到货周期记录")
    
    print(f"正在加载库存数据: {inventory_file}")
    inventory = load_inventory_data(inventory_file)
    print(f"  加载了 {len(inventory)} 个SKU的库存信息")
    
    sku_results: List[SKUResult] = []
    validator = DataValidator()
    
    for sku, inv_info in inventory.items():
        print(f"\n正在处理 SKU: {sku}")
        supplier = inv_info["supplier"]
        service_level = inv_info["service_level"]
        current_inventory = inv_info["current_inventory"]
        
        sku_sales = [s for s in all_sales if s.sku == sku]
        sku_lead_times = [lt for lt in all_lead_times if lt.sku == sku and lt.supplier == supplier]
        
        data_status, anomalies = validator.validate_all(
            sku=sku,
            sales_records=sku_sales,
            lead_time_records=sku_lead_times,
            service_level=service_level,
            current_inventory=current_inventory
        )
        
        has_critical = any(a.severity == "critical" for a in anomalies)
        
        try:
            clean_sales = filter_clean_sales_data(
                sku_sales,
                exclude_promotions=exclude_promotions,
                exclude_outliers=True
            )
            
            demand_stats = calculate_demand_statistics(
                sku=sku,
                sales_records=clean_sales,
                exclude_outliers=False
            )
            
            lead_time_stats = calculate_lead_time_statistics(
                sku=sku,
                supplier=supplier,
                lead_time_records=sku_lead_times
            )
            
            safety_stock_result = calculate_safety_stock(
                sku=sku,
                supplier=supplier,
                demand_stats=demand_stats,
                lead_time_stats=lead_time_stats,
                service_level=min(service_level, 0.999)
            )
            
            sensitivity = calculate_sensitivity_analysis(
                sku=sku,
                demand_stats=demand_stats,
                lead_time_stats=lead_time_stats,
                base_service_level=service_level
            )
            
            recommended_action = get_recommended_action(
                current_inventory=current_inventory,
                safety_stock=safety_stock_result.safety_stock_units,
                reorder_point=safety_stock_result.reorder_point,
                data_quality_issues=has_critical
            )
            
        except Exception as e:
            print(f"  警告: SKU {sku} 计算出错: {e}")
            continue
        
        sku_result = SKUResult(
            sku=sku,
            supplier=supplier,
            demand_stats=demand_stats,
            lead_time_stats=lead_time_stats,
            safety_stock=safety_stock_result,
            sensitivity=sensitivity,
            current_inventory=current_inventory,
            recommended_action=recommended_action,
            anomalies=anomalies,
            data_quality=data_status
        )
        sku_results.append(sku_result)
        print(f"  完成 - 安全库存: {safety_stock_result.safety_stock_units} 件")
    
    total_anomalies = sum(len(r.anomalies) for r in sku_results)
    critical_anomalies = sum(
        sum(1 for a in r.anomalies if a.severity == "critical")
        for r in sku_results
    )
    manual_review_required = [
        r.sku for r in sku_results if r.anomalies
    ]
    
    overall_status = DataQualityStatus.CLEAN
    if critical_anomalies > 0:
        overall_status = DataQualityStatus.ERROR
    elif total_anomalies > 0:
        overall_status = DataQualityStatus.WARNING
    
    report = TrialRunReport(
        run_id=str(uuid.uuid4())[:8],
        run_date=datetime.now(),
        overall_status=overall_status,
        sku_results=sku_results,
        total_anomalies=total_anomalies,
        critical_anomalies=critical_anomalies,
        manual_review_required=manual_review_required
    )
    
    print(f"\n正在生成报告...")
    reporter = Reporter(output_dir=output_dir)
    reporter.generate_all(report)
    
    return report


def main():
    parser = argparse.ArgumentParser(
        description="库存安全量试算工具 - 按需求波动和到货周期计算安全库存",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 运行完整试算
  python -m safety_stock.cli --sales data/sales.csv --lead-time data/lead_time.csv --inventory data/inventory.csv
  
  # 使用演示数据
  python -m safety_stock.cli --demo normal
  python -m safety_stock.cli --demo exception
        """
    )
    
    parser.add_argument("--sales", help="销售历史数据CSV文件")
    parser.add_argument("--lead-time", dest="lead_time", help="到货周期数据CSV文件")
    parser.add_argument("--inventory", help="库存余额数据CSV文件")
    parser.add_argument("--demo", choices=["normal", "exception"], help="使用演示数据运行")
    parser.add_argument("--output-dir", default="./output", help="报告输出目录 (默认: ./output)")
    parser.add_argument("--include-promotions", action="store_true", help="计算时包含促销数据")
    
    args = parser.parse_args()
    
    if args.demo:
        from .demo_data import generate_demo_data
        files = generate_demo_data(scenario=args.demo)
        args.sales = files["sales"]
        args.lead_time = files["lead_time"]
        args.inventory = files["inventory"]
        print(f"已生成{args.demo}场景演示数据\n")
    
    if not all([args.sales, args.lead_time, args.inventory]):
        parser.print_help()
        sys.exit(1)
    
    try:
        run_trial(
            sales_file=args.sales,
            lead_time_file=args.lead_time,
            inventory_file=args.inventory,
            output_dir=args.output_dir,
            exclude_promotions=not args.include_promotions
        )
        print("\n✓ 试算完成！")
    except Exception as e:
        print(f"\n✗ 出错: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
