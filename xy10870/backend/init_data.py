import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.models import Student, LanguageEnvironment, RunRequest, RequestStatus
from datetime import datetime, timedelta
import random

def init_data():
    db = SessionLocal()
    
    try:
        print("正在初始化数据...")
        
        languages = [
            {"name": "Python", "version": "3.11", "container_image": "python:3.11-slim", "timeout_seconds": 30},
            {"name": "JavaScript", "version": "18", "container_image": "node:18-alpine", "timeout_seconds": 30},
            {"name": "Java", "version": "17", "container_image": "openjdk:17-slim", "timeout_seconds": 60},
            {"name": "C++", "version": "11", "container_image": "gcc:11", "timeout_seconds": 60},
            {"name": "Go", "version": "1.21", "container_image": "golang:1.21-alpine", "timeout_seconds": 30},
        ]
        
        for lang in languages:
            existing = db.query(LanguageEnvironment).filter(LanguageEnvironment.name == lang["name"]).first()
            if not existing:
                db_lang = LanguageEnvironment(**lang)
                db.add(db_lang)
        
        db.commit()
        print("语言环境初始化完成")
        
        students = [
            {"student_id": "S001", "name": "张三", "email": "zhangsan@example.com", "quota_per_window": 10},
            {"student_id": "S002", "name": "李四", "email": "lisi@example.com", "quota_per_window": 10},
            {"student_id": "S003", "name": "王五", "email": "wangwu@example.com", "quota_per_window": 15},
            {"student_id": "S004", "name": "赵六", "email": "zhaoliu@example.com", "quota_per_window": 10},
            {"student_id": "S005", "name": "钱七", "email": "qianqi@example.com", "quota_per_window": 20},
        ]
        
        for stu in students:
            existing = db.query(Student).filter(Student.student_id == stu["student_id"]).first()
            if not existing:
                db_stu = Student(**stu)
                db.add(db_stu)
        
        db.commit()
        print("学生数据初始化完成")
        
        all_languages = db.query(LanguageEnvironment).all()
        all_students = db.query(Student).all()
        
        if not all_languages or not all_students:
            print("警告：没有足够的数据来生成请求")
            return
        
        print("生成模拟请求数据...")
        
        code_snippets = {
            "Python": [
                "print('Hello, World!')",
                "def add(a, b): return a + b\nprint(add(1, 2))",
                "for i in range(5): print(i)",
            ],
            "JavaScript": [
                "console.log('Hello, World!');",
                "const add = (a, b) => a + b;\nconsole.log(add(1, 2));",
            ],
            "Java": [
                "public class Main { public static void main(String[] args) { System.out.println('Hello'); }}",
            ],
            "C++": [
                "#include <iostream>\nint main() { std::cout << 'Hello' << std::endl; return 0; }",
            ],
            "Go": [
                "package main\nimport 'fmt'\nfunc main() { fmt.Println('Hello') }",
            ],
        }
        
        statuses = [RequestStatus.SUCCESS, RequestStatus.FAILED, RequestStatus.TIMEOUT]
        weights = [0.75, 0.2, 0.05]
        
        for i in range(50):
            student = random.choice(all_students)
            lang = random.choice(all_languages)
            
            request = RunRequest(
                request_id = f"req-{datetime.utcnow().strftime('%Y%m%d')}-{i+1:04d}",
                student_id = student.id,
                language_id = lang.id,
                code_snippet = random.choice(code_snippets.get(lang.name, ["print('Hello')"])),
                status = random.choices(statuses, weights=weights)[0],
                created_at = datetime.utcnow() - timedelta(hours=random.randint(0, 72), minutes=random.randint(0, 60)),
            )
            
            if request.status in [RequestStatus.SUCCESS, RequestStatus.FAILED, RequestStatus.TIMEOUT]:
                exec_time = random.randint(50, 5000)
                request.execution_time_ms = exec_time
                request.started_at = request.created_at + timedelta(seconds=random.randint(1, 10))
                request.completed_at = request.started_at + timedelta(milliseconds=exec_time)
                
                if request.status == RequestStatus.SUCCESS:
                    request.exit_code = 0
                    request.stdout = "Hello, World!\nProgram executed successfully."
                elif request.status == RequestStatus.FAILED:
                    request.exit_code = 1
                    request.stderr = "Error: SyntaxError at line 5"
                    request.error_message = "程序执行出错"
            
            db.add(request)
        
        db.commit()
        print("模拟请求数据生成完成！")
        
    except Exception as e:
        print(f"初始化失败: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_data()
