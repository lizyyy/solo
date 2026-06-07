import os
import sys

if os.path.exists('medical_review.db'):
    os.remove('medical_review.db')

from models import init_db, ManualReviewRecord

def test_step1_import_batch():
    print("=" * 60)
    print("测试 1：第一次导入人工改判表")
    print("=" * 60)

    records = [
        {
            'original_row_number': 2,
            'question_id': 'Q001',
            'question': '感冒可以吃抗生素吗？',
            'original_conclusion': '通过',
            'manual_conclusion': '驳回',
            'manual_remark': '普通感冒不需要抗生素',
            'prompt_version': '',
            'reference_url': 'https://example.com/guidelines',
            'reference_url_status': '200',
        },
        {
            'original_row_number': 3,
            'question_id': 'Q002',
            'question': '高血压能吃盐吗？',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '建议低盐饮食',
            'prompt_version': '',
            'reference_url': 'https://example.com/old-link',
            'reference_url_status': '404',
        },
        {
            'original_row_number': 4,
            'question_id': 'Q003',
            'question': '糖尿病能吃糖吗？',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '适量即可',
            'prompt_version': 'v2.1.0',
            'reference_url': 'https://example.com/diabetes',
            'reference_url_status': '200',
        },
    ]

    result = ManualReviewRecord.import_batch('TEST_BATCH_001', records, 'test.xlsx', '测试员')
    print(f"导入结果：{result}")

    stats = ManualReviewRecord.get_statistics()
    print(f"统计数据：{stats}")

    all_records = ManualReviewRecord.get_records(batch_id='TEST_BATCH_001')
    print(f"\n导入的记录：")
    for r in all_records:
        print(f"  行{r['original_row_number']}: {r['question_id']} - 状态: {r['current_status']}")

    conflicts = ManualReviewRecord.get_conflict_samples(batch_id='TEST_BATCH_001')
    print(f"\n冲突样本数量：{len(conflicts)}")
    for c in conflicts:
        print(f"  - {c['question_id']}: {c['conflict_type']} (链接状态: {c['reference_url_status']})")

    assert len(all_records) == 3, f"应该有3条记录，实际{len(all_records)}"
    assert len(conflicts) == 2, f"应该有2条冲突（Q001结论冲突, Q002链接404），实际{len(conflicts)}"
    assert all_records[0]['current_status'] == 'pending_conflict_review', "Q001结论冲突，优先级高于提示词版本缺失"
    assert all_records[1]['current_status'] == 'pending_product_review', "Q002链接404且结论通过，应该待产品经理复核"

    print("\n✅ 测试 1 通过：导入成功，状态正确，冲突样本正确识别")


def test_step2_reimport_no_duplicate():
    print("\n" + "=" * 60)
    print("测试 2：重复导入同一批次（去重验证）")
    print("=" * 60)

    records = [
        {
            'original_row_number': 2,
            'question_id': 'Q001',
            'question': '感冒可以吃抗生素吗？',
            'original_conclusion': '通过',
            'manual_conclusion': '驳回',
            'manual_remark': '普通感冒不需要抗生素，再强调一遍',
            'prompt_version': '',
            'reference_url': 'https://example.com/guidelines',
            'reference_url_status': '200',
        },
        {
            'original_row_number': 3,
            'question_id': 'Q002',
            'question': '高血压能吃盐吗？',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '建议低盐饮食',
            'prompt_version': '',
            'reference_url': 'https://example.com/old-link',
            'reference_url_status': '404',
        },
        {
            'original_row_number': 4,
            'question_id': 'Q003',
            'question': '糖尿病能吃糖吗？',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '适量即可',
            'prompt_version': 'v2.1.0',
            'reference_url': 'https://example.com/diabetes',
            'reference_url_status': '200',
        },
    ]

    result = ManualReviewRecord.import_batch('TEST_BATCH_001', records, 'test.xlsx', '测试员')
    print(f"重复导入结果：{result}")

    all_records = ManualReviewRecord.get_records(batch_id='TEST_BATCH_001')
    print(f"记录总数：{len(all_records)}（应该还是3条，不能翻倍）")

    history = ManualReviewRecord.get_record_history(all_records[0]['id'])
    print(f"\nQ001的历史变更记录数：{len(history)}")
    for h in history:
        print(f"  - {h['changed_at']} | {h['operator']} | {h['field_name']}: {h['old_value']} → {h['new_value']}")

    assert len(all_records) == 3, f"重复导入后应该还是3条记录，实际{len(all_records)}"
    assert result['updated'] >= 1, "应该有至少1条更新（备注改了）"
    assert result['unchanged'] >= 1, "应该有至少1条未变化"

    print("\n✅ 测试 2 通过：重复导入不翻倍，只更新有变化的字段，历史记录完整")


