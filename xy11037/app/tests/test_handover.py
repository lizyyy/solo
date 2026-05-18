import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.main import app
from app.models.database import db, DATA_FILE, HISTORY_FILE

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_data():
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    if os.path.exists(HISTORY_FILE):
        os.remove(HISTORY_FILE)
    db.records.clear()
    db.history.clear()
    yield


def create_sample_handover():
    data = {
        "shift_date": "2026-05-18",
        "shift_type": "夜班",
        "on_duty_nurse": "张小红",
        "off_duty_nurse": "李秀英",
        "baby_count": 5,
        "maternal_conditions": [
            {
                "room_number": "VIP01",
                "mother_name": "王美丽",
                "temperature": "36.5",
                "lochia": "正常",
                "uterine_contraction": "良好",
                "wound_condition": "干燥无渗血",
                "breastfeeding": "顺利",
                "special_care": "一级护理",
                "notes": "产后第三天，恢复良好"
            },
            {
                "room_number": "VIP02",
                "mother_name": "刘婷婷",
                "temperature": "36.8",
                "lochia": "正常",
                "uterine_contraction": "一般",
                "wound_condition": "稍有红肿",
                "breastfeeding": "需协助",
                "special_care": "一级护理",
                "notes": "产后第二天，注意观察伤口"
            }
        ],
        "baby_conditions": [
            {
                "room_number": "VIP01",
                "baby_name": "小宝A",
                "gender": "男",
                "temperature": "36.7",
                "feeding": "母乳 30ml",
                "defecation": "胎便已排",
                "skin_condition": "正常",
                "jaundice": "生理性黄疸，轻微",
                "status": "正常",
                "notes": "体重下降在正常范围内"
            },
            {
                "room_number": "VIP02",
                "baby_name": "小宝B",
                "gender": "女",
                "temperature": "36.5",
                "feeding": "配方奶 25ml",
                "defecation": "正常",
                "skin_condition": "轻微红疹",
                "jaundice": "无",
                "status": "需关注",
                "notes": "注意观察皮肤情况"
            }
        ],
        "special_notes": "VIP02产妇血压略高，需密切监测",
        "equipment_status": "监护仪正常，吸奶器2台可用",
        "emergency_supplies": "急救物品齐全，在有效期内",
        "next_shift_tasks": "1. VIP02产妇伤口换药\n2. 小宝B皮肤情况观察\n3. 晨间护理准备"
    }
    response = client.post("/api/handover/", json=data)
    return response.json()


class TestHandoverFlow:
    """测试完整交接流程"""

    def test_create_handover(self):
        """测试创建交接记录"""
        handover = create_sample_handover()
        assert handover["status"] == "草稿"
        assert handover["on_duty_nurse"] == "张小红"
        assert handover["off_duty_nurse"] == "李秀英"
        assert handover["baby_count"] == 5
        print("✓ 创建交接记录成功")

    def test_list_handovers(self):
        """测试获取列表"""
        create_sample_handover()
        create_sample_handover()
        
        response = client.get("/api/handover/")
        records = response.json()
        assert len(records) == 2
        print("✓ 获取列表成功")

    def test_get_handover_detail(self):
        """测试从列表进入详情"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        response = client.get(f"/api/handover/{record_id}")
        detail = response.json()
        assert detail["id"] == record_id
        assert "maternal_conditions" in detail
        assert len(detail["maternal_conditions"]) == 2
        print("✓ 从列表进入详情成功")

    def test_get_history(self):
        """测试查看修改历史"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        update_data = {
            "special_notes": "VIP02产妇血压恢复正常",
            "remarks": "产妇情况好转，更新备注"
        }
        client.put(f"/api/handover/{record_id}", json=update_data)
        
        response = client.get(f"/api/handover/{record_id}/history")
        history = response.json()
        assert len(history) >= 1
        assert history[0]["change_type"] == "更新"
        print("✓ 查看修改历史成功")


