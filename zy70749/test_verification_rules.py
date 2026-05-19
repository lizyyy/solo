#!/usr/bin/env python3
"""测试双投验证规则修复效果"""
import json
from datetime import datetime, timedelta
from webhook_verifier.models import VerificationRule, WebhookEvent, EventStatus
from webhook_verifier.rules import DualDeliveryMatcher, SwitchStateMachine, VerificationEngine


def create_event(event_id: str, endpoint: str, status_code: int, payload_hash: str, ts_offset: int = 0) -> WebhookEvent:
    """创建测试事件"""
    base_time = datetime.now()
    return WebhookEvent(
        vendor="supplier_a",
        event_type="order_created",
        event_id=event_id,
        timestamp=base_time + timedelta(seconds=ts_offset),
        endpoint=endpoint,
        payload_hash=payload_hash,
        status_code=status_code,
        raw="",
        source_file="test.json",
        line_number=1,
    )


def test_new_endpoint_status_500():
    """测试：新端点全部返回 500，应该判定为失败"""
    print("\n" + "=" * 60)
    print("测试场景 1: 新端点全部返回 status_code=500")
    print("=" * 60)

    rule = VerificationRule(
        vendor="supplier_a",
        event_type="order_created",
        dual_delivery_window_seconds=300,
        min_success_rate=0.95,
        required_consecutive_success=5,
    )

    old_endpoint = "https://example.com/old/webhook"
    new_endpoint = "https://example.com/new/webhook"

    events = []
    for i in range(10):
        events.append(create_event(f"evt_{i:03d}", old_endpoint, 200, f"hash_{i}", i * 2))
        events.append(create_event(f"evt_{i:03d}", new_endpoint, 500, f"hash_{i}", i * 2 + 1))

    matcher = DualDeliveryMatcher(old_endpoint, new_endpoint, rule)
    results = matcher.match_events(events)

    print(f"\n总事件数: {len(results)}")
    verified_count = sum(1 for r in results if r.status == EventStatus.VERIFIED)
    dual_delivered_count = sum(1 for r in results if r.status == EventStatus.DUAL_DELIVERED)
    print(f"VERIFIED (验证通过): {verified_count}")
    print(f"DUAL_DELIVERED (仅双投未通过校验): {dual_delivered_count}")
    print(f"\n前3个事件详情:")
    for r in results[:3]:
        print(f"  event_id={r.event_id}: old_status={r.old_status_code}, new_status={r.new_status_code}, "
              f"old_success={r.old_status_success}, new_success={r.new_status_success}, status={r.status.value}")

    state_machine = SwitchStateMachine(rule)
    state, conclusion = state_machine.process_results(results)

    print(f"\n最终状态: {state.value}")
    print(f"可切换: {conclusion.can_switch}")
    print(f"成功率: {conclusion.success_rate:.2%}")
    print(f"建议: {conclusion.recommendation}")

    # 验证结果
    assert conclusion.can_switch == False, "新端点 500 时不应允许切换"
    assert verified_count == 0, "新端点 500 时不应有 VERIFIED 事件"
    assert dual_delivered_count == 10, "应全部为 DUAL_DELIVERED 状态"
    print("\n✅ 测试通过: 新端点 500 时正确判定为不可切换")


def test_payload_hash_mismatch():
    """测试：新旧 payload_hash 不一致，应该判定为失败"""
    print("\n" + "=" * 60)
    print("测试场景 2: 新旧 payload_hash 不一致")
    print("=" * 60)

    rule = VerificationRule(
        vendor="supplier_a",
        event_type="order_created",
        dual_delivery_window_seconds=300,
        min_success_rate=0.95,
        required_consecutive_success=5,
        require_payload_match=True,
    )

    old_endpoint = "https://example.com/old/webhook"
    new_endpoint = "https://example.com/new/webhook"

    events = []
    for i in range(10):
        events.append(create_event(f"evt_{i:03d}", old_endpoint, 200, f"hash_old_{i}", i * 2))
        events.append(create_event(f"evt_{i:03d}", new_endpoint, 200, f"hash_new_{i}", i * 2 + 1))

    matcher = DualDeliveryMatcher(old_endpoint, new_endpoint, rule)
    results = matcher.match_events(events)

    print(f"\n总事件数: {len(results)}")
    verified_count = sum(1 for r in results if r.status == EventStatus.VERIFIED)
    dual_delivered_count = sum(1 for r in results if r.status == EventStatus.DUAL_DELIVERED)
    print(f"VERIFIED (验证通过): {verified_count}")
    print(f"DUAL_DELIVERED (仅双投未通过校验): {dual_delivered_count}")
    print(f"\n前3个事件详情:")
    for r in results[:3]:
        print(f"  event_id={r.event_id}: payload_match={r.payload_match}, status={r.status.value}")

    state_machine = SwitchStateMachine(rule)
    state, conclusion = state_machine.process_results(results)

    print(f"\n最终状态: {state.value}")
    print(f"可切换: {conclusion.can_switch}")
    print(f"成功率: {conclusion.success_rate:.2%}")
    print(f"建议: {conclusion.recommendation}")

    # 验证结果
    assert conclusion.can_switch == False, "payload 不一致时不应允许切换"
    assert verified_count == 0, "payload 不一致时不应有 VERIFIED 事件"
    assert dual_delivered_count == 10, "应全部为 DUAL_DELIVERED 状态"
    print("\n✅ 测试通过: payload 不一致时正确判定为不可切换")