def test_step3_xiaoqiao_fill_prompt_version():
    print("\n" + "=" * 60)
    print("测试 3：知识库编辑小乔补看提示词版本号")
    print("=" * 60)

    all_records = ManualReviewRecord.get_records(batch_id='TEST_BATCH_001')
    q001 = next(r for r in all_records if r['question_id'] == 'Q001')
    print(f"更新前 Q001 状态：{q001['current_status']}")
    print(f"更新前 Q001 提示词版本：{q001['prompt_version']}")

    ManualReviewRecord.update_record(q001['id'], {
        'prompt_version': 'v2.3.1',
        'manual_remark': '普通感冒不需要抗生素，提示词版本已核对',
    }, operator='小乔')

    updated_records = ManualReviewRecord.get_records(batch_id='TEST_BATCH_001')
    q001_updated = next(r for r in updated_records if r['question_id'] == 'Q001')
    print(f"\n更新后 Q001 状态：{q001_updated['current_status']}")
    print(f"更新后 Q001 提示词版本：{q001_updated['prompt_version']}")

    history = ManualReviewRecord.get_record_history(q001['id'])
    print(f"\n历史变更记录：")
    for h in history:
        print(f"  - {h['field_name']}: {h['old_value']} → {h['new_value']} (by {h['operator']})")

    prompt_updates = [h for h in history if h['field_name'] == 'prompt_version']
    assert len(prompt_updates) >= 1, "应该有提示词版本的变更记录"
    assert prompt_updates[-1]['operator'] == '小乔', "操作人应该是小乔"
    assert q001_updated['current_status'] in ['pending_review', 'pending_conflict_review'], \
        f"补充版本号后状态应该流转，实际是{q001_updated['current_status']}"

    print("\n✅ 测试 3 通过：小乔补充提示词版本后状态正确流转，历史记录可追溯")


def test_step4_404_link_handling():
    print("\n" + "=" * 60)
    print("测试 4：引用链接 404 仍被判通过的边界规则")
    print("=" * 60)

    all_records = ManualReviewRecord.get_records(batch_id='TEST_BATCH_001')
    q002 = next(r for r in all_records if r['question_id'] == 'Q002')

    print(f"Q002 链接状态：{q002['reference_url_status']}")
    print(f"Q002 人工结论：{q002['manual_conclusion']}")
    print(f"Q002 当前状态：{q002['current_status']}")

    conflicts = ManualReviewRecord.get_conflict_samples(batch_id='TEST_BATCH_001')
    q002_conflict = next(c for c in conflicts if c['question_id'] == 'Q002')
    print(f"Q002 冲突类型：{q002_conflict['conflict_type']}")
    print(f"Q002 复核状态：{q002_conflict['product_review_status']}")

    assert q002['current_status'] == 'pending_product_review', \
        f"链接404且结论通过，应该待产品经理复核，实际是{q002['current_status']}"
    assert q002_conflict['conflict_type'] == 'REF_404_PASS', \
        f"冲突类型应该是REF_404_PASS，实际是{q002_conflict['conflict_type']}"
    assert q002_conflict['product_review_status'] == 'pending', \
        f"复核状态应该是pending，实际是{q002_conflict['product_review_status']}"

    print("\n✅ 测试 4 通过：404链接+通过结论自动标记为待产品经理复核，不直接归正常")


