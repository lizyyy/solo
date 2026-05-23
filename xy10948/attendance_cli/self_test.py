import csv
import tempfile
import os
from pathlib import Path

from .data_processor import AttendanceDataProcessor


def generate_test_courses(filepath):
    """生成测试用课程配置"""
    data = [
        ["场次编号", "课程名称", "场次日期", "场次时间"],
        ["S001", "Python入门", "2024-01-08", "09:00-11:00"],
        ["S002", "Python入门", "2024-01-09", "09:00-11:00"],
        ["S003", "Python入门", "2024-01-10", "09:00-11:00"],
        ["S004", "Python入门", "2024-01-11", "09:00-11:00"],
        ["S005", "Python入门", "2024-01-12", "09:00-11:00"],
    ]
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(data)


def generate_test_machine_data(filepath):
    """生成测试用签到机数据"""
    data = [
        ["学员编号", "学员姓名", "场次编号", "签到状态", "签到时间"],
        ["STU001", "张三", "S001", "出勤", "2024-01-08 08:55:00"],
        ["STU001", "张三", "S002", "出勤", "2024-01-09 08:58:00"],
        ["STU001", "张三", "S003", "缺勤", ""],
        ["STU001", "张三", "S004", "出勤", "2024-01-11 09:02:00"],
        ["STU001", "张三", "S005", "出勤", "2024-01-12 08:50:00"],
        ["STU002", "李四", "S001", "出勤", "2024-01-08 08:52:00"],
        ["STU002", "李四", "S002", "缺勤", ""],
        ["STU002", "李四", "S003", "缺勤", ""],
        ["STU002", "李四", "S004", "出勤", "2024-01-11 09:00:00"],
        ["STU002", "李四", "S005", "出勤", "2024-01-12 09:00:00"],
        ["STU003", "王五", "S001", "出勤", "2024-01-08 08:45:00"],
        ["STU003", "王五", "S002", "出勤", "2024-01-09 08:59:00"],
        ["STU003", "王五", "S003", "出勤", "2024-01-10 09:01:00"],
        ["STU003", "王五", "S004", "出勤", "2024-01-11 08:55:00"],
        ["STU003", "王五", "S005", "缺勤", ""],
        ["STU004", "赵六", "S002", "出勤", "2024-01-09 08:55:00"],
        ["STU004", "赵六", "S003", "出勤", "2024-01-10 08:55:00"],
        ["STU004", "赵六", "S004", "出勤", "2024-01-11 08:55:00"],
        ["STU004", "赵六", "S005", "出勤", "2024-01-12 08:55:00"],
    ]
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(data)


def generate_test_teacher_data(filepath):
    """生成测试用老师补签数据（包含冲突）"""
    data = [
        ["学员编号", "学员姓名", "场次编号", "补签状态", "补签时间", "备注"],
        ["STU001", "张三", "S003", "出勤", "2024-01-10 09:15:00", "学员请假后补交作业，予以通过"],
        ["STU002", "李四", "S002", "出勤", "2024-01-09 10:00:00", "迟到，已补签"],
        ["STU002", "李四", "S003", "出勤", "2024-01-10 09:30:00", "有出勤记录被机器误判"],
        ["STU002", "李四", "S004", "缺勤", "2024-01-11 09:20:00", "确实缺勤"],
        ["STU003", "王五", "S005", "出勤", "2024-01-12 09:10:00", "有出勤"],
        ["STU004", "赵六", "S001", "出勤", "2024-01-08 09:00:00", "仅有老师补签"],
    ]
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(data)


def test_basic_data_loading():
    """测试基础数据加载"""
    print("  测试1: 基础数据加载...", end=" ")

    with tempfile.TemporaryDirectory() as tmpdir:
        courses_file = Path(tmpdir) / "courses.csv"
        machine_file = Path(tmpdir) / "machine.csv"
        teacher_file = Path(tmpdir) / "teacher.csv"

        generate_test_courses(courses_file)
        generate_test_machine_data(machine_file)
        generate_test_teacher_data(teacher_file)

        processor = AttendanceDataProcessor(
            str(machine_file), str(teacher_file), str(courses_file)
        )
        processor.process()

        assert len(processor.courses) == 5, f"期望5门课程，实际{len(processor.courses)}"
        assert len(processor.machine_records) == 19, f"期望19条签到机记录，实际{len(processor.machine_records)}"
        assert len(processor.teacher_records) == 6, f"期望6条补签记录，实际{len(processor.teacher_records)}"

        print("✅ 通过")
        return True