def test_partial_failure():
    """测试：部分事件失败"""
    print("\n" + "=" * 60)
    print("测试场景 3: 部分事件失败 (70% 成功率)")
    print("=" * 60)

    rule = VerificationRule(
        vendor="supplier_a",
        event_type="order_created",
        dual_delivery_window_seconds=300,
        min_success_rate=0.95,
        required_consecutive_success=5,
    )

    old_endpoint = "https://example.com/old/webhook"
    new_endpoint = "https://example.com/new/webhook"

    events = []
    for i in range(10):
        new_status = 200 if i < 7 else 500
        events.append(create_event(f"evt_{i:03d}", old_endpoint, 200, f"hash_{i}", i * 2))
        events.append(create_event(f"evt_{i:03d}", new_endpoint, new_status, f"hash_{i}", i * 2 + 1))

    matcher = DualDeliveryMatcher(old_endpoint, new_endpoint, rule)
    results = matcher.match_events(events)

    print(f"\n总事件数: {len(results)}")
    verified_count = sum(1 for r in results if r.status == EventStatus.VERIFIED)
    dual_delivered_count = sum(1 for r in results if r.status == EventStatus.DUAL_DELIVERED)
    print(f"VERIFIED (验证通过): {verified_count}")
    print(f"DUAL_DELIVERED (仅双投未通过校验): {dual_delivered_count}")

    state_machine = SwitchStateMachine(rule)
    state, conclusion = state_machine.process_results(results)

    print(f"\n最终状态: {state.value}")
    print(f"可切换: {conclusion.can_switch}")
    print(f"成功率: {conclusion.success_rate:.2%}")
    print(f"建议: {conclusion.recommendation}")

    # 验证结果
    assert conclusion.can_switch == False, "70% 成功率低于 95% 阈值，不应允许切换"
    assert verified_count == 7, "应正确计算通过验证的事件数"
    assert state.value == "rollback", "应触发回退状态"
    print("\n✅ 测试通过: 部分失败时正确触发 rollback")


def test_all_success():
    """测试：全部事件验证通过"""
    print("\n" + "=" * 60)
    print("测试场景 4: 全部事件验证通过")
    print("=" * 60)

    rule = VerificationRule(
        vendor="supplier_a",
        event_type="order_created",
        dual_delivery_window_seconds=300,
        min_success_rate=0.95,
        required_consecutive_success=5,
    )

    old_endpoint = "https://example.com/old/webhook"
    new_endpoint = "https://example.com/new/webhook"

    events = []
    for i in range(10):
        events.append(create_event(f"evt_{i:03d}", old_endpoint, 200, f"hash_{i}", i * 2))
        events.append(create_event(f"evt_{i:03d}", new_endpoint, 200, f"hash_{i}", i * 2 + 1))

    matcher = DualDeliveryMatcher(old_endpoint, new_endpoint, rule)
    results = matcher.match_events(events)

    print(f"\n总事件数: {len(results)}")
    verified_count = sum(1 for r in results if r.status == EventStatus.VERIFIED)
    print(f"VERIFIED (验证通过): {verified_count}")

    state_machine = SwitchStateMachine(rule)
    state, conclusion = state_machine.process_results(results)

    print(f"\n最终状态: {state.value}")
    print(f"可切换: {conclusion.can_switch}")
    print(f"成功率: {conclusion.success_rate:.2%}")
    print(f"连续成功: {conclusion.details.get('consecutive_success', 0)}")
    print(f"建议: {conclusion.recommendation}")

    # 验证结果
    assert conclusion.can_switch == True, "全部通过时应允许切换"
    assert verified_count == 10, "全部事件都应 VERIFIED"
    assert state.value == "ready_to_switch"
    print("\n✅ 测试通过: 全部验证通过时正确判定为可切换")


def test_payload_match_disabled():
    """测试：禁用 payload 校验时，hash 不一致也能通过"""
    print("\n" + "=" * 60)
    print("测试场景 5: 禁用 payload 校验")
    print("=" * 60)

    rule = VerificationRule(
        vendor="supplier_a",
        event_type="order_created",
        dual_delivery_window_seconds=300,
        min_success_rate=0.95,
        required_consecutive_success=5,
        require_payload_match=False,
    )

    old_endpoint = "https://example.com/old/webhook"
    new_endpoint = "https://example.com/new/webhook"

    events = []
    for i in range(10):
        events.append(create_event(f"evt_{i:03d}", old_endpoint, 200, f"hash_old_{i}", i * 2))
        events.append(create_event(f"evt_{i:03d}", new_endpoint, 200, f"hash_new_{i}", i * 2 + 1))

    matcher = DualDeliveryMatcher(old_endpoint, new_endpoint, rule)
    results = matcher.match_events(events)

    print(f"\n总事件数: {len(results)}")
    verified_count = sum(1 for r in results if r.status == EventStatus.VERIFIED)
    print(f"VERIFIED (验证通过): {verified_count}")
    print(f"payload_match={results[0].payload_match}")

    state_machine = SwitchStateMachine(rule)
    state, conclusion = state_machine.process_results(results)

    print(f"\n最终状态: {state.value}")
    print(f"可切换: {conclusion.can_switch}")
    print(f"成功率: {conclusion.success_rate:.2%}")

    # 验证结果
    assert conclusion.can_switch == True, "禁用 payload 校验时，hash 不一致也应允许切换"
    assert verified_count == 10, "全部事件都应 VERIFIED"
    print("\n✅ 测试通过: 禁用 payload 校验时正确忽略 hash 不一致")


if __name__ == "__main__":
    test_new_endpoint_status_500()
    test_payload_hash_mismatch()
    test_partial_failure()
    test_all_success()
    test_payload_match_disabled()
    print("\n" + "=" * 60)
    print("🎉 所有测试全部通过！")
    print("=" * 60)
