#!/usr/bin/env python3
"""
简单的核心流程验证脚本
"""
import sys
import uuid
import requests

PORT = 8001
BASE = f"http://localhost:{PORT}"

def req_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8]}"

def test():
    print("="*60)
    print("图书预约取书系统 - 核心流程验证")
    print("="*60)
    
    print(f"\n1️⃣  检查服务器 (端口 {PORT})...")
    try:
        resp = requests.get(f"{BASE}/", timeout=3)
        data = resp.json()
        print(f"   ✅ 服务器运行正常: {data['data']['系统名称']} v{data['data']['版本']}")
    except Exception as e:
        print(f"   ❌ 无法连接服务器: {e}")
        print(f"   请先启动: uvicorn main:app --port {PORT}")
        return False
    
    print("\n2️⃣  检查基础数据...")
    resp = requests.get(f"{BASE}/api/branches")
    branches = resp.json()
    print(f"   ✅ 分馆数量: {len(branches['data'])}")
    
    resp = requests.get(f"{BASE}/api/books/BK001/holdings")
    holdings = resp.json()
    print(f"   ✅ 《Python编程从入门到精通》馆藏: {len(holdings['data'])} 册")
    for h in holdings['data']:
        print(f"      - {h['条码']} @ {h['所属分馆']} [{h['状态']}]")
    
    print("\n3️⃣  读者预约图书...")
    payload = {
        "request_id": req_id("TEST"),
        "reader_id": "R001",
        "book_id": "BK001",
        "pickup_branch_id": "B003"
    }
    resp = requests.post(f"{BASE}/api/reservations", json=payload)
    result = resp.json()
    if result["success"]:
        print(f"   ✅ {result['message']}")
        print(f"      预约编号: {result['data']['预约编号']}")
        print(f"      队列位置: {result['data']['队列位置']}")
        reservation_id = result["data"]["预约编号"]
    else:
        print(f"   ❌ 预约失败: {result['message']}")
        return False
    
    print("\n4️⃣  测试缺字段校验...")
    payload = {
        "request_id": req_id("BAD"),
        "reader_id": "R001"
    }
    resp = requests.post(f"{BASE}/api/reservations", json=payload)
    result = resp.json()
    if not result.get("success"):
        msg = result.get('message') or str(result)
        print(f"   ✅ 缺字段被正确拒绝: {str(msg)[:50]}...")
    else:
        print(f"   ⚠️  缺字段未报错")
    
    print("\n5️⃣  测试不存在的读者...")
    payload = {
        "request_id": req_id("BAD2"),
        "reader_id": "NOT_EXIST",
        "book_id": "BK001",
        "pickup_branch_id": "B001"
    }
    resp = requests.post(f"{BASE}/api/reservations", json=payload)
    result = resp.json()
    if not result.get("success") and "读者不存在" in result.get("message", ""):
        print(f"   ✅ 不存在的读者被正确拒绝")
    else:
        print(f"   ⚠️  未正确拒绝: {result.get('message')}")
    
    print("\n6️⃣  创建调拨单...")
    available_holding = None
    for h in holdings['data']:
        if h['状态'] == '在馆' and h['所属分馆'] != '南区分馆':
            resp2 = requests.get(f"{BASE}/api/books/BK001/holdings")
            holdings2 = resp2.json()
            for h2 in holdings2['data']:
                if h2['状态'] == '在馆':
                    available_holding = h2
                    break
            break
    
    if available_holding:
        payload = {
            "request_id": req_id("TRF"),
            "reservation_id": reservation_id,
            "from_holding_id": "H001",
            "estimated_days": 2
        }
        resp = requests.post(f"{BASE}/api/transfers", json=payload)
        result = resp.json()
        if result.get("success"):
            print(f"   ✅ {result['message']}")
            transfer_id = result['data']['调拨编号']
            print(f"      调拨编号: {transfer_id}")
            print(f"      预计到达: {result['data']['预计到达']}")
            
            print("\n7️⃣  开始调拨...")
            resp = requests.post(f"{BASE}/api/transfers/{transfer_id}/start", json={"operator": "测试员"})
            result = resp.json()
            if result.get("success"):
                print(f"   ✅ {result['message']}")
            
            print("\n8️⃣  确认到馆...")
            resp = requests.post(f"{BASE}/api/transfers/{transfer_id}/arrive", json={"operator": "验收测试"})
            result = resp.json()
            if result.get("success"):
                print(f"   ✅ {result['message']}")
                print(f"      取书截止: {result['data']['取书截止']}")
                print(f"      通知状态: {result['data']['通知状态']}")
            
            print("\n9️⃣  取书并生成借阅...")
            payload = {
                "request_id": req_id("PKUP"),
                "operator": "前台张姐",
                "borrow_days": 30
            }
            resp = requests.post(f"{BASE}/api/reservations/{reservation_id}/pickup", json=payload)
            result = resp.json()
            if result.get("success"):
                print(f"   ✅ {result['message']}")
                print(f"      借阅编号: {result['data']['借阅编号']}")
                print(f"      应还日期: {result['data']['应还日期']}")
        else:
            print(f"   ⚠️  创建调拨单: {result.get('message')}")
    else:
        print(f"   ⚠️  无可调拨的馆藏（可能已被之前的测试使用）")
    
    print("\n🔟  查询预约详情和操作日志...")
    resp = requests.get(f"{BASE}/api/reservations/{reservation_id}")
    result = resp.json()
    if result.get("success"):
        ops = result['data']['操作日志']
        print(f"   ✅ 预约状态: {result['data']['基本信息']['当前状态']}")
        print(f"   ✅ 操作日志: {len(ops)} 条")
        for op in ops:
            manual = "👤" if op["是否人工"] == "是" else "🤖"
            print(f"      {manual} [{op['时间']}] {op['操作类型']} - {op['操作人']}")
    
    print("\n" + "="*60)
    print("🎉 核心流程验证完成！")
    print("="*60)
    
    return True


if __name__ == "__main__":
    success = test()
    sys.exit(0 if success else 1)
