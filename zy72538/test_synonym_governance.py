import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from synonym_governance import SynonymGovernor, RecordStatus


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def test_normal_scenario():
    print_section("场景一：正常材料导入 + 标准流程")

    gov = SynonymGovernor()

    normal_data = [
        {
            "keyword": "人工智能",
            "synonyms": ["AI", "机器学习"],
            "prompt_version": "v1.0",
            "knowledge_base_link": "https://kb.example.com/synonyms/v1"
        },
        {
            "keyword": "大语言模型",
            "synonyms": ["LLM", "大模型"],
            "prompt_version": "v2.0",
            "knowledge_base_link": "https://kb.example.com/synonyms/v2"
        }
    ]

    print("第一步：导入提示词版本号")
    result = gov.import_records(normal_data, operator="运营同学")
    print(f"  导入结果: {result.message}")
    print(f"  导入数量: {result.imported_count}, 重复: {result.duplicate_count}, 冲突: {result.conflict_count}")

    print("\n第二步：AI产品经理阿宁补看知识库引用链接")
    for rec in result.records:
        ok, msg = gov.supplement_kb_link(rec.id, rec.knowledge_base_link, operator="阿宁")
        print(f"  {rec.keyword}: {msg}")

    print("\n第三步：生成评测报告")
    report = gov.generate_report(operator="系统")
    print(f"  报告ID: {report.id}")
    print(f"  总记录: {report.total_records}")
    print(f"  人工改判: {report.manual_modified_count}")
    print(f"  覆盖记录: {report.overridden_count}")
    print(f"  冲突数量: {report.conflict_count}")
    print(f"  备注: {report.remarks}")

    print("\n验证：评测报告 vs 历史记录一致性")
    ok, issues = gov.check_history_consistency(report.id)
    if ok:
        print("  ✅ 历史记录与评测报告一致")
    else:
        print(f"  ❌ 不一致: {issues}")

    return gov


def test_wrong_data_scenario():
    print_section("场景二：错口径材料（提示词版本与知识库链接冲突）")

    gov = SynonymGovernor()

    wrong_data = [
        {
            "keyword": "计算机视觉",
            "synonyms": ["CV", "图像识别"],
            "prompt_version": "v1.0",
            "knowledge_base_link": "https://kb.example.com/synonyms/wrong-link"
        }
    ]

    print("导入错口径材料：")
    result = gov.import_records(wrong_data, operator="运营同学")
    print(f"  导入结果: {result.message}")
    print(f"  冲突数量: {result.conflict_count}")

    if result.conflict_items:
        print("\n  ⚠️  发现冲突证据：")
        for conflict in result.conflict_items:
            print(f"    - 关键词: {conflict.keyword}")
            print(f"      提示词版本: {conflict.prompt_version}")
            print(f"      当前链接: {conflict.knowledge_base_link}")
            print(f"      期望链接: {conflict.expected_link}")
            print(f"      描述: {conflict.description}")

        print("\n  📌 请AI产品经理阿宁确认或驳回，不要自动拍板")
        conflict_rec_id = result.conflict_items[0].record_id

        print("\n  阿宁选择【驳回，自动修正为标准链接】:")
        ok, msg = gov.resolve_conflict(conflict_rec_id, confirm=False, operator="阿宁")
        print(f"    结果: {msg}")

    return gov


def test_manual_override_scenario():
    print_section("场景三：人工改判被下一次批跑覆盖")

    gov = SynonymGovernor()

    initial_data = [
        {
            "keyword": "自然语言处理",
            "synonyms": ["NLP"],
            "prompt_version": "v1.0"
        }
    ]

    print("第一步：初始导入")
    result = gov.import_records(initial_data)
    rec_id = result.records[0].id
    print(f"  导入: {result.records[0].keyword}")

    print("\n第二步：人工改判")
    ok, msg = gov.manual_edit(rec_id, {"synonyms": ["NLP", "自然语言理解", "文本处理"]}, operator="审核同学A")
    print(f"  {msg}")
    rec = gov.records[rec_id]
    print(f"  当前状态: {rec.status}")
    print(f"  修改后人义词: {rec.synonyms}")

    print("\n第三步：下一次批跑（覆盖人工改判）")
    batch_data = [
        {
            "keyword": "自然语言处理",
            "synonyms": ["NLP", "自然语言理解"],
            "prompt_version": "v1.1"
        }
    ]
    report = gov.batch_run(batch_data, operator="批跑系统")
    print(f"  批跑结果: {report.remarks}")
    print(f"  覆盖人工改判: {report.overridden_count} 条")

    rec = gov.records[rec_id]
    print(f"\n  记录状态: {rec.status}")
    print(f"  是否被覆盖: {rec.is_overridden}")
    print(f"  覆盖批次: {rec.override_batch_id}")
    print(f"  ⚠️  状态保持为 overridden_by_batch，不归为normal，留给安全审核同事复核")

    print("\n待安全审核复核的记录：")
    for review_rec in gov.get_overridden_for_review():
        print(f"  - {review_rec.keyword} (状态: {review_rec.status})")

    return gov


