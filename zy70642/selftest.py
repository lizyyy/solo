#!/usr/bin/env python3
"""
会议纪要行动项延期识别API自检脚本
验证导入、筛选、处理和导出功能
"""

import sys
import os
import json
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, Base, engine
from sqlalchemy.orm import Session

client = TestClient(app)

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def print_result(test_name, passed, message=""):
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status} - {test_name}")
    if message:
        print(f"    {message}")
    return passed

def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal()

def test_markdown_parsing():
    print_section("测试1: Markdown解析功能")
    passed_tests = 0
    total_tests = 0
    
    markdown_content = """
# 项目周会纪要 - 2024年第20周

## 待办事项
- [ ] 完成API接口文档，负责人: 张三，截止日期: 2024-05-20
- [ ] 进行单元测试编写，李四负责，5月25日前完成
- [x] 数据库设计已完成，负责人: 王五，截止: 5月10日
- [ ] 前端页面开发，负责人: 赵六，截止: 下周五
- [ ] 部署环境配置，因服务器延期未完成，负责人: 钱七

## 已延期任务
- 接口联调，原定5月15日，延期至5月22日，原因: 第三方接口延迟
"""
    
    total_tests += 1
    response = client.post(
        "/api/action-items/parse-markdown",
        json={"markdown_content": markdown_content}
    )
    
    if response.status_code == 200:
        data = response.json()
        action_items_count = len(data["action_items"])
        needs_review_count = data["needs_review_count"]
        
        if action_items_count >= 5:
            passed_tests += print_result(
                "Markdown基本解析",
                True,
                f"成功解析 {action_items_count} 个行动项, {needs_review_count} 个需复核"
            )
        else:
            passed_tests += print_result(
                "Markdown基本解析",
                False,
                f"期望解析至少5个行动项，实际解析了 {action_items_count} 个"
            )
        
        completed_items = [i for i in data["action_items"] if i["status"] == "已完成"]
        total_tests += 1
        if len(completed_items) >= 1:
            passed_tests += print_result(
                "已完成状态识别",
                True,
                f"识别到 {len(completed_items)} 个已完成任务"
            )
        else:
            passed_tests += print_result(
                "已完成状态识别",
                False,
                "未能识别已完成任务"
            )
        
        delayed_items = [i for i in data["action_items"] if i["status"] == "已延期"]
        total_tests += 1
        if len(delayed_items) >= 1:
            passed_tests += print_result(
                "延期状态识别",
                True,
                f"识别到 {len(delayed_items)} 个延期任务"
            )
        else:
            passed_tests += print_result(
                "延期状态识别",
                False,
                "未能识别延期任务"
            )
        
        assignees = [i["raw_assignee"] for i in data["action_items"] if i["raw_assignee"]]
        total_tests += 1
        if len(assignees) >= 4:
            passed_tests += print_result(
                "负责人提取",
                True,
                f"提取到 {len(assignees)} 位负责人: {', '.join(assignees)}"
            )
        else:
            passed_tests += print_result(
                "负责人提取",
                False,
                f"期望提取至少4位负责人，实际提取了 {len(assignees)} 位"
            )
    else:
        print_result("Markdown解析", False, f"状态码: {response.status_code}")
        total_tests += 4
    
    return passed_tests, total_tests

def test_meeting_import():
    print_section("测试2: 会议纪要导入功能")
    passed_tests = 0
    total_tests = 0
    
    meeting_data = {
        "title": "2024年第20周项目周会",
        "content": """
## 待办事项
- [ ] 完成API接口文档，负责人: 张三，截止日期: 2024-05-20
- [ ] 进行单元测试编写，李四负责
- [ ] 部署环境配置，延期原因: 服务器采购延迟
        """,
        "meeting_date": "2024-05-13"
    }
    
    total_tests += 1
    response = client.post("/api/meetings/", json=meeting_data)
    if response.status_code == 200:
        meeting_id = response.json()["id"]
        passed_tests += print_result(
            "创建会议纪要",
            True,
            f"会议纪要ID: {meeting_id}"
        )
        
        total_tests += 1
        parse_response = client.post(f"/api/meetings/{meeting_id}/parse")
        if parse_response.status_code == 200:
            parse_data = parse_response.json()
            passed_tests += print_result(
                "解析会议纪要行动项",
                True,
                f"解析到 {parse_data['action_items_count']} 个行动项"
            )
        else:
            passed_tests += print_result(
                "解析会议纪要行动项",
                False,
                f"状态码: {parse_response.status_code}"
            )
    else:
        passed_tests += print_result(
            "创建会议纪要",
            False,
            f"状态码: {response.status_code}"
        )
        total_tests += 1
    
    return passed_tests, total_tests

