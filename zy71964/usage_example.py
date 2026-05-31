#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
阈值灰度回滚系统 - 使用示例
============================

本示例展示了系统的典型使用流程，包括：
1. 材料和训练日志上传
2. 执行阈值灰度回滚
3. 处理异常情况（指标口径变化、训练集泄漏、标签漏映射）
4. 处理重复提交和版本变更

运行方式：python3 usage_example.py
"""

from models import ThresholdConfig, RollbackStatus, AbnormalType
from threshold_rollback_service import ThresholdRollbackService
from exceptions import ThresholdRollbackException


def print_separator(title=""):
    print("\n" + "=" * 60)
    if title:
        print(f"  {title}")
        print("=" * 60)


def example_1_basic_flow():
    """示例1：基础流程 - 正常情况下的阈值灰度回滚"""
    print_separator("示例1：基础流程 - 正常阈值灰度回滚")

    service = ThresholdRollbackService()

    service.upload_material(
        material_id="mat_001",
        name="用户风险识别模型",
        version="v2.0"
    )
    print("✅ 已上传材料：用户风险识别模型")

    service.upload_training_log(
        log_id="log_001",
        material_id="mat_001",
        version="v1.0",
        metrics={
            "accuracy": 0.95,
            "precision": 0.92,
            "recall": 0.88,
        },
        feature_stats={
            "total_samples": 10000,
            "valid_samples": 9850,
        },
        label_mapping={
            "高风险": "0",
            "中风险": "1",
            "低风险": "2",
        },
        training_set_ids=[f"train_{i}" for i in range(1000)],
    )
    print("✅ 已上传训练日志")

    configs = [
        ThresholdConfig(metric_name="accuracy", threshold=0.9, min_coverage=0.9),
        ThresholdConfig(metric_name="precision", threshold=0.88, min_coverage=0.9),
    ]
    print(f"📋 阈值配置：准确率≥0.9，精确率≥0.88，覆盖率≥90%")

    try:
        record = service.execute_rollback("mat_001", configs)
        print(f"\n📊 执行结果：")
        print(f"   状态：{record.status}")
        print(f"   记录ID：{record.record_id}")
        print(f"\n💬 详细信息：")
        print(record.human_message)
    except ThresholdRollbackException as e:
        print(f"\n❌ 操作失败：{e.friendly_error.title}")
        print(f"   原因：{e.friendly_error.message}")
        print(f"   建议：{e.friendly_error.suggestion}")


def example_2_idempotent_check():
    """示例2：幂等性检查 - 同一批材料重复提交"""
    print_separator("示例2：幂等性检查 - 避免重复生成成功记录")

    service = ThresholdRollbackService()
    service.upload_material("mat_002", "营销推荐模型", "v1.0")
    service.upload_training_log(
        log_id="log_002",
        material_id="mat_002",
        version="v1.0",
        metrics={"ctr": 0.05, "cvr": 0.02},
        feature_stats={"total_samples": 50000, "valid_samples": 48000},
        label_mapping={"点击": "1", "未点击": "0"},
        training_set_ids=[f"s{i}" for i in range(500)],
    )

    configs = [ThresholdConfig(metric_name="ctr", threshold=0.04, min_coverage=0.8)]

    print("▶️  第一次执行阈值灰度回滚...")
    record1 = service.execute_rollback("mat_002", configs)
    print(f"   结果：{record1.status}，记录ID：{record1.record_id}")

    print("\n▶️  同一批材料第二次执行（未勾选强制重新计算）...")
    try:
        service.execute_rollback("mat_002", configs)
    except ThresholdRollbackException as e:
        print(f"   ❌ 已拦截：{e.friendly_error.title}")
        print(f"      {e.friendly_error.message}")
        print(f"      💡 建议：{e.friendly_error.suggestion}")

    print("\n▶️  勾选「强制重新计算」后再次执行...")
    record2 = service.execute_rollback("mat_002", configs, force_recalculate=True)
    print(f"   ✅ 已执行，新记录ID：{record2.record_id}")
    print(f"      历史记录已标记为历史版本，可追溯。")


def example_3_abnormal_detection():
    """示例3：异常检测 - 标签漏映射、训练集泄漏等"""
    print_separator("示例3：异常检测 - 识别并标记异常情况")

    service = ThresholdRollbackService()
    service.upload_material("mat_003", "内容分类模型", "v1.0")

    grayscale_set = {f"gray_{i}" for i in range(50)}
    training_set = [f"train_{i}" for i in range(80)] + [f"gray_{i}" for i in range(20)]

    service.upload_training_log(
        log_id="log_003",
        material_id="mat_003",
        version="v1.0",
        metrics={"accuracy": 0.92, "f1": 0.90},
        feature_stats={"total_samples": 20000, "valid_samples": 19000},
        label_mapping={"科技": "0", "娱乐": "1", "体育": "2"},
        training_set_ids=training_set,
    )

    configs = [
        ThresholdConfig(metric_name="accuracy", threshold=0.9, min_coverage=0.85),
    ]

    current_labels = ["科技", "娱乐", "体育", "财经", "军事"]

    print("▶️  执行阈值灰度回滚，传入灰度集样本ID和实际标签...")
    record = service.execute_rollback(
        "mat_003", configs,
        grayscale_set_ids=grayscale_set,
        current_labels=current_labels,
    )

    print(f"\n📊 执行结果：")
    print(f"   状态：{record.status}")
    print(f"   检测到 {len(record.abnormalities)} 个异常：")
    for i, abnormal in enumerate(record.abnormalities, 1):
        print(f"   {i}. {abnormal.abnormal_type.value}")

    print(f"\n💬 详细异常信息：")
    print(record.human_message)

    print("\n▶️  人工确认异常后继续执行...")
    confirmed = service.confirm_and_continue(
        record.record_id,
        approve_data_leakage=True,
        approve_label_missing=True,
    )
    print(f"   ✅ 确认完成，最终状态：{confirmed.status}")
    print(f"\n💬 执行结果：")
    print(confirmed.human_message)


def example_4_version_change():
    """示例4：版本变更提醒 - 补传旧版本训练日志"""
    print_separator("示例4：版本变更提醒 - 训练日志更新时提示差异")

    service = ThresholdRollbackService()
    service.upload_material("mat_004", "情感分析模型", "v1.0")

    print("▶️  上传第一版训练日志...")
    upload_result1 = service.upload_training_log(
        log_id="log_v1",
        material_id="mat_004",
        version="v1.0",
        metrics={"pos_acc": 0.88, "neg_acc": 0.90, "neu_acc": 0.85},
        feature_stats={"total_samples": 8000, "valid_samples": 7800},
        label_mapping={"正面": "1", "负面": "-1", "中性": "0"},
        training_set_ids=[f"s{i}" for i in range(200)],
    )
    print(f"   ✅ {upload_result1['message']}")

    print("\n▶️  上传第二版训练日志（补传旧版本）...")
    upload_result2 = service.upload_training_log(
        log_id="log_v2",
        material_id="mat_004",
        version="v1.1",
        metrics={"pos_acc": 0.90, "neg_acc": 0.92, "neu_acc": 0.87, "f1": 0.89},
        feature_stats={"total_samples": 10000, "valid_samples": 9800},
        label_mapping={"正面": "1", "负面": "-1", "中性": "0", "讽刺": "2"},
        training_set_ids=[f"s{i}" for i in range(150, 350)],
    )

    if upload_result2["version_conflict"]:
        print(f"   ⚠️  检测到版本变更！")
        print(f"\n{upload_result2['message']}")
    else:
        print(f"   ✅ {upload_result2['message']}")

    print("\n▶️  执行强制重新计算，系统会自动附加版本变更提醒...")
    configs = [
        ThresholdConfig(metric_name="pos_acc", threshold=0.85, min_coverage=0.9),
    ]
    record = service.execute_rollback("mat_004", configs, force_recalculate=True)

    if record.version_changes:
        print(f"\n📋 记录中已包含版本变更信息，可用于追溯审计。")

    print(f"\n💬 执行结果：")
    print(record.human_message)


def example_5_error_handling():
    """示例5：友好错误提示 - 不再是冰冷的堆栈和内部字段"""
    print_separator("示例5：友好错误提示")

    service = ThresholdRollbackService()
    service.upload_material("mat_005", "测试模型", "v1.0")

    print("▶️  配置无效阈值（1.5 超出 [0, 1] 范围）...")
    try:
        configs = [ThresholdConfig(metric_name="accuracy", threshold=1.5, min_coverage=0.8)]
        service.execute_rollback("mat_005", configs)
    except ThresholdRollbackException as e:
        err = e.friendly_error
        print(f"   ❌ {err.title}")
        print(f"      错误码：{err.error_code}")
        print(f"      问题：{err.message}")
        print(f"      建议：{err.suggestion}")
        if err.abnormal_type:
            print(f"      异常类型：{err.abnormal_type.value}")

    print("\n▶️  未上传训练日志就执行回滚...")
    try:
        configs = [ThresholdConfig(metric_name="accuracy", threshold=0.9, min_coverage=0.8)]
        service.execute_rollback("mat_999", configs)
    except ThresholdRollbackException as e:
        err = e.friendly_error
        print(f"   ❌ {err.title}")
        print(f"      问题：{err.message}")
        print(f"      建议：{err.suggestion}")


if __name__ == "__main__":
    print("\n" + "🚀" * 30)
    print("   阈值灰度回滚系统 - 完整使用示例")
    print("🚀" * 30)

    example_1_basic_flow()
    example_2_idempotent_check()
    example_3_abnormal_detection()
    example_4_version_change()
    example_5_error_handling()

    print_separator("全部示例执行完成")
    print("\n📌 核心特性总结：")
    print("   ✅ 幂等性保护：同一批材料不重复生成成功记录")
    print("   ✅ 异常检测：指标口径变化、训练集泄漏、标签漏映射")
    print("   ✅ 待确认标记：异常情况不混入正常结果")
    print("   ✅ 版本对比：训练日志更新时提示具体差异")
    print("   ✅ 友好提示：错误信息像人话，有问题有建议")
    print("   ✅ 历史追溯：旧记录标记为历史版本，永不丢失")
    print("\n")
