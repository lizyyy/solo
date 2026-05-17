#!/usr/bin/env python3
import os
import sys
import json
import time
import subprocess
import requests
from pathlib import Path

BASE_URL = "http://localhost:8000"
TEST_DATA_DIR = Path(__file__).parent / "test_data"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_success(message):
    print(f"✅  {message}")


def print_error(message):
    print(f"❌  {message}")


def print_info(message):
    print(f"ℹ️  {message}")


def wait_for_server(max_wait=10):
    print_info("等待服务启动...")
    for i in range(max_wait):
        try:
            response = requests.get(f"{BASE_URL}/api/v1/health", timeout=1)
            if response.status_code == 200:
                print_success("服务已启动")
                return True
        except:
            pass
        time.sleep(1)
        print_info(f"  等待中... ({i+1}/{max_wait})")
    print_error("服务启动超时")
    return False


def test_health_check():
    print_section("健康检查测试")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print_success("健康检查通过")
                return True
        print_error("健康检查失败")
        return False
    except Exception as e:
        print_error(f"健康检查异常: {e}")
        return False


def test_import_inbound_orders():
    print_section("入库单导入测试")
    file_path = TEST_DATA_DIR / "inbound_orders.jsonl"
    try:
        with open(file_path, 'rb') as f:
            files = {'file': ('inbound_orders.jsonl', f, 'application/jsonl')}
            response = requests.post(
                f"{BASE_URL}/api/v1/import/inbound-orders",
                files=files,
                timeout=10
            )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("imported_count") == 3 and data.get("error_count") == 0:
                print_success(f"入库单导入成功: 导入 {data['imported_count']} 条")
                return True
            else:
                print_error(f"入库单导入结果异常: {data}")
                return False
        else:
            print_error(f"入库单导入失败: HTTP {response.status_code}")
            print_error(f"响应内容: {response.text}")
            return False
    except Exception as e:
        print_error(f"入库单导入异常: {e}")
        return False


def test_import_unpack_records():
    print_section("拆包记录导入测试")
    file_path = TEST_DATA_DIR / "unpack_records.jsonl"
    try:
        with open(file_path, 'rb') as f:
            files = {'file': ('unpack_records.jsonl', f, 'application/jsonl')}
            response = requests.post(
                f"{BASE_URL}/api/v1/import/unpack-records",
                files=files,
                timeout=10
            )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("imported_count") == 6 and data.get("error_count") == 0:
                print_success(f"拆包记录导入成功: 导入 {data['imported_count']} 条")
                return True
            else:
                print_error(f"拆包记录导入结果异常: {data}")
                return False
        else:
            print_error(f"拆包记录导入失败: HTTP {response.status_code}")
            print_error(f"响应内容: {response.text}")
            return False
    except Exception as e:
        print_error(f"拆包记录导入异常: {e}")
        return False


def test_import_outbound_orders():
    print_section("出库单导入测试")
    file_path = TEST_DATA_DIR / "outbound_orders.jsonl"
    try:
        with open(file_path, 'rb') as f:
            files = {'file': ('outbound_orders.jsonl', f, 'application/jsonl')}
            response = requests.post(
                f"{BASE_URL}/api/v1/import/outbound-orders",
                files=files,
                timeout=10
            )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("imported_count") == 8 and data.get("error_count") == 0:
                print_success(f"出库单导入成功: 导入 {data['imported_count']} 条")
                return True
            else:
                print_error(f"出库单导入结果异常: {data}")
                return False
        else:
            print_error(f"出库单导入失败: HTTP {response.status_code}")
            print_error(f"响应内容: {response.text}")
            return False
    except Exception as e:
        print_error(f"出库单导入异常: {e}")
        return False


