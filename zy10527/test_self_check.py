#!/usr/bin/env python3
import sys
import os
import json
import time
from typing import Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests
from fastapi.testclient import TestClient
from main import app
from models import Base
from database import engine, SessionLocal

client = TestClient(app)

class TestResult:
    def __init__(self, name: str, passed: bool, message: str = ""):
        self.name = name
        self.passed = passed
        self.message = message

    def __str__(self):
        status = "✅ PASS" if self.passed else "❌ FAIL"
        return f"{status}: {self.name} - {self.message}"

class SelfCheckTester:
    def __init__(self):
        self.results: List[TestResult] = []
        self.setup()
    
    def setup(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    
    def add_result(self, name: str, passed: bool, message: str = ""):
        result = TestResult(name, passed, message)
        self.results.append(result)
        print(result)
    
    def test_normal_flow(self):
        print("\n" + "="*50)
        print("📋 测试正常流程")
        print("="*50)
        
        try:
            response = client.post(
                "/announcements",
                json={
                    "announcement_no": "POLICY-2024-001",
                    "title": "2024年度考勤制度",
                    "content": "第一章 总则...",
                    "created_by": "admin"
                }
            )
            self.add_result(
                "创建公告",
                response.status_code == 200,
                f"状态码: {response.status_code}"
            )
            
            response = client.get("/announcements")
            self.add_result(
                "查询公告列表",
                response.status_code == 200 and len(response.json()) > 0,
                f"公告数量: {len(response.json())}"
            )
            
            response = client.get("/announcements/POLICY-2024-001")
            self.add_result(
                "查询单个公告详情",
                response.status_code == 200,
                f"公告标题: {response.json().get('title')}"
            )
            
            response = client.post(
                "/announcements/POLICY-2024-001/versions",
                params={
                    "content": "第一章 总则...\n第二章 考勤细则...",
                    "created_by": "admin"
                }
            )
            self.add_result(
                "创建新版本",
                response.status_code == 200,
                f"新版本号: {response.json().get('version')}"
            )
            
            response = client.post(
                "/confirmations",
                json={
                    "announcement_no": "POLICY-2024-001",
                    "version": 2,
                    "confirmer_id": "EMP001",
                    "confirmer_name": "张三",
                    "remark": "已阅读并理解"
                }
            )
            self.add_result(
                "员工确认公告",
                response.status_code == 200,
                f"确认人: {response.json().get('confirmer_name')}"
            )
            
            response = client.post(
                "/supplements",
                json={
                    "announcement_no": "POLICY-2024-001",
                    "version": 1,
                    "supplement": "补充说明：特殊情况需提前申请",
                    "supplement_by": "admin"
                }
            )
            self.add_result(
                "添加补充说明",
                response.status_code == 200,
                f"补充内容已记录"
            )
            
            response = client.get("/reports/confirmations")
            self.add_result(
                "查询确认报告",
                response.status_code == 200,
                f"报告记录数: {len(response.json())}"
            )
            
            response = client.get("/reports/confirmations/export")
            self.add_result(
                "导出CSV报告",
                response.status_code == 200,
                f"内容类型: {response.headers.get('media-type')}"
            )
            
            response = client.post(
                "/withdrawals",
                json={
                    "announcement_no": "POLICY-2024-001",
                    "version": 1,
                    "withdrawn_by": "admin",
                    "reason": "内容有误"
                }
            )
            self.add_result(
                "撤回指定版本",
                response.status_code == 200,
                "撤回成功"
            )
            
        except Exception as e:
            self.add_result("正常流程异常", False, str(e))
    
    def test_dirty_data(self):
        print("\n" + "="*50)
        print("🧪 测试脏数据/异常输入")
        print("="*50)
        
        try:
            response = client.post(
                "/announcements",
                json={
                    "announcement_no": "",
                    "title": "",
                    "content": "",
                    "created_by": ""
                }
            )
            self.add_result(
                "空字段验证",
                response.status_code in [400, 422],
                f"状态码: {response.status_code}"
            )
            
            response = client.get("/announcements/NONEXISTENT-001")
            self.add_result(
                "查询不存在的公告",
                response.status_code == 404,
                f"状态码: {response.status_code}"
            )
            
            response = client.post(
                "/confirmations",
                json={
                    "announcement_no": "POLICY-2024-001",
                    "version": 999,
                    "confirmer_id": "EMP002",
                    "confirmer_name": "李四"
                }
            )
            self.add_result(
                "确认不存在的版本",
                response.status_code == 404,
                f"状态码: {response.status_code}"
            )
            
            response = client.post(
                "/supplements",
                json={
                    "announcement_no": "NONEXISTENT-001",
                    "version": 1,
                    "supplement": "test",
                    "supplement_by": "admin"
                }
            )
            self.add_result(
                "给不存在的公告加补充",
                response.status_code == 404,
                f"状态码: {response.status_code}"
            )
            
            response = client.post(
                "/withdrawals",
                json={
                    "announcement_no": "POLICY-2024-001",
                    "version": 999,
                    "withdrawn_by": "admin",
                    "reason": "test"
                }
            )
            self.add_result(
                "撤回不存在的版本",
                response.status_code == 404,
                f"状态码: {response.status_code}"
            )
            
        except Exception as e:
            self.add_result("脏数据测试异常", False, str(e))
    
    def test_duplicate_requests(self):
        print("\n" + "="*50)
        print("🔄 测试重复请求")
        print("="*50)
        
        try:
            response1 = client.post(
                "/announcements",
                json={
                    "announcement_no": "DUPLICATE-001",
                    "title": "重复测试公告",
                    "content": "测试内容",
                    "created_by": "admin"
                }
            )
            self.add_result(
                "首次创建公告",
                response1.status_code == 200,
                "创建成功"
            )
            
            response2 = client.post(
                "/announcements",
                json={
                    "announcement_no": "DUPLICATE-001",
                    "title": "重复测试公告",
                    "content": "测试内容",
                    "created_by": "admin"
                }
            )
            self.add_result(
                "重复创建公告（应失败）",
                response2.status_code == 400,
                f"状态码: {response2.status_code}"
            )
            
            response = client.post(
                "/confirmations",
                json={
                    "announcement_no": "DUPLICATE-001",
                    "version": 1,
                    "confirmer_id": "EMP003",
                    "confirmer_name": "王五"
                }
            )
            self.add_result(
                "首次确认",
                response.status_code == 200,
                "确认成功"
            )
            
            response = client.post(
                "/confirmations",
                json={
                    "announcement_no": "DUPLICATE-001",
                    "version": 1,
                    "confirmer_id": "EMP003",
                    "confirmer_name": "王五"
                }
            )
            self.add_result(
                "重复确认（应失败）",
                response.status_code == 400,
                f"状态码: {response.status_code}"
            )
            
        except Exception as e:
            self.add_result("重复请求测试异常", False, str(e))
    
    def test_manual_correction(self):
        print("\n" + "="*50)
        print("✏️ 测试人工修正")
        print("="*50)
        
        try:
            client.post(
                "/announcements",
                json={
                    "announcement_no": "CORRECT-001",
                    "title": "待修正公告",
                    "content": "原始内容有错误",
                    "created_by": "admin"
                }
            )
            
            response = client.post(
                "/manual-correction",
                json={
                    "announcement_no": "CORRECT-001",
                    "version": 1,
                    "new_content": "修正后的正确内容",
                    "new_supplement": "修正说明：原内容表述不准确",
                    "correction_by": "admin",
                    "correction_reason": "用户反馈内容有误"
                }
            )
            self.add_result(
                "人工修正内容",
                response.status_code == 200,
                f"修改字段: {response.json().get('changes_applied')}"
            )
            
            response = client.get("/announcements/CORRECT-001")
            content = response.json()['versions'][0]['content']
            self.add_result(
                "验证修正生效",
                "修正后的正确内容" in content,
                f"当前内容: {content[:30]}..."
            )
            
            response = client.post(
                "/manual-correction",
                json={
                    "announcement_no": "CORRECT-001",
                    "version": 999,
                    "new_content": "测试",
                    "correction_by": "admin",
                    "correction_reason": "测试"
                }
            )
            self.add_result(
                "修正不存在的版本（应失败）",
                response.status_code == 404,
                f"状态码: {response.status_code}"
            )
            
        except Exception as e:
            self.add_result("人工修正测试异常", False, str(e))
    
    def test_audit_logs(self):
        print("\n" + "="*50)
        print("📝 测试审计日志")
        print("="*50)
        
        try:
            from models import AuditLog
            db = SessionLocal()
            
            logs = db.query(AuditLog).all()
            self.add_result(
                "审计日志数据库记录存在",
                len(logs) > 0,
                f"日志数量: {len(logs)}"
            )
            
            create_logs = db.query(AuditLog).filter(AuditLog.operation_type == "CREATE_ANNOUNCEMENT").all()
            self.add_result(
                "创建公告操作有日志",
                len(create_logs) > 0,
                f"创建日志数量: {len(create_logs)}"
            )
            
            confirm_logs = db.query(AuditLog).filter(AuditLog.operation_type == "CONFIRM_ANNOUNCEMENT").all()
            self.add_result(
                "确认操作有日志",
                len(confirm_logs) > 0,
                f"确认日志数量: {len(confirm_logs)}"
            )
            
            db.close()
            
        except Exception as e:
            self.add_result("审计日志测试异常", False, str(e))
    
    def print_summary(self):
        print("\n" + "="*60)
        print("📊 测试汇总报告")
        print("="*60)
        
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed
        
        print(f"\n总计: {total} 个测试用例")
        print(f"通过: {passed} ✅")
        print(f"失败: {failed} ❌")
        print(f"通过率: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print("\n失败的测试用例:")
            for r in self.results:
                if not r.passed:
                    print(f"  - {r.name}: {r.message}")
        
        print("\n" + "="*60)
        return failed == 0
    
    def run_all_tests(self):
        print("🚀 开始执行内部公告版本API自检程序")
        print(f"⏰ 开始时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        self.test_normal_flow()
        self.test_dirty_data()
        self.test_duplicate_requests()
        self.test_manual_correction()
        self.test_audit_logs()
        
        return self.print_summary()

def main():
    tester = SelfCheckTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
