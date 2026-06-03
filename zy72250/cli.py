import sys
from typing import List
from core import WarehouseBlindSpotReview
from demo_data import DemoData
from models import PointStatus


def print_header(title: str):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_step(step_num: int, desc: str):
    print(f"\n【步骤 {step_num}】 {desc}")
    print("-" * 40)


def print_status_icon(status: PointStatus) -> str:
    icons = {
        PointStatus.NORMAL: "✅",
        PointStatus.MISSING_COORD: "⚠️",
        PointStatus.FROM_SAFETY_RADIUS: "📋",
        PointStatus.PENDING_REVIEW: "🔍"
    }
    return icons.get(status, "❓")


def run_demo_workflow():
    print_header("仓库叉车盲区复盘 - 三步流程演示")
    print("培训教官老梁 给安全员演示标准流程")
    
    review_system = WarehouseBlindSpotReview()
    
    demo_case = DemoData.get_supplemented_case()
    photo_id = demo_case["photo_id"]
    
    print_step(1, "点云抽稀日志第一次导入")
    logs = demo_case["point_cloud_logs"]
    coords = demo_case["coord_rows"]
    
    print(f"📸 导入照片: {photo_id}")
    print(f"📊 点云抽稀日志: {len(logs)} 条点位")
    for log in logs:
        coord_status = "有坐标" if log.raw_coords else "无坐标"
        print(f"   点位 #{log.point_index}: {log.notes} ({coord_status})")
    
    photo_id, issues = review_system.import_point_cloud_logs(photo_id, logs)
    review_system.import_coord_table(photo_id, coords)
    
    if issues:
        print(f"\n⚠️  发现问题:")
        for issue in issues:
            print(f"   - {issue}")
    print(f"📍 坐标表: {len(coords)} 行")
    
    occlusion_points = review_system.generate_occlusion_list(photo_id)
    print(f"\n🔍 初次生成遮挡点清单 ({len(occlusion_points)} 个点位):")
    for point in occlusion_points:
        icon = print_status_icon(point.status)
        print(f"   {icon} 点位 #{point.point_index}: {point.status.value}")
        if point.occlusion_reason:
            print(f"      原因: {point.occlusion_reason}")
    
    print("\n💬 老梁说：看见没？照片里有3个点，但坐标表只来2个。别急，")
    print("   先标'待安全员复核'，别着急归正常。安全半径表晚到是常有的事。")
    
    print_step(2, "培训教官老梁补看安全半径表")
    safety_entries = demo_case["safety_radius_entries"]
    
    print(f"📋 导入安全半径表: {len(safety_entries)} 条")
    for entry in safety_entries:
        old_caliber = " (旧口径)" if entry.is_old_caliber else ""
        print(f"   点位 #{entry.point_index}: {entry.obstacle_type}, 半径 {entry.radius_meters}m{old_caliber}")
    
    supplemented = review_system.import_safety_radius_table(photo_id, safety_entries)
    print(f"\n📝 补录了 {supplemented} 条旧口径数据")
    
    print("\n💬 老梁说：看，安全半径表一到，原来的判断就得改。")
    print("   返工要留在明面上，让所有人都看见。")
    
    print_step(3, "遮挡点清单更新")
    occlusion_points = review_system.generate_occlusion_list(photo_id)
    
    print(f"🔄 更新后的遮挡点清单 ({len(occlusion_points)} 个点位):")
    for point in occlusion_points:
        icon = print_status_icon(point.status)
        status_text = {
            PointStatus.NORMAL: "正常",
            PointStatus.PENDING_REVIEW: "待安全员复核",
            PointStatus.FROM_SAFETY_RADIUS: "从安全半径表补录"
        }.get(point.status, point.status.value)
        
        occluded_text = " ⚠️遮挡" if point.is_occluded else ""
        print(f"   {icon} 点位 #{point.point_index}: {status_text}{occluded_text}")
        if point.reviewer_notes:
            print(f"      备注: {point.reviewer_notes}")
    
    summary = review_system.get_record_summary(photo_id)
    print(f"\n📋 记录状态: {summary['status']}")
    print(f"   遮挡统计: {summary['occlusion_points']}")
    
    print("\n💬 老梁说：三种结果都看见了吧？")
    print("   1. 顺利的直接标正常")
    print("   2. 照片有点位但坐标表缺行的，留给你安全员复核")
    print("   3. 安全半径表补来的旧口径，标清楚来源")


def run_all_cases():
    print_header("仓库叉车盲区复盘 - 三种样例对比")
    
    review_system = WarehouseBlindSpotReview()
    cases = DemoData.get_all_demo_cases()
    
    for i, case in enumerate(cases, 1):
        print(f"\n{'━' * 50}")
        print(f"案例 {i}: {case['description']}")
        print('━' * 50)
        
        photo_id = case["photo_id"]
        review_system.import_point_cloud_logs(photo_id, case["point_cloud_logs"])
        review_system.import_coord_table(photo_id, case["coord_rows"])
        review_system.import_safety_radius_table(photo_id, case["safety_radius_entries"])
        
        occlusion_points = review_system.generate_occlusion_list(photo_id)
        summary = review_system.get_record_summary(photo_id)
        
        print(f"状态: {summary['status']}")
        print(f"点位: {summary['point_cloud_logs']} 个 | 坐标行: {summary['coord_rows']} 行 | 安全半径: {summary['safety_radius_entries']} 条")
        print("\n遮挡点详情:")
        for point in occlusion_points:
            icon = print_status_icon(point.status)
            print(f"  {icon} 点位 #{point.point_index}")
            if point.occlusion_reason:
                print(f"     {point.occlusion_reason}")


def main():
    if len(sys.argv) < 2:
        print("仓库叉车盲区复盘工具")
        print("用法: python cli.py [命令]")
        print("\n命令:")
        print("  demo      - 运行三步流程演示（老梁培训用）")
        print("  cases     - 查看三种样例对比")
        print("  list      - 列出所有演示案例")
        return
    
    command = sys.argv[1]
    
    if command == "demo":
        run_demo_workflow()
    elif command == "cases":
        run_all_cases()
    elif command == "list":
        cases = DemoData.get_all_demo_cases()
        print("演示案例列表:")
        for i, case in enumerate(cases, 1):
            print(f"  {i}. {case['photo_id']} - {case['description']}")
    else:
        print(f"未知命令: {command}")


if __name__ == "__main__":
    main()