def test_batch_trace():
    print_section("批号链路追踪测试")
    try:
        response = requests.get(
            f"{BASE_URL}/api/v1/batch/BATCH-2024-001/trace",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            batch_chain = data.get("batch_chain", [])
            if len(batch_chain) >= 5:
                print_success(f"批号链路追踪成功: 找到 {len(batch_chain)} 个相关批号")
                for node in batch_chain:
                    print_info(f"  - {node['batch_number']} (level {node['level']}, {node['quantity']} pcs)")
                return True
            else:
                print_error(f"批号链路追踪结果异常: {len(batch_chain)} 个批号")
                return False
        else:
            print_error(f"批号链路追踪失败: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_error(f"批号链路追踪异常: {e}")
        return False


def test_create_recall_task():
    print_section("批号召回任务创建测试")
    try:
        payload = {
            "batch_number": "BATCH-2024-001",
            "reason": "质量问题召回",
            "operator": "质检员A"
        }
        response = requests.post(
            f"{BASE_URL}/api/v1/recall",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            task_id = data.get("recall_task_id")
            total_qty = data.get("total_affected_quantity")
            total_customers = data.get("total_customers_affected")
            
            if total_qty >= 900 and total_customers >= 3:
                print_success(f"召回任务创建成功:")
                print_info(f"  任务ID: {task_id}")
                print_info(f"  受影响数量: {total_qty}")
                print_info(f"  受影响客户数: {total_customers}")
                
                destinations = data.get("customer_destinations", [])
                print_info(f"  客户去向列表:")
                for dest in destinations:
                    print_info(f"    - {dest['customer_name']} ({dest['customer_id']}): {dest['quantity']} pcs")
                
                return task_id
            else:
                print_error(f"召回任务数据异常")
                return None
        else:
            print_error(f"召回任务创建失败: HTTP {response.status_code}")
            print_error(f"响应内容: {response.text}")
            return None
    except Exception as e:
        print_error(f"召回任务创建异常: {e}")
        return None


def test_export_recall_report(task_id):
    print_section("召回报告导出测试")
    if not task_id:
        print_error("跳过（无有效任务ID）")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/v1/recall/{task_id}/report",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            report_file = Path(__file__).parent / "recall_report_output.json"
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            print_success(f"召回报告导出成功，已保存到 {report_file}")
            print_info(f"  报告包含 {len(data.get('reports', []))} 条追溯记录")
            return True
        else:
            print_error(f"召回报告导出失败: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_error(f"召回报告导出异常: {e}")
        return False


def test_error_missing_field():
    print_section("错误响应测试 - 缺字段")
    try:
        payload = {
            "batch_number": "",
            "reason": "测试"
        }
        response = requests.post(
            f"{BASE_URL}/api/v1/recall",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            detail = data.get("detail", {})
            if detail.get("error_code") == "missing_field":
                print_success(f"缺字段错误响应正确")
                print_info(f"  错误信息: {detail.get('message')}")
                return True
        print_error(f"缺字段错误响应异常: HTTP {response.status_code}")
        return False
    except Exception as e:
        print_error(f"缺字段测试异常: {e}")
        return False


def test_error_already_processed():
    print_section("错误响应测试 - 已处理")
    try:
        payload = {
            "batch_number": "BATCH-2024-001",
            "reason": "重复召回测试"
        }
        response = requests.post(
            f"{BASE_URL}/api/v1/recall",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 409:
            data = response.json()
            detail = data.get("detail", {})
            if detail.get("error_code") == "already_processed":
                print_success(f"已处理错误响应正确")
                print_info(f"  错误信息: {detail.get('message')}")
                return True
        print_error(f"已处理错误响应异常: HTTP {response.status_code}")
        return False
    except Exception as e:
        print_error(f"已处理测试异常: {e}")
        return False


def test_error_needs_manual_review():
    print_section("错误响应测试 - 需要人工复核")
    try:
        payload = {
            "batch_number": "NONEXISTENT-BATCH-999",
            "reason": "不存在的批号测试"
        }
        response = requests.post(
            f"{BASE_URL}/api/v1/recall",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 409:
            data = response.json()
            detail = data.get("detail", {})
            if detail.get("error_code") == "needs_manual_review":
                print_success(f"人工复核错误响应正确")
                print_info(f"  错误信息: {detail.get('message')}")
                return True
        print_error(f"人工复核错误响应异常: HTTP {response.status_code}")
        return False
    except Exception as e:
        print_error(f"人工复核测试异常: {e}")
        return False


def clean_database():
    db_file = Path(__file__).parent / "batch_recall.db"
    if db_file.exists():
        db_file.unlink()
        print_info("已清理旧数据库")


def main():
    print("\n" + "="*60)
    print("  批号召回拆包链路客户去向API - 自检脚本")
    print("="*60)
    
    clean_database()
    
    print_info("启动服务...")
    server_proc = subprocess.Popen(
        [sys.executable, "main.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=Path(__file__).parent
    )
    
    results = []
    
    try:
        if not wait_for_server():
            results.append(("服务启动", False))
            return
        
        results.append(("健康检查", test_health_check()))
        results.append(("入库单导入", test_import_inbound_orders()))
        results.append(("拆包记录导入", test_import_unpack_records()))
        results.append(("出库单导入", test_import_outbound_orders()))
        results.append(("批号链路追踪", test_batch_trace()))
        
        task_id = test_create_recall_task()
        results.append(("召回任务创建", task_id is not None))
        
        results.append(("召回报告导出", test_export_recall_report(task_id)))
        results.append(("错误响应-缺字段", test_error_missing_field()))
        results.append(("错误响应-已处理", test_error_already_processed()))
        results.append(("错误响应-人工复核", test_error_needs_manual_review()))
        
    finally:
        print_info("停止服务...")
        server_proc.terminate()
        server_proc.wait(timeout=5)
        
        print_section("测试结果汇总")
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "✅ 通过" if result else "❌ 失败"
            print(f"  {test_name:30s} {status}")
        
        print(f"\n总计: {passed}/{total} 测试通过")
        
        if passed == total:
            print_success("所有测试通过！")
            sys.exit(0)
        else:
            print_error(f"{total - passed} 个测试失败")
            sys.exit(1)


if __name__ == "__main__":
    main()
