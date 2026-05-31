#!/usr/bin/env python3
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from models import PlayerRecord, RecordStatus
from dispatcher import UndergroundDispatcher
from state_viewer import StateViewer, AnomalyExplainer
from exporter import DataExporter


def cleanup_data():
    data_path = Path("./data_test")
    export_path = Path("./exports_test")
    if data_path.exists():
        shutil.rmtree(data_path)
    if export_path.exists():
        shutil.rmtree(export_path)
    return data_path, export_path


def create_test_records():
    base_time = datetime(2026, 5, 20, 10, 0, 0)

    records = []

    for i in range(1, 6):
        pr = PlayerRecord(
            player_id=f"P{i:03d}",
            activity_id="ACT_TEST",
            task_id="TASK_001",
            completion_time=base_time + timedelta(hours=i),
            reward_amount=50.0 + i * 10,
            source="app",
            raw_data={"test": f"data_{i}"}
        )
        records.append(pr)

    pr_duplicate = PlayerRecord(
        player_id="P001",
        activity_id="ACT_TEST",
        task_id="TASK_001",
        completion_time=base_time + timedelta(hours=1),
        reward_amount=60.0,
        source="app",
        raw_data={"test": "duplicate"}
    )
    records.append(pr_duplicate)

    pr_late = PlayerRecord(
        player_id="P006",
        activity_id="ACT_TEST",
        task_id="TASK_001",
        completion_time=datetime(2026, 5, 25, 10, 0, 0),
        reward_amount=50.0,
        source="web",
        raw_data={"test": "late"}
    )
    records.append(pr_late)

    for i in range(1, 4):
        pr = PlayerRecord(
            player_id=f"P{i:03d}",
            activity_id="ACT_TEST",
            task_id="TASK_001",
            completion_time=base_time + timedelta(hours=i),
            reward_amount=50.0 + i * 10,
            source="app",
            raw_data={"test": f"reprocess_{i}"}
        )
        records.append(pr)

    return records, base_time


def test_duplicate_detection():
    print("=" * 60)
    print("测试1: 重复记录检测")
    print("=" * 60)

    data_path, export_path = cleanup_data()
    dispatcher = UndergroundDispatcher(str(data_path))

    base_time = datetime(2026, 5, 20, 10, 0, 0)
    pr1 = PlayerRecord(
        player_id="P001",
        activity_id="ACT_TEST",
        task_id="TASK_001",
        completion_time=base_time,
        reward_amount=50.0,
        source="app",
        raw_data={"src": "first"}
    )

    record1 = dispatcher.process_record(pr1)
    print(f"第一条记录ID: {record1.record_id}")
    print(f"第一条记录状态: {record1.current_status.value}")
    assert record1.current_status == RecordStatus.REWARD_READY, "第一条记录应该是待发奖状态"

    pr2 = PlayerRecord(
        player_id="P001",
        activity_id="ACT_TEST",
        task_id="TASK_001",
        completion_time=base_time,
        reward_amount=50.0,
        source="app",
        raw_data={"src": "second"}
    )
    record2 = dispatcher.process_record(pr2)
    print(f"第二条记录ID: {record2.record_id}")
    print(f"第二条记录状态: {record2.current_status.value}")
    assert record2.current_status == RecordStatus.DUPLICATE, "第二条记录应该被标记为重复"

    print(f"指纹索引中P001的记录数: {len(dispatcher.fingerprint_index.get(pr1.fingerprint, []))}")
    print("✓ 重复记录检测通过")
    print()


def test_late_detection():
    print("=" * 60)
    print("测试2: 晚到记录检测")
    print("=" * 60)

    data_path, export_path = cleanup_data()
    dispatcher = UndergroundDispatcher(str(data_path))

    deadline = datetime(2026, 5, 22, 23, 59, 59)

    pr_normal = PlayerRecord(
        player_id="P001",
        activity_id="ACT_TEST",
        task_id="TASK_001",
        completion_time=datetime(2026, 5, 20, 10, 0, 0),
        reward_amount=50.0,
        source="app",
        raw_data={}
    )
    record_normal = dispatcher.process_record(pr_normal, deadline)
    print(f"正常记录状态: {record_normal.current_status.value}")
    assert record_normal.current_status == RecordStatus.REWARD_READY

    pr_late = PlayerRecord(
        player_id="P002",
        activity_id="ACT_TEST",
        task_id="TASK_001",
        completion_time=datetime(2026, 5, 23, 10, 0, 0),
        reward_amount=50.0,
        source="app",
        raw_data={}
    )
    record_late = dispatcher.process_record(pr_late, deadline)
    print(f"晚到记录状态: {record_late.current_status.value}")
    assert record_late.current_status == RecordStatus.LATE
    assert len(record_late.anomalies) > 0
    print(f"晚到记录异常数: {len(record_late.anomalies)}")
    print(f"异常类型: {record_late.anomalies[0].anomaly_type.value}")

    print("✓ 晚到记录检测通过")
    print()


