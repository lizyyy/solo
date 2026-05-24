#!/usr/bin/env python3
"""
病理切片二读系统 - 造数脚本
用于生成测试数据
"""
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, init_db
from app import schemas, services


def seed_test_data():
    print("开始生成测试数据...")
    db = SessionLocal()

    try:
        test_cases = [
            {
                "slide_number": "BL-2024-001",
                "patient_id": "P001",
                "patient_name": "张三",
                "specimen_type": "胃镜活检",
                "first_read_doctor": "王医生",
                "first_read_opinion": "胃窦部黏膜慢性炎伴重度不典型增生，建议进一步检查",
                "second_read_doctor": "李主任",
            },
            {
                "slide_number": "BL-2024-002",
                "patient_id": "P002",
                "patient_name": "李四",
                "specimen_type": "乳腺穿刺",
                "first_read_doctor": "张医生",
                "first_read_opinion": "乳腺导管内乳头状瘤，不除外恶变",
                "second_read_doctor": "赵主任",
            },
            {
                "slide_number": "BL-2024-003",
                "patient_id": "P003",
                "patient_name": "王五",
                "specimen_type": "肺叶切除",
                "first_read_doctor": "刘医生",
                "first_read_opinion": "肺腺癌，中分化，需明确亚型",
                "second_read_doctor": "陈主任",
            },
        ]

        created_ids = []
        for case in test_cases:
            data = schemas.SecondReadCreate(
                slide_number=case["slide_number"],
                first_read_doctor=case["first_read_doctor"],
                first_read_opinion=case["first_read_opinion"],
                first_read_date=datetime.now() - timedelta(days=2),
                second_read_doctor=case["second_read_doctor"],
                deadline=datetime.now() + timedelta(days=5)
            )
            result, errors = services.create_second_read(db, data)
            if result["status"] == "success":
                created_ids.append(result["id"])
                print(f"✓ 创建二读记录: {case['slide_number']} - {case['patient_name']}")
            elif result["status"] == "duplicate":
                print(f"○ 已存在: {case['slide_number']}")
            else:
                print(f"✗ 失败: {case['slide_number']} - {errors}")

        if created_ids:
            first_id = created_ids[0]
            update_data = schemas.SecondReadUpdate(
                second_read_opinion="确认：胃窦部黏膜中分化腺癌，建议手术治疗",
                second_read_date=datetime.now()
            )
            result, errors = services.process_second_read(db, first_id, update_data)
            if result["status"] == "success":
                print(f"✓ 提交二读意见成功")

            if len(created_ids) >= 2:
                second_id = created_ids[1]
                borrow_data = schemas.BorrowRecordCreate(
                    slide_number="BL-2024-002",
                    borrower="外院孙医生",
                    borrower_department="病理科",
                    borrow_date=datetime.now() - timedelta(days=1),
                    due_date=datetime.now() + timedelta(days=3),
                    notes="会诊借用"
                )
                result, errors = services.create_borrow_record(db, borrow_data)
                if result["status"] == "success":
                    print(f"✓ 创建借片记录成功")

        print("\n测试数据生成完成！")
        print(f"共创建 {len(created_ids)} 条二读记录")

    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    seed_test_data()