def test_action_item_filters():
    print_section("测试3: 行动项筛选功能")
    passed_tests = 0
    total_tests = 0
    
    total_tests += 1
    response = client.get("/api/action-items/")
    if response.status_code == 200:
        all_items = response.json()
        passed_tests += print_result(
            "查询所有行动项",
            True,
            f"共 {len(all_items)} 个行动项"
        )
    else:
        passed_tests += print_result(
            "查询所有行动项",
            False,
            f"状态码: {response.status_code}"
        )
    
    total_tests += 1
    pending_response = client.get("/api/action-items/?status=待处理")
    if pending_response.status_code == 200:
        pending_items = pending_response.json()
        passed_tests += print_result(
            "按状态筛选(待处理)",
            True,
            f"待处理行动项: {len(pending_items)} 个"
        )
    else:
        passed_tests += print_result(
            "按状态筛选(待处理)",
            False,
            f"状态码: {pending_response.status_code}"
        )
    
    return passed_tests, total_tests

def test_person_management():
    print_section("测试4: 负责人管理与归并")
    passed_tests = 0
    total_tests = 0
    
    total_tests += 1
    person1_response = client.post(
        "/api/action-items/persons/",
        json={"name": "张三", "department": "技术部", "alias": "小张"}
    )
    if person1_response.status_code == 200:
        person1_id = person1_response.json()["id"]
        passed_tests += print_result(
            "创建负责人1",
            True,
            f"负责人ID: {person1_id}"
        )
    else:
        passed_tests += print_result(
            "创建负责人1",
            False,
            f"状态码: {person1_response.status_code}"
        )
        return passed_tests, total_tests + 1
    
    total_tests += 1
    person2_response = client.post(
        "/api/action-items/persons/",
        json={"name": "李四", "department": "技术部"}
    )
    if person2_response.status_code == 200:
        person2_id = person2_response.json()["id"]
        passed_tests += print_result(
            "创建负责人2",
            True,
            f"负责人ID: {person2_id}"
        )
    else:
        passed_tests += print_result(
            "创建负责人2",
            False,
            f"状态码: {person2_response.status_code}"
        )
        return passed_tests + 1, total_tests + 1
    
    total_tests += 1
    meeting_response = client.post(
        "/api/meetings/",
        json={
            "title": "测试负责人归并",
            "content": "- [ ] 完成接口开发，负责人: 张三，截止日期: 2024-06-01\n- [ ] 编写测试用例，负责人: 李四，截止日期: 2024-06-15"
        }
    )
    meeting_id = meeting_response.json()["id"]
    
    parse_response = client.post(f"/api/meetings/{meeting_id}/parse")
    if parse_response.status_code == 200:
        parse_data = parse_response.json()
        matched_count = parse_data.get("matched_assignees_count", 0)
        if matched_count >= 2:
            passed_tests += print_result(
                "负责人自动归并匹配",
                True,
                f"成功匹配 {matched_count} 位负责人"
            )
        else:
            passed_tests += print_result(
                "负责人自动归并匹配",
                False,
                f"期望匹配至少 2 位，实际匹配 {matched_count} 位"
            )
    else:
        passed_tests += print_result(
            "负责人自动归并匹配",
            False,
            f"状态码: {parse_response.status_code}"
        )
    
    total_tests += 1
    report_response = client.get("/api/reports/by-assignee")
    if report_response.status_code == 200:
        report_data = report_response.json()
        zhangsan_items = [r for r in report_data if r["person_name"] == "张三"]
        if zhangsan_items and zhangsan_items[0]["total_items"] >= 1:
            passed_tests += print_result(
                "按负责人统计报告",
                True,
                f"张三有 {zhangsan_items[0]['total_items']} 个行动项"
            )
        else:
            passed_tests += print_result(
                "按负责人统计报告",
                False,
                "张三的行动项未进入统计"
            )
    else:
        passed_tests += print_result(
            "按负责人统计报告",
            False,
            f"状态码: {report_response.status_code}"
        )
    
    return passed_tests, total_tests

