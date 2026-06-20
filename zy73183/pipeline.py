import os
import sys

from late_attachment import (
    apply_late_attachment,
    attach_supplementary_note,
    summarize_late_impact,
)
from models import FilterCriteria, RecordStatus
from report_generator import generate_markdown_report
from result_engine import build_unified_result, rebuild_with_same_criteria
from sample_data import (
    build_late_attachment_record,
    build_student_draft_records,
    build_supplementary_only_record,
)
from unit_validator import split_by_unit_issue


def run_pipeline(output_dir: str = "output"):
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 60)
    print("约束规划图表解释 - 数据处理流程")
    print("=" * 60)

    print("\n[Step 1] 加载学生草稿数据（含：断续材料、单位缺失、单位不一致）")
    raw_records = build_student_draft_records()
    print(f"  共加载 {len(raw_records)} 条草稿记录")

    print("\n[Step 2] 生成统一结果集（筛选/统计/明细/报告同源）")
    criteria = FilterCriteria(category="全部")
    result_v1 = build_unified_result(raw_records, criteria)
    print(f"  数据源哈希: {result_v1.source_hash}")
    s = result_v1.statistics
    print(f"  总数: {s.total_count}, 正常: {s.normal_count}, 单位缺失: {s.unit_missing_count}, "
          f"单位不一致: {s.unit_inconsistent_count}, 晚到: {s.late_arrival_count}, "
          f"后补: {s.supplementary_count}, 待复核: {s.pending_review_count}")
    print(f"  可放行: {s.can_release_count}, 需补材料: {s.need_supplement_count}")

    print("\n[Step 3] 单位问题记录单独拎出（不混入正常结果）")
    normal_vrs, unit_issue_vrs = split_by_unit_issue(result_v1.filtered_records)
    print(f"  正常/其他: {len(normal_vrs)} 条")
    print(f"  单位异常（单独拎出）: {len(unit_issue_vrs)} 条")
    for vr in unit_issue_vrs:
        r = vr.raw
        print(f"    - {r.record_id} [{r.metric_name}] value={r.value} unit={r.unit} issues={vr.issues}")

    report_path_v1 = os.path.join(output_dir, "report_before_late_attachment.md")
    with open(report_path_v1, "w", encoding="utf-8") as f:
        f.write(generate_markdown_report(result_v1, title="约束规划图表解释 - 初版报告（晚到附件前）"))
    print(f"\n[Step 4] 初版报告已写入: {report_path_v1}")

    print("\n[Step 5] 收到晚到附件 R016，并入后复算")
    late_record = build_late_attachment_record()
    merged_records = apply_late_attachment(raw_records, late_record)

    supp_record = build_supplementary_only_record()
    merged_records.append(supp_record)

    print(f"  合并后记录数: {len(merged_records)}")

    result_v2 = rebuild_with_same_criteria(merged_records, result_v1)
    print(f"  新数据源哈希: {result_v2.source_hash}")
    print(f"  筛选条件与初版完全一致，确保图表与明细同口径")

    print("\n[Step 6] 晚到附件前后对比（检查口径一致性）")
    impact = summarize_late_impact(result_v1.filtered_records, result_v2.filtered_records)
    print(f"  复算前汇总: {impact['before_release_total']}")
    print(f"  复算后汇总: {impact['after_release_total']}")
    print(f"  变化量: {impact['delta_value']}")
    if impact['delta_percent'] is not None:
        print(f"  变化幅度: {impact['delta_percent']:.2f}%")
    print(f"  新增记录: {impact['added_record_ids']}")
    print(f"  受影响记录: {impact['changed_record_ids']}")
    print(f"  图表与明细口径一致: {impact['is_consistent_caliber']}")

    report_path_v2 = os.path.join(output_dir, "report_final.md")
    with open(report_path_v2, "w", encoding="utf-8") as f:
        f.write(generate_markdown_report(
            result_v2,
            title="约束规划图表解释 - 最终交接报告（含晚到附件复算）",
            late_impact=impact,
        ))
    print(f"\n[Step 7] 最终交接报告已写入: {report_path_v2}")

    print("\n[Step 8] 分类筛选验证（同一结果集不同视图）")
    criteria_transport = FilterCriteria(category="运输成本")
    result_transport = build_unified_result(merged_records, criteria_transport)
    criteria_material = FilterCriteria(category="物料消耗")
    result_material = build_unified_result(merged_records, criteria_material)
    print(f"  运输成本筛选 -> 记录数: {len(result_transport.filtered_records)}")
    print(f"  物料消耗筛选 -> 记录数: {len(result_material.filtered_records)}")
    print(f"  两者均基于同一数据源哈希: {result_transport.source_hash == result_material.source_hash}")

    print("\n" + "=" * 60)
    print("流程完成。核心保证：")
    print("  1. 筛选条件、统计数字、明细表、Markdown报告 同源生成")
    print("  2. 单位缺失/不一致记录单独拎出，不混入正常汇总")
    print("  3. 晚到附件并入后用同一筛选条件复算，图表与明细同口径")
    print("  4. 报告收尾非技术说明，明确哪条该补、哪条可放行")
    print("=" * 60)

    return result_v2, impact


if __name__ == "__main__":
    run_pipeline()
