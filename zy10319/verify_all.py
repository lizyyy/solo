#!/usr/bin/env python3
"""
Webhook 顺序保证 API - 完整逻辑验证（零依赖）
直接运行：python3 verify_all.py
"""

import json
import sys
from datetime import datetime

class EventStatus:
    PENDING = "PENDING"
    WAITING = "WAITING"
    PROCESSING = "PROCESSING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"
    SKIPPED = "SKIPPED"

class OutOfOrderReason:
    GAP = "GAP"
    DUPLICATE = "DUPLICATE"
    RETROACTIVE = "RETROACTIVE"
    TIMEOUT = "TIMEOUT"
    NONE = "NONE"

class EventContext:
    def __init__(self, event_id, topic, business_key, sequence_number):
        self.event_id = event_id
        self.topic = topic
        self.business_key = business_key
        self.sequence_number = sequence_number
        self.status = EventStatus.PENDING
        self.out_of_order_reason = OutOfOrderReason.NONE
        self.process_result = None
        self.error_message = None
        self.received_at = datetime.now()
        self.processed_at = None
        self.expected_next_sequence = None

class SequenceState:
    def __init__(self, topic, business_key):
        self.topic = topic
        self.business_key = business_key
        self.current_sequence = 0
        self.expected_next_sequence = 1
        self.last_processed_sequence = None
        self.waiting_queue = {}
        self.last_gap_detected_at = None
        self.has_gap = False
        self.gap_start_sequence = None

class SequenceService:
    def __init__(self):
        self.event_by_id = {}
        self.sequence_states = {}
    
    def get_state_key(self, topic, business_key):
        return f"{topic}:{business_key}"
    
    def get_or_create_state(self, topic, business_key):
        key = self.get_state_key(topic, business_key)
        if key not in self.sequence_states:
            self.sequence_states[key] = SequenceState(topic, business_key)
        return self.sequence_states[key]
    
    def process_event(self, event_id, topic, business_key, sequence_number):
        existing = self.event_by_id.get(event_id)
        if existing:
            return existing, True
        
        state = self.get_or_create_state(topic, business_key)
        context = EventContext(event_id, topic, business_key, sequence_number)
        
        expected_seq = state.expected_next_sequence
        current_seq = sequence_number
        
        if current_seq == expected_seq:
            self._process_in_order(context, state)
        elif current_seq < expected_seq:
            if state.last_processed_sequence and current_seq <= state.last_processed_sequence:
                context.status = EventStatus.SKIPPED
                context.out_of_order_reason = OutOfOrderReason.RETROACTIVE
                context.error_message = f"序列号 {current_seq} 已处理过，跳过"
            else:
                context.status = EventStatus.SKIPPED
                context.out_of_order_reason = OutOfOrderReason.DUPLICATE
                context.error_message = f"序列号 {current_seq} 重复，跳过"
        else:
            self._process_out_of_order(context, state, expected_seq)
        
        context.expected_next_sequence = state.expected_next_sequence
        self.event_by_id[event_id] = context
        
        return context, False
    
    def _process_in_order(self, context, state):
        context.status = EventStatus.SUCCESS
        context.process_result = "顺序处理成功"
        context.processed_at = datetime.now()
        
        state.current_sequence = context.sequence_number
        state.last_processed_sequence = context.sequence_number
        state.expected_next_sequence = context.sequence_number + 1
        state.has_gap = False
        state.gap_start_sequence = None
        state.last_gap_detected_at = None
        
        self._process_waiting_queue(state)
    
    def _process_out_of_order(self, context, state, expected_seq):
        context.status = EventStatus.WAITING
        context.out_of_order_reason = OutOfOrderReason.GAP
        context.error_message = f"序列号不连续，期望 {expected_seq}，实际 {context.sequence_number}，进入等待队列"
        
        state.waiting_queue[context.sequence_number] = context
        
        if not state.has_gap:
            state.has_gap = True
            state.gap_start_sequence = expected_seq
            state.last_gap_detected_at = datetime.now()
    
    def _process_waiting_queue(self, state):
        processed_seqs = []
        
        for seq in sorted(state.waiting_queue.keys()):
            waiting_event = state.waiting_queue[seq]
            if seq == state.expected_next_sequence:
                waiting_event.status = EventStatus.SUCCESS
                waiting_event.process_result = "从等待队列恢复处理成功"
                waiting_event.processed_at = datetime.now()
                waiting_event.out_of_order_reason = OutOfOrderReason.NONE
                waiting_event.error_message = None
                
                state.current_sequence = seq
                state.last_processed_sequence = seq
                state.expected_next_sequence = seq + 1
                
                processed_seqs.append(seq)
            else:
                break
        
        for seq in processed_seqs:
            del state.waiting_queue[seq]
        
        if not state.waiting_queue:
            state.has_gap = False
            state.gap_start_sequence = None
            state.last_gap_detected_at = None
    
    def process_timeout(self, topic, business_key):
        state = self.get_or_create_state(topic, business_key)
        if not state.has_gap:
            return []
        
        print(f"  [超时处理] gapStart={state.gap_start_sequence}, 等待队列={list(state.waiting_queue.keys())}")
        
        processed = []
        max_processed_seq = state.gap_start_sequence - 1
        
        for seq in sorted(state.waiting_queue.keys()):
            waiting_event = state.waiting_queue[seq]
            
            if waiting_event.sequence_number >= state.gap_start_sequence:
                waiting_event.status = EventStatus.SUCCESS
                waiting_event.process_result = "超时强制处理"
                waiting_event.processed_at = datetime.now()
                waiting_event.out_of_order_reason = OutOfOrderReason.TIMEOUT
                waiting_event.error_message = None
                
                if waiting_event.sequence_number > max_processed_seq:
                    max_processed_seq = waiting_event.sequence_number
                
                state.last_processed_sequence = waiting_event.sequence_number
                processed.append(waiting_event)
                print(f"    -> 处理序列号: {seq}")
        
        state.waiting_queue.clear()
        state.has_gap = False
        state.gap_start_sequence = None
        state.last_gap_detected_at = None
        state.expected_next_sequence = max_processed_seq + 1
        
        return processed

