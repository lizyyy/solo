#!/usr/bin/env python3
import os
import sys
import json
import subprocess
import time
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE_URL = "http://localhost:5000"


def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_pass(message):
    print(f"  ✓ PASS: {message}")


def print_fail(message):
    print(f"  ✗ FAIL: {message}")


def wait_for_server():
    print("\n等待服务器启动...", end="", flush=True)
    for i in range(30):
        try:
            requests.get(f"{BASE_URL}/api/waitlist", timeout=2)
            print(" 服务器已启动！")
            return True
        except:
            print(".", end="", flush=True)
            time.sleep(1)
    print("\n服务器启动超时！")
    return False


def run_acceptance_tests():
    print_section("图书馆活动组讲座候补入场系统 - 验收测试")

    print("\n[步骤1] 初始化数据库...")
    result = subprocess.run([sys.executable, "init_data.py"], capture_output=True, text=True)
    if result.returncode == 0:
        print_pass("数据库初始化成功")
    else:
        print_fail("数据库初始化失败")
        print(result.stderr)
        return

    print("\n[步骤2] 启动服务器...")
    server = subprocess.Popen(
        [sys.executable, "app.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    if not wait_for_server():
        server.terminate()
        return

    try:
        tests_passed = 0
        tests_total = 0

        print_section("测试1: 创建正常候补记录")
        tests_total += 1
        normal_record = {
            "lecture_id": "LIB-2024-001",
            "lecture_title": "人工智能在图书馆资源管理中的应用",
            "lecture_date": "2024-01-15T14:00:00",
            "lecture_venue": "图书馆三楼多功能厅",
            "reader_id": "R20240099",
            "reader_name": "测试用户",
            "reader_phone": "13800000099",
            "reader_department": "测试系",
            "waitlist_number": 99,
            "status": "waiting",
            "data_source": "system",
            "source_note": "验收测试创建"
        }
        response = requests.post(f"{BASE_URL}/api/waitlist", json=normal_record)
        if response.status_code == 201 and response.json()["success"]:
            print_pass("正常记录创建成功")
            created_id = response.json()["data"]["id"]
            tests_passed += 1
        else:
            print_fail(f"正常记录创建失败: {response.text}")

        print_section("测试2: 创建冲突记录（重复读者）")
        tests_total += 1
        duplicate_record = {
            "lecture_id": "LIB-2024-001",
            "lecture_title": "人工智能在图书馆资源管理中的应用",
            "lecture_date": "2024-01-15T14:00:00",
            "lecture_venue": "图书馆三楼多功能厅",
            "reader_id": "R20240001",
            "reader_name": "张明",
            "reader_phone": "13800138001",
            "waitlist_number": 10
        }
        response = requests.post(f"{BASE_URL}/api/waitlist", json=duplicate_record)
        result_data = response.json()
        if response.status_code == 400 and result_data["error"]["code"] == "DUPLICATE_READER":
            print_pass("重复读者冲突检测成功")
            print(f"    错误信息: {result_data['error']['message']}")
            tests_passed += 1
        else:
            print_fail(f"重复读者冲突检测失败")

        print_section("测试3: 创建冲突记录（候补序号重复）")
        tests_total += 1
        same_number_record = {
            "lecture_id": "LIB-2024-001",
            "lecture_title": "人工智能在图书馆资源管理中的应用",
            "lecture_date": "2024-01-15T14:00:00",
            "lecture_venue": "图书馆三楼多功能厅",
            "reader_id": "R20240098",
            "reader_name": "序号测试",
            "reader_phone": "13800000098",
            "waitlist_number": 1
        }
        response = requests.post(f"{BASE_URL}/api/waitlist", json=same_number_record)
        result_data = response.json()
        if response.status_code == 400 and result_data["error"]["code"] == "WAITLIST_ORDER_CONFLICT":
            print_pass("候补序号冲突检测成功")
            print(f"    错误信息: {result_data['error']['message']}")
            tests_passed += 1
        else:
            print_fail(f"候补序号冲突检测失败")

        print_section("测试4: 主办方手工放人")
        tests_total += 1
        response = requests.get(f"{BASE_URL}/api/waitlist")
        records = response.json()["data"]
        waiting_record = next((r for r in records if r["status"] == "waiting"), None)
        if waiting_record:
            admit_response = requests.post(
                f"{BASE_URL}/api/waitlist/{waiting_record['id']}/admit",
                json={"operator": "验收测试员", "remark": "主办方手工放人测试"}
            )
            admit_result = admit_response.json()
            if admit_response.status_code == 200 and admit_result["data"]["status"] == "admitted":
                print_pass("主办方手工放人成功")
                print(f"    入场类型: {admit_result['data']['admission_type']}")
                print(f"    操作人: {admit_result['data']['admission_operator']}")
                tests_passed += 1
            else:
                print_fail(f"主办方手工放人失败")

        print_section("测试5: 版本号乐观锁冲突检测")
        tests_total += 1
        response = requests.get(f"{BASE_URL}/api/waitlist")
        records = response.json()["data"]
        test_record = records[0]
        update_response = requests.put(
            f"{BASE_URL}/api/waitlist/{test_record['id']}",
            json={"version": 999, "reader_name": "错误版本"}
        )
        update_result = update_response.json()
        if update_response.status_code == 400 and update_result["error"]["code"] == "VERSION_MISMATCH":
            print_pass("版本号乐观锁冲突检测成功")
            print(f"    期望版本: {update_result['error']['details']['expected_version']}")
            print(f"    实际版本: {update_result['error']['details']['actual_version']}")
            tests_passed += 1
        else:
            print_fail(f"版本号乐观锁冲突检测失败")

        print_section("测试6: 批量导入（含正常、冲突、坏行）")
        tests_total += 1
        with open("test_import_data.json", "r", encoding="utf-8") as f:
            import_data = json.load(f)
        import_response = requests.post(f"{BASE_URL}/api/waitlist/import", json=import_data)
        import_result = import_response.json()
        if import_response.status_code == 200:
            summary = import_result["summary"]
            print_pass("批量导入接口调用成功")
            print(f"    总记录数: {summary['total']}")
            print(f"    成功数: {summary['success']}")
            print(f"    失败数: {summary['failed']}")
            print(f"    错误详情:")
            for err in import_result["errors"]:
                print(f"      第{err['row']}行: {err['error_code']} - {err['message']}")
            tests_passed += 1
        else:
            print_fail(f"批量导入接口调用失败")

        print_section("测试7: 导出数据与导入校验")
        tests_total += 1
        export_response = requests.get(f"{BASE_URL}/api/waitlist/export?lecture_id=LIB-2024-004")
        export_result = export_response.json()
        if export_response.status_code == 200 and export_result["success"]:
            print_pass("数据导出成功")
            print(f"    导出时间: {export_result['export_time']}")
            print(f"    导出记录数: {export_result['total_records']}")
            tests_passed += 1
        else:
            print_fail(f"数据导出失败")

        print_section("测试8: 入场名单一致性检查")
        tests_total += 1
        check_response = requests.get(f"{BASE_URL}/api/lectures/LIB-2024-001/waitlist/consistency-check")
        check_result = check_response.json()
        if check_response.status_code == 200:
            print_pass("一致性检查接口调用成功")
            print(f"    讲座ID: {check_result['lecture_id']}")
            print(f"    总记录数: {check_result['total_records']}")
            print(f"    一致性状态: {'一致 ✓' if check_result['consistent'] else '存在问题 ✗'}")
            if check_result["issues"]:
                print(f"    发现问题:")
                for issue in check_result["issues"]:
                    print(f"      - {issue['type']}: {issue['message']}")
            tests_passed += 1
        else:
            print_fail(f"一致性检查接口调用失败")

        print_section("测试9: 查询不存在的记录")
        tests_total += 1
        not_found_response = requests.get(f"{BASE_URL}/api/waitlist/99999")
        not_found_result = not_found_response.json()
        if not_found_response.status_code == 404 and not_found_result["error"]["code"] == "RECORD_NOT_FOUND":
            print_pass("不存在记录的错误返回正确")
            tests_passed += 1
        else:
            print_fail(f"不存在记录的错误返回不正确")

        print_section("测试10: 不能静默覆盖原记录验证")
        tests_total += 1
        original_response = requests.get(f"{BASE_URL}/api/waitlist/{created_id}")
        original_data = original_response.json()["data"]
        duplicate_import = {
            "operator": "覆盖测试",
            "records": [normal_record]
        }
        requests.post(f"{BASE_URL}/api/waitlist/import", json=duplicate_import)
        verify_response = requests.get(f"{BASE_URL}/api/waitlist/{created_id}")
        verify_data = verify_response.json()["data"]
        if verify_data["version"] == original_data["version"] and verify_data["source_note"] == original_data["source_note"]:
            print_pass("原记录未被静默覆盖")
            tests_passed += 1
        else:
            print_fail(f"原记录被意外覆盖")

        print_section("验收测试总结")
        print(f"\n  测试通过: {tests_passed}/{tests_total}")
        if tests_passed == tests_total:
            print("\n  ✓ 所有验收测试通过！系统功能正常。")
        else:
            print(f"\n  ✗ 有 {tests_total - tests_passed} 个测试未通过，请检查。")

    finally:
        print("\n停止服务器...")
        server.terminate()
        server.wait()
        print("服务器已停止。")


if __name__ == "__main__":
    run_acceptance_tests()
