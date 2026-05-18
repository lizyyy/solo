import pytest
from fastapi.testclient import TestClient
from main import app
from models import db, AddItemStatus, AddItemType

client = TestClient(app)


class TestRules:
    def __init__(self):
        self.passed = []
        self.failed = []
    
    def check(self, rule_name: str, condition: bool, detail: str = ""):
        if condition:
            self.passed.append((rule_name, detail))
            print(f"✓ PASS: {rule_name}")
        else:
            self.failed.append((rule_name, detail))
            print(f"✗ FAIL: {rule_name} - {detail}")
    
    def report(self):
        print("\n" + "="*60)
        print(f"测试结果汇总: {len(self.passed)} 通过, {len(self.failed)} 失败")
        print("="*60)
        if self.failed:
            print("\n失败的规则:")
            for rule, detail in self.failed:
                print(f"  ✗ {rule}: {detail}")
        return len(self.failed) == 0


@pytest.fixture(autouse=True)
def clear_db():
    db.add_items.clear()
    db.modification_records.clear()
    yield
    db.add_items.clear()
    db.modification_records.clear()


def create_sample_add_item(is_verbal=False, verbal_operator=None):
    response = client.post("/api/add-items", json={
        "exhibition_name": "2024上海国际工业博览会",
        "booth_number": "A1-205",
        "construction_team": "精工搭建队",
        "project_manager": "张三",
        "add_item_type": AddItemType.ELECTRICAL.value,
        "add_item_name": "额外LED射灯安装",
        "add_item_description": "展台主通道两侧增加4盏LED射灯，含布线和调试",
        "quantity": 4,
        "unit": "盏",
        "unit_price": 350.0,
        "creator": "李四",
        "is_verbal": is_verbal,
        "verbal_operator": verbal_operator
    })
    return response.json()


def test_rule_1_verbal_no_customer_confirm():
    rules = TestRules()
    
    item = create_sample_add_item(is_verbal=True, verbal_operator="王五")
    item_id = item["id"]
    
    rules.check("R1.1 - 口头加项创建后初始状态为草稿", 
                item["status"] == AddItemStatus.DRAFT.value)
    rules.check("R1.2 - 口头加项标记正确", item["is_verbal"] == True)
    rules.check("R1.3 - 口头操作人记录正确", item["verbal_operator"] == "王五")
    rules.check("R1.4 - 客户确认初始为未确认", item["customer_confirmed"] == False)
    
    response = client.post(f"/api/add-items/{item_id}/submit", json={
        "operator": "李四",
        "remark": "现场客户口头要求，先施工后补签字"
    })
    submitted_item = response.json()
    
    rules.check("R1.5 - 口头加项提交后状态变为'口头加项待确认'",
                submitted_item["status"] == AddItemStatus.VERBAL_NO_CONFIRM.value)
    rules.check("R1.6 - 客户确认仍为False", submitted_item["customer_confirmed"] == False)
    
    history = client.get(f"/api/add-items/{item_id}/history").json()
    submit_record = next((r for r in history if r["change_type"] == "提交"), None)
    
    rules.check("R1.7 - 提交操作留痕", submit_record is not None)
    rules.check("R1.8 - 修改历史记录旧状态", submit_record["old_status"] == AddItemStatus.DRAFT.value)
    rules.check("R1.9 - 修改历史记录新状态", submit_record["new_status"] == AddItemStatus.VERBAL_NO_CONFIRM.value)
    rules.check("R1.10 - 修改历史记录操作人", submit_record["operator"] == "李四")
    
    assert rules.report()


def test_rule_2_ledger_consistency():
    rules = TestRules()
    
    item = create_sample_add_item(is_verbal=False)
    item_id = item["id"]
    
    rules.check("R2.1 - 普通加项创建后状态为草稿",
                item["status"] == AddItemStatus.DRAFT.value)
    rules.check("R2.2 - 总价计算正确", item["total_price"] == 4 * 350.0)
    
    client.post(f"/api/add-items/{item_id}/submit", json={
        "operator": "李四",
        "remark": "正常提交审批"
    })
    
    response = client.post(f"/api/add-items/{item_id}/ledger-match", json={
        "matched": True,
        "operator": "财务-赵六"
    })
    matched_item = response.json()
    
    rules.check("R2.3 - 台账匹配后状态正确",
                matched_item["status"] == AddItemStatus.LEDGER_MATCHED.value)
    rules.check("R2.4 - 台账匹配标记正确", matched_item["ledger_matched"] == True)
    
    history = client.get(f"/api/add-items/{item_id}/history").json()
    ledger_record = next((r for r in history if r["change_type"] == "台账核对"), None)
    
    rules.check("R2.5 - 台账核对操作留痕", ledger_record is not None)
    
    item2 = create_sample_add_item(is_verbal=False)
    item2_id = item2["id"]
    client.post(f"/api/add-items/{item2_id}/submit", json={"operator": "李四"})
    
    response2 = client.post(f"/api/add-items/{item2_id}/ledger-match", json={
        "matched": False,
        "mismatch_reason": "单价与合同约定不符，合同约定300元/盏",
        "operator": "财务-赵六"
    })
    mismatched_item = response2.json()
    
    rules.check("R2.6 - 台账不匹配状态正确",
                mismatched_item["status"] == AddItemStatus.LEDGER_MISMATCH.value)
    rules.check("R2.7 - 不匹配原因留痕", 
                mismatched_item["ledger_mismatch_reason"] == "单价与合同约定不符，合同约定300元/盏")
    
    assert rules.report()


