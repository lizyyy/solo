from datetime import datetime
from models import AuditStatus, RecordSource
from demo_data import create_demo_data, create_initial_feature_versions
from audit_engine import SparseFeatureAuditEngine


def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)


def print_record_summary(record, show_history=True):
    print(f"\n【评测切片】{record.eval_slice.slice_name}")
    print(f"  切片ID: {record.slice_id}")
    print(f"  数据批次: {record.eval_slice.data_batch_id}")
    print(f"  来源: {record.source.value}")
    print(f"  当前状态: {record.current_status.value}")
    print(f"  特征快照: {record.eval_slice.feature_snapshot_id or '未关联'}")
    print(f"  口径版本: {record.eval_slice.caliber_version or '未确定'}")
    
    if record.is_duplicate_training:
        print(f"  ⚠️  重复训练: 是 (与 {record.duplicate_with_slice} 重复)")
    if record.supplement_from_snapshot:
        print(f"  📋 补录来源: 快照 {record.supplement_from_snapshot}")
    
    if record.feature_versions:
        print(f"  关联版本数: {len(record.feature_versions)}")
        for v in record.feature_versions:
            print(f"    - {v.version_id}: {v.feature_name} {v.caliber_version} (默认值: {v.default_value})")
    
    if show_history and record.history:
        print(f"\n  操作历史:")
        for i, h in enumerate(record.history, 1):
            status_change = f"{h.before_status.value} → {h.after_status.value}" if h.before_status and h.after_status else ""
            print(f"    {i}. [{h.operate_time.strftime('%m-%d %H:%M')}] {h.operation} - {h.operator}")
            if status_change:
                print(f"       状态: {status_change}")
            if h.remark:
                print(f"       备注: {h.remark}")


def print_feature_version_table(engine):
    print("\n" + "-" * 80)
    print("  特征版本表")
    print("-" * 80)
    print(f"  {'版本ID':<10} {'特征名':<30} {'口径':<8} {'默认值':<10} {'生效':<6} {'来源切片':<12}")
    print("  " + "-" * 76)
    for v in engine.feature_versions:
        active = "✓" if v.is_active else "✗"
        source = v.source_slice_id or "初始化"
        print(f"  {v.version_id:<10} {v.feature_name:<30} {v.caliber_version:<8} {str(v.default_value):<10} {active:<6} {source:<12}")


def run_normal_scenario(engine):
    print_separator("场景一：顺利记录（正常流程）")
    print("\n步骤1：评测切片已导入 (SLICE-001)")
    
    record = engine.records["SLICE-001"]
    print_record_summary(record, show_history=False)
    
    print("\n步骤2：算法工程师小乔补看特征快照编号 (SNAP-002)")
    success, msg = engine.check_snapshot_by_xiaoqiao("SLICE-001", "SNAP-002")
    print(f"  结果: {msg}")
    
    print("\n步骤3：更新特征版本表")
    success, msg = engine.update_feature_version_table("SLICE-001")
    print(f"  结果: {msg}")
    
    success, msg = engine.complete_record("SLICE-001")
    print(f"  结果: {msg}")
    
    print_record_summary(record)
    return record


def run_duplicate_training_scenario(engine):
    print_separator("场景二：同一批数据重复训练两次")
    
    print("\n先处理第一条正常记录 (SLICE-002):")
    success, msg = engine.check_snapshot_by_xiaoqiao("SLICE-002", "SNAP-003")
    print(f"  SLICE-002: {msg}")
    success, msg = engine.update_feature_version_table("SLICE-002")
    print(f"  SLICE-002: {msg}")
    success, msg = engine.complete_record("SLICE-002")
    print(f"  SLICE-002: {msg}")
    
    print("\n现在处理重复导入的同批次数据 (SLICE-002-DUP):")
    print("\n步骤1：评测切片已导入 (SLICE-002-DUP)")
    record_dup = engine.records["SLICE-002-DUP"]
    print_record_summary(record_dup, show_history=False)
    
    print("\n步骤2：算法工程师小乔补看特征快照编号 (SNAP-003)")
    print("  ⚠️  系统检测到同一批数据(BATCH-20260602-B) + 同一快照(SNAP-003) 重复训练")
    print("  📌 关键逻辑：别急着归正常，留给策略产品复核")
    success, msg = engine.check_snapshot_by_xiaoqiao("SLICE-002-DUP", "SNAP-003")
    print(f"  结果: {msg}")
    
    print("\n步骤3：尝试更新特征版本表（应该被拦截）")
    success, msg = engine.update_feature_version_table("SLICE-002-DUP")
    print(f"  结果: {msg}")
    
    print("\n步骤4：策略产品复核（假设通过）")
    success, msg = engine.product_review_duplicate("SLICE-002-DUP", approve=True)
    print(f"  结果: {msg}")
    
    print("\n步骤5：产品复核通过后，再更新版本表并完成")
    success, msg = engine.update_feature_version_table("SLICE-002-DUP")
    print(f"  结果: {msg}")
    success, msg = engine.complete_record("SLICE-002-DUP")
    print(f"  结果: {msg}")
    
    print_record_summary(record_dup)
    return record_dup


