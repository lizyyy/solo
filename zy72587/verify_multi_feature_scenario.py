#!/usr/bin/env python3
"""完整复现验证脚本：同一用户多特征场景"""
import sys
from datetime import datetime
sys.path.insert(0, ".")
from app.models import FeatureRecord, RecordStatus, ConflictResolution
from app.workflow import WorkflowManager
from app.result_store import UnifiedResultStore
FEATURE_NAMES = {"clk_7d": "用户近7天点击量", "conv_rt": "用户转化率"}

def make(sid, fid, value=None, default=False, bucket="exp_prod_bucket"):
    return FeatureRecord(
        feature_id=fid, feature_name=FEATURE_NAMES[fid],
        bucket_id=bucket, sample_id=sid, feature_value=value,
        default_value_used=default,
        time_window_start=datetime(2024,1,1), time_window_end=datetime(2024,1,8),
        feature_timestamp=datetime(2024,1,5) if value is not None else None)

def icon(ok):
    return "✅ 满足要求" if ok else "❌ 不满足"

def main():
    R = []
    print("="*80)
    print("时间窗特征穿越检查系统 - 多特征粒度场景完整复现验证")
    print("="*80); print()
    wf = WorkflowManager()
    session = wf.create_session("xiaomeng")
    print("【步骤1 打开入口（创建会话）】")
    ok1 = bool(session.session_id) and session.created_by == "xiaomeng"
    print(f"  会话ID: {session.session_id}")
    print(f"  创建人: {session.created_by}, 当前步骤: {session.current_step}")
    print(f"  结果: {icon(ok1)}"); R.append(("步骤1 创建会话", ok1)); print()
    print("【步骤2 导入线上实验桶（包含user_0002的clk_7d缺失+conv_rt正常）】")
    bucket = [make("user_0001","clk_7d",128), make("user_0002","clk_7d",None,True), make("user_0002","conv_rt",0.05), make("user_0003","clk_7d",56)]
    session = wf.step1_import_bucket(session.session_id, bucket)
    clk = [r for r in session.bucket_records if r.sample_id=="user_0002" and r.feature_id=="clk_7d"][0]
    conv = [r for r in session.bucket_records if r.sample_id=="user_0002" and r.feature_id=="conv_rt"][0]
    ok2 = clk.status in (RecordStatus.FEATURE_MISSING_DEFAULT, RecordStatus.PENDING_REVIEW) and conv.feature_value==0.05
    print(f"  导入记录数: {len(session.bucket_records)}")
    print(f"  user_0002/clk_7d 状态={clk.status}, value={clk.feature_value}, default={clk.default_value_used}")
    print(f"  user_0002/conv_rt 状态={conv.status}, value={conv.feature_value}")
    print(f"  结果: {icon(ok2)}"); R.append(("步骤2 导入线上桶", ok2)); print()
    print("【步骤3 上传负样本（包含user_0002的clk_7d=5+conv_rt正常）】")
    neg = [make("user_0001","clk_7d",128,False,"neg_ref"), make("user_0002","clk_7d",5,False,"neg_ref"), make("user_0002","conv_rt",0.05,False,"neg_ref"), make("user_0003","clk_7d",56,False,"neg_ref")]
    session = wf.step2_review_negatives(session.session_id, neg)
    print(f"  负样本数={len(session.negative_records)}, 冲突数={len(session.conflicts)}")
    for c in session.conflicts: print(f"    - {c.record_id}: {c.description[:60]}")
    unique_conflicts = {c.record_id for c in session.conflicts}
    ok3 = len(unique_conflicts)==1 and "user_0002:clk_7d" in unique_conflicts
    print(f"  结果: {icon(ok3)}"); R.append(("步骤3 上传负样本", ok3)); print()
    print("【步骤4 检查冲突数量应为1（clk_7d），打印两个特征状态】")
    clk4 = [r for r in session.bucket_records if r.sample_id=="user_0002" and r.feature_id=="clk_7d"][0]
    conv4 = [r for r in session.bucket_records if r.sample_id=="user_0002" and r.feature_id=="conv_rt"][0]
    print(f"  clk_7d: status={clk4.status}, history={len(clk4.status_history)}条")
    print(f"  conv_rt: status={conv4.status}, history={len(conv4.status_history)}条")
    unique_conflicts4 = {c.record_id for c in session.conflicts}
    ok4 = len(unique_conflicts4)==1 and conv4.status!=RecordStatus.CONFLICT
    print(f"  结果: {icon(ok4)}"); R.append(("步骤4 冲突数量+特征状态检查", ok4)); print()
    conv_hist_before = len(conv4.status_history)
    print("【步骤5 补录缺失特征：把user_0002的clk_7d原始值补为25】")
    sd = {"user_0002": {"clk_7d": 25}}
    session = wf.resupplement_and_recalculate(session.session_id, sd)
    clk5 = [r for r in session.bucket_records if r.sample_id=="user_0002" and r.feature_id=="clk_7d"][0]
    print(f"  clk_7d 新值={clk5.feature_value}, default={clk5.default_value_used}, status={clk5.status}")
    ok5 = clk5.feature_value==25 and clk5.default_value_used==False
    print(f"  结果: {icon(ok5)}"); R.append(("步骤5 补录缺失特征", ok5)); print()
    print("【步骤6 保存处理：单独处理user_0002:clk_7d冲突为confirm】")
    tid = next((c.record_id for c in session.conflicts if c.sample_id=="user_0002" and c.feature_id=="clk_7d"), None)
    print(f"  目标record_id: {tid}")
    session = wf.resolve_conflict(session.session_id, tid, ConflictResolution.CONFIRM, "xiaomeng")
    clk6 = [r for r in session.bucket_records if r.sample_id=="user_0002" and r.feature_id=="clk_7d"][0]
    conv6 = [r for r in session.bucket_records if r.sample_id=="user_0002" and r.feature_id=="conv_rt"][0]
    pend = [c for c in session.conflicts if c.resolution==ConflictResolution.PENDING]
    print(f"  clk_7d处理后: status={clk6.status}, history={len(clk6.status_history)}条")
    print(f"  conv_rt状态: status={conv6.status}, history={len(conv6.status_history)}条 (之前={conv_hist_before})")
    print(f"  剩余待处理冲突数: {len(pend)}")
    ok6 = len(conv6.status_history)==conv_hist_before
    print(f"  结果: {icon(ok6)}"); R.append(("步骤6 单独处理clk_7d冲突", ok6)); print()
    print("【步骤7 刷新列表（重新取records和conflicts），验证conv_rt未改动】")
    fr = list(session.bucket_records); fc = list(session.conflicts)
    conv7 = [r for r in fr if r.sample_id=="user_0002" and r.feature_id=="conv_rt"][0]
    clk7 = [r for r in fr if r.sample_id=="user_0002" and r.feature_id=="clk_7d"][0]
    print(f"  总记录数={len(fr)}, 冲突数={len(fc)}")
    print(f"  conv_rt 值={conv7.feature_value}, status={conv7.status}, history={len(conv7.status_history)}条")
    print(f"  clk_7d 值={clk7.feature_value}, status={clk7.status}, default={clk7.default_value_used}")
    ok7 = conv7.feature_value==0.05 and len(conv7.status_history)==conv_hist_before
    print(f"  结果: {icon(ok7)}"); R.append(("步骤7 刷新验证conv_rt未改动", ok7)); print()
    print("【步骤8 重算自检：打印所有自检项】")
    hrc = hcc = 0
    for r in session.self_check_results:
        si = "✅" if r.passed else "❌"
        print(f"  {si} {r.check_type}: passed={r.passed}, issues={r.found_issues}")
        if r.details: print(f"      详情: {str(r.details)[:80]}")
        if ("补录" in r.check_type or "Pending" in r.check_type or "pending" in r.check_type.lower()) and r.passed: hrc += 1
        if ("三端" in r.check_type or "consistency" in r.check_type.lower()) and r.passed: hcc += 1
    ok8 = hrc>=1 and hcc>=1
    print(f"  自检项数={len(session.self_check_results)}, 补录自检通过={hrc>=1}, 一致性通过={hcc>=1}")
    print(f"  结果: {icon(ok8)}"); R.append(("步骤8 自检项完整性检查", ok8)); print()
    print("【步骤9 导出内容预览：user_0002两条记录详情】")
    store = UnifiedResultStore(session)
    er = store.get_all_records_for_export()
    ec = store.get_conflicts_for_export()
    u2r = [r for r in er if r.get("样本ID")=="user_0002"]
    u2c = [c for c in ec if c.get("样本ID")=="user_0002"]
    print(f"  user_0002记录条数: {len(u2r)}")
    for i, rec in enumerate(u2r):
        fn = rec.get("特征名称",""); fi = rec.get("特征ID","")
        print(f"  --- 记录{i+1}: {fn}({fi}) ---")
        ov = rec.get("特征原始值(线上回传)", "N/A")
        nv = rec.get("特征当前展示值", "N/A")
        print(f"    线上原始值: {ov}")
        print(f"    特征当前展示值: {nv}")
        st = rec.get("最终状态(中文)", "N/A")
        print(f"    最终状态: {st}")
        hi = rec.get("历史留痕(完整状态变更链)", "")
        hc = len(hi.split("|")) if hi else 0
        print(f"    历史留痕: {hc}条")
        if hi:
            last_two = hi.split(" | ")[-2:]
            for h in last_two: print(f"      -> {str(h)[:80]}")
        no = rec.get("结果说明(可解释)", "N/A")
        src = rec.get("数据来源", "N/A")
        print(f"    数据来源: {src}")
        print(f"    结果说明: {str(no)[:80]}")
    print(f"  冲突Sheet user_0002条数: {len(u2c)}")
    for c in u2c:
        ri = c.get("记录唯一标识","N/A")
        o = c.get("线上实验桶取值","N/A")
        n = c.get("负样本列表取值","N/A")
        s = c.get("处理状态","N/A")
        print(f"    - {ri}: 线上={o} vs 负样本={n}, 状态={s}")
    ha = any("clk_7d" in str(r.get("特征ID","")) for r in u2r)
    hb = any("conv_rt" in str(r.get("特征ID","")) for r in u2r)
    ok9 = len(u2r)>=2 and ha and hb
    print(f"  结果: {icon(ok9)}"); R.append(("步骤9 导出预览特征粒度", ok9)); print()
    print("="*80)
    print("总总结")
    print("="*80)
    all_ok = True
    for nm, ok in R:
        ic = "✅" if ok else "❌"
        print(f"  {ic} {nm}")
        if not ok: all_ok = False
    print("-"*80)
    if all_ok: print("🎉 所有 9 个步骤均满足要求！系统多特征粒度工作正常。")
    else:
        failed = [n for n, o in R if not o]
        print(f"⚠️  有 {len(failed)} 项不满足要求: {failed}")
    print("="*80)
    return 0 if all_ok else 1

