import csv
from pathlib import Path


def generate_normal_sample(output_path: Path) -> None:
    materials = [
        {"material_id": "M001", "material_name": "五花肉", "category": "肉类", "unit": "千克", "unit_price": 35.0},
        {"material_id": "M002", "material_name": "生菜", "category": "蔬菜", "unit": "千克", "unit_price": 5.0},
        {"material_id": "M003", "material_name": "鸡蛋", "category": "蛋类", "unit": "个", "unit_price": 0.8},
        {"material_id": "M004", "material_name": "大米", "category": "主食", "unit": "千克", "unit_price": 6.0},
        {"material_id": "M005", "material_name": "食用油", "category": "调料", "unit": "千克", "unit_price": 15.0},
    ]

    stores = [
        {"store_id": "S001", "store_name": "朝阳门店", "region": "北京"},
        {"store_id": "S002", "store_name": "西单店", "region": "北京"},
        {"store_id": "S003", "store_name": "浦东店", "region": "上海"},
        {"store_id": "S004", "store_name": "天河店", "region": "广州"},
    ]

    purchases = [
        {"order_id": "P001", "material_id": "M001", "store_id": "S001", "purchase_date": "2024-01-01", "quantity": 100, "unit": "千克"},
        {"order_id": "P002", "material_id": "M001", "store_id": "S002", "purchase_date": "2024-01-01", "quantity": 80, "unit": "千克"},
        {"order_id": "P003", "material_id": "M001", "store_id": "S003", "purchase_date": "2024-01-01", "quantity": 120, "unit": "千克"},
        {"order_id": "P004", "material_id": "M001", "store_id": "S004", "purchase_date": "2024-01-01", "quantity": 90, "unit": "千克"},
        {"order_id": "P005", "material_id": "M002", "store_id": "S001", "purchase_date": "2024-01-01", "quantity": 50, "unit": "千克"},
        {"order_id": "P006", "material_id": "M002", "store_id": "S002", "purchase_date": "2024-01-01", "quantity": 40, "unit": "千克"},
        {"order_id": "P007", "material_id": "M003", "store_id": "S001", "purchase_date": "2024-01-01", "quantity": 200, "unit": "个"},
        {"order_id": "P008", "material_id": "M004", "store_id": "S001", "purchase_date": "2024-01-01", "quantity": 200, "unit": "千克"},
        {"order_id": "P009", "material_id": "M005", "store_id": "S001", "purchase_date": "2024-01-01", "quantity": 30, "unit": "千克"},
    ]

    usages = [
        {"order_id": "U001", "material_id": "M001", "store_id": "S001", "usage_date": "2024-01-02", "quantity": 90, "unit": "千克"},
        {"order_id": "U002", "material_id": "M001", "store_id": "S002", "usage_date": "2024-01-02", "quantity": 75, "unit": "千克"},
        {"order_id": "U003", "material_id": "M001", "store_id": "S003", "usage_date": "2024-01-02", "quantity": 100, "unit": "千克"},
        {"order_id": "U004", "material_id": "M001", "store_id": "S004", "usage_date": "2024-01-02", "quantity": 85, "unit": "千克"},
        {"order_id": "U005", "material_id": "M002", "store_id": "S001", "usage_date": "2024-01-02", "quantity": 45, "unit": "千克"},
        {"order_id": "U006", "material_id": "M002", "store_id": "S002", "usage_date": "2024-01-02", "quantity": 38, "unit": "千克"},
        {"order_id": "U007", "material_id": "M003", "store_id": "S001", "usage_date": "2024-01-02", "quantity": 190, "unit": "个"},
        {"order_id": "U008", "material_id": "M004", "store_id": "S001", "usage_date": "2024-01-02", "quantity": 195, "unit": "千克"},
        {"order_id": "U009", "material_id": "M005", "store_id": "S001", "usage_date": "2024-01-02", "quantity": 28, "unit": "千克"},
    ]

    damages = [
        {"report_id": "D001", "material_id": "M001", "store_id": "S001", "damage_date": "2024-01-03", "quantity": 3, "unit": "千克", "reason": "过期变质"},
        {"report_id": "D002", "material_id": "M001", "store_id": "S002", "damage_date": "2024-01-03", "quantity": 2, "unit": "千克", "reason": "储存不当"},
        {"report_id": "D003", "material_id": "M001", "store_id": "S003", "damage_date": "2024-01-03", "quantity": 15, "unit": "千克", "reason": "冷链故障"},
        {"report_id": "D004", "material_id": "M001", "store_id": "S004", "damage_date": "2024-01-03", "quantity": 2, "unit": "千克", "reason": "正常损耗"},
        {"report_id": "D005", "material_id": "M002", "store_id": "S001", "damage_date": "2024-01-03", "quantity": 2, "unit": "千克", "reason": "失水枯萎"},
        {"report_id": "D006", "material_id": "M002", "store_id": "S002", "damage_date": "2024-01-03", "quantity": 1, "unit": "千克", "reason": "正常损耗"},
        {"report_id": "D007", "material_id": "M003", "store_id": "S001", "damage_date": "2024-01-03", "quantity": 5, "unit": "个", "reason": "破损"},
        {"report_id": "D008", "material_id": "M004", "store_id": "S001", "damage_date": "2024-01-03", "quantity": 2, "unit": "千克", "reason": "受潮"},
        {"report_id": "D009", "material_id": "M005", "store_id": "S001", "damage_date": "2024-01-03", "quantity": 1, "unit": "千克", "reason": "正常损耗"},
    ]

    _write_csv(output_path / "materials.csv", materials)
    _write_csv(output_path / "purchases.csv", purchases)
    _write_csv(output_path / "usages.csv", usages)
    _write_csv(output_path / "damages.csv", damages)
    _write_csv(output_path / "stores.csv", stores)