def test_conflict_detection():
    """测试冲突检测"""
    print("  测试2: 冲突检测...", end=" ")

    with tempfile.TemporaryDirectory() as tmpdir:
        courses_file = Path(tmpdir) / "courses.csv"
        machine_file = Path(tmpdir) / "machine.csv"
        teacher_file = Path(tmpdir) / "teacher.csv"

        generate_test_courses(courses_file)
        generate_test_machine_data(machine_file)
        generate_test_teacher_data(teacher_file)

        processor = AttendanceDataProcessor(
            str(machine_file), str(teacher_file), str(courses_file)
        )
        processor.process()

        assert len(processor.conflicts) == 5, f"期望5处冲突，实际{len(processor.conflicts)}"

        conflict_keys = {(c.student_id, c.session_id) for c in processor.conflicts}
        expected_conflicts = {
            ("STU001", "S003"),
            ("STU002", "S002"),
            ("STU002", "S003"),
            ("STU002", "S004"),
            ("STU003", "S005"),
        }
        assert conflict_keys == expected_conflicts, f"冲突检测不匹配"

        for conflict in processor.conflicts:
            assert conflict.final_status == conflict.teacher_status, "应以老师补签为准"

        print("✅ 通过")
        return True


def test_teacher_priority():
    """测试老师补签优先级"""
    print("  测试3: 老师补签优先级...", end=" ")

    with tempfile.TemporaryDirectory() as tmpdir:
        courses_file = Path(tmpdir) / "courses.csv"
        machine_file = Path(tmpdir) / "machine.csv"
        teacher_file = Path(tmpdir) / "teacher.csv"

        generate_test_courses(courses_file)
        generate_test_machine_data(machine_file)
        generate_test_teacher_data(teacher_file)

        processor = AttendanceDataProcessor(
            str(machine_file), str(teacher_file), str(courses_file)
        )
        processor.process()

        stu001 = processor.students["STU001"]
        assert stu001.attended_sessions == 5, f"STU001应出勤5次，实际{stu001.attended_sessions}"

        stu002 = processor.students["STU002"]
        assert stu002.attended_sessions == 4, f"STU002应出勤4次，实际{stu002.attended_sessions}"

        stu003 = processor.students["STU003"]
        assert stu003.attended_sessions == 5, f"STU003应全部出勤"

        print("✅ 通过")
        return True


def test_graduation_eligibility():
    """测试结业资格判断"""
    print("  测试4: 结业资格判断...", end=" ")

    with tempfile.TemporaryDirectory() as tmpdir:
        courses_file = Path(tmpdir) / "courses.csv"
        machine_file = Path(tmpdir) / "machine.csv"
        teacher_file = Path(tmpdir) / "teacher.csv"

        generate_test_courses(courses_file)
        generate_test_machine_data(machine_file)
        generate_test_teacher_data(teacher_file)

        processor = AttendanceDataProcessor(
            str(machine_file), str(teacher_file), str(courses_file),
            min_attendance_rate=0.8
        )
        processor.process()

        for student in processor.students.values():
            rate = student.attendance_rate
            expected = rate >= 0.8
            assert student.is_eligible == expected, \
                f"{student.student_name}: 出勤率{rate}, 资格判断错误"

        stu001 = processor.students["STU001"]
        assert stu001.is_eligible == True, "STU001应符合结业"

        stu002 = processor.students["STU002"]
        assert stu002.is_eligible == True, "STU002应符合结业(4/5=80%)"

        stu003 = processor.students["STU003"]
        assert stu003.is_eligible == True, "STU003应符合结业"

        print("✅ 通过")
        return True


def test_attendance_rate():
    """测试出勤率计算"""
    print("  测试5: 出勤率计算...", end=" ")

    with tempfile.TemporaryDirectory() as tmpdir:
        courses_file = Path(tmpdir) / "courses.csv"
        machine_file = Path(tmpdir) / "machine.csv"
        teacher_file = Path(tmpdir) / "teacher.csv"

        generate_test_courses(courses_file)
        generate_test_machine_data(machine_file)
        generate_test_teacher_data(teacher_file)

        processor = AttendanceDataProcessor(
            str(machine_file), str(teacher_file), str(courses_file)
        )
        processor.process()

        stu001 = processor.students["STU001"]
        assert abs(stu001.attendance_rate - 1.0) < 0.001, \
            f"STU001出勤率应为100%，实际{stu001.attendance_rate}"

        stu002 = processor.students["STU002"]
        assert abs(stu002.attendance_rate - 0.8) < 0.001, \
            f"STU002出勤率应为80%，实际{stu002.attendance_rate}"

        print("✅ 通过")
        return True


def test_makeup_count():
    """测试补签次数统计"""
    print("  测试6: 补签次数统计...", end=" ")

    with tempfile.TemporaryDirectory() as tmpdir:
        courses_file = Path(tmpdir) / "courses.csv"
        machine_file = Path(tmpdir) / "machine.csv"
        teacher_file = Path(tmpdir) / "teacher.csv"

        generate_test_courses(courses_file)
        generate_test_machine_data(machine_file)
        generate_test_teacher_data(teacher_file)

        processor = AttendanceDataProcessor(
            str(machine_file), str(teacher_file), str(courses_file)
        )
        processor.process()

        stu001 = processor.students["STU001"]
        assert stu001.make_up_count == 1, f"STU001应有1次补签，实际{stu001.make_up_count}"

        stu002 = processor.students["STU002"]
        assert stu002.make_up_count == 2, f"STU002应有2次出勤补签，实际{stu002.make_up_count}"

        stu003 = processor.students["STU003"]
        assert stu003.make_up_count == 1, f"STU003应有1次补签，实际{stu003.make_up_count}"

        stu004 = processor.students["STU004"]
        assert stu004.make_up_count == 1, f"STU004应有1次补签，实际{stu004.make_up_count}"

        print("✅ 通过")
        return True


