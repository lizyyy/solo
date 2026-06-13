import os
import sys

if os.path.exists('medical_review.db'):
    os.remove('medical_review.db')

from models import init_db, ManualReviewRecord


def print_header(title):
    print()
    print("=" * 70)
    print(title)
    print("=" * 70)


def test_step1_normal_sample_status_flow():
    print_header("测试 1：用户反馈的核心场景 — 正常样本补填版本号后状态流转")

    print("场景：导入 1 条记录：原结论=通过、人工结论=通过、链接状态=200、提示词版本=空")
    records = [
        {
            'original_row_number': 2,
            'question_id': 'Q-NORMAL-001',
            'question': '每天喝8杯水对身体好吗？',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '正常样本，不需要改判',
            'prompt_version': '',
            'reference_url': 'https://example.com/water-guide',
            'reference_url_status': '200',
        },
    ]

    result = ManualReviewRecord.import_batch('BATCH-NORMAL-001', records, 'normal.xlsx', '质检员A')
    all_records = ManualReviewRecord.get_records(batch_id='BATCH-NORMAL-001')
    r = all_records[0]

    print(f"  导入后状态：{r['current_status']}")
    assert r['current_status'] == 'pending_prompt', f"初始状态应该是 pending_prompt，实际是 {r['current_status']}"

    print("  现在在详情页补填提示词版本号 v2.5.0（知识库编辑小乔操作）")
    ManualReviewRecord.update_record(
        r['id'],
        {'prompt_version': 'v2.5.0'},
        operator='小乔',
        change_reason='回看群里补的提示词版本号，是 v2.5.0'
    )

    updated = ManualReviewRecord.get_records(batch_id='BATCH-NORMAL-001')[0]
    print(f"  补填版本号后状态：{updated['current_status']}")
    assert updated['prompt_version'] == 'v2.5.0', "提示词版本号没存上"
    assert updated['current_status'] == 'pending_review', \
        f"【核心BUG修复验证】补填版本号后应该流转到 pending_review，实际卡在 {updated['current_status']}"

    history = ManualReviewRecord.get_record_history(r['id'])
    print(f"  历史记录数：{len(history)}")
    prompt_change = next(h for h in history if h['field_name'] == 'prompt_version')
    print(f"  改前：{prompt_change['old_value']} → 改后：{prompt_change['new_value']}")
    print(f"  操作人：{prompt_change['operator']}，原因：{prompt_change['change_reason']}")

    assert prompt_change['operator'] == '小乔', "操作人没存上"
    assert prompt_change['change_reason'] == '回看群里补的提示词版本号，是 v2.5.0', "修改原因没存上"

    status_flow = next(h for h in history if h['field_name'] == 'current_status')
    print(f"  状态流转：{status_flow['old_value']} → {status_flow['new_value']}")
    print(f"  流转原因：{status_flow['change_reason']}")
    assert status_flow['old_value'] == 'pending_prompt', "状态流转改前值不对"
    assert status_flow['new_value'] == 'pending_review', "状态流转改后值不对"

    print("\n✅ 测试 1 通过：补填提示词版本号后，状态从 pending_prompt 正确流转到 pending_review")
    print("   历史记录完整：改前值、改后值、操作人、修改原因全部留存")


def test_step2_404_pass_sample_status_flow():
    print_header("测试 2：404链接 + 通过结论的边界规则（优先级高于提示词版本）")

    print("场景：导入 1 条记录：原结论=通过、人工结论=通过、链接=404、提示词版本=空")
    records = [
        {
            'original_row_number': 2,
            'question_id': 'Q-404-001',
            'question': '高血压的诊断标准是什么？',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '结论没问题，但链接失效了',
            'prompt_version': '',
            'reference_url': 'https://example.com/old-guide',
            'reference_url_status': '404',
        },
    ]

    ManualReviewRecord.import_batch('BATCH-404-001', records, '404.xlsx', '质检员A')
    r = ManualReviewRecord.get_records(batch_id='BATCH-404-001')[0]
    print(f"  导入后状态：{r['current_status']}")
    assert r['current_status'] == 'pending_product_review', \
        f"404+通过 应该直接标记 pending_product_review（边界规则优先），实际是 {r['current_status']}"

    print("  小乔补填提示词版本号 v3.0.0")
    ManualReviewRecord.update_record(
        r['id'],
        {'prompt_version': 'v3.0.0'},
        operator='小乔',
        change_reason='群里补的版本号 v3.0.0'
    )

    updated = ManualReviewRecord.get_records(batch_id='BATCH-404-001')[0]
    print(f"  补填后状态：{updated['current_status']}")
    assert updated['current_status'] == 'pending_product_review', \
        f"即使补了版本号，404+通过仍应保留在待产品经理复核，实际是 {updated['current_status']}"

    conflicts = ManualReviewRecord.get_conflict_samples(batch_id='BATCH-404-001')
    assert len(conflicts) == 1, "应该有 1 条冲突样本"
    assert conflicts[0]['conflict_type'] == 'REF_404_PASS', f"冲突类型不对：{conflicts[0]['conflict_type']}"
    assert conflicts[0]['product_review_status'] == 'pending', "复核状态应该是 pending"

    print("\n✅ 测试 2 通过：边界规则优先级正确，404+通过始终留给产品经理复核，不急着归正常")


