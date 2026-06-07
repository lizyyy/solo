import os
import sys
import uuid
from datetime import datetime

from models import PointStatus, AbnormalType
from storage import store
from workflow import WorkflowService
from self_check import SelfChecker
from exporter import UnifiedDataExporter


def run_tests():
    print("=" * 60)
    print("社区助餐点服务半径 - 核心功能测试")
    print("=" * 60)

    test_file = "sample_points.xlsx"
    operator = "社区书记周姐"

    print("\n【测试1】第一步：夜间采样点导入")
    print("-" * 40)
    batch = WorkflowService.step1_import_night_sampling_points(test_file, operator)
    print(f"导入批次: {batch.batch_id}")
    print(f"导入点位数量: {batch.total_count}")
    print(f"操作人: {batch.operator}")

    all_points = store.get_all_points()
    print(f"\n导入后总点位: {len(all_points)}")
    for p in all_points:
        print(f"  - {p.name} (行号:{p.original_row_number}, 状态:{p.status.value})")

    print("\n【测试2】自检：重复导入检测")
    print("-" * 40)
    duplicate_issues = SelfChecker.check_duplicate_import()
    print(f"检测到重复导入问题: {len(duplicate_issues)} 个")
    for point, msg in duplicate_issues:
        print(f"  - {point.name}: {msg}")

    print("\n【测试3】自检：施工临时改道未同步检测")
    print("-" * 40)
    construction_issues = SelfChecker.check_all_construction_issues()
    print(f"检测到施工改道问题: {len(construction_issues)} 个")
    for point, msg in construction_issues:
        print(f"  - {point.name} (行号:{point.original_row_number}): {msg}")
        print(f"    状态: {point.status.value} (待居民代表复核)")

    print("\n【测试4】第二步：社区书记周姐补看居民投诉编号")
    print("-" * 40)
    test_point = all_points[0]
    complaint_id = "TS20260607001"
    updated_point = WorkflowService.step2_add_complaint_id(
        test_point.id, complaint_id, operator
    )
    print(f"点位: {updated_point.name}")
    print(f"补充投诉编号: {updated_point.complaint_id}")
    print(f"补录后服务半径: {updated_point.service_radius}")
    print(f"是否人工改动: {updated_point.is_manual_modified}")

    print("\n【测试5】自检：补录后重算半径")
    print("-" * 40)
    result = store.get_radius_result(test_point.id)
    print(f"原始半径: {result.original_radius}")
    print(f"计算半径: {result.calculated_radius}")
    print(f"最终半径: {result.final_radius}")

    print("\n【测试6】第三步：点位清单更新")
    print("-" * 40)
    updated_point = WorkflowService.step3_update_point_list(
        test_point.id,
        operator,
        address="幸福路100号（已更新）",
        service_radius=520,
    )
    print(f"更新后地址: {updated_point.address}")
    print(f"更新后半径: {updated_point.service_radius}")
    print(f"审计记录数: {len(updated_point.audit_logs)}")

    print("\n【测试7】待居民代表复核的点位")
    print("-" * 40)
    review_points = WorkflowService.get_points_for_resident_review()
    print(f"待复核点位数量: {len(review_points)}")
    for p in review_points:
        print(f"  - {p.name} (行号:{p.original_row_number})")
        print(f"    施工备注: {p.construction_note}")

    print("\n【测试8】居民代表复核通过")
    print("-" * 40)
    if review_points:
        reviewed = WorkflowService.mark_resident_reviewed(
            review_points[0].id,
            "居民代表李阿姨",
            is_approved=True,
            remark="已现场核实，改道已同步",
        )
        print(f"点位: {reviewed.name}")
        print(f"复核后状态: {reviewed.status.value}")
        print(f"异常类型剩余: {[t.value for t in reviewed.abnormal_types]}")

    print("\n【测试9】自检：导出一致性检查")
    print("-" * 40)
    is_consistent, issues = SelfChecker.check_export_consistency()
    print(f"数据一致性: {'通过' if is_consistent else '不通过'}")
    if issues:
        for issue in issues:
            print(f"  - {issue}")

    print("\n【测试10】统一数据出口验证")
    print("-" * 40)
    api_data = UnifiedDataExporter.get_for_api(test_point.id)
    page_data = UnifiedDataExporter.get_for_page_display()

    print(f"API返回-点位名称: {api_data['point']['点位名称']}")
    print(f"API返回-最终半径: {api_data['point']['最终服务半径']}")
    print(f"页面展示-点位数量: {len(page_data)}")
    print(f"页面展示-首个点位半径: {page_data[0]['最终服务半径']}")
    print(f"数据一致性验证: API与页面半径一致 = {api_data['point']['最终服务半径'] == page_data[0]['最终服务半径']}")

    print("\n【测试11】审计证据追溯（居民代表追问时）")
    print("-" * 40)
    evidence = UnifiedDataExporter.get_audit_evidence(test_point.id)
    print(f"点位名称: {evidence['point_name']}")
    print(f"原始行号: {evidence['original_row_number']}")
    print(f"当前状态: {evidence['status_text']}")
    print(f"是否人工改动: {evidence['is_manual_modified']}")
    print(f"历史操作记录:")
    for log in evidence["radius_history"]:
        print(f"  - {log['timestamp'][:19]} {log['operator']} {log['action']}")

    print("\n【测试12】完整自检报告")
    print("-" * 40)
    report = SelfChecker.run_full_check()
    print(f"检查时间: {report['check_time']}")
    print(f"总点位数: {report['total_points']}")
    print(f"问题汇总: {report['summary']}")
    if report["issues"]:
        print("问题明细:")
        for issue in report["issues"]:
            print(f"  - {issue}")

    print("\n【测试13】导出Excel")
    print("-" * 40)
    export_path = "服务半径导出结果.xlsx"
    UnifiedDataExporter.export_to_excel(export_path)
    print(f"已导出到: {export_path}")

    print("\n" + "=" * 60)
    print("所有测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