def test_idempotency():
    print("=" * 60)
    print("测试3: 幂等性 - 重复运行不产生重复数据")
    print("=" * 60)

    data_path, export_path = cleanup_data()
    dispatcher = UndergroundDispatcher(str(data_path))

    records, base_time = create_test_records()
    print(f"准备处理 {len(records)} 条记录（包含重复和重跑）")

    result1 = dispatcher.batch_process(records)
    print(f"\n第一次处理:")
    print(f"  总记录数: {result1.total_records}")
    print(f"  新增: {result1.new_records}")
    print(f"  重复: {result1.duplicate_records}")
    print(f"  晚到: {result1.late_records}")

    total_after_first = len(dispatcher.records)
    print(f"处理后总记录数: {total_after_first}")

    result2 = dispatcher.batch_process(records)
    print(f"\n第二次处理（完全相同的输入）:")
    print(f"  总记录数: {result2.total_records}")
    print(f"  新增: {result2.new_records}")
    print(f"  重复: {result2.duplicate_records}")
    print(f"  晚到: {result2.late_records}")

    total_after_second = len(dispatcher.records)
    print(f"处理后总记录数: {total_after_second}")

    assert total_after_first == total_after_second, "重复运行不应该增加记录数"
    assert result2.new_records == 0, "第二次处理不应该有新增记录"
    assert result2.duplicate_records == result1.duplicate_records, "第二次处理的重复记录数应与第一次相同"

    print("\n✓ 幂等性测试通过 - 重复运行不会产生重复数据")
    print()


def test_manual_correction():
    print("=" * 60)
    print("测试4: 人工更正")
    print("=" * 60)

    data_path, export_path = cleanup_data()
    dispatcher = UndergroundDispatcher(str(data_path))

    pr = PlayerRecord(
        player_id="P001",
        activity_id="ACT_TEST",
        task_id="TASK_001",
        completion_time=datetime(2026, 5, 20, 10, 0, 0),
        reward_amount=50.0,
        source="app",
        raw_data={}
    )
    record = dispatcher.process_record(pr)
    print(f"原始奖励金额: {record.player_record.reward_amount}")
    print(f"原始状态: {record.current_status.value}")
    original_fingerprint = record.player_record.fingerprint

    corrected = dispatcher.apply_manual_correction(
        record.record_id,
        {"reward_amount": 100.0},
        operator="admin",
        reason="玩家申诉，奖励计算有误"
    )

    print(f"更正后奖励金额: {corrected.player_record.reward_amount}")
    print(f"更正后状态: {corrected.current_status.value}")
    print(f"更正次数: {len(corrected.manual_corrections)}")
    print(f"人工更正详情: {corrected.manual_corrections[0].corrected_fields}")
    print(f"新指纹: {corrected.player_record.fingerprint}")
    print(f"指纹是否变化: {original_fingerprint != corrected.player_record.fingerprint}")

    assert corrected.player_record.reward_amount == 100.0
    assert corrected.current_status == RecordStatus.REWARD_READY
    assert len(corrected.manual_corrections) == 1

    print("✓ 人工更正测试通过")
    print()