def test_step3_reimport_no_duplicate():
    print_header("测试 3：重复导入不翻倍，历史批次和本次重传分清")

    batch_id = 'BATCH-REIMPORT-001'
    records_v1 = [
        {
            'original_row_number': 2,
            'question_id': 'Q-RE-001',
            'question': '问题1',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '第一次导入的备注',
            'prompt_version': '',
            'reference_url_status': '200',
        },
        {
            'original_row_number': 3,
            'question_id': 'Q-RE-002',
            'question': '问题2',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '保持不变',
            'prompt_version': 'v1.0',
            'reference_url_status': '200',
        },
    ]

    print(f"第一次导入：{len(records_v1)} 条")
    result1 = ManualReviewRecord.import_batch(batch_id, records_v1, 'v1.xlsx', '质检员A')
    print(f"  结果：{result1}")
    assert result1['inserted'] == 2, f"应该插入 2 条，实际 {result1['inserted']}"

    records_v2 = [
        {
            'original_row_number': 2,
            'question_id': 'Q-RE-001',
            'question': '问题1',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '第二次导入，备注改了',
            'prompt_version': 'v2.0',
            'reference_url_status': '200',
        },
        {
            'original_row_number': 3,
            'question_id': 'Q-RE-002',
            'question': '问题2',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '保持不变',
            'prompt_version': 'v1.0',
            'reference_url_status': '200',
        },
        {
            'original_row_number': 4,
            'question_id': 'Q-RE-003',
            'question': '问题3（新增）',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '第二次导入新增的行',
            'prompt_version': 'v3.0',
            'reference_url_status': '200',
        },
    ]

    print(f"第二次重传：{len(records_v2)} 条（第1行改了，第2行没变，第3行新增）")
    result2 = ManualReviewRecord.import_batch(batch_id, records_v2, 'v2.xlsx', '质检员A')
    print(f"  结果：{result2}")
    assert result2['inserted'] == 1, f"应该新增 1 条，实际 {result2['inserted']}"
    assert result2['updated'] == 1, f"应该更新 1 条，实际 {result2['updated']}"
    assert result2['unchanged'] == 1, f"应该未变 1 条，实际 {result2['unchanged']}"

    total = ManualReviewRecord.get_records(batch_id=batch_id)
    print(f"  批次总记录数：{len(total)}（应该是 3，不能翻倍）")
    assert len(total) == 3, f"重复导入后应该是 3 条（不是 5），实际 {len(total)}"

    history_q1 = ManualReviewRecord.get_record_history(total[0]['id'])
    reimport_history = [h for h in history_q1 if h['operator'] == 'reimport']
    print(f"  Q-RE-001 的重复导入更新记录：{len(reimport_history)} 条")
    for h in reimport_history:
        print(f"    - {h['field_name']}: {h['old_value']} → {h['new_value']}")
    assert len(reimport_history) >= 1, "重复导入的更新历史应该记录下来"

    print("\n✅ 测试 3 通过：重复导入不翻倍，只更新有变化的行，历史记录区分首次导入和重传")


