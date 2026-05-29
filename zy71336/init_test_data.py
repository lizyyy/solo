"""初始化测试数据 - 包含空白音频、补录超期、同日重复等场景"""
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from piano_checkin.models import (
    Student, Schedule, generate_id, save_json, ensure_dirs,
    STUDENTS_FILE, SCHEDULE_FILE, AUDIO_DIR, RECORDS_FILE,
    COMMENTS_FILE, HISTORY_DIR
)
from piano_checkin.audio_checker import AudioChecker


def clear_existing_data():
    """清除现有数据以便重新初始化"""
    files_to_clear = [STUDENTS_FILE, SCHEDULE_FILE, RECORDS_FILE, COMMENTS_FILE]
    for f in files_to_clear:
        if os.path.exists(f):
            os.remove(f)

    if os.path.exists(HISTORY_DIR):
        for f in os.listdir(HISTORY_DIR):
            os.remove(os.path.join(HISTORY_DIR, f))

    if os.path.exists(AUDIO_DIR):
        for f in os.listdir(AUDIO_DIR):
            os.remove(os.path.join(AUDIO_DIR, f))


def create_students() -> list:
    """创建测试学生名单"""
    students = [
        Student(
            student_id=generate_id("s_"),
            name="张小明",
            level="初级",
            teacher="李老师",
            parent_phone="13800138001",
            join_date="2025-09-01"
        ),
        Student(
            student_id=generate_id("s_"),
            name="王小红",
            level="中级",
            teacher="李老师",
            parent_phone="13800138002",
            join_date="2025-03-15"
        ),
        Student(
            student_id=generate_id("s_"),
            name="刘小刚",
            level="高级",
            teacher="王老师",
            parent_phone="13800138003",
            join_date="2024-09-01"
        ),
        Student(
            student_id=generate_id("s_"),
            name="陈小美",
            level="初级",
            teacher="王老师",
            parent_phone="13800138004",
            join_date="2025-11-01"
        ),
        Student(
            student_id=generate_id("s_"),
            name="赵小强",
            level="中级",
            teacher="李老师",
            parent_phone="13800138005",
            join_date="2025-06-01"
        )
    ]

    data = [s.to_dict() for s in students]
    save_json(STUDENTS_FILE, data, save_history=False)
    print(f"✅ 创建了 {len(students)} 名学生")
    return students


def create_schedules(students: list) -> list:
    """创建课程表"""
    schedules = []

    schedule_mappings = [
        (0, 0, "16:00", "17:00", "一对一"),
        (0, 2, "17:30", "18:30", "一对一"),
        (1, 1, "15:00", "16:00", "小组课"),
        (2, 4, "16:30", "17:30", "一对一"),
        (3, 5, "10:00", "11:00", "一对一"),
        (4, 6, "14:00", "15:00", "小组课"),
    ]

    for student_idx, day, start, end, course_type in schedule_mappings:
        if student_idx < len(students):
            schedules.append(Schedule(
                schedule_id=generate_id("sch_"),
                student_id=students[student_idx].student_id,
                day_of_week=day,
                start_time=start,
                end_time=end,
                course_type=course_type
            ))

    data = [s.to_dict() for s in schedules]
    save_json(SCHEDULE_FILE, data, save_history=False)
    print(f"✅ 创建了 {len(schedules)} 条课程安排")
    return schedules


def create_test_audio_files() -> dict:
    """创建各种测试音频文件"""
    checker = AudioChecker()
    ensure_dirs()

    audio_files = {}

    audio_files["blank"] = os.path.join(AUDIO_DIR, "test_blank.wav")
    checker.create_test_blank_audio(audio_files["blank"], duration=30.0)
    print(f"✅ 创建空白音频: {os.path.basename(audio_files['blank'])} (30秒静音)")

    audio_files["short"] = os.path.join(AUDIO_DIR, "test_short.wav")
    checker.create_test_short_audio(audio_files["short"], duration=15.0)
    print(f"✅ 创建短音频: {os.path.basename(audio_files['short'])} (15秒)")

    audio_files["normal1"] = os.path.join(AUDIO_DIR, "test_normal1.wav")
    checker.create_test_normal_audio(audio_files["normal1"], duration=45.0)
    print(f"✅ 创建正常音频1: {os.path.basename(audio_files['normal1'])} (45秒)")

    audio_files["normal2"] = os.path.join(AUDIO_DIR, "test_normal2.wav")
    checker.create_test_normal_audio(audio_files["normal2"], duration=60.0)
    print(f"✅ 创建正常音频2: {os.path.basename(audio_files['normal2'])} (60秒)")

    audio_files["normal3"] = os.path.join(AUDIO_DIR, "test_normal3.wav")
    checker.create_test_normal_audio(audio_files["normal3"], duration=50.0)
    print(f"✅ 创建正常音频3: {os.path.basename(audio_files['normal3'])} (50秒)")

    audio_files["low_quality"] = os.path.join(AUDIO_DIR, "test_low_quality.wav")
    checker.create_test_audio_with_tone(
        audio_files["low_quality"],
        duration=40.0,
        frequency=220.0,
        volume_db=-45.0
    )
    print(f"✅ 创建低质量音频: {os.path.basename(audio_files['low_quality'])} (音量低)")

    return audio_files


