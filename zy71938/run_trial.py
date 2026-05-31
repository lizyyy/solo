import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from archive import (
    Archive,
    STATUS_RECEIVED,
    STATUS_REVIEWING,
    STATUS_APPROVED,
    STATUS_PENDING,
    STATUS_REJECTED,
    PENDING_REASON_MISSING_AUTH,
    PENDING_REASON_DUPLICATE,
    PENDING_REASON_REVIEW_CHANGED,
    PENDING_REASON_LABELS,
    STATUS_LABELS,
)

STORE = "trial_store.json"
HANDOVER = "trial_handover.txt"


def clean():
    for p in [STORE, HANDOVER]:
        if os.path.exists(p):
            os.remove(p)


def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def show_record(rec):
    status = STATUS_LABELS.get(rec.status, rec.status)
    pending = ""
    if rec.status == STATUS_PENDING and rec.pending_reason:
        pending = f" ({PENDING_REASON_LABELS.get(rec.pending_reason, rec.pending_reason)})"
    print(f"  [{rec.record_id}] {rec.material_name}")
    print(f"    来源: {rec.source}")
    print(f"    状态: {status}{pending}")
    print(f"    变更次数: {len(rec.changelog)}")
    for entry in rec.changelog:
        print(f"      {entry}")
    print()


def assert_status(rec, expected, label=""):
    ok = rec.status == expected
    tag = f" ({label})" if label else ""
    status_name = STATUS_LABELS.get(rec.status, rec.status)
    expected_name = STATUS_LABELS.get(expected, expected)
    if ok:
        print(f"  ✓{tag} 状态正确: {status_name}")
    else:
        print(f"  ✗{tag} 状态错误: 期望 {expected_name}, 实际 {status_name}")
        sys.exit(1)


def assert_pending_reason(rec, expected_reason, label=""):
    ok = rec.pending_reason == expected_reason
    tag = f" ({label})" if label else ""
    reason_name = PENDING_REASON_LABELS.get(rec.pending_reason, str(rec.pending_reason))
    expected_name = PENDING_REASON_LABELS.get(expected_reason, expected_reason)
    if ok:
        print(f"  ✓{tag} 待处理原因正确: {reason_name}")
    else:
        print(f"  ✗{tag} 待处理原因错误: 期望 {expected_name}, 实际 {reason_name}")
        sys.exit(1)


def assert_changelog_contains(rec, keyword, label=""):
    found = any(keyword in c.action for c in rec.changelog)
    tag = f" ({label})" if label else ""
    if found:
        print(f"  ✓{tag} 变更记录包含: {keyword}")
    else:
        print(f"  ✗{tag} 变更记录未找到: {keyword}")
        for c in rec.changelog:
            print(f"      {c}")
        sys.exit(1)