def run_supplement_scenario(engine):
    print_separator("场景三：从特征快照编号补来的旧口径")
    print("\n步骤1：评测切片已导入 (SLICE-003，人工补录历史数据，快照缺失)")
    
    record = engine.records["SLICE-003"]
    print_record_summary(record, show_history=False)
    
    print("\n步骤2：算法工程师小乔补看特征快照，从历史快照补录 (SNAP-001 旧口径)")
    print("  📌 SNAP-001 是旧口径 v2.1，默认值-1，已不是当前快照")
    success, msg = engine.supplement_snapshot_for_old_data("SLICE-003", "SNAP-001")
    print(f"  结果: {msg}")
    
    print("\n步骤3：更新特征版本表（补录旧口径）")
    success, msg = engine.update_feature_version_table("SLICE-003")
    print(f"  结果: {msg}")
    
    print("\n步骤4：人工修正（发现旧口径有问题，切换到新口径）")
    print("  📌 一次人工修正：SNAP-001 → SNAP-002")
    success, msg = engine.manual_correction(
        "SLICE-003", "SNAP-001", "SNAP-002",
        reason="旧口径默认值统计异常，切换至新口径v2.2"
    )
    print(f"  结果: {msg}")
    
    print("\n步骤5：修正后重新更新版本表")
    success, msg = engine.update_feature_version_table("SLICE-003")
    print(f"  结果: {msg}")
    
    print("\n步骤6：一次重跑")
    success, msg = engine.rerun_slice("SLICE-003")
    print(f"  结果: {msg}")
    
    success, msg = engine.complete_record("SLICE-003")
    print(f"  结果: {msg}")
    
    print_record_summary(record)
    return record


def compare_results(record1, record2, record3):
    print_separator("三种处理结果对比")
    
    print("\n" + "-" * 80)
    print(f"  {'对比项':<20} {'场景一：顺利记录':<25} {'场景二：重复训练':<25} {'场景三：补录旧口径':<25}")
    print("  " + "-" * 80)
    
    items = [
        ("最终状态", record1.current_status.value, record2.current_status.value, record3.current_status.value),
        ("数据来源", record1.source.value, record2.source.value, record3.source.value),
        ("是否重复训练", "否", "是", "否"),
        ("是否补录", "否", "否", "是"),
        ("关联快照数", str(len(record1.feature_snapshots)), str(len(record2.feature_snapshots)), str(len(record3.feature_snapshots))),
        ("人工修正次数", str(len(record1.corrections)), str(len(record2.corrections)), str(len(record3.corrections))),
        ("重跑次数", str(len([h for h in record1.history if h.operation == "重跑评测"])),
                     str(len([h for h in record2.history if h.operation == "重跑评测"])),
                     str(len([h for h in record3.history if h.operation == "重跑评测"]))),
        ("产品复核", "无", "有（通过）", "无"),
        ("操作步骤数", str(len(record1.history)), str(len(record2.history)), str(len(record3.history))),
    ]
    
    for item in items:
        print(f"  {item[0]:<20} {item[1]:<25} {item[2]:<25} {item[3]:<25}")
    
    print("\n" + "=" * 80)
    print("  关键差异说明:")
    print("  1. 顺利记录：3步走完（导入→核验→更新版本→完成），最简洁")
    print("  2. 重复训练：检测到重复后自动转产品复核，不直接归正常，需产品确认")
    print("  3. 补录旧口径：来源标记为补录，含人工修正和重跑，操作链路最长")
    print("=" * 80)


def main():
    print("\n" + "▓" * 80)
    print("  稀疏特征默认值审计 - 演示系统")
    print("  演示人：算法工程师小乔")
    print("  目标：展示三种典型场景的处理流程差异")
    print("▓" * 80)
    
    data = create_demo_data()
    initial_versions = create_initial_feature_versions()
    
    engine = SparseFeatureAuditEngine()
    engine.load_snapshots(data["feature_snapshots"])
    engine.load_initial_versions(initial_versions)
    engine.load_records(data["records"])
    
    print("\n初始特征版本表:")
    print_feature_version_table(engine)
    
    r1 = run_normal_scenario(engine)
    r2 = run_duplicate_training_scenario(engine)
    r3 = run_supplement_scenario(engine)
    
    print_separator("最终特征版本表")
    print_feature_version_table(engine)
    
    compare_results(r1, r2, r3)
    
    print("\n" + "▓" * 80)
    print("  演示完成！")
    print("  ✓ 场景一：顺利记录 - 正常流程闭环")
    print("  ✓ 场景二：重复训练 - 转策略产品复核，不直接归正常")
    print("  ✓ 场景三：补录旧口径 - 含人工修正+一次重跑")
    print("  ✓ 三步核心流程：导入 → 小乔看快照 → 更新版本表")
    print("▓" * 80 + "\n")


if __name__ == "__main__":
    main()
