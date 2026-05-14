#!/usr/bin/env python3
"""
Webhook 顺序保证 API - Python 版本（零依赖）
启动：python3 webhook_server.py
端口：8080
"""

import json
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread
import time

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

    def to_dict(self, is_idempotent=False):
        return {
            "eventId": self.event_id,
            "topic": self.topic,
            "businessKey": self.business_key,
            "sequenceNumber": self.sequence_number,
            "status": self.status,
            "outOfOrderReason": self.out_of_order_reason,
            "processResult": self.process_result,
            "errorMessage": self.error_message,
            "receivedAt": self.received_at.isoformat() if self.received_at else None,
            "processedAt": self.processed_at.isoformat() if self.processed_at else None,
            "expectedNextSequence": self.expected_next_sequence,
            "isIdempotent": is_idempotent
        }

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

    def to_dict(self):
        return {
            "topic": self.topic,
            "businessKey": self.business_key,
            "currentSequence": self.current_sequence,
            "expectedNextSequence": self.expected_next_sequence,
            "lastProcessedSequence": self.last_processed_sequence,
            "hasGap": self.has_gap,
            "gapStartSequence": self.gap_start_sequence,
            "waitingQueue": list(self.waiting_queue.keys()),
            "waitingQueueSize": len(self.waiting_queue)
        }

class SequenceService:
    def __init__(self):
        self.event_by_id = {}
        self.sequence_states = {}
        self.gap_timeout_seconds = 30

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
            print(f"[WARN] 检测到序列号缺口: topic={state.topic}, businessKey={state.business_key}, gapStart={expected_seq}")

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
        
        print(f"[WARN] 序列号缺口超时: topic={topic}, businessKey={business_key}, gapStart={state.gap_start_sequence}")
        
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
                print(f"[INFO] 超时处理序列号: {seq}")
        
        state.waiting_queue.clear()
        state.has_gap = False
        state.gap_start_sequence = None
        state.last_gap_detected_at = None
        state.expected_next_sequence = max_processed_seq + 1
        
        return processed

    def check_timeouts(self):
        now = datetime.now()
        for state in self.sequence_states.values():
            if state.has_gap and state.last_gap_detected_at:
                elapsed = (now - state.last_gap_detected_at).total_seconds()
                if elapsed >= self.gap_timeout_seconds:
                    self.process_timeout(state.topic, state.business_key)

service = SequenceService()

def timeout_checker():
    while True:
        service.check_timeouts()
        time.sleep(5)

class WebhookHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status_code=200, content_type="application/json"):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.end_headers()

    def _send_json(self, data, status_code=200):
        self._set_headers(status_code)
        self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))

    def do_GET(self):
        path = self.path
        
        if path == "/api/v1/events/health":
            self._send_json({
                "status": "UP",
                "service": "webhook-sequence-api",
                "timestamp": int(time.time() * 1000)
            })
            return
        
        if path.startswith("/api/v1/events/state"):
            query = path.split("?")[-1] if "?" in path else ""
            params = {}
            for param in query.split("&"):
                if "=" in param:
                    k, v = param.split("=", 1)
                    params[k] = v
            
            if "topic" in params and "businessKey" in params:
                state = service.get_or_create_state(params["topic"], params["businessKey"])
                self._send_json(state.to_dict())
                return
            else:
                self._send_json({"error": "Missing topic or businessKey"}, 400)
                return
        
        if path.startswith("/api/v1/events/export"):
            query = path.split("?")[-1] if "?" in path else ""
            params = {}
            for param in query.split("&"):
                if "=" in param:
                    k, v = param.split("=", 1)
                    params[k] = v
            
            events = list(service.event_by_id.values())
            
            if "topic" in params and "businessKey" in params:
                events = [e for e in events if e.topic == params["topic"] and e.business_key == params["businessKey"]]
            elif "topic" in params:
                events = [e for e in events if e.topic == params["topic"]]
            elif "businessKey" in params:
                events = [e for e in events if e.business_key == params["businessKey"]]
            
            self._send_json([e.to_dict() for e in events])
            return
        
        if path.startswith("/api/v1/events/trigger-timeout"):
            query = path.split("?")[-1] if "?" in path else ""
            params = {}
            for param in query.split("&"):
                if "=" in param:
                    k, v = param.split("=", 1)
                    params[k] = v
            
            if "topic" in params and "businessKey" in params:
                processed = service.process_timeout(params["topic"], params["businessKey"])
                self._send_json({
                    "processed": len(processed),
                    "events": [e.to_dict() for e in processed]
                })
                return
            else:
                self._send_json({"error": "Missing topic or businessKey"}, 400)
                return
        
        if path.startswith("/api/v1/events/"):
            event_id = path.split("/")[-1]
            if event_id in service.event_by_id:
                self._send_json(service.event_by_id[event_id].to_dict())
                return
            else:
                self._send_json({"error": "Event not found"}, 404)
                return
        
        if path == "/api/v1/events" or path == "/api/v1/events/":
            events = [e.to_dict() for e in service.event_by_id.values()]
            self._send_json(events)
            return
        
        self._send_json({"error": "Not found"}, 404)

    def do_POST(self):
        path = self.path
        
        if path == "/api/v1/events" or path == "/api/v1/events/":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                self._send_json({"error": "Invalid JSON"}, 400)
                return
            
            required = ["eventId", "topic", "businessKey", "sequenceNumber"]
            for field in required:
                if field not in data:
                    self._send_json({"error": f"Missing required field: {field}"}, 400)
                    return
            
            event, is_idempotent = service.process_event(
                data["eventId"],
                data["topic"],
                data["businessKey"],
                int(data["sequenceNumber"])
            )
            
            if event.status == EventStatus.SUCCESS:
                status_code = 200
            elif event.status == EventStatus.WAITING:
                status_code = 202
            elif event.status == EventStatus.SKIPPED:
                status_code = 409
            else:
                status_code = 500
            
            self._send_json(event.to_dict(is_idempotent), status_code)
            return
        
        self._send_json({"error": "Not found"}, 404)

    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {args[0]}")

def run(port=8080):
    server = HTTPServer(("0.0.0.0", port), WebhookHandler)
    
    Thread(target=timeout_checker, daemon=True).start()
    
    print("=" * 60)
    print("  Webhook 顺序保证 API - Python 服务器已启动")
    print(f"  端口: {port}")
    print("=" * 60)
    print()
    print("API 端点:")
    print("  POST /api/v1/events            - 提交事件")
    print("  GET  /api/v1/events/{id}       - 查询单个事件")
    print("  GET  /api/v1/events            - 查询所有事件")
    print("  GET  /api/v1/events/state      - 查询序列状态")
    print("  GET  /api/v1/events/export     - 导出所有事件")
    print("  GET  /api/v1/events/health     - 健康检查")
    print()
    print("测试命令:")
    print("  curl http://localhost:8080/api/v1/events/health")
    print("  curl -X POST http://localhost:8080/api/v1/events \\")
    print("    -H 'Content-Type: application/json' \\")
    print("    -d '{\"eventId\":\"evt-1\",\"topic\":\"order\",\"businessKey\":\"biz-1\",\"sequenceNumber\":1}'")
    print()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        server.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run(port)
