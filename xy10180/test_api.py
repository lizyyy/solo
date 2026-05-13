#!/usr/bin/env python3
import httpx
import time
import sys
import json
from datetime import datetime, date, timedelta
from typing import Optional

BASE_URL = "http://127.0.0.1:8000"
timeout = httpx.Timeout(10.0)

passed = 0
failed = 0


def print_header(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_success(msg):
    global passed
    passed += 1
    print(f"  ✓ {msg}")


def print_failure(msg):
    global failed
    failed += 1
    print(f"  ✗ {msg}")


def print_section(title):
    print(f"\n  --- {title} ---")


def wait_for_server(max_retries=30):
    print("等待服务器启动...")
    for i in range(max_retries):
        try:
            with httpx.Client(timeout=timeout) as client:
                r = client.get(f"{BASE_URL}/health")
                if r.status_code == 200:
                    print("服务器已就绪!\n")
                    return True
        except httpx.ConnectError:
            pass
        time.sleep(1)
    print("服务器启动超时!")
    return False


class APIClient:
    def __init__(self):
        self.client = httpx.Client(timeout=timeout)
    
    def close(self):
        self.client.close()
    
    def post(self, path, json_data=None):
        return self.client.post(f"{BASE_URL}{path}", json=json_data)
    
    def get(self, path):
        return self.client.get(f"{BASE_URL}{path}")
    
    def put(self, path, json_data=None):
        return self.client.put(f"{BASE_URL}{path}", json=json_data)


def test_normal_flow():
    print_header("正常路径测试")
    
    client = APIClient()
    try:
        print_section("1. 创建设备")
        r = client.post("/devices/", {
            "name": "数控机床 A-101",
            "model": "CNC-2000",
            "serial_number": "CNC-2026-001",
            "total_hours": 0,
            "total_count": 0
        })
        assert r.status_code == 200, f"创建设备失败: {r.text}"
        device = r.json()
        device_id = device["id"]
        print_success(f"创建设备成功, ID: {device_id}")
        
        print_section("2. 创建库存配件")
        r = client.post("/inventory/", {
            "part_code": "FILTER-001",
            "part_name": "空气过滤器",
            "total_quantity": 10
        })
        assert r.status_code == 200
        print_success("创建库存配件: 空气过滤器 (10个)")
        
        r = client.post("/inventory/", {
            "part_code": "OIL-001",
            "part_name": "润滑油",
            "total_quantity": 5
        })
        assert r.status_code == 200
        print_success("创建库存配件: 润滑油 (5个)")
        
        r = client.get("/inventory/")
        assert r.status_code == 200
        inventory = r.json()
        print_success(f"当前库存数量: {len(inventory)}")
        
        print_section("3. 创建保养规则")
        tomorrow_ts = int((datetime.now() + timedelta(days=1)).timestamp())
        
        r = client.post("/rules/", {
            "device_id": device_id,
            "name": "每500小时保养",
            "rule_type": "hours",
            "threshold_value": 500,
            "description": "设备运行500小时后需要定期保养",
            "parts": [
                {"part_name": "空气过滤器", "part_code": "FILTER-001", "quantity": 1}
            ]
        })
        assert r.status_code == 200, f"创建规则失败: {r.text}"
        rule_hours = r.json()
        rule_hours_id = rule_hours["id"]
        print_success(f"创建按小时规则成功, ID: {rule_hours_id}")
        
        r = client.post("/rules/", {
            "device_id": device_id,
            "name": "每1000次保养",
            "rule_type": "count",
            "threshold_value": 1000,
            "description": "设备运行1000次后需要定期保养",
            "parts": [
                {"part_name": "润滑油", "part_code": "OIL-001", "quantity": 1}
            ]
        })
        assert r.status_code == 200
        rule_count = r.json()
        rule_count_id = rule_count["id"]
        print_success(f"创建按次数规则成功, ID: {rule_count_id}")
        
        r = client.get(f"/rules/device/{device_id}")
        assert r.status_code == 200
        rules = r.json()
        print_success(f"设备关联规则数量: {len(rules)}")
        
        print_section("4. 检查保养触发（未达到阈值）")
        r = client.post("/maintenance/check", {
            "device_id": device_id,
            "current_hours": 100,
            "current_count": 500
        })
        assert r.status_code == 200
        result = r.json()
        assert result["has_triggered"] == False
        print_success(f"阈值未达到, 无保养触发 (hours=100, count=500)")
        
        print_section("5. 检查保养触发（达到阈值）")
        r = client.post("/maintenance/check", {
            "device_id": device_id,
            "current_hours": 600,
            "current_count": 500
        })
        assert r.status_code == 200
        result = r.json()
        assert result["has_triggered"] == True
        triggered_rules = result["triggered_rules"]
        assert len(triggered_rules) == 1
        assert triggered_rules[0]["rule_id"] == rule_hours_id
        print_success(f"小时数达到阈值, 触发保养规则: {triggered_rules[0]['rule_name']}")
        
        print_section("6. 生成保养工单（幂等测试 - 第一次）")
        due_date = (date.today() + timedelta(days=7)).isoformat()
        r = client.post("/maintenance/trigger", {
            "device_id": device_id,
            "rule_id": rule_hours_id,
            "trigger_value": 600,
            "due_date": due_date,
            "description": "定期保养 - 小时数达到500"
        })
        assert r.status_code == 200
        order1 = r.json()
        order_id = order1["id"]
        order_no = order1["order_no"]
        print_success(f"第一次生成工单, ID: {order_id}, 工单号: {order_no}")
        
        print_section("7. 生成保养工单（幂等测试 - 第二次，相同参数）")
        r = client.post("/maintenance/trigger", {
            "device_id": device_id,
            "rule_id": rule_hours_id,
            "trigger_value": 600,
            "due_date": due_date,
            "description": "定期保养 - 小时数达到500"
        })
        assert r.status_code == 200
        order2 = r.json()
        assert order2["id"] == order_id, f"幂等失败: 生成了新工单 {order2['id']}"
        print_success(f"第二次调用返回同一工单, ID: {order2['id']} (幂等性验证通过)")
        
        print_section("8. 检查配件占用")
        r = client.get(f"/orders/{order_id}")
        assert r.status_code == 200
        order_detail = r.json()
        assert len(order_detail["parts"]) == 1
        assert order_detail["parts"][0]["is_reserved"] == 1
        print_success(f"工单已占用配件: {order_detail['parts'][0]['part_name']} x{order_detail['parts'][0]['quantity']}")
        
        r = client.get("/inventory/")
        assert r.status_code == 200
        inventory_after = r.json()
        filter_inv = next((i for i in inventory_after if i["part_code"] == "FILTER-001"), None)
        assert filter_inv["reserved_quantity"] == 1
        assert filter_inv["available_quantity"] == 9
        print_success(f"库存已预留: FILTER-001, 预留:1, 可用:9")
        
        print_section("9. 更新工单状态: 进行中")
        r = client.put(f"/orders/{order_id}/status", {
            "status": "in_progress",
            "note": "技术员开始保养工作"
        })
        assert r.status_code == 200
        order_updated = r.json()
        assert order_updated["status"] == "in_progress"
        print_success(f"工单状态更新为: 进行中")
        
        print_section("10. 完成工单并释放/扣减库存")
        r = client.put(f"/orders/{order_id}/status", {
            "status": "completed",
            "completion_note": "保养完成，更换过滤器，设备运行正常"
        })
        assert r.status_code == 200
        order_completed = r.json()
        assert order_completed["status"] == "completed"
        assert order_completed["completed_at"] is not None
        print_success(f"工单已完成")
        
        r = client.get("/inventory/")
        assert r.status_code == 200
        inventory_final = r.json()
        filter_inv_final = next((i for i in inventory_final if i["part_code"] == "FILTER-001"), None)
        assert filter_inv_final["total_quantity"] == 9
        assert filter_inv_final["reserved_quantity"] == 0
        print_success(f"工单完成后库存扣减: FILTER-001, 总数:9, 预留:0")
        
        print_section("11. 查看工单历史记录")
        r = client.get(f"/orders/{order_id}/history")
        assert r.status_code == 200
        history = r.json()
        assert len(history) >= 3
        print_success(f"工单历史记录条数: {len(history)}")
        for h in history:
            print(f"      - {h['action']}: {h['from_status']} -> {h['to_status']}")
        
        print_section("12. 生成第二周期保养工单")
        r = client.post("/maintenance/trigger", {
            "device_id": device_id,
            "rule_id": rule_hours_id,
            "trigger_value": 1100,
            "description": "第二周期保养"
        })
        assert r.status_code == 200
        order3 = r.json()
        assert order3["id"] != order_id
        print_success(f"第二周期工单创建成功, ID: {order3['id']}")
        
        print_section("13. 取消工单并释放配件")
        r = client.put(f"/orders/{order3['id']}/status", {
            "status": "cancelled",
            "note": "保养计划变更，取消此工单"
        })
        assert r.status_code == 200
        order_cancelled = r.json()
        assert order_cancelled["status"] == "cancelled"
        print_success(f"工单已取消")
        
        r = client.get("/inventory/")
        assert r.status_code == 200
        inv_cancel = r.json()
        filter_cancel = next((i for i in inv_cancel if i["part_code"] == "FILTER-001"), None)
        assert filter_cancel["reserved_quantity"] == 0
        print_success(f"取消工单后配件已释放, 预留数量: 0")
        
        print_section("14. 创建按日期触发的保养规则")
        yesterday_ts = int((datetime.now() - timedelta(days=1)).timestamp())
        r = client.post("/rules/", {
            "device_id": device_id,
            "name": "每月定期保养",
            "rule_type": "date",
            "threshold_value": yesterday_ts,
            "description": "每月固定日期保养"
        })
        assert r.status_code == 200
        rule_date = r.json()
        print_success(f"创建按日期规则成功, ID: {rule_date['id']}, 规则类型: {rule_date['rule_type']}")
        
        print_section("15. PENDING 工单可直接完成（无需经过 IN_PROGRESS）")
        r = client.post("/maintenance/trigger", {
            "device_id": device_id,
            "rule_id": rule_count_id,
            "trigger_value": 1500,
            "description": "快速完成测试"
        })
        assert r.status_code == 200
        order_quick = r.json()
        order_quick_id = order_quick["id"]
        assert order_quick["status"] == "pending"
        print_success(f"创建待处理工单, ID: {order_quick_id}")
        
        r = client.put(f"/orders/{order_quick_id}/status", {
            "status": "completed",
            "completion_note": "快速完成保养"
        })
        assert r.status_code == 200
        order_quick_done = r.json()
        assert order_quick_done["status"] == "completed"
        print_success(f"PENDING 直接转为 COMPLETED 成功")
        
    finally:
        client.close()


def test_exception_flow():
    print_header("异常路径测试")
    
    client = APIClient()
    try:
        print_section("1. 查询不存在的设备")
        r = client.get("/devices/99999")
        assert r.status_code == 404
        print_success("查询不存在的设备返回 404")
        
        print_section("2. 为不存在的设备创建规则")
        r = client.post("/rules/", {
            "device_id": 99999,
            "name": "测试规则",
            "rule_type": "hours",
            "threshold_value": 100
        })
        assert r.status_code == 400
        print_success("为不存在设备创建规则返回 400")
        
        print_section("3. 使用不存在的规则触发工单")
        r = client.post("/devices/", {
            "name": "测试设备B",
            "serial_number": "TEST-B-001",
            "total_hours": 0,
            "total_count": 0
        })
        device_b = r.json()
        
        r = client.post("/maintenance/trigger", {
            "device_id": device_b["id"],
            "rule_id": 99999,
            "trigger_value": 100
        })
        assert r.status_code == 400
        print_success("使用不存在的规则触发工单返回 400")
        
        print_section("4. 查询不存在的工单")
        r = client.get("/orders/99999")
        assert r.status_code == 404
        print_success("查询不存在的工单返回 404")
        
        print_section("5. 无效的状态转换: 已完成 -> 进行中")
        r = client.post("/devices/", {
            "name": "测试设备C",
            "serial_number": "TEST-C-001",
            "total_hours": 600,
            "total_count": 0
        })
        device_c = r.json()
        
        r = client.post("/rules/", {
            "device_id": device_c["id"],
            "name": "测试规则C",
            "rule_type": "hours",
            "threshold_value": 500
        })
        rule_c = r.json()
        
        r = client.post("/maintenance/trigger", {
            "device_id": device_c["id"],
            "rule_id": rule_c["id"],
            "trigger_value": 600
        })
        order_c = r.json()
        
        r = client.put(f"/orders/{order_c['id']}/status", {
            "status": "completed"
        })
        assert r.status_code == 200
        
        r = client.put(f"/orders/{order_c['id']}/status", {
            "status": "in_progress"
        })
        assert r.status_code == 400
        print_success("无效状态转换返回 400")
        
        print_section("6. 延期已完成的工单")
        r = client.post(f"/orders/{order_c['id']}/delay", {
            "new_due_date": (date.today() + timedelta(days=14)).isoformat(),
            "reason": "测试延期已完成工单"
        })
        assert r.status_code == 400
        print_success("延期已完成工单返回 400")
        
        print_section("7. 库存不足时创建工单")
        r = client.post("/devices/", {
            "name": "测试设备D",
            "serial_number": "TEST-D-001",
            "total_hours": 1000,
            "total_count": 0
        })
        device_d = r.json()
        
        r = client.post("/rules/", {
            "device_id": device_d["id"],
            "name": "稀缺配件保养",
            "rule_type": "hours",
            "threshold_value": 500,
            "parts": [
                {"part_name": "稀缺配件", "part_code": "RARE-001", "quantity": 5}
            ]
        })
        rule_d = r.json()
        
        r = client.post("/maintenance/trigger", {
            "device_id": device_d["id"],
            "rule_id": rule_d["id"],
            "trigger_value": 1000
        })
        assert r.status_code == 400
        assert "库存不足" in r.json()["detail"]
        print_success("库存不足时触发工单返回 400")
        
        print_section("8. 延期日期早于原始截止日期")
        r = client.post("/devices/", {
            "name": "测试设备E",
            "serial_number": "TEST-E-001",
            "total_hours": 600,
            "total_count": 0
        })
        device_e = r.json()
        
        r = client.post("/rules/", {
            "device_id": device_e["id"],
            "name": "测试规则E",
            "rule_type": "hours",
            "threshold_value": 500
        })
        rule_e = r.json()
        
        r = client.post("/maintenance/trigger", {
            "device_id": device_e["id"],
            "rule_id": rule_e["id"],
            "trigger_value": 600
        })
        order_e = r.json()
        
        r = client.post(f"/orders/{order_e['id']}/delay", {
            "new_due_date": (date.today() - timedelta(days=1)).isoformat()
        })
        assert r.status_code == 400
        print_success("延期日期早于原始截止日期返回 400")
        
        print_section("9. 延期正确流程")
        new_due = (date.today() + timedelta(days=14)).isoformat()
        r = client.post(f"/orders/{order_e['id']}/delay", {
            "new_due_date": new_due,
            "reason": "配件采购延迟"
        })
        assert r.status_code == 200
        order_delayed = r.json()
        assert order_delayed["status"] == "delayed"
        assert order_delayed["delay_count"] == 1
        print_success(f"工单延期成功, 状态: {order_delayed['status']}, 延期次数: {order_delayed['delay_count']}")
        
        print_section("10. 延期后重新开始工作")
        r = client.put(f"/orders/{order_e['id']}/status", {
            "status": "in_progress",
            "note": "配件已到位，开始保养"
        })
        assert r.status_code == 200
        order_restart = r.json()
        assert order_restart["status"] == "in_progress"
        print_success(f"延期工单可恢复工作, 状态: {order_restart['status']}")
        
        print_section("11. 创建重复配件编码")
        r = client.post("/inventory/", {
            "part_code": "FILTER-001",
            "part_name": "重复测试",
            "total_quantity": 1
        })
        assert r.status_code == 400
        print_success("创建重复配件编码返回 400")
        
        print_section("12. 延期工单存在时用不同 trigger_value 触发（幂等验证）")
        r = client.post("/devices/", {
            "name": "测试设备F",
            "serial_number": "TEST-F-001",
            "total_hours": 600,
            "total_count": 0
        })
        device_f = r.json()
        
        r = client.post("/rules/", {
            "device_id": device_f["id"],
            "name": "测试规则F",
            "rule_type": "hours",
            "threshold_value": 500
        })
        rule_f = r.json()
        
        r = client.post("/maintenance/trigger", {
            "device_id": device_f["id"],
            "rule_id": rule_f["id"],
            "trigger_value": 600
        })
        order_f = r.json()
        order_f_id = order_f["id"]
        print_success(f"创建工单, ID: {order_f_id}")
        
        new_due_f = (date.today() + timedelta(days=14)).isoformat()
        r = client.post(f"/orders/{order_f_id}/delay", {
            "new_due_date": new_due_f,
            "reason": "延期测试"
        })
        assert r.status_code == 200
        order_f_delayed = r.json()
        assert order_f_delayed["status"] == "delayed"
        print_success(f"工单已延期, 状态: delayed")
        
        r = client.post("/maintenance/trigger", {
            "device_id": device_f["id"],
            "rule_id": rule_f["id"],
            "trigger_value": 700
        })
        assert r.status_code == 200
        order_f_retrigger = r.json()
        assert order_f_retrigger["id"] == order_f_id, f"幂等失败: 延期工单存在时生成了新工单 {order_f_retrigger['id']}"
        print_success(f"延期工单存在时用不同 trigger_value 触发, 返回原工单 ID 相同 (幂等验证通过)")
        
    finally:
        client.close()


def test_report():
    print_header("报表功能测试")
    
    client = APIClient()
    try:
        print_section("1. 创建一个带过期日期规则的设备用于报表验证")
        yesterday_ts = int((datetime.now() - timedelta(days=1)).timestamp())
        
        r = client.post("/devices/", {
            "name": "报表测试设备",
            "serial_number": "REPORT-TEST-001",
            "total_hours": 0,
            "total_count": 0
        })
        assert r.status_code == 200
        device_report = r.json()
        
        r = client.post("/rules/", {
            "device_id": device_report["id"],
            "name": "月度保养(已过期)",
            "rule_type": "date",
            "threshold_value": yesterday_ts,
            "description": "已过期的日期规则"
        })
        assert r.status_code == 200
        print_success(f"创建报表测试设备和过期日期规则")
        
        print_section("2. 获取汇总报表")
        r = client.get("/report/summary")
        assert r.status_code == 200
        report = r.json()
        print(f"      总工单数: {report['total_orders']}")
        print(f"      待处理: {report['pending_count']}")
        print(f"      进行中: {report['in_progress_count']}")
        print(f"      已完成: {report['completed_count']}")
        print(f"      已延期: {report['delayed_count']}")
        print(f"      已取消: {report['cancelled_count']}")
        print_success("报表获取成功")
        
        print_section("3. 验证日期规则出现在待保养设备列表中")
        devices_needing = report.get("devices_needing_maintenance", [])
        print(f"      需要保养的设备数: {len(devices_needing)}")
        
        date_rules_in_report = [d for d in devices_needing if d.get("rule_type") == "date"]
        print(f"      日期类型的待保养规则数: {len(date_rules_in_report)}")
        
        for d in devices_needing:
            print(f"      - {d['device_name']}: {d['rule_name']} ({d['rule_type']})")
        
        assert len(date_rules_in_report) >= 1, "日期规则未出现在待保养设备列表中"
        print_success("日期规则正确出现在待保养设备列表中")
        
    finally:
        client.close()


def main():
    print_header("设备保养计划 API - 接口验证脚本")
    
    if not wait_for_server():
        print("\n请先启动服务器:")
        print("  chmod +x start_server.sh")
        print("  ./start_server.sh")
        sys.exit(1)
    
    try:
        test_normal_flow()
        test_exception_flow()
        test_report()
    except AssertionError as e:
        print_failure(f"测试断言失败: {e}")
        import traceback
        traceback.print_exc()
    except Exception as e:
        print_failure(f"测试执行异常: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("  测试结果汇总")
    print("=" * 60)
    print(f"  通过: {passed}")
    print(f"  失败: {failed}")
    print("=" * 60)
    
    if failed > 0:
        sys.exit(1)
    print("\n所有测试通过! ✓")
    sys.exit(0)


if __name__ == "__main__":
    main()
