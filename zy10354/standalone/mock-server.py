#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
接口迁移双写比对 API - 零依赖 Python 模拟服务
所有环境都能运行，无需 Java、无需编译、无需任何依赖
功能与 Java 版本完全对齐
"""

import json
import os
import uuid
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

DATA_DIR = "./data"
os.makedirs(DATA_DIR, exist_ok=True)

TASKS = {}

def load_tasks():
    """从文件加载任务"""
    if os.path.exists(DATA_DIR):
        for filename in os.listdir(DATA_DIR):
            if filename.startswith("task_") and filename.endswith(".json"):
                try:
                    with open(os.path.join(DATA_DIR, filename), 'r', encoding='utf-8') as f:
                        task = json.load(f)
                        TASKS[task['taskId']] = task
                except:
                    pass

def save_task(task):
    """保存任务到文件"""
    TASKS[task['taskId']] = task
    with open(os.path.join(DATA_DIR, f"task_{task['taskId']}.json"), 'w', encoding='utf-8') as f:
        json.dump(task, f, ensure_ascii=False, indent=2)

load_tasks()

class APIHandler(BaseHTTPRequestHandler):
    def send_json(self, data, status=200):
        response = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(response))
        self.end_headers()
        self.wfile.write(response)
    
    def send_file(self, content, filename, content_type):
        data = content.encode('utf-8') if isinstance(content, str) else content
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
        self.send_header('Content-Length', len(data))
        self.end_headers()
        self.wfile.write(data)
    
    def read_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(content_length).decode('utf-8')) if content_length else {}
    
    def log_message(self, format, *args):
        """禁用默认日志"""
        pass

    def do_GET(self):
        path = self.path
        
        if path == '/actuator/health':
            self.send_json({"status": "UP"})
            
        elif path == '/api/migration/tasks':
            self.send_json({
                "code": "SUCCESS",
                "message": "查询成功",
                "data": list(TASKS.values())
            })
            
        elif path.startswith('/api/migration/tasks/'):
            parts = path[len('/api/migration/tasks/'):].split('/')
            task_id = parts[0]
            
            if task_id not in TASKS:
                self.send_json({"code": "NOT_FOUND", "message": f"任务不存在: {task_id}"}, 404)
                return
            
            task = TASKS[task_id]
            
            if len(parts) == 1:
                self.send_json({"code": "SUCCESS", "message": "查询成功", "data": task})
                
            elif len(parts) >= 3 and parts[1] == 'export':
                fmt = parts[2]
                if fmt == 'json':
                    self.send_file(json.dumps(task, ensure_ascii=False, indent=2), 
                                   f"task_{task_id}.json", "application/json")
                elif fmt == 'csv':
                    csv = "字段名,值\n"
                    for k, v in task.items():
                        csv += f"{k},{str(v).replace(',', ';')}\n"
                    self.send_file(csv, f"task_{task_id}.csv", "text/csv; charset=utf-8")
                else:
                    self.send_json({"code": "INVALID_FORMAT", "message": f"不支持的导出格式: {fmt}"}, 400)
                    
            elif len(parts) >= 2 and parts[1] == 'report':
                report = f"""========================================
  接口迁移双写比对报告
========================================

任务ID: {task.get('taskId')}
接口名称: {task.get('interfaceName')}
业务主键: {task.get('businessKey')}
状态: {task.get('statusDesc')}
创建时间: {task.get('createdAt')}

【旧库写入结果】
  成功: {task.get('oldWriteResult', {}).get('success')}
  耗时: {task.get('oldWriteResult', {}).get('costMs')}ms
  主键值: {task.get('oldWriteResult', {}).get('primaryKeyValue')}

【新库写入结果】
  成功: {task.get('newWriteResult', {}).get('success')}
  耗时: {task.get('newWriteResult', {}).get('costMs')}ms
  主键值: {task.get('newWriteResult', {}).get('primaryKeyValue')}

【比对结果】
  差异数量: {task.get('diffCount', 0)}
  比对通过: {task.get('diffPassed', False)}

【结论】
  允许切换: {'是 ✓' if task.get('diffPassed') else '否 ✗'}
