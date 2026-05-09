import sys
import os
from datetime import datetime, date, timedelta
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"


def req(method, path, data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    
    req = urllib.request.Request(url, data=body, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body_bytes = resp.read()
            return resp.status, json.loads(body_bytes.decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"raw": err_body}


def title(text):
    print()
    print("=" * 70)
    print(f"  {text}")
    print("=" * 70)


def step(idx, desc):
    print(f"\n--- 步骤 {idx}: {desc} ---")


def check_server():
    try:
        status, data = req("GET", "/health")
        return status == 200
    except Exception:
        return False


def demo_borrow_return_flow():
    title("主流程演示：器具完整借用-归还-校准-封存")
    
    step(1, "获取可用器具列表")
    status, data = req("GET", "/instruments?status=in_stock&limit=3")
    if status == 200:
        print(f"  找到 {len(data)} 个在库器具")
        for ins in data[:3]:
            print(f"    - {ins['code']} - {ins['name']} (ID: {ins['id']})")
    else:
        print(f"  错误: {data}")
        return
    
    available = data[0]
    inst_id = available["id"]
    
    step(2, "获取用户列表")
    status, users = req("GET", "/users")
    if status == 200:
        workshop_users = [u for u in users if u["role"] == "workshop_user"]
        print(f"  找到 {len(workshop_users)} 个车间用户")
        if workshop_users:
            borrower = workshop_users[0]
            print(f"  使用: {borrower['full_name']} (ID: {borrower['id']})")
        else:
            borrower = users[0]
            print(f"  使用: {borrower['full_name']} (ID: {borrower['id']})")
    else:
        print(f"  错误: {data}")
        return
    
    step(3, "创建借用")
    borrow_data = {
        "instrument_id": inst_id,
        "borrower_id": borrower["id"],
        "purpose": "演示流程-生产检测",
        "department": "演示一车间",
        "workshop": "机加工段",
        "work_order": "DEMO-2026-001",
        "borrow_date": date.today().isoformat(),
        "expected_return_date": (date.today() + timedelta(days=15)).isoformat(),
    }
    status, borrow = req("POST", "/borrows", borrow_data)
    if status == 201:
        print(f"  ✅ 借用创建成功，ID: {borrow['id']}")
        borrow_id = borrow["id"]
    else:
        print(f"  ❌ 借用失败: {data}")
        return
    
    step(4, "检查器具状态变化")
    status, inst = req("GET", f"/instruments/{inst_id}")
    if status == 200:
        print(f"  器具当前状态: {inst['status']}")
    
    step(5, "归还器具")
    return_data = {
        "return_date": (date.today() + timedelta(days=5)).isoformat(),
        "return_condition": "状态良好，无异常",
        "remarks": "演示流程结束",
    }
    status, borrow = req("POST", f"/borrows/{borrow_id}/return", return_data)
    if status == 200:
        print(f"  ✅ 归还成功，当前状态: {borrow['status']}")
    else:
        print(f"  ❌ 归还失败: {data}")
        return
    
    step(6, "检查器具恢复状态")
    status, inst = req("GET", f"/instruments/{inst_id}")
    if status == 200:
        print(f"  器具当前状态: {inst['status']}")
    
    step(7, "创建校准计划")
    cal_data = {
        "instrument_id": inst_id,
        "calibration_type": "定期校准",
        "scheduled_date": (date.today() + timedelta(days=1)).isoformat(),
        "calibration_agency": "内部计量室",
    }
    status, cal = req("POST", "/calibrations", cal_data)
    if status == 201:
        print(f"  ✅ 校准计划创建成功，ID: {cal['id']}")
        cal_id = cal["id"]
    else:
        print(f"  ❌ 校准计划失败: {data}")
        return
    
    step(8, "开始校准")
    status, cal = req("POST", f"/calibrations/{cal_id}/start", None)
    if status == 200:
        print(f"  ✅ 校准开始，状态: {cal['status']}")
    else:
        print(f"  ❌ 开始校准失败: {data}")
        return
    
    step(9, "完成校准（合格）")
    result_data = {
        "calibration_date": date.today().isoformat(),
        "result_pass": True,
        "certificate_number": "CERT-DEMO-2026-001",
        "remarks": "所有指标符合要求",
    }
    status, cal = req("POST", f"/calibrations/{cal_id}/complete", result_data)
    if status == 200:
        print(f"  ✅ 校准完成，状态: {cal['status']}")
    else:
        print(f"  ❌ 完成校准失败: {data}")
        return
    
    step(10, "提交封存审批申请")
    approval_data = {
        "approval_type": "seal",
        "instrument_id": inst_id,
        "reason": "校准周期到期，设备精度评估后需封存待复检",
    }
    status, approval = req("POST", "/approvals", approval_data)
    if status == 201:
        print(f"  ✅ 审批申请提交成功，单号: {approval['request_no']}")
        approval_id = approval["id"]
    else:
        print(f"  ❌ 审批申请失败: {approval}")
        return
    
    step(11, "审批通过")
    process_data = {
        "status": "approved",
        "approval_remark": "同意封存，记录完整",
    }
    status, approval = req("POST", f"/approvals/{approval_id}/process", process_data)
    if status == 200:
        print(f"  ✅ 审批完成，状态: {approval['status']}")
    else:
        print(f"  ❌ 审批失败: {data}")
        return
    
    step(12, "检查器具封存状态")
    status, inst = req("GET", f"/instruments/{inst_id}")
    if status == 200:
        print(f"  器具当前状态: {inst['status']}")
    
    step(13, "查看完整历史记录")
    status, history = req("GET", f"/instruments/{inst_id}/history")
    if status == 200:
        print(f"  历史记录 {len(history)} 条：")
        for i, h in enumerate(history[-5:], 1):
            print(f"    {i}. [{h['action']} - {h['action_description'][:60]}...")
    
    print()


def demo_overdue_notice_flow():
    title("异常演示：逾期催还流程")
    
    step(1, "查询逾期借用列表")
    status, data = req("GET", "/borrows/overdue")
    if status == 200:
        print(f"  找到 {len(data)} 条逾期记录")
        if data:
            overdue = data[0]
            overdue_id = overdue["id"]
            print(f"  逾期借用 ID: {overdue_id}")
        else:
            print("  无逾期记录")
            return
    else:
        print(f"  错误: {data}")
        return
    
    step(2, "发送逾期催还通知")
    status, notice = req("POST", f"/borrows/{overdue_id}/send-notice", None)
    if status == 200:
        print(f"  ✅ 催还通知发送成功")
        print(f"     借用人: {notice['borrower']}")
        print(f"     逾期天数: {notice['overdue_days']} 天")
        print(f"     通知次数: 第 {notice['notice_count']} 次")
    else:
        print(f"  ❌ 发送失败: {data}")
    
    print()


def demo_export_flow():
    title("台账导出演示")
    
    step(1, "导出完整台账")
    print("  GET /exports/ledger")
    print("  浏览器打开此 URL 可下载 Excel 台账文件")
    
    step(2, "查看统计概览")
    status, stats = req("GET", "/instruments/stats")
    if status == 200:
        print("  统计数据：")
        print(f"    总计器具数: {stats['total']}")
        print(f"    在库: {stats['status_counts'].get('in_stock', 0)}")
        print(f"    借出: {stats['status_counts'].get('borrowed', 0)}")
        print(f"    校准到期 (30天内): {stats['due_calibration']}")
        print(f"    校准逾期: {stats['overdue_calibration']}")
    
    print()


def main():
    print()
    print("=" * 70)
    print("  计量器具借用校准服务 - 主流程演示脚本")
    print("  请先启动服务后执行")
    print("=" * 70)
    
    if not check_server():
        print("\n⚠️  服务未启动，请先运行：")
        print("    python main.py  或者  uvicorn main:app --reload --port 8000")
        print()
        return
    
    print(f"\n✅ 服务连接正常")
    
    demo_borrow_return_flow()
    demo_overdue_notice_flow()
    demo_export_flow()
    
    title("演示完成")
    print()
    print("🎉  所有演示流程已执行完毕")
    print()
    print("📖  可访问 http://127.0.0.1:8000/docs 查看 API 文档")
    print()


if __name__ == "__main__":
    main()
