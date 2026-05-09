#!/usr/bin/env python3
"""
教室设备报修派单服务 - 综合演示脚本

本脚本演示三种场景：
1. 正常处理流程 - 同教室三设备同时报修（投影、门禁、空调）
2. 异常拦截场景 - 演示非法状态流转被拦截
3. 重复操作防护 - 演示幂等性检查生效

运行方式：
1. 先启动服务：uvicorn app.main:app --reload --port 8000
2. 新开终端运行：python demo.py
"""

import sys
import time
import requests

BASE_URL = "http://localhost:8000/api/v1"


def print_separator(title=""):
    print()
    print("=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def print_response(label, response, indent=2):
    prefix = " " * indent
    print(f"{prefix}【{label}】")
    try:
        if response.status_code >= 400 and response.text:
            data = response.json()
            if isinstance(data, dict) and "detail" in data:
                data = data["detail"]
        else:
            data = response.json()
        if isinstance(data, dict):
            for key in ["success", "message", "code"]:
                if key in data:
                    print(f"{prefix}  {key}: {data[key]}")
            if "data" in data and data["data"]:
                d = data["data"]
                if isinstance(d, dict):
                    if "order_no" in d:
                        print(f"{prefix}  报修单号: {d['order_no']}")
                    if "classroom" in d:
                        print(f"{prefix}  教室: {d['classroom']}")
                    if "status_display" in d:
                        print(f"{prefix}  当前状态: {d['status_display']}")
                    if "priority" in d:
                        print(f"{prefix}  优先级: {d['priority']}")
                    if "priority_info" in data:
                        pi = data["priority_info"]
                        print(f"{prefix}  优先级说明: {pi.get('urgency_description', '')}")
                        print(f"{prefix}  故障等级: {pi.get('fault_level_name', '')}")
                elif isinstance(d, list):
                    print(f"{prefix}  包含 {len(d)} 条记录")
            if "advice" in data and data["advice"]:
                print(f"{prefix}  建议: {data['advice']}")
            if "concurrent_warning" in data and data["concurrent_warning"]:
                print(f"{prefix}  并发提示: {data['concurrent_warning']}")
    except Exception:
        print(f"{prefix}  状态码: {response.status_code}")
        print(f"{prefix}  内容: {response.text[:200]}")


def call_api(method, endpoint, json=None, params=None):
    url = f"{BASE_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            return requests.get(url, params=params)
        elif method.upper() == "POST":
            return requests.post(url, json=json, params=params)
    except requests.exceptions.ConnectionError:
        print("无法连接到服务器，请先运行：uvicorn app.main:app --port 8000")
        sys.exit(1)


def demo_normal_flow():
    """场景一：正常处理流程 - 同教室三设备同时报修"""
    print_separator("场景一：正常处理流程 - 教学楼A-301 三设备同时故障")

    print("\n【步骤 0】查看设备分类和维修人员")
    r = call_api("GET", "/categories")
    print_response("设备分类列表", r)
    r = call_api("GET", "/workers")
    print_response("维修人员列表", r)

    print("\n【步骤 1】创建三个报修单（同教室，三种设备）")
    orders = []

    r1 = call_api("POST", "/repair-orders", json={
        "classroom": "教学楼A-301",
        "device_category_code": "projector",
        "reported_by": "李老师",
        "reporter_phone": "13900000001",
        "fault_description": "投影画面偏色，灯泡闪烁",
        "fault_level": "urgent",
    })
    print_response("报修单1 - 投影仪（紧急）", r1)
    orders.append(r1.json()["data"]["id"])

    r2 = call_api("POST", "/repair-orders", json={
        "classroom": "教学楼A-301",
        "device_category_code": "access_control",
        "reported_by": "李老师",
        "reporter_phone": "13900000001",
        "fault_description": "门禁刷卡无反应，无法开门",
        "fault_level": "critical",
    })
    print_response("报修单2 - 门禁（最高级）", r2)
    orders.append(r2.json()["data"]["id"])

    r3 = call_api("POST", "/repair-orders", json={
        "classroom": "教学楼A-301",
        "device_category_code": "aircon",
        "reported_by": "李老师",
        "reporter_phone": "13900000001",
        "fault_description": "空调只出风不制冷",
        "fault_level": "normal",
    })
    print_response("报修单3 - 空调（普通）", r3)
    orders.append(r3.json()["data"]["id"])

    print("\n【步骤 2】查看待派单列表（按优先级排序）")
    r = call_api("GET", "/repair-orders", params={"status": "pending"})
    pending_data = r.json()
    print(f"  待派单共 {pending_data['count']} 条")
    for i, o in enumerate(pending_data["data"]):
        print(f"    {i+1}. 优先级{o['priority']} - {o['device_category_name']} - {o['order_no']}")

    print("\n【步骤 3】派单给对应专业的维修人员")
    r = call_api("POST", f"/repair-orders/{orders[0]}/assign", json={"assigned_to": "张师傅"}, params={"operator": "调度员"})
    print_response("派单1 - 投影仪给张师傅（投影设备专业）", r)

    r = call_api("POST", f"/repair-orders/{orders[1]}/assign", json={"assigned_to": "王师傅"}, params={"operator": "调度员"})
    print_response("派单2 - 门禁给王师傅（门禁系统专业）", r)

    r = call_api("POST", f"/repair-orders/{orders[2]}/assign", json={"assigned_to": "李师傅"}, params={"operator": "调度员"})
    print_response("派单3 - 空调给李师傅（空调制冷专业）", r)

    print("\n【步骤 4】维修人员开始现场维修（投影仪）")
    r = call_api("POST", f"/repair-orders/{orders[0]}/start", params={"operator": "张师傅"})
    print_response("张师傅开始维修投影仪", r)

    print("\n【步骤 5】维修过程中领用备件（投影灯泡）")
    r = call_api("POST", f"/repair-orders/{orders[0]}/spare-usage", json={
        "spare_part_code": "BULB-001",
        "quantity": 1,
        "used_by": "张师傅",
        "remark": "灯泡老化损坏，更换新灯泡",
    })
    print_response("领用投影灯泡", r)

    print("\n【步骤 6】完成维修，提交验收")
    r = call_api("POST", f"/repair-orders/{orders[0]}/complete", json={
        "completed_by": "张师傅",
        "solution": "更换投影灯泡，调整色彩参数，测试画面正常",
    })
    print_response("张师傅完成投影仪维修", r)

    print("\n【步骤 7】老师验收通过")
    r = call_api("POST", f"/repair-orders/{orders[0]}/accept", json={
        "accepted_by": "李老师",
        "result": "passed",
        "comment": "投影画面清晰，维修很及时",
    })
    print_response("李老师验收通过", r)

    print("\n【步骤 8】查看报修单详情（完整流程）")
    r = call_api("GET", f"/repair-orders/{orders[0]}")
    detail = r.json()["data"]
    print(f"  报修单号: {detail['order_no']}")
    print(f"  最终状态: {detail['status_display']}")
    print(f"  状态变更记录:")
    for log in detail["status_logs"]:
        from_s = log["from_status"] if log["from_status"] else "新建"
        print(f"    - {log['created_at']} | {from_s} → {log['to_status']} | {log['operator']}")
        if log["remark"]:
            print(f"      {log['remark']}")

    if detail["spare_usage"]:
        print(f"  备件使用:")
        for su in detail["spare_usage"]:
            print(f"    - {su['spare_part_name']} x{su['quantity']}{su['unit']} = ¥{su['total_price']:.2f}")

    return orders


def demo_exception_blocking():
    """场景二：异常拦截场景"""
    print_separator("场景二：非法状态流转拦截")

    print("\n【准备】创建一个新报修单")
    r = call_api("POST", "/repair-orders", json={
        "classroom": "教学楼B-101",
        "device_category_code": "lighting",
        "reported_by": "王老师",
        "fault_description": "教室后排两盏灯不亮",
        "fault_level": "low",
    })
    order_id = r.json()["data"]["id"]
    print_response("创建报修单", r)

    print("\n【异常拦截 1】状态：待派单 → 直接尝试完成维修")
    r = call_api("POST", f"/repair-orders/{order_id}/complete", json={
        "completed_by": "张师傅",
        "solution": "测试跳过派单",
    })
    print_response("非法流转拦截", r)

    print("\n【异常拦截 2】状态：待派单 → 尝试领用备件")
    r = call_api("POST", f"/repair-orders/{order_id}/spare-usage", json={
        "spare_part_code": "LAMP-001",
        "quantity": 2,
        "used_by": "张师傅",
    })
    print_response("备件领用拦截", r)

    print("\n【正常操作】先派单")
    r = call_api("POST", f"/repair-orders/{order_id}/assign", json={"assigned_to": "张师傅"})
    print_response("派单给张师傅", r)

    print("\n【异常拦截 3】状态：已派单 → 尝试直接验收")
    r = call_api("POST", f"/repair-orders/{order_id}/accept", json={
        "accepted_by": "王老师",
        "result": "passed",
    })
    print_response("验收拦截", r)

    print("\n【异常拦截 4】状态：已派单 → 尝试取消（正常可取消）")
    r = call_api("POST", f"/repair-orders/{order_id}/cancel", params={"reason": "已临时修复", "operator": "王老师"})
    print_response("取消报修（正常操作）", r)

    print("\n【异常拦截 5】状态：已取消 → 再次派单")
    r = call_api("POST", f"/repair-orders/{order_id}/assign", json={"assigned_to": "张师傅"})
    print_response("已取消后派单被拦截", r)

    return order_id


def demo_duplicate_protection():
    """场景三：重复操作防护"""
    print_separator("场景三：重复操作幂等性防护")

    print("\n【准备】创建新报修单并走完派单")
    r = call_api("POST", "/repair-orders", json={
        "classroom": "实验楼C-205",
        "device_category_code": "computer",
        "reported_by": "陈老师",
        "fault_description": "教师机频繁蓝屏重启",
        "fault_level": "urgent",
    })
    order_id = r.json()["data"]["id"]
    print_response("创建报修单", r)

    r = call_api("POST", f"/repair-orders/{order_id}/assign", json={"assigned_to": "张师傅"})
    print_response("派单给张师傅", r)

    print("\n【重复防护 1】连续派单两次")
    r = call_api("POST", f"/repair-orders/{order_id}/assign", json={"assigned_to": "张师傅"})
    print_response("重复派单拦截", r)

    print("\n【继续】张师傅开始维修")
    r = call_api("POST", f"/repair-orders/{order_id}/start", params={"operator": "张师傅"})
    print_response("开始维修", r)

    print("\n【继续】完成维修")
    r = call_api("POST", f"/repair-orders/{order_id}/complete", json={
        "completed_by": "张师傅",
        "solution": "重装系统，更新驱动，压力测试通过",
    })
    print_response("完成维修", r)

    print("\n【重复防护 2】再次提交完成")
    r = call_api("POST", f"/repair-orders/{order_id}/complete", json={
        "completed_by": "张师傅",
        "solution": "再次提交",
    })
    print_response("重复完成拦截", r)

    print("\n【继续】验收通过")
    r = call_api("POST", f"/repair-orders/{order_id}/accept", json={
        "accepted_by": "陈老师",
        "result": "passed",
    })
    print_response("验收通过", r)

    print("\n【重复防护 3】已验收后再次验收")
    r = call_api("POST", f"/repair-orders/{order_id}/accept", json={
        "accepted_by": "陈老师",
        "result": "passed",
    })
    print_response("终态重复操作拦截", r)

    print("\n【重复防护 4】已验收后尝试取消")
    r = call_api("POST", f"/repair-orders/{order_id}/cancel", params={"reason": "测试"})
    print_response("终态取消拦截", r)

    return order_id


def demo_statistics():
    """场景四：查看校园统计"""
    print_separator("场景四：校园统计概览")

    r = call_api("GET", "/statistics/campus")
    data = r.json()["data"]

    print("\n【报修单概览】")
    ov = data["overview"]
    print(f"  累计报修: {ov['total_reports']} 单")
    print(f"  待派单: {ov['pending_assign']}")
    print(f"  维修中: {ov['in_progress']}")
    print(f"  待验收: {ov['pending_acceptance']}")
    print(f"  已验收通过: {ov['accepted']}")

    print("\n【效率分析】")
    eff = data["efficiency"]
    print(f"  {eff['description']}")

    print("\n【成本分析】")
    print(f"  {data['cost']['description']}")

    print("\n【设备分类统计】")
    for cat in data["category_breakdown"]:
        print(f"  - {cat['category_name']}: {cat['total_count']} 单，完成 {cat['completed_count']}，完成率 {cat['completion_rate']}")

    if data["classroom_hotspots"]:
        print("\n【高频问题教室】")
        for cr in data["classroom_hotspots"]:
            print(f"  - {cr['classroom']}: {cr['description']}")


def main():
    print("\n" + "#" * 70)
    print("#" + " " * 68 + "#")
    print("#" + "  教室设备报修派单服务 - 综合演示脚本".center(68) + "#")
    print("#" + " " * 68 + "#")
    print("#" * 70)

    try:
        demo_normal_flow()
        demo_exception_blocking()
        demo_duplicate_protection()
        demo_statistics()

        print_separator("演示完成")
        print("\n🎉 所有场景演示完毕！")
        print("\n📋 总结：")
        print("  ✅ 场景一：同教室三设备报修 - 优先级正确、派单规则生效")
        print("  ✅ 场景二：非法状态流转 - 全部拦截并给出业务化错误原因")
        print("  ✅ 场景三：重复操作防护 - 幂等性检查生效，状态不会写乱")
        print("  ✅ 场景四：校园统计 - 概览、效率、成本、热点教室完整呈现")
        print("\n📚 接口文档：http://localhost:8000/docs")

    except KeyboardInterrupt:
        print("\n\n演示中断")
    except Exception as e:
        print(f"\n❌ 演示出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
