#!/usr/bin/env python3
"""
实验课耗材领用系统 - 样例数据初始化脚本

覆盖场景：
1. 正常流程（完整的领用→退料→损耗→确认）
2. 异常拦截（库存不足、重复领用、超量退料等）
3. 补偿机制演示
"""

import sys
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

sys.path.insert(0, '.')

from app.config import engine, SessionLocal, Base
from app.models import (
    Material, Inventory, Teacher, ClassInfo, CoursePlan, CoursePlanItem,
    UsageRecord, UsageItem, ReturnItem, LossItem, CompensationRecord,
    OperationStatus, MaterialCategory
)


def init_db():
    Base.metadata.create_all(bind=engine)


def create_sample_data():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("开始初始化实验课耗材领用系统样例数据")
        print("=" * 60)

        if db.query(Material).count() > 0:
            print("\n⚠️  数据库已有数据，跳过初始化")
            db.close()
            return

        print("\n【1/6】创建耗材基础数据...")
        materials = [
            Material(name="无水乙醇", category=MaterialCategory.CHEMICAL,
                    specification="500ml/瓶", unit="瓶", safety_level=2,
                    description="分析纯，用于实验清洗"),
            Material(name="氯化钠", category=MaterialCategory.CHEMICAL,
                    specification="500g/瓶", unit="瓶", safety_level=1,
                    description="分析纯，配制溶液用"),
            Material(name="试管", category=MaterialCategory.GLASSWARE,
                    specification="15mm×150mm", unit="支", safety_level=1,
                    description="标准玻璃试管，可回收"),
            Material(name="烧杯", category=MaterialCategory.GLASSWARE,
                    specification="250ml", unit="个", safety_level=1,
                    description="低型烧杯，可回收"),
            Material(name="一次性手套", category=MaterialCategory.CONSUMABLE,
                    specification="M号", unit="盒", safety_level=1,
                    description="每盒100只，一次性使用不回收"),
            Material(name="浓硫酸", category=MaterialCategory.CHEMICAL,
                    specification="500ml/瓶", unit="瓶", safety_level=5,
                    description="危险品，需双人领用"),
        ]
        for m in materials:
            db.add(m)
        db.flush()
        print(f"  ✓ 创建了 {len(materials)} 种耗材")

        print("\n【2/6】创建库存数据...")
        stock_data = {
            "无水乙醇": {"qty": 50, "location": "化学试剂柜A区"},
            "氯化钠": {"qty": 30, "location": "化学试剂柜A区"},
            "试管": {"qty": 200, "location": "玻璃仪器柜B区"},
            "烧杯": {"qty": 80, "location": "玻璃仪器柜B区"},
            "一次性手套": {"qty": 20, "location": "耗材柜C区"},
            "浓硫酸": {"qty": 10, "location": "危险品柜D区"},
        }
        for material in materials:
            data = stock_data.get(material.name, {"qty": 0, "location": ""})
            inv = Inventory(
                material_id=material.id,
                total_qty=data["qty"],
                available_qty=data["qty"],
                reserved_qty=0,
                min_stock=5 if material.category == MaterialCategory.CHEMICAL else 10,
                location=data["location"]
            )
            db.add(inv)
        print(f"  ✓ 初始化了 {len(stock_data)} 种耗材库存")

        print("\n【3/6】创建教师和班级数据...")
        teacher1 = Teacher(
            name="张教授", employee_no="T2024001",
            phone="13800138001", email="zhang@school.edu",
            department="化学学院"
        )
        teacher2 = Teacher(
            name="李老师", employee_no="T2024002",
            phone="13800138002", email="li@school.edu",
            department="化学学院"
        )
        db.add_all([teacher1, teacher2])
        db.flush()

        class1 = ClassInfo(
            class_no="CHEM2024-01", name="化学2024级1班",
            student_count=45, department="化学学院"
        )
        class2 = ClassInfo(
            class_no="CHEM2024-02", name="化学2024级2班",
            student_count=42, department="化学学院"
        )
        db.add_all([class1, class2])
        db.flush()
        print(f"  ✓ 创建了 2 位教师、2 个班级")

        print("\n【4/6】创建课程计划...")
        tomorrow = datetime.now() + timedelta(days=1)
        next_week = datetime.now() + timedelta(days=7)

        materials_dict = {m.name: m for m in materials}

        plan1 = CoursePlan(
            plan_no="PLAN202605100001",
            teacher_id=teacher1.id,
            class_id=class1.id,
            course_name="基础化学实验",
            experiment_name="氯化钠溶液配制",
            experiment_date=tomorrow,
            total_groups=10,
            status=OperationStatus.SUCCESS,
            remarks="第一次分组实验"
        )
        db.add(plan1)
        db.flush()

        plan1_items = [
            CoursePlanItem(plan_id=plan1.id, material_id=materials_dict["氯化钠"].id,
                          qty_per_group=0.5, total_qty=5.0,
                          notes="每组称取0.5g配制标准溶液"),
            CoursePlanItem(plan_id=plan1.id, material_id=materials_dict["烧杯"].id,
                          qty_per_group=2, total_qty=20,
                          notes="每组2个烧杯，可回收"),
            CoursePlanItem(plan_id=plan1.id, material_id=materials_dict["试管"].id,
                          qty_per_group=5, total_qty=50,
                          notes="每组5支试管，可回收"),
            CoursePlanItem(plan_id=plan1.id, material_id=materials_dict["一次性手套"].id,
                          qty_per_group=1, total_qty=10,
                          notes="每组1盒，一次性使用"),
        ]
        db.add_all(plan1_items)

        plan2 = CoursePlan(
            plan_no="PLAN202605100002",
            teacher_id=teacher2.id,
            class_id=class2.id,
            course_name="有机化学实验",
            experiment_name="酯化反应实验",
            experiment_date=next_week,
            total_groups=8,
            status=OperationStatus.PENDING,
            remarks="需要使用浓硫酸，注意安全"
        )
        db.add(plan2)
        db.flush()

        plan2_items = [
            CoursePlanItem(plan_id=plan2.id, material_id=materials_dict["无水乙醇"].id,
                          qty_per_group=2, total_qty=16,
                          notes="无水乙醇作为反应物"),
            CoursePlanItem(plan_id=plan2.id, material_id=materials_dict["浓硫酸"].id,
                          qty_per_group=0.5, total_qty=4,
                          notes="作为催化剂，需谨慎操作"),
        ]
        db.add_all(plan2_items)
        print(f"  ✓ 创建了 2 个课程计划（1个已完成，1个待执行）")

        print("\n【5/6】创建历史业务数据（演示正常流程）...")

        usage1 = UsageRecord(
            record_no="LY202605090001",
            plan_id=plan1.id,
            class_id=class1.id,
            teacher_id=teacher1.id,
            operator_name="实验室管理员小王",
            operator_id=1,
            status=OperationStatus.CONFIRMED,
            total_used_qty=85,
            total_returned_qty=60,
            total_loss_qty=5,
            pickup_time=datetime.now() - timedelta(hours=8),
            return_time=datetime.now() - timedelta(hours=2),
            teacher_confirmed=1,
            confirmed_by=teacher1.id,
            confirmed_at=datetime.now() - timedelta(hours=1),
            remarks="第一次实验整体顺利"
        )
        db.add(usage1)
        db.flush()

        usage1_items = [
            UsageItem(usage_record_id=usage1.id, material_id=materials_dict["氯化钠"].id,
                     plan_qty=5.0, actual_qty=5.0, returnable_qty=0,
                     status=OperationStatus.SUCCESS),
            UsageItem(usage_record_id=usage1.id, material_id=materials_dict["烧杯"].id,
                     plan_qty=20, actual_qty=20, returnable_qty=18,
                     status=OperationStatus.SUCCESS),
            UsageItem(usage_record_id=usage1.id, material_id=materials_dict["试管"].id,
                     plan_qty=50, actual_qty=50, returnable_qty=47,
                     status=OperationStatus.SUCCESS),
            UsageItem(usage_record_id=usage1.id, material_id=materials_dict["一次性手套"].id,
                     plan_qty=10, actual_qty=10, returnable_qty=0,
                     status=OperationStatus.SUCCESS),
        ]
        db.add_all(usage1_items)
        db.flush()

        return_items = [
            ReturnItem(usage_record_id=usage1.id, material_id=materials_dict["烧杯"].id,
                      usage_item_id=usage1_items[1].id, returned_qty=18,
                      condition="完好", status=OperationStatus.SUCCESS),
            ReturnItem(usage_record_id=usage1.id, material_id=materials_dict["试管"].id,
                      usage_item_id=usage1_items[2].id, returned_qty=42,
                      condition="完好", status=OperationStatus.SUCCESS),
        ]
        db.add_all(return_items)

        loss_items = [
            LossItem(usage_record_id=usage1.id, material_id=materials_dict["试管"].id,
                    usage_item_id=usage1_items[2].id, loss_qty=5,
                    loss_reason="实验操作不慎打碎",
                    status=OperationStatus.SUCCESS),
        ]
        db.add_all(loss_items)
        print(f"  ✓ 创建了 1 条完整的历史领用记录（已教师确认）")

        print("\n【6/6】创建补偿演示数据...")
        comp_demo = CompensationRecord(
            usage_record_id=usage1.id,
            operation_type="领用",
            step_name="库存扣减",
            error_message="模拟补偿记录 - 仅作演示用（实际已成功）",
            status=OperationStatus.SUCCESS,
            retry_count=1,
            resolved_at=datetime.now() - timedelta(hours=8)
        )
        db.add(comp_demo)
        print(f"  ✓ 创建了 1 条补偿记录作为演示")

        db.commit()

        print("\n" + "=" * 60)
        print("✅ 样例数据初始化完成！")
        print("=" * 60)
        print("\n数据概览：")
        print(f"  耗材种类：{db.query(Material).count()}")
        print(f"  库存记录：{db.query(Inventory).count()}")
        print(f"  教师人数：{db.query(Teacher).count()}")
        print(f"  班级数量：{db.query(ClassInfo).count()}")
        print(f"  课程计划：{db.query(CoursePlan).count()}")
        print(f"  领用记录：{db.query(UsageRecord).count()}")

        print("\n可测试的场景：")
        print("  1. 正常流程：对 PLAN202605100002 执行完整的领用→退料→损耗→确认")
        print("  2. 异常拦截：")
        print("     - 领用数量超过库存（如一次领100瓶浓硫酸）")
        print("     - 对已确认的领用单再次操作")
        print("     - 超量退料或损耗")
        print("     - 非任课教师进行确认操作")
        print("  3. 重复操作：对同一计划重复领用会被拦截")
        print("  4. 补偿机制：访问 /compensations/pending 查看待补偿记录")

        print("\n启动服务：python -m uvicorn app.main:app --reload --port 8000")
        print("API文档：http://localhost:8000/docs")

    except Exception as e:
        db.rollback()
        print(f"\n❌ 初始化失败：{e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    create_sample_data()