def test_unknown_session_bad_rows():
    """测试未知课程场次写入坏行记录"""
    print("  测试7: 未知课程场次坏行记录...", end=" ")

    with tempfile.TemporaryDirectory() as tmpdir:
        courses_file = Path(tmpdir) / "courses.csv"
        machine_file = Path(tmpdir) / "machine.csv"
        teacher_file = Path(tmpdir) / "teacher.csv"

        generate_test_courses(courses_file)

        bad_machine_data = [
            ["学员编号", "学员姓名", "场次编号", "签到状态", "签到时间"],
            ["STU001", "张三", "S999", "出勤", "2024-01-08 08:55:00"],
            ["STU001", "张三", "S001", "出勤", "2024-01-08 08:55:00"],
        ]
        with open(machine_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(bad_machine_data)

        bad_teacher_data = [
            ["学员编号", "学员姓名", "场次编号", "补签状态", "补签时间", "备注"],
            ["STU002", "李四", "S888", "出勤", "2024-01-09 10:00:00", "测试"],
        ]
        with open(teacher_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(bad_teacher_data)

        processor = AttendanceDataProcessor(
            str(machine_file), str(teacher_file), str(courses_file)
        )
        processor.process()

        machine_bad_count = len(processor.bad_rows["machine"])
        teacher_bad_count = len(processor.bad_rows["teacher"])

        assert machine_bad_count >= 1, f"签到机数据应至少有1条坏行，实际{machine_bad_count}"
        assert teacher_bad_count >= 1, f"补签表数据应至少有1条坏行，实际{teacher_bad_count}"

        has_unknown_session = any("未知的课程场次编号" in row["error"] for row in processor.bad_rows["machine"])
        assert has_unknown_session, "坏行记录中应包含未知课程场次的错误"

        print("✅ 通过")
        return True


def test_boundary_cases():
    """测试边界情况"""
    print("  测试8: 边界情况...", end=" ")

    with tempfile.TemporaryDirectory() as tmpdir:
        courses_file = Path(tmpdir) / "courses.csv"
        machine_file = Path(tmpdir) / "machine.csv"
        teacher_file = Path(tmpdir) / "teacher.csv"

        generate_test_courses(courses_file)
        generate_test_machine_data(machine_file)
        generate_test_teacher_data(teacher_file)

        processor = AttendanceDataProcessor(
            str(machine_file), str(teacher_file), str(courses_file),
            min_attendance_rate=0.0
        )
        processor.process()

        for student in processor.students.values():
            assert student.is_eligible == True, "出勤率要求0%时所有学员都应通过"

        processor2 = AttendanceDataProcessor(
            str(machine_file), str(teacher_file), str(courses_file),
            min_attendance_rate=1.0
        )
        processor2.process()

        for student in processor2.students.values():
            if student.attended_sessions == 5:
                assert student.is_eligible == True, "全勤学员应通过"
            else:
                assert student.is_eligible == False, "非全勤学员不应通过"

        print("✅ 通过")
        return True


def test_merged_records():
    """测试合并记录"""
    print("  测试9: 合并记录验证...", end=" ")

    with tempfile.TemporaryDirectory() as tmpdir:
        courses_file = Path(tmpdir) / "courses.csv"
        machine_file = Path(tmpdir) / "machine.csv"
        teacher_file = Path(tmpdir) / "teacher.csv"

        generate_test_courses(courses_file)
        generate_test_machine_data(machine_file)
        generate_test_teacher_data(teacher_file)

        processor = AttendanceDataProcessor(
            str(machine_file), str(teacher_file), str(courses_file)
        )
        processor.process()

        assert len(processor.merged_records) == 20, f"期望20条合并记录，实际{len(processor.merged_records)}"

        sources = {r.source for r in processor.merged_records}
        assert "签到机" in sources, "应有签到机来源的记录"
        assert "老师补签" in sources, "应有老师补签来源的记录"
        assert "合并结果" in sources, "应有合并结果来源的记录"

        print("✅ 通过")
        return True


def run_all_tests():
    """运行所有测试"""
    print("开始运行自检程序...\n")

    tests = [
        test_basic_data_loading,
        test_conflict_detection,
        test_teacher_priority,
        test_graduation_eligibility,
        test_attendance_rate,
        test_makeup_count,
        test_unknown_session_bad_rows,
        test_boundary_cases,
        test_merged_records,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
        except AssertionError as e:
            print(f"❌ 失败: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ 错误: {e}")
            failed += 1

    print(f"\n{'='*50}")
    print(f"测试结果: {passed} 通过, {failed} 失败")
    print(f"{'='*50}")

    return failed == 0
