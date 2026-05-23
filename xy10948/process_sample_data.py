#!/usr/bin/env python3
"""处理示例数据并生成完整报告"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from attendance_cli.data_processor import AttendanceDataProcessor
from attendance_cli.report_generator import ReportGenerator

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLE_DIR = os.path.join(BASE_DIR, "sample_data")
OUTPUT_DIR = os.path.join(BASE_DIR, "attendance_output")

print("=" * 70)
print("培训签到补签 CLI - 处理示例数据")
print("=" * 70)

# 检查示例数据文件
courses_file = os.path.join(SAMPLE_DIR, "courses.csv")
machine_file = os.path.join(SAMPLE_DIR, "machine_attendance.csv")
teacher_file = os.path.join(SAMPLE_DIR, "teacher_makeup.csv")

print(f"\n📂 输入文件:")
print(f"   课程配置: {courses_file}")
print(f"   签到机数据: {machine_file}")
print(f"   老师补签表: {teacher_file}")
print(f"   输出目录: {OUTPUT_DIR}")

# 处理数据
print("\n" + "=" * 70)
print("开始处理数据...")
print("=" * 70)

processor = AttendanceDataProcessor(
    machine_file=machine_file,
    teacher_file=teacher_file,
    courses_file=courses_file,
    min_attendance_rate=0.8
)
processor.process()

# 生成报告
print("\n" + "=" * 70)
print("生成报告...")
print("=" * 70)

os.makedirs(OUTPUT_DIR, exist_ok=True)
report_gen = ReportGenerator(processor, OUTPUT_DIR)
files = report_gen.generate_all_reports()

print(f"\n✅ 报告已生成到: {OUTPUT_DIR}")
print(f"\n📋 生成的文件:")
for f in sorted(files):
    size = os.path.getsize(f)
    print(f"   - {os.path.basename(f)} ({size} bytes)")

# 显示终端摘要
print("\n" + "=" * 70)
print("📊 处理结果摘要")
print("=" * 70)
report_gen.print_terminal_summary()

print("\n" + "=" * 70)
print("🎉 处理完成！")
print("=" * 70)
print(f"\n💡 查看报告:")
print(f"   友好说明文档: {os.path.join(OUTPUT_DIR, 'README_考勤报告.md')}")
print(f"   结业资格表:   {os.path.join(OUTPUT_DIR, 'graduation_eligibility.csv')}")
print(f"   冲突记录表:   {os.path.join(OUTPUT_DIR, 'conflicts_report.csv')}")
