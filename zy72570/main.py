#!/usr/bin/env python3
from datetime import datetime
from models import (
    RecordStatus,
    RecordSource,
    ParameterVersion,
)
from sample_data import (
    create_normal_material,
    create_wrong_caliber_material,
    create_supplementary_material,
)
from distillation_engine import AnomalyRuleDistillationEngine


def print_separator(title: str):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_record(record, show_params: bool = True):
    print(f"  特征ID: {record.feature_id}")
    print(f"  特征名称: {record.feature_name}")
    print(f"  特征版本: {record.feature_version}")
    print(f"  口径: {record.caliber}")
    print(f"  来源: {record.source.value}")
    print(f"  状态: {record.status.value}")
    print(f"  训练批次: {record.training_batch_id}")
    print(f"  导入时间: {record.import_timestamp.strftime('%Y-%m-%d %H:%M:%S')}")

    if record.duplicate_of:
        print(f"  重复标记: 重复于 {record.duplicate_of}")
    if record.supplementary_from:
        print(f"  补录来源: {record.supplementary_from}")
    if record.review_notes:
        print(f"  审核备注:")
        for note in record.review_notes:
            print(f"    - {note}")
    if record.conflict_evidence:
        print(f"  冲突证据:")
        for ev in record.conflict_evidence:
            print(f"    ! {ev}")
    if show_params and record.parameter_versions:
        print(f"  参数版本:")
        for pv in record.parameter_versions:
            print(f"    * {pv.param_name} ({pv.version}) = {pv.value}")
            print(f"      取舍理由: {pv.reason}")
    print()


def run_normal_material():
    print_separator("【材料一】正常材料 - 线上实验桶与负样本列表口径一致")

    engine = AnomalyRuleDistillationEngine()
    bucket, neg_list = create_normal_material()

    feature_params = {
        "feat-001": [
            ParameterVersion(
                param_name="amount_threshold",
                version="v2.1",
                value=5000,
                reason="根据Q2风控策略调整，阈值从3000提升至5000，验证AUC提升2.3%",
            ),
        ],
        "feat-002": [
            ParameterVersion(
                param_name="freq_threshold",
                version="v1.2",
                value=10,
                reason="日交易频次阈值，参考同业标准设定",
            ),
        ],
    }

    print("\n>>> 步骤1: 线上实验桶第一次导入")
    imported = engine.step1_import_online_experiment_bucket(bucket, feature_params)
    for r in imported:
        print_record(r)

    print("\n>>> 步骤2: 数据科学家林姐补看负样本列表")
    reviewed = engine.step2_scientist_review_negative_samples(neg_list)
    for r in reviewed.values():
        print_record(r)

    print("\n>>> 步骤3: 特征版本表更新")
    engine.step3_update_feature_version_table([])
    result = engine.get_result()

    print("\n特征版本表当前记录:")
    for fid, rec in result.feature_version_table.records.items():
        print_record(rec)

    print(f"\n待策略产品复核数量: {len(result.pending_reviews)}")
    print(f"冲突待林姐确认数量: {len(result.conflicts)}")

    return result


def run_wrong_caliber_material():
    print_separator("【材料二】错口径材料 - 线上实验桶与负样本列表口径矛盾")

    engine = AnomalyRuleDistillationEngine()
    bucket, neg_list = create_wrong_caliber_material()

    print("\n>>> 步骤1: 线上实验桶导入")
    imported = engine.step1_import_online_experiment_bucket(bucket)
    for r in imported:
        print_record(r, show_params=False)

    print("\n>>> 步骤2: 数据科学家林姐补看负样本列表（检测到口径冲突）")
    reviewed = engine.step2_scientist_review_negative_samples(neg_list)

    print("\n检测到的冲突列表:")
    result = engine.get_result()
    for r in result.conflicts:
        print_record(r)

    print("\n>>> 林姐选择处理（不自动拍板，列出证据供选择）:")
    print("  林姐可选择:")
    print("    1. confirm - 确认采用线上实验桶口径")
    print("    2. reject  - 驳回到负样本列表口径")
    print()

    print("  模拟林姐确认 feat-004:")
    engine.scientist_resolve_conflict(
        "feat-004",
        action="confirm",
        notes="业务确认实验桶口径为最新标准，负样本列表未更新",
    )
    print_record(result.feature_version_table.get_record("feat-004"))

    print("  模拟林姐驳回 feat-005:")
    engine.scientist_resolve_conflict(
        "feat-005",
        action="reject",
        notes="负样本列表口径更准确，实验桶配置有误需回滚",
    )
    print_record(result.feature_version_table.get_record("feat-005"))

    return engine.get_result()