def generate_dirty_sample(output_path: Path) -> None:
    materials = [
        {"material_id": "M001", "material_name": "五花肉", "category": "肉类", "unit": "千克", "unit_price": 35.0},
        {"material_id": "M002", "material_name": "", "category": "蔬菜", "unit": "kg", "unit_price": 5.0},
        {"material_id": "M003", "material_name": "鸡蛋", "category": "蛋类", "unit": "invalid_unit", "unit_price": "not_a_number"},
    ]

    stores = [
        {"store_id": "S001", "store_name": "朝阳门店", "region": "北京"},
        {"store_id": "S002", "store_name": "  ", "region": "北京"},
    ]

    purchases = [
        {"order_id": "P001", "material_id": "M001", "store_id": "S001", "purchase_date": "2024-01-01", "quantity": 100, "unit": "千克"},
        {"order_id": "P002", "material_id": "INVALID", "store_id": "S001", "purchase_date": "not_a_date", "quantity": "abc", "unit": "千克"},
        {"order_id": "P003", "material_id": "M001", "store_id": "NONEXIST", "purchase_date": "2024/01/01", "quantity": -5, "unit": "千克"},
    ]

    usages = [
        {"order_id": "U001", "material_id": "M001", "store_id": "S001", "usage_date": "2024-01-02", "quantity": 90, "unit": "千克"},
    ]

    damages = [
        {"report_id": "D001", "material_id": "M001", "store_id": "S001", "damage_date": "2024-01-03", "quantity": 3, "unit": "千克", "reason": "过期变质"},
        {"report_id": "D002", "material_id": "M002", "store_id": "S002", "damage_date": "2024-1-1", "quantity": "", "unit": "公斤", "reason": ""},
    ]

    _write_csv(output_path / "materials.csv", materials)
    _write_csv(output_path / "purchases.csv", purchases)
    _write_csv(output_path / "usages.csv", usages)
    _write_csv(output_path / "damages.csv", damages)
    _write_csv(output_path / "stores.csv", stores)


def generate_boundary_sample(output_path: Path) -> None:
    materials = [
        {"material_id": "M001", "material_name": "五花肉", "category": "肉类", "unit": "千克", "unit_price": 35.0},
        {"material_id": "M002", "material_name": "生菜", "category": "蔬菜", "unit": "千克", "unit_price": 5.0},
    ]

    stores = [
        {"store_id": "S001", "store_name": "门店1", "region": "区域1"},
    ]

    purchases = [
        {"order_id": "P001", "material_id": "M001", "store_id": "S001", "purchase_date": "2024-01-01", "quantity": 100, "unit": "千克"},
        {"order_id": "P002", "material_id": "M001", "store_id": "S001", "purchase_date": "2024-01-01", "quantity": 50000, "unit": "克"},
        {"order_id": "P003", "material_id": "M002", "store_id": "S001", "purchase_date": "2024-01-01", "quantity": 100, "unit": "斤"},
    ]

    usages = [
        {"order_id": "U001", "material_id": "M001", "store_id": "S001", "usage_date": "2024-01-02", "quantity": 140, "unit": "千克"},
        {"order_id": "U002", "material_id": "M002", "store_id": "S001", "usage_date": "2024-01-02", "quantity": 45, "unit": "千克"},
    ]

    damages = [
        {"report_id": "D001", "material_id": "M001", "store_id": "S001", "damage_date": "2024-01-03", "quantity": 5, "unit": "千克", "reason": "刚好在阈值边界"},
        {"report_id": "D002", "material_id": "M002", "store_id": "S001", "damage_date": "2024-01-03", "quantity": 5000, "unit": "克", "reason": "单位转换边界"},
    ]

    _write_csv(output_path / "materials.csv", materials)
    _write_csv(output_path / "purchases.csv", purchases)
    _write_csv(output_path / "usages.csv", usages)
    _write_csv(output_path / "damages.csv", damages)
    _write_csv(output_path / "stores.csv", stores)


def generate_empty_sample(output_path: Path) -> None:
    materials = [
        {"material_id": "M001", "material_name": "五花肉", "category": "肉类", "unit": "千克", "unit_price": 35.0},
    ]

    stores = [
        {"store_id": "S001", "store_name": "朝阳门店", "region": "北京"},
    ]

    purchases = []
    usages = []
    damages = []

    _write_csv(output_path / "materials.csv", materials)
    _write_csv(output_path / "purchases.csv", purchases)
    _write_csv(output_path / "usages.csv", usages)
    _write_csv(output_path / "damages.csv", damages)
    _write_csv(output_path / "stores.csv", stores)


def _write_csv(file_path: Path, rows: list) -> None:
    if not rows:
        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            pass
        return

    with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
