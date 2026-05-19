"""
社区食堂配餐管理系统 - 集成测试脚本
测试完整流程：导入数据 → 批量配餐 → 配餐复核 → 数据导出
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models.models import Elder, DeliveryRoute, Menu, MealDistribution
from app.services.import_service import import_routes_from_excel, import_elders_from_excel, import_menus_from_excel
from app.services.meal_service import batch_create_meal_distributions, review_meal_distribution, deliver_meal_distribution
from app.services.export_service import export_daily_meal_list, export_dietary_report
from datetime import date


def test_full_flow():
    print("=" * 60)
    print("社区食堂配餐管理系统 - 集成测试")
    print("=" * 60)
    
    # 重置数据库
    print("\n[1/7] 初始化数据库...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    print("✓ 数据库初始化完成")
    
    # 导入配送路线
    print("\n[2/7] 导入配送路线...")
    routes_file = "data/sample_routes.xlsx"
    result = import_routes_from_excel(db, routes_file)
    print(f"  成功: {result['success']}, 失败: {result['failed']}")
    for w in result['warnings']:
        print(f"  警告: {w}")
    for e in result['errors']:
        print(f"  错误: {e}")
    assert result['success'] == 3, "路线导入失败"
    print("✓ 配送路线导入成功")
    
    # 导入老人信息
    print("\n[3/7] 导入老人信息...")
    elders_file = "data/sample_elders.xlsx"
    result = import_elders_from_excel(db, elders_file)
    print(f"  成功: {result['success']}, 失败: {result['failed']}")
    for w in result['warnings']:
        print(f"  警告: {w}")
    for e in result['errors']:
        print(f"  错误: {e}")
    assert result['success'] == 5, "老人信息导入失败"
    print("✓ 老人信息导入成功")
    
    # 验证敏感字段脱敏（数据库存储原始值）
    elder = db.query(Elder).filter(Elder.name == "张爷爷").first()
    print(f"\n[4/7] 敏感字段验证...")
    print(f"  原始身份证号: {elder.id_card}")
    print(f"  原始手机号: {elder.phone}")
    assert len(elder.id_card) == 18, "身份证号存储不完整"
    print("✓ 数据库存储原始值正确（API返回和导出时会自动脱敏）")
    
    # 导入菜单
    print("\n[5/7] 导入菜单...")
    menus_file = "data/sample_menus.xlsx"
    result = import_menus_from_excel(db, menus_file)
    print(f"  成功: {result['success']}, 失败: {result['failed']}")
    for w in result['warnings']:
        print(f"  警告: {w}")
    for e in result['errors']:
        print(f"  错误: {e}")
    assert result['success'] == 5, "菜单导入失败"
    print("✓ 菜单导入成功")
    
    # 批量配餐
    print("\n[6/7] 批量配餐测试...")
    lunch_menu = db.query(Menu).filter(Menu.meal_type == "lunch").first()
    print(f"  使用菜单: {lunch_menu.main_dish} ({lunch_menu.meal_type})")
    
    result = batch_create_meal_distributions(db, lunch_menu.id, operator="测试员")
    print(f"  配餐成功: {result['success']}, 失败: {result['failed']}")
    for w in result['warnings']:
        print(f"  饮食冲突警告: {w}")
    print("✓ 批量配餐完成（自动检测忌口冲突）")
    
    # 配餐复核
    print("\n[7/7] 配餐状态流转测试...")
    meals = db.query(MealDistribution).all()
    print(f"  共 {len(meals)} 条配餐记录")
    
    # 状态统计
    pending_count = db.query(MealDistribution).filter(MealDistribution.status == "pending").count()
    print(f"  待复核: {pending_count}")
    
    # 复核第一条配餐
    meal1 = meals[0]
    from app.schemas.schemas import MealDistributionReview
    review = MealDistributionReview(
        status="confirmed",
        review_notes="已核对无误，特殊要求已标注",
        reviewed_by="张管理员"
    )
    review_meal_distribution(db, meal1.id, review, operator="测试员")
    print(f"  ✓ 配餐 {meal1.id} 已复核确认")
    
    # 配送确认
    from app.schemas.schemas import MealDistributionDelivery
    delivery = MealDistributionDelivery(
        status="delivered",
        delivery_notes="老人已正常签收",
        delivered_by="李配送员"
    )
    deliver_meal_distribution(db, meal1.id, delivery, operator="测试员")
    print(f"  ✓ 配餐 {meal1.id} 已配送完成")
    
    # 复核后状态统计
    confirmed_count = db.query(MealDistribution).filter(MealDistribution.status == "confirmed").count()
    delivered_count = db.query(MealDistribution).filter(MealDistribution.status == "delivered").count()
    print(f"  已确认: {confirmed_count}, 已配送: {delivered_count}")
    
    # 测试导出功能
    print("\n" + "=" * 60)
    print("数据导出测试")
    print("=" * 60)
    
    today = date.today()
    export_path = export_daily_meal_list(db, today, file_format="xlsx")
    print(f"\n✓ 每日配餐清单已导出: {export_path}")
    
    dietary_path = export_dietary_report(db, file_format="xlsx")
    print(f"✓ 特殊饮食报告已导出: {dietary_path}")
    
    # 检查审计日志
    print("\n" + "=" * 60)
    print("审计日志检查")
    print("=" * 60)
    from app.models.models import AuditLog
    logs = db.query(AuditLog).all()
    print(f"\n共 {len(logs)} 条审计记录")
    for log in logs[:5]:
        print(f"  [{log.created_at.strftime('%H:%M:%S')}] {log.action} - {log.entity_type}#{log.entity_id}")
    
    # 数据统计
    print("\n" + "=" * 60)
    print("系统数据统计")
    print("=" * 60)
    elder_count = db.query(Elder).count()
    route_count = db.query(DeliveryRoute).count()
    menu_count = db.query(Menu).count()
    meal_count = db.query(MealDistribution).count()
    special_diet_count = db.query(Elder).filter(Elder.dietary_restrictions.isnot(None)).filter(Elder.dietary_restrictions != "").count()
    
    print(f"""
    配送路线: {route_count} 条
    老人总数: {elder_count} 人
      - 有特殊饮食要求: {special_diet_count} 人
    菜单总数: {menu_count} 条
    配餐记录: {meal_count} 条
    审计日志: {len(logs)} 条
    """)
    
    db.close()
    
    print("=" * 60)
    print("✓ 所有测试通过！系统运行正常")
    print("=" * 60)
    print("\n接下来可以:")
    print("  1. 运行 python3 main.py 启动服务")
    print("  2. 访问 http://localhost:8000/docs 查看API文档")
    print("  3. 查看 exports/ 目录下的导出文件")
    print("  4. 查看 logs/ 目录下的操作日志")


if __name__ == "__main__":
    try:
        test_full_flow()
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
