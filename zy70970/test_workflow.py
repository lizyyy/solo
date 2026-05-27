#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.store import store
from app.importer import DataImporter
from app.validator import ValidationEngine
from app.review import ReviewManager
from app.report import ReportGenerator
from app.models import ReviewStatus, ViolationType


def test_full_workflow():
    print("=" * 60)
    print("园林喷洒对账服务 - 完整流程测试")
    print("=" * 60)

    store.clear_all()

    print("\n[1/6] 导入样例数据...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_dir = os.path.join(base_dir, "sample_data")

    with open(os.path.join(sample_dir, "pesticides.json"), 'r', encoding='utf-8') as f:
        pesticides = DataImporter.import_pesticides_from_json(f.read())
    print(f"  ✓ 导入药剂: {len(pesticides)} 条")

    with open(os.path.join(sample_dir, "weather.csv"), 'r', encoding='utf-8') as f:
        weather = DataImporter.import_weather_from_csv(f.read())
    print(f"  ✓ 导入天气记录: {len(weather)} 条")

    with open(os.path.join(sample_dir, "spray_jobs.csv"), 'r', encoding='utf-8') as f:
        jobs = DataImporter.import_jobs_from_csv(f.read())
    print(f"  ✓ 导入作业记录: {len(jobs)} 条")

    print("\n[2/6] 执行自动比对校验...")
    results = ValidationEngine.validate_all_jobs()

    valid_count = sum(1 for r in results if r.is_valid)
    invalid_count = len(results) - valid_count
    print(f"  ✓ 校验完成: 合规 {valid_count} 条, 违规 {invalid_count} 条")

    stats = ValidationEngine.get_violation_statistics()
    print(f"  ✓ 违规类型统计: {stats}")

    print("\n[3/6] 查看详细校验结果...")
    for job in jobs:
        result = store.get_validation_result(job.id)
        if result and not result.is_valid:
            print(f"\n  作业 {job.id} ({job.pesticide_name}, {job.area}):")
            for v in result.violations:
                print(f"    - [{v.severity}] {v.type.value}: {v.message}")

    print("\n[4/6] 人工复核测试...")

    problematic_job = None
    for job in jobs:
        result = store.get_validation_result(job.id)
        if result and not result.is_valid:
            problematic_job = job
            break

    if problematic_job:
        print(f"  选择作业 {problematic_job.id} 进行复核")
        print(f"  原始用量: {problematic_job.dosage_used}")

        review = ReviewManager.create_review(
            job_id=problematic_job.id,
            reviewer="张经理",
            status=ReviewStatus.APPROVED,
            review_notes="现场确认虫害严重，确需超量使用，已获得主管批准。",
            adjusted_dosage=problematic_job.dosage_used * 0.95,
            override_violations=[ViolationType.DOSAGE_EXCEEDED]
        )
        print(f"  ✓ 创建复核记录: {review.status.value}")

        updated_job = store.get_spray_job(problematic_job.id)
        print(f"  ✓ 调整后用量: {updated_job.dosage_used}")

        job_detail = ReviewManager.get_job_with_review(problematic_job.id)
        print(f"  ✓ 复核后状态: {job_detail['review_status']}")
        print(f"  ✓ 有效违规数: {len(job_detail['effective_violations'])}")

    print("\n[5/6] 生成报告并验证一致性...")
    summary = ReportGenerator.generate_summary()
    print(f"  ✓ 总记录数: {summary.total_jobs}")
    print(f"  ✓ 合规记录: {summary.valid_jobs}")
    print(f"  ✓ 违规记录: {summary.invalid_jobs}")
    print(f"  ✓ 待复核: {summary.pending_review}")
    print(f"  ✓ 已通过: {summary.approved}")
    print(f"  ✓ 总用量: {summary.total_dosage_used}")

    all_jobs = ReviewManager.get_all_jobs_with_reviews()
    detail_valid_count = sum(1 for j in all_jobs if j.get("is_effectively_valid"))
    detail_invalid_count = len(all_jobs) - detail_valid_count
    detail_approved_count = sum(
        1 for j in all_jobs if j.get("review_status") == ReviewStatus.APPROVED.value
    )

    print(f"\n  🔍 一致性验证:")
    print(f"    汇总合规数({summary.valid_jobs}) == 详情合规数({detail_valid_count}): {summary.valid_jobs == detail_valid_count}")
    print(f"    汇总违规数({summary.invalid_jobs}) == 详情违规数({detail_invalid_count}): {summary.invalid_jobs == detail_invalid_count}")
    print(f"    汇总已通过({summary.approved}) == 详情已通过({detail_approved_count}): {summary.approved == detail_approved_count}")

    assert summary.valid_jobs == detail_valid_count, "汇总合规数与详情不一致！"
    assert summary.invalid_jobs == detail_invalid_count, "汇总违规数与详情不一致！"
    assert summary.approved == detail_approved_count, "汇总已通过数与详情不一致！"
    print(f"  ✓ 汇总与详情数据完全一致！")

    csv_export = ReportGenerator.export_report_csv()
    csv_lines = csv_export.split('\n')
    csv_valid_count = None
    csv_invalid_count = None
    for line in csv_lines:
        if '合规记录' in line:
            csv_valid_count = int(line.split(',')[1].strip())
        elif '违规记录' in line:
            csv_invalid_count = int(line.split(',')[1].strip())
    
    print(f"\n  ✓ CSV导出验证: 合规={csv_valid_count}, 违规={csv_invalid_count}")
    assert csv_valid_count == summary.valid_jobs, "CSV导出合规数与汇总不一致！"
    assert csv_invalid_count == summary.invalid_jobs, "CSV导出违规数与汇总不一致！"
    print(f"  ✓ CSV导出数据与汇总完全一致！")

    print("\n[6/6] 生成决策说明...")
    if problematic_job:
        explanation = ReportGenerator.get_explanation_for_job(problematic_job.id)
        print(f"\n  作业 {problematic_job.id} 决策说明:")
        print(f"  复核状态: {explanation['review_status']}")
        print(f"  决策原因: {explanation['decision_reason']}")
        if explanation.get('evidence'):
            print(f"  证据:")
            for e in explanation['evidence']:
                print(f"    - {e['type']}: {e['message']}")

    print("\n" + "=" * 60)
    print("✓ 所有测试通过！系统运行正常。")
    print("=" * 60)

    print("\n📊 违规记录详情:")
    for job in jobs:
        result = store.get_validation_result(job.id)
        if result and result.violations:
            print(f"\n  作业 {job.id}:")
            print(f"    日期: {job.job_date}, 区域: {job.area}, 药剂: {job.pesticide_name}")
            for v in result.violations:
                print(f"    - {v.type.value}: {v.message}")


if __name__ == "__main__":
    test_full_workflow()
