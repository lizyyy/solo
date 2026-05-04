import sys
import os
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, init_db
from models import Generator, Circuit, Stall, DrillRecord


def load_json_file(filename):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def parse_datetime(dt_str):
    if isinstance(dt_str, str):
        try:
            return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        except ValueError:
            return datetime.strptime(dt_str, '%Y-%m-%dT%H:%M:%S')
    return dt_str


def import_generators(db):
    data = load_json_file('generators.json')
    count = 0
    for item in data:
        gen = Generator(**item)
        db.add(gen)
        count += 1
    db.commit()
    print(f"导入发电机: {count} 条")


def import_circuits(db):
    data = load_json_file('circuits.json')
    count = 0
    for item in data:
        circuit = Circuit(**item)
        db.add(circuit)
        count += 1
    db.commit()
    print(f"导入回路: {count} 条")


def import_stalls(db):
    data = load_json_file('stalls.json')
    count = 0
    for item in data:
        stall = Stall(**item)
        db.add(stall)
        count += 1
    db.commit()
    print(f"导入摊位: {count} 条")


def import_drills(db):
    data = load_json_file('drills.json')
    count = 0
    for item in data:
        item['drill_date'] = parse_datetime(item['drill_date'])
        drill = DrillRecord(**item)
        db.add(drill)
        count += 1
    db.commit()
    print(f"导入演练记录: {count} 条")


def main():
    print("=" * 50)
    print("音乐节电力管理系统 - 示例数据导入")
    print("=" * 50)
    
    init_db()
    db = SessionLocal()
    
    try:
        print("\n正在导入数据...\n")
        import_generators(db)
        import_circuits(db)
        import_stalls(db)
        import_drills(db)
        
        print("\n" + "=" * 50)
        print("导入完成!")
        print("=" * 50)
        print("\n数据摘要:")
        print(f"  发电机: {db.query(Generator).count()} 台")
        print(f"  回路: {db.query(Circuit).count()} 条")
        print(f"  摊位: {db.query(Stall).count()} 个")
        print(f"  演练记录: {db.query(DrillRecord).count()} 条")
        print("\n示例数据中的风险场景:")
        print("  1. 主舞台音响回路超载 (22kW / 25kW = 88%)")
        print("  2. 美食区-A回路超载 (13kW / 15kW = 87%)")
        print("  3. 美食区-B回路超载 (13kW / 15kW = 87%)")
        print("  4. 三相不平衡 (L1负载偏高)")
        print("  5. 发电机冗余可能不足")
        print("  6. 雨棚摊位01和03未接漏保(RCD)")
        print("  7. 停电演练未覆盖副舞台")
        
    finally:
        db.close()


if __name__ == "__main__":
    main()
