import requests
import json
import time

BASE_URL = "http://localhost:8000"


def post(endpoint: str, data, params=None):
    resp = requests.post(f"{BASE_URL}{endpoint}", json=data, params=params)
    return resp.json()


def get(endpoint: str, params=None):
    resp = requests.get(f"{BASE_URL}{endpoint}", params=params)
    return resp.json()


def seed():
    print("=" * 60)
    print("校园一卡通退款清算 - 样例数据导入")
    print("=" * 60)

    # ========== 1. 收款流水 ==========
    print("\n【1】导入收款流水")
    payments = [
        {"transaction_id": "PAY-2026-001", "card_no": "2021001", "student_name": "张三", "amount": 500.00, "payment_time": "2026-03-15 09:30:00", "description": "3月餐费充值", "source": "一卡通系统"},
        {"transaction_id": "PAY-2026-002", "card_no": "2021002", "student_name": "李四", "amount": 300.00, "payment_time": "2026-03-16 10:15:00", "description": "3月餐费充值", "source": "一卡通系统"},
        {"transaction_id": "PAY-2026-003", "card_no": "2021003", "student_name": "王五", "amount": 200.00, "payment_time": "2026-03-17 14:00:00", "description": "3月图书押金", "source": "一卡通系统"},
        {"transaction_id": "PAY-2026-004", "card_no": "2021004", "student_name": "赵六", "amount": 1000.00, "payment_time": "2026-03-18 11:20:00", "description": "3月住宿预缴", "source": "一卡通系统"},
    ]
    result = post("/payments/import", payments, params={"strategy": "conflict"})
    print(f"  → {json.dumps(result, ensure_ascii=False, indent=2)}")

    # ========== 2. 退款申请（含一次顺利 + 一次返工 + 边界记录） ==========
    print("\n【2】导入退款申请")
    refunds = [
        {
            "application_no": "REF-2026-001",
            "transaction_id": "PAY-2026-001",
            "card_no": "2021001",
            "student_name": "张三",
            "refund_amount": 500.00,
            "reason": "毕业退卡，余额全部退还",
            "applicant": "张三",
            "apply_time": "2026-03-20 10:00:00",
            "status": "pending",
        },
        {
            "application_no": "REF-2026-002",
            "transaction_id": "PAY-2026-002",
            "card_no": "2021002",
            "student_name": "李四",
            "refund_amount": 150.00,
            "reason": "餐费多收退还",
            "applicant": "李四",
            "apply_time": "2026-03-21 09:00:00",
            "status": "pending",
        },
        {
            "application_no": "REF-2026-003",
            "transaction_id": "PAY-2026-003",
            "card_no": "2021003",
            "student_name": "王五",
            "refund_amount": 200.00,
            "reason": "图书押金退还",
            "applicant": "王五",
            "apply_time": "2026-03-22 15:30:00",
            "status": "pending",
        },
        {
            "application_no": "REF-2026-004",
            "transaction_id": "PAY-2026-004",
            "card_no": "2021004",
            "student_name": "赵六",
            "refund_amount": 1000.00,
            "reason": "退宿退款",
            "applicant": "赵六",
            "apply_time": "2026-03-23 11:00:00",
            "status": "pending",
        },
    ]
    result = post("/refunds/import", refunds, params={"strategy": "conflict"})
    print(f"  → {json.dumps(result, ensure_ascii=False, indent=2)}")

    # ========== 3. 审批记录 ==========
    print("\n【3】导入审批记录")
    approvals = [
        {
            "application_no": "REF-2026-001",
            "approver": "财务-刘主任",
            "approval_time": "2026-03-21 14:00:00",
            "approval_result": "approved",
            "remarks": "毕业退卡，手续齐全",
            "email_subject": "【审批通过】张三-毕业退卡退款",
        },
        {
            "application_no": "REF-2026-002",
            "approver": "财务-刘主任",
            "approval_time": "2026-03-22 10:00:00",
            "approval_result": "approved",
            "remarks": "餐费多收核实无误",
            "email_subject": "【审批通过】李四-餐费退还",
        },
        {
            "application_no": "REF-2026-003",
            "approver": "财务-刘主任",
            "approval_time": "2026-03-23 09:30:00",
            "approval_result": "approved",
            "remarks": "图书押金退还，已归还图书",
            "email_subject": "【审批通过】王五-图书押金退还",
        },
        {
            "application_no": "REF-2026-004",
            "approver": "财务-刘主任",
            "approval_time": "2026-03-24 16:00:00",
            "approval_result": "approved",
            "remarks": "退宿手续已办，但住宿科反馈有物品未还",
            "email_subject": "【审批通过（附条件）】赵六-退宿退款",
        },
    ]
    result = post("/approvals/import", approvals)
    print(f"  → {json.dumps(result, ensure_ascii=False, indent=2)}")

    # ========== 4. 人工备注 ==========
    print("\n【4】添加人工备注")
    notes = [
        {
            "application_no": "REF-2026-001",
            "note_content": "张三毕业证已核验，3月25日前完成打款",
            "operator": "阿宁",
            "note_time": "2026-03-22 09:00:00",
            "note_type": "general",
        },
        {
            "application_no": "REF-2026-004",
            "note_content": "住宿科说赵六宿舍钥匙未归还，需等确认后再打款",
            "operator": "阿宁",
            "note_time": "2026-03-24 17:00:00",
            "note_type": "general",
        },
    ]
    for n in notes:
        result = post("/notes", n)
        print(f"  → {json.dumps(result, ensure_ascii=False)}")

    # ========== 5. 张三顺利流程：pending → approved → completed ==========
    print("\n【5】张三退款顺利走完 → completed")
    result = post("/refunds/REF-2026-001/status", None, params=None)
    # 需要用PUT方法
    resp = requests.put(
        f"{BASE_URL}/refunds/REF-2026-001/status",
        json={"status": "processing", "operator": "阿宁"},
    )
    print(f"  → {json.dumps(resp.json(), ensure_ascii=False)}")

    resp = requests.put(
        f"{BASE_URL}/refunds/REF-2026-001/status",
        json={"status": "completed", "operator": "阿宁"},
    )
    print(f"  → {json.dumps(resp.json(), ensure_ascii=False)}")

    # ========== 6. 赵六返工流程：approved → rework ==========
    print("\n【6】赵六退款返工 → rework")
    resp = requests.put(
        f"{BASE_URL}/refunds/REF-2026-004/status",
        json={"status": "rework", "rework_reason": "宿舍钥匙未归还，住宿科要求暂缓退款", "operator": "阿宁"},
    )
    print(f"  → {json.dumps(resp.json(), ensure_ascii=False)}")

    # 添加返工备注
    result = post("/notes", {
        "application_no": "REF-2026-004",
        "note_content": "返工原因：住宿科反馈钥匙未还。已通知赵六尽快归还。等住宿科确认后再重新提交。",
        "operator": "阿宁",
        "note_type": "rework",
    })
    print(f"  → {json.dumps(result, ensure_ascii=False)}")

    # ========== 7. 创建批次 ==========
    print("\n【7】创建清算批次")
    batch = {
        "batch_no": "BATCH-2026-03",
        "period_start": "2026-03-01",
        "period_end": "2026-03-31",
        "created_by": "阿宁",
        "application_nos": ["REF-2026-001", "REF-2026-002", "REF-2026-003", "REF-2026-004"],
    }
    result = post("/batches", batch)
    print(f"  → {json.dumps(result, ensure_ascii=False, indent=2)}")

    # ========== 8. 月底对账表 ==========
    print("\n【8】导入月底对账表")
    recon = [
        {
            "period": "2026-03-01~2026-03-31",
            "category": "校园一卡通退款清算",
            "expected_amount": 1850.00,
            "actual_amount": 500.00,
            "difference": 1350.00,
            "source": "财务对账表",
            "description": "3月一卡通退款清算，含4笔退款申请",
        },
    ]
    result = post("/reconciliation/import", recon, params={"strategy": "conflict"})
    print(f"  → {json.dumps(result, ensure_ascii=False, indent=2)}")

    # ========== 9. 重复导入测试（不越滚越多） ==========
    print("\n【9】重复导入测试 - 同样的退款申请再导入一次（conflict策略）")
    duplicate_refunds = [
        {
            "application_no": "REF-2026-001",
            "transaction_id": "PAY-2026-001",
            "card_no": "2021001",
            "student_name": "张三",
            "refund_amount": 500.00,
            "reason": "毕业退卡，余额全部退还",
            "applicant": "张三",
            "apply_time": "2026-03-20 10:00:00",
            "status": "completed",
        },
    ]
    result = post("/refunds/import", duplicate_refunds, params={"strategy": "conflict"})
    print(f"  → {json.dumps(result, ensure_ascii=False, indent=2)}")

    # 重复导入 - skip策略
    print("\n【9b】重复导入测试 - skip策略")
    result = post("/refunds/import", duplicate_refunds, params={"strategy": "skip"})
    print(f"  → {json.dumps(result, ensure_ascii=False, indent=2)}")

    # 重复导入 - update策略
    print("\n【9c】重复导入测试 - update策略")
    result = post("/refunds/import", duplicate_refunds, params={"strategy": "update"})
    print(f"  → {json.dumps(result, ensure_ascii=False, indent=2)}")

    # ========== 10. 冲突场景：对账表金额与批次清算金额不一致 ==========
    print("\n【10】对账一致性检查")
    result = get("/reconciliation/consistency")
    print(f"  → {json.dumps(result, ensure_ascii=False, indent=2)}")

    # ========== 11. 查看冲突列表 ==========
    print("\n【11】查看冲突列表")
    result = get("/conflicts", params={"status": "open"})
    for c in result:
        print(f"  → 冲突类型: {c['conflict_type']}")
        print(f"     建议: {c['suggestion']}")
        print(f"     字段差异: {json.dumps(c['field_differences'], ensure_ascii=False)}")
        print()

    # ========== 12. 提交+确认批次 ==========
    print("\n【12】提交并确认批次")
    result = post("/batches/BATCH-2026-03/submit", {})
    print(f"  → {json.dumps(result, ensure_ascii=False)}")

    resp = requests.post(
        f"{BASE_URL}/batches/BATCH-2026-03/confirm",
        json={"confirmed_by": "阿宁"},
    )
    print(f"  → {json.dumps(resp.json(), ensure_ascii=False)}")

    # ========== 13. 导出报告 ==========
    print("\n【13】导出清算报告")
    result = post("/export", {"batch_no": "BATCH-2026-03"})
    summary = result.get("汇总", {})
    print(f"  退款总笔数: {summary.get('退款总笔数')}")
    print(f"  退款总金额: {summary.get('退款总金额')}")
    print(f"  已完成笔数: {summary.get('已完成笔数')}")
    print(f"  返工总次数: {summary.get('返工总次数')}")
    print(f"  一致性声明: {result.get('一致性声明')}")

    # ========== 14. 李四和王五也走完流程 ==========
    print("\n【14】李四和王五完成退款")
    for app_no in ["REF-2026-002", "REF-2026-003"]:
        resp = requests.put(
            f"{BASE_URL}/refunds/{app_no}/status",
            json={"status": "processing", "operator": "阿宁"},
        )
        resp = requests.put(
            f"{BASE_URL}/refunds/{app_no}/status",
            json={"status": "completed", "operator": "阿宁"},
        )
        print(f"  → {app_no}: {resp.json().get('提示', '')}")

    # ========== 15. 最终查询验证 ==========
    print("\n【15】最终查询验证")
    result = get("/refunds")
    for r in result:
        print(f"  {r['application_no']} | {r['student_name']} | {r['status']} | 返工{r['rework_count']}次")

    result = get("/notes")
    print(f"\n  备注总数: {len(result)}")
    for n in result:
        print(f"  [{n['note_time']}] {n['application_no']}: {n['note_content']}")

    print("\n" + "=" * 60)
    print("样例数据导入完成！")
    print("顺利流程: 张三 REF-2026-001 (pending→approved→processing→completed)")
    print("返工流程: 赵六 REF-2026-004 (approved→rework，宿舍钥匙未还)")
    print("=" * 60)


if __name__ == "__main__":
    seed()
