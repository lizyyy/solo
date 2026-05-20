#!/usr/bin/env python3
"""
通知偏好系统核心规则测试脚本
验证来源优先级、偏好合并、发送前校验、变更快照等核心功能
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.models import (
    UserPreference, ChangeHistory, SendInterception, AnomalyQueue,
    ChannelType, SourceType, PreferenceStatus, BusinessScene
)
from app.services.preference_service import PreferenceService
from app.schemas.preference import PreferenceCreate

def init_test_db():
    """初始化测试数据库"""
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()

def print_section(title):
    """打印测试章节标题"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def test_source_priority():
    """测试1: 来源优先级机制"""
    print_section("测试1: 来源优先级机制")
    
    db = init_test_db()
    service = PreferenceService(db)
    
    print("✓ 初始化测试数据库")
    
    # 创建一个高优先级来源的偏好 (用户设置)
    pref1 = PreferenceCreate(
        user_id="user_001",
        channel=ChannelType.EMAIL,
        business_scene=BusinessScene.MARKETING,
        enabled=True,
        source=SourceType.USER_PROFILE
    )
    result1, success1 = service.create_preference(pref1)
    print(f"✓ 创建用户设置偏好 (USER_PROFILE, 优先级100) - ID: {result1.id}")
    assert result1.source_priority == 100, "用户设置优先级应为100"
    
    # 尝试用低优先级来源更新 (批量导入)
    pref2 = PreferenceCreate(
        user_id="user_001",
        channel=ChannelType.EMAIL,
        business_scene=BusinessScene.MARKETING,
        enabled=False,
        source=SourceType.BATCH_IMPORT
    )
    result2, success2 = service.create_preference(pref2)
    print(f"✓ 尝试批量导入覆盖 (BATCH_IMPORT, 优先级20)")
    
    # 验证未被覆盖
    assert not success2, "低优先级来源不应覆盖高优先级"
    assert result2.enabled == True, "偏好值不应被低优先级来源修改"
    print("✓ 低优先级来源未覆盖高优先级偏好 ✓")
    
    # 验证异常队列中是否有记录
    anomalies = service.get_anomaly_queue(user_id="user_001")
    assert len(anomalies) > 0, "应该有异常记录"
    assert anomalies[0].anomaly_type == "low_priority_override", "异常类型应为低优先级覆盖"
    print(f"✓ 异常队列记录已生成 - 类型: {anomalies[0].anomaly_type}")
    
    # 用相同来源更新 (用户再次设置)
    pref3 = PreferenceCreate(
        user_id="user_001",
        channel=ChannelType.EMAIL,
        business_scene=BusinessScene.MARKETING,
        enabled=False,
        source=SourceType.USER_PROFILE
    )
    result3, success3 = service.create_preference(pref3)
    print(f"✓ 尝试用户再次设置更新 (USER_PROFILE, 相同来源)")
    
    # 验证相同来源可以更新
    assert success3, "相同来源应可以更新"
    assert result3.enabled == False, "偏好值应被相同来源修改"
    print("✓ 相同来源成功更新 ✓")
    
    # 用更高优先级来源创建新记录 (管理员面板 - 注意优先级低于USER_PROFILE会被拦截)
    pref4 = PreferenceCreate(
        user_id="user_001",
        channel=ChannelType.EMAIL,
        business_scene=BusinessScene.MARKETING,
        enabled=True,
        source=SourceType.API
    )
    result4, success4 = service.create_preference(pref4)
    print(f"✓ 尝试API来源创建新记录 (API, 优先级60 - 低于USER_PROFILE)")
    
    # 验证低优先级来源被拦截
    assert not success4, "低优先级来源应被拦截"
    print("✓ 低优先级来源正确拦截 ✓")
    
    db.close()
    print("\n✓ 来源优先级机制测试通过!")

