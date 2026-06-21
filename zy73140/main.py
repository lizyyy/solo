import json
import sys
from cleaner import clean_seagrass_data, build_api_response, export_by_view
from review import ReviewManager
from sample_data import generate_sample_records, generate_edge_case_records


def run_cleaning_demo():
    print("=" * 60)
    print("海草床调查数据清洗 - 样例运行")
    print("=" * 60)

    records = generate_sample_records()
    print(f"\n1. 加载样例数据: {len(records)} 条记录")

    result = clean_seagrass_data(records, time_threshold=2)
    print(f"\n2. 数据清洗完成 (已先排除云遮挡再做边界分析)")
    print(f"   - 总记录数: {result.total_records}")
    print(f"   - 已确认: {result.confirmed}")
    print(f"   - 待补件: {result.pending}")
    print(f"   - 退回: {result.rejected}")
    print(f"   - 遥感云遮挡: {len(result.cloud_cover_records)} 条 (已单独拎出, 不参与均值和边界计算)")
    print(f"   - 可用记录数 (排除云遮挡后): {len(result.cleaned_data)}")
    print(f"   - 边界样本: {len(result.boundary_records)} 条")

    print(f"\n3. 云遮挡详细清单 (含瓶号/时间/原始结果/剔除原因):")
    for cc in result.cloud_cover_records:
        print(f"   * {cc['record_id']} ({cc['bottle_id']}):")
        print(f"     采样时间: {cc['sampling_time']}, 云遮挡率: {cc['cloud_cover_percent']}%")
        print(f"     原始覆盖率: {cc['seagrass_coverage']}%, 生物量: {cc['biomass']}")
        print(f"     状态: {cc['status']}")
        print(f"     剔除原因: {cc['reject_reason']}")

    print(f"\n4. 边界样本影响分析 (基于排除云遮挡后的 {len(result.cleaned_data)} 条可用记录):")
    analysis = result.boundary_analysis
    print(f"   - {analysis.get('calculation_note', '')}")
    print(f"   - 整体影响: {analysis['overall_impact_percent']}%")
    print(f"   - 含边界样本均值: {analysis['all_mean_coverage']}%")
    print(f"   - 不含边界样本均值: {analysis['normal_mean_coverage']}%")
    for rid, detail in analysis["per_record_details"].items():
        print(f"   * {rid}: 覆盖率{detail['coverage']}%, 影响{detail['influence']}%")

    print("\n5. 接口返回示例 (统一 scene_label 和 side_note):")
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

    print("\n5. 导出月底复核报告 (三类完整记录):")
    report = reviewer.export_for_monthly_review()
    print(f"   - 已确认记录数: {len(report['已确认记录'])}")
    print(f"   - 待补件记录数: {len(report['待补件记录'])}")
    print(f"   - 退回记录数: {len(report['退回记录'])}")
    print(f"   - 云遮挡退回详情数: {len(report['云遮挡退回详情'])}")

    if report["退回记录"]:
        print("\n   退回记录示例 (含完整原因):")
        for r in report["退回记录"][:2]:
            print(f"   * {r['record_id']} ({r['bottle_id']}): {r['notes']}")
            print(f"     flags: {r['quality_flags']}")

    return reviewer


def run_multi_view_demo(cleaning_result):
    print("\n" + "=" * 60)
    print("多视角导出演示")
    print("=" * 60)

    for view in ["engineer", "reviewer", "api"]:
        view_result = export_by_view(cleaning_result, view=view)
        print(f"\n--- {view} 视角 ---")
        print(f"   scene_label: {view_result['scene_label']}")
        print(f"   side_note (前60字): {view_result['side_note'][:60]}...")
        print(f"   summary keys: {list(view_result['summary'].keys())}")

        if view == "engineer":
            print(f"   特有字段: 云遮挡详细清单({len(view_result['云遮挡详细清单'])}条), 每条记录问题标记({len(view_result['每条记录问题标记'])}条)")
        elif view == "reviewer":
            print(f"   特有字段: 已确认({len(view_result['已确认记录'])}), 待补件({len(view_result['待补件记录'])}), 退回({len(view_result['退回记录'])})")
        else:
            print(f"   特有字段: cleaned_data({len(view_result['cleaned_data'])} 条可用记录)")


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
    print(f"   {analysis.get('calculation_note', '')}")
    print(f"   含边界均值: {analysis['all_mean_coverage']}%")
    print(f"   不含边界均值: {analysis['normal_mean_coverage']}%")
    print(f"   整体影响: {analysis['overall_impact_percent']}%")

    print("\n边界样本逐条影响:")
    for rid, detail in analysis["per_record_details"].items():
        print(f"   移除 {rid}: 均值变化 {detail['influence']}%")


def run_with_bad_data():
    print("\n" + "=" * 60)
    print("坏材料处理 - 速查指引")
    print("=" * 60)
    print("\n★ 坏材料来了看这里:")
    print("  1. export_by_view(view='engineer')['云遮挡详细清单']  →  每条云遮挡的瓶号/时间/原始结果/剔除原因")
    print("  2. export_by_view(view='engineer')['边界影响分析']    →  排除云遮挡后的边界样本量化影响")
    print("  3. export_by_view(view='reviewer')['退回记录']         →  所有退回记录及原因")
    print("  4. export_by_view(view='reviewer')['已确认记录/待补件记录/退回记录'] → 月底复核三类完整记录")


def run_cli():
    view = None
    if len(sys.argv) > 1:
        view = sys.argv[1].lower()
        if view in ["-h", "--help"]:
            print("用法: python main.py [engineer|reviewer|api]")
            print("  engineer  - 工程师视角：原始质量问题排查")
            print("  reviewer  - 复核视角：月底状态分类与优先级")
            print("  api       - 接口视角：结构化 JSON 返回")
            print("  (无参数)  - 完整控制台演示")
            return
        if view not in ["engineer", "reviewer", "api"]:
            print(f"未知视角: {view}，使用 engineer 视角")
            view = "engineer"

    if view:
        records = generate_sample_records()
        result = clean_seagrass_data(records, time_threshold=2)
        view_data = export_by_view(result, view=view)
        print(json.dumps(view_data, ensure_ascii=False, indent=2, default=str))
        return

    cleaning_result = run_cleaning_demo()
    reviewer = run_review_demo(cleaning_result)
    run_multi_view_demo(cleaning_result)
    run_rerun_demo()
    run_with_bad_data()

    print("\n" + "=" * 60)
    print("完整 JSON 接口返回 (截取):")
    print("=" * 60)
    api_resp = build_api_response(cleaning_result)
    print(json.dumps(api_resp, ensure_ascii=False, indent=2, default=str)[:2500] + "...")


if __name__ == "__main__":
    run_cli()