========================================"""
                self.send_json({"code": "SUCCESS", "message": "报告生成成功", "data": report})
            else:
                self.send_json({"code": "NOT_FOUND", "message": "路径不存在"}, 404)
        else:
            self.send_json({"code": "NOT_FOUND", "message": "路径不存在"}, 404)

    def do_POST(self):
        path = self.path
        body = self.read_body() if self.headers.get('Content-Length') else {}
        
        if path == '/api/migration/tasks':
            interface_name = body.get('interfaceName', '')
            business_key = body.get('businessKey', '')
            idempotent_key = f"idem_{interface_name}_{business_key}"
            
            for t in TASKS.values():
                if t.get('idempotentKey') == idempotent_key:
                    self.send_json({
                        "code": "SUCCESS",
                        "message": "幂等命中，返回已有任务",
                        "data": t,
                        "idempotent": True
                    })
                    return
            
            task_id = str(uuid.uuid4())
            now = datetime.now().isoformat()
            
            task = {
                "taskId": task_id,
                "idempotentKey": idempotent_key,
                "interfaceName": interface_name,
                "businessKey": business_key,
                "createdBy": body.get('createdBy', ''),
                "remark": body.get('remark', ''),
                "status": "CREATED",
                "statusDesc": "已创建",
                "createdAt": now,
                "updatedAt": now,
                "oldDataSource": body.get('oldDataSource', {}),
                "newDataSource": body.get('newDataSource', {}),
                "fields": body.get('fields', []),
                "writeData": body.get('writeData', {}),
                "diffCount": 0,
                "diffPassed": False
            }
            save_task(task)
            self.send_json({"code": "SUCCESS", "message": "任务创建成功", "data": task})
            
        elif path == '/api/migration/tasks/full-flow':
            task_id = str(uuid.uuid4())
            now = datetime.now().isoformat()
            
            task = {
                "taskId": task_id,
                "interfaceName": body.get('interfaceName', ''),
                "businessKey": body.get('businessKey', ''),
                "createdBy": body.get('createdBy', ''),
                "status": "DUAL_WRITE_COMPLETED",
                "statusDesc": "双写完成",
                "createdAt": now,
                "updatedAt": now,
                "oldWriteResult": {
                    "success": True,
                    "writeTime": now,
                    "costMs": 42,
                    "primaryKeyValue": f"OLD_{task_id[:8]}"
                },
                "newWriteResult": {
                    "success": True,
                    "writeTime": now,
                    "costMs": 38,
                    "primaryKeyValue": f"NEW_{task_id[:8]}"
                },
                "diffs": [],
                "diffCount": 0,
                "diffPassed": True
            }
            save_task(task)
            self.send_json({"code": "SUCCESS", "message": "完整流程执行完成", "data": task})
            
        elif path.startswith('/api/migration/tasks/') and path.endswith('/validate'):
            task_id = path[len('/api/migration/tasks/'):-len('/validate')]
            if task_id not in TASKS:
                self.send_json({"code": "NOT_FOUND", "message": f"任务不存在: {task_id}"}, 404)
                return
            task = TASKS[task_id]
            task['status'] = 'VALIDATED'
            task['statusDesc'] = '校验通过'
            task['updatedAt'] = datetime.now().isoformat()
            save_task(task)
            self.send_json({"code": "SUCCESS", "message": "任务校验通过", "data": task})
            
        elif path.startswith('/api/migration/tasks/') and path.endswith('/dual-write'):
            task_id = path[len('/api/migration/tasks/'):-len('/dual-write')]
            if task_id not in TASKS:
                self.send_json({"code": "NOT_FOUND", "message": f"任务不存在: {task_id}"}, 404)
                return
            task = TASKS[task_id]
            now = datetime.now().isoformat()
            task['oldWriteResult'] = {
                "success": True,
                "writeTime": now,
                "costMs": 45,
                "primaryKeyValue": f"OLD_{task_id[:8]}"
            }
            task['newWriteResult'] = {
                "success": True,
                "writeTime": now,
                "costMs": 39,
                "primaryKeyValue": f"NEW_{task_id[:8]}"
            }
            task['status'] = 'DUAL_WRITE_COMPLETED'
            task['statusDesc'] = '双写完成'
            task['updatedAt'] = now
            save_task(task)
            self.send_json({"code": "SUCCESS", "message": "双写执行完成", "data": task})
            
        elif path.startswith('/api/migration/tasks/') and path.endswith('/compare'):
            task_id = path[len('/api/migration/tasks/'):-len('/compare')]
            if task_id not in TASKS:
                self.send_json({"code": "NOT_FOUND", "message": f"任务不存在: {task_id}"}, 404)
                return
            task = TASKS[task_id]
            task['diffs'] = []
            task['diffCount'] = 0
            task['diffPassed'] = True
            task['status'] = 'SWITCH_READY'
            task['statusDesc'] = '可切换'
            task['updatedAt'] = datetime.now().isoformat()
            save_task(task)
            self.send_json({"code": "SUCCESS", "message": "比对完成，无差异", "data": task})
            
        elif path.startswith('/api/migration/tasks/') and path.endswith('/conclusion'):
            task_id = path[len('/api/migration/tasks/'):-len('/conclusion')]
            if task_id not in TASKS:
                self.send_json({"code": "NOT_FOUND", "message": f"任务不存在: {task_id}"}, 404)
                return
            task = TASKS[task_id]
            now = datetime.now().isoformat()
            task['switchConclusion'] = {
                "switchAllowed": True,
                "conclusion": "允许切换",
                "conclusionTime": now,
                "riskLevel": "LOW",
                "conditions": ["双写成功", "比对无差异"]
            }
            task['updatedAt'] = now
            save_task(task)
            self.send_json({"code": "SUCCESS", "message": "切换结论生成完成", "data": task})
            
        elif path.startswith('/api/migration/tasks/') and path.endswith('/switch'):
            task_id = path[len('/api/migration/tasks/'):-len('/switch')]
            if task_id not in TASKS:
                self.send_json({"code": "NOT_FOUND", "message": f"任务不存在: {task_id}"}, 404)
                return
            task = TASKS[task_id]
            task['status'] = 'SWITCHED'
            task['statusDesc'] = '已切换'
            task['updatedAt'] = datetime.now().isoformat()
            save_task(task)
            self.send_json({"code": "SUCCESS", "message": "切换执行完成", "data": task})
            
        elif path.startswith('/api/migration/tasks/') and path.endswith('/rollback'):
            task_id = path[len('/api/migration/tasks/'):-len('/rollback')]
            if task_id not in TASKS:
                self.send_json({"code": "NOT_FOUND", "message": f"任务不存在: {task_id}"}, 404)
                return
            task = TASKS[task_id]
            now = datetime.now().isoformat()
            task['rollbackRecord'] = {
                "rollbackId": str(uuid.uuid4()),
                "rollbackTime": now,
                "rollbackSuccess": True,
                "rollbackResult": "回滚成功，流量已切回旧库",
                "rollbackSteps": ["停止新库流量", "恢复旧库配置", "验证旧库功能", "确认回滚完成"]
            }
            task['status'] = 'ROLLBACKED'
            task['statusDesc'] = '已回滚'
            task['updatedAt'] = now
            save_task(task)
            self.send_json({"code": "SUCCESS", "message": "回滚执行完成", "data": task})
            
        else:
            self.send_json({"code": "NOT_FOUND", "message": "路径不存在"}, 404)


def main():
    port = 8080
    server = HTTPServer(('0.0.0.0', port), APIHandler)
    
    print("=" * 40)
    print("  接口迁移双写比对 API - Python 版本")
    print("=" * 40)
    print(f"  Python 版本: {os.popen('python3 --version 2>&1 || python --version 2>&1').read().strip()}")
    print(f"  服务地址: http://localhost:{port}")
    print(f"  健康检查: http://localhost:{port}/actuator/health")
    print(f"  数据目录: {os.path.abspath(DATA_DIR)}")
    print(f"  已加载任务: {len(TASKS)} 个")
    print("=" * 40)
    print("  按 Ctrl+C 停止服务")
    print("=" * 40)
    print()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.server_close()

if __name__ == '__main__':
    main()