def test_preference_merge():
    """测试2: 偏好合并功能"""
    print_section("测试2: 偏好合并功能")
    
    db = init_test_db()
    service = PreferenceService(db)
    
    # 创建多个不同来源的偏好
    for i, source in enumerate([SourceType.BATCH_IMPORT, SourceType.API, SourceType.ADMIN_PANEL]):
        pref = PreferenceCreate(
            user_id="user_002",
            channel=ChannelType.SMS,
            business_scene=BusinessScene.TRANSACTIONAL,
            enabled=True,
            source=source,
            meta_data={"source_name": source.value, f"extra_{i}": f"data_{i}"}
        )
        result, _ = service.create_preference(pref)
        print(f"✓ 创建偏好 - 来源: {source.value}, 元数据: {result.meta_data}")
    
    # 执行合并
    merged = service.merge_preferences(
        "user_002",
        ChannelType.SMS,
        BusinessScene.TRANSACTIONAL
    )
    
    print(f"✓ 执行偏好合并")
    assert merged is not None, "合并应该返回结果"
    assert merged.status == PreferenceStatus.MERGED, "合并后状态应为MERGED"
    print(f"✓ 合并后状态: {merged.status}")
    
    # 验证元数据合并
    print(f"✓ 合并后元数据: {merged.meta_data}")
    assert "extra_0" in merged.meta_data, "元数据应包含所有来源的数据"
    assert "extra_1" in merged.meta_data, "元数据应包含所有来源的数据"
    assert "extra_2" in merged.meta_data, "元数据应包含所有来源的数据"
    print("✓ 元数据成功合并 ✓")
    
    db.close()
    print("\n✓ 偏好合并功能测试通过!")

def test_send_validation():
    """测试3: 发送前校验规则"""
    print_section("测试3: 发送前校验规则")
    
    db = init_test_db()
    service = PreferenceService(db)
    
    # 测试1: 未找到偏好配置 - 应该拦截
    print("测试场景1: 未找到偏好配置")
    result1, interception1 = service.validate_before_send(
        "user_003",
        ChannelType.IN_APP,
        BusinessScene.SECURITY
    )
    assert not result1.allowed, "未找到偏好时应拦截"
    assert result1.rule == "preference_not_found", "规则应为preference_not_found"
    print(f"  ✓ 结果: 拦截 - 原因: {result1.reason}")
    print(f"  ✓ 拦截记录已创建 - ID: {interception1.id}")
    
    # 测试2: 用户关闭通知 - 应该拦截
    print("\n测试场景2: 用户关闭通知")
    pref = PreferenceCreate(
        user_id="user_003",
        channel=ChannelType.IN_APP,
        business_scene=BusinessScene.SECURITY,
        enabled=False,
        source=SourceType.USER_PROFILE
    )
    service.create_preference(pref)
    
    result2, interception2 = service.validate_before_send(
        "user_003",
        ChannelType.IN_APP,
        BusinessScene.SECURITY
    )
    assert not result2.allowed, "用户关闭通知时应拦截"
    assert result2.rule == "preference_disabled", "规则应为preference_disabled"
    print(f"  ✓ 结果: 拦截 - 原因: {result2.reason}")
    
    # 测试3: 偏好状态异常 - 应该拦截
    print("\n测试场景3: 偏好状态异常")
    pref_error = PreferenceCreate(
        user_id="user_004",
        channel=ChannelType.EMAIL,
        business_scene=BusinessScene.MARKETING,
        enabled=True,
        source=SourceType.USER_PROFILE
    )
    result_pref, _ = service.create_preference(pref_error)
    result_pref.status = PreferenceStatus.ERROR
    db.flush()
    
    result3, interception3 = service.validate_before_send(
        "user_004",
        ChannelType.EMAIL,
        BusinessScene.MARKETING
    )
    assert not result3.allowed, "状态异常时应拦截"
    assert result3.rule == "invalid_preference_status", "规则应为invalid_preference_status"
    print(f"  ✓ 结果: 拦截 - 原因: {result3.reason}")
    
    # 测试4: 正常情况 - 应该允许
    print("\n测试场景4: 正常情况")
    pref_ok = PreferenceCreate(
        user_id="user_005",
        channel=ChannelType.EMAIL,
        business_scene=BusinessScene.MARKETING,
        enabled=True,
        source=SourceType.USER_PROFILE
    )
    service.create_preference(pref_ok)
    
    result4, interception4 = service.validate_before_send(
        "user_005",
        ChannelType.EMAIL,
        BusinessScene.MARKETING
    )
    assert result4.allowed, "正常情况应允许发送"
    print(f"  ✓ 结果: 允许发送")
    
    # 验证拦截记录统计
    interceptions = service.get_interceptions()
    print(f"\n✓ 总拦截记录数: {len(interceptions)}")
    
    blocked_count = sum(1 for i in interceptions if i.status.value == "blocked")
    allowed_count = sum(1 for i in interceptions if i.status.value == "allowed")
    print(f"  - 拦截: {blocked_count}")
    print(f"  - 允许: {allowed_count}")
    
    db.close()
    print("\n✓ 发送前校验规则测试通过!")

