#!/usr/bin/env python3
import os
import shutil
from datetime import date, time

from models import Student, PickupPerson, Authorization, LeaveRecord
from storage import Storage


def init_normal_sample():
    print("📦 初始化正常样例数据...")
    os.makedirs("data", exist_ok=True)
    storage = Storage("data")

    students = [
        Student("S001", "张明", "一年级", "1班"),
        Student("S002", "李华", "二年级", "2班"),
        Student("S003", "王芳", "一年级", "1班"),
    ]
    storage.save_students(students)
    print(f"   已添加 {len(students)} 名学生")

    pickup_persons = [
        PickupPerson("P001", "张伟", "13800000001", "父亲", "S001"),
        PickupPerson("P002", "李娜", "13800000002", "母亲", "S002"),
        PickupPerson("P003", "王强", "13800000003", "父亲", "S003"),
    ]
    storage.save_pickup_persons(pickup_persons)
    print(f"   已添加 {len(pickup_persons)} 名接送人")

    authorizations = [
        Authorization(
            "A001", "S001", "P001",
            date(2026, 1, 1), date(2026, 12, 31),
            [0, 1, 2, 3, 4], time(16, 0), time(18, 0)
        ),
        Authorization(
            "A002", "S002", "P002",
            date(2026, 1, 1), date(2026, 12, 31),
            [0, 1, 2, 3, 4], time(16, 0), time(18, 0)
        ),
    ]
    storage.save_authorizations(authorizations)
    print(f"   已添加 {len(authorizations)} 条授权")

    leave_records = [
        LeaveRecord("L001", "S003", date(2026, 5, 17), "生病请假"),
    ]
    storage.save_leave_records(leave_records)
    print(f"   已添加 {len(leave_records)} 条请假记录")

    print("✅ 正常样例数据初始化完成\n")


def init_dirty_data_sample():
    print("📦 初始化脏数据样例...")
    sample_dir = "samples/dirty_data"
    os.makedirs(sample_dir, exist_ok=True)
    storage = Storage(sample_dir)

    students = [
        Student("S001", "张明", "一年级", "1班"),
    ]
    storage.save_students(students)

    pickup_persons = [
        PickupPerson("P001", "张伟", "13800000001", "父亲", "S001"),
    ]
    storage.save_pickup_persons(pickup_persons)

    authorizations = [
        Authorization(
            "A001", "S999", "P001",
            date(2026, 1, 1), date(2026, 12, 31),
            [0, 1, 2, 3, 4], time(16, 0), time(18, 0)
        ),
        Authorization(
            "A002", "S001", "P999",
            date(2026, 1, 1), date(2026, 12, 31),
            [0, 1, 2, 3, 4], time(16, 0), time(18, 0)
        ),
        Authorization(
            "A003", "S001", "P001",
            date(2026, 12, 31), date(2026, 1, 1),
            [], time(18, 0), time(16, 0)
        ),
    ]
    storage.save_authorizations(authorizations)

    leave_records = [
        LeaveRecord("L001", "S999", date(2026, 5, 17), "不存在的学生"),
    ]
    storage.save_leave_records(leave_records)

    print("✅ 脏数据样例初始化完成")
    print("   包含: 不存在的学生、不存在的接送人、日期颠倒、时间颠倒、空星期\n")