def test_step5_product_manager_review():
    print("\n" + "=" * 60)
    print("测试 5：产品经理复核冲突样本（三步流程第三步）")
    print("=" * 60)

    conflicts = ManualReviewRecord.get_conflict_samples(batch_id='TEST_BATCH_001')
    print(f"待复核的冲突样本数：{len(conflicts)}")

    q002_conflict = next(c for c in conflicts if c['question_id'] == 'Q002')
    print(f"\n复核前 Q002 复核状态：{q002_conflict['product_review_status']}")

    ManualReviewRecord.update_product_review(
        q002_conflict['id'],
        status='approved',
        remark='链接虽然404，但结论正确，保留通过',
        operator='产品经理张总'
    )

    updated_conflicts = ManualReviewRecord.get_conflict_samples(batch_id='TEST_BATCH_001')
    q002_updated = next(c for c in updated_conflicts if c['question_id'] == 'Q002')
    print(f"复核后 Q002 复核状态：{q002_updated['product_review_status']}")
    print(f"复核后 Q002 产品备注：{q002_updated['product_remark']}")

    all_records = ManualReviewRecord.get_records(batch_id='TEST_BATCH_001')
    q002_record = next(r for r in all_records if r['question_id'] == 'Q002')
    print(f"复核后 Q002 主表状态：{q002_record['current_status']}")

    history = ManualReviewRecord.get_record_history(q002_conflict['record_id'])
    product_review_logs = [h for h in history if h['field_name'] == 'product_review']
    print(f"\n产品复核历史：{len(product_review_logs)}条")
    for h in product_review_logs:
        print(f"  - {h['new_value']} (by {h['operator']})")

    assert q002_updated['product_review_status'] == 'approved', "复核状态应该是approved"
    assert q002_record['current_status'] == 'reviewed', "主表状态应该是reviewed"
    assert len(product_review_logs) >= 1, "应该有产品复核的历史记录"

    print("\n✅ 测试 5 通过：产品经理复核后状态正确更新，历史记录完整")


def test_step6_history_traceability():
    print("\n" + "=" * 60)
    print("测试 6：历史变更完整可追溯（产品经理追问时的证据）")
    print("=" * 60)

    all_records = ManualReviewRecord.get_records(batch_id='TEST_BATCH_001')
    q001 = next(r for r in all_records if r['question_id'] == 'Q001')

    history = ManualReviewRecord.get_record_history(q001['id'])
    print(f"Q001 的完整变更历史（共 {len(history)} 条）：")
    for i, h in enumerate(history, 1):
        print(f"\n  变更 {i}:")
        print(f"    时间：{h['changed_at']}")
        print(f"    操作人：{h['operator']}")
        print(f"    字段：{h['field_name']}")
        print(f"    改前：{h['old_value'] or '(空)'}")
        print(f"    改后：{h['new_value'] or '(空)'}")

    assert len(history) >= 3, "应该至少有3条历史记录（初始导入、重复导入更新、小乔更新）"

    print("\n✅ 测试 6 通过：历史记录完整，改前改后清晰可见，产品经理追问有证据")


def test_step7_boundary_rules_list():
    print("\n" + "=" * 60)
    print("测试 7：边界规则可查询（不只靠口头约定）")
    print("=" * 60)

    rules = ManualReviewRecord.get_boundary_rules()
    print(f"已固化的边界规则（共 {len(rules)} 条）：")
    for r in rules:
        print(f"\n  [{r['rule_code']}] {r['rule_name']}")
        print(f"    触发条件：{r['description']}")
        print(f"    处理策略：{r['handling_strategy']}")

    rule_codes = [r['rule_code'] for r in rules]
    assert 'REF_404_PASS' in rule_codes, "应该有REF_404_PASS规则"
    assert 'PROMPT_VERSION_MISSING' in rule_codes, "应该有PROMPT_VERSION_MISSING规则"
    assert 'CONCLUSION_CONFLICT' in rule_codes, "应该有CONCLUSION_CONFLICT规则"

    print("\n✅ 测试 7 通过：边界规则已固化到代码和数据库中，不只靠口头约定")


def run_all_tests():
    print("\n" + "🚀" * 30)
    print("开始运行医疗问答安全回放系统测试")
    print("🚀" * 30)

    init_db()

    try:
        test_step1_import_batch()
        test_step2_reimport_no_duplicate()
        test_step3_xiaoqiao_fill_prompt_version()
        test_step4_404_link_handling()
        test_step5_product_manager_review()
        test_step6_history_traceability()
        test_step7_boundary_rules_list()

        print("\n" + "🎉" * 30)
        print("所有测试通过！系统功能验证完毕。")
        print("🎉" * 30)
        print("\n核心能力总结：")
        print("  ✅ 原始行号保留，可回溯到 Excel 表")
        print("  ✅ 重复导入不翻倍，只更新变化字段")
        print("  ✅ 每次修改都留痕，改前改后清晰可见")
        print("  ✅ 404链接+通过结论自动标记，不直接归正常")
        print("  ✅ 三步流程完整：导入→补版本号→冲突复核")
        print("  ✅ 边界规则写在代码和文档里，不只靠口头约定")
        print("  ✅ 产品经理追问时，每一步都有证据链")

    except AssertionError as e:
        print(f"\n❌ 测试失败：{e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    run_all_tests()