def print_test_scenarios(students: list, audio_files: dict):
    """打印测试场景说明"""
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    two_days_ago = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
    five_days_ago = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")

    print("\n" + "=" * 70)
    print("📋 测试场景说明")
    print("=" * 70)

    print(f"\n【学生名单】")
    for s in students:
        print(f"  {s.student_id}: {s.name} ({s.level}, {s.teacher})")

    print(f"\n【可用音频文件】")
    for name, path in audio_files.items():
        print(f"  {name}: {os.path.basename(path)}")

    print(f"\n【今日测试日期】: {today}")
    print(f"\n【测试场景】")

    print("\n1️⃣  空白音频检测")
    print(f"   命令: python3 -m piano_checkin.cli --process {audio_files['blank']} {students[0].student_id} --date {today}")
    print(f"   预期: 检测为空白音频，标记异常")

    print("\n2️⃣  时长不足检测")
    print(f"   命令: python3 -m piano_checkin.cli --process {audio_files['short']} {students[1].student_id} --date {today}")
    print(f"   预期: 检测为时长短，标记异常(15秒 < 30秒)")

    print("\n3️⃣  同日重复上传 + 合并")
    print(f"   命令1: python3 -m piano_checkin.cli --process {audio_files['normal1']} {students[2].student_id} --date {today}")
    print(f"   命令2: python3 -m piano_checkin.cli --process {audio_files['normal2']} {students[2].student_id} --date {today}")
    print(f"   命令3: python3 -m piano_checkin.cli --process {audio_files['normal3']} {students[2].student_id} --date {today}")
    print(f"   命令4: python3 -m piano_checkin.cli --merge {today}")
    print(f"   预期: 3条记录合并为1条，保留质量最好的")

    print("\n4️⃣  补录超期（超过3天）")
    print(f"   命令: python3 -m piano_checkin.cli --process {audio_files['normal1']} {students[3].student_id} --date {today} --makeup --original-date {five_days_ago} --reason '生病发烧请假'")
    print(f"   预期: 补录超期5天-3天=2天，标记异常")

    print("\n5️⃣  补录理由无效（太短/模糊）")
    print(f"   命令: python3 -m piano_checkin.cli --process {audio_files['normal1']} {students[4].student_id} --date {today} --makeup --original-date {two_days_ago} --reason '有事'")
    print(f"   预期: 理由仅2字，低于最低5字要求，标记异常")

    print("\n6️⃣  补录日期与课程表不匹配")
    print(f"   命令: python3 -m piano_checkin.cli --process {audio_files['normal1']} {students[0].student_id} --date {today} --makeup --original-date {yesterday} --reason '昨天有事请假'")
    print(f"   预期: 检查课程表，昨天是否有课，无课则标记异常")

    print("\n7️⃣  正常打卡（无异常）")
    print(f"   命令: python3 -m piano_checkin.cli --process {audio_files['normal1']} {students[1].student_id} --date {today}")
    print(f"   预期: 45秒正常音频，标记正常")

    print("\n8️⃣  添加老师点评")
    print(f"   先执行上面的命令获取record_id，然后:")
    print(f"   命令: python3 -m piano_checkin.cli (然后选择4添加点评，或用交互模式)")

    print("\n9️⃣  生成日报")
    print(f"   命令: python3 -m piano_checkin.cli --report {today}")
    print(f"   预期: 显示今日统计、异常明细、待点评记录")

    print("\n🔟  查看处理流水线")
    print(f"   先获取任意record_id，然后:")
    print(f"   命令: python3 -m piano_checkin.cli --pipeline <record_id>")
    print(f"   预期: 显示该记录经过5个步骤的完整处理流程")

    print("\n" + "=" * 70)
    print("💡 快速开始: 执行 bash run_tests.sh 一键运行所有测试场景")
    print("=" * 70)


def main():
    print("🎹 初始化钢琴练琴打卡测试数据")
    print("=" * 70 + "\n")

    confirm = input("⚠️  这将清除所有现有数据，确定继续? (y/N): ").strip().lower()
    if confirm != "y":
        print("已取消")
        return

    print("\n🧹 清除现有数据...")
    clear_existing_data()

    print("\n📚 创建基础数据...")
    students = create_students()
    schedules = create_schedules(students)

    print("\n🎵 创建测试音频文件...")
    audio_files = create_test_audio_files()

    print_test_scenarios(students, audio_files)


if __name__ == "__main__":
    main()