def run_trial():
    clean()
    arc = Archive(store_path=STORE)

    section("场景1: 正常审稿流程 - 素材录入 → 审稿 → 通过")
    rec1 = arc.submit("618大促主图A", "品牌部-小李", "小李", review_comment="颜色偏暖，建议微调")
    assert_status(rec1, STATUS_REVIEWING, "场景1-录入后应进入审稿中")
    assert_changelog_contains(rec1, "添加审稿意见", "场景1-应有审稿意见记录")
    show_record(rec1)

    arc.update_status(rec1.record_id, STATUS_APPROVED, "小王", detail="审稿通过，无需修改")
    assert_status(rec1, STATUS_APPROVED, "场景1-审稿通过")
    show_record(rec1)

    section("场景2: 缺授权文件 - 录入后直接进待处理")
    rec2 = arc.submit("品牌联名海报B", "代理-星辰创意", "小李", auth_docs_present=False)
    assert_status(rec2, STATUS_PENDING, "场景2-缺授权应进待处理")
    assert_pending_reason(rec2, PENDING_REASON_MISSING_AUTH, "场景2")
    show_record(rec2)

    section("场景2续: 补齐授权后重新审稿")
    arc.update_status(rec2.record_id, STATUS_REVIEWING, "小王", detail="已补授权文件")
    assert_status(arc.get_record(rec2.record_id), STATUS_REVIEWING, "场景2-补授权后转审稿中")
    show_record(arc.get_record(rec2.record_id))
    rec2 = arc.get_record(rec2.record_id)
    if rec2.pending_reason is None:
        print("  ✓(场景2) 转审稿后pending_reason已清空")
    else:
        print(f"  ✗(场景2) 转审稿后pending_reason未清空: {rec2.pending_reason}")
        sys.exit(1)

    section("场景3: 重复素材包 - 同一批内出现重复")
    batch = [
        {"material_name": "618大促视频C", "source": "品牌部-小李", "content_bytes": b"video_c_data"},
        {"material_name": "618大促视频C", "source": "品牌部-小李", "content_bytes": b"video_c_data"},
        {"material_name": "618大促视频D", "source": "代理-星辰创意", "content_bytes": b"video_d_data"},
    ]
    results = arc.submit_batch(batch, "小李")
    dup_rec = results[0]
    assert_status(dup_rec, STATUS_PENDING, "场景3-重复素材应进待处理")
    assert_pending_reason(dup_rec, PENDING_REASON_DUPLICATE, "场景3")
    assert_changelog_contains(dup_rec, "重复", "场景3")
    show_record(dup_rec)

    section("场景4: 审稿意见被修改 - 触发待处理")
    rec4 = arc.submit("端午节KV", "品牌部-老赵", "老赵", review_comment="第一版意见：标题字号加大")
    assert_status(rec4, STATUS_REVIEWING, "场景4-初始审稿中")
    show_record(rec4)

    arc.add_review_comment(rec4.record_id, "小王", "标题字号不需要改了，按原稿", changed=True)
    rec4 = arc.get_record(rec4.record_id)
    assert_status(rec4, STATUS_PENDING, "场景4-修改审稿意见应进待处理")
    assert_pending_reason(rec4, PENDING_REASON_REVIEW_CHANGED, "场景4")
    assert_changelog_contains(rec4, "修改审稿意见", "场景4")
    show_record(rec4)

    section("场景5: 同一素材第二次提交 - 历史不覆盖")
    rec5_first = arc.submit("中秋礼盒海报", "品牌部-小陈", "小陈", review_comment="初版意见")
    assert_status(rec5_first, STATUS_REVIEWING, "场景5-首次录入")
    show_record(rec5_first)

    arc.update_status(rec5_first.record_id, STATUS_APPROVED, "小王", detail="一审通过")
    rec5_first = arc.get_record(rec5_first.record_id)
    assert_status(rec5_first, STATUS_APPROVED, "场景5-一审通过")
    show_record(rec5_first)

    rec5_second = arc.submit("中秋礼盒海报", "品牌部-小陈", "小陈", review_comment="更新版意见：背景色换深蓝")
    assert rec5_second.record_id == rec5_first.record_id, "同一素材二次提交应返回同一条记录"
    rec5_second = arc.get_record(rec5_second.record_id)
    assert_status(rec5_second, STATUS_PENDING, "场景5-二次提交改审稿意见应进待处理")
    assert_changelog_contains(rec5_second, "re_submit", "场景5-应有再次提交记录")
    assert_changelog_contains(rec5_second, "修改审稿意见", "场景5-应有审稿意见修改记录")
    changelog_len = len(rec5_second.changelog)
    print(f"  ✓(场景5) 变更记录共 {changelog_len} 条，历史完整保留")
    show_record(rec5_second)

    section("场景6: 驳回后重新审稿")
    rec6 = arc.submit("国庆预热Banner", "代理-光年设计", "老赵", review_comment="构图偏左")
    arc.update_status(rec6.record_id, STATUS_REVIEWING, "老赵")
    arc.update_status(rec6.record_id, STATUS_REJECTED, "小王", detail="品牌调性不符")
    assert_status(arc.get_record(rec6.record_id), STATUS_REJECTED, "场景6-驳回")
    show_record(arc.get_record(rec6.record_id))

    arc.update_status(rec6.record_id, STATUS_REVIEWING, "老赵", detail="重新提交修改稿")
    assert_status(arc.get_record(rec6.record_id), STATUS_REVIEWING, "场景6-驳回后可重新审稿")
    show_record(arc.get_record(rec6.record_id))

    section("场景7: 通过后因问题退回待处理")
    rec7 = arc.submit("双11预热图", "品牌部-小张", "小张", review_comment="OK")
    arc.update_status(rec7.record_id, STATUS_REVIEWING, "小张")
    arc.update_status(rec7.record_id, STATUS_APPROVED, "小王", detail="审稿通过")
    assert_status(arc.get_record(rec7.record_id), STATUS_APPROVED, "场景7-先通过")

    arc.update_status(rec7.record_id, STATUS_PENDING, "小王", pending_reason=PENDING_REASON_MISSING_AUTH, detail="事后发现缺肖像授权")
    rec7 = arc.get_record(rec7.record_id)
    assert_status(rec7, STATUS_PENDING, "场景7-通过后退回待处理")
    assert_pending_reason(rec7, PENDING_REASON_MISSING_AUTH, "场景7")
    show_record(rec7)

    section("场景8: 非法状态流转应被拒绝")
    rec8 = arc.submit("测试素材", "品牌部-测试", "测试")
    ok = rec8.transition_status(STATUS_APPROVED, "测试")
    if not ok:
        print("  ✓(场景8) received -> approved 被正确拒绝")
    else:
        print("  ✗(场景8) received -> approved 不应被允许")
        sys.exit(1)
    show_record(arc.get_record(rec8.record_id))

    section("汇总: 导出交接说明")
    text = arc.export_handover(output_path=HANDOVER)
    print(f"  交接说明已写入: {HANDOVER}")
    print(f"  文本长度: {len(text)} 字符")
    print()

    all_recs = arc.list_records()
    pending_recs = arc.list_records(status_filter=STATUS_PENDING)
    print(f"  总记录: {len(all_recs)}")
    print(f"  待处理: {len(pending_recs)}")
    for rec in pending_recs:
        reason = PENDING_REASON_LABELS.get(rec.pending_reason, rec.pending_reason or "未标注")
        print(f"    - [{rec.record_id}] {rec.material_name} → {reason}")

    section("验证: 重新加载后数据一致")
    arc2 = Archive(store_path=STORE)
    reloaded = arc2.list_records()
    if len(reloaded) == len(all_recs):
        print(f"  ✓ 重新加载后记录数一致: {len(reloaded)}")
    else:
        print(f"  ✗ 记录数不一致: 期望 {len(all_recs)}, 实际 {len(reloaded)}")
        sys.exit(1)

    for rid, rec in arc.records.items():
        rec2 = arc2.get_record(rid)
        if rec2 is None:
            print(f"  ✗ 记录 {rid} 丢失")
            sys.exit(1)
        if rec2.status != rec.status:
            print(f"  ✗ 记录 {rid} 状态不一致: {rec.status} vs {rec2.status}")
            sys.exit(1)
        if len(rec2.changelog) != len(rec.changelog):
            print(f"  ✗ 记录 {rid} 变更记录数不一致: {len(rec.changelog)} vs {len(rec2.changelog)}")
            sys.exit(1)
    print("  ✓ 所有记录状态和变更历史一致")

    print("\n" + "=" * 60)
    print("  全部场景验证通过 ✓")
    print("=" * 60)


if __name__ == "__main__":
    run_trial()
