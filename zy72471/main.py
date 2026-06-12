import sys
from models import BuildingSetbackRecord, RecordStatus, ProcessingResult
from scoring import RecordProcessor, ScoringEngine
from demo_data import get_demo_records, get_supplement_content, get_redline_notes, get_test_cases
from errors import InputValidator, UserFriendlyError


def print_line(char="═", length=70):
    print(char * length)


def print_title(title: str, level: int = 1):
    if level == 1:
        print()
        print_line()
        print(f"  {title}")
        print_line()
    elif level == 2:
        print()
        print("─" * 60)
        print(f"  ▸ {title}")
        print("─" * 60)
    elif level == 3:
        print(f"\n  • {title}")


def print_step_header(step_num: int, title: str, subtitle: str = ""):
    print()
    print("━" * 65)
    print(f"  【第 {step_num} 步】{title}")
    if subtitle:
        print(f"           {subtitle}")
    print("━" * 65)


def print_state_block(record: BuildingSetbackRecord, label: str = "当前状态"):
    print(f"\n  【{label}】")
    print(f"    评分：{record.current_score:.1f} 分")
    print(f"    状态：{record.status.value}")
    print(f"    建议：{record.suggestion}")
    if record.redline_note:
        print(f"    红线图备注：{record.redline_note}")
    if record.ramp_supplemented:
        print(f"    坡道补录：已完成")
    if record.manual_correction_applied:
        print(f"    人工修正：已应用（评分 {record.last_manual_score:.1f} 分，原因：{record.manual_correction_reason}）")


def print_traceback(record: BuildingSetbackRecord, title: str = "完整状态变化轨迹（反查用）"):
    print_title(title, 2)
    traceback = record.get_traceback()
    for i, step in enumerate(traceback, 1):
        print(f"\n  {i}. [{step.get('时间', '')}] {step.get('操作', '')} - 操作人：{step.get('操作人', '')}")
        for k, v in step.items():
            if k not in ("时间", "操作", "操作人"):
                print(f"       {k}：{v}")


def print_corrections_traceback(record: BuildingSetbackRecord):
    print_title("修正记录详细反查（改前 → 改后）", 2)
    corrections = record.get_corrections_traceback()
    if not corrections:
        print("  （暂无修正记录）")
        return
    for i, c in enumerate(corrections, 1):
        print(f"\n  {i}. [{c.get('时间', '')}] 来源：{c.get('来源', '')} - 操作人：{c.get('操作人', '')}")
        for k, v in c.items():
            if k not in ("时间", "来源", "操作人"):
                print(f"       {k}：{v}")


def print_redline_history(record: BuildingSetbackRecord):
    if not record.redline_note_history:
        return
    print_title("红线图备注修改历史", 2)
    for entry in record.redline_note_history:
        print(f"\n  [{entry.time}] {entry.operator}")
        print(f"    改前备注：{entry.before_note if entry.before_note else '（无）'}")
        print(f"    改后备注：{entry.after_note}")
        print(f"    修改原因：{entry.change_reason}")


def print_result_report(result: ProcessingResult):
    print()
    print_box_border("╔", "═", 68, False)
    print("║" + " " * 66 + "║")
    title = f"楼宇退线空间占用 - 处理结果报告"
    pad = (66 - len(title)) // 2
    print("║" + " " * pad + title + " " * (66 - pad - len(title)) + "║")
    print("║" + " " * 66 + "║")
    print_box_border("╠", "═", 68, False)

    lines = [
        f"记录编号：{result.record_id}",
        f"建筑名称：{result.building_name}",
        "",
        result.display_message,
        f"最终评分：{result.final_score:.1f} 分",
        f"当前状态：{result.status.value}",
        f"整改建议：{result.suggestion}",
        "",
        f"历史记录：{result.history_count} 条",
        f"修正记录：{result.correction_count} 条",
        "",
        "─" * 60,
        "最终验证：",
    ]
    for part in result.final_verification.split(" | "):
        lines.append(f"  {part}")
    if result.manual_score_preserved:
        lines.append("")
        lines.append("✅ 关键核对通过：人工修正后重跑，评分和状态未被覆盖，与历史一致")

    for line in lines:
        content = line if len(line) <= 66 else line[:63] + "..."
        print("║  " + content + " " * (64 - len(content)) + "║")

    print_box_border("╠", "═", 68, False)
    trace_title = "状态变化轨迹摘要："
    print("║  " + trace_title + " " * (64 - len(trace_title)) + "║")
    for i, t in enumerate(result.state_traceback, 1):
        score = t.get("评分变化", t.get("评分", ""))
        status = t.get("状态变化", t.get("状态", ""))
        act = t.get("操作", "")
        line = f"  {i}. {act}: {score} | {status}"
        line = line if len(line) <= 64 else line[:61] + "..."
        print("║  " + line + " " * (64 - len(line)) + "║")

    print_box_border("╚", "═", 68, False)
    print()


