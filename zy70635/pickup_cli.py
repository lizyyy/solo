#!/usr/bin/env python3
import argparse
import sys
import os
from datetime import date, time, datetime
from typing import List

from models import Student, PickupPerson, Authorization, LeaveRecord, PickupReport
from rules_engine import RulesEngine
from storage import Storage
from report_exporter import ReportExporter


def create_data_directory():
    if not os.path.exists("data"):
        os.makedirs("data")
    if not os.path.exists("reports"):
        os.makedirs("reports")


def cmd_add_student(args):
    engine = RulesEngine()
    storage = Storage()

    try:
        student = Student(
            student_id=args.id,
            name=args.name,
            grade=args.grade,
            class_name=args.class_name
        )
        engine.add_student(student)

        existing = []
        if os.path.exists("data/students.json"):
            existing = storage.load_students()
        existing.append(student)
        storage.save_students(existing)

        print(f"✅ 成功添加学生: {student.name} (ID: {student.student_id})")
    except Exception as e:
        print(f"❌ 添加学生失败: {str(e)}")
        sys.exit(1)


def cmd_add_pickup_person(args):
    engine = RulesEngine()
    storage = Storage()

    try:
        person = PickupPerson(
            person_id=args.id,
            name=args.name,
            phone=args.phone,
            relation=args.relation,
            student_id=args.student_id
        )
        engine.add_pickup_person(person)

        existing = []
        if os.path.exists("data/pickup_persons.json"):
            existing = storage.load_pickup_persons()
        existing.append(person)
        storage.save_pickup_persons(existing)

        print(f"✅ 成功添加接送人: {person.name} (ID: {person.person_id})")
    except Exception as e:
        print(f"❌ 添加接送人失败: {str(e)}")
        sys.exit(1)


def cmd_add_authorization(args):
    engine = RulesEngine()
    storage = Storage()

    try:
        weekdays = [int(d) for d in args.weekdays.split(',')]
        start_time = time(*map(int, args.start_time.split(':')))
        end_time = time(*map(int, args.end_time.split(':')))

        auth = Authorization(
            auth_id=args.id,
            student_id=args.student_id,
            pickup_person_id=args.person_id,
            start_date=date.fromisoformat(args.start_date),
            end_date=date.fromisoformat(args.end_date),
            weekdays=weekdays,
            start_time=start_time,
            end_time=end_time,
            is_active=not args.inactive
        )

        existing = []
        if os.path.exists("data/authorizations.json"):
            existing = storage.load_authorizations()
        existing.append(auth)
        storage.save_authorizations(existing)

        print(f"✅ 成功添加授权: {auth.auth_id}")
    except Exception as e:
        print(f"❌ 添加授权失败: {str(e)}")
        sys.exit(1)


def cmd_add_leave(args):
    engine = RulesEngine()
    storage = Storage()

    try:
        leave = LeaveRecord(
            leave_id=args.id,
            student_id=args.student_id,
            leave_date=date.fromisoformat(args.leave_date),
            reason=args.reason,
            is_half_day=args.half_day,
            half_day_type=args.half_day_type if args.half_day else None
        )

        existing = []
        if os.path.exists("data/leave_records.json"):
            existing = storage.load_leave_records()
        existing.append(leave)
        storage.save_leave_records(existing)

        print(f"✅ 成功添加请假记录: {leave.leave_id}")
    except Exception as e:
        print(f"❌ 添加请假记录失败: {str(e)}")
        sys.exit(1)


