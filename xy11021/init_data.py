#!/usr/bin/env python3
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from database import db
from models import LectureWaitlist, WaitlistStatus, AdmissionType, DataSource


def init_database():
    print("=" * 60)
    print("图书馆活动组讲座候补入场系统 - 数据初始化")
    print("=" * 60)

    with app.app_context():
        print("\n[1/4] 清理现有数据...")
        db.session.query(LectureWaitlist).delete()
        db.session.commit()
        print("    ✓ 数据清理完成")

        print("\n[2/4] 插入正常候补记录...")
        normal_records = [
            LectureWaitlist(
                lecture_id="LIB-2024-001",
                lecture_title="人工智能在图书馆资源管理中的应用",
                lecture_date=datetime(2024, 1, 15, 14, 0, 0),
                lecture_venue="图书馆三楼多功能厅",
                reader_id="R20240001",
                reader_name="张明",
                reader_phone="13800138001",
                reader_department="计算机学院",
                waitlist_number=1,
                waitlist_time=datetime(2024, 1, 10, 9, 30, 0),
                status=WaitlistStatus.WAITING,
                data_source=DataSource.SPREADSHEET,
                source_note="来自Excel表格 - 1月10日汇总"
            ),
            LectureWaitlist(
                lecture_id="LIB-2024-001",
                lecture_title="人工智能在图书馆资源管理中的应用",
                lecture_date=datetime(2024, 1, 15, 14, 0, 0),
                lecture_venue="图书馆三楼多功能厅",
                reader_id="R20240002",
                reader_name="李华",
                reader_phone="13800138002",
                reader_department="信息管理系",
                waitlist_number=2,
                waitlist_time=datetime(2024, 1, 10, 10, 15, 0),
                status=WaitlistStatus.CONFIRMED,
                data_source=DataSource.SYSTEM,
                source_note="系统自动登记"
            ),
            LectureWaitlist(
                lecture_id="LIB-2024-001",
                lecture_title="人工智能在图书馆资源管理中的应用",
                lecture_date=datetime(2024, 1, 15, 14, 0, 0),
                lecture_venue="图书馆三楼多功能厅",
                reader_id="R20240003",
                reader_name="王芳",
                reader_phone="13800138003",
                reader_department="文学院",
                waitlist_number=3,
                waitlist_time=datetime(2024, 1, 11, 14, 20, 0),
                status=WaitlistStatus.WAITING,
                data_source=DataSource.SCREENSHOT,
                source_note="来自微信截图 - 王老师提供"
            ),
            LectureWaitlist(
                lecture_id="LIB-2024-002",
                lecture_title="数字资源检索与利用培训班",
                lecture_date=datetime(2024, 1, 20, 9, 0, 0),
                lecture_venue="图书馆电子阅览室",
                reader_id="R20240004",
                reader_name="赵强",
                reader_phone="13800138004",
                reader_department="法学院",
                waitlist_number=1,
                waitlist_time=datetime(2024, 1, 15, 8, 0, 0),
                status=WaitlistStatus.ADMITTED,
                admission_type=AdmissionType.NORMAL_WAITLIST,
                admission_time=datetime(2024, 1, 20, 8, 50, 0),
                admission_operator="刘管理员",
                admission_remark="正常排队入场",
                data_source=DataSource.SYSTEM,
                source_note="现场签到"
            ),
            LectureWaitlist(
                lecture_id="LIB-2024-002",
                lecture_title="数字资源检索与利用培训班",
                lecture_date=datetime(2024, 1, 20, 9, 0, 0),
                lecture_venue="图书馆电子阅览室",
                reader_id="R20240005",
                reader_name="陈静",
                reader_phone="13800138005",
                reader_department="经济学院",
                waitlist_number=2,
                waitlist_time=datetime(2024, 1, 15, 9, 30, 0),
                status=WaitlistStatus.WAITING,
                data_source=DataSource.VERBAL,
                source_note="口头报名 - 张老师代报"
            )
        ]

        for record in normal_records:
            db.session.add(record)
        db.session.commit()
        print(f"    ✓ 已插入 {len(normal_records)} 条正常记录")

        print("\n[3/4] 插入冲突场景记录...")
        conflict_records = [
            LectureWaitlist(
                lecture_id="LIB-2024-003",
                lecture_title="古籍数字化与保护技术研讨会",
                lecture_date=datetime(2024, 1, 25, 14, 0, 0),
                lecture_venue="图书馆特藏室",
                reader_id="R20240006",
                reader_name="孙磊",
                reader_phone="13800138006",
                reader_department="历史系",
                waitlist_number=1,
                waitlist_time=datetime(2024, 1, 18, 10, 0, 0),
                status=WaitlistStatus.WAITING,
                data_source=DataSource.SPREADSHEET,
                source_note="主办方手工放人测试 - 原始记录"
            ),
            LectureWaitlist(
                lecture_id="LIB-2024-003",
                lecture_title="古籍数字化与保护技术研讨会",
                lecture_date=datetime(2024, 1, 25, 14, 0, 0),
                lecture_venue="图书馆特藏室",
                reader_id="R20240007",
                reader_name="周婷",
                reader_phone="13800138007",
                reader_department="考古系",
                waitlist_number=2,
                waitlist_time=datetime(2024, 1, 18, 11, 0, 0),
                status=WaitlistStatus.WAITING,
                data_source=DataSource.SPREADSHEET,
                source_note="序号冲突测试 - 准备调整序号1"
            ),
            LectureWaitlist(
                lecture_id="LIB-2024-003",
                lecture_title="古籍数字化与保护技术研讨会",
                lecture_date=datetime(2024, 1, 25, 14, 0, 0),
                lecture_venue="图书馆特藏室",
                reader_id="R20240008",
                reader_name="吴涛",
                reader_phone="13800138008",
                reader_department="博物馆学系",
                waitlist_number=3,
                waitlist_time=datetime(2024, 1, 18, 14, 0, 0),
                status=WaitlistStatus.WAITING,
                data_source=DataSource.SPREADSHEET,
                source_note="序号冲突测试 - 准备调整序号2"
            )
        ]

        for record in conflict_records:
            db.session.add(record)
        db.session.commit()
        print(f"    ✓ 已插入 {len(conflict_records)} 条冲突场景记录")

        print("\n[4/4] 数据统计...")
        total = LectureWaitlist.query.count()
        by_lecture = db.session.query(
            LectureWaitlist.lecture_id,
            LectureWaitlist.lecture_title,
            db.func.count(LectureWaitlist.id)
        ).group_by(LectureWaitlist.lecture_id).all()

        print(f"\n    总记录数: {total}")
        print("\n    按讲座统计:")
        for lecture_id, title, count in by_lecture:
            print(f"      - {lecture_id}: {title} ({count}人)")

        print("\n" + "=" * 60)
        print("初始化完成！")
        print("=" * 60)
        print("\n验收测试数据说明:")
        print("  1. 正常记录: LIB-2024-001 讲座的张明 (序号1)")
        print("  2. 冲突记录: LIB-2024-003 讲座可用于测试序号冲突")
        print("  3. 坏行样例: 见 test_import_data.json 文件")
        print("\n可测试的场景:")
        print("  - 主办方手工放人导致候补顺序错乱")
        print("  - 入场名单一致性检查")
        print("  - 重复导入不静默覆盖")
        print("  - 版本号乐观锁")


if __name__ == "__main__":
    init_database()
