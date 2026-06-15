from datetime import datetime
from models import AuditStatus, RecordSource
from demo_data import create_demo_data, create_initial_feature_versions
from audit_engine import SparseFeatureAuditEngine


def print_divider(char="=", length=70, title=""):
    if title:
        print(f"\n{char * length}")
        print(f"  {title}")
        print(char * length)
    else:
        print(f"\n{char * length}")


def print_status_snapshot(record, step_name):
    print(f"\n  【状态快照】{step_name}")
    print(f"  ─────────────────────────────────────────")
    print(f"  切片ID:     {record.slice_id}")
    print(f"  切片名称:   {record.eval_slice.slice_name}")
    print(f"  数据批次:   {record.eval_slice.data_batch_id}")
    print(f"  当前状态:   {record.current_status.value}")
    print(f"  特征快照:   {record.eval_slice.feature_snapshot_id or '未关联'}")
    print(f"  口径版本:   {record.eval_slice.caliber_version or '未确定'}")
    print(f"  重复训练:   {'是' if record.is_duplicate_training else '否'}")
    if record.is_duplicate_training:
        print(f"    └ 重复对象: {record.duplicate_with_slice}")
        print(f"    └ 已复核:   {'是' if record.duplicate_reviewed else '否'}")
        print(f"    └ 复核结果: {'通过' if record.duplicate_approved else '驳回' if record.duplicate_approved is not None else '未复核'}")
    print(f"  关联版本数: {len(record.feature_versions)}")


def print_history_timeline(record):
    print(f"\n  【操作历史时间线】")
    print(f"  ─────────────────────────────────────────")
    for i, h in enumerate(record.history, 1):
        status_flow = ""
        if h.before_status and h.after_status:
            status_flow = f"[{h.before_status.value} → {h.after_status.value}]"
        elif h.after_status:
            status_flow = f"[→ {h.after_status.value}]"
        
        print(f"  {i:2d}. {h.operation}")
        print(f"      操作人: {h.operator}  |  时间: {h.operate_time.strftime('%H:%M:%S')}")
        if status_flow:
            print(f"      状态流转: {status_flow}")
        if h.remark:
            print(f"      备注: {h.remark}")
        if h.detail:
            detail_str = ", ".join(f"{k}={v}" for k, v in list(h.detail.items())[:3])
            print(f"      详情: {detail_str}")