class TestUnsignedNextShift:
    """测试上一班未签字但下一班录入结果的场景"""

    def test_next_shift_input_before_sign(self):
        """上一班未签字，下一班录入数据"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        
        assert handover["on_duty_signature"] is None
        assert handover["off_duty_signature"] is None
        
        update_data = {
            "baby_conditions": [
                {
                    "room_number": "VIP01",
                    "baby_name": "小宝A",
                    "gender": "男",
                    "temperature": "36.7",
                    "feeding": "母乳 35ml",
                    "defecation": "胎便已排",
                    "skin_condition": "正常",
                    "jaundice": "生理性黄疸，轻微",
                    "status": "正常",
                    "notes": "夜间吃奶情况良好"
                }
            ],
            "remarks": "夜班补充记录"
        }
        response = client.put(f"/api/handover/{record_id}", json=update_data)
        updated = response.json()
        
        assert updated["version"] == 3
        assert len(updated["history"]) == 2
        print("✓ 上一班未签字，下一班录入数据成功")

    def test_sign_after_next_shift_input(self):
        """下一班录入后，上一班补签字"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        
        update_data = {"special_notes": "夜班补充记录", "remarks": "夜班更新"}
        client.put(f"/api/handover/{record_id}", json=update_data)
        
        sign_data = {"signer": "李秀英", "signature": "李秀英20260518"}
        response = client.post(f"/api/handover/{record_id}/sign", json=sign_data)
        signed = response.json()
        
        assert signed["off_duty_signature"] == "李秀英20260518"
        assert signed["status"] == "已提交"
        print("✓ 下一班录入后上一班补签字成功")


class TestConsistencyCheck:
    """测试交接记录一致性"""

    def test_baby_count_consistency(self):
        """测试新生儿数量与记录的一致性"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        assert handover["baby_count"] == 5
        assert len(handover["baby_conditions"]) == 2
        
        update_data = {"baby_count": 2, "remarks": "修正新生儿数量与记录一致"}
        response = client.put(f"/api/handover/{record_id}", json=update_data)
        updated = response.json()
        
        assert updated["baby_count"] == 2
        print("✓ 新生儿数量一致性检查通过")

    def test_history_version_consistency(self):
        """测试历史记录版本号一致性"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        for i in range(3):
            update_data = {
                "special_notes": f"备注更新第{i+1}次",
                "remarks": f"更新备注{i+1}"
            }
            client.put(f"/api/handover/{record_id}", json=update_data)
        
        response = client.get(f"/api/handover/{record_id}/history")
        history = response.json()
        
        detail_response = client.get(f"/api/handover/{record_id}")
        detail = detail_response.json()
        
        assert detail["version"] == len(history) + 1
        print("✓ 历史记录版本号一致性检查通过")