def test_state_timeline():
    print("=" * 60)
    print("测试5: 状态回看")
    print("=" * 60)

    data_path, export_path = cleanup_data()
    dispatcher = UndergroundDispatcher(str(data_path))
    viewer = StateViewer(dispatcher)

    pr = PlayerRecord(
        player_id="P001",
        activity_id="ACT_TEST",
        task_id="TASK_001",
        completion_time=datetime(2026, 5, 20, 10, 0, 0),
        reward_amount=50.0,
        source="app",
        raw_data={}
    )
    record = dispatcher.process_record(pr)

    dispatcher.apply_manual_correction(
        record.record_id,
        {"reward_amount": 80.0},
        operator="admin",
        reason="活动特殊奖励"
    )

    dispatcher.mark_reward_sent(record.record_id, "payment_system")

    timeline = viewer.get_record_timeline(record.record_id)
    print(f"时间线事件数: {len(timeline)}")

    print("\n时间线详情:")
    for event in timeline:
        print(f"  [{event['sequence']}] {event['timestamp_str']} - {event['type']}")
        if event['type'] == 'status_change':
            print(f"      {event['from_status']} → {event['to_status']}: {event['reason']}")
        elif event['type'] == 'manual_correction':
            print(f"      操作人: {event['operator']}, 原因: {event['reason']}")

    status_changes = [e for e in timeline if e['type'] == 'status_change']
    corrections = [e for e in timeline if e['type'] == 'manual_correction']

    assert len(status_changes) >= 4, "应该有至少4次状态变更"
    assert len(corrections) == 1, "应该有1次人工更正"

    print("\n✓ 状态回看测试通过")
    print()


def test_anomaly_explanation():
    print("=" * 60)
    print("测试6: 异常解释")
    print("=" * 60)

    data_path, export_path = cleanup_data()
    dispatcher = UndergroundDispatcher(str(data_path))
    explainer = AnomalyExplainer(dispatcher)

    pr1 = PlayerRecord(
        player_id="P001",
        activity_id="ACT_TEST",
        task_id="TASK_001",
        completion_time=datetime(2026, 5, 20, 10, 0, 0),
        reward_amount=50.0,
        source="app",
        raw_data={"src": "first"}
    )
    dispatcher.process_record(pr1)

    pr2 = PlayerRecord(
        player_id="P001",
        activity_id="ACT_TEST",
        task_id="TASK_001",
        completion_time=datetime(2026, 5, 20, 10, 0, 0),
        reward_amount=50.0,
        source="app",
        raw_data={"src": "second"}
    )
    record2 = dispatcher.process_record(pr2)

    anomaly = record2.anomalies[0]
    explanation = explainer.explain_anomaly(anomaly)

    print(f"异常类型: {explanation['type']}")
    print(f"产生原因: {explanation['cause']}")
    print(f"可能原因: {explanation['possible_reasons']}")
    print(f"影响范围: {explanation['impact']}")
    print(f"处理建议: {explanation['suggestion']}")

    assert 'cause' in explanation
    assert 'possible_reasons' in explanation
    assert 'impact' in explanation
    assert 'suggestion' in explanation

    summary = explainer.get_all_anomalies_summary()
    print(f"\n异常汇总: 共 {len(summary)} 种类型")
    for item in summary:
        print(f"  {item['anomaly_type']}: {item['count']} 条")

    print("\n✓ 异常解释测试通过")
    print()


def test_export_consistency():
    print("=" * 60)
    print("测试7: 导出一致性与幂等性")
    print("=" * 60)

    data_path, export_path = cleanup_data()
    dispatcher = UndergroundDispatcher(str(data_path))
    exporter = DataExporter(dispatcher, str(export_path))

    for i in range(1, 6):
        pr = PlayerRecord(
            player_id=f"P{i:03d}",
            activity_id="ACT_EXPORT",
            task_id="TASK_001",
            completion_time=datetime(2026, 5, 20, 10, 0, 0) + timedelta(hours=i),
            reward_amount=50.0 + i * 10,
            source="app",
            raw_data={}
        )
        dispatcher.process_record(pr)

    print(f"待导出记录数: {len(exporter.get_exportable_records('ACT_EXPORT'))}")

    result1 = exporter.export_to_csv("ACT_EXPORT", operator="test_user")
    print(f"\n第一次导出:")
    print(f"  成功: {result1['success']}")
    print(f"  批次ID: {result1['export_batch_id']}")
    print(f"  导出数量: {result1['exported_count']}")
    print(f"  校验和: {result1.get('filepath', '')}")

    result2 = exporter.export_to_csv("ACT_EXPORT", operator="test_user")
    print(f"\n第二次导出（相同数据）:")
    print(f"  成功: {result2['success']}")
    print(f"  是否重复: {result2.get('duplicate', False)}")
    print(f"  消息: {result2['message']}")

    assert result1['success'] == True
    assert result2['success'] == False
    assert result2.get('duplicate') == True

    verify_result = exporter.verify_export_consistency(result1['export_batch_id'])
    print(f"\n一致性校验:")
    print(f"  一致: {verify_result['consistent']}")
    print(f"  校验和匹配: {verify_result['checksum_match']}")
    print(f"  摘要匹配: {verify_result['summary_match']}")

    assert verify_result['consistent'] == True

    print("\n✓ 导出一致性与幂等性测试通过")
    print()