def test_change_history_snapshot():
    """测试4: 变更历史与快照功能"""
    print_section("测试4: 变更历史与快照功能")
    
    db = init_test_db()
    service = PreferenceService(db)
    
    # 创建初始偏好
    pref = PreferenceCreate(
        user_id="user_006",
        channel=ChannelType.EMAIL,
        business_scene=BusinessScene.MARKETING,
        enabled=True,
        source=SourceType.USER_PROFILE
    )
    result, _ = service.create_preference(pref)
    print(f"✓ 创建初始偏好 - ID: {result.id}")
    
    # 验证创建历史
    history = service.get_change_history(user_id="user_006")
    assert len(history) >= 1, "应该有创建历史记录"
    create_history = history[0]
    print(f"✓ 创建历史记录已生成 - 类型: {create_history.change_type}")
    assert create_history.change_type == "create", "变更类型应为create"
    
    # 验证快照数据
    assert create_history.snapshot is not None, "应该有快照数据"
    print(f"✓ 快照数据: {create_history.snapshot}")
    assert create_history.snapshot["user_id"] == "user_006", "快照应包含用户ID"
    assert create_history.snapshot["channel"] == "email", "快照应包含渠道"
    assert create_history.snapshot["enabled"] == True, "快照应包含启用状态"
    
    # 更新偏好
    pref_update = PreferenceCreate(
        user_id="user_006",
        channel=ChannelType.EMAIL,
        business_scene=BusinessScene.MARKETING,
        enabled=False,
        source=SourceType.USER_PROFILE
    )
    service.create_preference(pref_update)
    print("✓ 更新偏好")
    
    # 验证更新历史
    history = service.get_change_history(user_id="user_006")
    assert len(history) >= 2, "应该有更新历史记录"
    
    # 查找更新类型的历史记录
    update_history = None
    for h in history:
        if h.change_type == "same_source_update":
            update_history = h
            break
    assert update_history is not None, "应该有same_source_update类型的历史记录"
    
    print(f"✓ 更新历史记录已生成 - 类型: {update_history.change_type}")
    
    # 验证旧值和新值
    print(f"  - 旧值: {update_history.old_value}")
    print(f"  - 新值: {update_history.new_value}")
    assert update_history.old_value["enabled"] == True, "旧值enabled应为True"
    assert update_history.new_value["enabled"] == False, "新值enabled应为False"
    
    db.close()
    print("\n✓ 变更历史与快照功能测试通过!")

def test_anomaly_status_advance():
    """测试5: 异常状态推进功能"""
    print_section("测试5: 异常状态推进功能")
    
    db = init_test_db()
    service = PreferenceService(db)
    
    # 先创建一个会产生异常的场景
    pref_high = PreferenceCreate(
        user_id="user_007",
        channel=ChannelType.SMS,
        business_scene=BusinessScene.MARKETING,
        enabled=True,
        source=SourceType.USER_PROFILE
    )
    service.create_preference(pref_high)
    
    pref_low = PreferenceCreate(
        user_id="user_007",
        channel=ChannelType.SMS,
        business_scene=BusinessScene.MARKETING,
        enabled=False,
        source=SourceType.BATCH_IMPORT
    )
    service.create_preference(pref_low)
    
    # 获取异常
    anomalies = service.get_anomaly_queue(user_id="user_007")
    assert len(anomalies) == 1, "应该有一个异常"
    anomaly = anomalies[0]
    print(f"✓ 初始异常状态: {anomaly.status}")
    assert anomaly.status == "pending", "初始状态应为pending"
    
    # 标记为重试中
    service.advance_anomaly_status(anomaly.id, "retrying")
    anomaly = db.query(AnomalyQueue).get(anomaly.id)
    print(f"✓ 推进状态后: {anomaly.status}")
    assert anomaly.status == "retrying", "状态应为retrying"
    assert anomaly.retry_count == 1, "重试次数应为1"
    
    # 标记为已解决
    service.advance_anomaly_status(anomaly.id, "resolved", resolver="admin", resolution_note="人工确认无需处理")
    anomaly = db.query(AnomalyQueue).get(anomaly.id)
    print(f"✓ 标记解决后状态: {anomaly.status}")
    print(f"  - 解决人: {anomaly.resolver}")
    print(f"  - 解决备注: {anomaly.resolution_note}")
    assert anomaly.status == "resolved", "状态应为resolved"
    assert anomaly.resolver == "admin", "解决人应为admin"
    assert anomaly.resolved_at is not None, "解决时间应已设置"
    
    db.close()
    print("\n✓ 异常状态推进功能测试通过!")

