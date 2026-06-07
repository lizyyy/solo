import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.pseudo_label_review import PseudoLabelReview


def print_divider(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)


def demo_full_workflow():
    print_divider("半监督伪标签复核系统 - 完整流程演示")

    review = PseudoLabelReview()

    print("\n【第一步】线上实验桶第一次导入")
    print("-" * 60)

    bucket_samples = [
        {
            "sample_id": "s001",
            "predicted_label": 1,
            "predicted_score": 0.85,
            "source": "traffic_layer_a",
            "model_version": "model_v2.3",
            "true_label": None
        },
        {
            "sample_id": "s002",
            "predicted_label": 1,
            "predicted_score": 0.72,
            "source": "traffic_layer_a",
            "model_version": "model_v2.3",
            "true_label": None
        },
        {
            "sample_id": "s003",
            "predicted_label": 0,
            "predicted_score": 0.31,
            "source": "traffic_layer_b",
            "model_version": "model_v2.3",
            "true_label": None
        },
        {
            "sample_id": "s004",
            "predicted_label": 1,
            "predicted_score": 0.91,
            "source": "traffic_layer_b",
            "model_version": "model_v2.3",
            "true_label": None
        },
        {
            "sample_id": "s005",
            "predicted_label": 0,
            "predicted_score": 0.22,
            "source": "traffic_layer_a",
            "model_version": "model_v2.3",
            "true_label": None
        },
    ]

    result = review.step1_import_experiment_bucket(
        bucket_id="exp_bucket_2026_001",
        name="半监督伪标签实验桶-06月",
        samples=bucket_samples,
        imported_by="系统自动导入",
        threshold=0.6,
        threshold_report_value=0.5,
        params_version="v2.3.1",
        params_reason="选择v2.3.1版本参数，因在验证集上F1提升2.1%，牺牲1.5%召回率换更高精确率"
    )

    print(f"结果ID: {result.result_id}")
    print(f"导入样本数: {len(result.samples)}")
    print(f"当前阈值: {result.threshold}")
    print(f"报告写入阈值: {result.threshold_report_value}")
    print(f"参数版本: {result.params_version}")
    print(f"取舍理由: {result.params_reason}")
    print(f"需要数据科学家复核: {result.needs_data_scientist}")

    print("\n  自检结果:")
    for check in result.self_check_results:
        status = "✓ 通过" if check.passed else "✗ 异常"
        print(f"    [{status}] {check.check_name}: {check.message}")

    print("\n【第二步】实验平台负责人阿越补看负样本列表")
    print("-" * 60)

    negative_samples = [
        {"sample_id": "s001", "true_label": 0, "source": "人工标注群补充"},
        {"sample_id": "s002", "true_label": 1, "source": "人工标注群补充"},
        {"sample_id": "s003", "true_label": 0, "source": "人工标注群补充"},
    ]

    result, conflicts = review.step2_supplement_negative_samples(
        result_id=result.result_id,
        negative_samples=negative_samples,
        added_by="阿越"
    )

    print(f"补充负样本数: {len(negative_samples)}")
    print(f"检测到冲突数: {len(conflicts)}")

    if conflicts:
        print("\n  ⚠️  冲突证据列表（请阿越确认或驳回，系统不自动拍板）:")
        for i, conflict in enumerate(conflicts, 1):
            print(f"\n    冲突 #{i}: 样本 {conflict.sample_id}")
            print(f"      类型: {conflict.conflict_type}")
            print(f"      描述: {conflict.description}")
            print(f"      实验桶值: {conflict.experiment_value}")
            print(f"      负样本值: {conflict.negative_value}")

    print("\n  自检结果:")
    for check in result.self_check_results:
        status = "✓ 通过" if check.passed else "✗ 异常"
        print(f"    [{status}] {check.check_name}: {check.message}")

    print("\n【第三步】分层指标更新")
    print("-" * 60)

    result = review.step3_update_stratified_metrics(
        result_id=result.result_id,
        reviewer="阿越"
    )

    print("  分层指标:")
    for source, metrics in result.stratified_metrics.items():
        print(f"\n    {source}:")
        print(f"      精确率: {metrics['precision']:.4f}")
        print(f"      召回率: {metrics['recall']:.4f}")
        print(f"      F1: {metrics['f1']:.4f}")
        print(f"      准确率: {metrics['accuracy']:.4f}")
        print(f"      样本数: {metrics['total_samples']}")

    print("\n【关键环节】阿越查看冲突证据后进行人工决策")
    print("-" * 60)
    print(f"当前状态: {result.review_status}")
    print(f"存在阈值不一致: {not result.is_consistent()}")

    print("\n  场景: 阿越尝试直接确认，但系统检测到阈值改过但报告仍写旧值")
    print("  → 自动转数据科学家复核，不允许直接归为正常")

    result = review.a_yue_review(
        result_id=result.result_id,
        decision="confirmed",
        comment="我看了下，样本s001标签确实错了，其他没问题",
        reviewer="阿越"
    )

    print(f"\n  实际状态: {result.review_status}")
    print(f"  复核意见: {result.review_comment}")
    print(f"  需要数据科学家: {result.needs_data_scientist}")

    print("\n【数据科学家复核】")
    print("-" * 60)

    result = review.data_scientist_review(
        result_id=result.result_id,
        decision="confirmed",
        comment="阈值0.6是对的，报告里的0.5是笔误，已修正。其他确认无误。",
        reviewer="数据科学家"
    )

    print(f"最终状态: {result.review_status}")
    print(f"数据科学家意见: {result.data_scientist_comment}")

    print("\n【验证：导出明细、页面展示、接口返回使用同一份数据】")
    print("-" * 60)

    export_data = review.get_export_data(result.result_id)
    page_data = review.get_page_display_data(result.result_id)
    api_data = review.get_api_response(result.result_id)

    print(f"  导出数据样本数: {len(export_data['samples'])}")
    print(f"  页面数据样本数: {len(page_data['samples'])}")
    print(f"  接口数据样本数: {len(api_data['samples'])}")
    print(f"  三份数据一致: {export_data == page_data == api_data}")
    print(f"  数据统一来源ID: {export_data['result_id']}")

    print("\n【阈值不一致在所有展示端都可见】")
    print(f"  导出: 阈值={export_data['threshold']}, 报告值={export_data['threshold_report_value']}, 一致={export_data['is_threshold_consistent']}")
    print(f"  页面: 阈值={page_data['threshold']}, 报告值={page_data['threshold_report_value']}, 一致={page_data['is_threshold_consistent']}")
    print(f"  接口: 阈值={api_data['threshold']}, 报告值={api_data['threshold_report_value']}, 一致={api_data['is_threshold_consistent']}")

    print_divider("演示完成")
    print("\n系统核心特性总结:")
    print("  1. ✅ 线上实验桶与负样本列表矛盾时，列出冲突证据，由阿越确认/驳回")
    print("  2. ✅ 四项基本自检：重复导入、阈值旧值、补录重算、导出一致")
    print("  3. ✅ 导出明细、页面展示、接口返回读取同一份结果")
    print("  4. ✅ 阈值改过但报告仍写旧值时，三处都显示异常，不会一处消失")
    print("  5. ✅ 专业计算的参数版本和取舍理由附在结果旁")
    print("  6. ✅ 支持三步流程：导入→补看负样本→分层指标更新")
    print("  7. ✅ 阈值不一致时，不自动归正常，强制留给数据科学家复核")


if __name__ == "__main__":
    demo_full_workflow()
