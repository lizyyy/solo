#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.services import ReplayService, UserService


def generate_sample_data():
    print("=" * 60)
    print("生成样例数据...")
    print("=" * 60)

    db = SessionLocal()
    try:
        supervisor = UserService.get_user_by_username(db, "guanpeixun")
        if not supervisor:
            print("✗ 未找到主管用户，请先初始化数据库")
            return

        print(f"\n1. 生成10条正常验收记录...")
        normal_records = ReplayService.generate_sample_data(db, supervisor.id, count=10)
        print(f"   ✓ 生成 {len(normal_records)} 条正常记录")

        print(f"\n2. 生成3条坏数据样例...")
        bad_data = ReplayService.generate_bad_data(db, supervisor.id)
        print(f"   ✓ 缺附件记录 ID: {bad_data['missing_attachment'].id}")
        print(f"   ✓ 重复提交记录 ID: {bad_data['duplicate_submit'].id}")
        print(f"   ✓ 人工改判记录 ID: {bad_data['manual_fix'].id}")

        print(f"\n3. 执行自动对账...")
        reconcile_result = ReplayService.reconcile_records(db, supervisor.id)
        print(f"   ✓ 对账完成: 处理 {reconcile_result['total_processed']} 条, "
              f"匹配 {reconcile_result['matched']} 条, "
              f"不匹配 {reconcile_result['unmatched']} 条")

        print("\n" + "=" * 60)
        print("样例数据生成完成!")
        print("=" * 60)
        print("\n坏数据说明:")
        print("  1. 缺附件 - 退货照片来源缺少照片附件")
        print("  2. 重复提交 - 同一批次药品重复提交")
        print("  3. 人工改判 - 外部回执数据不匹配，需人工核实")

    finally:
        db.close()


if __name__ == "__main__":
    generate_sample_data()