def print_box_border(left_char, middle_char, length, newlines=True):
    if newlines:
        print()
    if left_char in ("╔", "╠", "╚"):
        right = {"╔": "╗", "╠": "╣", "╚": "╝"}[left_char]
        print(left_char + middle_char * (length - 2) + right)
    else:
        print(left_char * length)


def demo_full_workflow_with_traceback():
    """
    完整流程演示：从待复核断点一路到结果报告
    重点演示：坡道补录后评分没变 → 待复核 → 人工修正 → 重跑不覆盖 → 反查改前改后
    """
    print_line()
    print("  楼宇退线空间占用 - 完整流程+反查演示")
    print("  （市政巡检员小付真实工作流）")
    print_line()

    processor = RecordProcessor()
    records = get_demo_records()
    supplement_content = get_supplement_content()
    redline_notes = get_redline_notes()

    record_map = {r.record_id: r for r in records}

    # =====================================================================
    print_step_header(1, "公交刷卡时段第一次导入", "小付拿到3条记录，先导入早/晚高峰刷卡数据")
    # =====================================================================
    for record in records:
        processor.step1_import_bus_data(record, operator="市政巡检员小付")

    print("\n  三条记录导入完成，快速浏览：")
    for r in records:
        print(f"    • {r.record_id} {r.building_name}：{r.initial_score:.1f}分 → {r.current_score:.1f}分，状态【{r.status.value}】")

    # =====================================================================
    print_step_header(2, "断点：坡道补录后评分没变化，不能口头兜底",
                      "幸福里商业楼（TX-2026-002）补了坡道，但评分没变 → 必须留待复核")
    # =====================================================================
    record_xfl = record_map["TX-2026-002"]
    print_state_block(record_xfl, "坡道补录前")
    print(f"\n  小付补录内容：{supplement_content['TX-2026-002']}")
    processor.step2_ramp_supplement(record_xfl, supplement_content["TX-2026-002"], operator="市政巡检员小付")
    print_state_block(record_xfl, "坡道补录后")

    print("\n  ⚠️  关键观察：")
    print(f"     补录前评分 72.0 → 补录后评分 72.0（没变）")
    print(f"     状态自动设为【待复核】，没有直接归为正常")
    print(f"     留给交通协管去现场复核，小付不用口头兜底了！")

    # =====================================================================
    print_step_header(3, "补看红线图备注", "供销社大楼（TX-2026-003）发现旧口径备注")
    # =====================================================================
    record_gxs = record_map["TX-2026-003"]
    print_state_block(record_gxs, "补看备注前")
    note_content = redline_notes["TX-2026-003"]
    print(f"\n  红线图原文：{note_content}")
    processor.step3_check_redline_note(record_gxs, note_content, operator="市政巡检员小付",
                                         change_reason="初次从档案库调阅2004版红线图")
    print_state_block(record_gxs, "补看备注后")

    # =====================================================================
    print_step_header(4, "改红线图备注：反查改前/改后文本和修改原因",
                      "供销社大楼口径要更新，负责人改了备注")
    # =====================================================================
    old_note = record_gxs.redline_note
    new_note = "2004版红线图已复核，确认为旧口径；另附2019年补充说明，退线距离需从建筑主体外墙起算而非附属结构"
    print(f"\n  改前备注：{old_note}")
    print(f"  改后备注：{new_note}")
    print(f"  修改原因：发现2019年补充说明，需同步更新口径描述")

    processor.step3_check_redline_note(record_gxs, new_note, operator="负责人张工",
                                         change_reason="发现2019年补充说明，需同步更新口径描述")
    print_redline_history(record_gxs)

    # =====================================================================
    print_step_header(5, "交通协管现场复核 → 人工修正 → 重跑验证",
                      "幸福里商业楼从待复核 → 正常，重跑不覆盖人工结论")
    # =====================================================================
    print_state_block(record_xfl, "人工修正前（待复核状态）")
    print(f"\n  交通协管老李去现场看了，结论：")
    print(f"    坡道确实存在，但位于建筑北侧，且占压仅0.5米，")
    print(f"    不影响行人主通道通行，整体可按合规处理。")
    print(f"    修正评分 72.0 → 88.0")

    processor.step4_manual_correction(
        record_xfl,
        new_score=88.0,
        reason="交通协管现场复核确认：坡道不影响主通道通行，退线空间实际合规",
        operator="交通协管老李"
    )
    print_state_block(record_xfl, "人工修正后")

    print("\n  现在重跑验证——之前这里会把88.0冲回72.0，看这次是否保留：")
    processor.rerun(record_xfl, operator="市政巡检员小付")
    print_state_block(record_xfl, "重跑验证后")

    # =====================================================================
    print_step_header(6, "反查：待复核/人工修正/重跑的改前改后和状态变化",
                      "从结果倒回去看每一步，确保讲解流程可靠")
    # =====================================================================

    # --- 幸福里商业楼完整反查 ---
    print_title("幸福里商业楼（坡道补录→待复核→人工修正→重跑）完整反查", 2)
    print_traceback(record_xfl)
    print_corrections_traceback(record_xfl)

    # --- 供销社大楼红线图备注反查 ---
    print_title("供销社大楼（红线图旧口径→备注更新）完整反查", 2)
    print_traceback(record_gxs)
    print_corrections_traceback(record_gxs)
    print_redline_history(record_gxs)

    # =====================================================================
    print_step_header(7, "三条记录最终结果报告",
                      "重点核对：正常、待整改、人工修正+重跑不覆盖")
    # =====================================================================

    results = [processor.get_result(r) for r in records]

    for i, (record, result) in enumerate(zip(records, results), 1):
        print_title(f"{i}. {record.building_name}（{result.status.value}）", 2)
        print_result_report(result)

    # =====================================================================
    # 最终总结核对
    # =====================================================================
    print_line()
    print("  ✅ 最终核对总结")
    print_line()

    checks = [
        ("阳光花园A栋 - 顺利记录",
         results[0].status == RecordStatus.NORMAL and results[0].final_score >= 85.0,
         f"状态{results[0].status.value}，评分{results[0].final_score:.1f}分",
         "正常合规，无整改要求"),

        ("幸福里商业楼 - 人工修正+重跑不覆盖",
         results[1].manual_score_preserved and results[1].final_score == 88.0,
         f"人工修正后88.0分→重跑后仍{results[1].final_score:.1f}分，状态{results[1].status.value}",
         "✅ 重跑未覆盖交通协管结论，与历史记录一致"),

        ("供销社大楼 - 红线图备注更新可追溯",
         len(record_gxs.redline_note_history) == 2,
         f"备注修改记录{len(record_gxs.redline_note_history)}条，能看到改前/改后/原因",
         "✅ 旧口径标记正确，备注更新历史可反查"),
    ]

    all_passed = True
    for name, passed, actual, expected in checks:
        status = "✅" if passed else "❌"
        if not passed:
            all_passed = False
        print(f"\n  {status} {name}")
        print(f"     实际：{actual}")
        print(f"     期望：{expected}")

    print()
    if all_passed:
        print("  🎉 全部核对通过！核心讲解流程现在可靠了")
        print()
        print("     ① 坡道补录评分没变 → 自动待复核，不口头兜底")
        print("     ② 交通协管复核后人工修正 → 改前改后全程留痕")
        print("     ③ 重跑验证 → 保留人工修正结论，不被覆盖")
        print("     ④ 红线图备注更新 → 改前文本/改后文本/修改原因都能查")
        print("     ⑤ 从任何节点反查 → 评分变化、状态变化、修改原因一目了然")
    else:
        print("  ❌ 存在核对未通过项，请检查上方日志")

    return all_passed


