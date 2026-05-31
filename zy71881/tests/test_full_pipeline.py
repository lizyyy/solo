"""完整流程测试。

测试从数据导入到批改表生成的完整处理流程。
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from spring_oscillator.pipeline import SpringOscillatorPipeline
from spring_oscillator.models import DataStatus
from spring_oscillator.errors import SpringOscillatorError


def test_normal_scenario():
    """测试正常场景：主数据 + 晚到附件 + 标定表。"""
    print("=" * 60)
    print("测试1: 正常场景 - 主数据 + 晚到附件 + 标定表")
    print("=" * 60)

    pipeline = SpringOscillatorPipeline(output_dir="./output/test1")

    result = pipeline.run(
        experiment_file="./examples/experiment_data.csv",
        calibration_file="./examples/calibration_data.csv",
        late_attachment_files=["./examples/late_attachment.csv"],
        student_name="张三",
        student_id="2024001",
        export_formats=["json"],
    )

    assert result.fit_result is not None
    assert result.fit_result.spring_constant_k > 0
    assert result.fit_result.r_squared > 0.9

    confirmed = sum(1 for r in result.cleaned_records if r.status == DataStatus.CONFIRMED)
    pending = sum(1 for r in result.cleaned_records if r.status == DataStatus.PENDING)
    manual = sum(1 for r in result.cleaned_records if r.status == DataStatus.MANUAL_CORRECTED)

    print(f"✅ 拟合成功: k = {result.fit_result.spring_constant_k:.3f} N/m")
    print(f"✅ R² = {result.fit_result.r_squared:.6f}")
    print(f"✅ 已确认: {confirmed}, 待补: {pending}, 人工更正: {manual}")
    print(f"✅ 检测到 {len(result.data_gaps)} 个数据缺口")
    print(f"✅ 输出文件: {len(result.output_files)} 个")

    return True


def test_duplicate_scenario():
    """测试重复数据处理场景。"""
    print("\n" + "=" * 60)
    print("测试2: 重复数据场景")
    print("=" * 60)

    pipeline = SpringOscillatorPipeline(output_dir="./output/test2")

    try:
        result = pipeline.run(
            experiment_file="./examples/duplicate_data.csv",
            student_name="李四",
            student_id="2024002",
            export_formats=["json"],
        )

        total_imported = result.processing_summary.total_records_imported
        duplicates_removed = result.processing_summary.duplicate_records_removed

        print(f"✅ 导入记录: {total_imported}")
        print(f"✅ 去除重复: {duplicates_removed}")

        if result.fit_result is not None:
            print(f"✅ 拟合成功: k = {result.fit_result.spring_constant_k:.3f} N/m")
            print(f"✅ R² = {result.fit_result.r_squared:.6f}")
        else:
            print("ℹ️  数据不足，跳过拟合（符合预期）")

        return True
    except SpringOscillatorError as e:
        total_imported = pipeline.processing_summary.total_records_imported
        duplicates_removed = pipeline.processing_summary.duplicate_records_removed

        print(f"✅ 导入记录: {total_imported}")
        print(f"✅ 去除重复: {duplicates_removed}")
        print(f"✅ 友好错误提示（符合预期，数据不足）:")
        print(f"   {e.user_message}")
        print(f"   建议: {e.suggestion}")
        assert "太少" in e.user_message or "不足" in e.user_message
        assert "建议" in str(e)
        return True


def test_manual_correction_scenario():
    """测试人工更正场景。"""
    print("\n" + "=" * 60)
    print("测试3: 人工更正场景")
    print("=" * 60)

    pipeline = SpringOscillatorPipeline(output_dir="./output/test3")

    result = pipeline.run(
        experiment_file="./examples/manual_correction.csv",
        student_name="王五",
        student_id="2024003",
        export_formats=["json"],
    )

    assert result.fit_result is not None

    manual_count = sum(
        1 for r in result.cleaned_records if r.status == DataStatus.MANUAL_CORRECTED
    )

    print(f"✅ 人工更正记录: {manual_count}")
    print(f"✅ 拟合成功: k = {result.fit_result.spring_constant_k:.3f} N/m")
    print(f"✅ R² = {result.fit_result.r_squared:.6f}")

    for r in result.cleaned_records:
        if r.status == DataStatus.MANUAL_CORRECTED:
            print(f"   - 质量 {r.mass_kg}kg: {r.manual_correction_reason or r.notes}")

    return True


def test_incomplete_scenario():
    """测试不完整数据（采样缺口）场景。"""
    print("\n" + "=" * 60)
    print("测试4: 不完整数据（采样缺口）场景")
    print("=" * 60)

    pipeline = SpringOscillatorPipeline(output_dir="./output/test4")

    try:
        result = pipeline.run(
            experiment_file="./examples/incomplete_data.csv",
            student_name="赵六",
            student_id="2024004",
            export_formats=["json"],
        )

        gaps = result.data_gaps
        print(f"✅ 检测到 {len(gaps)} 个数据缺口")

        for i, gap in enumerate(gaps, 1):
            print(f"   {i}. {gap.gap_type.display_name} - {gap.description}")
            print(f"      来源: {gap.source.display_name}")
            print(f"      责任人: {gap.responsible_person}")
            print(f"      下一步: {gap.next_step}")

        if result.fit_result:
            print(f"✅ 拟合成功: k = {result.fit_result.spring_constant_k:.3f} N/m")
            print(f"✅ R² = {result.fit_result.r_squared:.6f}")
        else:
            print("ℹ️  数据不足，跳过拟合（符合预期）")

        return True
    except SpringOscillatorError as e:
        gaps = pipeline.data_gaps
        print(f"✅ 检测到 {len(gaps)} 个数据缺口")

        for i, gap in enumerate(gaps, 1):
            print(f"   {i}. {gap.gap_type.display_name} - {gap.description}")
            print(f"      来源: {gap.source.display_name}")
            print(f"      责任人: {gap.responsible_person}")
            print(f"      下一步: {gap.next_step}")

        print(f"✅ 友好错误提示（符合预期，数据不足）:")
        print(f"   {e.user_message}")
        print(f"   建议: {e.suggestion}")
        assert "太少" in e.user_message or "不足" in e.user_message
        assert "建议" in str(e)
        return True


def test_error_messages():
    """测试友好错误提示。"""
    print("\n" + "=" * 60)
    print("测试5: 友好错误提示")
    print("=" * 60)

    from spring_oscillator.data_importer import DataImporter
    from spring_oscillator.errors import DataImportError

    importer = DataImporter()

    try:
        importer.import_experiment_data("./nonexistent_file.csv")
        assert False, "应该抛出异常"
    except DataImportError as e:
        print("✅ 文件不存在错误提示:")
        print(f"   {e.user_message}")
        print(f"   建议: {e.suggestion}")
        assert "找不到文件" in e.user_message
        assert "建议" in str(e)

    try:
        bad_data = "./examples/bad_data.csv"
        Path(bad_data).write_text(
            "姓名,质量,周期\n"
            "张三,0.1,abc\n",
            encoding="utf-8",
        )
        importer.import_experiment_data(bad_data)
        os.remove(bad_data)
        assert False, "应该抛出异常"
    except DataImportError as e:
        print("\n✅ 无效数字错误提示:")
        print(f"   {e.user_message}")
        print(f"   建议: {e.suggestion}")
        assert "不是数字" in e.user_message or "abc" in e.user_message
        os.remove(bad_data) if Path(bad_data).exists() else None

    return True


def test_grading_report():
    """测试批改表生成。"""
    print("\n" + "=" * 60)
    print("测试6: 批改表生成")
    print("=" * 60)

    pipeline = SpringOscillatorPipeline(output_dir="./output/test6")

    result = pipeline.run(
        experiment_file="./examples/experiment_data.csv",
        calibration_file="./examples/calibration_data.csv",
        late_attachment_files=["./examples/late_attachment.csv"],
        student_name="张三",
        student_id="2024001",
        export_formats=["excel", "json"],
    )

    report = result.grading_report

    assert "processing_policy" in report
    assert "confirmed_records" in report
    assert "pending_records" in report
    assert "manual_corrected_records" in report
    assert "fit_result" in report
    assert "data_gaps" in report
    assert "grading_remarks" in report

    print(f"✅ 处理口径: {len(report['processing_policy'])} 字")
    print(f"✅ 已确认记录: {len(report['confirmed_records'])} 条")
    print(f"✅ 待补记录: {len(report['pending_records'])} 条")
    print(f"✅ 人工更正记录: {len(report['manual_corrected_records'])} 条")
    print(f"✅ 批改意见: {len(report['grading_remarks'])} 条")
    print(f"✅ 输出文件: {[f.name for f in result.output_files]}")

    for remark in report["grading_remarks"]:
        print(f"   - {remark}")

    return True


def main():
    """运行所有测试。"""
    print("\n" + "🚀" * 30)
    print("开始弹簧振子拟合系统完整测试")
    print("🚀" * 30 + "\n")

    tests = [
        test_normal_scenario,
        test_duplicate_scenario,
        test_manual_correction_scenario,
        test_incomplete_scenario,
        test_error_messages,
        test_grading_report,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
                print(f"\n✅ {test.__name__} 通过")
            else:
                failed += 1
                print(f"\n❌ {test.__name__} 失败")
        except Exception as e:
            failed += 1
            print(f"\n❌ {test.__name__} 异常: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 60)
    print(f"测试完成: 通过 {passed}/{len(tests)}, 失败 {failed}/{len(tests)}")
    print("=" * 60 + "\n")

    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