if __name__ == "__main__": exit(main())
    has_resupp_check = False
    has_consistency_check = False
    for r in session.self_check_results:
        status_icon = "✅" if r.passed else "❌"
        print(f"  {status_icon} {r.check_type}: passed={r.passed}, found_issues={r.found_issues}")
        if r.details:
            print(f"      详情: {str(r.details)[:100]}")
        if "补录" in r.check_type or "Pending" in r.check_type or "pending" in r.check_type.lower():
            has_resupp_check = True
            if r.passed:
                ok8_items.append(True)
        if "三端" in r.check_type or "Three" in r.check_type or "consistency" in r.check_type.lower():
            has_consistency_check = True
            if r.passed:
                ok8_items.append(True)
    ok8 = has_resupp_check and has_consistency_check and len(ok8_items) >= 2
    print(f"  自检项数: {len(session.self_check_results)}")
    print(f"  包含补录后重算正确性: {has_resupp_check}")
    print(f"  包含三端数据一致性: {has_consistency_check}")
    icon8 = "✅ 满足要求" if ok8 else "❌ 不满足"
    print(f"  结果: {icon8}")
    results.append(("步骤8 自检项完整性检查", ok8))
    print()

    # ====== 步骤9：导出内容预览 ======
    print("【步骤9 导出内容预览：user_0002两条记录详情】")
    store = UnifiedResultStore(session)
    export_records = store.get_all_records_for_export()
    export_conflicts = store.get_conflicts_for_export()
    user0002_records = [r for r in export_records if r.get("样本ID") == "user_0002"]
    user0002_conflicts = [c for c in export_conflicts if c.get("样本ID") == "user_0002"]
    print(f"  user_0002 记录条数: {len(user0002_records)}")
    for i, rec in enumerate(user0002_records):
        fname = rec.get("特征名称", "")
        fid = rec.get("特征ID", "")
        print(f"  --- 记录 {i+1}: {fname}({fid}) ---")
        fval_online = rec.get("特征值(线上)", rec.get("特征值", "N/A"))
        print(f"    线上值: {fval_online}")
        neg_val = "N/A"
        for cc in user0002_conflicts:
            if cc.get("特征ID") == rec.get("特征ID"):
                neg_val = cc.get("负样本列表取值", "N/A")
                break
        print(f"    负样本值: {neg_val}")
        final_status = rec.get("最终状态", rec.get("状态", "N/A"))
        print(f"    状态: {final_status}")
        hist = rec.get("状态变更历史", rec.get("history", []))
        hist_count = len(hist) if isinstance(hist, list) else 0
        print(f"    历史留痕: {hist_count}条")
        if hist and isinstance(hist, list):
            for h in hist[-2:]:
                print(f"      -> {str(h)[:80]}")
        note = rec.get("说明", rec.get("备注", "N/A"))
        print(f"    说明: {str(note)[:80]}")
    print(f"  冲突Sheet user_0002条数: {len(user0002_conflicts)}")
    for c in user0002_conflicts:
        rid = c.get("记录唯一标识", "N/A")
        ov = c.get("线上实验桶取值", "N/A")
        nv = c.get("负样本列表取值", "N/A")
        st = c.get("处理状态", "N/A")
        print(f"    - {rid}: 线上={ov} vs 负样本={nv}, 状态={st}")
    has_clk = any("clk_7d" in str(r.get("特征ID", "")) for r in user0002_records)
    has_conv = any("conv_rt" in str(r.get("特征ID", "")) for r in user0002_records)
    ok9 = len(user0002_records) >= 2 and has_clk and has_conv
    icon9 = "✅ 满足要求" if ok9 else "❌ 不满足"
    print(f"  结果: {icon9}")
    results.append(("步骤9 导出预览特征粒度", ok9))
    print()

    # ====== 总总结 ======
    print("=" * 80)
    print("总总结")
    print("=" * 80)
    all_pass = True
    for name, ok in results:
        icon = "✅" if ok else "❌"
        print(f"  {icon} {name}")
        if not ok:
            all_pass = False
    print("-" * 80)
    if all_pass:
        print("🎉 所有 9 个步骤均满足要求！系统多特征粒度工作正常。")
    else:
        failed = [n for n, o in results if not o]
        print(f"⚠️  有 {len(failed)} 项不满足要求: {failed}")
    print("=" * 80)
    return 0 if all_pass else 1


if __name__ == "__main__":
    exit(main())