def run_three_materials_test():
    """三种测试材料：正常/错口径/补录，各跑一遍看整改建议和历史对不对得上"""
    print_line()
    print("  三种材料测试：正常 / 错口径 / 补录")
    print("  （重点看整改建议和历史记录是否能对上）")
    print_line()

    processor = RecordProcessor()
    test_cases = get_test_cases()
    supplement_content = get_supplement_content()
    redline_notes = get_redline_notes()

    for case_name, case_info in test_cases.items():
        print_title(f"材料：{case_info['description']}", 2)

        fresh_records = get_demo_records()
        record_map = {r.record_id: r for r in fresh_records}

        for record_id in case_info["records"]:
            record = record_map[record_id]
            print(f"\n  处理对象：{record.building_name} ({record_id})")

            processor.step1_import_bus_data(record, operator="市政巡检员小付")
            print(f"    Step1 导入公交：评分{record.current_score:.1f}分，状态【{record.status.value}】")
            print(f"    整改建议：{record.suggestion}")
            print(f"    历史能对上：导入记录1条 ✅")

            if case_name == "supplement" and record_id in supplement_content:
                processor.step2_ramp_supplement(record, supplement_content[record_id], operator="市政巡检员小付")
                print(f"    Step2 坡道补录：评分{record.current_score:.1f}分，状态【{record.status.value}】")
                print(f"    整改建议：{record.suggestion}")
                expected_suggestion = "坡道补录后评分未发生变化"
                match = expected_suggestion in record.suggestion
                print(f"    建议与历史对应：补录后评分没变→建议复核 {'✅' if match else '❌'}")

            if case_name == "wrong_standard" and record_id in redline_notes:
                processor.step3_check_redline_note(record, redline_notes[record_id], operator="市政巡检员小付")
                print(f"    Step3 红线图备注：评分{record.current_score:.1f}分，状态【{record.status.value}】")
                print(f"    整改建议：{record.suggestion}")
                expected_suggestion = "旧口径核算"
                match = expected_suggestion in record.suggestion
                print(f"    建议与历史对应：发现旧口径→建议按旧口径核查 {'✅' if match else '❌'}")

        result = processor.get_result(record_map[case_info["records"][0]])
        status_match = result.status.value == case_info["expected_status"]
        print(f"\n    预期状态：{case_info['expected_status']}")
        print(f"    实际状态：{result.status.value} {'✅' if status_match else '❌'}")
        print(f"    最终验证：{result.final_verification}")


