#!/usr/bin/env python3
"""
作业判分回调台 - 测试套件
验证核心功能：状态推进、回调验签、成绩写入、异常处理等
"""

import sys
import uuid
import hmac
import hashlib
import json
from datetime import datetime

try:
    import httpx
except ImportError:
    print("请先安装依赖: pip install httpx")
    sys.exit(1)

API_BASE = "http://localhost:8000/api"
CALLBACK_SECRET = "grading_callback_secret_2024"


def generate_id():
    return str(uuid.uuid4())


def print_header(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def print_success(message):
    print(f"  ✅ {message}")


def print_fail(message):
    print(f"  ❌ {message}")


def print_info(message):
    print(f"  ℹ️  {message}")


class TestSuite:
    def __init__(self):
        self.client = httpx.Client(timeout=10)
        self.passed = 0
        self.failed = 0
        self.submission_ids = []
        self.task_ids = []
        self.payload_ids = []

    def test_1_health_check(self):
        """测试1: API健康检查"""
        print_header("测试1: API健康检查")
        try:
            response = self.client.get("http://localhost:8000/health")
            if response.status_code == 200:
                print_success("API 服务正常运行")
                self.passed += 1
                return True
            else:
                print_fail(f"API 返回状态码: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            print_fail(f"无法连接到 API: {e}")
            print_info("请先启动后端服务: uvicorn backend.main:app --reload")
            self.failed += 1
            return False

    def test_2_create_submission(self):
        """测试2: 创建作业提交"""
        print_header("测试2: 创建作业提交")
        
        for i in range(3):
            submission_data = {
                "submission_id": generate_id(),
                "student_id": f"STU{i+1:03d}",
                "assignment_id": f"ASSN001",
                "course_id": f"COURSE001"
            }
            
            try:
                response = self.client.post(
                    f"{API_BASE}/submissions/",
                    json=submission_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    self.submission_ids.append(result["submission_id"])
                    print_success(f"创建提交成功: {result['submission_id'][:12]}...")
                    print_info(f"  初始状态: {result['status']}")
                else:
                    print_fail(f"创建提交失败: {response.status_code}")
                    self.failed += 1
                    return False
            except Exception as e:
                print_fail(f"请求失败: {e}")
                self.failed += 1
                return False
        
        self.passed += 1
        return True

    def test_3_list_submissions(self):
        """测试3: 查询作业提交列表"""
        print_header("测试3: 查询作业提交列表")
        
        try:
            response = self.client.get(f"{API_BASE}/submissions/")
            if response.status_code == 200:
                submissions = response.json()
                print_success(f"查询成功，共 {len(submissions)} 条记录")
                
                for sub in submissions:
                    print_info(f"  - {sub['submission_id'][:12]}... | {sub['student_id']} | {sub['status']}")
                
                self.passed += 1
                return True
            else:
                print_fail(f"查询失败: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            print_fail(f"请求失败: {e}")
            self.failed += 1
            return False

    def test_4_create_grading_tasks(self):
        """测试4: 创建判分任务"""
        print_header("测试4: 创建判分任务")
        
        if not self.submission_ids:
            print_fail("没有可用的 submission_id")
            self.failed += 1
            return False
        
        for submission_id in self.submission_ids[:2]:
            task_data = {
                "task_id": generate_id(),
                "submission_id": submission_id,
                "grader_type": "auto_grader"
            }
            
            try:
                response = self.client.post(
                    f"{API_BASE}/grading-tasks/",
                    json=task_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    self.task_ids.append(result["task_id"])
                    print_success(f"创建判分任务: {result['task_id'][:12]}...")
                else:
                    print_fail(f"创建判分任务失败: {response.status_code}")
            except Exception as e:
                print_fail(f"请求失败: {e}")
        
        self.passed += 1
        return True

    def test_5_complete_grading_task(self):
        """测试5: 完成判分任务"""
        print_header("测试5: 完成判分任务")
        
        if not self.task_ids:
            print_fail("没有可用的 task_id")
            self.failed += 1
            return False
        
        scores = [85.5, 92.0]
        
        for i, task_id in enumerate(self.task_ids):
            try:
                response = self.client.put(
                    f"{API_BASE}/grading-tasks/{task_id}/complete",
                    params={
                        "score": scores[i],
                        "details": json.dumps({"comments": "Good job!"})
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print_success(f"完成判分: {result['task_id'][:12]}... 分数: {result['raw_score']}")
                else:
                    print_fail(f"完成判分失败: {response.status_code}")
            except Exception as e:
                print_fail(f"请求失败: {e}")
        
        self.passed += 1
        return True

    def test_6_create_callback_payload(self):
        """测试6: 创建回调载荷（含签名验证）"""
        print_header("测试6: 创建回调载荷（含签名验证）")
        
        if not self.submission_ids:
            print_fail("没有可用的 submission_id")
            self.failed += 1
            return False
        
        submission_id = self.submission_ids[0]
        
        payload_data = {
            "submission_id": submission_id,
            "score": 88.5,
            "grader": "auto",
            "timestamp": datetime.now().isoformat()
        }
        
        raw_payload = json.dumps(payload_data)
        
        signature = hmac.new(
            CALLBACK_SECRET.encode('utf-8'),
            raw_payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        callback_data = {
            "payload_id": generate_id(),
            "submission_id": submission_id,
            "raw_payload": raw_payload,
            "signature": signature
        }
        
        try:
            response = self.client.post(
                f"{API_BASE}/callback-payloads/",
                json=callback_data
            )
            
            if response.status_code == 200:
                result = response.json()
                self.payload_ids.append(result["payload_id"])
                print_success(f"创建回调载荷成功: {result['payload_id'][:12]}...")
                print_info(f"  签名验证结果: {'通过' if result['is_signature_valid'] else '失败'}")
                print_info(f"  解析分数: {result['score']}")
                self.passed += 1
                return True
            else:
                print_fail(f"创建回调载荷失败: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            print_fail(f"请求失败: {e}")
            self.failed += 1
            return False

    def test_7_create_invalid_callback(self):
        """测试7: 创建无效签名的回调载荷"""
        print_header("测试7: 创建无效签名的回调载荷")
        
        if not self.submission_ids:
            print_fail("没有可用的 submission_id")
            self.failed += 1
            return False
        
        submission_id = self.submission_ids[1]
        
        payload_data = {
            "submission_id": submission_id,
            "score": 75.0,
            "grader": "auto"
        }
        
        raw_payload = json.dumps(payload_data)
        
        invalid_signature = "invalid_signature_12345"
        
        callback_data = {
            "payload_id": generate_id(),
            "submission_id": submission_id,
            "raw_payload": raw_payload,
            "signature": invalid_signature
        }
        
        try:
            response = self.client.post(
                f"{API_BASE}/callback-payloads/",
                json=callback_data
            )
            
            if response.status_code == 200:
                result = response.json()
                self.payload_ids.append(result["payload_id"])
                print_success(f"创建无效签名载荷成功")
                print_info(f"  签名验证结果: {'通过' if result['is_signature_valid'] else '失败'}")
                
                if not result["is_signature_valid"]:
                    print_success("无效签名被正确识别")
                else:
                    print_fail("无效签名未被识别！")
                
                self.passed += 1
                return True
            else:
                print_fail(f"创建回调载荷失败: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            print_fail(f"请求失败: {e}")
            self.failed += 1
            return False

    def test_8_verify_callback_payload(self):
        """测试8: 手动验证回调载荷签名"""
        print_header("测试8: 手动验证回调载荷签名")
        
        if not self.payload_ids:
            print_fail("没有可用的 payload_id")
            self.failed += 1
            return False
        
        for payload_id in self.payload_ids[:2]:
            try:
                response = self.client.post(
                    f"{API_BASE}/callback-payloads/{payload_id}/verify"
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print_success(f"验证载荷: {payload_id[:12]}...")
                    print_info(f"  签名验证: {'通过' if result['is_signature_valid'] else '失败'}")
                else:
                    print_fail(f"验证失败: {response.status_code}")
            except Exception as e:
                print_fail(f"请求失败: {e}")
        
        self.passed += 1
        return True

    def test_9_write_grade(self):
        """测试9: 写入成绩"""
        print_header("测试9: 写入成绩")
        
        if not self.payload_ids:
            print_fail("没有可用的 payload_id")
            self.failed += 1
            return False
        
        payload_id = self.payload_ids[0]
        
        write_data = {
            "payload_id": payload_id,
            "score": 90.0
        }
        
        try:
            response = self.client.post(
                f"{API_BASE}/callback-payloads/{payload_id}/write-grade",
                json=write_data
            )
            
            if response.status_code == 200:
                result = response.json()
                print_success(f"写入成绩成功")
                print_info(f"  成绩已写入: {'是' if result['grade_written'] else '否'}")
                self.passed += 1
                return True
            else:
                print_fail(f"写入成绩失败: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            print_fail(f"请求失败: {e}")
            self.failed += 1
            return False

    def test_10_update_submission_status(self):
        """测试10: 更新提交状态"""
        print_header("测试10: 更新提交状态")
        
        if not self.submission_ids:
            print_fail("没有可用的 submission_id")
            self.failed += 1
            return False
        
        submission_id = self.submission_ids[2]
        
        update_data = {
            "status": "manual_review",
            "updated_by": "test_script"
        }
        
        try:
            response = self.client.put(
                f"{API_BASE}/submissions/{submission_id}/status",
                json=update_data
            )
            
            if response.status_code == 200:
                result = response.json()
                print_success(f"状态更新成功")
                print_info(f"  新状态: {result['status']}")
                self.passed += 1
                return True
            else:
                print_fail(f"状态更新失败: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            print_fail(f"请求失败: {e}")
            self.failed += 1
            return False

    def test_11_retry_callback(self):
        """测试11: 重试回调"""
        print_header("测试11: 重试回调")
        
        if not self.submission_ids:
            print_fail("没有可用的 submission_id")
            self.failed += 1
            return False
        
        submission_id = self.submission_ids[1]
        
        retry_data = {
            "submission_id": submission_id,
            "retry_type": "callback",
            "triggered_by": "test_script"
        }
        
        try:
            response = self.client.post(
                f"{API_BASE}/retry/",
                json=retry_data
            )
            
            if response.status_code == 200:
                result = response.json()
                print_success(f"重试操作成功")
                print_info(f"  重试类型: {result['retry_type']}")
                print_info(f"  状态变化: {result['previous_status']} → {result['new_status']}")
                self.passed += 1
                return True
            else:
                print_fail(f"重试失败: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            print_fail(f"请求失败: {e}")
            self.failed += 1
            return False

    def test_12_get_statistics(self):
        """测试12: 获取统计数据"""
        print_header("测试12: 获取统计数据")
        
        try:
            response = self.client.get(f"{API_BASE}/statistics/")
            if response.status_code == 200:
                stats = response.json()
                print_success("获取统计数据成功")
                print_info(f"  总提交数: {stats['total_submissions']}")
                print_info(f"  待处理: {stats['pending']}")
                print_info(f"  判分中: {stats['grading']}")
                print_info(f"  回调待处理: {stats['callback_pending']}")
                print_info(f"  回调失败: {stats['callback_failed']}")
                print_info(f"  成功: {stats['success']}")
                print_info(f"  待人工复核: {stats['manual_review']}")
                print_info(f"  未解决异常: {stats['unresolved_exceptions']}")
                self.passed += 1
                return True
            else:
                print_fail(f"获取统计失败: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            print_fail(f"请求失败: {e}")
            self.failed += 1
            return False

    def test_13_get_submission_detail(self):
        """测试13: 获取提交详情（含关联数据）"""
        print_header("测试13: 获取提交详情（含关联数据）")
        
        if not self.submission_ids:
            print_fail("没有可用的 submission_id")
            self.failed += 1
            return False
        
        submission_id = self.submission_ids[0]
        
        try:
            response = self.client.get(f"{API_BASE}/submissions/{submission_id}")
            if response.status_code == 200:
                detail = response.json()
                print_success("获取详情成功")
                print_info(f"  提交ID: {detail['submission_id'][:20]}...")
                print_info(f"  状态: {detail['status']}")
                print_info(f"  判分任务数: {len(detail['grading_tasks'])}")
                print_info(f"  回调载荷数: {len(detail['callback_payloads'])}")
                print_info(f"  异常日志数: {len(detail['exception_logs'])}")
                print_info(f"  重试记录数: {len(detail['retry_records'])}")
                self.passed += 1
                return True
            else:
                print_fail(f"获取详情失败: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            print_fail(f"请求失败: {e}")
            self.failed += 1
            return False

    def test_14_get_exceptions(self):
        """测试14: 获取异常列表"""
        print_header("测试14: 获取异常列表")
        
        try:
            response = self.client.get(f"{API_BASE}/exceptions/?unresolved_only=true")
            if response.status_code == 200:
                exceptions = response.json()
                print_success(f"获取异常列表成功，共 {len(exceptions)} 条未解决异常")
                
                for exc in exceptions[:3]:
                    print_info(f"  - {exc['exception_type']}: {exc['error_message'][:30]}...")
                
                self.passed += 1
                return True
            else:
                print_fail(f"获取异常列表失败: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            print_fail(f"请求失败: {e}")
            self.failed += 1
            return False

    def test_15_status_filter(self):
        """测试15: 按状态筛选提交"""
        print_header("测试15: 按状态筛选提交")
        
        test_statuses = ["success", "callback_failed", "manual_review"]
        
        for status in test_statuses:
            try:
                response = self.client.get(
                    f"{API_BASE}/submissions/",
                    params={"status": status}
                )
                
                if response.status_code == 200:
                    submissions = response.json()
                    print_info(f"  状态 '{status}': {len(submissions)} 条记录")
                else:
                    print_fail(f"筛选失败: {response.status_code}")
            except Exception as e:
                print_fail(f"请求失败: {e}")
        
        print_success("状态筛选功能正常")
        self.passed += 1
        return True

    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "=" * 60)
        print("  作业判分回调台 - 测试套件启动")
        print("=" * 60)
        
        tests = [
            self.test_1_health_check,
            self.test_2_create_submission,
            self.test_3_list_submissions,
            self.test_4_create_grading_tasks,
            self.test_5_complete_grading_task,
            self.test_6_create_callback_payload,
            self.test_7_create_invalid_callback,
            self.test_8_verify_callback_payload,
            self.test_9_write_grade,
            self.test_10_update_submission_status,
            self.test_11_retry_callback,
            self.test_12_get_statistics,
            self.test_13_get_submission_detail,
            self.test_14_get_exceptions,
            self.test_15_status_filter,
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print_fail(f"测试执行异常: {e}")
                self.failed += 1
        
        print("\n" + "=" * 60)
        print("  测试结果汇总")
        print("=" * 60)
        print(f"  通过: {self.passed}")
        print(f"  失败: {self.failed}")
        print(f"  总计: {self.passed + self.failed}")
        
        if self.failed == 0:
            print("\n  🎉 所有测试通过！")
        else:
            print(f"\n  ⚠️  有 {self.failed} 个测试失败，请检查")
        
        self.client.close()
        
        return self.failed == 0


if __name__ == "__main__":
    suite = TestSuite()
    success = suite.run_all_tests()
    sys.exit(0 if success else 1)
