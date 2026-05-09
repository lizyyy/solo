#!/usr/bin/env python3
"""
图书预约取书 API - 自然语言验收点

用业务语言描述的验收标准，方便非开发人员理解和验证。
"""

ACCEPTANCE_CRITERIA = """
================================================================================
                      图书预约取书系统 验收点
================================================================================

一、主流程验收（预约 → 调拨 → 到馆 → 取书 → 借阅）
────────────────────────────────────────────────────────────────────────────────

✅ 【创建预约】
   当：读者张三在 APP 上预约《Python编程从入门到精通》，选择到南区分馆取书
   则：系统显示「预约成功，您排在第 1 位」
   并：张三可以在「我的预约」里看到这条预约，状态是「待调拨」

✅ 【创建调拨单】
   当：管理员选择从总馆调出该书的一个馆藏
   则：系统生成调拨单，状态是「等待发出」
   并：原馆藏状态从「在馆」变为「调拨锁定」

✅ 【开始调拨】
   当：物流人员扫码确认发出
   则：调拨单状态变为「运输中」
   并：预约状态变为「调拨中」

✅ 【确认到馆】
   当：南区分馆馆员扫码确认收到图书
   则：调拨单状态变为「已到达」
   并：预约状态变为「已到馆」
   并：自动给张三发短信：「您预约的《Python编程从入门到精通》已到达南区分馆，
       请于 7 天内到馆取书」
   并：显示「取书截止日期」为到馆日期 + 7 天

✅ 【取书借阅】
   当：张三到馆出示预约码，馆员确认取书
   则：预约状态变为「已取书」
   并：自动生成借阅记录，借阅期限 30 天
   并：馆藏状态变为「借出」

--------------------------------------------------------------------------------
二、异常与边界验收
────────────────────────────────────────────────────────────────────────────────

✅ 【缺字段校验】
   当：创建预约时只填了读者编号，没填图书和取书分馆
   则：系统提示「参数错误」，明确指出哪些字段必填
   并：不会创建任何预约记录

✅ 【重复请求幂等】
   当：网络卡顿，用户连续点击 3 次「预约」按钮
   则：只有第 1 次真正创建预约
   并：后 2 次返回「请求已处理过」，不会生成重复预约

✅ 【状态流转校验】
   当：预约状态是「待调拨」时，直接点击「取书」
   则：系统提示「当前预约状态为『待调拨』，无法取书」
   并：必须按「待调拨 → 调拨中 → 已到馆 → 已取书」顺序流转

✅ 【逾期释放】
   当：图书到馆后 7 天张三仍未取书
   则：系统自动将预约状态改为「逾期未取」
   并：馆藏状态恢复为「在馆」，可被其他读者预约

✅ 【不存在实体校验】
   当：使用不存在的读者编号「XXX」创建预约
   则：系统提示「读者不存在」
   并：不会创建任何预约记录

✅ 【重复预约校验】
   当：张三已预约了《Python编程从入门到精通》且未完成
   则：再次预约同一本书时，系统提示「您已预约过此书且尚未完成」
   并：不会创建新预约

✅ 【同馆无需调拨】
   当：读者选择的取书分馆和图书所在分馆相同
   则：系统提示「图书已在取书分馆，无需调拨」

--------------------------------------------------------------------------------
三、数据一致性验收
────────────────────────────────────────────────────────────────────────────────

✅ 【预约详情可追溯】
   当：查询任意预约的详情
   则：可以看到完整的时间线：
       - 何时创建预约
       - 何时创建调拨单、何时发出、何时到达
       - 何时发送通知
       - 何时取书、借阅编号是多少
       - 每次操作的操作人是谁

✅ 【操作日志完整】
   当：进行任何操作（创建预约、发出、到馆、取书、人工修正）
   则：在预约详情的「操作日志」中能看到对应记录
   并：区分「系统操作」和「人工操作」
   并：人工操作必须记录「操作人」和「原因」

✅ 【馆藏状态同步】
   当：调拨单发出时
   则：源馆藏状态从「在馆」→「调拨锁定」
   当：调拨到馆时
   则：源馆藏状态变为「已调出」
   并：目标分馆新增一个馆藏，状态为「在馆」（位置：预约待取）
   当：取书完成时
   则：目标馆藏状态变为「借出」

✅ 【人工修正有记录】
   当：管理员因特殊原因取消预约
   则：必须填写「修正原因」
   并：操作日志中标记为「人工修正」
   并：记录修改前后的值（例如：状态从「已到馆」改为「已取消」）

✅ 【重启后数据不丢】
   当：服务器重启后
   则：之前的预约、调拨、借阅、日志记录都还在
   并：查询历史记录时数据完整

--------------------------------------------------------------------------------
四、接口返回语言验收
────────────────────────────────────────────────────────────────────────────────

✅ 【返回业务语言】
   当：调用任何接口
   则：返回的 message 字段用业务人员能理解的语言：
       ✓ 「预约成功，您排在第 1 位」（而非「status=201」）
       ✓ 「图书已到馆，已通知读者 张三」（而非「notification sent」）
       ✓ 「取书成功，已生成借阅记录」（而非「borrow created」）
       ✓ 「当前预约状态为『待调拨』，无法取书」（而非「invalid state」）

✅ 【错误信息友好】
   当：发生业务错误时
   则：message 字段清晰说明原因和解决方式：
       - 「读者不存在」→ 知道要检查读者编号
       - 「图书已在取书分馆，无需调拨」→ 知道可以跳过调拨步骤
       - 「您已预约过此书且尚未完成」→ 知道之前有未完成的预约

================================================================================
                            验收清单（可勾选）
================================================================================

主流程：
[ ] 1. 读者可以成功预约图书，获得队列位置
[ ] 2. 可以创建调拨单，锁定源馆藏
[ ] 3. 可以开始调拨，状态变为运输中
[ ] 4. 可以确认到馆，自动发送通知
[ ] 5. 可以取书，自动生成借阅记录

异常处理：
[ ] 6. 缺少必要字段时返回清晰的错误提示
[ ] 7. 相同 request_id 的重复请求不会重复创建
[ ] 8. 状态不符合时拒绝操作（如待调拨时不能取书）
[ ] 9. 超过取书期限自动释放资源
[ ] 10. 不存在的读者/图书/分馆被正确拒绝
[ ] 11. 同一读者同一本书不能重复预约

数据一致性：
[ ] 12. 预约详情包含完整的操作历史
[ ] 13. 操作日志区分系统/人工，记录操作人
[ ] 14. 馆藏状态与调拨/取书操作同步
[ ] 15. 人工修正必须记录原因和修改前后值
[ ] 16. 服务器重启后历史数据完整可查

接口语言：
[ ] 17. 成功返回用业务语言描述结果
[ ] 18. 错误返回说明清楚原因

================================================================================
"""