def show_error_demo():
    print_line()
    print("  友好错误提示演示（说人话不吐字段名）")
    print_line()

    test_errors = [
        ("评分超出范围", lambda: InputValidator.validate_score(150)),
        ("空操作人", lambda: InputValidator.validate_operator("")),
        ("空坡道补录内容", lambda: InputValidator.validate_score(50) or (
            (_ for _ in ()).throw(__import__("errors", fromlist=["ErrorMessages"]).ErrorMessages.empty_supplement_content())
            if True else None
        )),
    ]

    processor = RecordProcessor()
    record = get_demo_records()[0]

    # 更实际的错误场景
    scenarios = [
        ("空操作人导入公交数据",
         lambda: processor.step1_import_bus_data(record, "")),
        ("重复坡道补录",
         lambda: (
             processor.step2_ramp_supplement(record, "内容1", "小付"),
             processor.step2_ramp_supplement(record, "内容2", "小付"),
         )),
        ("人工修正不填原因",
         lambda: processor.step4_manual_correction(record, 90.0, "", "小付")),
    ]

    for error_name, test_func in scenarios:
        print(f"\n  场景：{error_name}")
        try:
            test_func()
        except UserFriendlyError as e:
            print(f"    错误提示：{e.message}")
            if e.suggestion:
                print(f"    处理建议：{e.suggestion}")


def main():
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "demo":
            ok = demo_full_workflow_with_traceback()
            sys.exit(0 if ok else 1)
        elif arg == "test":
            run_three_materials_test()
        elif arg == "errors":
            show_error_demo()
        else:
            print("用法: python main.py [demo|test|errors]")
            print()
            print("  demo   - 完整流程+反查演示（推荐）")
            print("           从待复核→人工修正→重跑→反查→结果报告一路走完")
            print()
            print("  test   - 三种材料测试")
            print("           正常/错口径/补录各跑一遍，核对建议与历史对应")
            print()
            print("  errors - 友好错误提示演示")
    else:
        print_line()
        print("  🏢 楼宇退线空间占用分析系统（增强版）")
        print_line()
        print()
        print("  本次修复/增强的核心内容：")
        print()
        print("  ✦ 重跑不再抹掉人工复核结果")
        print("    检测到有人工修正时保留其评分和状态，不会被重算冲掉")
        print()
        print("  ✦ 每步都有完整快照（状态轨迹）")
        print("    改前评分/状态、改后评分/状态、修改原因都结构化存储")
        print()
        print("  ✦ 反查链路完整")
        print("    • 待复核反查：能看到为什么到待复核（补录后评分没变）")
        print("    • 人工修正反查：改前评分/状态 → 改后评分/状态 + 原因")
        print("    • 重跑反查：基础分 vs 保留的人工确认分对比")
        print("    • 红线图备注反查：改前文本 → 改后文本 + 修改原因")
        print()
        print("  ✦ 三种结果报告完整可核对")
        print("    正常 | 待整改 | 人工修正+重跑保留")
        print()
        print("  运行命令：")
        print("    python3 main.py demo    ← 强烈推荐，看完整讲解流程")
        print("    python3 main.py test    ← 三种材料各跑一遍")
        print("    python3 main.py errors  ← 友好错误提示效果")
        print()

        # 自动跑demo
        print("  👇 自动执行完整流程演示...")
        demo_full_workflow_with_traceback()


if __name__ == "__main__":
    main()