def test_rule_3_withdraw_and_resubmit():
    rules = TestRules()
    
    item = create_sample_add_item(is_verbal=False)
    item_id = item["id"]
    
    client.post(f"/api/add-items/{item_id}/submit", json={
        "operator": "李四",
        "remark": "第一次提交"
    })
    
    response = client.post(f"/api/add-items/{item_id}/withdraw", json={
        "operator": "李四",
        "reason": "数量有误，需要修改后重新提交"
    })
    withdrawn_item = response.json()
    
    rules.check("R3.1 - 撤回后状态正确",
                withdrawn_item["status"] == AddItemStatus.WITHDRAWN.value)
    rules.check("R3.2 - 撤回原因留痕", 
                withdrawn_item["current_remark"] == "数量有误，需要修改后重新提交")
    
    history = client.get(f"/api/add-items/{item_id}/history").json()
    withdraw_record = next((r for r in history if r["change_type"] == "撤回"), None)
    
    rules.check("R3.3 - 撤回操作留痕", withdraw_record is not None)
    rules.check("R3.4 - 撤回前状态记录", withdraw_record["old_status"] == AddItemStatus.SUBMITTED.value)
    
    client.put(f"/api/add-items/{item_id}", params={"operator": "李四"}, json={
        "quantity": 6
    })
    
    response = client.post(f"/api/add-items/{item_id}/submit", json={
        "operator": "李四",
        "remark": "修改数量后重新提交"
    })
    resubmitted_item = response.json()
    
    rules.check("R3.5 - 撤回后可编辑修改", resubmitted_item["quantity"] == 6)
    rules.check("R3.6 - 撤回后可重新提交", 
                resubmitted_item["status"] == AddItemStatus.SUBMITTED.value)
    rules.check("R3.7 - 修改后总价重新计算",
                resubmitted_item["total_price"] == 6 * 350.0)
    
    history_final = client.get(f"/api/add-items/{item_id}/history").json()
    change_types = [r["change_type"] for r in history_final]
    
    rules.check("R3.8 - 完整操作历史留痕", 
                "创建" in change_types and "提交" in change_types and 
                "撤回" in change_types and "编辑" in change_types)
    rules.check("R3.9 - 修改历史记录条数正确", len(history_final) >= 5)
    
    assert rules.report()


def test_rule_4_manual_process_leave_trace():
    rules = TestRules()
    
    item = create_sample_add_item(is_verbal=True, verbal_operator="王五")
    item_id = item["id"]
    
    client.post(f"/api/add-items/{item_id}/submit", json={
        "operator": "李四",
        "remark": "口头加项提交"
    })
    
    response = client.post(f"/api/add-items/{item_id}/manual-process", json={
        "processor": "审核员-孙七",
        "remark": "情况特殊，需要人工核实客户确认情况"
    })
    manual_item = response.json()
    
    rules.check("R4.1 - 进入人工处理状态正确",
                manual_item["status"] == AddItemStatus.MANUAL_PROCESSING.value)
    rules.check("R4.2 - 人工处理人记录", manual_item["manual_processor"] == "审核员-孙七")
    rules.check("R4.3 - 人工处理开始时间记录", 
                manual_item["manual_process_start_time"] is not None)
    
    response = client.post(f"/api/add-items/{item_id}/manual-remark", json={
        "processor": "审核员-孙七",
        "remark": "已电话联系客户张总，确认确实要求增加射灯，客户明天来现场补签"
    })
    remarked_item = response.json()
    
    rules.check("R4.4 - 人工处理中可以添加备注",
                remarked_item["current_remark"] == "已电话联系客户张总，确认确实要求增加射灯，客户明天来现场补签")
    
    response = client.post(f"/api/add-items/{item_id}/manual-submit", json={
        "operator": "审核员-孙七",
        "remark": "已核实客户确认，继续走审批流程"
    })
    submitted_item = response.json()
    
    rules.check("R4.5 - 人工处理后可以再次提交",
                submitted_item["status"] == AddItemStatus.SUBMITTED.value)
    
    history = client.get(f"/api/add-items/{item_id}/history").json()
    change_types = [r["change_type"] for r in history]
    
    rules.check("R4.6 - 人工处理完整留痕", 
                "进入人工处理" in change_types and 
                "人工处理备注" in change_types and
                "人工处理后提交" in change_types)
    
    assert rules.report()