def test_step4_remark_change_full_traceability():
    print_header("测试 4：改备注时完整可追溯（改前文本、改后文本、为什么改、谁改的）")

    batch_id = 'BATCH-REMARK-001'
    records = [
        {
            'original_row_number': 2,
            'question_id': 'Q-RM-001',
            'question': '糖尿病要注意什么？',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '初版备注',
            'prompt_version': 'v1.0',
            'reference_url_status': '200',
        },
    ]

    ManualReviewRecord.import_batch(batch_id, records, 'rm.xlsx', '质检员A')
    r = ManualReviewRecord.get_records(batch_id=batch_id)[0]

    print("知识库编辑小乔修改备注，并说明原因")
    ManualReviewRecord.update_record(
        r['id'],
        {'manual_remark': '修改后：需要额外强调低盐饮食，之前漏了'},
        operator='小乔',
        change_reason='质控复核时发现结论没问题，但备注不完整，补充低盐建议'
    )

    history = ManualReviewRecord.get_record_history(r['id'])
    remark_changes = [h for h in history if h['field_name'] == 'manual_remark']
    print(f"  备注变更记录数：{len(remark_changes)}")
    last = remark_changes[-1]
    print(f"  改前文本：{last['old_value']}")
    print(f"  改后文本：{last['new_value']}")
    print(f"  谁改的：{last['operator']}")
    print(f"  为什么改：{last['change_reason']}")

    assert last['old_value'] == '初版备注', "改前文本不对"
    assert '低盐' in last['new_value'], "改后文本不对"
    assert last['operator'] == '小乔', "操作人不对"
    assert '补充低盐建议' in last['change_reason'], "修改原因不对"

    print("\n✅ 测试 4 通过：改备注时改前改后、谁改的、为什么改，四要素完整留存")


def test_step5_batch_rollback_with_snapshots():
    print_header("测试 5：批次回滚功能（前后快照、原因、处理人可查）")

    batch_id = 'BATCH-ROLLBACK-001'
    records = [
        {
            'original_row_number': 2,
            'question_id': 'Q-RB-001',
            'question': '回滚测试1',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '首次导入',
            'prompt_version': '',
            'reference_url_status': '200',
        },
    ]

    result1 = ManualReviewRecord.import_batch(batch_id, records, 'rb.xlsx', '质检员A')
    print(f"① 首次导入：插入 {result1['inserted']} 条")

    ManualReviewRecord.import_batch(batch_id, [
        {
            'original_row_number': 2,
            'question_id': 'Q-RB-001',
            'question': '回滚测试1',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '重复导入后被改坏了',
            'prompt_version': 'v999',
            'reference_url_status': '404',
        },
    ], 'rb_v2.xlsx', '误操作')

    r = ManualReviewRecord.get_records(batch_id=batch_id)[0]
    print(f"② 重复导入后：备注={r['manual_remark']}，版本={r['prompt_version']}，链接={r['reference_url_status']}")
    assert r['manual_remark'] == '重复导入后被改坏了'

    print("③ 执行回滚：清除重复导入痕迹，恢复到首次导入状态")
    rb_result = ManualReviewRecord.rollback_batch(
        batch_id,
        rollback_type='clear_last_reimport',
        reason='重传时版本号传错了，需要恢复',
        operator='管理员老王'
    )
    print(f"  回滚结果：{rb_result['message']}")

    r_after = ManualReviewRecord.get_records(batch_id=batch_id)[0]
    print(f"  回滚后：备注={r_after['manual_remark']}，版本={r_after['prompt_version']}，链接={r_after['reference_url_status']}")
    assert r_after['manual_remark'] == '首次导入', "回滚后备注没恢复"
    assert r_after['prompt_version'] == '', "回滚后版本号没清空"
    assert r_after['reference_url_status'] == '200', "回滚后链接状态没恢复"

    logs = ManualReviewRecord.get_rollback_logs(batch_id)
    print(f"  回滚日志数：{len(logs)}")
    last_log = logs[-1]
    print(f"    处理人：{last_log['operator']}")
    print(f"    原因：{last_log['rollback_reason']}")
    print(f"    有前后快照：{bool(last_log['snapshot_before'])}/{bool(last_log['snapshot_after'])}")
    assert last_log['operator'] == '管理员老王', "回滚处理人没存"
    assert '传错了' in last_log['rollback_reason'], "回滚原因没存"
    assert last_log['snapshot_before'] and last_log['snapshot_after'], "前后快照没存"

    history = ManualReviewRecord.get_record_history(r['id'])
    rollback_history = [h for h in history if h['field_name'] == 'rollback']
    print(f"  单条记录的回滚历史：{len(rollback_history)} 条（改前JSON快照已存）")
    assert len(rollback_history) >= 1, "单条记录的回滚历史缺失"

    print("\n✅ 测试 5 通过：批次回滚功能正常，前后快照、原因、处理人完整留存")


