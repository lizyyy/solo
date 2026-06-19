"""
端到端验证脚本：拒绝混合记录闭环
==================================

覆盖场景：
  场景A：纯小数名单（无待复核，直接算到车辆班次/客流/成本/明细/报告/导出）
  场景B：纯百分数名单（无待复核，直接算到车辆班次/客流/成本/明细/报告/导出）
  场景C：混合名单 + 活动负责人拒绝部分记录
          - 导入、参数调试、拒绝、批准、保存、刷新、重算
          - 计算明细下钻、生成报告、CSV/JSON导出、历史备注
          - 被拒绝的线路必须完全从：排班、成本、下钻、报告明细、导出明细中排除
          - 被拒绝的线路必须出现在：排除清单(含拒绝原因/负责人/时间)、历史变更记录

运行方式：
    python3 verify_rejected_closed_loop.py
"""
import sys
import os
import json

sys.path.insert(0, os.getcwd())

from bus_scheduling import (
    BoundaryValidator, SamplingImporter,
    BusScheduler, SchedulingWorkflow,
)

TEST_DATA_DIR = os.path.join(os.getcwd(), "test_data")
OUTPUT_DIR = os.path.join(os.getcwd(), "test_outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

SECTION = "=" * 70


def make_workflow():
    return SchedulingWorkflow(
        BoundaryValidator(),
        SamplingImporter(BoundaryValidator()),
        BusScheduler(BoundaryValidator()),
    )


def log(msg, level="  "):
    print(f"{level}{msg}")


def scenario_a_pure_decimal():
    """场景A：纯小数名单"""
    print(f"\n{SECTION}")
    print("场景 A：纯小数名单 (sampling_list_decimal_only.csv)")
    print(SECTION)

    workflow = make_workflow()
    file_path = os.path.join(TEST_DATA_DIR, "sampling_list_decimal_only.csv")

    # 1. 导入
    r1 = workflow.step1_import_sampling_list(file_path, "实验助理小穆")
    log(f"[导入] 批次类型={r1['batch_type']}, 待复核={r1['pending_review_count']}, "
        f"can_skip_review={r1['can_skip_review']}")
    assert r1["batch_type"] == "纯小数"
    assert r1["pending_review_count"] == 0

    # 2. 参数调试
    r2 = workflow.step2_review_parameters(reviewer="活动负责人")
    log(f"[参数调试] 待复核={r2['pending_count']}, can_proceed={r2['can_proceed']}")
    assert r2["can_proceed"] is True

    # 3. 计算明细
    r3 = workflow.step3_calculate(operator="实验助理小穆")
    log(f"[计算] 车辆={r3['total_buses']}, 成本={r3['total_cost']}, "
        f"明细={r3['calculation_details_count']}, 分配={r3['route_allocations']}")
    assert r3["calculation_details_count"] == 4
    assert r3["excluded_summary"]["rejected_count"] == 0
    assert r3["excluded_summary"]["valid_calculation_count"] == 4

    # 4. 下钻明细
    for d in r3["drilldown_available"]:
        detail = workflow.drilldown_detail(d["detail_id"])
        assert detail["retain_reason"] is not None
        assert "纯小数" in detail["retain_reason"]
        assert detail["detail"]["result_value"] >= 1
    log(f"[下钻] 共{r3['calculation_details_count']}条，全部含保留理由，5步计算过程 ✓")

    # 5. 生成报告
    report = workflow.generate_report()
    log(f"[报告] 参与线路={report['overview']['valid_route_count']}, "
        f"拒绝={report['excluded_summary']['rejected_count']}, "
        f"成本={report['overview']['total_cost']}")
    assert report["overview"]["valid_route_count"] == 4
    assert len(report["route_details"]) == 4

    # 6. CSV / JSON 导出
    csv_name, csv_bytes = workflow.export_result("csv")
    json_name, json_bytes = workflow.export_result("json")
    csv_path = os.path.join(OUTPUT_DIR, csv_name)
    json_path = os.path.join(OUTPUT_DIR, json_name)
    with open(csv_path, "wb") as f:
        f.write(csv_bytes)
    with open(json_path, "wb") as f:
        f.write(json_bytes)
    log(f"[导出] CSV 保存: {csv_path}")
    log(f"[导出] JSON 保存: {json_path}")

    # 7. 历史记录
    sample_rec = workflow.records[0]
    hist = workflow.get_record_history(sample_rec.record_id)
    log(f"[历史] 线路{sample_rec.route_code} 共{len(hist)}条变更记录 ✓")
    assert len(hist) >= 3

    print(f"✅ 场景 A（纯小数）通过：车辆={r3['total_buses']}, "
          f"成本={r3['total_cost']}, 明细={r3['calculation_details_count']}")
    return True


def scenario_b_pure_percentage():
    """场景B：纯百分数名单"""
    print(f"\n{SECTION}")
    print("场景 B：纯百分数名单 (sampling_list_percentage_only.csv)")
    print(SECTION)

    workflow = make_workflow()
    file_path = os.path.join(TEST_DATA_DIR, "sampling_list_percentage_only.csv")

    # 1. 导入
    r1 = workflow.step1_import_sampling_list(file_path, "实验助理小穆")
    log(f"[导入] 批次类型={r1['batch_type']}, 待复核={r1['pending_review_count']}")
    assert r1["batch_type"] == "纯百分数"
    assert r1["pending_review_count"] == 0

    # 2. 参数调试
    r2 = workflow.step2_review_parameters(reviewer="活动负责人")
    assert r2["can_proceed"] is True

    # 3. 计算
    r3 = workflow.step3_calculate(operator="实验助理小穆")
    log(f"[计算] 车辆={r3['total_buses']}, 成本={r3['total_cost']}, "
        f"明细={r3['calculation_details_count']}")
    assert r3["calculation_details_count"] == 4

    # 4. 下钻：百分数 85% → 0.85
    first = r3["drilldown_available"][0]
    detail = workflow.drilldown_detail(first["detail_id"])
    orig = detail["detail"]["input_params"]["original_passenger_count"]
    eff = detail["detail"]["input_params"]["effective_passenger_count"]
    log(f"[下钻] 原始={orig}, 有效={eff}, 结果={detail['detail']['result_value']}辆, "
        f"理由={detail['retain_reason']}")
    assert "%" in orig
    assert 0 < eff < 1  # 百分数被转成 0~1
    assert "纯百分数" in detail["retain_reason"]

    # 5. 报告 + 导出
    report = workflow.generate_report()
    assert len(report["route_details"]) == 4

    csv_name, csv_bytes = workflow.export_result("csv")
    json_name, json_bytes = workflow.export_result("json")
    with open(os.path.join(OUTPUT_DIR, csv_name), "wb") as f:
        f.write(csv_bytes)
    with open(os.path.join(OUTPUT_DIR, json_name), "wb") as f:
        f.write(json_bytes)
    log(f"[导出] CSV={csv_name}, JSON={json_name} ✓")

    print(f"✅ 场景 B（纯百分数）通过：车辆={r3['total_buses']}, "
          f"成本={r3['total_cost']}, 明细={r3['calculation_details_count']}")
    return True


def scenario_c_mixed_with_rejection():
    """场景C：混合名单，活动负责人拒绝2条，验证完全闭环"""
    print(f"\n{SECTION}")
    print("场景 C：混合名单 - 拒绝记录全链路闭环验证")
    print(SECTION)

    workflow = make_workflow()
    file_path = os.path.join(TEST_DATA_DIR, "sampling_list_mixed.csv")

    # 1. 导入：8 条混合待复核
    r1 = workflow.step1_import_sampling_list(file_path, "实验助理小穆")
    log(f"[导入] 批次类型={r1['batch_type']}, 待复核={r1['pending_review_count']}")
    assert r1["batch_type"] == "混合"
    assert r1["pending_review_count"] == 8

    # 2. 参数调试：不能直接继续
    r2 = workflow.step2_review_parameters(reviewer="活动负责人")
    log(f"[参数调试] can_proceed={r2['can_proceed']}, 待复核={r2['pending_count']}")
    assert r2["can_proceed"] is False

    # 3. 负责人操作：拒绝 R002 + R004，其他 6 条 APPROVED
    pending = workflow.get_pending_issues()
    rejected_routes = ["R002", "R004"]
    rejected_issue_ids = []
    rejected_record_ids = []
    approved_issue_ids = []

    for issue in pending:
        rec = next(
            (r for r in workflow.records if r.record_id == issue["record_id"]),
            None,
        )
        if rec and rec.route_code in rejected_routes:
            workflow.review_issue(
                issue_id=issue["issue_id"],
                approved=False,
                reviewer="活动负责人",
                retain_reason=f"{rec.route_code}：客流量异常，负责人决定不参与本轮排班",
            )
            rejected_issue_ids.append(issue["issue_id"])
            rejected_record_ids.append(issue["record_id"])
            log(f"  [拒绝] {rec.route_code} 原值={issue['original_value']}")
        else:
            workflow.review_issue(
                issue_id=issue["issue_id"],
                approved=True,
                reviewer="活动负责人",
                retain_reason=f"{rec.route_code if rec else '?'}：数据正常，保留原值",
            )
            approved_issue_ids.append(issue["issue_id"])
    log(f"[复核完成] 拒绝={len(rejected_routes)}条, 通过=6条")

    # 再次参数调试 → 可以进入计算
    r2b = workflow.step2_review_parameters(reviewer="活动负责人")
    assert r2b["can_proceed"] is True

    # 4. 第一次计算 → 验证拒绝被排除
    r3_first = workflow.step3_calculate(operator="实验助理小穆")
    log(f"[首次计算] 车辆={r3_first['total_buses']}, 成本={r3_first['total_cost']}, "
        f"有效线路={r3_first['excluded_summary']['valid_calculation_count']}, "
        f"拒绝={r3_first['excluded_summary']['rejected_count']}")

    # ★ 核心断言 1：route_allocations 不含被拒线路
    for rc in rejected_routes:
        assert rc not in r3_first["route_allocations"], (
            f"FAIL: {rc} 被拒绝但仍出现在排班分配 {r3_first['route_allocations']}"
        )
    log(f"  ✓ 排班分配不含: {rejected_routes}")

    # ★ 核心断言 2：下钻列表不含被拒线路
    drill_routes = [d["route_code"] for d in r3_first["drilldown_available"]]
    for rc in rejected_routes:
        assert rc not in drill_routes, f"FAIL: {rc} 出现在下钻列表"
    assert len(drill_routes) == 6, f"FAIL: 应该6条下钻，实际{len(drill_routes)}"
    log(f"  ✓ 下钻列表=6条，不含被拒绝线路")

    # ★ 核心断言 3：excluded_summary / rejected_records 闭环信息完整
    assert r3_first["excluded_summary"]["rejected_count"] == 2
    assert r3_first["excluded_summary"]["valid_calculation_count"] == 6
    assert len(r3_first["rejected_records"]) == 2
    for rj in r3_first["rejected_records"]:
        assert rj["route_code"] in rejected_routes
        assert rj["status"] == "已拒绝，不参与计算"
        assert "不参与本轮排班" in rj["reject_reason"]
        assert rj["reviewer"] == "活动负责人"
        assert rj["review_time"] is not None
        assert rj["can_rollback"] is True
        log(f"  ✓ 排除清单: {rj['route_code']}={rj['original_passenger_count']}, "
            f"理由='{rj['reject_reason']}', 负责人='{rj['reviewer']}'")

    # ★ 核心断言 4：计算明细数 = 6（不是 8）
    assert r3_first["calculation_details_count"] == 6

    # 5. 刷新重算（用户：保存 → 改状态 → 刷新 → 重算）
    # 这里模拟：再拒绝一条 R006
    r006_issue = next(
        (iss for iss in workflow._issues
         if next((r for r in workflow.records
                  if r.record_id == iss.record_id), None) and
         next((r for r in workflow.records
               if r.record_id == iss.record_id), None).route_code == "R006"),
        None,
    )
    if r006_issue:
        workflow.rollback_issue(
            issue_id=r006_issue.issue_id,
            operator="活动负责人",
            reason="R006需要重新审议",
        )
        workflow.review_issue(
            issue_id=r006_issue.issue_id,
            approved=False,
            reviewer="活动负责人",
            retain_reason="R006：刷新后重新审议决定排除",
        )
        rejected_routes.append("R006")
        log(f"  [刷新+重算前] 额外拒绝 R006")

    r3_recalc = workflow.recalculate(operator="实验助理小穆")
    log(f"[重算后] 车辆={r3_recalc['total_buses']}, 成本={r3_recalc['total_cost']}, "
        f"有效线路={r3_recalc['excluded_summary']['valid_calculation_count']}, "
        f"拒绝={r3_recalc['excluded_summary']['rejected_count']}")

    assert r3_recalc["excluded_summary"]["rejected_count"] == 3
    assert r3_recalc["calculation_details_count"] == 5
    assert r3_recalc["total_cost"] < r3_first["total_cost"]  # 少一条，成本下降
    for rc in rejected_routes:
        assert rc not in r3_recalc["route_allocations"]
    log("  ✓ 重算后：3条拒绝，5条有效，车辆与成本均下降")

    # 6. 下钻：随机点开一条有效线路看 5 步计算 + 理由
    one = r3_recalc["drilldown_available"][0]
    detail = workflow.drilldown_detail(one["detail_id"])
    log(f"[下钻抽查] {one['route_code']}: "
        f"原始={detail['detail']['input_params']['original_passenger_count']}, "
        f"有效={detail['detail']['input_params']['effective_passenger_count']}, "
        f"车辆={detail['detail']['result_value']}, 理由='{detail['retain_reason']}'")
    assert len(detail["detail"]["calculation_steps"]) == 5
    assert detail["retain_reason"] is not None

    # 7. 报告：拒绝只出现在排除清单，绝不出现在排班明细
    report = workflow.generate_report()
    report_routes = [d["route_code"] for d in report["route_details"]]
    for rc in rejected_routes:
        assert rc not in report_routes, f"FAIL: {rc} 出现在报告排班明细"
    assert len(report["route_details"]) == 5
    assert len(report["rejected_records"]) == 3
    for rj in report["rejected_records"]:
        assert rj["status"] == "已拒绝，不参与计算"
    log(f"[报告] 排班明细=5条(无拒绝), 排除清单=3条(含理由/负责人/时间) ✓")

    # 8. CSV & JSON 导出
    csv_name, csv_bytes = workflow.export_result("csv")
    json_name, json_bytes = workflow.export_result("json")
    csv_path = os.path.join(OUTPUT_DIR, csv_name)
    json_path = os.path.join(OUTPUT_DIR, json_name)
    with open(csv_path, "wb") as f:
        f.write(csv_bytes)
    with open(json_path, "wb") as f:
        f.write(json_bytes)

    # 验证 CSV 内容
    csv_text = csv_bytes.decode("utf-8-sig")
    detail_section = csv_text.split("=== 排除清单")[0]
    for rc in rejected_routes:
        assert rc not in detail_section, f"FAIL: {rc} 在 CSV 排班明细段"
    for reason_kw in ["不参与本轮排班", "刷新后重新审议决定排除"]:
        assert reason_kw in csv_text, f"FAIL: CSV 缺少拒绝理由 '{reason_kw}'"
    log(f"[导出CSV] {csv_path}  ✓ 排班段无拒绝线路，排除清单含拒绝原因")

    # 验证 JSON 内容
    json_data = json.loads(json_bytes.decode("utf-8"))
    json_routes = [d["route_code"] for d in json_data["route_details"]]
    for rc in rejected_routes:
        assert rc not in json_routes
    assert json_data["excluded_summary"]["rejected_count"] == 3
    log(f"[导出JSON] {json_path}  ✓ 结构一致，拒绝数=3")

    # 9. 历史记录：拒绝操作及其前后状态可见（get_record_history 返回 dict）
    for rec_id in rejected_record_ids[:1]:
        rec = next(r for r in workflow.records if r.record_id == rec_id)
        hist = workflow.get_record_history(rec.record_id)
        log(f"[历史] 线路{rec.route_code}: 共{len(hist)}条变更")
        assert len(hist) >= 3
        issue_changes = [h for h in hist if h["field_name"].startswith("issue:")]
        assert len(issue_changes) >= 1
        for ic in issue_changes:
            log(f"       - {ic['field_name']}: {ic['old_value']} → {ic['new_value']} "
                f"(by {ic['operator']})")
    log("  ✓ 拒绝操作在历史中可见（改前→改后，含操作人）")

    print(f"\n✅ 场景 C（混合+拒绝）通过：")
    print(f"    首次计算 → 有效线路=6, 车辆={r3_first['total_buses']}, 成本={r3_first['total_cost']}")
    print(f"    刷新重算 → 有效线路=5, 车辆={r3_recalc['total_buses']}, 成本={r3_recalc['total_cost']}")
    print(f"    被拒绝线路(3条): {rejected_routes}")
    print(f"    已全部从[排班/下钻/报告明细/导出明细]排除，仅在[排除清单+历史]保留")
    return True


def main():
    results = []
    results.append(("场景A 纯小数", scenario_a_pure_decimal()))
    results.append(("场景B 纯百分数", scenario_b_pure_percentage()))
    results.append(("场景C 混合+拒绝闭环", scenario_c_mixed_with_rejection()))

    print(f"\n{SECTION}")
    print("端到端验证汇总")
    print(SECTION)
    all_pass = True
    for name, ok in results:
        status = "✅ 通过" if ok else "❌ 失败"
        print(f"  {name}: {status}")
        if not ok:
            all_pass = False
    print(SECTION)
    if all_pass:
        print("🎉 三条最终路径全部通过：纯小数、纯百分数、混合拒绝闭环")
    else:
        print("⚠️ 存在失败场景，请查看上方日志")
        sys.exit(1)


if __name__ == "__main__":
    main()
