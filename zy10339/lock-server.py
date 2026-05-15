#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
资源锁冲突解释 API - Python HTTP 服务器版本
完整REST/JSON接口，无需编译，直接运行
"""

import json
import time
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from collections import OrderedDict
import threading

# 数据存储
LOCK_STORE = OrderedDict()
WAIT_QUEUE = []
RELEASE_HISTORY = []
IDEMPOTENT_CACHE = {}

REQUEST_COUNTER = 0
START_TIME = time.time()


class LockServerHandler(BaseHTTPRequestHandler):
    """HTTP请求处理器"""

    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-type', f'{content_type}; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_GET(self):
        global REQUEST_COUNTER
        REQUEST_COUNTER += 1
        
        path = self.path
        
        if path == '/':
            self.send_dashboard()
        elif path == '/api/locks':
            self.handle_get_all_locks()
        elif path == '/api/locks/export':
            self.handle_export_all()
        elif path.startswith('/api/locks/'):
            self.handle_lock_operations(path)
        else:
            self.send_error_response(404, "Not Found: " + path)

    def do_POST(self):
        global REQUEST_COUNTER
        REQUEST_COUNTER += 1
        
        path = self.path
        
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
        except:
            request_data = {}
        
        if path == '/api/locks/acquire':
            self.handle_acquire_lock(request_data)
        elif path == '/api/locks/release':
            self.handle_release_lock(request_data)
        else:
            self.send_error_response(404, "Not Found: " + path)

    def send_json_response(self, data, status=200):
        self._set_headers(status)
        response = json.dumps(data, ensure_ascii=False, indent=2)
        self.wfile.write(response.encode('utf-8'))

    def send_error_response(self, code, message):
        response = OrderedDict([
            ("code", code),
            ("message", message),
            ("data", None)
        ])
        self.send_json_response(response, code)

    def send_success_response(self, data, message="操作成功"):
        response = OrderedDict([
            ("code", 200),
            ("message", message),
            ("data", data)
        ])
        self.send_json_response(response)

    def send_dashboard(self):
        uptime = int(time.time() - START_TIME)
        locked_count = sum(1 for lock in LOCK_STORE.values() if lock.get('status') == 'LOCKED')
        released_count = sum(1 for lock in LOCK_STORE.values() if lock.get('status') == 'RELEASED')
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>资源锁冲突解释 API</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; padding: 20px; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }}
        .header h1 {{ font-size: 28px; margin-bottom: 10px; }}
        .stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }}
        .stat-card {{ background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
        .stat-card .number {{ font-size: 32px; font-weight: bold; color: #667eea; }}
        .stat-card .label {{ color: #666; font-size: 14px; margin-top: 5px; }}
        .section {{ background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
        .section h2 {{ font-size: 20px; margin-bottom: 20px; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }}
        .endpoint {{ background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #667eea; }}
        .endpoint .method {{ display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; margin-right: 10px; color: white; }}
        .method.post {{ background: #49cc90; }}
        .method.get {{ background: #61affe; }}
        .endpoint .path {{ font-family: monospace; font-size: 14px; color: #333; }}
        .endpoint .desc {{ margin-top: 8px; color: #666; font-size: 13px; }}
        code {{ background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 资源锁冲突解释 API</h1>
            <p>完整的分布式锁管理系统 - Python HTTP 服务器版本</p>
            <p style="margin-top: 10px; opacity: 0.9;">运行时间: {uptime} 秒 | 请求数: {REQUEST_COUNTER}</p>
        </div>

        <div class="stats">
            <div class="stat-card"><div class="number">{len(LOCK_STORE)}</div><div class="label">资源锁总数</div></div>
            <div class="stat-card"><div class="number">{len(WAIT_QUEUE)}</div><div class="label">等待队列</div></div>
            <div class="stat-card"><div class="number">{len(RELEASE_HISTORY)}</div><div class="label">释放历史</div></div>
            <div class="stat-card"><div class="number">{len(IDEMPOTENT_CACHE)}</div><div class="label">幂等缓存</div></div>
        </div>

        <div class="section">
            <h2>📡 API 接口</h2>

            <div class="endpoint">
                <span class="method post">POST</span>
                <span class="path">/api/locks/acquire</span>
                <div class="desc">获取资源锁 - 支持排队等待和幂等性</div>
            </div>

            <div class="endpoint">
                <span class="method post">POST</span>
                <span class="path">/api/locks/release</span>
                <div class="desc">释放资源锁 - 自动激活队列中下一个等待者</div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/locks/{{resourceId}}</span>
                <div class="desc">查询指定资源的锁状态</div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/locks/{{resourceId}}/queue</span>
                <div class="desc">查询资源的等待队列</div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/locks/{{resourceId}}/history</span>
                <div class="desc">查询资源的释放历史记录</div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/locks/{{resourceId}}/export</span>
                <div class="desc">导出单资源完整状态（锁+队列+历史）</div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/locks</span>
                <div class="desc">查询所有锁的状态</div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/locks/export</span>
                <div class="desc">导出所有锁汇总状态</div>
            </div>

        </div>

        <div class="section">
            <h2>🔧 快速测试</h2>
            <p><strong>1. 获取锁:</strong></p>
            <code>curl -X POST http://localhost:8080/api/locks/acquire -H 'Content-Type: application/json' -d '{{"resourceId":"order:1001","lockHolder":"user:alice","requestId":"req:001","operationSource":"API","timeoutSeconds":300,"waitInQueue":true}}'</code>
            
            <p style="margin-top:15px"><strong>2. 查询锁状态:</strong></p>
            <code>curl http://localhost:8080/api/locks/order:1001</code>
            
            <p style="margin-top:15px"><strong>3. 释放锁:</strong></p>
            <code>curl -X POST http://localhost:8080/api/locks/release -H 'Content-Type: application/json' -d '{{"resourceId":"order:1001","lockHolder":"user:alice","requestId":"req:release:001","operationSource":"API","releaseReason":"测试完成"}}'</code>
            
            <p style="margin-top:15px"><strong>4. 导出完整状态:</strong></p>
            <code>curl http://localhost:8080/api/locks/order:1001/export</code>
        </div>

        <div class="section">
            <h2>✨ 核心特性</h2>
            <ul style="list-style:none; line-height:2.2;">
                <li>✅ <strong>资源加锁</strong> - 基于资源ID的互斥访问控制</li>
                <li>✅ <strong>冲突解释</strong> - 锁被占用时返回详细冲突原因</li>
                <li>✅ <strong>等待排队</strong> - 自动维护FIFO等待队列</li>
                <li>✅ <strong>释放审计</strong> - 完整的释放历史记录追踪</li>
                <li>✅ <strong>幂等性保障</strong> - 重复请求不会产生脏数据</li>
                <li>✅ <strong>锁续期</strong> - 同一持有人可自动续期</li>
                <li>✅ <strong>状态导出</strong> - 完整状态JSON导出</li>
                <li>✅ <strong>零依赖</strong> - Python 3 标准库，直接运行</li>
            </ul>
        </div>

    </div>
</body>
</html>"""
        self._set_headers(content_type='text/html')
        self.wfile.write(html.encode('utf-8'))

    def lock_to_dict(self, lock):
        result = OrderedDict([
            ("resourceId", lock.get('resourceId')),
            ("lockHolder", lock.get('lockHolder')),
            ("requestId", lock.get('requestId')),
            ("status", lock.get('status')),
            ("operationSource", lock.get('operationSource')),
            ("lockTime", lock.get('lockTime')),
            ("expireTime", lock.get('expireTime')),
            ("releaseTime", lock.get('releaseTime')),
            ("timeoutSeconds", lock.get('timeoutSeconds')),
            ("success", True),
            ("message", lock.get('message', ''))
        ])
        return result

    def handle_acquire_lock(self, request_data):
        request_id = request_data.get('requestId')
        resource_id = request_data.get('resourceId')
        lock_holder = request_data.get('lockHolder')
        operation_source = request_data.get('operationSource', 'API')
        timeout_seconds = request_data.get('timeoutSeconds', 300)
        wait_in_queue = request_data.get('waitInQueue', True)

        # 幂等检查
        if request_id in IDEMPOTENT_CACHE:
            cached = IDEMPOTENT_CACHE[request_id]
            cached['message'] = '重复请求，返回已有结果'
            print(f"[幂等命中] {request_id} -> 重复请求，返回已有结果")
            self.send_success_response(cached['data'], "重复请求，返回已有结果")
            return

        existing_lock = LOCK_STORE.get(resource_id)

        # 锁不存在或已释放，创建新锁
        if existing_lock is None or existing_lock.get('status') in ['RELEASED', 'AVAILABLE']:
            now = datetime.now().isoformat()
            lock = OrderedDict([
                ("resourceId", resource_id),
                ("lockHolder", lock_holder),
                ("requestId", request_id),
                ("status", "LOCKED"),
                ("operationSource", operation_source),
                ("lockTime", now),
                ("expireTime", (datetime.now() + timedelta(seconds=timeout_seconds)).isoformat()),
                ("releaseTime", None),
                ("timeoutSeconds", timeout_seconds)
            ])
            LOCK_STORE[resource_id] = lock

            result = self.lock_to_dict(lock)
            result['message'] = '成功获取锁'
            IDEMPOTENT_CACHE[request_id] = {'data': result}
            print(f"[加锁成功] {resource_id} -> {lock_holder}")
            self.send_success_response(result, "成功获取锁")
            return

        # 锁已存在
        if existing_lock.get('status') == 'LOCKED':
            # 同一持有人，续期
            if existing_lock.get('lockHolder') == lock_holder:
                existing_lock['expireTime'] = (datetime.now() + timedelta(seconds=timeout_seconds)).isoformat()
                result = self.lock_to_dict(existing_lock)
                result['message'] = '锁续期成功'
                IDEMPOTENT_CACHE[request_id] = {'data': result}
                print(f"[锁续期] {resource_id} -> {lock_holder}")
                self.send_success_response(result, "锁续期成功")
                return

            # 加入等待队列
            if wait_in_queue:
                position = len([q for q in WAIT_QUEUE if q.get('resourceId') == resource_id]) + 1
                queue_item = OrderedDict([
                    ("resourceId", resource_id),
                    ("lockHolder", lock_holder),
                    ("requestId", request_id),
                    ("position", position),
                    ("status", "WAITING"),
                    ("queuedAt", datetime.now().isoformat())
                ])
                WAIT_QUEUE.append(queue_item)

                result = OrderedDict([
                    ("resourceId", resource_id),
                    ("lockHolder", lock_holder),
                    ("requestId", request_id),
                    ("status", "WAITING"),
                    ("waitQueuePosition", position),
                    ("success", True),
                    ("message", f"已加入等待队列，当前位置: {position}")
                ])
                IDEMPOTENT_CACHE[request_id] = {'data': result}
                print(f"[加入队列] {resource_id} -> {lock_holder} 位置:{position}")
                self.send_success_response(result, f"已加入等待队列，当前位置: {position}")
                return

            # 冲突，不加入队列
            result = OrderedDict([
                ("resourceId", resource_id),
                ("lockHolder", lock_holder),
                ("requestId", request_id),
                ("status", "AVAILABLE"),
                ("conflictReason", f"资源已被锁定，当前持有人: {existing_lock.get('lockHolder')}"),
                ("success", False),
                ("message", "获取锁失败: 资源已被锁定")
            ])
            IDEMPOTENT_CACHE[request_id] = {'data': result}
            print(f"[冲突] {resource_id} -> 被 {existing_lock.get('lockHolder')} 占用")
            self.send_success_response(result, "资源已被锁定")
            return

        self.send_error_response(500, "未知的锁状态")

    def handle_release_lock(self, request_data):
        request_id = request_data.get('requestId')
        resource_id = request_data.get('resourceId')
        lock_holder = request_data.get('lockHolder')
        operation_source = request_data.get('operationSource', 'API')
        release_reason = request_data.get('releaseReason', '')

        # 幂等检查
        if request_id in IDEMPOTENT_CACHE:
            cached = IDEMPOTENT_CACHE[request_id]
            print(f"[释放幂等命中] {request_id}")
            self.send_success_response(cached['data'], "重复请求，返回已有释放结果")
            return

        lock = LOCK_STORE.get(resource_id)

        if lock is None:
            result = OrderedDict([
                ("resourceId", resource_id),
                ("lockHolder", lock_holder),
                ("requestId", request_id),
                ("success", False),
                ("message", "锁不存在，无需重复释放")
            ])
            IDEMPOTENT_CACHE[request_id] = {'data': result}
            print(f"[释放无锁] {resource_id}")
            self.send_success_response(result, "锁不存在，无需重复释放")
            return

        if lock.get('lockHolder') != lock_holder:
            result = OrderedDict([
                ("resourceId", resource_id),
                ("lockHolder", lock_holder),
                ("requestId", request_id),
                ("success", False),
                ("message", "无权释放该锁，锁持有人不匹配")
            ])
            print(f"[释放被拒] {resource_id}")
            self.send_success_response(result, "无权释放该锁")
            return

        if lock.get('status') != 'LOCKED':
            result = self.lock_to_dict(lock)
            result['success'] = False
            result['message'] = "锁当前不处于锁定状态，无需重复释放"
            IDEMPOTENT_CACHE[request_id] = {'data': result}
            print(f"[释放已完成] {resource_id}")
            self.send_success_response(result, "锁当前不处于锁定状态")
            return

        # 执行释放
        lock['status'] = 'RELEASED'
        lock['releaseTime'] = datetime.now().isoformat()

        # 记录审计
        audit = OrderedDict([
            ("resourceId", resource_id),
            ("lockHolder", lock.get('lockHolder')),
            ("requestId", lock.get('requestId')),
            ("releaseSource", operation_source),
            ("releaseReason", release_reason),
            ("releasedAt", datetime.now().isoformat()),
            ("lockDurationSeconds", 0)
        ])
        RELEASE_HISTORY.insert(0, audit)

        # 激活等待队列中的下一个
        self.activate_next_in_queue(resource_id)

        result = self.lock_to_dict(lock)
        result['message'] = "锁已成功释放"
        IDEMPOTENT_CACHE[request_id] = {'data': result}
        print(f"[释放成功] {resource_id} -> {lock_holder} 原因:{release_reason}")
        self.send_success_response(result, "锁已成功释放")

    def activate_next_in_queue(self, resource_id):
        """激活等待队列中的下一个请求"""
        for i, item in enumerate(WAIT_QUEUE):
            if item.get('resourceId') == resource_id and item.get('status') == 'WAITING':
                item['status'] = 'LOCKED'
                
                # 更新锁状态
                lock = LOCK_STORE.get(resource_id)
                lock['lockHolder'] = item.get('lockHolder')
                lock['requestId'] = item.get('requestId')
                lock['status'] = 'LOCKED'
                lock['lockTime'] = datetime.now().isoformat()
                lock['expireTime'] = (datetime.now() + timedelta(seconds=300)).isoformat()

                # 更新队列位置
                for j, other in enumerate(WAIT_QUEUE):
                    if other.get('resourceId') == resource_id and other.get('status') == 'WAITING':
                        if j > i:
                            other['position'] -= 1

                print(f"[队列激活] {resource_id} -> {item.get('lockHolder')} 获取锁")
                break

    def handle_lock_operations(self, path):
        parts = path.replace('/api/locks/', '').split('/')
        resource_id = parts[0]

        if len(parts) == 1:
            self.handle_get_lock(resource_id)
        elif len(parts) == 2:
            if parts[1] == 'queue':
                self.handle_get_queue(resource_id)
            elif parts[1] == 'history':
                self.handle_get_history(resource_id)
            elif parts[1] == 'export':
                self.handle_export_lock(resource_id)
            else:
                self.send_error_response(404, "Not Found")
        else:
            self.send_error_response(404, "Not Found")

    def handle_get_lock(self, resource_id):
        lock = LOCK_STORE.get(resource_id)
        if lock is None:
            self.send_error_response(404, f"锁不存在: {resource_id}")
            return
        result = self.lock_to_dict(lock)
        self.send_success_response(result, "查询成功")

    def handle_get_queue(self, resource_id):
        queue_list = []
        for item in WAIT_QUEUE:
            if item.get('resourceId') == resource_id and item.get('status') == 'WAITING':
                queue_list.append(OrderedDict([
                    ("resourceId", item.get('resourceId')),
                    ("lockHolder", item.get('lockHolder')),
                    ("requestId", item.get('requestId')),
                    ("position", item.get('position')),
                    ("status", item.get('status'))
                ]))
        queue_list.sort(key=lambda x: x['position'])
        self.send_success_response(queue_list, "查询成功")

    def handle_get_history(self, resource_id):
        history_list = []
        for audit in RELEASE_HISTORY:
            if audit.get('resourceId') == resource_id:
                history_list.append(audit)
        self.send_success_response(history_list, "查询成功")

    def handle_export_lock(self, resource_id):
        export_data = OrderedDict()

        lock = LOCK_STORE.get(resource_id)
        if lock:
            export_data['lockStatus'] = self.lock_to_dict(lock)
        else:
            export_data['lockStatus'] = None

        queue_list = []
        for item in WAIT_QUEUE:
            if item.get('resourceId') == resource_id and item.get('status') == 'WAITING':
                queue_list.append(OrderedDict([
                    ("position", item.get('position')),
                    ("lockHolder", item.get('lockHolder')),
                    ("requestId", item.get('requestId'))
                ]))
        queue_list.sort(key=lambda x: x['position'])
        export_data['waitQueue'] = queue_list
        export_data['waitQueueCount'] = len(queue_list)

        history_list = []
        for audit in RELEASE_HISTORY:
            if audit.get('resourceId') == resource_id:
                history_list.append(OrderedDict([
                    ("lockHolder", audit.get('lockHolder')),
                    ("requestId", audit.get('requestId')),
                    ("releaseSource", audit.get('releaseSource')),
                    ("releaseReason", audit.get('releaseReason')),
                    ("lockDurationSeconds", audit.get('lockDurationSeconds'))
                ]))
        export_data['releaseHistory'] = history_list
        export_data['releaseHistoryCount'] = len(history_list)

        export_data['exportTime'] = datetime.now().isoformat()
        export_data['resourceId'] = resource_id

        print(f"[导出] {resource_id} -> 状态已导出")
        self.send_success_response(export_data, "导出成功")

    def handle_get_all_locks(self):
        locks_list = []
        for lock in LOCK_STORE.values():
            locks_list.append(self.lock_to_dict(lock))
        self.send_success_response(locks_list, "查询成功")

    def handle_export_all(self):
        export_data = OrderedDict()

        locks_list = []
        locked_count = 0
        released_count = 0
        for lock in LOCK_STORE.values():
            locks_list.append(self.lock_to_dict(lock))
            if lock.get('status') == 'LOCKED':
                locked_count += 1
            if lock.get('status') == 'RELEASED':
                released_count += 1

        export_data['locks'] = locks_list
        export_data['totalLocks'] = len(locks_list)
        export_data['lockedCount'] = locked_count
        export_data['releasedCount'] = released_count
        export_data['exportTime'] = datetime.now().isoformat()

        print(f"[导出全部] 共 {len(locks_list)} 个锁")
        self.send_success_response(export_data, "导出成功")

    def log_message(self, format, *args):
        """禁用默认的日志输出"""
        pass


def run_server(port=8080):
    server_address = ('', port)
    httpd = HTTPServer(server_address, LockServerHandler)
    print("=" * 60)
    print("  \U0001F512 资源锁冲突解释 API - Python HTTP 服务器版本")
    print("  \u2728 零依赖！Python 3 标准库，直接运行")
    print("=" * 60)
    print()
    print(f"  服务地址: http://localhost:{port}")
    print(f"  管理界面: http://localhost:{port}/")
    print()
    print("  API 接口:")
    print("    POST /api/locks/acquire    - 获取锁")
    print("    POST /api/locks/release    - 释放锁")
    print("    GET  /api/locks/{resourceId} - 查询锁状态")
    print("    GET  /api/locks/{resourceId}/queue - 查询等待队列")
    print("    GET  /api/locks/{resourceId}/history - 查询释放历史")
    print("    GET  /api/locks/{resourceId}/export - 导出完整状态")
    print("    GET  /api/locks/export      - 导出所有锁")
    print()
    print("  按 Ctrl+C 停止服务")
    print("=" * 60)
    print()
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        httpd.server_close()


if __name__ == '__main__':
    run_server()