def print_event(event, is_idempotent=False):
    print(f"    eventId: {event.event_id}")
    print(f"    sequenceNumber: {event.sequence_number}")
    print(f"    status: {event.status}")
    print(f"    outOfOrderReason: {event.out_of_order_reason}")
    if event.process_result:
        print(f"    processResult: {event.process_result}")
    if event.error_message:
        print(f"    errorMessage: {event.error_message}")
    print(f"    expectedNextSequence: {event.expected_next_sequence}")
    print(f"    isIdempotent: {is_idempotent}")

def print_state(state):
    print(f"    topic: {state.topic}")
    print(f"    businessKey: {state.business_key}")
    print(f"    expectedNextSequence: {state.expected_next_sequence}")
    print(f"    lastProcessedSequence: {state.last_processed_sequence}")
    print(f"    hasGap: {state.has_gap}")
    print(f"    gapStartSequence: {state.gap_start_sequence}")
    print(f"    waitingQueue: {list(state.waiting_queue.keys())}")

def main():
    print("=" * 60)
    print("  Webhook 顺序保证 API - 完整逻辑验证（零依赖）")
    print("=" * 60)
    print()
    
    service = SequenceService()
    all_passed = True
    
    print("【场景 1】顺序提交 1 -> 2 -> 3 -> 4")
    print("-" * 60)
    for seq in [1, 2, 3, 4]:
        event, idempotent = service.process_event(f"seq1-{seq}", "order", "biz-1", seq)
        assert event.status == EventStatus.SUCCESS, f"序列号 {seq} 应该 SUCCESS"
        assert idempotent == False, "不应该幂等"
    print(f"  ✅ 4 个事件顺序处理成功")
    state = service.get_or_create_state("order", "biz-1")
    assert state.last_processed_sequence == 4, f"最后处理应该是 4，实际 {state.last_processed_sequence}"
    assert state.expected_next_sequence == 5, f"期望下一个应该是 5，实际 {state.expected_next_sequence}"
    assert state.has_gap == False, "不应该有缺口"
    print(f"  ✅ lastProcessedSequence={state.last_processed_sequence}, expectedNextSequence={state.expected_next_sequence}")
    print()
    
    print("【场景 2】乱序提交 1 -> 2 -> 4 (跳过 3)，验证等待队列")
    print("-" * 60)
    service.process_event("seq2-1", "order", "biz-2", 1)
    service.process_event("seq2-2", "order", "biz-2", 2)
    event4, _ = service.process_event("seq2-4", "order", "biz-2", 4)
    assert event4.status == EventStatus.WAITING, f"序列号 4 应该 WAITING，实际 {event4.status}"
    print(f"  ✅ 提交序列号 4，状态: {event4.status}，原因: {event4.out_of_order_reason}")
    
    state = service.get_or_create_state("order", "biz-2")
    assert state.has_gap == True, "应该有缺口"
    assert state.gap_start_sequence == 3, f"缺口应该从 3 开始，实际 {state.gap_start_sequence}"
    assert 4 in state.waiting_queue, "4 应该在等待队列"
    print(f"  ✅ hasGap={state.has_gap}, gapStart={state.gap_start_sequence}, 等待队列={list(state.waiting_queue.keys())}")
    print()
    
    print("【场景 3】补充缺口序列号 3，验证自动推进")
    print("-" * 60)
    event3, _ = service.process_event("seq2-3", "order", "biz-2", 3)
    assert event3.status == EventStatus.SUCCESS, f"序列号 3 应该 SUCCESS，实际 {event3.status}"
    print(f"  ✅ 提交序列号 3，状态: {event3.status}")
    
    state = service.get_or_create_state("order", "biz-2")
    assert state.last_processed_sequence == 4, f"最后处理应该是 4，实际 {state.last_processed_sequence}"
    assert state.expected_next_sequence == 5, f"期望下一个应该是 5，实际 {state.expected_next_sequence}"
    assert state.has_gap == False, "缺口应该已关闭"
    assert len(state.waiting_queue) == 0, "等待队列应该为空"
    print(f"  ✅ 等待队列中的 4 被自动处理，lastProcessedSequence={state.last_processed_sequence}, waitingQueue 为空")
    print()
    
    print("【场景 4】幂等性验证 - 重复提交相同 eventId")
    print("-" * 60)
    event_first, idempotent_first = service.process_event("idempotent-1", "order", "biz-3", 1)
    assert idempotent_first == False, "第一次不应该幂等"
    print(f"  ✅ 第一次提交 - isIdempotent={idempotent_first}")
    
    event_dup, idempotent_dup = service.process_event("idempotent-1", "order", "biz-3", 1)
    assert idempotent_dup == True, "重复提交应该幂等"
    assert event_first.event_id == event_dup.event_id, "应该返回相同事件"
    print(f"  ✅ 重复提交 - isIdempotent={idempotent_dup}")
    print()
    
    print("【场景 5】回溯序列号验证 - 提交已处理过的序列号")
    print("-" * 60)
    service.process_event("retro-1", "order", "biz-4", 1)
    service.process_event("retro-2", "order", "biz-4", 2)
    
    event_retro, _ = service.process_event("retro-1-dup", "order", "biz-4", 1)
    assert event_retro.status == EventStatus.SKIPPED, f"应该 SKIPPED，实际 {event_retro.status}"
    assert event_retro.out_of_order_reason == OutOfOrderReason.RETROACTIVE, f"原因应该是 RETROACTIVE，实际 {event_retro.out_of_order_reason}"
    print(f"  ✅ 回溯序列号 1 - status={event_retro.status}, reason={event_retro.out_of_order_reason}")
    print_event(event_retro)
    print()
    
    print("【场景 6】缺口超时强制推进 - 1,2,5 跳过 3,4")
    print("-" * 60)
    service.process_event("timeout-1", "order", "biz-timeout", 1)
    service.process_event("timeout-2", "order", "biz-timeout", 2)
    service.process_event("timeout-5", "order", "biz-timeout", 5)
    
    state = service.get_or_create_state("order", "biz-timeout")
    assert state.has_gap == True, "应该有缺口"
    assert state.gap_start_sequence == 3, f"缺口应该从 3 开始，实际 {state.gap_start_sequence}"
    assert 5 in state.waiting_queue, "5 应该在等待队列"
    print(f"  ✅ 提交 1,2,5 后 - hasGap={state.has_gap}, gapStart={state.gap_start_sequence}")
    print(f"     等待队列: {list(state.waiting_queue.keys())}")
    
    processed = service.process_timeout("order", "biz-timeout")
    assert len(processed) == 1, f"应该处理 1 个事件，实际 {len(processed)}"
    
    state = service.get_or_create_state("order", "biz-timeout")
    assert state.last_processed_sequence == 5, f"最后处理应该是 5，实际 {state.last_processed_sequence}"
    assert state.expected_next_sequence == 6, f"期望下一个应该是 6，实际 {state.expected_next_sequence}"
    assert state.has_gap == False, "缺口应该已关闭"
    assert len(state.waiting_queue) == 0, "等待队列应该为空"
    print(f"  ✅ 超时处理后 - lastProcessedSequence={state.last_processed_sequence}, expectedNextSequence={state.expected_next_sequence}")
    print()
    
    print("【场景 7】历史查询 - 查询单个事件")
    print("-" * 60)
    queried = service.event_by_id.get("seq2-3")
    assert queried is not None, "应该能查询到事件"
    assert queried.sequence_number == 3, f"序列号应该是 3，实际 {queried.sequence_number}"
    assert queried.status == EventStatus.SUCCESS, f"状态应该是 SUCCESS，实际 {queried.status}"
    print(f"  ✅ 查询事件 seq2-3 - eventId={queried.event_id}, sequence={queried.sequence_number}, status={queried.status}")
    print_event(queried)
    print()
    
    print("【场景 8】导出一致性 - 所有事件查询")
    print("-" * 60)
    all_events = list(service.event_by_id.values())
    print(f"  ✅ 总事件数: {len(all_events)}")
    print(f"     事件列表: {[e.event_id for e in all_events[:5]]}...")
    
    success_count = sum(1 for e in all_events if e.status == EventStatus.SUCCESS)
    skipped_count = sum(1 for e in all_events if e.status == EventStatus.SKIPPED)
    waiting_count = sum(1 for e in all_events if e.status == EventStatus.WAITING)
    print(f"     SUCCESS: {success_count}, SKIPPED: {skipped_count}, WAITING: {waiting_count}")
    
    assert success_count >= 8, f"至少应该有 8 个成功事件，实际 {success_count}"
    assert skipped_count == 1, f"应该有 1 个跳过事件，实际 {skipped_count}"
    assert waiting_count == 0, f"不应该有等待事件，实际 {waiting_count}"
    print()
    
    print("【场景 9】多业务键隔离验证")
    print("-" * 60)
    _, _ = service.process_event("multi-a1", "order", "biz-a", 1)
    _, _ = service.process_event("multi-a2", "order", "biz-a", 2)
    _, _ = service.process_event("multi-b1", "order", "biz-b", 1)
    
    state_a = service.get_or_create_state("order", "biz-a")
    state_b = service.get_or_create_state("order", "biz-b")
    
    assert state_a.last_processed_sequence == 2, f"biz-a 最后处理应该是 2，实际 {state_a.last_processed_sequence}"
    assert state_b.last_processed_sequence == 1, f"biz-b 最后处理应该是 1，实际 {state_b.last_processed_sequence}"
    print(f"  ✅ biz-a - lastProcessed={state_a.last_processed_sequence}, nextExpected={state_a.expected_next_sequence}")
    print(f"  ✅ biz-b - lastProcessed={state_b.last_processed_sequence}, nextExpected={state_b.expected_next_sequence}")
    print(f"  ✅ 多业务键状态正确隔离")
    print()
    
    print("=" * 60)
    print("                    验证总结")
    print("=" * 60)
    print()
    print("✅ 顺序处理: 连续序列号直接 SUCCESS")
    print("✅ 乱序等待: 非连续序列号进入 WAITING 状态")
    print("✅ 缺口补齐: 提交缺失序列号后自动推进等待队列")
    print("✅ 幂等保证: 相同 eventId 重复提交标记 isIdempotent=true")
    print("✅ 回溯跳过: 已处理过的序列号直接 SKIPPED")
    print("✅ 超时推进: 缺口超时后强制处理所有等待事件")
    print("✅ 历史查询: 可按 eventId 查询事件详情")
    print("✅ 导出一致: 所有事件状态完整可追溯")
    print("✅ 业务隔离: 不同 businessKey 状态完全隔离")
    print()
    print("🎉 所有 9 个场景验证通过！")
    print()
    print(f"  总事件数: {len(all_events)}")
    print(f"  业务数: {len(service.sequence_states)}")
    print()
    print("=" * 60)
    print("  核心逻辑验证完成，无需任何环境依赖！")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\n❌ 验证失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
