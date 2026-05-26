import json
import os
import sys

from museum_reconciliation.api import ReconciliationService
from museum_reconciliation.models.models import ReviewStatus


def print_separator(char="=", length=60):
    print(char * length)


def print_header(title):
    print_separator()
    print(f"  {title}")
    print_separator()


def print_record_summary(record):
    print(f"\n  文物编号: {record['artifact_id']}")
    print(f"  文物名称: {record['artifact_name']}")
    print(f"  文物等级: {record['grade']}")
    print(f"  对账状态: {record['status']}")
    print(f"  差异数量: {record['discrepancy_count']} (严重: {record['critical_count']})")
    review_status = record.get('review_status', record.get('review_state', '未复核'))
    print(f"  复核状态: {review_status or '未复核'}")


def print_discrepancy(disc, index):
    print(f"\n  差异 #{index}:")
    print(f"    类型: {disc['type']}")
    print(f"    字段: {disc['field']}")
    print(f"    期望值: {disc['expected_value']}")
    print(f"    实际值: {disc['actual_value']}")
    print(f"    描述: {disc['description']}")
    print(f"    严重程度: {'严重' if disc['severity'] == 'critical' else '一般'}")
    print(f"    解释: {disc['explanation']}")
    if disc.get('resolution_note'):
        print(f"    解决说明: {disc['resolution_note']}")


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    samples_dir = os.path.join(base_dir, "museum_reconciliation", "samples")
    output_dir = os.path.join(base_dir, "output")

    csv_path = os.path.join(samples_dir, "artifacts.csv")
    transport_path = os.path.join(samples_dir, "transport.json")
    insurance_path = os.path.join(samples_dir, "insurance.json")

    print_header("博物馆展陈部文物借展对账服务")

    service = ReconciliationService()

    print("\n[1] 导入数据...")
    init_result = service.initialize(csv_path, transport_path, insurance_path)

    import_info = service.get_import_info()
    print(f"  ✓ 文物数量: {import_info['artifact_count']}")
    print(f"  ✓ 运输记录: {import_info['transport_count']}")
    print(f"  ✓ 保险单数量: {import_info['insurance_policy_count']}")

    print_header("对账结果概览")
    summary = init_result["summary"]
    print(f"  总记录数: {summary['total_records']}")
    print(f"  完全一致: {summary['matched']}")
    print(f"  待复核: {summary['needs_review']}")
    print(f"  已处理: {summary['resolved']}")
    print(f"  异常: {summary['exception']}")
    print(f"  总差异数: {summary['total_discrepancies']}")
    print(f"  严重差异: {summary['critical_discrepancies']}")

    print_header("按文物等级统计")
    for grade, count in summary["records_by_grade"].items():
        issues = summary["records_with_issues_by_grade"].get(grade, 0)
        print(f"  {grade}: {count}件 (有差异: {issues}件)")

    print_header("差异类型统计")
    for dtype, count in summary["discrepancies_by_type"].items():
        print(f"  {dtype}: {count}项")

    print_header("待复核清单")
    pending = init_result["pending_reviews"]
    if pending:
        for item in pending:
            print_record_summary(item)
    else:
        print("  无待复核记录")

    print_header("记录详情 - ART-002 (需人工修正)")
    detail_result = service.get_record_detail("ART-002")
    detail = detail_result["detail"]
    guidance = detail_result["review_guidance"]

    print(f"\n  文物编号: {detail['artifact_id']}")
    print(f"  文物名称: {detail['artifact_name']}")
    print(f"  文物等级: {detail['artifact_grade']}")
    print(f"  对账状态: {detail['status']}")

    if detail.get("artifact_info"):
        ai = detail["artifact_info"]
        print(f"\n  ┌─ 文物信息 ─┐")
        print(f"  │ 类别: {ai['category']}")
        print(f"  │ 来源: {ai['origin_museum']}")
        print(f"  │ 当前估值: {ai['current_valuation_formatted']}")
        print(f"  │ 原估值: {ai['previous_valuation_formatted']}")
        print(f"  │ 保存状况: {ai['condition']}")
        print(f"  └─────────────┘")

    if detail.get("transport_info"):
        ti = detail["transport_info"]
        print(f"\n  ┌─ 运输信息 ─┐")
        print(f"  │ 运输ID: {ti['transport_id']}")
        print(f"  │ 路线: {ti['start_location']} → {ti['end_location']}")
        print(f"  │ 计划: {ti['planned_start_date']} ~ {ti['planned_end_date']}")
        print(f"  │ 实际: {ti['actual_start_date']} ~ {ti['actual_end_date']}")
        print(f"  │ 方式: {ti['transport_method']}")
        print(f"  │ 承运方: {ti['carrier']}")
        print(f"  │ 整体状态: {ti['overall_status']}")
        print(f"  └─────────────┘")

    if detail.get("insurance_info"):
        ii = detail["insurance_info"]
        print(f"\n  ┌─ 保险信息 ─┐")
        print(f"  │ 保单号: {ii['policy_id']}")
        print(f"  │ 承保方: {ii['insurer']}")
        print(f"  │ 保险金额: {ii['insured_amount_formatted']}")
        print(f"  │ 保险期间: {ii['coverage_start']} ~ {ii['coverage_end']}")
        print(f"  │ 险种: {ii['policy_type']}")
        print(f"  └─────────────┘")

    print(f"\n  ┌─ 差异详情 ─┐")
    for i, disc in enumerate(detail["discrepancies"], 1):
        print_discrepancy(disc, i)
    print(f"  └─────────────┘")

    print(f"\n  ┌─ 复核建议 ─┐")
    print(f"  │ 风险等级: {guidance['risk_level']}")
    print(f"  │ 建议操作: {guidance['suggested_action']}")
    print(f"  │ 说明: {guidance['approval_reason']}")
    if guidance.get("required_documents"):
        print(f"  │ 所需材料:")
        for doc in guidance["required_documents"]:
            print(f"  │   - {doc}")
    print(f"  └─────────────┘")

    print_header("执行复核操作 - ART-002")
    print("\n  场景: ART-002唐代三彩骆驼估值从80万涨到95万，保险金额仍为80万")
    print("  操作: 标记为需补材料，要求补充估值依据并调整保险金额")

    review_result = service.review_record(
        artifact_id="ART-002",
        decision=ReviewStatus.NEEDS_SUPPLEMENT.value,
        reviewer="张三（展陈部主任）",
        comments="估值涨幅达18.75%，已超过二级文物规定的30%上限，但保险金额未同步调整，存在不足额投保风险。",
        required_actions="1. 补充估值变更的专家评估报告；2. 联系保险公司调整保险金额至95万元；3. 提交审批流程。",
        manual_fix_fields=["估值", "保险金额"],
    )

    detail = review_result["detail"]
    if detail.get("review_decision"):
        rd = detail["review_decision"]
        print(f"\n  复核状态: {rd['decision']}")
        print(f"  复核人: {rd['reviewer']}")
        print(f"  复核时间: {rd['review_time']}")
        print(f"  意见: {rd['comments']}")
        print(f"  要求: {rd['required_actions']}")
        print(f"  需修正字段: {', '.join(rd['manual_fix_fields'])}")

    print_header("模拟修正保险金额 - ART-002")
    print("\n  场景: 保险公司已同意调整保额，修正保险金额为95万元")

    correct_result = service.correct_field(
        artifact_id="ART-002",
        field="insured_amount",
        value=950000,
        reviewer="李四（展陈部经办人）",
        reason="保险公司确认调整保险金额，与估值保持一致",
    )

    detail = correct_result["detail"]
    if detail.get("insurance_info"):
        ii = detail["insurance_info"]
        print(f"\n  ✓ 保险金额已修正为: {ii['insured_amount_formatted']}")

    remaining_discs = [d for d in detail["discrepancies"] if not d["resolved"]]
    print(f"  剩余未解决差异: {len(remaining_discs)}项")
    if remaining_discs:
        for disc in remaining_discs:
            print(f"    - {disc['type']}: {disc['description']}")

    print_header("复核ART-003 (温湿度异常)")
    detail_003 = service.get_record_detail("ART-003")
    detail3 = detail_003["detail"]
    guidance3 = detail_003["review_guidance"]

    print(f"\n  文物: {detail3['artifact_name']} ({detail3['artifact_grade']})")
    print(f"  差异数: {detail3['discrepancy_count']}项 (严重: {detail3['critical_discrepancy_count']}项)")

    print(f"\n  差异详情:")
    for i, disc in enumerate(detail3["discrepancies"], 1):
        print_discrepancy(disc, i)

    print(f"\n  复核建议: 风险等级={guidance3['risk_level']}")
    print(f"  建议操作: {guidance3['suggested_action']}")

    print_header("生成对账报告")
    reports = service.generate_reports(output_dir)
    print(f"\n  ✓ JSON报告: {reports['reports']['json_report']}")
    print(f"  ✓ CSV汇总: {reports['reports']['csv_summary']}")
    print(f"  ✓ 差异明细: {reports['reports']['csv_discrepancies']}")

    print_header("最终对账状态")
    all_records = service.get_all_records()
    for record in all_records["records"]:
        status_icon = {"完全一致": "✓", "待复核": "⚠", "已处理": "✓", "异常": "✗"}.get(
            record["status"], "?"
        )
        print(f"  {status_icon} {record['artifact_id']} {record['artifact_name']} "
              f"[{record['grade']}] - {record['status']} "
              f"(差异: {record['discrepancy_count']})")

    print_header("向展陈部说明的处理结论")

    print("""
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  处理结论说明：                                           │
  │                                                          │
  │  ART-001 战国青铜鼎 [一级文物]                            │
  │    → 所有数据一致，已放行 ✓                               │
  │                                                          │
  │  ART-002 唐代三彩骆驼 [二级文物]                          │
  │    → 估值从¥800,000上涨至¥950,000(+18.75%)               │
  │    → 保险金额原¥800,000不足额，已修正为¥950,000           │
  │    → 运输延误1天（天气原因）                              │
  │    → 状态：需补材料，等待估值依据和保险确认               │
  │    → 理由：二级文物估值变动需部门主任审批，保险已修正      │
  │                                                          │
  │  ART-003 宋代山水画 [三级文物]                            │
  │    → 运输途中温湿度异常（温度偏低、湿度偏高）             │
  │    → 状态：需复核，建议到达后详细检查文物状态             │
  │    → 理由：温湿度异常可能影响书画保存，需确认无损         │
  │                                                          │
  │  ART-004 清代玉佩 [一般文物]                              │
  │    → 所有数据一致，已放行 ✓                               │
  │                                                          │
  │  ART-005 汉代陶俑 [三级文物]                              │
  │    → 所有数据一致，已放行 ✓                               │
  │                                                          │
  │  总计：5件文物，3件无差异，2件有差异待处理               │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
""")

    print_separator()
    print("  对账服务演示完成！")
    print(f"  输出目录: {output_dir}")
    print_separator()


if __name__ == "__main__":
    main()