def init_boundary_conflict_sample():
    print("📦 初始化边界冲突样例...")
    sample_dir = "samples/boundary_conflict"
    os.makedirs(sample_dir, exist_ok=True)
    storage = Storage(sample_dir)

    students = [
        Student("S001", "张明", "一年级", "1班"),
    ]
    storage.save_students(students)

    pickup_persons = [
        PickupPerson("P001", "张伟", "13800000001", "父亲", "S001"),
        PickupPerson("P002", "李娜", "13800000002", "母亲", "S001"),
    ]
    storage.save_pickup_persons(pickup_persons)

    authorizations = [
        Authorization(
            "A001", "S001", "P001",
            date(2026, 5, 10), date(2026, 5, 20),
            [0, 1, 2, 3, 4], time(16, 0), time(18, 0)
        ),
        Authorization(
            "A002", "S001", "P002",
            date(2026, 5, 15), date(2026, 5, 25),
            [0, 1, 2, 3, 4], time(17, 0), time(19, 0)
        ),
    ]
    storage.save_authorizations(authorizations)

    leave_records = [
        LeaveRecord("L001", "S001", date(2026, 5, 17), "与授权日期重叠"),
    ]
    storage.save_leave_records(leave_records)

    print("✅ 边界冲突样例初始化完成")
    print("   包含: 授权日期重叠、授权时间边界、请假与接送日期重叠\n")


def init_empty_result_sample():
    print("📦 初始化空结果样例...")
    sample_dir = "samples/empty"
    os.makedirs(sample_dir, exist_ok=True)
    storage = Storage(sample_dir)

    storage.save_students([])
    storage.save_pickup_persons([])
    storage.save_authorizations([])
    storage.save_leave_records([])

    print("✅ 空结果样例初始化完成")
    print("   所有数据文件均为空\n")


def init_acceptance_sample():
    print("📦 初始化验收样例数据...")
    sample_dir = "data"
    os.makedirs(sample_dir, exist_ok=True)
    storage = Storage(sample_dir)

    students = [
        Student("S001", "张明", "一年级", "1班"),
        Student("S002", "李华", "二年级", "2班"),
        Student("S003", "王芳", "一年级", "1班"),
    ]
    storage.save_students(students)

    pickup_persons = [
        PickupPerson("P001", "张伟", "13800000001", "父亲", "S001"),
        PickupPerson("P002", "李娜", "13800000002", "母亲", "S002"),
        PickupPerson("P003", "王强", "13800000003", "父亲", "S003"),
        PickupPerson("P004", "赵阿姨", "13800000004", "临时托管", "S001"),
    ]
    storage.save_pickup_persons(pickup_persons)

    authorizations = [
        Authorization(
            "A001", "S001", "P001",
            date(2026, 5, 1), date(2026, 5, 31),
            [0, 1, 2, 3, 4], time(16, 0), time(18, 0)
        ),
        Authorization(
            "A002", "S002", "P002",
            date(2026, 5, 1), date(2026, 5, 31),
            [0, 1, 2, 3, 4], time(16, 0), time(18, 0)
        ),
        Authorization(
            "A003", "S003", "P003",
            date(2026, 5, 1), date(2026, 5, 31),
            [0, 1, 2, 3, 4], time(16, 0), time(18, 0)
        ),
    ]
    storage.save_authorizations(authorizations)

    leave_records = [
        LeaveRecord("L001", "S003", date(2026, 5, 17), "生病请假"),
    ]
    storage.save_leave_records(leave_records)

    print("✅ 验收样例数据初始化完成\n")


def main():
    print("=" * 50)
    print("  接送授权迟接请假状态排查CLI - 样例数据初始化")
    print("=" * 50 + "\n")

    if os.path.exists("data"):
        shutil.rmtree("data")
    if os.path.exists("samples"):
        shutil.rmtree("samples")
    if os.path.exists("reports"):
        shutil.rmtree("reports")

    os.makedirs("reports", exist_ok=True)

    init_normal_sample()
    init_dirty_data_sample()
    init_boundary_conflict_sample()
    init_empty_result_sample()

    print("=" * 50)
    print("  所有样例数据初始化完成!")
    print("=" * 50)
    print("\n📁 目录结构:")
    print("   data/          - 正常工作数据")
    print("   samples/")
    print("   ├── dirty_data/      - 脏数据样例")
    print("   ├── boundary_conflict/ - 边界冲突样例")
    print("   └── empty/           - 空数据样例")
    print("   reports/       - 报告输出目录")


if __name__ == "__main__":
    main()