def test_step6_delete_batch_rollback():
    print_header("测试 6：彻底删除批次的回滚类型（batch_id 级别的全清）")

    batch_id = 'BATCH-DELETE-001'
    ManualReviewRecord.import_batch(batch_id, [
        {
            'original_row_number': 2,
            'question_id': 'Q-DEL-001',
            'question': '删我',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'prompt_version': 'v1.0',
            'reference_url_status': '200',
        },
    ], 'del.xlsx', '质检员A')

    assert len(ManualReviewRecord.get_records(batch_id=batch_id)) == 1

    rb_result = ManualReviewRecord.rollback_batch(
        batch_id,
        rollback_type='delete_batch',
        reason='整个批次导错了，完全删除重来',
        operator='管理员老李'
    )
    print(f"  删除回滚：{rb_result['message']}")

    assert len(ManualReviewRecord.get_records(batch_id=batch_id)) == 0, "批次记录应该被清空"
    assert ManualReviewRecord.get_batch_detail(batch_id) is None, "批次元数据应该被删除"

    logs = ManualReviewRecord.get_rollback_logs(batch_id)
    print(f"  回滚日志仍保留：{len(logs)} 条（即使删了批次，回滚证据还在）")
    assert len(logs) == 1, "回滚日志应该保留（证据链不能断）"
    assert logs[0]['operator'] == '管理员老李'

    print("\n✅ 测试 6 通过：彻底删除批次后，记录清空但回滚日志保留，证据链完整")


def test_end_to_end_workflow():
    print_header("🎬 完整端到端复现：按普通使用者的真实路线")

    print("""
场景回放：
  ① 质检员导入一批人工改判表
  ② 误操作重传了同一批，产生了一些更新
  ③ 知识库编辑小乔找到 pending_prompt 的记录，补看群里补的提示词版本号
  ④ 小乔顺便改了一条备注，并说明原因
  ⑤ 发现一条 404 链接仍被判通过，系统自动标记为待产品经理复核
  ⑥ 产品经理进入冲突样本表，复核通过
  ⑦ 核对所有记录的处理状态
""")

    batch_id = 'WORKFLOW-END-TO-END'
    print("=" * 50)
    print("① 第一次导入人工改判表（3条：1条结论冲突、1条404+通过、1条正常但缺版本号）")
    records = [
        {
            'original_row_number': 2,
            'question_id': 'W-001',
            'question': '结论冲突：感冒能用抗生素吗？',
            'original_conclusion': '通过',
            'manual_conclusion': '驳回',
            'manual_remark': '普通感冒不用抗生素',
            'prompt_version': 'v2.0',
            'reference_url_status': '200',
        },
        {
            'original_row_number': 3,
            'question_id': 'W-002',
            'question': '404链接仍通过：高血压标准？',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '指南内容是对的，只是链接死了',
            'prompt_version': '',
            'reference_url_status': '404',
        },
        {
            'original_row_number': 4,
            'question_id': 'W-003',
            'question': '正常样本但缺版本：喝水健康吗？',
            'original_conclusion': '通过',
            'manual_conclusion': '通过',
            'manual_remark': '',
            'prompt_version': '',
            'reference_url_status': '200',
        },
    ]
    r1 = ManualReviewRecord.import_batch(batch_id, records, 'end.xlsx', '质检员小张')
    print(f"  导入结果：插入 {r1['inserted']} 条")

    all_r = ManualReviewRecord.get_records(batch_id=batch_id)
    statuses = {r['question_id']: r['current_status'] for r in all_r}
    print(f"  初始状态：{statuses}")

    assert statuses['W-001'] == 'pending_conflict_review', "W-001 结论冲突应该进 pending_conflict_review"
    assert statuses['W-002'] == 'pending_product_review', "W-002 404+通过应该进 pending_product_review"
    assert statuses['W-003'] == 'pending_prompt', "W-003 缺版本号应该是 pending_prompt"

    print("=" * 50)
    print("② 重传同一批（W-002 备注略有改动，其他不变）")
    records_re = list(records)
    records_re[1]['manual_remark'] = 'W-002 重传时改了备注：指南内容正确'
    r2 = ManualReviewRecord.import_batch(batch_id, records_re, 'end_re.xlsx', '质检员小张')
    print(f"  重传结果：新增 {r2['inserted']}，更新 {r2['updated']}，不变 {r2['unchanged']}")
    assert r2['inserted'] == 0 and r2['updated'] == 1 and r2['unchanged'] == 2, "重传统计不对"
    assert len(ManualReviewRecord.get_records(batch_id=batch_id)) == 3, "重传后不该翻倍"

    print("=" * 50)
    print("③ 小乔补看提示词版本号，先处理 W-003（纯缺版本号的正常样本）")
    w003 = next(r for r in ManualReviewRecord.get_records(batch_id=batch_id) if r['question_id'] == 'W-003')
    ManualReviewRecord.update_record(
        w003['id'],
        {'prompt_version': 'v2.5.0'},
        operator='小乔',
        change_reason='群里补的版本号，对照聊天记录确认是 v2.5.0'
    )
    w003_new = next(r for r in ManualReviewRecord.get_records(batch_id=batch_id) if r['question_id'] == 'W-003')
    print(f"  W-003 状态：{statuses['W-003']} → {w003_new['current_status']}")
    assert w003_new['current_status'] == 'pending_review', "正常样本补版本后应该到 pending_review"

    print("=" * 50)
    print("④ 小乔补 W-002 的版本号 + 改备注")
    w002 = next(r for r in ManualReviewRecord.get_records(batch_id=batch_id) if r['question_id'] == 'W-002')
    ManualReviewRecord.update_record(
        w002['id'],
        {'prompt_version': 'v2.5.0', 'manual_remark': 'W-002 最终版：指南内容正确，链接失效但不影响结论'},
        operator='小乔',
        change_reason='提示词版本号补上了；同时备注写得更清楚'
    )
    w002_new = next(r for r in ManualReviewRecord.get_records(batch_id=batch_id) if r['question_id'] == 'W-002')
    print(f"  W-002 状态：{statuses['W-002']} → {w002_new['current_status']}")
    assert w002_new['current_status'] == 'pending_product_review', "404+通过 即使补了版本号，仍应保留 pending_product_review"

    print("=" * 50)
    print("⑤ 产品经理张总复核 W-002（404+通过的边界情况）")
    conflicts = ManualReviewRecord.get_conflict_samples(batch_id=batch_id)
    w002_conflict = next(c for c in conflicts if c['question_id'] == 'W-002')
    ManualReviewRecord.update_product_review(
        w002_conflict['id'],
        status='approved',
        remark='确实是旧链接，但结论正确，通过',
        operator='产品经理张总'
    )
    w002_final = next(r for r in ManualReviewRecord.get_records(batch_id=batch_id) if r['question_id'] == 'W-002')
    print(f"  W-002 产品经理复核后：{w002_final['current_status']}")
    assert w002_final['current_status'] == 'reviewed', "复核通过后应该是 reviewed"

    print("=" * 50)
    print("⑥ 输出最终状态总览")
    final = ManualReviewRecord.get_records(batch_id=batch_id)
    for r in final:
        print(f"  {r['question_id']}: 状态={r['current_status']}, 版本={r['prompt_version']}")

    print("=" * 50)
    print("⑦ 验证 W-003 的完整历史（产品经理追证据时用）")
    w003 = next(r for r in final if r['question_id'] == 'W-003')
    history = ManualReviewRecord.get_record_history(w003['id'])
    print(f"  W-003 历史记录：{len(history)} 条")
    for h in history:
        print(f"    - {h['changed_at']} | {h['operator']} | {h['field_name']}")
        print(f"        改前：{h['old_value'] or '(空)'}")
        print(f"        改后：{h['new_value'] or '(空)'}")
        if h.get('change_reason'):
            print(f"        原因：{h['change_reason']}")

    print("\n✅ 端到端完整复现通过：导入→重传→补版本号→改备注→边界规则拦截→产品复核→状态正确流转")
    print("   所有环节都有历史记录，产品经理追问时可回溯证据。")