def cmd_generate_report(args):
    engine = RulesEngine()
    storage = Storage()
    exporter = ReportExporter()

    try:
        if os.path.exists("data/students.json"):
            for s in storage.load_students():
                engine.add_student(s)
        if os.path.exists("data/pickup_persons.json"):
            for p in storage.load_pickup_persons():
                engine.add_pickup_person(p)
        if os.path.exists("data/authorizations.json"):
            for a in storage.load_authorizations():
                engine.add_authorization(a)
        if os.path.exists("data/leave_records.json"):
            for l in storage.load_leave_records():
                engine.add_leave_record(l)

        report_date = date.fromisoformat(args.date)

        pickup_records = []
        if args.records:
            for record in args.records:
                parts = record.split(',')
                if len(parts) >= 3:
                    student_id = parts[0]
                    person_id = parts[1]
                    pickup_time = time(*map(int, parts[2].split(':')))
                    pickup_records.append((student_id, person_id, pickup_time))

        if not pickup_records:
            print("⚠️  没有提供接送记录")
            sys.exit(0)

        errors = engine.validate_data()
        if errors:
            print("⚠️  数据验证发现以下问题:")
            for err in errors:
                print(f"   - {err}")

        reports = engine.generate_daily_report(report_date, pickup_records)

        json_path = f"reports/report_{args.date}.json"
        txt_path = f"reports/report_{args.date}.txt"

        storage.save_reports(reports, json_path)
        exporter.export_text_report(reports, engine, txt_path)

        print(f"\n✅ 报告生成成功!")
        print(f"   机器可读: {json_path}")
        print(f"   人读报告: {txt_path}")
        print(f"\n📊 今日统计:")
        total = len(reports)
        authorized = sum(1 for r in reports if r.is_authorized)
        late = sum(1 for r in reports if r.is_late)
        on_leave = sum(1 for r in reports if r.is_on_leave)
        total_fee = sum(r.late_fee for r in reports)

        print(f"   总记录数: {total}")
        print(f"   授权有效: {authorized}")
        print(f"   迟接记录: {late}")
        print(f"   请假记录: {on_leave}")
        print(f"   迟接费用总计: ¥{total_fee:.2f}")

    except Exception as e:
        print(f"❌ 生成报告失败: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def cmd_validate(args):
    engine = RulesEngine()
    storage = Storage()

    try:
        if os.path.exists("data/students.json"):
            for s in storage.load_students():
                engine.add_student(s)
        if os.path.exists("data/pickup_persons.json"):
            for p in storage.load_pickup_persons():
                engine.add_pickup_person(p)
        if os.path.exists("data/authorizations.json"):
            for a in storage.load_authorizations():
                engine.add_authorization(a)
        if os.path.exists("data/leave_records.json"):
            for l in storage.load_leave_records():
                engine.add_leave_record(l)

        errors = engine.validate_data()

        if errors:
            print("❌ 数据验证失败:")
            for err in errors:
                print(f"   - {err}")
            sys.exit(1)
        else:
            print("✅ 所有数据验证通过!")

    except Exception as e:
        print(f"❌ 验证过程出错: {str(e)}")
        sys.exit(1)


def cmd_check_auth(args):
    engine = RulesEngine()
    storage = Storage()

    try:
        if os.path.exists("data/students.json"):
            for s in storage.load_students():
                engine.add_student(s)
        if os.path.exists("data/pickup_persons.json"):
            for p in storage.load_pickup_persons():
                engine.add_pickup_person(p)
        if os.path.exists("data/authorizations.json"):
            for a in storage.load_authorizations():
                engine.add_authorization(a)

        check_datetime = datetime.fromisoformat(args.datetime)

        is_authorized, auth, notes = engine.is_authorized(
            args.student_id, args.person_id, check_datetime
        )

        if is_authorized:
            print(f"✅ 授权有效!")
            print(f"   授权时段: {auth.start_date} 至 {auth.end_date}")
            print(f"   接送时间: {auth.start_time} - {auth.end_time}")
        else:
            print(f"❌ 授权无效: {notes}")
            sys.exit(1)

    except Exception as e:
        print(f"❌ 检查授权失败: {str(e)}")
        sys.exit(1)


def main():
    create_data_directory()

    parser = argparse.ArgumentParser(
        description="接送授权迟接请假状态排查CLI - 托管班接送管理系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 添加学生
  python pickup_cli.py add-student --id S001 --name 小明 --grade 一年级 --class_name 1班

  # 添加接送人
  python pickup_cli.py add-pickup-person --id P001 --name 爸爸 --phone 13800138000 --relation 父亲 --student-id S001

  # 添加授权
  python pickup_cli.py add-auth --id A001 --student-id S001 --person-id P001 --start-date 2026-01-01 --end-date 2026-12-31 --weekdays 0,1,2,3,4 --start-time 16:00:00 --end-time 18:00:00

  # 添加请假
  python pickup_cli.py add-leave --id L001 --student-id S001 --leave-date 2026-05-20 --reason 生病

  # 生成日报
  python pickup_cli.py report --date 2026-05-17 --records S001,P001,17:30:00 S002,P002,18:15:00

  # 验证数据
  python pickup_cli.py validate

  # 检查授权
  python pickup_cli.py check-auth --student-id S001 --person-id P001 --datetime 2026-05-17T17:30:00
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    parser_add_student = subparsers.add_parser("add-student", help="添加学生")
    parser_add_student.add_argument("--id", required=True, help="学生ID")
    parser_add_student.add_argument("--name", required=True, help="学生姓名")
    parser_add_student.add_argument("--grade", required=True, help="年级")
    parser_add_student.add_argument("--class_name", required=True, help="班级")
    parser_add_student.set_defaults(func=cmd_add_student)

    parser_add_person = subparsers.add_parser("add-pickup-person", help="添加接送人")
    parser_add_person.add_argument("--id", required=True, help="接送人ID")
    parser_add_person.add_argument("--name", required=True, help="姓名")
    parser_add_person.add_argument("--phone", required=True, help="电话")
    parser_add_person.add_argument("--relation", required=True, help="与学生关系")
    parser_add_person.add_argument("--student-id", required=True, help="学生ID")
    parser_add_person.set_defaults(func=cmd_add_pickup_person)

    parser_add_auth = subparsers.add_parser("add-auth", help="添加授权")
    parser_add_auth.add_argument("--id", required=True, help="授权ID")
    parser_add_auth.add_argument("--student-id", required=True, help="学生ID")
    parser_add_auth.add_argument("--person-id", required=True, help="接送人ID")
    parser_add_auth.add_argument("--start-date", required=True, help="开始日期 (YYYY-MM-DD)")
    parser_add_auth.add_argument("--end-date", required=True, help="结束日期 (YYYY-MM-DD)")
    parser_add_auth.add_argument("--weekdays", required=True, help="星期 (0=周一, 1=周二, ... 用逗号分隔)")
    parser_add_auth.add_argument("--start-time", required=True, help="开始时间 (HH:MM:SS)")
    parser_add_auth.add_argument("--end-time", required=True, help="结束时间 (HH:MM:SS)")
    parser_add_auth.add_argument("--inactive", action="store_true", help="标记为无效")
    parser_add_auth.set_defaults(func=cmd_add_authorization)

    parser_add_leave = subparsers.add_parser("add-leave", help="添加请假记录")
    parser_add_leave.add_argument("--id", required=True, help="请假ID")
    parser_add_leave.add_argument("--student-id", required=True, help="学生ID")
    parser_add_leave.add_argument("--leave-date", required=True, help="请假日期 (YYYY-MM-DD)")
    parser_add_leave.add_argument("--reason", required=True, help="请假原因")
    parser_add_leave.add_argument("--half-day", action="store_true", help="是否半天")
    parser_add_leave.add_argument("--half-day-type", choices=["上午", "下午"], help="半天类型")
    parser_add_leave.set_defaults(func=cmd_add_leave)

    parser_report = subparsers.add_parser("report", help="生成接送报告")
    parser_report.add_argument("--date", required=True, help="报告日期 (YYYY-MM-DD)")
    parser_report.add_argument("--records", nargs="+", help="接送记录 (学生ID,接送人ID,时间 如:S001,P001,17:30:00")
    parser_report.set_defaults(func=cmd_generate_report)

    parser_validate = subparsers.add_parser("validate", help="验证所有数据")
    parser_validate.set_defaults(func=cmd_validate)

    parser_check = subparsers.add_parser("check-auth", help="检查授权状态")
    parser_check.add_argument("--student-id", required=True, help="学生ID")
    parser_check.add_argument("--person-id", required=True, help="接送人ID")
    parser_check.add_argument("--datetime", required=True, help="检查时间 (YYYY-MM-DDTHH:MM:SS)")
    parser_check.set_defaults(func=cmd_check_auth)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
