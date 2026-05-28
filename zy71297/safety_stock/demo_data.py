import csv
import os
from datetime import date, timedelta
import random


def generate_demo_data(scenario: str = "normal", output_dir: str = "./demo_data") -> dict:
    os.makedirs(output_dir, exist_ok=True)
    
    sales_file = os.path.join(output_dir, f"sales_{scenario}.csv")
    lead_time_file = os.path.join(output_dir, f"lead_time_{scenario}.csv")
    inventory_file = os.path.join(output_dir, f"inventory_{scenario}.csv")
    
    if scenario == "normal":
        _generate_normal_scenario(sales_file, lead_time_file, inventory_file)
    elif scenario == "exception":
        _generate_exception_scenario(sales_file, lead_time_file, inventory_file)
    
    return {
        "sales": sales_file,
        "lead_time": lead_time_file,
        "inventory": inventory_file
    }


def _generate_normal_scenario(sales_file: str, lead_time_file: str, inventory_file: str):
    skus = [
        ("SKU-001", "供应商A", 100, 20, 7, 1.5, 0.95, 150),
        ("SKU-002", "供应商B", 50, 10, 14, 2, 0.90, 80),
        ("SKU-003", "供应商A", 200, 30, 5, 1, 0.98, 300),
    ]
    
    with open(sales_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sku", "date", "quantity", "is_promotion", "promotion_flag"])
        
        start_date = date(2026, 1, 1)
        for sku, supplier, mean, std, lt_mean, lt_std, sl, inv in skus:
            for day in range(60):
                sales_date = start_date + timedelta(days=day)
                quantity = max(0, int(random.gauss(mean, std)))
                writer.writerow([sku, sales_date.isoformat(), quantity, "False", ""])
    
    with open(lead_time_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sku", "supplier", "order_date", "receive_date"])
        
        order_date = date(2025, 10, 1)
        for sku, supplier, mean, std, lt_mean, lt_std, sl, inv in skus:
            for i in range(8):
                lt = max(1, int(random.gauss(lt_mean, lt_std)))
                receive = order_date + timedelta(days=lt)
                writer.writerow([sku, supplier, order_date.isoformat(), receive.isoformat()])
                order_date += timedelta(days=14)
    
    with open(inventory_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sku", "supplier", "current_inventory", "service_level"])
        for sku, supplier, mean, std, lt_mean, lt_std, sl, inv in skus:
            writer.writerow([sku, supplier, inv, sl])


def _generate_exception_scenario(sales_file: str, lead_time_file: str, inventory_file: str):
    skus = [
        ("SKU-101", "供应商X", 80, 15, 10, 2, 0.70, 120),
        ("SKU-102", "供应商Y", 60, 25, 0, 0, 0.95, 50),
        ("SKU-103", "供应商X", 150, 50, 15, 8, 0.9995, 500),
    ]
    
    with open(sales_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sku", "date", "quantity", "is_promotion", "promotion_flag"])
        
        start_date = date(2026, 1, 1)
        
        sku, supplier, mean, std, lt_mean, lt_std, sl, inv = skus[0]
        for day in range(60):
            sales_date = start_date + timedelta(days=day)
            quantity = max(0, int(random.gauss(mean, std)))
            is_promo = day in [15, 16, 17, 35, 36, 37]
            if is_promo:
                quantity = int(quantity * 3.5)
            writer.writerow([sku, sales_date.isoformat(), quantity, str(is_promo), "618大促" if is_promo else ""])
        
        sku, supplier, mean, std, lt_mean, lt_std, sl, inv = skus[1]
        for day in [0, 1, 2, 3, 4, 20, 21, 22]:
            sales_date = start_date + timedelta(days=day)
            quantity = max(0, int(random.gauss(mean, std)))
            writer.writerow([sku, sales_date.isoformat(), quantity, "False", ""])
        
        sku, supplier, mean, std, lt_mean, lt_std, sl, inv = skus[2]
        for day in range(60):
            sales_date = start_date + timedelta(days=day)
            quantity = max(0, int(random.gauss(mean, std)))
            if day == 25:
                quantity = 2000
            writer.writerow([sku, sales_date.isoformat(), quantity, "False", ""])
    
    with open(lead_time_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sku", "supplier", "order_date", "receive_date"])
        
        sku, supplier, mean, std, lt_mean, lt_std, sl, inv = skus[0]
        order_date = date(2025, 10, 1)
        for i in range(8):
            lt = max(1, int(random.gauss(lt_mean, lt_std)))
            receive = order_date + timedelta(days=lt)
            writer.writerow([sku, supplier, order_date.isoformat(), receive.isoformat()])
            order_date += timedelta(days=14)
        
        sku, supplier, mean, std, lt_mean, lt_std, sl, inv = skus[2]
        order_date = date(2025, 10, 1)
        for i in range(10):
            if i < 5:
                lt = 7
            else:
                lt = 45
            receive = order_date + timedelta(days=lt)
            writer.writerow([sku, supplier, order_date.isoformat(), receive.isoformat()])
            order_date += timedelta(days=14)
    
    with open(inventory_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sku", "supplier", "current_inventory", "service_level"])
        for sku, supplier, mean, std, lt_mean, lt_std, sl, inv in skus:
            writer.writerow([sku, supplier, inv, sl])
