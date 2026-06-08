import json
import sys
from processor import RecordProcessor
from models import RecordStatus, STATUS_LABEL_CN


TARGET_RECORD_ID = 3


def print_section(title):
    print("\n" + "=" * 100)
    print(f"  {title}")
    print("=" * 100)


def print_sub(title):
    print("\n" + "-" * 80)
    print(f"  {title}")
    print("-" * 80)


def print_row(p, record_id, step_tag):
    row = None
    for h in p.get_processing_history():
        if h["record_id"] == record_id:
            row = h
            break
    if not row:
        return
    print(f"[{step_tag}] 列表行 编号{row['record_id']}: {row['date']} | "
          f"状态={row['status']}({row['status_label']}) | "
          f"预测值={row['predicted']} 原值={row['original_predicted']} | "
          f"断档={row['has_gap']} 冲突={row['has_conflict']} | "
          f"版本={row['version']}")
    if row["notes"]:
        print(f"         备注: {row['notes']}")


def print_detail_summary(p, record_id, step_tag):
    d = p.get_record_detail(record_id)
    if not d:
        return
    b = d["basic"]
    print(f"[{step_tag}] 详情 编号{record_id}:")
    print(f"         状态变迁次数: {len(d['state_history'])} 次")
    if d["state_history"]:
        last = d["state_history"][-1]
        print(f"         最新变迁: {last['from']} → {last['to']} 操作人={last['operator']}")
        print(f"         原值={last['original_value']} 改值={last['new_value']}")
        print(f"         下一步找谁: {last['next_handler']}")
        print(f"         原因: {last['reason'][:50]}")
    if d["review_info"]["original_statement"]:
        ri = d["review_info"]
        print(f"         [复核信息] 原始说法: {ri['original_statement'][:40]}")
        print(f"                      改后值: {ri['corrected_value']} 原因: {ri['processing_reason'][:40]}")
        print(f"                      下一步找谁: {ri['next_handler']} 复核人: {ri['reviewed_by']}")


def print_summary_counter(p, step_tag):
    s = p.get_summary()
    print(f"[{step_tag}] 摘要 总数={s['total_records']} 断档={s['gap_count']} "
          f"冲突={s['conflict_count']} 暂停={s['paused_count']} "
          f"待教研复核={s['need_teaching_review']} 待运营确认={s['need_operation_review']}")
    print(f"         参数版本={s['active_parameter_version']} lambda={s['active_lambda']}")


def check_consistency(p, step_tag):
    vp = p.get_parameter_version_page()
    cc = vp["consistency_check"]
    issues = "✓一致" if not cc["has_issues"] else f"✗有问题:{cc['issues']}"
    print(f"[{step_tag}] 参数版本页vs历史记录 一致性: {issues} "
          f"(检查{cc['records_checked']}条记录/{cc['total_parameter_versions']}个版本)")