def run_supplementary_material():
    print_separator("【材料三】补录材料 - 含同一批数据重复训练两次 + 补录旧口径")

    engine = AnomalyRuleDistillationEngine()
    bucket, neg_list, supplementary_ids = create_supplementary_material()

    print("\n>>> 步骤1: 线上实验桶第一次导入")
    imported = engine.step1_import_online_experiment_bucket(bucket)
    for r in imported:
        print_record(r, show_params=False)

    print("\n>>> 模拟同一批数据重复训练两次（再次导入同一个桶）:")
    print("  注意: feat-007, feat-008 会被检测为重复训练，留给策略产品复核，不归为正常")
    imported_again = engine.step1_import_online_experiment_bucket(bucket)
    for r in imported_again:
        print_record(r, show_params=False)

    print("\n>>> 步骤2: 数据科学家林姐补看负样本列表")
    reviewed = engine.step2_scientist_review_negative_samples(neg_list)

    print("\n>>> 步骤3: 特征版本表更新（从负样本列表补录旧口径）")
    supplementary_features = [
        {
            "feature_id": "feat-009",
            "feature_name": "异常收款账户",
            "feature_version": "v3.2",
            "caliber": "旧口径-收款账户历史欺诈标记≥2次",
            "training_batch_id": "batch-2026-06-supp",
            "supplementary_from": "negative_sample_list_v2.5_20260515",
            "parameter_versions": [
                ParameterVersion(
                    param_name="fraud_mark_threshold",
                    version="v3.2",
                    value=2,
                    reason="补录历史负样本，沿用v2.5旧口径参数，新口径尚未覆盖此场景",
                ),
            ],
        },
        {
            "feature_id": "feat-010",
            "feature_name": "跨地区交易跳跃",
            "feature_version": "v2.8",
            "caliber": "旧口径-2小时内跨3个以上城市",
            "training_batch_id": "batch-2026-06-supp",
            "supplementary_from": "negative_sample_list_v2.5_20260515",
            "parameter_versions": [
                ParameterVersion(
                    param_name="city_threshold",
                    version="v2.8",
                    value=3,
                    reason="补录历史样本，旧口径验证集上precision达0.89",
                ),
            ],
        },
    ]
    engine.step3_update_feature_version_table(supplementary_features)

    result = engine.get_result()

    print("\n最终特征版本表全部记录:")
    for fid, rec in sorted(result.feature_version_table.records.items()):
        print_record(rec)

    print("\n>>> 三种处理结果对比:")
    print("  1. 顺利记录 (feat-007): 状态 =",
          result.feature_version_table.get_record("feat-007").status.value)
    print("  2. 重复训练待复核 (feat-007-dup-2, 第二次导入): 状态 =",
          result.feature_version_table.get_record("feat-007-dup-2").status.value)
    print("  3. 补录旧口径 (feat-009): 状态 =",
          result.feature_version_table.get_record("feat-009").status.value)
    print()

    print(">>> 待策略产品复核的重复训练记录:")
    for r in result.pending_reviews:
        print_record(r)

    print("\n>>> 历史操作记录（特征版本表与历史记录核对）:")
    for log in result.history_logs:
        print(f"  [{log.timestamp.strftime('%H:%M:%S')}] {log.action:20s} | "
              f"{log.feature_id:8s} | {log.before_status.value if log.before_status else 'None':>20s} "
              f"→ {log.after_status.value:20s} | {log.operator:6s} | {log.details}")

    return result


def verify_consistency(result):
    print_separator("验证：特征版本表与历史记录是否一致")

    all_consistent = True
    for fid, record in result.feature_version_table.records.items():
        history_for_feature = [
            log for log in result.history_logs if log.feature_id == fid
        ]
        if history_for_feature:
            last_log = history_for_feature[-1]
            if last_log.after_status != record.status:
                print(f"  ✗ 不一致: {fid} - 表中状态={record.status.value}, "
                      f"历史最后状态={last_log.after_status.value}")
                all_consistent = False
            else:
                print(f"  ✓ 一致: {fid} - 状态={record.status.value}")
        else:
            print(f"  ⚠ {fid} - 无历史记录")

    if all_consistent:
        print("\n  ✓ 特征版本表与历史记录完全一致!")
    else:
        print("\n  ✗ 存在不一致，请检查!")

    return all_consistent


def main():
    print("""
╔══════════════════════════════════════════════════════════════════════════╗
║             异常交易规则蒸馏 - 完整流程演示系统                            ║
╠══════════════════════════════════════════════════════════════════════════╣
║  包含三种材料测试:                                                       ║
║    1. 正常材料 - 口径一致，顺利通过                                       ║
║    2. 错口径材料 - 线上实验桶与负样本列表矛盾，林姐选择确认/驳回            ║
║    3. 补录材料 - 同一批数据重复训练两次 + 从负样本列表补录旧口径             ║
╚══════════════════════════════════════════════════════════════════════════╝
    """)

    result1 = run_normal_material()
    result2 = run_wrong_caliber_material()
    result3 = run_supplementary_material()

    print_separator("【一致性验证】")
    print("\n材料一验证:")
    verify_consistency(result1)
    print("\n材料二验证:")
    verify_consistency(result2)
    print("\n材料三验证:")
    verify_consistency(result3)

    print_separator("【总结】")
    print("""
  三种处理结果对比:
  ┌─────────────────────────┬─────────────────────────────────────────┐
  │ 类型                    │ 状态                                    │
  ├─────────────────────────┼─────────────────────────────────────────┤
  │ 顺利记录                │ normal (正常)                            │
  │ 同一批数据重复训练两次   │ pending_product_review (待策略产品复核)   │
  │ 补录的旧口径            │ supplementary_old_caliber (补录旧口径)    │
  └─────────────────────────┴─────────────────────────────────────────┘

  关键设计点:
  ✓ 同一批数据重复训练两次 → 自动标记为待策略产品复核，不急着归正常
  ✓ 线上实验桶与负样本列表矛盾 → 列出冲突证据，林姐选确认/驳回，不自动拍板
  ✓ 专业计算/模型判断 → 参数版本和取舍理由留在结果旁边
  ✓ 完整三步流程: 导入→林姐补看→更新，特征版本表与历史记录完全对应
    """)


if __name__ == "__main__":
    main()
