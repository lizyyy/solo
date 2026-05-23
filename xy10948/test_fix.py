#!/usr/bin/env python3
"""验证修复效果的测试脚本"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from attendance_cli.data_processor import AttendanceDataProcessor
from attendance_cli.report_generator import ReportGenerator

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLE_DIR = os.path.join(BASE_DIR, "sample_data")

print("=" * 70)
print("验证修复效果")
print("=" * 70)

# 处理示例数据
courses_file = os.path.join(SAMPLE_DIR, "courses.csv")
machine_file = os.path.join(SAMPLE_DIR, "machine_attendance.csv")
teacher_file = os.path.join(SAMPLE_DIR, "teacher_makeup.csv")

processor = AttendanceDataProcessor(
    machine_file=machine_file,
    teacher_file=teacher_file,
    courses_file=courses_file,
    min_attendance_rate=0.8
)
processor.process()

print("\n📊 数据统计:")
print(f"  课程场次: {len(processor.courses)}")
print(f"  签到机记录: {len(processor.machine_records)}")
print(f"  补签表记录: {len(processor.teacher_records)}")
print(f"  合并后记录: {len(processor.merged_records)}")
print(f"  冲突数: {len(processor.conflicts)}")

print("\n🎓 学员补签次数统计 (修复前都是0):")
for student_id, student in sorted(processor.students.items()):
    print(f"  {student.student_name}({student_id}): "
          f"补签{student.make_up_count}次, "
          f"出勤率{student.attendance_rate*100:.1f}%, "
          f"{'✅ 符合' if student.is_eligible else '❌ 不符合'}结业")

print("\n📋 详细验证:")
total_makeup = sum(s.make_up_count for s in processor.students.values())
print(f"  总补签次数: {total_makeup} (期望 > 0)")

# 验证STU001张三的补签
stu001 = processor.students["STU001"]
print(f"  张三补签: {stu001.make_up_count}次 (期望2次: S003, S008)")

# 验证STU002李四的补签
stu002 = processor.students["STU002"]
print(f"  李四补签: {stu002.make_up_count}次 (期望7次: S002-S004, S007-S009)")

# 验证STU003王五的补签
stu003 = processor.students["STU003"]
print(f"  王五补签: {stu003.make_up_count}次 (期望1次: S005)")

# 验证STU005钱七的补签
stu005 = processor.students["STU005"]
print(f"  钱七补签: {stu005.make_up_count}次 (期望2次: S001, S002)")

print("\n" + "=" * 70)
if total_makeup > 0:
    print("✅ 补签次数统计修复成功！")
else:
    print("❌ 补签次数统计仍有问题！")
print("=" * 70)
