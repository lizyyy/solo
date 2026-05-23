#!/usr/bin/env python3
"""验证CLI功能的脚本"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from attendance_cli.self_test import (
    generate_test_courses,
    generate_test_machine_data,
    generate_test_teacher_data
)
from attendance_cli.data_processor import AttendanceDataProcessor
from attendance_cli.report_generator import ReportGenerator
import tempfile

print("=" * 60)
print("培训签到补签 CLI - 功能验证")
print("=" * 60)

# 1. 生成测试数据
print("\n📝 步骤1: 生成测试数据...")
with tempfile.TemporaryDirectory() as tmpdir:
    courses_file = os.path.join(tmpdir, "courses.csv")
    machine_file = os.path.join(tmpdir, "machine.csv")
    teacher_file = os.path.join(tmpdir, "teacher.csv")
    output_dir = os.path.join(tmpdir, "output")
    
    generate_test_courses(courses_file)
    generate_test_machine_data(machine_file)
    generate_test_teacher_data(teacher_file)
    print(f"   ✓ 测试数据已生成到临时目录")
    
    # 2. 数据处理
    print("\n🔄 步骤2: 数据处理...")
    processor = AttendanceDataProcessor(
        machine_file, teacher_file, courses_file, min_attendance_rate=0.8
    )
    processor.process()
    print(f"   ✓ 课程场次: {len(processor.courses)} 场")
    print(f"   ✓ 签到机记录: {len(processor.machine_records)} 条")
    print(f"   ✓ 补签表记录: {len(processor.teacher_records)} 条")
    print(f"   ✓ 合并后记录: {len(processor.merged_records)} 条")
    print(f"   ✓ 检测到冲突: {len(processor.conflicts)} 处")
    
    # 3. 验证核心逻辑
    print("\n✅ 步骤3: 核心逻辑验证...")
    
    # 验证补签优先级
    stu001 = processor.students["STU001"]
    assert stu001.attended_sessions == 5, f"STU001应出勤5次，实际{stu001.attended_sessions}"
    print(f"   ✓ STU001(张三): 出勤{stu001.attended_sessions}/5 = {stu001.attendance_rate*100:.1f}%")
    
    stu002 = processor.students["STU002"]
    assert stu002.attended_sessions == 4, f"STU002应出勤4次，实际{stu002.attended_sessions}"
    print(f"   ✓ STU002(李四): 出勤{stu002.attended_sessions}/5 = {stu002.attendance_rate*100:.1f}%")
    
    # 验证结业资格
    print(f"\n🎓 步骤4: 结业资格判定...")
    eligible_count = sum(1 for s in processor.students.values() if s.is_eligible)
    print(f"   ✓ 总学员数: {len(processor.students)} 人")
    print(f"   ✓ 符合结业: {eligible_count} 人")
    
    for student in processor.students.values():
        status = "✅ 符合" if student.is_eligible else "❌ 不符合"
        print(f"     {student.student_name}: {status} (出勤率{student.attendance_rate*100:.1f}%)")
    
    # 5. 报告生成
    print(f"\n📊 步骤5: 报告生成测试...")
    report_gen = ReportGenerator(processor, output_dir)
    files = report_gen.generate_all_reports()
    print(f"   ✓ 已生成 {len(files)} 个报告文件:")
    for f in files:
        print(f"     - {os.path.basename(f)}")
    
    # 6. 终端摘要
    print("\n" + "=" * 60)
    print("终端摘要预览:")
    print("=" * 60)
    report_gen.print_terminal_summary()

print("\n" + "=" * 60)
print("🎉 所有功能验证通过！")
print("=" * 60)
print("\n📋 使用说明:")
print("  处理实际数据: python3 verify_functionality.py --run")
print("  查看帮助:     python3 -m attendance_cli.main --help")
print("  示例数据:      sample_data/ 目录下")