def test_rule_5_list_to_detail_to_history():
    rules = TestRules()
    
    item1 = create_sample_add_item(is_verbal=False)
    item2 = create_sample_add_item(is_verbal=True, verbal_operator="王五")
    
    list_response = client.get("/api/add-items")
    item_list = list_response.json()
    
    rules.check("R5.1 - 列表接口返回所有记录", len(item_list) == 2)
    
    first_item_id = item_list[0]["id"]
    detail_response = client.get(f"/api/add-items/{first_item_id}")
    detail = detail_response.json()
    
    rules.check("R5.2 - 从列表可进入详情", detail["id"] == first_item_id)
    rules.check("R5.3 - 详情包含完整业务字段", 
                all(key in detail for key in [
                    "exhibition_name", "booth_number", "construction_team",
                    "project_manager", "add_item_type", "add_item_name",
                    "quantity", "unit", "unit_price", "total_price"
                ]))
    
    history_response = client.get(f"/api/add-items/{first_item_id}/history")
    history = history_response.json()
    
    rules.check("R5.4 - 从详情可查看修改历史", len(history) >= 1)
    rules.check("R5.5 - 修改历史按时间倒序排列", 
                history[0]["modify_time"] >= history[-1]["modify_time"] if len(history) > 1 else True)
    
    assert rules.report()


def test_rule_6_real_business_fields():
    rules = TestRules()
    
    item = create_sample_add_item(is_verbal=True, verbal_operator="王五")
    item_id = item["id"]
    
    client.post(f"/api/add-items/{item_id}/submit", json={
        "operator": "李四",
        "remark": "现场口头加项"
    })
    
    client.post(f"/api/add-items/{item_id}/customer-confirm", json={
        "confirmer": "客户代表-周八",
        "remark": "已确认，同意增加"
    })
    
    detail = client.get(f"/api/add-items/{item_id}").json()
    
    rules.check("R6.1 - 包含展会名称", detail["exhibition_name"] == "2024上海国际工业博览会")
    rules.check("R6.2 - 包含展台号", detail["booth_number"] == "A1-205")
    rules.check("R6.3 - 包含搭建队", detail["construction_team"] == "精工搭建队")
    rules.check("R6.4 - 包含项目经理", detail["project_manager"] == "张三")
    rules.check("R6.5 - 包含加项类型", detail["add_item_type"] == AddItemType.ELECTRICAL.value)
    rules.check("R6.6 - 包含加项名称", detail["add_item_name"] == "额外LED射灯安装")
    rules.check("R6.7 - 包含数量", detail["quantity"] == 4)
    rules.check("R6.8 - 包含单位", detail["unit"] == "盏")
    rules.check("R6.9 - 包含单价", detail["unit_price"] == 350.0)
    rules.check("R6.10 - 包含总价", detail["total_price"] == 1400.0)
    rules.check("R6.11 - 包含客户确认人", detail["customer_confirmer"] == "客户代表-周八")
    rules.check("R6.12 - 包含客户确认时间", detail["customer_confirm_time"] is not None)
    
    history = client.get(f"/api/add-items/{item_id}/history").json()
    customer_confirm_record = next((r for r in history if r["change_type"] == "客户确认"), None)
    
    rules.check("R6.13 - 客户确认操作留痕", customer_confirm_record is not None)
    
    assert rules.report()


def test_all_rules_together():
    print("\n" + "="*60)
    print("开始执行展会搭建队展台加项签认系统测试")
    print("="*60 + "\n")
    
    all_passed = True
    
    test_functions = [
        ("规则组1: 现场口头加项没有客户确认", test_rule_1_verbal_no_customer_confirm),
        ("规则组2: 加项台账一致性检查", test_rule_2_ledger_consistency),
        ("规则组3: 撤回后再次提交", test_rule_3_withdraw_and_resubmit),
        ("规则组4: 人工处理留痕", test_rule_4_manual_process_leave_trace),
        ("规则组5: 列表->详情->历史完整链路", test_rule_5_list_to_detail_to_history),
        ("规则组6: 真实业务字段完整性", test_rule_6_real_business_fields),
    ]
    
    for test_name, test_func in test_functions:
        print(f"\n【{test_name}】")
        print("-" * 40)
        try:
            db.add_items.clear()
            db.modification_records.clear()
            test_func()
        except AssertionError:
            all_passed = False
        except Exception as e:
            print(f"✗ 测试异常: {str(e)}")
            all_passed = False
    
    print("\n" + "="*60)
    if all_passed:
        print("🎉 所有规则测试通过！")
    else:
        print("❌ 部分规则测试失败，请检查以上失败项")
    print("="*60)
    
    assert all_passed


if __name__ == "__main__":
    test_all_rules_together()
