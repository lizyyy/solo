import json
import sys
from processor import RecordProcessor
from models import RecordStatus, STATUS_LABEL_CN


def assert_equal(actual, expected, field):
    if actual != expected:
        raise AssertionError(f"❌ [{field}] 期望={expected}, 实际={actual}")
    print(f"✓ [{field}] {actual}")


def assert_contains(container, item, field):
    container_str = str(container)
    if item not in container_str:
        raise AssertionError(f"❌ [{field}] 预期包含'{item}'，实际={container_str[:200]}")
    print(f"✓ [{field}] 包含'{item}'")


def run_record3_e2e():
    print("\n" + "=" * 100)
    print("  泊松到店人数预测 - 编号3断档+冲突全链路 E2E 测试")
    print("  (打开项目 → 导入参数表 → 删行 → 断档 → 手算反例 → 冲突 → 暂停 → 续局 →")
    print("   教研复核 → 运营确认 → 参数版本 → 刷新 → 重算 → 导出报告)")
    print("=" * 100 + "\n")

    print("【Step 0】打开项目 - 初始化 RecordProcessor")
    p = RecordProcessor()
    assert_equal(len(p.records), 0, "记录数")
    assert_equal(len(p.parameter_versions), 0, "参数版本数")
    print()

    print("【Step 1】导入参数调试表（编号1-4）")
    normal_data = [
        {"date": "2026-06-01", "store_id": "S001", "predicted_foot_traffic": 156.3, "poisson_lambda": 150.0},
        {"date": "2026-06-02", "store_id": "S001", "predicted_foot_traffic": 172.5, "poisson_lambda": 165.0},
        {"date": "2026-06-03", "store_id": "S001", "predicted_foot_traffic": 148.7, "poisson_lambda": 145.0},
        {"date": "2026-06-04", "store_id": "S001", "predicted_foot_traffic": 189.2, "poisson_lambda": 180.0},
    ]
    p.import_parameter_sheet(normal_data, "数据组小明")
    r3 = p._find_record(3)
    assert_equal(r3.status, RecordStatus.NORMAL, "编号3初始状态")
    assert_equal(r3.predicted_foot_traffic, 148.7, "编号3初始预测值")
    print()

    print("【Step 2】人工删除编号2行 → 触发编号3断档")
    p.simulate_manual_deletion(2, "运营阿岚")
    p.mark_gap_records("系统检测")
    assert_equal(p.detect_id_gaps(), [(1, 3)], "检测到断档")
    assert_equal(r3.status, RecordStatus.GAP_DETECTED, "编号3断档状态")
    assert_equal(r3.gap_info["gap_start"], 1, "断档起点")
    assert_equal(r3.gap_info["gap_end"], 3, "断档终点")
    assert_contains(p._get_current_next_handler(r3), "教研组张老师", "next_handler")
    print()

    print("【Step 3】补录手算反例 HC-001（6月3日）→ 冲突检测")
    p.add_hand_calculation(
        {"date": "2026-06-03", "store_id": "S001", "manual_value": 165.0,
         "formula_used": "旧口径：上周同期*1.1"},
        "运营阿岚"
    )
    conflicts = p.check_conflicts()
    assert_equal(len(conflicts), 1, "冲突数量")
    assert_equal(conflicts[0].conflict_id, "CF-001", "冲突ID")
    assert_equal(conflicts[0].parameter_value, 148.7, "冲突参数值")
    assert_equal(conflicts[0].hand_calc_value, 165.0, "冲突手算值")
    assert_equal(r3.status, RecordStatus.PENDING_REVIEW, "冲突待确认状态")
    assert_contains(p._get_current_next_handler(r3), "先复核断档，再处理冲突", "冲突后next_handler")
    print()

    print("【Step 4】暂停 → 续局（模拟张老师外出）")
    p.pause_record(3, "运营阿岚", "张老师外出培训")
    assert_equal(r3.status, RecordStatus.PAUSED, "暂停后状态")
    p.resume_record(3, "运营阿岚", "张老师回岗")
    assert_equal(r3.status, RecordStatus.PENDING_REVIEW, "续局后状态")
    assert_equal(len(r3.state_history), 5, "状态变迁步数≥5")
    print()

    print("【Step 5】教研组张老师复核编号3（断档复核）")
    p.teaching_review_record(
        record_id=3,
        operator="教研组张老师",
        original_statement=("编号2确系运营阿岚6月2日手工误删，删除前2026-06-02的预测值172.5，"
                           "编号3原始预测148.7无误，编号断档是操作导致的序列号跳跃，不是模型计算错误"),
        processing_reason=("经核查删除操作日志：MANUAL_DELETE 由阿岚于6月2日14:32执行，"
                           "原因是当时手算反例HC-001尚未录入，误以为编号2是多余行。"
                           "现决定保留编号3原值148.7，但断档标记继续保留至月底教研组例会再审议是否补号"),
        corrected_value=148.7,
        next_handler="运营规划阿岚（继续处理CF-001冲突，确认或驳回手算反例）",
        approve_gap=True
    )
    assert_equal(r3.status, RecordStatus.TEACHING_REVIEW, "教研复核中状态")
    assert_equal(r3.review_info.reviewed_by, "教研组张老师", "复核人")
    assert_equal(r3.review_info.corrected_value, 148.7, "复核改后值")
    assert_contains(r3.review_info.original_statement, "手工误删", "复核原始说法")
    assert_contains(r3.review_info.processing_reason, "月底教研组例会", "复核处理原因")
    print()

    print("【Step 6】运营规划阿岚确认CF-001（人工决策，系统不自动拍板）")
    # 先列出证据
    print("  冲突证据:")
    for cf in p.conflicts:
        if cf.record_id == 3:
            print(f"    冲突{cf.conflict_id}: 参数={cf.parameter_value} vs 手算={cf.hand_calc_value}, 差异={abs(cf.parameter_value - cf.hand_calc_value):.2f}")
    resolved = p.resolve_conflict(
        "CF-001",
        "confirm",
        "运营阿岚",
        "新泊松λ=145基于5月31天实际数据校准，旧口径*1.1忽略端午节假日效应故予以剔除"
    )
    assert_equal(resolved, True, "冲突处理成功")
    assert_equal(conflicts[0].resolution, "confirm", "冲突解决结果")
    assert_equal(r3.status, RecordStatus.CONFIRMED, "已确认状态")

    # ===== 核心断言：冲突确认后，next_handler应切到教研组月底复核补号 =====
    current_next = p._get_current_next_handler(r3)
    assert_contains(current_next, "月底教研组例会", "冲突确认后next_handler切到月底补号")
    assert_contains(current_next, "断档补号", "冲突确认后next_handler含断档补号")
    assert_equal(r3.gap_pending_review, True, "gap_pending_review=True")
    # notes追加了"月底例会再议"，没有覆盖原有内容
    assert_contains(r3.notes, "后续事项", "notes保留后续事项")
    assert_contains(r3.notes, "月底教研组例会再议", "notes含月底再议")
    print()

    print("【Step 7】刷新/重算 - 重新获取列表、详情、摘要（模拟用户刷新页面）")
    history_list = p.get_processing_history()
    r3_row = [h for h in history_list if h["record_id"] == 3][0]
    # 列表行
    assert_equal(r3_row["current_next_handler"], current_next, "列表current_next_handler")
    assert_equal(r3_row["gap_pending_review"], True, "列表gap_pending_review")
    assert_equal(r3_row["has_gap"], True, "列表has_gap仍为True")
    assert_equal(r3_row["conflict_resolved"], True, "列表conflict_resolved=True")
    # 详情
    detail = p.get_record_detail(3)
    assert_equal(detail["basic"]["current_next_handler"], current_next, "详情current_next_handler")
    # 摘要
    summary = p.get_summary()
    assert_equal(summary["need_teaching_review"], 1, "摘要need_teaching_review=1")
    assert_equal(summary["gap_pending_count"], 1, "摘要gap_pending_count=1")
    assert 3 in summary["gap_pending_record_ids"], "编号3在gap_pending_record_ids中"
    assert_contains(summary["need_teaching_reason"], "gap_pending_review=True",
                    "摘要need_teaching_reason含gap_pending_review")
    print()

    print("【Step 7.5】补录旧口径记录（编号5）")
    p.import_old_caliber_record({
        "date": "2026-05-28",
        "store_id": "S001",
        "predicted_foot_traffic": 132.0,
        "poisson_lambda": 128.0,
        "version": "v0.9-old",
        "previous_version": "v0.8"
    }, "运营阿岚")
    assert_equal(len(p.records), 4, "补录后总记录数")
    r5 = p._find_record(5)
    assert_equal(r5.status.value, "old_caliber", "编号5状态")
    print()

    print("【Step 8】创建参数版本页 v1.0、v2.0（关联编号3）")
    p.create_parameter_version(
        lambda_value=150.0,
        effective_date="2026-06-01",
        created_by="数据组小明",
        reason="6月首版：基于5月实际到店31天做极大似然估计λ=150",
        related_record_ids=[1, 4],
        tradeoff_note="当时CF-001手算反例尚未录入，版本不含端午修正"
    )
    p.create_parameter_version(
        lambda_value=148.7,
        effective_date="2026-06-05",
        created_by="运营阿岚",
        reason=("结合编号3确认结果CF-001：驳回旧口径*1.1，保留泊松λ=145对应的预测值148.7。"
                "教研组已复核断档，本月底再议是否补号"),
        related_record_ids=[3],
        tradeoff_note=("专业判断取舍：泊松λ=145拟合R²=0.87 > 旧口径*1.1的R²=0.62；"
                       "保留编号3 gap_detected 至月底教研组例会")
    )
    # 刷新后检查版本同步
    r3_updated = p._find_record(3)
    assert_equal(r3_updated.version, "v2.0", "编号3版本同步到v2.0")
    assert_equal(r3_updated.poisson_lambda, 148.7, "编号3lambda同步")
    vp = p.get_parameter_version_page()
    assert_equal(vp["consistency_check"]["has_issues"], False, "参数版本-历史一致性(无问题)")
    # 参数版本关联记录
    rel = [r for r in vp["related_records"] if r["record_id"] == 3][0]
    assert_equal(rel["final_predicted"], 148.7, "参数版本页关联记录预测值")
    assert_equal(rel["status_label"], "已确认", "参数版本页关联记录状态")
    print()

    print("【Step 9】6个出口核对（读取同一份底层数据）")
    print("  --- [出口1] 历史记录列表 ---")
    list_row = [h for h in p.get_processing_history() if h["record_id"] == 3][0]
    assert_equal(list_row["predicted"], 148.7, "列表预测值")
    assert_equal(list_row["status"], "confirmed", "列表状态")
    assert_equal(list_row["has_gap"], True, "列表has_gap")
    assert_equal(list_row["gap_pending_review"], True, "列表gap_pending_review")
    assert_contains(list_row["current_next_handler"], "月底教研组例会", "列表找谁")
    print("  ✓ 列表出口正确")

    print("\n  --- [出口2] 记录详情 ---")
    d = p.get_record_detail(3)
    assert_equal(d["basic"]["predicted"], 148.7, "详情预测值")
    assert_equal(d["basic"]["status_label"], "已确认", "详情状态")
    # 步数：normal→gap→pending→paused→resumed→pending→teaching→confirmed→milestone(冲突后补号)→v2.0里程碑 = 9步+
    assert len(d["state_history"]) >= 9, f"详情状态变迁步数≥9，实际={len(d['state_history'])}"
    print(f"✓ [详情状态变迁步数] {len(d['state_history'])} (≥9)")
    assert_equal(d["review_info"]["corrected_value"], 148.7, "详情复核改后值")
    assert_contains(d["review_info"]["next_handler"], "继续处理CF-001", "详情review_next_handler")
    assert_contains(d["basic"]["current_next_handler"], "月底教研组例会", "详情current_next_handler")
    print("  ✓ 详情出口正确")

    print("\n  --- [出口3] 摘要 ---")
    s = p.get_summary()
    assert_equal(s["total_records"], 4, "摘要总数")
    assert_equal(s["gap_count"], 1, "摘要gap_count")
    assert_equal(s["gap_pending_count"], 1, "摘要gap_pending_count")
    assert_equal(s["need_teaching_review"], 1, "摘要need_teaching_review")
    assert_equal(s["conflict_count"], 1, "摘要conflict_count")
    assert_equal(s["conflict_unresolved_count"], 0, "摘要conflict_unresolved_count")
    assert_equal(s["active_parameter_version"], "v2.0", "摘要参数版本")
    print("  ✓ 摘要出口正确")

    print("\n  --- [出口4] 历史明细 (state_history) ---")
    steps = [(sc["from"], sc["to"], sc["next_handler"]) for sc in d["state_history"]]
    # 必须包含这几步
    assert ("正常", "编号断档-待教研组复核", "教研组张老师") in steps, "缺断档步骤"
    assert ("编号断档-待教研组复核", "冲突待运营确认") in [(s[0], s[1]) for s in steps], "缺冲突步骤"
    assert ("教研组复核中", "已确认", "数据组更新参数版本页") in steps, "缺确认步骤"
    # 冲突确认后里程碑：next_handler切到月底补号
    mile = [s for s in d["state_history"] if "断档尚未闭环" in s.get("reason", "")]
    assert len(mile) >= 1, "缺FLOW_MILESTONE断档未闭环里程碑"
    assert "月底教研组例会" in mile[0]["next_handler"], "里程碑next_handler未切到月底"
    print("  ✓ 历史明细出口正确")

    print("\n  --- [出口5] 导出(CSV/JSON) ---")
    csv_text = p.export_to_csv()
    json_text = p.export_to_json()
    assert "current_next_handler" in csv_text, "CSV缺current_next_handler列"
    assert "gap_pending_review" in csv_text, "CSV缺gap_pending_review列"
    assert "148.7" in csv_text, "CSV缺编号3预测值"
    assert "月底教研组例会" in csv_text, "CSV缺月底再议找谁"
    exports = json.loads(json_text)
    r3_export = [e for e in exports if e["record_id"] == 3][0]
    assert_equal(r3_export["gap_pending_review"], True, "JSON gap_pending_review")
    assert_contains(r3_export["current_next_handler"], "月底教研组例会", "JSON current_next_handler")
    assert_equal(r3_export["status"], "confirmed", "JSON status")
    assert_equal(r3_export["has_gap"], True, "JSON has_gap")
    print("  ✓ 导出出口正确")

    print("\n  --- [出口6] 报告/待处理项 ---")
    report = p.get_report()
    pending = [item for item in report["pending_items"] if item["record_id"] == 3]
    assert_equal(len(pending), 1, "报告pending_items包含编号3")
    assert_contains(pending[0]["next_handler"], "月底教研组例会", "报告pending找谁")
    assert "断档待复核" in pending[0]["pending_type"], "报告pending_type含断档待复核"
    assert "断档待补号" in pending[0]["pending_type"], "报告pending_type含断档待补号"
    assert_equal(pending[0]["status"], "confirmed", "报告pending状态是confirmed（不因为已确认就从待办抹掉）")
    print("  ✓ 报告出口正确")

    print("\n【Step 10】一致性最终核对（三重视图同值）")
    vp = p.get_parameter_version_page()
    rel3 = [r for r in vp["related_records"] if r["record_id"] == 3][0]
    list3 = [h for h in p.get_processing_history() if h["record_id"] == 3][0]
    det3 = p.get_record_detail(3)
    exp3 = [e for e in json.loads(p.export_to_json()) if e["record_id"] == 3][0]

    print("  预测值对比:")
    print(f"    参数版本页: {rel3['final_predicted']}")
    print(f"    历史列表:   {list3['predicted']}")
    print(f"    详情页:     {det3['basic']['predicted']}")
    print(f"    导出JSON:   {exp3['predicted_foot_traffic']}")
    assert_equal(rel3["final_predicted"], 148.7, "参数版预测值")
    assert_equal(list3["predicted"], 148.7, "列表预测值")
    assert_equal(det3["basic"]["predicted"], 148.7, "详情预测值")
    assert_equal(exp3["predicted_foot_traffic"], 148.7, "导出预测值")

    print("\n  状态对比:")
    print(f"    参数版本页: {rel3['status_label']}")
    print(f"    历史列表:   {list3['status_label']}")
    print(f"    详情页:     {det3['basic']['status_label']}")
    print(f"    导出JSON:   {exp3['status_label']}")
    assert_equal(rel3["status_label"], "已确认", "参数版状态")
    assert_equal(list3["status_label"], "已确认", "列表状态")
    assert_equal(det3["basic"]["status_label"], "已确认", "详情状态")
    assert_equal(exp3["status_label"], "已确认", "导出状态")

    print("\n  next_handler 对比:")
    print(f"    历史列表:   {list3['current_next_handler'][:40]}...")
    print(f"    详情页:     {det3['basic']['current_next_handler'][:40]}...")
    print(f"    导出JSON:   {exp3['current_next_handler'][:40]}...")
    print(f"    报告pending:{pending[0]['next_handler'][:40]}...")
    assert "月底教研组例会" in list3["current_next_handler"]
    assert "月底教研组例会" in det3["basic"]["current_next_handler"]
    assert "月底教研组例会" in exp3["current_next_handler"]
    assert "月底教研组例会" in pending[0]["next_handler"]

    print("\n  断档标记对比:")
    print(f"    历史列表 has_gap={list3['has_gap']} gap_pending_review={list3['gap_pending_review']}")
    print(f"    详情页 has_gap={det3['basic']['has_gap']}")
    print(f"    导出JSON has_gap={exp3['has_gap']} gap_pending_review={exp3['gap_pending_review']}")
    assert_equal(list3["has_gap"], True, "列表has_gap未被抹掉")
    assert_equal(list3["gap_pending_review"], True, "列表gap_pending_review未被抹掉")
    assert_equal(det3["basic"]["has_gap"], True, "详情has_gap未被抹掉")
    assert_equal(exp3["has_gap"], True, "导出has_gap未被抹掉")
    assert_equal(exp3["gap_pending_review"], True, "导出gap_pending_review未被抹掉")

    print("\n" + "=" * 100)
    print("  ✅ 编号3断档+冲突全链路 E2E 测试通过")
    print("  7项关键字段验证：预测值/状态/next_handler/has_gap/gap_pending_review/历史明细/待办项")
    print("  6个出口联动：列表/详情/摘要/历史/导出/报告 读取同一份底层数据")
    print("  核心业务规则：已确认冲突不会把断档复核事项从后续处理里抹掉")
    print("=" * 100 + "\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(run_record3_e2e())
    except AssertionError as e:
        print(f"\n❌ E2E测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ E2E测试异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(2)