def demo_poisson_prediction():
    p = RecordProcessor()

    print_section("【泊松到店人数预测】编号3全链路复现"
                  "（导入→删行断档→手算冲突→暂停→教研组复核→续局→运营决策→版本更新→导出报告）")

    # ================= 第一步：参数调试表第一次导入 =================
    print_section("第一步：参数调试表第一次导入（正常材料）")
    normal_data = [
        {"date": "2026-06-01", "store_id": "S001", "predicted_foot_traffic": 156.3, "poisson_lambda": 150.0},
        {"date": "2026-06-02", "store_id": "S001", "predicted_foot_traffic": 172.5, "poisson_lambda": 165.0},
        {"date": "2026-06-03", "store_id": "S001", "predicted_foot_traffic": 148.7, "poisson_lambda": 145.0},
        {"date": "2026-06-04", "store_id": "S001", "predicted_foot_traffic": 189.2, "poisson_lambda": 180.0},
    ]
    p.import_parameter_sheet(normal_data, "数据组小明")
    print("导入 4 条正常记录（编号1~4）")

    print_sub("【视图联动】列表+详情+摘要+一致性")
    print_row(p, TARGET_RECORD_ID, "列表")
    print_detail_summary(p, TARGET_RECORD_ID, "详情")
    print_summary_counter(p, "摘要")
    check_consistency(p, "一致")

    # ================= 第二步：人工删除编号2，触发编号3断档 =================
    print_section("第二步：人工删除编号2，编号3出现断档（保留异常给教研组，不归正常）")
    deleted = p.simulate_manual_deletion(2, "运营阿岚")
    print(f"人工删除编号 2: {'成功' if deleted else '失败'}")
    p.mark_gap_records("系统检测")

    print(f"\n检测到编号断档: {p.detect_id_gaps()}")
    print("⚠ 编号3保留 gap_detected 状态，不自动归正常，留给教研组张老师复核")

    print_sub("【视图联动】列表+详情+摘要+一致性（断档标记全部同步）")
    print_row(p, TARGET_RECORD_ID, "列表")
    print_detail_summary(p, TARGET_RECORD_ID, "详情")
    print_summary_counter(p, "摘要")
    check_consistency(p, "一致")

    # ================= 第三步：手算反例录入，编号3又多一条冲突 =================
    print_section("第三步：运营规划阿岚补看手算反例，编号3出现参数值vs手算值冲突")
    hand_calc_data = [
        {"date": "2026-06-03", "store_id": "S001", "manual_value": 165.0,
         "formula_used": "旧口径：上周同期*1.1"},
    ]
    for calc in hand_calc_data:
        p.add_hand_calculation(calc, "运营阿岚")

    conflicts = p.check_conflicts()
    print(f"\n冲突检测发现 {len(conflicts)} 处矛盾（全部挂在编号3上）:")
    for cf in conflicts:
        print(f"  {cf.conflict_id}: 参数调试表={cf.parameter_value} vs 手算反例={cf.hand_calc_value}")
        print(f"  → 系统只列出证据，不自动拍板，请运营规划阿岚确认或驳回")

    print_sub("【视图联动】列表+详情+摘要+一致性（冲突标记同步）")
    print_row(p, TARGET_RECORD_ID, "列表")
    print_detail_summary(p, TARGET_RECORD_ID, "详情")
    print_summary_counter(p, "摘要")
    check_consistency(p, "一致")

    # ================= 第四步：暂停编号3 =================
    print_section("第四步：暂停编号3处理（教研组张老师暂不在，先挂起）")
    paused = p.pause_record(
        TARGET_RECORD_ID,
        "运营阿岚",
        "教研组张老师外出培训，待回岗后复核断档，冲突一并延后处理"
    )
    print(f"暂停编号3: {'成功' if paused else '失败'}")

    print_sub("【视图联动】列表+详情+摘要+一致性（暂停状态同步）")
    print_row(p, TARGET_RECORD_ID, "列表")
    print_detail_summary(p, TARGET_RECORD_ID, "详情")
    print_summary_counter(p, "摘要")
    check_consistency(p, "一致")

    # ================= 第五步：教研组回来，续局 + 复核 =================
    print_section("第五步：教研组张老师回岗，续局编号3 + 复核断档")
    resumed = p.resume_record(
        TARGET_RECORD_ID,
        "运营阿岚",
        "教研组张老师回岗，解除暂停，恢复至冲突待运营确认状态"
    )
    print(f"续局编号3: {'成功' if resumed else '失败'}")

    print_sub("教研组复核（保留原始说法、改后值、处理原因、下一步找谁，不提前归正常）")
    reviewed = p.teaching_review_record(
        record_id=TARGET_RECORD_ID,
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
    print(f"教研组复核编号3: {'成功' if reviewed else '失败'}")

    print_sub("【视图联动】列表+详情+摘要+一致性（复核信息同步）")
    print_row(p, TARGET_RECORD_ID, "列表")
    print_detail_summary(p, TARGET_RECORD_ID, "详情")
    print_summary_counter(p, "摘要")
    check_consistency(p, "一致")

    # ================= 第六步：运营规划阿岚对CF-001做确认 =================
    print_section("第六步：运营规划阿岚处理CF-001冲突（列出证据→人工确认，系统不自动拍板）")
    print_sub("先列出冲突证据（编号3）")
    for cf in p.conflicts:
        if cf.record_id == TARGET_RECORD_ID:
            print(f"  冲突ID: {cf.conflict_id}")
            print(f"  参数调试表值(最新校准泊松λ=145得出): {cf.parameter_value}")
            print(f"  手算反例值(旧口径上周同期*1.1): {cf.hand_calc_value}")
            print(f"  差异: {abs(cf.parameter_value - cf.hand_calc_value):.2f}")
            print(f"  关联手算反例: {cf.hand_calc_id}")
            print()

    print("请运营规划阿岚选择: [A]确认(采用参数值)  [B]驳回(采用手算值)")
    print("  A: 新泊松λ=145是用5月全月数据校准的，更符合近期到店规律；旧口径*1.1忽略了端午节假日效应")
    print("  B: HC-001是门店店长手工点算3小时样本推算的，实际值更可信")
    choice = "A"
    print(f"  → 模拟阿岚选择: {choice} 确认采用参数调试表值")

    resolved = p.resolve_conflict(
        "CF-001",
        "confirm" if choice == "A" else "reject",
        "运营阿岚",
        "新泊松λ=145基于5月31天实际数据校准，旧口径*1.1忽略端午节假日效应故予以剔除"
    )
    print(f"冲突处理: {'成功' if resolved else '失败'}")

    print_sub("【视图联动】列表+详情+摘要+一致性（确认结果同步）")
    print_row(p, TARGET_RECORD_ID, "列表")
    print_detail_summary(p, TARGET_RECORD_ID, "详情")
    print_summary_counter(p, "摘要")
    check_consistency(p, "一致")

    # ================= 第七步：补录旧口径 =================
    print_section("第七步：补录旧口径记录（来自手算反例，与正常口径v2.0区分）")
    old_caliber_data = {
        "date": "2026-05-28",
        "store_id": "S001",
        "predicted_foot_traffic": 132.0,
        "poisson_lambda": 128.0,
        "version": "v0.9-old",
        "previous_version": "v0.8"
    }
    p.import_old_caliber_record(old_caliber_data, "运营阿岚")

    print_sub("【视图联动】列表+摘要+一致性（旧口径独立状态）")
    print_row(p, 5, "列表")
    print_summary_counter(p, "摘要")
    check_consistency(p, "一致")

    # ================= 第八步：参数版本页更新 =================
    print_section("第八步：参数版本页更新（关联编号3，记录λ取舍理由、创建人、生效日期）")
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
        related_record_ids=[TARGET_RECORD_ID],
        tradeoff_note=("专业判断取舍：泊松λ=145拟合R²=0.87 > 旧口径*1.1的R²=0.62；"
                       "保留编号3 gap_detected 至月底教研组例会")
    )

    vp = p.get_parameter_version_page()
    print(f"  参数版本页: 活跃版本={vp['active_version'].version} "
          f"λ={vp['active_version'].lambda_value} 生效日={vp['active_version'].effective_date}")
    print(f"  创建人={vp['active_version'].created_by} 原因={vp['active_version'].reason[:50]}...")
    print(f"  关联记录: {vp['related_records']}")

    print_sub("【视图联动】参数版本页vs历史记录一致性")
    check_consistency(p, "版本一致")
    print_summary_counter(p, "摘要")

    # ================= 第九步：全量视图核查 =================
    print_section("第九步：列表 + 详情(编号3) + 摘要 + 历史 + 导出/报告 全量核查")

    print_sub("【A】历史记录列表")
    headers = ["编号", "日期", "状态(中)", "预测值", "原值", "断档", "冲突", "版本", "下一步找谁"]
    print(" | ".join(f"{h:<10}" for h in headers))
    print("-" * 110)
    for h in p.get_processing_history():
        next_h = h["review_next_handler"] or (
            p.get_record_detail(h["record_id"])["state_history"][-1]["next_handler"]
            if p.get_record_detail(h["record_id"])["state_history"] else ""
        )
        print(f"{h['record_id']:<10} | {h['date']:<10} | {h['status_label']:<12} | "
              f"{h['predicted']:<8.1f} | {h['original_predicted']:<8.1f} | "
              f"{'是' if h['has_gap'] else '否':<6} | {'是' if h['has_conflict'] else '否':<6} | "
              f"{h['version']:<8} | {next_h[:20]}")

    print_sub("【B】编号3完整详情（状态链 + 冲突 + 复核信息 + 日志）")
    d3 = p.get_record_detail(TARGET_RECORD_ID)
    print(f"  基本: 编号{d3['basic']['record_id']} {d3['basic']['date']} "
          f"状态={d3['basic']['status']}({d3['basic']['status_label']})")
    print(f"  断档信息: {d3['gap_info']}")
    print(f"  冲突: {[(c['conflict_id'], c['parameter_value'], c['hand_calc_value'], c['resolution']) for c in d3['conflicts']]}")
    print(f"  手算反例: {[(h['calc_id'], h['manual_value']) for h in d3['hand_calculations']]}")
    print(f"  状态变迁链 (共{len(d3['state_history'])}步):")
    for sc in d3["state_history"]:
        print(f"    Step{sc['step']:>2}. {sc['from']:<18} → {sc['to']:<18} "
              f"| 操作人={sc['operator']:<8} 下一步={sc['next_handler']}")
        print(f"           原因: {sc['reason'][:60]}")
        if sc["original_value"] is not None or sc["new_value"] is not None:
            print(f"           原值={sc['original_value']} → 改值={sc['new_value']}")
    print(f"  复核信息: 原始说法={d3['review_info']['original_statement'][:50]}...")
    print(f"           改后值={d3['review_info']['corrected_value']} "
          f"原因={d3['review_info']['processing_reason'][:40]}...")
    print(f"           下一步找谁={d3['review_info']['next_handler']} "
          f"复核人={d3['review_info']['reviewed_by']}")

    print_sub("【C】摘要")
    s = p.get_summary()
    print(json.dumps(s, ensure_ascii=False, indent=4))

    print_sub("【D】导出 (CSV 首3行)")
    csv_text = p.export_to_csv()
    lines = csv_text.strip().split("\n")[:3]
    for line in lines:
        print("  " + line[:140] + ("..." if len(line) > 140 else ""))

    print_sub("【E】报告 待处理项")
    report = p.get_report()
    for item in report["pending_items"]:
        print(f"  编号{item['record_id']} 状态={item['status_label']} "
              f"下一步找谁={item['next_handler']} 说明={item['issue'][:50]}")

    # ================= 一致性最终核对 =================
    print_section("第十步：一致性最终核对（参数版本页 ↔ 历史记录 ↔ 详情 同一份数据）")

    check_consistency(p, "最终一致")
    vp = p.get_parameter_version_page()
    d3 = p.get_record_detail(TARGET_RECORD_ID)
    hist = [h for h in p.get_processing_history() if h["record_id"] == TARGET_RECORD_ID][0]

    print(f"\n  三个视图的【预测值】对比:")
    print(f"    参数版本页 关联记录[编号3]最终值: "
          f"{[r['final_predicted'] for r in vp['related_records'] if r['record_id'] == TARGET_RECORD_ID]}")
    print(f"    历史记录列表 编号3预测值: {hist['predicted']}")
    print(f"    详情页 编号3预测值: {d3['basic']['predicted']}")

    print(f"\n  三个视图的【状态】对比:")
    print(f"    参数版本页 关联记录[编号3]状态: "
          f"{[r['status_label'] for r in vp['related_records'] if r['record_id'] == TARGET_RECORD_ID]}")
    print(f"    历史记录列表 编号3状态: {hist['status_label']}")
    print(f"    详情页 编号3状态: {d3['basic']['status_label']}")

    print(f"\n  ⚠ 编号3仍然保留【断档痕迹】(has_gap={hist['has_gap']})，未提前归正常")
    print(f"    教研组复核意见已保留在 review_info 中，月底例会再议是否补号")

    # ================= 三种记录类型总结 =================
    print_section("附：三种处理结果对比（原演示保留）")
    print("1. ✅ 顺利记录(编号1,4):  status=normal  断档=否 冲突=否 版本=v1.0")
    print("2. ⚠ 编号断档记录(编号3): status=confirmed 断档=是 冲突=是(已确认) → 断档标记保留至月底，不归normal")
    print("3. 📋 旧口径补录(编号5):  status=old_caliber  版本=v0.9-old，独立口径不混入v2.0")

    print_section("流程演示完成 ✔")
    return 0


if __name__ == "__main__":
    sys.exit(demo_poisson_prediction())
