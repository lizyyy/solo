import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from synonym_governance import SynonymGovernor, RecordStatus, OperationType


def print_header(title):
    line = "=" * 70
    print(f"\n{line}")
    print(f"  🔍 {title}")
    print(line)


def print_record_state(rec, label="当前记录状态"):
    print(f"\n  📋 {label}:")
    print(f"     ID: {rec.id}")
    print(f"     关键词: {rec.keyword}")
    print(f"     同义词: {rec.synonyms}")
    print(f"     提示词版本: {rec.prompt_version}")
    print(f"     知识库链接: {rec.knowledge_base_link}")
    print(f"     状态: {rec.status}")
    print(f"     是否被覆盖: {rec.is_overridden}")
    print(f"     覆盖批次ID: {rec.override_batch_id}")
    print(f"     创建人: {rec.created_by}")
    print(f"     更新人: {rec.updated_by}")
    print(f"     创建时间: {rec.created_at}")
    print(f"     更新时间: {rec.updated_at}")
    print(f"     备注: {rec.remarks}")


def print_history(history, label="历史留痕"):
    print(f"\n  📜 {label}:")
    for i, h in enumerate(history, 1):
        print(f"\n     [{i}] 操作类型: {h.operation_type}")
        print(f"         操作人: {h.operator}")
        print(f"         操作时间: {h.operation_time}")
        print(f"         批次ID: {h.batch_run_id}")
        print(f"         备注: {h.remarks}")
        if h.before_value:
            print(f"         变更前-状态: {h.before_value.get('status')}, 知识库链接: {h.before_value.get('knowledge_base_link')}")
        if h.after_value:
            print(f"         变更后-状态: {h.after_value.get('status')}, 知识库链接: {h.after_value.get('knowledge_base_link')}")


def print_report(report, label="评测报告"):
    print(f"\n  📊 {label}:")
    print(f"     报告ID: {report.id}")
    print(f"     批次ID: {report.batch_run_id}")
    print(f"     生成时间: {report.generated_at}")
    print(f"     生成人: {report.generated_by}")
    print(f"     总记录数: {report.total_records}")
    print(f"     新增记录: {report.new_records}")
    print(f"     更新记录: {report.updated_records}")
    print(f"     人工改判数: {report.manual_modified_count}")
    print(f"     被覆盖数: {report.overridden_count}")
    print(f"     被覆盖关键词: {report.overridden_keywords}")
    print(f"     补录记录数: {report.supplemented_count}")
    print(f"     补录关键词: {report.supplemented_keywords}")
    print(f"     冲突数: {report.conflict_count}")
    if report.conflict_items:
        for c in report.conflict_items:
            print(f"       - {c.keyword}: {c.description}")
    print(f"     备注: {report.remarks}")


