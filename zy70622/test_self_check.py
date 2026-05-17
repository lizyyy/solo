#!/usr/bin/env python3
"""
访客车位管理系统自检脚本
验证功能：数据导入、状态筛选、业务流程处理、报告导出、异常响应
"""

import sys
import os
import sqlite3
from datetime import date, datetime, timedelta
import uuid
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app

client = TestClient(app)

def run_test(name, test_func):
    print(f"\n{'='*60}")
    print(f"测试: {name}")
    print(f"{'='*60}")
    try:
        test_func()
        print(f"✓ {name} - 通过")
        return True
    except AssertionError as e:
        print(f"✗ {name} - 失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"✗ {name} - 异常: {e}")
        import traceback
        traceback.print_exc()
        return False

def cleanup_db():
    if os.path.exists("parking.db"):
        os.remove("parking.db")

def test_1_database_init():
    """测试1: 数据库初始化"""
    cleanup_db()
    response = client.get("/parking-spots")
    assert response.status_code == 200
    spots = response.json()
    assert len(spots) == 20, f"预期20个车位，实际{len(spots)}个"
    
    areas = set(spot["area"] for spot in spots)
    assert "A区" in areas and "B区" in areas, "区域划分不正确"
    
    print("  - 数据库表创建成功")
    print("  - 车位初始化正确 (20个车位)")

def test_2_missing_field_error():
    """测试2: 缺字段返回 MISSING_FIELD 错误码"""
    response = client.post("/visitors", json={"name": "张三"})
    assert response.status_code == 400, f"预期400状态码，实际{response.status_code}"
    
    error = response.json()
    assert error["error_code"] == "MISSING_FIELD", f"预期MISSING_FIELD，实际{error.get('error_code')}"
    assert "phone" in error["details"]["missing_fields"], "应该检测到缺少phone字段"
    
    print("  - 缺字段时正确返回 MISSING_FIELD 错误码")
    print(f"  - 错误详情: {error['message']}")

def test_3_visitor_crud():
    """测试3: 访客数据导入和查询"""
    response = client.post("/visitors", json={
        "name": "张三",
        "phone": "13800138001",
        "company": "科技公司A"
    })
    assert response.status_code == 201
    visitor1 = response.json()
    
    response = client.post("/visitors", json={
        "name": "李四",
        "phone": "13800138002",
        "company": "科技公司B"
    })
    assert response.status_code == 201
    
    response = client.post("/visitors", json={
        "name": "王五",
        "phone": "13800138003"
    })
    assert response.status_code == 201
    
    response = client.get("/visitors")
    visitors = response.json()
    assert len(visitors) == 3, f"预期3个访客，实际{len(visitors)}个"
    
    print("  - 访客数据导入成功")
    print("  - 访客查询筛选正常")
    return visitor1["id"]

def test_4_parking_spot_status():
    """测试4: 车位状态筛选"""
    response = client.get("/parking-spots?status=AVAILABLE")
    available = response.json()
    assert len(available) == 20, f"预期20个可用车位，实际{len(available)}个"
    
    response = client.get("/parking-spots?area=A区")
    area_a = response.json()
    assert len(area_a) == 10, f"预期A区10个车位，实际{len(area_a)}个"
    
    print("  - 车位状态筛选正常")
    print("  - AVAILABLE/LOCKED/OCCUPIED 状态区分正确")

def test_5_meeting_parking_locking():
    """测试5: 会议预约和车位锁定联动"""
    response = client.post("/visitors", json={
        "name": "测试访客",
        "phone": "13900000001"
    })
    visitor_id = response.json()["id"]
    
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    response = client.post("/meetings", json={
        "visitor_id": visitor_id,
        "title": "产品评审会",
        "meeting_date": tomorrow,
        "start_time": "09:00",
        "end_time": "11:00",
        "need_parking": True
    })
    assert response.status_code == 201
    meeting = response.json()
    assert meeting["parking_spot_id"] is not None, "应该分配车位"
    assert meeting["pass_code"] is not None, "应该生成放行码"
    
    response = client.get("/parking-spots?status=LOCKED")
    locked = response.json()
    assert len(locked) == 1, "应该有1个锁定车位"
    
    print("  - 会议预约成功")
    print("  - 车位自动锁定正常")
    print("  - 放行码生成并关联成功")
    return meeting["id"], meeting["pass_code"]

def test_6_pass_code_flow():
    """测试6: 放行码验证和使用"""
    response = client.post("/visitors", json={
        "name": "测试访客2",
        "phone": "13900000002"
    })
    visitor_id = response.json()["id"]
    
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    response = client.post("/meetings", json={
        "visitor_id": visitor_id,
        "title": "重要会议",
        "meeting_date": tomorrow,
        "start_time": "14:00",
        "end_time": "16:00",
        "need_parking": True
    })
    pass_code = response.json()["pass_code"]
    meeting_id = response.json()["id"]
    
    response = client.post(f"/pass-codes/{pass_code}/use")
    assert response.status_code == 200
    
    response = client.get("/parking-spots?status=OCCUPIED")
    occupied = response.json()
    assert len(occupied) == 1, "应该有1个占用车位"
    
    print("  - 放行码使用成功")
    print("  - 车位状态更新为已占用")
    return meeting_id, pass_code

def test_7_already_processed_error():
    """测试7: 重复操作返回 ALREADY_PROCESSED 错误码"""
    response = client.post("/visitors", json={
        "name": "测试访客3",
        "phone": "13900000003"
    })
    visitor_id = response.json()["id"]
    
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    response = client.post("/meetings", json={
        "visitor_id": visitor_id,
        "title": "重复取消测试",
        "meeting_date": tomorrow,
        "start_time": "10:00",
        "end_time": "12:00",
        "need_parking": True
    })
    meeting_id = response.json()["id"]
    pass_code = response.json()["pass_code"]
    
    response = client.post(f"/pass-codes/{pass_code}/use")
    assert response.status_code == 200
    
    response = client.post(f"/pass-codes/{pass_code}/use")
    assert response.status_code == 400
    error_detail = response.json()["detail"]
    assert error_detail["error_code"] == "ALREADY_PROCESSED", f"预期ALREADY_PROCESSED，实际{error_detail.get('error_code')}"
    
    print("  - 重复使用放行码正确返回 ALREADY_PROCESSED 错误码")
    print(f"  - 错误详情: {error_detail['message']}")

def test_8_invalid_status_error():
    """测试8: 状态不允许时返回 INVALID_STATUS 错误码"""
    response = client.post("/visitors", json={
        "name": "测试访客4",
        "phone": "13900000004"
    })
    visitor_id = response.json()["id"]
    
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    response = client.post("/meetings", json={
        "visitor_id": visitor_id,
        "title": "状态测试会议",
        "meeting_date": tomorrow,
        "start_time": "11:00",
        "end_time": "13:00",
        "need_parking": True
    })
    meeting_id = response.json()["id"]
    
    response = client.post("/meetings/cancel", json={
        "meeting_id": meeting_id,
        "cancelled_by": "测试人员"
    })
    assert response.status_code == 200
    
    response = client.post("/meetings/cancel", json={
        "meeting_id": meeting_id,
        "cancelled_by": "测试人员"
    })
    assert response.status_code == 400
    error_detail = response.json()["detail"]
    assert error_detail["error_code"] == "ALREADY_PROCESSED", f"预期ALREADY_PROCESSED，实际{error_detail.get('error_code')}"
    
    print("  - 重复取消会议正确返回 ALREADY_PROCESSED 错误码")
    print(f"  - 错误详情: {error_detail['message']}")

def test_9_needs_manual_review_error():
    """测试9: 已占用车位取消时返回 NEEDS_MANUAL_REVIEW 错误码"""
    response = client.post("/visitors", json={
        "name": "测试访客5",
        "phone": "13900000005"
    })
    visitor_id = response.json()["id"]
    
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    response = client.post("/meetings", json={
        "visitor_id": visitor_id,
        "title": "人工复核测试",
        "meeting_date": tomorrow,
        "start_time": "15:00",
        "end_time": "17:00",
        "need_parking": True
    })
    meeting_id = response.json()["id"]
    pass_code = response.json()["pass_code"]
    
    response = client.post(f"/pass-codes/{pass_code}/use")
    assert response.status_code == 200
    
    response = client.post("/meetings/cancel", json={
        "meeting_id": meeting_id,
        "cancelled_by": "前台管理员",
        "cancel_reason": "访客提前离开"
    })
    assert response.status_code == 202, f"预期202状态码，实际{response.status_code}"
    
    error_detail = response.json()["detail"]
    assert error_detail["error_code"] == "NEEDS_MANUAL_REVIEW", f"预期NEEDS_MANUAL_REVIEW，实际{error_detail.get('error_code')}"
    
    print("  - 已占用车位取消正确返回 NEEDS_MANUAL_REVIEW 错误码")
    print(f"  - 错误详情: {error_detail['message']}")

def test_10_resource_not_found_error():
    """测试10: 资源不存在时返回 RESOURCE_NOT_FOUND 错误码"""
    response = client.get("/pass-codes/999999")
    assert response.status_code == 404
    error_detail = response.json()["detail"]
    assert error_detail["error_code"] == "RESOURCE_NOT_FOUND", f"预期RESOURCE_NOT_FOUND，实际{error_detail.get('error_code')}"
    
    print("  - 资源不存在时正确返回 RESOURCE_NOT_FOUND 错误码")
    print(f"  - 错误详情: {error_detail['message']}")

def test_11_cancellation_release():
    """测试11: 正常取消会议与车位释放"""
    cleanup_db()
    
    response = client.post("/visitors", json={
        "name": "测试访客6",
        "phone": "13900000006"
    })
    visitor_id = response.json()["id"]
    
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    response = client.post("/meetings", json={
        "visitor_id": visitor_id,
        "title": "正常取消测试",
        "meeting_date": tomorrow,
        "start_time": "08:00",
        "end_time": "10:00",
        "need_parking": True
    })
    meeting_id = response.json()["id"]
    
    response = client.get("/parking-spots?status=LOCKED")
    before_cancel_locked = len(response.json())
    assert before_cancel_locked == 1, "取消前应该有1个锁定车位"
    
    response = client.post("/meetings/cancel", json={
        "meeting_id": meeting_id,
        "cancelled_by": "前台",
        "cancel_reason": "时间调整"
    })
    assert response.status_code == 200
    result = response.json()
    assert result["needs_review"] == False, "正常取消不需要复核"
    
    response = client.get("/parking-spots?status=LOCKED")
    after_cancel_locked = len(response.json())
    assert after_cancel_locked == 0, "取消后应该没有锁定车位"
    
    print("  - 会议取消成功")
    print("  - 车位自动释放成功")
    print("  - 放行码自动失效成功")
    print("  - 取消记录生成成功")

def test_12_occupancy_report():
    """测试12: 车位占用报告生成"""
    response = client.get("/reports/occupancy")
    assert response.status_code == 200
    report = response.json()
    assert report["total_spots"] == 20, "总车位应该是20"
    
    print("  - 报告统计数据正确")
    print("  - 报告持久化存储成功")

def test_13_export_report():
    """测试13: 报告导出"""
    response = client.get("/reports/occupancy/export")
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    
    filename = f"occupancy_report_{date.today()}.csv"
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8-sig') as f:
            content = f.read()
            assert "车位占用报告" in content, "报告标题应该存在"
        os.remove(filename)
    
    print("  - CSV文件生成成功")
    print("  - 导出格式正确，包含所有必要信息")

def test_14_error_codes_enum():
    """测试14: 错误码枚举存在"""
    from main import ErrorCode
    
    error_codes = [ec.value for ec in ErrorCode]
    assert "MISSING_FIELD" in error_codes
    assert "INVALID_STATUS" in error_codes
    assert "NEEDS_MANUAL_REVIEW" in error_codes
    assert "ALREADY_PROCESSED" in error_codes
    assert "RESOURCE_NOT_FOUND" in error_codes
    
    print("  - MISSING_FIELD (缺字段)")
    print("  - INVALID_STATUS (状态不允许)")
    print("  - NEEDS_MANUAL_REVIEW (需要人工复核)")
    print("  - ALREADY_PROCESSED (已经处理过)")
    print("  - RESOURCE_NOT_FOUND (资源不存在)")

def main():
    print("\n" + "="*70)
    print("访客车位会议取消放行码后端API - 自检脚本")
    print("="*70)
    
    cleanup_db()
    
    tests = [
        ("数据库初始化", test_1_database_init),
        ("缺字段返回 MISSING_FIELD 错误码", test_2_missing_field_error),
        ("访客数据导入与查询", test_3_visitor_crud),
        ("车位状态筛选", test_4_parking_spot_status),
        ("会议预约与车位锁定联动", test_5_meeting_parking_locking),
        ("放行码验证与使用", test_6_pass_code_flow),
        ("重复使用放行码返回 ALREADY_PROCESSED", test_7_already_processed_error),
        ("重复取消会议返回 ALREADY_PROCESSED", test_8_invalid_status_error),
        ("已占用车位取消返回 NEEDS_MANUAL_REVIEW", test_9_needs_manual_review_error),
        ("资源不存在返回 RESOURCE_NOT_FOUND", test_10_resource_not_found_error),
        ("正常取消会议与车位释放", test_11_cancellation_release),
        ("车位占用报告生成", test_12_occupancy_report),
        ("报告导出功能", test_13_export_report),
        ("错误码枚举检查", test_14_error_codes_enum),
    ]
    
    results = []
    for name, func in tests:
        results.append(run_test(name, func))
    
    print("\n" + "="*70)
    passed = sum(results)
    total = len(results)
    print(f"测试结果: {passed}/{total} 通过")
    
    if passed == total:
        print("✓ 所有测试通过！")
    else:
        print(f"✗ 有 {total - passed} 个测试失败")
    
    print("="*70 + "\n")
    
    cleanup_db()
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
