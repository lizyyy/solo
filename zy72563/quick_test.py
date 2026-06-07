#!/usr/bin/env python3
"""快速验证核心功能"""
import sys
from datetime import datetime, timedelta
from manager import DropoutManager
from models import DropoutStatus

manager = DropoutManager()

print("=== 1. 测试重复导入不翻倍 ===")
snapshots = [
    {
        "snapshot_id": "test_snap_001",
        "client_id": "client_A",
        "round_num": 1,
        "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
        "feature_hash": "abc123",
        "feature_count": 100
    }
]

r1 = manager.import_feature_snapshots(snapshots, "tester")
print(f"第一次导入: 成功{r1['imported_count']}, 跳过{r1['skipped_count']}")

r2 = manager.import_feature_snapshots(snapshots, "tester")
print(f"第二次导入: 成功{r2['imported_count']}, 跳过{r2['skipped_count']}")
assert r2['imported_count'] == 0, "重复导入应该跳过"
print("✓ 重复导入测试通过\n")

print("=== 2. 测试时间窗穿越检测 ===")
snapshots2 = [
    {
        "snapshot_id": "test_snap_002",
        "client_id": "client_B",
        "round_num": 1,
        "timestamp": (datetime.now() - timedelta(hours=26)).isoformat(),
        "feature_hash": "def456",
        "feature_count": 100
    }
]
manager.import_feature_snapshots(snapshots2, "tester")

logs = [
    {
        "log_id": "test_log_001",
        "client_id": "client_B",
        "round_num": 1,
        "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
        "loss": 0.5,
        "accuracy": 0.8,
        "epoch": 10,
        "samples_processed": 1000
    }
]
manager.import_training_logs(logs)

record = manager.detect_and_create_record("client_B", 1, "tester", "测试")
print(f"时间窗穿越: {record.time_window_crossed}")
print(f"状态: {record.status.value}")
print(f"异常分数: {record.anomaly_score:.2f}")
assert record.time_window_crossed == True, "应该检测到时间窗穿越"
assert record.status == DropoutStatus.PENDING_REVIEW, "时间窗穿越应该待复核"
print("✓ 时间窗穿越检测测试通过\n")

print("=== 3. 测试修改备注留痕 ===")
manager.update_remarks(record.record_id, "修改后的备注1", "xiaoqiao")
manager.update_remarks(record.record_id, "修改后的备注2", "xiaoqiao")

history = manager.get_record_history(record.record_id)
print(f"历史记录数: {len(history)}")
for h in history:
    print(f"  {h['changed_at'][:19]} - {h['changed_by']} 修改 {h['field_name']}")
    print(f"    原值: {h['old_value']}")
    print(f"    新值: {h['new_value']}")
assert len(history) >= 2, "应该有历史记录"
print("✓ 修改备注留痕测试通过\n")

print("=== 4. 测试复盘命令生成 ===")
data = manager.get_record_with_context(record.record_id)
print("复盘命令:")
for cmd in data.get('replay_commands', []):
    print(f"  $ {cmd}")
assert len(data.get('replay_commands', [])) > 0, "应该有复盘命令"
print("✓ 复盘命令生成测试通过\n")

print("=== 5. 测试可视化回溯引用 ===")
viz = manager.get_visualization_with_backrefs(record.record_id)
assert 'navigable_refs' in viz, "应该有可导航引用"
print(f"可回溯快照数: {len(viz['navigable_refs']['snapshot_ids'])}")
print(f"可回溯日志数: {len(viz['navigable_refs']['log_ids'])}")
print("✓ 可视化回溯引用测试通过\n")

print("=" * 50)
print("✅ 所有核心功能测试通过！")
print("=" * 50)