def debug_supplemented_scenario():
    """
    调试场景：出问题样例 - 初始导入无知识库链接 → 阿宁补录知识库链接 → 停在这里看状态
    注意：不停在看流程能不能点下一步，而是停在这里看详细状态变化
    """
    print_header("调试场景：补录后停住，查看状态变化、历史留痕、结果说明")

    gov = SynonymGovernor()

    initial_data = [
        {
            "keyword": "知识图谱",
            "synonyms": ["KG", "语义网络"],
            "prompt_version": "v2.0"
        }
    ]

    # ========== 第一步：初始导入（无知识库链接） ==========
    print_header("第一步：初始导入（无知识库链接）")
    result = gov.import_records(initial_data, operator="运营同学")
    print(f"  ✅ 导入结果: {result.message}")

    rec_id = result.records[0].id
    rec = gov.records[rec_id]
    print_record_state(rec, "导入后记录状态")

    import_batch_id = gov.current_batch_id
    print(f"\n  📌 当前批次ID: {import_batch_id}")

    # ========== 第二步：阿宁补录知识库链接 ==========
    print_header("第二步：AI产品经理阿宁补录知识库链接")
    ok, msg = gov.supplement_kb_link(
        rec_id,
        "https://kb.example.com/synonyms/v2",
        operator="阿宁"
    )
    print(f"  ✅ 补录结果: {msg}")

    # ========== 停在这里！查看状态变化 ==========
    print_header("⏸️  停在这里！查看补录后的完整状态变化（不继续走下一步）")

    rec = gov.records[rec_id]
    print_record_state(rec, "补录后记录状态")

    print_history(gov.history, "完整历史留痕（共{}条）".format(len(gov.history)))

    # ========== 对比：变更前后差异 ==========
    print_header("📊 重点查看：补录前后的状态变化对比")

    # 从历史记录中找出补录操作
    supplement_history = [h for h in gov.history if h.operation_type == OperationType.SUPPLEMENT]
    if supplement_history:
        h = supplement_history[0]
        print(f"\n  🔄 补录操作变更详情:")
        print(f"     变更前状态: {h.before_value['status']}")
        print(f"     变更后状态: {h.after_value['status']}")
        print(f"     变更前知识库链接: {h.before_value['knowledge_base_link']}")
        print(f"     变更后知识库链接: {h.after_value['knowledge_base_link']}")
        print(f"     变更前更新人: {h.before_value['updated_by']}")
        print(f"     变更后更新人: {h.after_value['updated_by']}")
        print(f"     历史记录中的备注: {h.remarks}")

    # ========== 第三步：重新生成评测报告 ==========
    print_header("第三步：补录后重新生成评测报告")
    report = gov.generate_report(operator="系统")
    print_report(report, "补录后的评测报告")

    # ========== 重点检查：supplemented_count ==========
    print_header("🎯 重点检查：补录记录数是否正确")
    print(f"\n  报告中 supplemented_count = {report.supplemented_count}")
    print(f"  报告中 supplemented_keywords = {report.supplemented_keywords}")

    if report.supplemented_count == 1:
        print(f"  ✅ 正确！补录记录数已从 0 修复为 1")
    else:
        print(f"  ❌ 错误！补录记录数仍然是 {report.supplemented_count}")

    # ========== 评测报告与历史记录对账 ==========
    print_header("🔍 评测报告 vs 历史记录 对账")
    ok, issues = gov.check_history_consistency(report.id)
    if ok:
        print(f"\n  ✅ 评测报告与历史记录完全一致")
    else:
        print(f"\n  ❌ 发现不一致项:")
        for issue in issues:
            print(f"     - {issue}")

    # ========== 检查当前记录状态 ==========
    print_header("📌 最终检查：当前各记录状态")
    for r in gov.records.values():
        print(f"\n  关键词「{r.keyword}」:")
        print(f"    状态: {r.status}")
        print(f"    提示词版本: {r.prompt_version}")
        print(f"    知识库链接: {r.knowledge_base_link}")
        print(f"    是否被覆盖: {r.is_overridden}")

    return gov


def debug_override_scenario():
    """
    调试场景：人工改判被下一次批跑覆盖
    以前总被当成小备注，现在要强化
    """
    print_header("调试场景：人工改判被下一次批跑覆盖（以前总被当成小备注）")

    gov = SynonymGovernor()

    initial_data = [
        {
            "keyword": "自然语言处理",
            "synonyms": ["NLP"],
            "prompt_version": "v1.0"
        }
    ]

    # 第一步：初始导入
    print_header("第一步：初始导入")
    result = gov.import_records(initial_data, operator="系统导入")
    rec_id = result.records[0].id
    rec = gov.records[rec_id]
    print_record_state(rec)

    # 第二步：人工改判
    print_header("第二步：人工改判")
    ok, msg = gov.manual_edit(
        rec_id,
        {"synonyms": ["NLP", "自然语言理解", "文本处理"], "remarks": "人工审核后补充"},
        operator="审核同学A"
    )
    print(f"  ✅ {msg}")
    rec = gov.records[rec_id]
    print_record_state(rec, "人工改判后状态")

    # 第三步：下一次批跑（覆盖人工改判）
    print_header("第三步：下一次批跑（覆盖人工改判）")
    batch_data = [
        {
            "keyword": "自然语言处理",
            "synonyms": ["NLP", "自然语言理解"],
            "prompt_version": "v1.1"
        }
    ]
    report = gov.batch_run(batch_data, operator="批跑系统")
    print_report(report, "批跑后的评测报告")

    # 重点：查看被覆盖记录的详细状态，不再只是小备注
    print_header("🎯 重点检查：被覆盖记录的标记（不再只是小备注）")
    rec = gov.records[rec_id]
    print_record_state(rec, "被批跑覆盖后的记录状态")

    print(f"\n  📌 评测报告中的专门字段：")
    print(f"     overridden_count = {report.overridden_count}")
    print(f"     overridden_keywords = {report.overridden_keywords}")
    print(f"     ⚠️  状态保持为 {rec.status}，不归为 normal，留给安全审核同事复核")

    # 查看待复核列表
    pending_review = gov.get_overridden_for_review()
    print(f"\n  📋 待安全审核复核的记录: {[r.keyword for r in pending_review]}")

    print_history(gov.history, "完整历史留痕")

    return gov