def run_duplicate_training_bug_demo():
    """
    用出问题的样例重新走流程，停在关键节点查看状态变化、历史留痕和结果说明
    """
    print_divider("▓", 70, "重复训练场景 - 问题复现与修复验证")
    print("  目标：走完三步核心流程，验证重复训练数据能否正确闭环")
    print("  样例：SLICE-002（首条） + SLICE-002-DUP（同批次重复导入）")
    
    data = create_demo_data()
    initial_versions = create_initial_feature_versions()
    
    engine = SparseFeatureAuditEngine()
    engine.load_snapshots(data["feature_snapshots"])
    engine.load_initial_versions(initial_versions)
    engine.load_records({
        "SLICE-002": data["records"]["SLICE-002"],
        "SLICE-002-DUP": data["records"]["SLICE-002-DUP"],
    })
    
    print_divider("─", 70, "【前置】先处理首条正常记录 SLICE-002")
    
    print("\n  → 步骤1：首条记录已导入")
    print_status_snapshot(engine.records["SLICE-002"], "导入后")
    
    print("\n  → 步骤2：算法工程师小乔补看特征快照编号 (SNAP-003)")
    success, msg = engine.check_snapshot_by_xiaoqiao("SLICE-002", "SNAP-003")
    print(f"  结果: {msg}")
    print_status_snapshot(engine.records["SLICE-002"], "快照核验后")
    
    print("\n  → 步骤3：更新特征版本表")
    success, msg = engine.update_feature_version_table("SLICE-002")
    print(f"  结果: {msg}")
    print_status_snapshot(engine.records["SLICE-002"], "版本表更新后")
    
    success, msg = engine.complete_record("SLICE-002")
    print(f"  标记完成: {msg}")
    print_status_snapshot(engine.records["SLICE-002"], "完成后")
    
    print_divider("─", 70, "【重点】处理重复训练记录 SLICE-002-DUP")
    
    record_dup = engine.records["SLICE-002-DUP"]
    
    print("\n  === 第一步：评测切片第一次导入 ===")
    print_status_snapshot(record_dup, "初始导入状态")
    print_history_timeline(record_dup)
    
    print("\n" + " " * 2 + "▲ 此时状态：已导入，特征快照已关联，但尚未核验")
    input("  按回车继续...")
    
    print("\n  === 第二步：算法工程师小乔补看特征快照编号 ===")
    print("\n  调用: check_snapshot_by_xiaoqiao('SLICE-002-DUP', 'SNAP-003')")
    print("  预期: 检测到与 SLICE-002 同批次+同快照，判定为重复训练")
    print("  预期: 不直接归正常，转策略产品复核")
    
    success, msg = engine.check_snapshot_by_xiaoqiao("SLICE-002-DUP", "SNAP-003")
    print(f"\n  ✅ 实际结果: {msg}")
    
    print_status_snapshot(record_dup, "快照核验后（检测到重复）")
    print_history_timeline(record_dup)
    
    print("\n  " + "=" * 50)
    print("  🔍 关键检查点 1：状态是否停在策略产品复核中？")
    print(f"     当前状态: {record_dup.current_status.value}")
    is_product_review = record_dup.current_status == AuditStatus.PRODUCT_REVIEW
    print(f"     检查结果: {'✅ 正确 - 停在产品复核中' if is_product_review else '❌ 错误 - 状态不对'}")
    print("  " + "=" * 50)
    
    input("\n  按回车继续...")
    
    print("\n  === 第三步（尝试）：特征版本表更新 ===")
    print("\n  调用: update_feature_version_table('SLICE-002-DUP')")
    print("  预期: 被拦截，因为重复训练待产品复核")
    
    success, msg = engine.update_feature_version_table("SLICE-002-DUP")
    print(f"\n  ✅ 实际结果: {msg}")
    
    print_status_snapshot(record_dup, "尝试更新版本表后")
    
    print("\n  " + "=" * 50)
    print("  🔍 关键检查点 2：版本表更新是否被正确拦截？")
    print(f"     当前状态: {record_dup.current_status.value}")
    print(f"     关联版本数: {len(record_dup.feature_versions)}")
    intercepted = len(record_dup.feature_versions) == 0 and record_dup.current_status == AuditStatus.PRODUCT_REVIEW
    print(f"     检查结果: {'✅ 正确 - 已拦截，无版本关联' if intercepted else '❌ 错误 - 未正确拦截'}")
    print("  " + "=" * 50)
    
    input("\n  按回车继续...")
    
    print("\n  === 尝试标记完成（应该失败） ===")
    print("\n  调用: complete_record('SLICE-002-DUP')")
    print("  预期: 失败，因为状态是策略产品复核中")
    
    success, msg = engine.complete_record("SLICE-002-DUP")
    print(f"\n  ❌ 实际结果: {msg}")
    
    print("\n  " + "=" * 50)
    print("  🔍 关键检查点 3：产品复核中是否不能标记为完成？")
    print(f"     操作结果: {'失败 - 正确拦截' if not success else '成功 - 有问题'}")
    print(f"     当前状态: {record_dup.current_status.value}")
    print(f"     检查结果: {'✅ 正确 - 产品复核中不能标记完成' if not success else '❌ 错误 - 不应允许完成'}")
    print("  " + "=" * 50)
    
    input("\n  按回车继续...")
    
    print("\n  === 策略产品复核通过 ===")
    print("\n  调用: product_review_duplicate('SLICE-002-DUP', approve=True)")
    print("  预期: 状态变为正常，标记已复核通过")
    
    success, msg = engine.product_review_duplicate("SLICE-002-DUP", approve=True)
    print(f"\n  ✅ 实际结果: {msg}")
    
    print_status_snapshot(record_dup, "产品复核通过后")
    print_history_timeline(record_dup)
    
    print("\n  " + "=" * 50)
    print("  🔍 关键检查点 4：复核通过后状态与标志是否正确？")
    print(f"     当前状态: {record_dup.current_status.value}")
    print(f"     duplicate_reviewed: {record_dup.duplicate_reviewed}")
    print(f"     duplicate_approved: {record_dup.duplicate_approved}")
    all_correct = (record_dup.current_status == AuditStatus.NORMAL and 
                   record_dup.duplicate_reviewed == True and 
                   record_dup.duplicate_approved == True)
    print(f"     检查结果: {'✅ 正确 - 状态与标志均正确' if all_correct else '❌ 错误'}")
    print("  " + "=" * 50)
    
    input("\n  按回车继续...")
    
    print("\n  === 第三步（正式）：特征版本表更新 ===")
    print("\n  调用: update_feature_version_table('SLICE-002-DUP')")
    print("  预期: 正常更新版本表，不再被拦截")
    
    success, msg = engine.update_feature_version_table("SLICE-002-DUP")
    print(f"\n  ✅ 实际结果: {msg}")
    
    print_status_snapshot(record_dup, "版本表更新后")
    
    print("\n  " + "=" * 50)
    print("  🔍 关键检查点 5：复核通过后能否正常更新版本表？")
    print(f"     操作结果: {'成功' if success else '失败'}")
    print(f"     关联版本数: {len(record_dup.feature_versions)}")
    print(f"     当前状态: {record_dup.current_status.value}")
    version_ok = success and len(record_dup.feature_versions) > 0 and record_dup.current_status == AuditStatus.NORMAL
    print(f"     检查结果: {'✅ 正确 - 已正常更新版本表' if version_ok else '❌ 错误'}")
    print("  " + "=" * 50)
    
    input("\n  按回车继续...")
    
    print("\n  === 标记完成 ===")
    print("\n  调用: complete_record('SLICE-002-DUP')")
    print("  预期: 成功标记为完成")
    
    success, msg = engine.complete_record("SLICE-002-DUP")
    print(f"\n  ✅ 实际结果: {msg}")
    
    print_status_snapshot(record_dup, "最终完成后")
    print_history_timeline(record_dup)
    
    print("\n  " + "=" * 50)
    print("  🔍 关键检查点 6：最终能否正常完成？")
    print(f"     操作结果: {'成功' if success else '失败'}")
    print(f"     最终状态: {record_dup.current_status.value}")
    final_ok = success and record_dup.current_status == AuditStatus.COMPLETED
    print(f"     检查结果: {'✅ 正确 - 流程完整闭环' if final_ok else '❌ 错误'}")
    print("  " + "=" * 50)
    
    print_divider("─", 70, "重复训练场景 - 完整历史留痕")
    print_history_timeline(record_dup)
    
    print_divider("─", 70, "重复训练场景 - 特征版本表")
    print(f"\n  {'版本ID':<10} {'特征名':<30} {'口径':<8} {'默认值':<10} {'生效':<6} {'来源切片':<12}")
    print("  " + "-" * 76)
    for v in engine.feature_versions:
        active = "✓" if v.is_active else "✗"
        source = v.source_slice_id or "初始化"
        print(f"  {v.version_id:<10} {v.feature_name:<30} {v.caliber_version:<8} {str(v.default_value):<10} {active:<6} {source:<12}")
    
    print_divider("▓", 70, "修复验证结论")
    print("  ✅ 问题已修复：重复训练数据不再卡在产品复核中无法推进")
    print("  ✅ 状态流转正确：导入→核验(检测重复)→产品复核→更新版本→完成")
    print("  ✅ 历史留痕完整：每一步操作都有记录，状态流转可追溯")
    print("  ✅ 关键逻辑：同一批数据重复训练两次时，别急着归正常，留给策略产品复核")
    print("  ✅ 特征版本表与历史记录可对账")
    
    return engine, record_dup


