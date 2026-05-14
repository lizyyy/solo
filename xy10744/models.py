from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class ExecutionLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    language = db.Column(db.String(50), nullable=False)
    language_version = db.Column(db.String(20), nullable=False)
    code_snippet = db.Column(db.Text, nullable=False)
    input_params = db.Column(db.Text)
    result = db.Column(db.Text)
    processed_result = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')
    error_message = db.Column(db.Text)
    execution_time = db.Column(db.Integer)
    timeout_seconds = db.Column(db.Integer, default=30)
    was_timeout = db.Column(db.Boolean, default=False)
    was_intercepted = db.Column(db.Boolean, default=False)
    intercept_reason = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    rollback_from = db.Column(db.Integer)
    rollback_to = db.Column(db.String(20))

def init_db():
    db.create_all()
    
    if ExecutionLog.query.count() == 0:
        seed_data = [
            {
                'language': 'Python',
                'language_version': '3.9',
                'code_snippet': '''def calculate_factorial(n):
    if n == 0:
        return 1
    return n * calculate_factorial(n-1)

result = calculate_factorial(5)
print(result)''',
                'input_params': json.dumps({'n': 5}),
                'result': json.dumps({'output': '120', 'return_value': 120}),
                'processed_result': json.dumps({'output': '120', 'return_value': 120, 'verified': True}),
                'status': 'success',
                'execution_time': 156,
                'timeout_seconds': 30,
                'was_timeout': False,
                'was_intercepted': False
            },
            {
                'language': 'Python',
                'language_version': '3.10',
                'code_snippet': '''while True:
    pass''',
                'input_params': json.dumps({}),
                'result': None,
                'processed_result': None,
                'status': 'failed',
                'error_message': 'Execution timed out after 30 seconds',
                'execution_time': 30000,
                'timeout_seconds': 30,
                'was_timeout': True,
                'was_intercepted': True,
                'intercept_reason': '无限循环检测 - 执行超过超时阈值'
            },
            {
                'language': 'JavaScript',
                'language_version': 'ES6',
                'code_snippet': '''const fs = require('fs');
fs.writeFileSync('/etc/passwd', 'hacked');''',
                'input_params': json.dumps({}),
                'result': None,
                'processed_result': None,
                'status': 'failed',
                'error_message': 'Code execution blocked',
                'execution_time': 5,
                'timeout_seconds': 30,
                'was_timeout': False,
                'was_intercepted': True,
                'intercept_reason': '安全拦截 - 检测到危险的文件系统操作'
            },
            {
                'language': 'Python',
                'language_version': '3.9',
                'code_snippet': '''import os
os.system("rm -rf /")''',
                'input_params': json.dumps({}),
                'result': None,
                'processed_result': None,
                'status': 'failed',
                'error_message': 'Security violation detected',
                'execution_time': 3,
                'timeout_seconds': 30,
                'was_timeout': False,
                'was_intercepted': True,
                'intercept_reason': '安全拦截 - 检测到危险的系统命令执行'
            },
            {
                'language': 'JavaScript',
                'language_version': 'ES6',
                'code_snippet': '''function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}
console.log(fibonacci(10));''',
                'input_params': json.dumps({'n': 10}),
                'result': json.dumps({'output': '55', 'return_value': 55}),
                'processed_result': json.dumps({'output': '55', 'return_value': 55, 'verified': True}),
                'status': 'success',
                'execution_time': 89,
                'timeout_seconds': 30,
                'was_timeout': False,
                'was_intercepted': False
            },
            {
                'language': 'Python',
                'language_version': '3.11',
                'code_snippet': '''import time
def slow_function():
    time.sleep(45)
    return "done"
slow_function()''',
                'input_params': json.dumps({}),
                'result': None,
                'processed_result': json.dumps({'status': 'timeout_handled', 'action': '人工介入终止'}),
                'status': 'timeout',
                'error_message': '人工超时处理 - 执行45秒后被管理员终止',
                'execution_time': 45000,
                'timeout_seconds': 30,
                'was_timeout': True,
                'was_intercepted': True,
                'intercept_reason': '人工超时处理 - 执行超过超时阈值15秒'
            },
            {
                'language': 'Java',
                'language_version': '11',
                'code_snippet': '''public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}''',
                'input_params': json.dumps({}),
                'result': json.dumps({'output': 'Hello World', 'exit_code': 0}),
                'processed_result': json.dumps({'output': 'Hello World', 'exit_code': 0, 'verified': True}),
                'status': 'success',
                'execution_time': 1245,
                'timeout_seconds': 60,
                'was_timeout': False,
                'was_intercepted': False
            },
            {
                'language': 'Python',
                'language_version': '3.9',
                'code_snippet': '''def divide(a, b):
    return a / b
divide(10, 0)''',
                'input_params': json.dumps({'a': 10, 'b': 0}),
                'result': None,
                'processed_result': None,
                'status': 'failed',
                'error_message': 'ZeroDivisionError: division by zero',
                'execution_time': 12,
                'timeout_seconds': 30,
                'was_timeout': False,
                'was_intercepted': False
            },
            {
                'language': 'JavaScript',
                'language_version': 'ES6',
                'code_snippet': '''setTimeout(() => {
    while(true) {}
}, 1000);''',
                'input_params': json.dumps({}),
                'result': None,
                'processed_result': json.dumps({'status': 'timeout_handled', 'action': '人工监控发现并终止'}),
                'status': 'timeout',
                'error_message': '人工超时处理 - 延迟后进入无限循环',
                'execution_time': 35000,
                'timeout_seconds': 30,
                'was_timeout': True,
                'was_intercepted': True,
                'intercept_reason': '人工超时处理 - 监控系统发现异常CPU占用'
            },
            {
                'language': 'Python',
                'language_version': '3.10',
                'code_snippet': '''x = 1
y = 2
print(x + y)''',
                'input_params': json.dumps({}),
                'result': json.dumps({'output': '3', 'return_value': None}),
                'processed_result': json.dumps({'output': '3', 'return_value': None, 'verified': True}),
                'status': 'success',
                'execution_time': 45,
                'timeout_seconds': 30,
                'was_timeout': False,
                'was_intercepted': False,
                'rollback_from': 1
            }
        ]
        
        for data in seed_data:
            log = ExecutionLog(**data)
            db.session.add(log)
        
        db.session.commit()
        print("Database seeded with sample data including dirty data and timeout examples")