"""
快速开始演示脚本

从空数据开始，展示完整流程：
1. 导入房间 -> 2. 导入炉具 -> 3. 导入入住 -> 4. 导入入库
5. 核算消耗 -> 6. 检查异常 -> 7. 生成报表
"""

import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from firewood_ledger.database import Database
from firewood_ledger.models import RoomManager, StoveManager, StayManager, FirewoodInManager
from firewood_ledger.calculator import ConsumptionCalculator
from firewood_ledger.importer import DataImporter, ReportGenerator


def print_header(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def main():
    print_header("🏠 乡村民宿柴火消耗台账 - 快速演示")
    print("\n本演示将展示完整业务流程：")
    print("  房间配置 → 炉具设置 → 入住记录 → 柴火入库")
    print("  ↓")
    print("  消耗核算 → 异常检查 → 报表生成")
    
    # 1. 初始化数据库
    print_header("📦 步骤1: 初始化数据")
    db = Database()
    print("✅ 数据库已初始化 (data/firewood_ledger.db)")
    
    # 2. 导入房间
    print_header("🛏️ 步骤2: 导入房间配置")
    importer = DataImporter(db)
    rooms_file = project_root / "data_samples" / "rooms.csv"
    result = importer.import_rooms(str(rooms_file))
    print(f"✅ 导入房间: 成功{result['success']}, 重复{result['duplicate']}, 错误{result['error']}")
    
    room_manager = RoomManager(db)
    rooms = room_manager.list_rooms()
    print(f"   当前房间数: {len(rooms)}")
    for r in rooms:
        print(f"   - {r['room_number']}: {r['name']} (楼层{r['floor']}, 最多{r['max_guests']}人)")
    
    # 3. 导入炉具
    print_header("🔥 步骤3: 导入炉具配置")
    stoves_file = project_root / "data_samples" / "stoves.csv"
    result = importer.import_stoves(str(stoves_file))
    print(f"✅ 导入炉具: 成功{result['success']}, 重复{result['duplicate']}, 错误{result['error']}")
    
    stove_manager = StoveManager(db)
    stoves = stove_manager.list_stoves()
    print(f"   当前炉具数: {len(stoves)}")
    for s in stoves:
        print(f"   - 房间{s['room_number']}: {s['stove_type']} ({s['daily_consumption_kg']}kg/天)")
    
    print("\n💡 炉具默认日消耗: 土炕4kg, 壁炉6kg, 火炉5kg, 暖墙3.5kg, 地暖7kg")
    
    # 4. 导入入住记录
    print_header("📅 步骤4: 导入入住记录")
    stays_file = project_root / "data_samples" / "stays.csv"
    result = importer.import_stays(str(stays_file))
    print(f"✅ 导入入住: 成功{result['success']}, 重复{result['duplicate']}, 错误{result['error']}")
    
    stay_manager = StayManager(db)
    stays = stay_manager.list_stays()
    print(f"   当前入住记录数: {len(stays)}")
    for s in stays:
        status = "在住" if s['status'] == 'checked_in' else "已退房"
        checkout = s['check_out_date'] or "-"
        print(f"   - {s['stay_code']}: {s['room_number']} {s['check_in_date']}→{checkout} [{status}]")
    
    # 5. 导入柴火入库
    print_header("🪵 步骤5: 导入柴火入库")
    fw_file = project_root / "data_samples" / "firewood.csv"
    result = importer.import_firewood(str(fw_file))
    print(f"✅ 导入入库: 成功{result['success']}, 重复{result['duplicate']}, 错误{result['error']}")
    
    fw_manager = FirewoodInManager(db)
    fw_list = fw_manager.list_firewood()
    total_in = fw_manager.get_total_in()
    print(f"   当前入库记录数: {len(fw_list)}, 总入库: {total_in:.1f}kg")
    for fw in fw_list:
        print(f"   - {fw['batch_code']}: {fw['delivery_date']} {fw['weight_kg']}kg ({fw['wood_type']})")
    
    # 6. 执行消耗核算
    print_header("🧮 步骤6: 执行消耗核算")
    calculator = ConsumptionCalculator(db)
    
    normal, abnormal = calculator.run_consumption_check()
    print(f"✅ 核算完成: 正常{len(normal)}条, 异常{len(abnormal)}条")
    
    saved = calculator.save_consumption_results(normal)
    print(f"💾 已保存 {saved} 条消耗明细")
    
    total_estimated = sum(r['estimated_total'] for r in normal)
    print(f"\n📊 核算结果汇总:")
    print(f"   总估算消耗: {total_estimated:.1f} kg")
    print(f"   总入库量: {total_in:.1f} kg")
    print(f"   库存结余: {total_in - total_estimated:.1f} kg")
    
    # 7. 检查异常
    print_header("🔍 步骤7: 检查异常记录")
    anomalies = calculator.find_anomalies()
    if anomalies:
        print(f"⚠️  发现 {len(anomalies)} 条异常:")
        for a in anomalies:
            print(f"   - [{a['severity']}] {a['type']}: {a['message']}")
    else:
        print("✅ 未发现异常记录")
    
    # 8. 生成报表
    print_header("📊 步骤8: 生成业务报表")
    generator = ReportGenerator(db)
    
    reports_dir = project_root / "data" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    from datetime import datetime
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    html_path = reports_dir / f"firewood_report_{timestamp}.html"
    csv_path = reports_dir / f"firewood_report_{timestamp}.csv"
    
    generator.generate_html_report(str(html_path))
    generator.generate_csv_report(str(csv_path))
    
    print(f"✅ HTML报表: {html_path}")
    print(f"✅ CSV报表:  {csv_path}")
    
    # 9. 统计数据
    print_header("📈 最终统计")
    stats = calculator.get_statistics()
    
    print("\n📦 库存概览:")
    print(f"   总入库: {stats['inventory']['total_in_kg']:.1f} kg")
    print(f"   估算消耗: {stats['inventory']['total_estimated_kg']:.1f} kg")
    print(f"   库存结余: {stats['inventory']['remaining_kg']:.1f} kg")
    
    print("\n🔥 炉具类型消耗分析:")
    for s in stats['stove_type_breakdown']:
        print(f"   {s['stove_type']}: {s['total_consumption']:.1f}kg ({s['stay_count']}次入住)")
    
    print("\n🛏️ 房间消耗排行:")
    for s in stats['room_breakdown']:
        print(f"   房间{s['room_number']}: {s['total_consumption']:.1f}kg ({s['stay_count']}次)")
    
    print_header("✅ 演示完成！")
    print("\n核心主线验证:")
    print("  🪵 柴火取暖 → 已通过取暖季判断 (11月-3月)")
    print("  🔥 炉具差异 → 已通过不同炉具日消耗量区分")
    print("  📅 入住天数 → 已通过入住/退房日期计算取暖天数")
    print("\n使用CLI命令继续操作:")
    print("  python -m firewood_ledger --help")
    print("  python -m firewood_ledger calculate")
    print("  python -m firewood_ledger anomalies")
    print("  python -m firewood_ledger report")


if __name__ == '__main__':
    main()
