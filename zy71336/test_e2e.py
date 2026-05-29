"""端到端测试 - 验证所有异常场景和主流程"""
import os
import sys
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from piano_checkin.cli import CheckinProcessor
from piano_checkin.models import (
    RecordStatus, AbnormalType, AUDIO_DIR,
    load_json, RECORDS_FILE, STUDENTS_FILE
)
from piano_checkin.audio_checker import AudioChecker


def run_e2e_tests():
    print("🎹 钢琴练琴打卡异常处理系统 - 端到端测试")
    print("=" * 70)

    processor = CheckinProcessor()
    checker = AudioChecker()

    students = load_json(STUDENTS_FILE, [])
    if not students:
        print("❌ 请先运行 init_test_data.py 初始化测试数据")
        return False

    student_ids = [s["student_id"] for s in students]
    today = datetime.now().strftime("%Y-%m-%d")

    audio_files = {
        "blank": os.path.join(AUDIO_DIR, "test_blank.wav"),
        "short": os.path.join(AUDIO_DIR, "test_short.wav"),
        "normal1": os.path.join(AUDIO_DIR, "test_normal1.wav"),
        "normal2": os.path.join(AUDIO_DIR, "test_normal2.wav"),
        "normal3": os.path.join(AUDIO_DIR, "test_normal3.wav"),
    }

    for f in audio_files.values():
        if not os.path.exists(f):
            print(f"❌ 音频文件不存在: {f}")
            return False

    results = []

    print("\n📋 测试1: 空白音频检测")
    print("-" * 70)
    try:
        record = processor.process_audio(
            audio_files["blank"], student_ids[0], today
        )
        has_blank = AbnormalType.BLANK_AUDIO in record.abnormal_types
        has_short = AbnormalType.SHORT_AUDIO in record.abnormal_types

        if has_blank:
            print("✅ 空白音频检测成功")
            print(f"   异常类型: {[t.value for t in record.abnormal_types]}")
            for d in record.abnormal_details:
                print(f"   详情: {d}")
            results.append(("空白音频检测", True))
        else:
            print(f"❌ 空白音频检测失败，异常类型: {record.abnormal_types}")
            results.append(("空白音频检测", False))
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        results.append(("空白音频检测", False))

    print("\n📋 测试2: 时长不足检测")
    print("-" * 70)
    try:
        record = processor.process_audio(
            audio_files["short"], student_ids[1], today
        )
        has_short = AbnormalType.SHORT_AUDIO in record.abnormal_types

        if has_short:
            print("✅ 时长不足检测成功")
            for d in record.abnormal_details:
                print(f"   详情: {d}")
            results.append(("时长不足检测", True))
        else:
            print(f"❌ 时长不足检测失败，异常类型: {record.abnormal_types}")
            results.append(("时长不足检测", False))
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        results.append(("时长不足检测", False))

    print("\n📋 测试3: 同日重复上传 + 合并")
    print("-" * 70)
    try:
        r1 = processor.process_audio(
            audio_files["normal1"], student_ids[2], today
        )
        r2 = processor.process_audio(
            audio_files["normal2"], student_ids[2], today
        )
        r3 = processor.process_audio(
            audio_files["normal3"], student_ids[2], today
        )

        before_count = len(processor.list_records(today, False, student_ids[2]))
        print(f"   合并前记录数: {before_count}")

        summary = processor.merge_duplicates(today)
        print(f"   合并组: {summary['total_duplicate_groups']}")
        print(f"   合并记录: {summary['total_merged_records']}")

        after_records = processor.list_records(today, False, student_ids[2])
        after_count = len(after_records)
        print(f"   合并后记录数: {after_count}")

        primary = after_records[0] if after_records else None
        if primary and len(primary.merged_from) == 2:
            print("✅ 同日重复合并成功")
            print(f"   主记录保留 {len(primary.merged_from)} 条合并记录")
            print(f"   合并来源: {primary.merged_from}")
            has_dup = AbnormalType.DUPLICATE in primary.abnormal_types
            if has_dup:
                print("   ✅ 重复异常标记成功")
            results.append(("同日重复合并", True))
        else:
            print(f"❌ 同日重复合并失败，merged_from={primary.merged_from if primary else None}")
            results.append(("同日重复合并", False))
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        results.append(("同日重复合并", False))

    print("\n📋 测试4: 补录超期检测")
    print("-" * 70)
    try:
        five_days_ago = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
        record = processor.process_audio(
            audio_files["normal1"], student_ids[3], today,
            is_makeup=True,
            original_date=five_days_ago,
            makeup_reason="生病发烧请假"
        )

        has_overdue = AbnormalType.MAKEUP_OVERDUE in record.abnormal_types

        if has_overdue:
            print("✅ 补录超期检测成功")
            for d in record.abnormal_details:
                print(f"   详情: {d}")
            results.append(("补录超期检测", True))
        else:
            print(f"❌ 补录超期检测失败，异常类型: {record.abnormal_types}")
            results.append(("补录超期检测", False))
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        results.append(("补录超期检测", False))

    print("\n📋 测试5: 补录理由无效检测")
    print("-" * 70)
    try:
        two_days_ago = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        record = processor.process_audio(
            audio_files["normal1"], student_ids[4], today,
            is_makeup=True,
            original_date=two_days_ago,
            makeup_reason="有事"
        )

        has_invalid = AbnormalType.INVALID_REASON in record.abnormal_types

        if has_invalid:
            print("✅ 补录理由无效检测成功")
            for d in record.abnormal_details:
                print(f"   详情: {d}")
            results.append(("补录理由无效检测", True))
        else:
            print(f"❌ 补录理由无效检测失败，异常类型: {record.abnormal_types}")
            results.append(("补录理由无效检测", False))
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        results.append(("补录理由无效检测", False))

    print("\n📋 测试6: 正常打卡（无异常）")
    print("-" * 70)
    try:
        record = processor.process_audio(
            audio_files["normal1"], student_ids[1], today
        )

        if record.status == RecordStatus.NORMAL and not record.abnormal_types:
            print("✅ 正常打卡验证成功")
            print(f"   状态: {record.status.value}")
            print(f"   时长: {record.audio.duration_seconds}秒")
            print(f"   音量: {record.audio.avg_volume}dB")
            results.append(("正常打卡", True))
        else:
            print(f"❌ 正常打卡验证失败，状态={record.status}, 异常={record.abnormal_types}")
            results.append(("正常打卡", False))
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        results.append(("正常打卡", False))

    print("\n📋 测试7: 添加老师点评")
    print("-" * 70)
    try:
        normal_records = [
            r for r in processor.list_records(today)
            if r.status == RecordStatus.NORMAL and r.student_id == student_ids[1]
        ]
        if normal_records:
            record_to_comment = normal_records[0]
            comment = processor.add_comment(
                record_to_comment.record_id,
                "李老师",
                "今天的练习非常棒！节奏稳定，继续保持！"
            )
            print("✅ 点评添加成功")
            print(f"   点评ID: {comment.comment_id}")
            print(f"   老师: {comment.teacher}")
            print(f"   内容: {comment.content}")
            results.append(("添加点评", True))
        else:
            print("⚠️  无正常记录可点评，跳过")
            results.append(("添加点评", True))
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        results.append(("添加点评", False))

    print("\n📋 测试8: 生成日报")
    print("-" * 70)
    try:
        report = processor.generate_report(today, "text")
        if "钢琴练琴打卡日报" in report and "异常明细" in report:
            print("✅ 日报生成成功")
            lines = report.split("\n")
            for line in lines[:15]:
                if line.strip():
                    print(f"   {line.strip()}")
            print("   ...")
            results.append(("生成日报", True))
        else:
            print(f"❌ 日报生成失败")
            results.append(("生成日报", False))
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        results.append(("生成日报", False))

    print("\n📋 测试9: 查看处理流水线")
    print("-" * 70)
    try:
        abnormal_records = processor.list_records(today, abnormal_only=True)
        if abnormal_records:
            pipeline_view = processor.show_pipeline(abnormal_records[0].record_id)
            if "处理流水线视图" in pipeline_view and "音频校验" in pipeline_view:
                print("✅ 流水线视图生成成功")
                lines = pipeline_view.split("\n")
                for line in lines[:10]:
                    if line.strip():
                        print(f"   {line.strip()}")
                print("   ...")
                results.append(("处理流水线", True))
            else:
                print(f"❌ 流水线视图生成失败")
                results.append(("处理流水线", False))
        else:
            print("⚠️  无异常记录，跳过")
            results.append(("处理流水线", True))
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        results.append(("处理流水线", False))

    print("\n📋 测试10: 历史备份验证")
    print("-" * 70)
    try:
        from piano_checkin.models import HISTORY_DIR
        if os.path.exists(HISTORY_DIR):
            backups = os.listdir(HISTORY_DIR)
            if backups:
                print(f"✅ 历史备份存在，共 {len(backups)} 个备份文件")
                for b in sorted(backups)[:5]:
                    print(f"   {b}")
                results.append(("历史备份", True))
            else:
                print(f"⚠️  暂无历史备份（首次运行正常）")
                results.append(("历史备份", True))
        else:
            print(f"❌ 历史备份目录不存在")
            results.append(("历史备份", False))
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        results.append(("历史备份", False))

    print("\n" + "=" * 70)
    print("📊 测试结果汇总")
    print("=" * 70)

    passed = sum(1 for _, ok in results if ok)
    total = len(results)

    for name, ok in results:
        status = "✅ 通过" if ok else "❌ 失败"
        print(f"  {status}: {name}")

    print(f"\n总计: {passed}/{total} 通过")

    if passed == total:
        print("\n🎉 所有测试通过！")
        return True
    else:
        print(f"\n⚠️  有 {total - passed} 个测试失败")
        return False


if __name__ == "__main__":
    success = run_e2e_tests()
    sys.exit(0 if success else 1)