def run_all_tests():
    print("\n" + "🚀" * 35)
    print("医疗问答安全回放 — 修复后完整测试套件")
    print("重点验证：状态流转不卡、重复导入去重、历史记录四要素、批次回滚留痕")
    print("🚀" * 35)

    init_db()

    try:
        test_step1_normal_sample_status_flow()
        test_step2_404_pass_sample_status_flow()
        test_step3_reimport_no_duplicate()
        test_step4_remark_change_full_traceability()
        test_step5_batch_rollback_with_snapshots()
        test_step6_delete_batch_rollback()
        test_end_to_end_workflow()

        print("\n" + "🎉" * 35)
        print("所有测试通过！修复验证完毕。")
        print("🎉" * 35)
        print("\n修复总结：")
        print("  ✅ 正常样本补填提示词版本后，状态从 pending_prompt → pending_review 正确流转")
        print("  ✅ 404链接+通过结论：边界规则优先级最高，留给产品经理复核")
        print("  ✅ 重复导入不翻倍：同一批次同一行号合并，统计更新/不变/新增")
        print("  ✅ 改备注四要素：改前文本、改后文本、为什么改、谁改的")
        print("  ✅ 批次回滚：两种类型（清重导痕迹 / 彻底删除），前后快照+原因+处理人留痕")
        print("  ✅ 三步流程完整走通：导入→小乔补版本→产品经理复核")

    except AssertionError as e:
        print(f"\n❌ 测试失败：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    run_all_tests()