def test_delay_management():
    print_section("测试5: 延期标记与异常处理")
    passed_tests = 0
    total_tests = 0
    
    item_response = client.post(
        "/api/action-items/",
        json={
            "content": "服务器部署",
            "due_date": str(date.today() - timedelta(days=3)),
            "status": "待处理"
        }
    )
    item_id = item_response.json()["id"]
    
    total_tests += 1
    delay_response = client.post(
        f"/api/action-items/{item_id}/mark-delayed?reason=硬件采购延迟&new_due_date={date.today() + timedelta(days=7)}"
    )
    if delay_response.status_code == 200:
        passed_tests += print_result(
            "标记行动项为延期",
            True,
            "延期原因和新截止日期已记录"
        )
    else:
        passed_tests += print_result(
            "标记行动项为延期",
            False,
            f"状态码: {delay_response.status_code}"
        )
    
    total_tests += 1
    completed_item = client.post(
        "/api/action-items/",
        json={
            "content": "已完成的任务",
            "status": "已完成"
        }
    )
    completed_id = completed_item.json()["id"]
    
    invalid_delay = client.post(
        f"/api/action-items/{completed_id}/mark-delayed?reason=测试"
    )
    if invalid_delay.status_code == 409:
        passed_tests += print_result(
            "状态不允许异常(已完成任务不能延期)",
            True,
            f"错误码: {invalid_delay.json()['error_code']}"
        )
    else:
        passed_tests += print_result(
            "状态不允许异常",
            False,
            f"期望状态码409，实际: {invalid_delay.status_code}"
        )
    
    return passed_tests, total_tests

def test_export_functions():
    print_section("测试6: 报告导出功能")
    passed_tests = 0
    total_tests = 0
    
    total_tests += 1
    kanban_response = client.get("/api/reports/kanban")
    if kanban_response.status_code == 200:
        kanban_data = kanban_response.json()
        total_items = sum(len(v) for k, v in kanban_data.items() if k != "needs_review")
        passed_tests += print_result(
            "看板数据导出",
            True,
            f"待处理: {len(kanban_data['pending'])}, 进行中: {len(kanban_data['in_progress'])}, 已延期: {len(kanban_data['delayed'])}, 已完成: {len(kanban_data['completed'])}"
        )
    else:
        passed_tests += print_result(
            "看板数据导出",
            False,
            f"状态码: {kanban_response.status_code}"
        )
    
    total_tests += 1
    md_response = client.get("/api/reports/export-markdown")
    if md_response.status_code == 200:
        md_content = md_response.json()["content"]
        passed_tests += print_result(
            "Markdown格式导出",
            True,
            f"导出内容长度: {len(md_content)} 字符"
        )
    else:
        passed_tests += print_result(
            "Markdown格式导出",
            False,
            f"状态码: {md_response.status_code}"
        )
    
    return passed_tests, total_tests

def test_error_handling():
    print_section("测试7: 错误响应处理")
    passed_tests = 0
    total_tests = 0
    
    total_tests += 1
    missing_field = client.post("/api/meetings/", json={"title": "", "content": ""})
    if missing_field.status_code == 400:
        error_data = missing_field.json()
        if error_data["error_code"] == "MISSING_FIELD":
            passed_tests += print_result(
                "缺字段错误响应",
                True,
                f"错误码: {error_data['error_code']}, 字段: {error_data['details']['field']}"
            )
        else:
            passed_tests += print_result(
                "缺字段错误响应",
                False,
                f"错误码不正确: {error_data['error_code']}"
            )
    else:
        passed_tests += print_result(
            "缺字段错误响应",
            False,
            f"期望状态码400，实际: {missing_field.status_code}"
        )
    
    total_tests += 1
    not_found = client.get("/api/action-items/99999")
    if not_found.status_code == 404:
        error_data = not_found.json()
        if error_data["error_code"] == "NOT_FOUND":
            passed_tests += print_result(
                "资源不存在错误响应",
                True,
                f"错误码: {error_data['error_code']}"
            )
        else:
            passed_tests += print_result(
                "资源不存在错误响应",
                False,
                f"错误码不正确: {error_data['error_code']}"
            )
    else:
        passed_tests += print_result(
            "资源不存在错误响应",
            False,
            f"期望状态码404，实际: {not_found.status_code}"
        )
    
    return passed_tests, total_tests

def main():
    print("\n" + "="*60)
    print("  会议纪要行动项延期识别API - 自检脚本")
    print("="*60)
    
    db = setup_database()
    
    all_passed = 0
    all_total = 0
    
    tests = [
        test_markdown_parsing,
        test_meeting_import,
        test_action_item_filters,
        test_person_management,
        test_delay_management,
        test_export_functions,
        test_error_handling
    ]
    
    for test in tests:
        passed, total = test()
        all_passed += passed
        all_total += total
    
    print_section("自检结果汇总")
    print(f"总测试数: {all_total}")
    print(f"通过数:   {all_passed}")
    print(f"失败数:   {all_total - all_passed}")
    print(f"通过率:   {all_passed/all_total*100:.1f}%")
    
    print()
    if all_passed == all_total:
        print("✓ 所有测试通过！")
        return 0
    else:
        print(f"✗ 有 {all_total - all_passed} 个测试失败")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