def show_criteria():
    """显示验收点"""
    print(ACCEPTANCE_CRITERIA)


def check_server():
    """检查服务器状态"""
    try:
        import requests
        resp = requests.get("http://localhost:8000/", timeout=3)
        if resp.status_code == 200:
            data = resp.json()
            print("✅ 服务器状态：正常")
            print(f"   系统名称: {data['data']['系统名称']}")
            print(f"   版本: {data['data']['版本']}")
            return True
    except:
        pass
    
    print("⚠️  服务器未运行或无法连接")
    print("   启动命令: ./run.sh")
    print("   接口文档: http://localhost:8000/docs")
    return False


def quick_verify():
    """快速验证核心流程"""
    print("\n" + "="*60)
    print("快速验证主流程")
    print("="*60)
    
    import requests
    import uuid
    
    BASE = "http://localhost:8001"
    
    def req_id(prefix):
        return f"{prefix}-{uuid.uuid4().hex[:8]}"
    
    print("\n1️⃣  检查测试数据...")
    resp = requests.get(f"{BASE}/api/branches")
    branches = resp.json()
    print(f"   ✅ 分馆数量: {len(branches['data'])}")
    for b in branches['data'][:3]:
        print(f"      - {b['名称']}")
    
    resp = requests.get(f"{BASE}/api/books/BK001/holdings")
    holdings = resp.json()
    print(f"   ✅ 《Python编程从入门到精通》馆藏: {len(holdings['data'])} 册")
    
    print("\n2️⃣  预约图书...")
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
        reservation_id = result["data"]["预约编号"]
    else:
        print(f"   ❌ {result['message']}")
        return
    
    print("\n3️⃣  创建调拨单...")
    payload = {
        "request_id": req_id("TRF"),
        "reservation_id": reservation_id,
        "from_holding_id": "H002",
        "estimated_days": 2
    }
    resp = requests.post(f"{BASE}/api/transfers", json=payload)
    result = resp.json()
    if result["success"]:
        print(f"   ✅ {result['message']}")
        transfer_id = result["data"]["调拨编号"]
    else:
        print(f"   ⚠️  {result['message']}")
        return
    
    print("\n4️⃣  开始调拨...")
    resp = requests.post(f"{BASE}/api/transfers/{transfer_id}/start", json={"operator": "验收测试"})
    result = resp.json()
    if result["success"]:
        print(f"   ✅ {result['message']}")
    
    print("\n5️⃣  确认到馆...")
    resp = requests.post(f"{BASE}/api/transfers/{transfer_id}/arrive", json={"operator": "验收测试"})
    result = resp.json()
    if result["success"]:
        print(f"   ✅ {result['message']}")
        print(f"      取书截止: {result['data']['取书截止']}")
        print(f"      通知状态: {result['data']['通知状态']}")
    
    print("\n6️⃣  取书...")
    payload = {
        "request_id": req_id("PKUP"),
        "operator": "验收测试",
        "borrow_days": 30
    }
    resp = requests.post(f"{BASE}/api/reservations/{reservation_id}/pickup", json=payload)
    result = resp.json()
    if result["success"]:
        print(f"   ✅ {result['message']}")
        print(f"      借阅编号: {result['data']['借阅编号']}")
        print(f"      应还日期: {result['data']['应还日期']}")
    
    print("\n7️⃣  查看操作日志...")
    resp = requests.get(f"{BASE}/api/reservations/{reservation_id}")
    result = resp.json()
    if result["success"]:
        ops = result["data"]["操作日志"]
        print(f"   ✅ 共 {len(ops)} 条操作记录:")
        for op in ops:
            manual = "👤" if op["是否人工"] == "是" else "🤖"
            print(f"      {manual} [{op['时间']}] {op['操作类型']}")
    
    print("\n" + "="*60)
    print("🎉 快速验证完成！请查看上面的输出是否符合预期。")
    print("="*60)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--verify":
        if check_server():
            quick_verify()
    else:
        show_criteria()