class TestWithdrawAndResubmit:
    """测试撤回后再次提交的组合情况"""

    def test_withdraw_after_submit(self):
        """提交后撤回"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        submit_response = client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        assert submit_response.json()["status"] == "已提交"
        
        withdraw_data = {
            "withdrawn_by": "李秀英",
            "reason": "发现新生儿记录有误，需要修正后重新提交"
        }
        withdraw_response = client.post(f"/api/handover/{record_id}/withdraw", json=withdraw_data)
        assert withdraw_response.json()["status"] == "已撤回"
        print("✓ 提交后撤回成功")

    def test_resubmit_after_withdraw(self):
        """撤回后修改再提交"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        
        withdraw_data = {
            "withdrawn_by": "李秀英",
            "reason": "发现错误需要修正"
        }
        client.post(f"/api/handover/{record_id}/withdraw", json=withdraw_data)
        
        update_data = {
            "baby_conditions": [
                {
                    "room_number": "VIP01",
                    "baby_name": "小宝A",
                    "gender": "男",
                    "temperature": "36.8",
                    "feeding": "母乳 40ml",
                    "defecation": "正常",
                    "skin_condition": "正常",
                    "jaundice": "轻微",
                    "status": "正常",
                    "notes": "修正后记录"
                }
            ],
            "remarks": "修正新生儿喂养记录后重新提交"
        }
        client.put(f"/api/handover/{record_id}", json=update_data)
        
        resubmit_response = client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        
        detail_response = client.get(f"/api/handover/{record_id}")
        detail = detail_response.json()
        
        assert detail["status"] == "已提交"
        assert len(detail["history"]) >= 4
        print("✓ 撤回后修改再提交成功")

    def test_withdraw_with_full_history(self):
        """完整流程：创建-修改-提交-撤回-再修改-再提交-签字"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        client.put(f"/api/handover/{record_id}", json={
            "special_notes": "第一次更新备注",
            "remarks": "更新备注"
        })
        
        client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        
        client.post(f"/api/handover/{record_id}/withdraw", json={
            "withdrawn_by": "李秀英",
            "reason": "数据有误需要修正"
        })
        
        client.put(f"/api/handover/{record_id}", json={
            "equipment_status": "监护仪正常，吸奶器3台可用",
            "remarks": "更新设备状态后重新提交"
        })
        
        client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        
        client.post(f"/api/handover/{record_id}/sign", json={
            "signer": "李秀英",
            "signature": "李秀英20260518"
        })
        
        client.post(f"/api/handover/{record_id}/sign", json={
            "signer": "张小红",
            "signature": "张小红20260518"
        })
        
        history_response = client.get(f"/api/handover/{record_id}/history")
        history = history_response.json()
        
        change_types = [h["change_type"] for h in history]
        assert "更新" in change_types
        assert "提交" in change_types
        assert "撤回" in change_types
        assert "签字" in change_types
        
        print(f"✓ 完整流程历史记录数: {len(history)}")
        print(f"✓ 操作类型: {change_types}")


class TestManualProcess:
    """测试人工处理流程留痕"""

    def test_flag_manual_process(self):
        """标记人工处理"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        
        manual_data = {
            "flagged_by": "护士长王芳",
            "reason": "交接记录有矛盾之处，需要人工核查"
        }
        response = client.post(f"/api/handover/{record_id}/manual-process", json=manual_data)
        result = response.json()
        
        assert result["status"] == "待人工处理"
        print("✓ 标记人工处理成功")

    def test_manual_process_with_notes(self):
        """人工处理备注留痕"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        
        client.post(f"/api/handover/{record_id}/manual-process", json={
            "flagged_by": "护士长王芳",
            "reason": "记录有矛盾需核查"
        })
        
        complete_data = {
            "processed_by": "护士长王芳",
            "notes": "经核查，系录入笔误，新生儿数量应为3而非5。已修正数据，责任护士已重新确认。",
            "new_status": "人工处理完成"
        }
        response = client.post(f"/api/handover/{record_id}/manual-complete", json=complete_data)
        result = response.json()
        
        assert result["status"] == "人工处理完成"
        assert "经核查，系录入笔误" in result["manual_process_notes"]
        print("✓ 人工处理备注留痕成功")

    def test_resubmit_after_manual_process(self):
        """人工处理后再次提交"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        
        client.post(f"/api/handover/{record_id}/manual-process", json={
            "flagged_by": "护士长王芳",
            "reason": "记录有矛盾"
        })
        
        client.post(f"/api/handover/{record_id}/withdraw", json={
            "withdrawn_by": "李秀英",
            "reason": "撤回后修正"
        })
        
        client.put(f"/api/handover/{record_id}", json={
            "baby_count": 3,
            "remarks": "人工核查后修正数量"
        })
        
        history_response = client.get(f"/api/handover/{record_id}/history")
        history = history_response.json()
        
        change_types = [h["change_type"] for h in history]
        assert "标记人工处理" in change_types
        assert "撤回" in change_types
        assert "更新" in change_types
        
        print("✓ 人工处理后完整流程留痕成功")


class TestExportFunction:
    """测试导出功能"""

    def test_export_json_with_business_fields(self):
        """测试JSON导出使用业务语言字段名"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        response = client.get(f"/api/handover/{record_id}/export?format=json")
        export_data = response.json()
        
        business_fields = ["交接编号", "交接日期", "接班护士", "交班护士", "状态", "新生儿数量"]
        for field in business_fields:
            assert field in export_data
        
        print("✓ JSON导出使用业务语言字段名成功")
        print(f"  业务字段示例: {list(export_data.keys())[:8]}")

    def test_export_all(self):
        """测试批量导出"""
        create_sample_handover()
        create_sample_handover()
        
        response = client.get("/api/handover/export/all")
        export_list = response.json()
        
        assert len(export_list) == 2
        assert "交接编号" in export_list[0]
        assert "交接日期" in export_list[0]
        print("✓ 批量导出成功")


class TestErrorHandling:
    """测试错误处理"""

    def test_get_nonexistent_record(self):
        """测试获取不存在的记录"""
        response = client.get("/api/handover/nonexistent_id")
        assert response.status_code == 404
        error_detail = response.json()["detail"]
        assert "记录不存在" in error_detail["error"]
        print("✓ 不存在记录错误处理正确")

    def test_submit_wrong_status(self):
        """测试错误状态下提交"""
        handover = create_sample_handover()
        record_id = handover["id"]
        
        client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        
        response = client.post(f"/api/handover/{record_id}/submit?submitted_by=李秀英")
        assert response.status_code == 400
        print("✓ 错误状态提交处理正确")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("开始运行母婴护理站护理员夜班交接 API 测试")
    print("="*60 + "\n")
    
    pytest.main([__file__, "-v", "-s"])
