#!/usr/bin/env python3
"""
FastAPI 接口级异常流测试
验证四种关键错误码: missing_field, invalid_status, needs_review, already_processed
"""

import sys
import os
import json
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 先清理数据库
if os.path.exists('anchor_migration.db'):
    os.remove('anchor_migration.db')

from main import app, ErrorCodes

client = TestClient(app)


class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
    
    def add(self, test_name, success, message=""):
        if success:
            self.passed += 1
            print(f"✅ {test_name}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {message}")
    
    def summary(self):
        print("\n" + "="*60)
        print(f"API异常流测试结果: {self.passed} 通过, {self.failed} 失败")
        print("="*60)
        return self.failed == 0


def test_api_error_flows():
    """测试所有关键异常流"""
    result = TestResult()
    
    print("\n📋 API异常流测试")
    print("-" * 60)
    
    # 1. 测试 missing_field - 导入文件时缺少必填字段
    print("\n1. 测试 MISSING_FIELD 错误码")
    response = client.post("/api/files/import", json={"file_path": "", "content": ""})
    if response.status_code == 400:
        error_data = response.json()
        result.add(
            "MISSING_FIELD: 返回400状态码",
            True,
            f"status_code={response.status_code}"
        )
        result.add(
            f"MISSING_FIELD: 错误码正确 ({error_data.get('error_code')})",
            error_data.get('error_code') == ErrorCodes.MISSING_FIELD,
            f"期望: {ErrorCodes.MISSING_FIELD}, 实际: {error_data.get('error_code')}"
        )
    else:
        result.add("MISSING_FIELD: 返回400状态码", False, f"实际: {response.status_code}")
    
    # 先导入一个测试文件，创建一个链接
    test_content = """# Test Heading
## Second Section
[Link to Second](doc.md#second-section)
"""
    response = client.post("/api/files/import", json={
        "file_path": "/test/doc.md",
        "content": test_content
    })
    file_id = response.json()['file_id']
    
    # 获取链接ID
    response = client.get("/api/links")
    links = response.json()['links']
    link_id = links[0]['id'] if links else 1
    
    # 2. 测试 invalid_status - 提交无效的状态值
    print("\n2. 测试 INVALID_STATUS 错误码")
    response = client.put(f"/api/links/{link_id}", json={"status": "definitely_invalid"})
    if response.status_code == 400:
        error_data = response.json()
        result.add(
            "INVALID_STATUS: 返回400状态码",
            True,
            f"status_code={response.status_code}"
        )
        result.add(
            f"INVALID_STATUS: 错误码正确 ({error_data.get('error_code')})",
            error_data.get('error_code') == ErrorCodes.INVALID_STATUS,
            f"期望: {ErrorCodes.INVALID_STATUS}, 实际: {error_data.get('error_code')}"
        )
        if 'details' in error_data and 'valid_statuses' in error_data['details']:
            result.add(
                "INVALID_STATUS: 包含合法状态列表",
                True,
                f"合法状态: {error_data['details']['valid_statuses']}"
            )
        else:
            result.add("INVALID_STATUS: 包含合法状态列表", False, "缺少 valid_statuses")
    else:
        result.add("INVALID_STATUS: 返回400状态码", False, f"实际: {response.status_code}, 响应: {response.text}")
    
    # 3. 测试 needs_review - 标记 needs_review 但缺少审核人
    print("\n3. 测试 NEEDS_REVIEW 错误码")
    response = client.put(f"/api/links/{link_id}", json={"needs_review": True})
    if response.status_code == 400:
        error_data = response.json()
        result.add(
            "NEEDS_REVIEW: 返回400状态码",
            True,
            f"status_code={response.status_code}"
        )
        result.add(
            f"NEEDS_REVIEW: 错误码正确 ({error_data.get('error_code')})",
            error_data.get('error_code') == ErrorCodes.NEEDS_REVIEW,
            f"期望: {ErrorCodes.NEEDS_REVIEW}, 实际: {error_data.get('error_code')}"
        )
        # 验证不是 missing_field
        result.add(
            "NEEDS_REVIEW: 不是 MISSING_FIELD",
            error_data.get('error_code') != ErrorCodes.MISSING_FIELD,
            f"确保与 MISSING_FIELD 可区分"
        )
    else:
        result.add("NEEDS_REVIEW: 返回400状态码", False, f"实际: {response.status_code}, 响应: {response.text}")
    
    # 4. 测试 already_processed - 已处理状态重复修复
    print("\n4. 测试 ALREADY_PROCESSED 错误码")
    # 先标记为已修复
    client.put(f"/api/links/{link_id}", json={"status": "fixed", "reviewed_by": "tester"})
    # 再次尝试标记为修复
    response = client.put(f"/api/links/{link_id}", json={"status": "fixed"})
    if response.status_code == 400:
        error_data = response.json()
        result.add(
            "ALREADY_PROCESSED: 返回400状态码",
            True,
            f"status_code={response.status_code}"
        )
        result.add(
            f"ALREADY_PROCESSED: 错误码正确 ({error_data.get('error_code')})",
            error_data.get('error_code') == ErrorCodes.ALREADY_PROCESSED,
            f"期望: {ErrorCodes.ALREADY_PROCESSED}, 实际: {error_data.get('error_code')}"
        )
    else:
        result.add("ALREADY_PROCESSED: 返回400状态码", False, f"实际: {response.status_code}, 响应: {response.text}")
    
    # 5. 测试 not_found - 请求不存在的链接
    print("\n5. 测试 NOT_FOUND 错误码")
    response = client.get("/api/links/99999")
    if response.status_code == 404:
        error_data = response.json()
        result.add(
            "NOT_FOUND: 返回404状态码",
            True,
            f"status_code={response.status_code}"
        )
        result.add(
            f"NOT_FOUND: 错误码正确 ({error_data.get('error_code')})",
            error_data.get('error_code') == ErrorCodes.NOT_FOUND,
            f"期望: {ErrorCodes.NOT_FOUND}, 实际: {error_data.get('error_code')}"
        )
    else:
        result.add("NOT_FOUND: 返回404状态码", False, f"实际: {response.status_code}, 响应: {response.text}")
    
    # 6. 验证五个错误码都能被调用方明确区分
    print("\n6. 验证五种错误码的可区分性")
    all_error_codes = {
        ErrorCodes.MISSING_FIELD,
        ErrorCodes.INVALID_STATUS,
        ErrorCodes.NEEDS_REVIEW,
        ErrorCodes.ALREADY_PROCESSED,
        ErrorCodes.NOT_FOUND
    }
    result.add(
        "五种错误码互不相同",
        len(all_error_codes) == 5,
        f"实际不同错误码数量: {len(all_error_codes)}"
    )
    
    # 7. 正常流程测试（确保异常修复不影响正常功能）
    print("\n7. 验证正常流程仍可正常工作")
    response = client.get("/api/files")
    result.add(
        "正常流程: 获取文件列表成功",
        response.status_code == 200,
        f"status_code={response.status_code}"
    )
    
    response = client.get(f"/api/files/{file_id}/anchors")
    result.add(
        "正常流程: 获取锚点列表成功",
        response.status_code == 200,
        f"status_code={response.status_code}"
    )
    
    response = client.post("/api/scan/broken-anchors")
    result.add(
        "正常流程: 扫描断链成功",
        response.status_code == 200,
        f"status_code={response.status_code}"
    )
    
    response = client.post("/api/reports/generate", json={"report_name": "test_report"})
    result.add(
        "正常流程: 生成报告成功",
        response.status_code == 200,
        f"status_code={response.status_code}"
    )
    
    return result


if __name__ == "__main__":
    print("="*60)
    print("FastAPI 接口级异常流测试")
    print("="*60)
    
    result = test_api_error_flows()
    success = result.summary()
    
    print("\n" + "="*60)
    print("关键异常流错误码说明:")
    print("="*60)
    print(f"  📌 missing_field     - 缺少必填字段 (如导入时缺少文件路径)")
    print(f"  📌 invalid_status    - 状态值不合法 (如 status='definitely_invalid')")
    print(f"  📌 needs_review      - 需要人工复核但缺少审核人")
    print(f"  📌 already_processed - 链接已处理过，无法重复修复")
    print(f"  📌 not_found         - 请求的资源不存在")
    print("="*60)
    
    if success:
        print("\n🎉 API异常流测试全部通过! 调用方可明确区分各类错误。")
        sys.exit(0)
    else:
        print("\n⚠️  部分测试失败，请检查修复。")
        sys.exit(1)