def debug_three_step_flow():
    """
    完整三步流程调试：
    提示词版本号第一次导入 → 阿宁补看知识库链接 → 评测报告更新
    """
    print_header("完整三步流程：用出问题样例重新走一遍")

    gov = SynonymGovernor()

    test_data = [
        {
            "keyword": "机器学习",
            "synonyms": ["ML"],
            "prompt_version": "v1.0",
            "knowledge_base_link": None
        },
        {
            "keyword": "深度学习",
            "synonyms": ["DL", "深度神经网络"],
            "prompt_version": "v2.0",
            "knowledge_base_link": "https://kb.example.com/synonyms/wrong-link"  # 故意错的
        }
    ]

    # 第一步
    print_header("第一步：提示词版本号第一次导入")
    result = gov.import_records(test_data, operator="运营同学")
    print(f"  ✅ {result.message}")
    print(f"  冲突数: {result.conflict_count}")
    if result.conflict_items:
        for c in result.conflict_items:
            print(f"     ⚠️  {c.keyword}: {c.description}")

    # 先停一下看导入后的状态
    print_header("⏸️  导入后状态快照")
    for rec in result.records:
        print_record_state(rec, f"「{rec.keyword}」导入后状态")

    # 第二步：阿宁处理
    print_header("第二步：AI产品经理阿宁补看知识库链接 + 处理冲突")
    for rec in result.records:
        if rec.status == RecordStatus.CONFLICT:
            print(f"\n  📌 处理冲突「{rec.keyword}」：")
            print(f"     提示词版本 {rec.prompt_version} 配的链接是 {rec.knowledge_base_link}")
            ok, msg = gov.resolve_conflict(rec.id, confirm=False, operator="阿宁")
            print(f"     ✅ {msg}")
        elif rec.knowledge_base_link is None:
            print(f"\n  📌 补录知识库链接「{rec.keyword}」：")
            ok, msg = gov.supplement_kb_link(rec.id, "https://kb.example.com/synonyms/v1", operator="阿宁")
            print(f"     ✅ {msg}")

    # 停在补录后，查看状态
    print_header("⏸️  停在补录后，查看状态变化和历史留痕")
    for rec_id, rec in gov.records.items():
        print_record_state(rec, f"「{rec.keyword}」补录后状态")

    print_history(gov.history, "到目前为止的完整历史留痕")

    # 第三步
    print_header("第三步：评测报告更新")
    report = gov.generate_report(operator="系统")
    print_report(report, "最终评测报告")

    # 对账
    print_header("🔍 最终对账：评测报告 vs 历史记录")
    ok, issues = gov.check_history_consistency(report.id)
    if ok:
        print(f"  ✅ 完全一致")
    else:
        print(f"  ❌ 不一致: {issues}")

    return gov


def main():
    print("\n" + "=" * 70)
    print("  🔧 语义检索同义词治理 - 调试脚本")
    print("  🎯 重点看：补录后报告统计、被覆盖标记、评测报告与历史记录对齐")
    print("=" * 70)

    # 场景一：补录后 supplemented_count 问题
    debug_supplemented_scenario()

    # 场景二：人工改判被覆盖不再是小备注
    debug_override_scenario()

    # 场景三：完整三步流程
    debug_three_step_flow()

    print_header("✅ 所有调试场景完成")
    print("""
  📝 修复总结：
  1. ✅ supplemented_count 现在能正确统计补录记录数
  2. ✅ 新增 supplemented_keywords 字段，明确列出哪些词被补录
  3. ✅ 新增 overridden_keywords 字段，被覆盖记录不再只是小备注
  4. ✅ 评测报告与历史记录对账增加到7项检查
  5. ✅ 被覆盖记录状态保持 overridden_by_batch，不归为 normal
  6. ✅ 所有错误提示保持说人话
    """)


if __name__ == "__main__":
    main()
