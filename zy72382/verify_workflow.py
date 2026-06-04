#!/usr/bin/env python3
"""
小车碰撞动量回放 - 端到端工作流验证脚本

完整走通三步流程：
1. 传感器编号第一次导入
2. 维修师傅老岑补看工况照片
3. 参数回放页更新

中间碰到人工改过系数但没写原因时，别急着归正常，留给设备工程师复核。
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from collision_playback import database, core
from collision_playback.models import SensorRecordCreate
from collision_playback.config import (
    RECORD_STATUS, PLAYBACK_SOURCE,
    OPERATOR_LAOCEN, OPERATOR_ENGINEER,
)
from datetime import datetime, timedelta


async def verify_workflow():
    print("=" * 70)
    print("小车碰撞动量回放 - 端到端工作流验证")
    print("=" * 70)
    print()

    await database.init_db()
    await database.clear_all_data()
    print("[步骤 0] 数据库初始化完成，已清空测试数据")
    print()

    print("=" * 70)
    print("[步骤 1] 传感器编号第一次导入")
    print("=" * 70)
    print()

    test_sensor_no = "TEST-WORKFLOW-001"
    record_data = SensorRecordCreate(
        sensor_no=test_sensor_no,
        collision_time=datetime.now() - timedelta(hours=2),
        car_mass_kg=10.0,
        velocity_ms=3.0,
        friction_coeff=0.02,
        collision_efficiency=0.90,
        notes="工作流测试记录",
    )

    result = await core.import_sensor_record(record_data)
    print(f"✓ 导入结果: {result.message}")
    print(f"  记录ID: {result.record_id}")
    print(f"  传感器编号: {result.sensor_no}")
    print(f"  初始状态: {result.status}")

    detail = await core.get_record_detail(result.record_id)
    expected_initial = 10.0 * 3.0 * 0.90 * (1 - 0.02)
    print(f"  初始修正动量: {detail.corrected_momentum:.4f} (期望值: {expected_initial:.4f})")
    assert abs(detail.corrected_momentum - expected_initial) < 0.0001, "初始计算错误"
    assert len(detail.playbacks) == 1, "应该有1次回放记录"
    assert detail.playbacks[0].source == PLAYBACK_SOURCE["ORIGINAL"], "第一次应该是原始数据来源"
    print("✓ 初始回放正确")
    print()

    print("=" * 70)
    print("[步骤 2] 老岑人工修正系数，但没写原因")
    print("=" * 70)
    print()

    corr_result = await core.apply_manual_correction(
        record_id=result.record_id,
        field_name="friction_coeff",
        new_value=0.05,
        operator=OPERATOR_LAOCEN,
        reason=None,
    )
    print(f"✓ 修正结果: {corr_result['message']}")
    print(f"  状态: {corr_result['status']}")
    print(f"  新动量: {corr_result['new_corrected_momentum']:.4f}")

    detail = await core.get_record_detail(result.record_id)
    expected_after_corr = 10.0 * 3.0 * 0.90 * (1 - 0.05)
    print(f"  验证修正后动量: {detail.corrected_momentum:.4f} (期望值: {expected_after_corr:.4f})")
    assert abs(detail.corrected_momentum - expected_after_corr) < 0.0001, "修正后计算错误"
    assert detail.status == RECORD_STATUS["PENDING_REVIEW"], "未填原因应该标记为待复核"
    assert detail.has_manual_correction == True, "应该标记为有人工修正"
    assert len(detail.corrections) == 1, "应该有1条修正记录"
    assert detail.corrections[0].reason is None, "修正原因应该为空"
    assert len(detail.playbacks) == 2, "应该有2次回放记录"
    assert detail.playbacks[0].source == PLAYBACK_SOURCE["MANUAL_CORRECTION"], "最新回放应该是人工修正来源"
    print("✓ 未填原因 → 正确标记为待复核，留给设备工程师")
    print()

    print("=" * 70)
    print("[步骤 3] 维修师傅老岑补看工况照片，补录旧口径")
    print("=" * 70)
    print()

    photo_file = Path(__file__).resolve().parent / "data" / "photos" / "SN-2024-003_scene.txt"
    photo_result = await core.upload_work_photo(
        record_id=result.record_id,
        source_file_path=str(photo_file),
        note="从历史照片发现旧口径摩擦系数应为 0.08",
        extracted_friction_coeff=0.08,
        uploader=OPERATOR_LAOCEN,
    )
    print(f"✓ 照片上传: {photo_result['message']}")
    print(f"  新动量: {photo_result['new_corrected_momentum']:.4f}")

    detail = await core.get_record_detail(result.record_id)
    expected_after_photo = 10.0 * 3.0 * 0.90 * (1 - 0.08)
    print(f"  验证照片更新后动量: {detail.corrected_momentum:.4f} (期望值: {expected_after_photo:.4f})")
    assert abs(detail.corrected_momentum - expected_after_photo) < 0.0001, "照片更新后计算错误"
    assert len(detail.photos) == 1, "应该有1张照片"
    assert detail.photos[0].extracted_friction_coeff == 0.08, "应该提取到摩擦系数0.08"
    assert len(detail.playbacks) == 3, "应该有3次回放记录"
    assert detail.playbacks[0].source == PLAYBACK_SOURCE["PHOTO_SUPPLEMENT"], "最新回放应该是照片补充来源"
    print("✓ 补录照片后，参数回放页自动更新（摩擦系数从0.05→0.08）")
    print()

    print("=" * 70)
    print("[步骤 4] 设备工程师复核（之前没写原因的那条）")
    print("=" * 70)
    print()

    pending_records = await core.get_pending_review_records()
    print(f"当前待复核记录数: {len(pending_records)}")
    assert len(pending_records) >= 1, "应该有待复核记录"

    review_result = await core.review_record(result.record_id, OPERATOR_ENGINEER)
    print(f"✓ 复核结果: {review_result['message']}")
    print(f"  新状态: {review_result['new_status']}")

    detail = await core.get_record_detail(result.record_id)
    assert detail.status == RECORD_STATUS["REVIEWED"], "复核后应该标记为已复核"
    print("✓ 设备工程师复核通过")
    print()

    print("=" * 70)
    print("[结果对比] 三次回放结果对比")
    print("=" * 70)
    print()

    detail = await core.get_record_detail(result.record_id)
    print(f"传感器: {detail.sensor_no}")
    print(f"原始动量: {detail.raw_momentum:.4f} kg·m/s")
    print()
    print(f"{'次数':<6}{'来源':<12}{'摩擦系数':<10}{'动量结果':<15}{'能量损失':<12}")
    print("-" * 60)

    source_labels = {
        PLAYBACK_SOURCE["ORIGINAL"]: "原始数据",
        PLAYBACK_SOURCE["MANUAL_CORRECTION"]: "人工修正",
        PLAYBACK_SOURCE["PHOTO_SUPPLEMENT"]: "照片补充",
    }

    for i, pb in enumerate(reversed(detail.playbacks), 1):
        label = source_labels.get(pb.source, pb.source)
        friction = pb.parameters_used.get("friction_coeff", "N/A")
        print(f"第{i}次   {label:<12}{friction:<10}{pb.result_momentum:<15.4f}{pb.result_energy_loss:<12.4f}")

    print()
    print("三种处理结果数值不同 ✓")
    print(f"  原始(0.02): {expected_initial:.4f}")
    print(f"  人工(0.05): {expected_after_corr:.4f}")
    print(f"  照片(0.08): {expected_after_photo:.4f}")
    print()

    print("=" * 70)
    print("[关键细节验证]")
    print("=" * 70)
    print()

    print("✓ 碰到人工改过系数但没写原因时 → 标记为 pending_review，不归为正常")
    print("✓ 留给设备工程师复核 → review 命令可将状态改为 reviewed")
    print("✓ 补录工况照片后 → 参数回放页自动更新（playbacks 新增记录）")
    print("✓ 每次回放保留完整参数快照 → 可复盘、可重跑")
    print()

    print(core.format_record_for_display(detail))
    print()

    print("=" * 70)
    print("✓ 全部验证通过！")
    print("=" * 70)

    return True


if __name__ == "__main__":
    try:
        asyncio.run(verify_workflow())
    except Exception as e:
        print(f"\n✗ 验证失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