def test_export_review():
    print("=" * 60)
    print("测试8: 导出前复核")
    print("=" * 60)

    data_path, export_path = cleanup_data()
    dispatcher = UndergroundDispatcher(str(data_path))
    exporter = DataExporter(dispatcher, str(export_path))

    deadline = datetime(2026, 5, 22, 23, 59, 59)

    for i in range(1, 4):
        pr = PlayerRecord(
            player_id=f"P{i:03d}",
            activity_id="ACT_REVIEW",
            task_id="TASK_001",
            completion_time=datetime(2026, 5, 25, 10, 0, 0),
            reward_amount=50.0,
            source="app",
            raw_data={}
        )
        dispatcher.process_record(pr, deadline)

    for i in range(4, 6):
        pr = PlayerRecord(
            player_id=f"P{i:03d}",
            activity_id="ACT_REVIEW",
            task_id="TASK_001",
            completion_time=datetime(2026, 5, 20, 10, 0, 0),
            reward_amount=50.0,
            source="app",
            raw_data={}
        )
        dispatcher.process_record(pr, deadline)

    review = exporter.review_before_export("ACT_REVIEW")
    print(f"待导出记录: {review['preview_count']}")
    print(f"问题记录: {review['issue_count']}")
    print(f"建议: {review['recommendation']}")
    print(f"是否可导出: {review['can_export']}")

    if review['issues']:
        print("\n问题详情:")
        for issue in review['issues']:
            print(f"  - {issue['record_id']}: {issue['issue']}")

    print("\n✓ 导出前复核测试通过")
    print()


def test_missed_rewards():
    print("=" * 60)
    print("测试9: 漏发奖励管理")
    print("=" * 60)

    data_path, export_path = cleanup_data()
    dispatcher = UndergroundDispatcher(str(data_path))

    for i in range(1, 4):
        pr = PlayerRecord(
            player_id=f"P{i:03d}",
            activity_id="ACT_MISSED",
            task_id="TASK_001",
            completion_time=datetime(2026, 5, 20, 10, 0, 0),
            reward_amount=50.0 * i,
            source="app",
            raw_data={}
        )
        record = dispatcher.process_record(pr)
        if i == 2:
            dispatcher.mark_reward_missed(record.record_id, "支付系统超时", "客服_小王")

    missed = dispatcher.get_missed_rewards()
    print(f"漏发记录数: {len(missed)}")
    for m in missed:
        print(f"  {m.record_id}: 玩家 {m.player_record.player_id}, 应发 {m.player_record.reward_amount}")

    assert len(missed) == 1
    assert missed[0].player_record.player_id == "P002"
    assert missed[0].current_status == RecordStatus.REWARD_MISSED

    dispatcher.mark_reward_sent(missed[0].record_id, "补发_管理员")
    missed_after = dispatcher.get_missed_rewards()
    print(f"补发后漏发记录数: {len(missed_after)}")
    assert len(missed_after) == 0

    print("\n✓ 漏发奖励管理测试通过")
    print()


def main():
    print("\n" + "=" * 60)
    print("地下车站调度系统 - 核心功能测试")
    print("=" * 60 + "\n")

    try:
        test_duplicate_detection()
        test_late_detection()
        test_idempotency()
        test_manual_correction()
        test_state_timeline()
        test_anomaly_explanation()
        test_export_consistency()
        test_export_review()
        test_missed_rewards()

        print("=" * 60)
        print("✓ 所有测试通过！")
        print("=" * 60)

    finally:
        cleanup_data()


if __name__ == "__main__":
    main()
