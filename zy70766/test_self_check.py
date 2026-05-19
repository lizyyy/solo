#!/usr/bin/env python3
"""
对象生命周期删除预演API自检脚本
验证导入、筛选、处理和导出功能
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tempfile
import json

client = TestClient(app)


def print_section(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


def test_health_check():
    print_section("1. 健康检查")
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    print("✓ 健康检查通过")


def test_create_rule():
    print_section("2. 创建生命周期规则")

    rule_data = {
        "name": "测试规则-30天后删除",
        "description": "删除30天前修改的临时文件",
        "status": "active",
        "prefix": "temp/",
        "days_after_modification": 30,
        "action": "Delete"
    }

    response = client.post("/api/rules/", json=rule_data)
    assert response.status_code == 200, f"创建规则失败: {response.text}"
    rule = response.json()
    assert rule["name"] == rule_data["name"]
    assert rule["prefix"] == "temp/"
    assert rule["days_after_modification"] == 30
    print(f"✓ 规则创建成功: ID={rule['id']}, 名称={rule['name']}")

    return rule["id"]


def test_create_tag_rule():
    print_section("3. 创建带标签过滤的规则")

    rule_data = {
        "name": "测试规则-按标签删除",
        "description": "删除带有archive=true标签的文件",
        "status": "active",
        "tag_filters": [{"key": "archive", "value": "true"}],
        "days_after_modification": 0,
        "action": "Delete"
    }

    response = client.post("/api/rules/", json=rule_data)
    assert response.status_code == 200, f"创建规则失败: {response.text}"
    rule = response.json()
    print(f"✓ 标签过滤规则创建成功: ID={rule['id']}")

    return rule["id"]


def test_bulk_import_objects():
    print_section("4. 批量导入存储对象")

    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
    ten_days_ago = (datetime.utcnow() - timedelta(days=10)).isoformat()

    objects = [
        {
            "key": "temp/file1.txt",
            "bucket": "test-bucket",
            "size": 1024,
            "last_modified": thirty_days_ago,
            "creation_date": thirty_days_ago,
            "tags": {},
            "storage_class": "STANDARD"
        },
        {
            "key": "temp/file2.jpg",
            "bucket": "test-bucket",
            "size": 2048000,
            "last_modified": thirty_days_ago,
            "creation_date": thirty_days_ago,
            "tags": {},
            "storage_class": "STANDARD"
        },
        {
            "key": "temp/recent.txt",
            "bucket": "test-bucket",
            "size": 512,
            "last_modified": ten_days_ago,
            "creation_date": ten_days_ago,
            "tags": {},
            "storage_class": "STANDARD"
        },
        {
            "key": "data/important.doc",
            "bucket": "test-bucket",
            "size": 102400,
            "last_modified": thirty_days_ago,
            "creation_date": thirty_days_ago,
            "tags": {"archive": "true"},
            "storage_class": "STANDARD"
        },
        {
            "key": "logs/2023.log",
            "bucket": "test-bucket",
            "size": 5242880,
            "last_modified": thirty_days_ago,
            "creation_date": thirty_days_ago,
            "tags": {"archive": "true"},
            "storage_class": "STANDARD"
        }
    ]

    response = client.post("/api/objects/bulk", json=objects)
    assert response.status_code == 200, f"批量导入失败: {response.text}"
    result = response.json()
    assert result["success_count"] == 5
    assert result["failed_count"] == 0
    print(f"✓ 批量导入成功: 成功{result['success_count']}个, 失败{result['failed_count']}个")

    return objects


def test_list_objects():
    print_section("5. 对象列表与筛选")

    response = client.get("/api/objects/")
    assert response.status_code == 200
    all_objects = response.json()
    print(f"✓ 总对象数: {len(all_objects)}")

    response = client.get("/api/objects/", params={"prefix": "temp/"})
    assert response.status_code == 200
    temp_objects = response.json()
    assert len(temp_objects) == 3
    print(f"✓ 前缀筛选(temp/)正确: 找到{len(temp_objects)}个对象")

    for obj in temp_objects:
        assert obj["key"].startswith("temp/")


def test_start_preview():
    print_section("6. 启动预演任务")

    rules = client.get("/api/rules/").json()
    rule_id = rules[0]["id"]

    response = client.post(
        "/api/preview/start",
        json={"rule_id": rule_id, "name": "第一次预演报告"}
    )
    assert response.status_code == 200, f"启动预演失败: {response.text}"
    result = response.json()
    assert result["status"] == "running"
    report_id = result["report_id"]
    print(f"✓ 预演任务启动成功: 报告ID={report_id}")

    return report_id


def test_execute_preview(report_id):
    print_section("7. 执行预演计算")

    response = client.post(f"/api/preview/{report_id}/execute")
    assert response.status_code == 200, f"执行预演失败: {response.text}"
    result = response.json()

    report = result["report"]
    hits = result["hits"]

    assert report["status"] == "completed"
    assert report["total_objects"] == 5
    assert report["hit_objects"] == 2
    print(f"✓ 预演执行完成")
    print(f"  - 总对象数: {report['total_objects']}")
    print(f"  - 命中对象数: {report['hit_objects']}")
    print(f"  - 总大小: {report['total_size']} 字节")
    print(f"  - 命中大小: {report['hit_size']} 字节")

    print("\n  命中对象详情:")
    for hit in hits:
        print(f"    - {hit['object_key']}: {hit['hit_reason']}")

    return report_id


def test_export_csv(report_id):
    print_section("8. 导出CSV报告")

    response = client.get(f"/api/preview/{report_id}/export/csv")
    assert response.status_code == 200, f"导出CSV失败: {response.text}"
    assert "text/csv" in response.headers["content-type"]

    csv_content = response.text
    assert "预演报告摘要" in csv_content
    assert "命中对象详情" in csv_content
    print("✓ CSV报告导出成功")
    print(f"  - 内容长度: {len(csv_content)} 字符")

    with open(f"test_report_{report_id}.csv", "w", encoding="utf-8") as f:
        f.write(csv_content)
    print(f"  - 已保存到 test_report_{report_id}.csv")


def test_export_markdown(report_id):
    print_section("9. 导出Markdown报告")

    response = client.get(f"/api/preview/{report_id}/export/markdown")
    assert response.status_code == 200, f"导出Markdown失败: {response.text}"
    assert "text/markdown" in response.headers["content-type"]

    md_content = response.text
    assert "# 生命周期删除预演报告" in md_content
    assert "命中对象详情" in md_content
    print("✓ Markdown报告导出成功")
    print(f"  - 内容长度: {len(md_content)} 字符")

    with open(f"test_report_{report_id}.md", "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"  - 已保存到 test_report_{report_id}.md")


def test_tag_based_preview():
    print_section("10. 基于标签的规则预演")

    rules = client.get("/api/rules/").json()
    tag_rule = [r for r in rules if "按标签删除" in r["name"]][0]

    response = client.post(
        "/api/preview/start",
        json={"rule_id": tag_rule["id"], "name": "标签过滤预演"}
    )
    report_id = response.json()["report_id"]

    response = client.post(f"/api/preview/{report_id}/execute")
    result = response.json()
    report = result["report"]
    hits = result["hits"]

    assert report["hit_objects"] == 2
    print(f"✓ 标签过滤预演正确: 命中{report['hit_objects']}个对象")

    hit_keys = [hit["object_key"] for hit in hits]
    assert "data/important.doc" in hit_keys
    assert "logs/2023.log" in hit_keys
    print("✓ 标签匹配命中正确")


def test_error_handling():
    print_section("11. 错误响应验证")

    print("  测试缺失字段错误...")
    response = client.get("/api/rules/999999")
    assert response.status_code == 404
    error = response.json()["detail"]
    assert error["error_type"] == "missing_field"
    print("    ✓ 缺失字段错误正确")

    print("  测试无效状态错误...")
    invalid_rule = {
        "name": "无效规则",
        "status": "archived",
        "prefix": "test/",
        "days_after_modification": 10
    }
    create_resp = client.post("/api/rules/", json=invalid_rule)
    rule_id = create_resp.json()["id"]

    response = client.post(
        "/api/preview/start",
        json={"rule_id": rule_id, "name": "测试报告"}
    )
    assert response.status_code == 400
    error = response.json()["detail"]
    assert error["error_type"] == "invalid_status"
    print("    ✓ 无效状态错误正确")

    print("  测试重复执行错误...")
    rules = client.get("/api/rules/").json()
    active_rule = [r for r in rules if r["status"] == "active"][0]
    start_resp = client.post(
        "/api/preview/start",
        json={"rule_id": active_rule["id"], "name": "重复测试报告"}
    )
    report_id = start_resp.json()["report_id"]
    client.post(f"/api/preview/{report_id}/execute")

    response = client.post(f"/api/preview/{report_id}/execute")
    assert response.status_code == 400
    error = response.json()["detail"]
    assert error["error_type"] == "already_processed"
    print("    ✓ 重复处理错误正确")

    print("✓ 所有错误响应类型验证通过")


def test_list_previews():
    print_section("12. 预演报告列表")

    response = client.get("/api/preview/")
    assert response.status_code == 200
    reports = response.json()
    print(f"✓ 获取报告列表成功: 共{len(reports)}个报告")

    for report in reports:
        print(f"  - {report['name']}: {report['status']}, 命中{report['hit_objects']}个对象")


def main():
    print("\n" + "╔" + "═" * 58 + "╗")
    print("║" + " " * 10 + "对象生命周期删除预演API - 自检脚本" + " " * 11 + "║")
    print("╚" + "═" * 58 + "╝")

    try:
        test_health_check()
        rule1_id = test_create_rule()
        rule2_id = test_create_tag_rule()
        test_bulk_import_objects()
        test_list_objects()
        report_id = test_start_preview()
        test_execute_preview(report_id)
        test_export_csv(report_id)
        test_export_markdown(report_id)
        test_tag_based_preview()
        test_error_handling()
        test_list_previews()

        print_section("自检完成")
        print("✅ 所有测试通过！")
        print("\n功能验证总结:")
        print("  ✓ 规则创建与验证")
        print("  ✓ 对象批量导入")
        print("  ✓ 前缀筛选")
        print("  ✓ 标签匹配")
        print("  ✓ 时间判断")
        print("  ✓ 预演计算")
        print("  ✓ CSV导出")
        print("  ✓ Markdown导出")
        print("  ✓ 错误响应分类")
        print("\n")

    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