def test_interception_report():
    """测试6: 拦截报告统计"""
    print_section("测试6: 拦截报告统计")
    
    db = init_test_db()
    service = PreferenceService(db)
    
    # 创建多个拦截场景
    # 场景1: 无偏好 - 拦截
    service.validate_before_send("user_100", ChannelType.EMAIL, BusinessScene.MARKETING)
    service.validate_before_send("user_100", ChannelType.SMS, BusinessScene.MARKETING)
    
    # 场景2: 有偏好但关闭 - 拦截
    pref = PreferenceCreate(
        user_id="user_101",
        channel=ChannelType.EMAIL,
        business_scene=BusinessScene.MARKETING,
        enabled=False,
        source=SourceType.USER_PROFILE
    )
    service.create_preference(pref)
    service.validate_before_send("user_101", ChannelType.EMAIL, BusinessScene.MARKETING)
    
    # 场景3: 有偏好且开启 - 允许
    pref2 = PreferenceCreate(
        user_id="user_102",
        channel=ChannelType.IN_APP,
        business_scene=BusinessScene.SYSTEM,
        enabled=True,
        source=SourceType.USER_PROFILE
    )
    service.create_preference(pref2)
    service.validate_before_send("user_102", ChannelType.IN_APP, BusinessScene.SYSTEM)
    
    # 生成报告
    report = service.generate_interception_report()
    print("✓ 拦截报告生成")
    print(f"  - 总拦截检查数: {report['total_interceptions']}")
    print(f"  - 拦截数: {report['blocked_count']}")
    print(f"  - 允许数: {report['allowed_count']}")
    print(f"  - 拦截率: {report['block_rate']:.2%}")
    print(f"  - 按规则统计: {report['by_rule']}")
    print(f"  - 按渠道统计: {report['by_channel']}")
    
    assert report['total_interceptions'] == 4, "总检查数应为4"
    assert report['blocked_count'] == 3, "拦截数应为3"
    assert report['allowed_count'] == 1, "允许数应为1"
    assert 'preference_not_found' in report['by_rule'], "应包含未找到偏好规则"
    assert 'preference_disabled' in report['by_rule'], "应包含关闭通知规则"
    
    db.close()
    print("\n✓ 拦截报告统计测试通过!")

def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("  通知偏好系统核心规则测试套件")
    print("="*60)
    
    tests = [
        ("来源优先级机制", test_source_priority),
        ("偏好合并功能", test_preference_merge),
        ("发送前校验规则", test_send_validation),
        ("变更历史与快照", test_change_history_snapshot),
        ("异常状态推进", test_anomaly_status_advance),
        ("拦截报告统计", test_interception_report),
    ]
    
    passed = 0
    failed = 0
    failed_tests = []
    
    for name, test_func in tests:
        try:
            test_func()
            passed += 1
        except Exception as e:
            failed += 1
            failed_tests.append((name, str(e)))
            print(f"\n✗ 测试失败: {name}")
            print(f"  错误: {e}")
    
    print("\n" + "="*60)
    print("  测试结果汇总")
    print("="*60)
    print(f"  通过: {passed}")
    print(f"  失败: {failed}")
    print(f"  总计: {len(tests)}")
    
    if failed_tests:
        print("\n  失败的测试:")
        for name, error in failed_tests:
            print(f"    - {name}: {error}")
    else:
        print("\n  ✓ 所有测试通过!")
    
    print("="*60 + "\n")
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