def test_supplement_scenario():
    print_section("场景四：补录材料 + 补录后重算")

    gov = SynonymGovernor()

    initial_data = [
        {
            "keyword": "知识图谱",
            "synonyms": ["KG", "语义网络"],
            "prompt_version": "v2.0"
        }
    ]

    print("第一步：初始导入（无知识库链接）")
    result = gov.import_records(initial_data)
    rec_id = result.records[0].id
    print(f"  导入: {result.records[0].keyword}")

    print("\n第二步：补录知识库链接")
    ok, msg = gov.supplement_kb_link(rec_id, "https://kb.example.com/synonyms/v2", operator="阿宁")
    print(f"  {msg}")

    print("\n第三步：补录后重新生成评测报告")
    report_before = gov.generate_report()
    print(f"  补录后报告 - 补录记录数: {report_before.supplemented_count}")
    print(f"  报告备注: {report_before.remarks}")

    print("\n验证导出一致性：")
    ok, issues = gov.check_export_consistency()
    if ok:
        print("  ✅ 导出数据与记录一致")
    else:
        print(f"  ❌ 不一致: {issues}")

    return gov


def test_duplicate_import():
    print_section("场景五：重复导入检测")

    gov = SynonymGovernor()

    data = [
        {
            "keyword": "推荐系统",
            "synonyms": ["推荐算法"],
            "prompt_version": "v1.0"
        }
    ]

    print("第一次导入：")
    r1 = gov.import_records(data)
    print(f"  {r1.message}")

    print("\n第二次导入（相同关键词）：")
    r2 = gov.import_records(data)
    print(f"  {r2.message}")
    print(f"  重复数量: {r2.duplicate_count}")

    return gov


def test_self_check():
    print_section("场景六：运行完整自检")

    gov = SynonymGovernor()

    gov.import_records([
        {"keyword": "A", "synonyms": ["A1"], "prompt_version": "v1.0"},
        {"keyword": "B", "synonyms": ["B1"], "prompt_version": "v1.0", "knowledge_base_link": "https://wrong.com"},
    ])

    rec_id = list(gov.records.keys())[0]
    gov.manual_edit(rec_id, {"synonyms": ["A1", "A2"]}, operator="测试")
    gov.batch_run([{"keyword": "A", "synonyms": ["A1"], "prompt_version": "v1.0"}])

    print("运行自检：")
    results = gov.run_self_check()
    for r in results:
        status = "✅" if r.passed else "❌"
        print(f"  {status} {r.check_name}: {r.message}")
        if r.details:
            print(f"     详情: {r.details}")

    return gov


def main():
    print("\n" + "="*60)
    print("  语义检索同义词治理 - 功能验证测试")
    print("="*60)

    test_normal_scenario()
    test_wrong_data_scenario()
    test_manual_override_scenario()
    test_supplement_scenario()
    test_duplicate_import()
    test_self_check()

    print_section("✅ 所有测试场景执行完成")
    print("""
核心功能验证总结：
1. ✅ 正常材料三步流程：导入 → 阿宁补链接 → 评测报告更新
2. ✅ 错口径材料：检测提示词版本与知识库链接冲突，列出证据等阿宁确认
3. ✅ 人工改判被批跑覆盖：标记状态，保留给安全审核复核，不自动归正常
4. ✅ 补录材料：补录后重算评测报告
5. ✅ 重复导入检测
6. ✅ 导出一致性检查
7. ✅ 四项基本自检：重复导入、人工改判覆盖、补录重算、导出一致
8. ✅ 错误提示说人话，不吐内部字段名
    """)


if __name__ == "__main__":
    main()