def main():
    print("\n" + "▓" * 70)
    print("  稀疏特征默认值审计 - 问题复现与修复验证")
    print("  聚焦：重复训练场景的状态流转与历史留痕")
    print("▓" * 70)
    
    engine, record = run_duplicate_training_bug_demo()
    
    print("\n" + "▓" * 70)
    print("  总结：修复前后对比")
    print("▓" * 70)
    
    print("\n  修复前的问题：")
    print("    1. 产品复核通过后，再次更新版本表仍被拦截")
    print("    2. 状态被错误地打回策略产品复核中")
    print("    3. 最终无法标记为完成")
    print("    根因：只检查 is_duplicate_training，未检查是否已复核")
    
    print("\n  修复后的效果：")
    print("    1. 新增 duplicate_reviewed / duplicate_approved 标志")
    print("    2. 只有未复核的重复训练数据才会被拦截")
    print("    3. 产品复核通过后可正常更新版本表并标记完成")
    print("    4. 完整的历史留痕，每一步状态变化都可追溯")
    
    print("\n  三步核心流程验证：")
    print("    ✓ 评测切片第一次导入")
    print("    ✓ 算法工程师小乔补看特征快照编号")
    print("    ✓ 特征版本表更新（重复训练需先过产品复核）")
    print("▓" * 70 + "\n")


if __name__ == "__main__":
    main()
