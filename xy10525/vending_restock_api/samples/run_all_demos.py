#!/usr/bin/env python3
import requests
import sys
import time

BASE_URL = "http://localhost:8000"


def wait_for_server(max_wait=30):
    print("等待服务启动...")
    for i in range(max_wait):
        try:
            response = requests.get(f"{BASE_URL}/", timeout=2)
            if response.status_code == 200:
                print(f"服务已启动: {response.json()['name']}")
                return True
        except:
            pass
        time.sleep(1)
    print("服务启动超时")
    return False


def reset_database():
    print("\n重置数据库...")
    response = requests.post(f"{BASE_URL}/api/samples/reset")
    print(f"重置状态: {response.status_code}")
    time.sleep(0.5)
    
    print("\n初始化样例数据...")
    response = requests.post(f"{BASE_URL}/api/samples/init")
    data = response.json()
    print(f"初始化状态: {data['success']}")
    print(f"机器: {data['data']['machines']} 台")
    print(f"商品: {data['data']['products']} 种")
    print(f"库存记录: {data['data']['inventories']} 条")
    print(f"故障记录: {data['data']['faults']} 条")


def run_all_demos():
    from samples.demo_normal_restock import run_normal_restock_demo
    from samples.demo_capacity_split import run_capacity_split_demo
    from samples.demo_expiry_recovery import run_expiry_recovery_demo
    from samples.demo_fault_interrupt import run_fault_interrupt_demo
    from samples.demo_failure_path import run_failure_demo
    
    if not wait_for_server():
        sys.exit(1)
    
    print("\n" + "="*70)
    print("开始执行所有演示脚本")
    print("="*70)
    
    demos = [
        ("DEMO 1: 正常补货流程", run_normal_restock_demo),
        ("DEMO 2: 容量不足拆分", run_capacity_split_demo),
        ("DEMO 3: 临期商品回收", run_expiry_recovery_demo),
        ("DEMO 4: 故障插单", run_fault_interrupt_demo),
        ("DEMO 5: 失败路径与异常处理", run_failure_demo),
    ]
    
    results = []
    for name, demo_func in demos:
        try:
            print(f"\n\n{'#'*70}")
            print(f"# {name}")
            print(f"{'#'*70}")
            result = demo_func()
            results.append((name, "SUCCESS" if result else "FAILED"))
        except Exception as e:
            print(f"异常: {e}")
            results.append((name, f"ERROR: {e}"))
    
    print("\n" + "="*70)
    print("所有演示执行结果")
    print("="*70)
    for name, result in results:
        status = "✓" if "SUCCESS" in result else "✗"
        print(f"{status} {name}: {result}")
    
    print("\n生成最终报告...")
    response = requests.get(f"{BASE_URL}/api/reports/daily")
    report = response.json()
    
    print(f"\n日报摘要:")
    print(f"  日期: {report['report_date']}")
    print(f"  路线: {report['completed_routes']}/{report['total_routes']}")
    print(f"  任务: {report['completed_tasks']}/{report['total_tasks']}")
    print(f"  补货: {report['total_quantity_restocked']} 件")
    print(f"  回收: {report['total_quantity_recovered']} 件")
    print(f"  缺货风险: {len(report['stockout_risks'])} 项")
    print(f"  临期回收: {len(report['recovery_items'])} 项")
    print(f"  执行差异: {len(report['execution_diffs'])} 项")
    print(f"  未解决故障: {len(report['unresolved_faults'])} 项")


if __name__ == "__main__":
    reset_database()
    run_all_demos()
