import os
import sys
import csv
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from restock_cli.core import date_to_str
from restock_cli.models import (
    SalesRecord, WeatherRecord, StoreActivity, GroupOrder,
    WeatherType, ActivityType, OrderStatus
)
from restock_cli.storage import (
    save_sales, save_weather, save_activities, save_group_orders,
    save_suggestions, save_actual_consumption, save_deviations
)


def generate_demo_data():
    print("正在生成样例数据...")
    
    today = date.today()
    start_date = today - timedelta(days=20)
    
    sales_records = []
    weather_records = []
    activities = []
    group_orders = []
    
    stores = ['S001', 'S002']
    ingredients = ['I001', 'I002', 'I003', 'I004', 'I005']
    
    base_quantities = {
        'S001': {'I001': 30.0, 'I002': 25.0, 'I003': 20.0, 'I004': 35.0, 'I005': 45.0},
        'S002': {'I001': 18.0, 'I002': 15.0, 'I003': 12.0, 'I004': 20.0, 'I005': 28.0}
    }
    
    for i in range(20):
        current_date = start_date + timedelta(days=i)
        date_str = date_to_str(current_date)
        
        for store_id in stores:
            if i == 5:
                weather = WeatherRecord(
                    date=date_str,
                    store_id=store_id,
                    weather_type=WeatherType.RAINY,
                    temperature=15.0
                )
                weather_records.append(weather)
            elif i == 12:
                weather = WeatherRecord(
                    date=date_str,
                    store_id=store_id,
                    weather_type=WeatherType.RAINY,
                    temperature=12.0
                )
                weather_records.append(weather)
            elif i == 10:
                weather = WeatherRecord(
                    date=date_str,
                    store_id=store_id,
                    weather_type=WeatherType.CLOUDY,
                    temperature=18.0
                )
                weather_records.append(weather)
            else:
                weather = WeatherRecord(
                    date=date_str,
                    store_id=store_id,
                    weather_type=WeatherType.SUNNY,
                    temperature=22.0
                )
                weather_records.append(weather)
            
            if i == 15:
                act = StoreActivity(
                    date=date_str,
                    store_id=store_id,
                    activity_type=ActivityType.PROMOTION,
                    impact_factor=1.3
                )
                activities.append(act)
            
            for ingredient_id in ingredients:
                base_qty = base_quantities[store_id][ingredient_id]
                
                factor = 1.0
                if i == 5 or i == 12:
                    factor = 0.85
                elif i == 15:
                    factor = 1.3
                
                variation = 0.9 + (i % 5) * 0.05
                
                quantity = round(base_qty * factor * variation, 2)
                
                sales_records.append(SalesRecord(
                    date=date_str,
                    store_id=store_id,
                    ingredient_id=ingredient_id,
                    quantity=quantity
                ))
    
    tomorrow = date_to_str(today + timedelta(days=1))
    tomorrow_rain = WeatherRecord(
        date=tomorrow,
        store_id='S001',
        weather_type=WeatherType.RAINY,
        temperature=14.0
    )
    weather_records.append(tomorrow_rain)
    
    tomorrow_activity = StoreActivity(
        date=tomorrow,
        store_id='S001',
        activity_type=ActivityType.PROMOTION,
        impact_factor=1.25
    )
    activities.append(tomorrow_activity)
    
    order1 = GroupOrder(
        order_id='G001',
        date=tomorrow,
        store_id='S001',
        ingredient_id='I001',
        quantity=10.0,
        status=OrderStatus.CONFIRMED
    )
    group_orders.append(order1)
    
    order2 = GroupOrder(
        order_id='G002',
        date=tomorrow,
        store_id='S001',
        ingredient_id='I002',
        quantity=5.0,
        status=OrderStatus.CONFIRMED
    )
    group_orders.append(order2)
    
    order3 = GroupOrder(
        order_id='G003',
        date=tomorrow,
        store_id='S001',
        ingredient_id='I003',
        quantity=8.0,
        status=OrderStatus.CANCELLED
    )
    group_orders.append(order3)
    
    save_sales(sales_records)
    save_weather(weather_records)
    save_activities(activities)
    save_group_orders(group_orders)
    
    print(f"已生成样例数据:")
    print(f"  - 销量记录: {len(sales_records)} 条")
    print(f"  - 天气记录: {len(weather_records)} 条")
    print(f"  - 活动记录: {len(activities)} 条")
    print(f"  - 团餐订单: {len(group_orders)} 条")
    print(f"\n样例场景说明:")
    print(f"  - 日期范围: {date_to_str(start_date)} 至 {date_to_str(today)} (20天历史数据)")
    print(f"  - 第5天和第12天: 雨天（销量约减少15%）")
    print(f"  - 第15天: 促销活动（销量约增加30%）")
    print(f"  - 明天({tomorrow}): 中心店(S001)为雨天，有促销活动")
    print(f"  - 明天团餐: G001(鸡胸肉+10kg), G002(生菜+5kg), G003(番茄已取消)")


def create_sample_csv_files():
    print("\n正在生成示例 CSV 文件...")
    
    today = date.today()
    sample_date = date_to_str(today)
    
    os.makedirs('sample_data', exist_ok=True)
    
    with open('sample_data/sales_sample.csv', 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['date', 'store_id', 'ingredient_id', 'quantity'])
        writer.writerow([sample_date, 'S001', 'I001', 35.5])
        writer.writerow([sample_date, 'S001', 'I002', 28.3])
        writer.writerow([sample_date, 'S002', 'I001', 20.0])
    
    with open('sample_data/weather_sample.csv', 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['date', 'store_id', 'weather_type', 'temperature'])
        writer.writerow([sample_date, 'S001', 'sunny', 25.0])
        writer.writerow([sample_date, 'S002', 'rainy', 18.0])
    
    print("已生成示例 CSV 文件:")
    print("  - sample_data/sales_sample.csv")
    print("  - sample_data/weather_sample.csv")


if __name__ == '__main__':
    generate_demo_data()
    create_sample_csv_files()
    print("\n样例数据生成完成！可以运行 `python cli.py --help` 查看可用命令。")
