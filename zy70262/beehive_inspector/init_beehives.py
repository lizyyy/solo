"""初始化脚本 - 批量导入蜂箱档案"""
import csv
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from beehive_inspector.storage import FileStorage
from beehive_inspector.beehive_manager import BeehiveManager


def import_beehives_from_csv(csv_path: str, data_dir: str = "./data"):
    storage = FileStorage(base_dir=data_dir)
    manager = BeehiveManager(storage)
    
    if not os.path.exists(csv_path):
        print(f"❌ 文件不存在: {csv_path}")
        return
    
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        count = 0
        errors = []
        
        for row in reader:
            try:
                manager.add_beehive(
                    beehive_id=row["beehive_id"],
                    location=row["location"],
                    established_date=row["established_date"],
                    queen_status=row.get("queen_status", "活跃"),
                    notes=row.get("notes", ""),
                )
                count += 1
                print(f"✅ 导入: {row['beehive_id']} - {row['location']}")
            except Exception as e:
                errors.append(f"{row.get('beehive_id', 'unknown')}: {e}")
        
        print(f"\n共导入 {count} 个蜂箱档案")
        if errors:
            print(f"失败 {len(errors)} 个:")
            for err in errors:
                print(f"  - {err}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python -m beehive_inspector.init_beehives <蜂箱档案CSV路径> [数据目录]")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    data_dir = sys.argv[2] if len(sys.argv) > 2 else "./data"
    
    import_beehives_from_csv(csv_path, data_dir)
