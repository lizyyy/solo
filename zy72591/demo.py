from core import RollbackStore
from models import RecordStatus


def main():
    store = RollbackStore()

    print("=" * 70)
    print("【增量训练回滚记录 - 演示流程】")
    print("  数据科学家林姐 × 实验平台负责人")
    print("=" * 70)

    print("\n▌第一步：导入参数 YAML")
    print("-" * 50)
    params = store.import_params_yaml(
        "demo_data/params/train_params_v1.yaml",
        imported_by="林姐"
    )
    print(f"  ✓ 导入参数文件: {params.file_path}")
    print(f"  ✓ YAML ID: {params.yaml_id}")
    print(f"  ✓ 模型: {params.content['model']['name']}")
    print(f"  ✓ 训练窗口: {params.content['data']['training_window']['start']} ~ {params.content['data']['training_window']['end']}")
    print(f"  ✓ 评测窗口: {params.content['data']['eval_window']['start']} ~ {params.content['data']['eval_window']['end']}")

    print("\n▌导入评测切片（供后续补录使用）")
    print("-" * 50)
    slice_mar8 = store.import_eval_slice("demo_data/eval_slices/mar8_promo_slice.json")
    slice_oldcal = store.import_eval_slice("demo_data/eval_slices/old_caliber_feb.json")
    print(f"  ✓ 评测切片1: {slice_mar8.slice_name} (ID: {slice_mar8.slice_id})")
    print(f"    标签: {', '.join(slice_mar8.tags)}")
    print(f"    样本数: {len(slice_mar8.data_points)}")
    print(f"  ✓ 评测切片2: {slice_oldcal.slice_name} (ID: {slice_oldcal.slice_id})")
    print(f"    标签: {', '.join(slice_oldcal.tags)}")

    print("\n" + "=" * 70)
    print("【创建三条不同类型的训练记录】")
    print("=" * 70)

    print("\n▌记录一：顺利完成（正常记录）")
    print("-" * 50)
    rec1 = store.create_record(
        model_version="xgboost_v3.0.1",
        training_window=("2024-01-01", "2024-02-28"),
        eval_window=("2024-03-01", "2024-03-10"),
        metrics={"auc": 0.882, "precision": 0.76, "recall": 0.71, "f1": 0.734},
        created_by="林姐",
        params_yaml_id=params.yaml_id,
        raw_remarks="正常增量训练，窗口无重叠，AUC比上一版提升0.7个千分点，符合预期。"
    )
    print(f"  ✓ 记录ID: {rec1.record_id}")
    print(f"  ✓ 状态: {rec1.status.value}")
    print(f"  ✓ 指标: AUC={rec1.metrics['auc']}, Precision={rec1.metrics['precision']}")
    print(f"  ✓ 备注长度: {len(rec1.raw_remarks)} 字")

    print("\n▌记录二：时间窗穿越，效果虚高")
    print("-" * 50)
    rec2 = store.create_record(
        model_version="xgboost_v3.0.2-leak",
        training_window=("2024-01-01", "2024-03-05"),
        eval_window=("2024-03-01", "2024-03-10"),
        metrics={"auc": 0.921, "precision": 0.85, "recall": 0.82, "f1": 0.835},
        created_by="小王",
        params_yaml_id=params.yaml_id,
        raw_remarks="小王跑的，AUC突然冲到0.92，说模型大突破。我一看就不对，训练窗口吃到3月5号了，和评测窗口重叠了5天，典型的穿越。"
    )
    print(f"  ✓ 记录ID: {rec2.record_id}")
    print(f"  ✓ 状态: {rec2.status.value}")
    print(f"  ✓ 指标: AUC={rec2.metrics['auc']} (虚高)")
    print(f"  ✓ 系统自动检测: 训练窗口结束 {rec2.training_window_end.date()}")
    print(f"                   评测窗口开始 {rec2.eval_window_start.date()}")

    print("\n  林姐补看评测切片，把3月8号大促切片挂上：")
    rec2 = store.attach_eval_slice(rec2.record_id, slice_mar8.slice_id)
    print(f"  ✓ 挂载切片后状态: {rec2.status.value}")
    print(f"  ✓ 评测切片关联数: {len(rec2.eval_slice_ids)}")
    anomalies_after = store.get_record_anomalies(rec2.record_id)
    print(f"  ✓ 异常样本页自动更新，新增样本数: {len(anomalies_after)}")
    for a in anomalies_after:
        print(f"    - {a.sample_id}: 来自切片={a.is_from_eval_slice}, 实际值={a.actual}")

    print("\n  提交实验平台负责人复核（别急着归正常）：")
    rec2 = store.submit_for_review(rec2.record_id, "林姐")
    print(f"  ✓ 复核状态: {rec2.status.value}")

    print("\n▌记录三：旧口径补录（后来从评测切片补来的旧口径）")
    print("-" * 50)
    rec3 = store.create_record(
        model_version="xgboost_v3.0.3",
        training_window=("2024-01-15", "2024-03-14"),
        eval_window=("2024-03-15", "2024-03-20"),
        metrics={"auc": 0.876, "precision": 0.74, "recall": 0.70, "f1": 0.719},
        created_by="林姐",
        params_yaml_id=params.yaml_id,
        raw_remarks="3月15号口径调整后重训的版本，先跑一版基线。后续准备把2月旧口径的样本补过来做对照。"
    )
    print(f"  ✓ 记录ID: {rec3.record_id}")
    print(f"  ✓ 初始状态: {rec3.status.value}")
    print(f"  ✓ 初始异常样本数: {len(store.get_record_anomalies(rec3.record_id))}")

    print("\n  从评测切片补录旧口径数据：")
    rec3 = store.supplement_old_caliber(rec3.record_id, slice_oldcal.slice_id)
    print(f"  ✓ 补录后状态: {rec3.status.value}")
    anomalies_rec3 = store.get_record_anomalies(rec3.record_id)
    print(f"  ✓ 异常样本页更新后样本数: {len(anomalies_rec3)}")
    for a in anomalies_rec3:
        print(f"    - {a.sample_id}: 来源切片={a.source_slice_id}")

    print("\n" + "=" * 70)
    print("【一次人工修正 + 一次重跑】")
    print("=" * 70)

    print("\n▌人工修正记录（林姐调整了记录二的指标备注）")
    print("-" * 50)
    corr = store.add_manual_correction(
        record_id=rec2.record_id,
        operator="林姐",
        correction_type="指标修正",
        before_value={"auc": 0.921},
        after_value={"auc_note": "虚高，扣除穿越因素后估计约0.875"},
        reason="时间窗穿越导致AUC虚高，标注仅供参考，不能作为上线依据"
    )
    print(f"  ✓ 修正ID: {corr.correction_id}")
    print(f"  ✓ 修正类型: {corr.correction_type}")
    print(f"  ✓ 修正原因: {corr.reason}")

    print("\n▌重跑记录（记录二回滚后重跑）")
    print("-" * 50)
    rerun = store.add_rerun(
        original_record_id=rec2.record_id,
        triggered_by="实验平台负责人",
        params_snapshot={"training_window_end": "2024-02-28"},
        result_before={"auc": 0.921},
        result_after={"auc": 0.878}
    )
    print(f"  ✓ 重跑ID: {rerun.rerun_id}")
    print(f"  ✓ 触发人: {rerun.triggered_by}")
    print(f"  ✓ 重跑前 AUC: {rerun.result_before['auc']}")
    print(f"  ✓ 重跑后 AUC: {rerun.result_after['auc']}")
    print(f"  ✓ 差异: {rerun.result_after['auc'] - rerun.result_before['auc']:.3f} (穿越水分被挤掉)")

    print("\n" + "=" * 70)
    print("【实验平台负责人复核记录二】")
    print("=" * 70)
    rec2_reviewed = store.review_record(
        record_id=rec2.record_id,
        reviewer="实验平台负责人",
        note="确认存在时间窗穿越，训练窗口与评测窗口重叠5天，且混入了label延迟的大促样本。已安排回滚并重跑，重跑后AUC回归正常区间。此记录存档作为反面教材。",
        approve=True
    )
    print(f"  ✓ 复核人: {rec2_reviewed.reviewed_by}")
    print(f"  ✓ 复核时间: {rec2_reviewed.reviewed_at.strftime('%Y-%m-%d %H:%M')}")
    print(f"  ✓ 复核结论: {rec2_reviewed.status.value}")
    print(f"  ✓ 复核意见: {rec2_reviewed.review_note[:60]}...")

    print("\n" + "=" * 70)
    print("【三种处理结果对比】")
    print("=" * 70)
    for i, rec in enumerate([rec1, rec2_reviewed, rec3], 1):
        print(f"\n  记录{i}: {rec.model_version}")
        print(f"    状态: {rec.status.value}")
        print(f"    AUC: {rec.metrics['auc']}")
        print(f"    关联评测切片: {len(rec.eval_slice_ids)} 个")
        print(f"    关联异常样本: {len(rec.anomaly_sample_ids)} 个")
        print(f"    备注行数: {len(rec.raw_remarks.splitlines())} 行")

    print("\n" + "=" * 70)
    print("【演示完成】")
    print("=" * 70)
    print("\n  关键特性总结:")
    print("  ✓ 评测切片的 raw_remark 完整保留，没洗成一行干净数据")
    print("  ✓ 时间窗穿越自动检测并标记，不直接归正常，留待复核")
    print("  ✓ 补录评测切片后，异常样本页自动同步更新")
    print("  ✓ 三种记录状态区分清晰：顺利/穿越虚高/旧口径补录")
    print("  ✓ 含一次人工修正和一次重跑记录，方便给新人讲流程")
    print("")


if __name__ == "__main__":
    main()
