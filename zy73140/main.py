import json
from cleaner import clean_seagrass_data, build_api_response
from review import ReviewManager
from sample_data import generate_sample_records, generate_edge_case_records


def run_cleaning_demo():
    print("=" * 60)
    print("海草床调查数据清洗 - 样例运行")
    print("=" * 60)

    records = generate_sample_records()
    print(f"\n1. 加载样例数据: {len(records)} 条记录")

    result = clean_seagrass_data(records, time_threshold=2)
    print(f"\n2. 数据清洗完成")
    print(f"   - 总记录数: {result.total_records}")
    print(f"   - 已确认: {result.confirmed}")
    print(f"   - 待补件: {result.pending}")
    print(f"   - 退回: {result.rejected}")
    print(f"   - 遥感云遮挡: {len(result.cloud_cover_records)} 条 (已单独拎出)")
    print(f"   - 边界样本: {len(result.boundary_records)} 条")

    print(f"\n3. 云遮挡记录ID: {result.cloud_cover_records}")

    print(f"\n4. 边界样本影响分析:")
    analysis = result.boundary_analysis
    print(f"   - 整体影响: {analysis['overall_impact_percent']}%")
    print(f"   - 含边界样本均值: {analysis['all_mean_coverage']}%")
    print(f"   - 不含边界样本均值: {analysis['normal_mean_coverage']}%")
    for rid, detail in analysis["per_record_details"].items():
        print(f"   * {rid}: 覆盖率{detail['coverage']}%, 影响{detail['influence']}%")

    print("\n5. 接口返回示例 (统一的 scene_label 和 side_note):")
    api_resp = build_api_response(result)
    print(f"   scene_label: {api_resp['scene_label']}")
    print(f"   side_note: {api_resp['side_note']}")

    return result


def run_review_demo(cleaning_result):
    print("\n" + "=" * 60)
    print("月底复核流程演示")
    print("=" * 60)

    reviewer = ReviewManager(cleaning_result)

    print("\n1. 按状态分类:")
    summary = reviewer.get_summary()
    for key, val in summary["月底复核状态汇总"].items():
        print(f"   - {key}: {val}")

    print("\n2. 待补件优先级:")
    for item in summary["待处理优先级"][:3]:
        print(f"   * {item['record_id']} ({item['bottle_id']}): {item['reasons']}")
        print(f"     截止日期: {item['deadline']}")

    print("\n3. 复核操作 - 确认 REC-003:")
    confirmed = reviewer.confirm_record("REC-003")
    if confirmed:
        print(f"   - {confirmed.record_id} 状态: {confirmed.status.value}")

    print("\n4. 复核操作 - 退回 REC-004:")
    rejected = reviewer.reject_record("REC-004", "时间偏差过大，原始记录丢失")
    if rejected:
        print(f"   - {rejected.record_id} 状态: {rejected.status.value}, 备注: {rejected.notes}")

    print("\n5. 导出月底复核报告:")
    report = reviewer.export_for_monthly_review()
    print(f"   - 已确认记录数: {len(report['已确认记录'])}")
    print(f"   - 待补件记录数: {len(report['待补件记录'])}")
    print(f"   - 退回记录数: {len(report['退回记录'])}")

    return reviewer


def run_rerun_demo():
    print("\n" + "=" * 60)
    print("重跑清洗演示")
    print("=" * 60)

    edge_records = generate_edge_case_records()
    print(f"\n加载极端边界样例: {len(edge_records)} 条")

    result = clean_seagrass_data(edge_records, time_threshold=2)
    print(f"\n清洗结果:")
    for br in result.boundary_records:
        print(f"   * {br['record_id']}: 覆盖率{br['coverage']}%, 边界影响{br['boundary_influence']:.2f}")
        print(f"     位置: {br['location']}, 备注: {br['note']}")

    print(f"\n边界影响分析:")
    analysis = result.boundary_analysis
    print(f"   含边界均值: {analysis['all_mean_coverage']}%")
    print(f"   不含边界均值: {analysis['normal_mean_coverage']}%")
    print(f"   整体影响: {analysis['overall_impact_percent']}%")

    print("\n边界样本逐条影响:")
    for rid, detail in analysis["per_record_details"].items():
        print(f"   移除 {rid}: 均值变化 {detail['influence']}%")


def run_with_bad_data():
    print("\n" + "=" * 60)
    print("坏材料处理演示")
    print("=" * 60)
    print("\n★ 坏材料来了看这里:")
    print("  1. 查看接口返回的 cloud_cover_records 字段 - 云遮挡已单独拎出")
    print("  2. 查看 boundary_analysis - 边界样本影响量化")
    print("  3. 查看 quality_flags - 每条记录的问题标记")
    print("  4. 调用 ReviewManager.get_summary() - 按状态分类汇总")


if __name__ == "__main__":
    cleaning_result = run_cleaning_demo()
    reviewer = run_review_demo(cleaning_result)
    run_rerun_demo()
    run_with_bad_data()

    print("\n" + "=" * 60)
    print("完整 JSON 接口返回:")
    print("=" * 60)
    api_resp = build_api_response(cleaning_result)
    print(json.dumps(api_resp, ensure_ascii=False, indent=2)[:2000] + "...")
