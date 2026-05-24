import requests
import json
import sys
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def time_offset(hours):
    return (datetime.now() + timedelta(hours=hours)).isoformat()


class SelfCheck:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []

    def check(self, name, func):
        try:
            func()
            self.passed += 1
            self.results.append(("✅", name))
            print(f"✅ {name}")
        except AssertionError as e:
            self.failed += 1
            self.results.append(("❌", name))
            print(f"❌ {name}")
            print(f"   错误: {e}")
        except Exception as e:
            self.failed += 1
            self.results.append(("❌", name))
            print(f"❌ {name}")
            print(f"   异常: {e}")

    def summary(self):
        print(f"\n{'='*50}")
        print(f"自检结果: 通过 {self.passed}/{self.passed + self.failed}")
        if self.failed == 0:
            print("🎉 所有检查通过！")
        else:
            print(f"⚠️  有 {self.failed} 项检查失败")
        return self.failed == 0


def test_health_check(checker):
    response = requests.get(f"{BASE_URL}/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "healthy"


def test_submit_normal(checker):
    data = {
        "batch_number": "TEST-BATCH-001",
        "sterilization_cycle": "TEST-CYCLE-001",
        "operating_room": "手术室1",
        "receiving_nurse": "测试护士",
        "isolation_reason": "正常提交测试",
        "submission_time": time_offset(-2),
        "surgery_time": time_offset(-1),
        "supplementary_info": "测试数据"
    }
    response = requests.post(f"{BASE_URL}/api/raw-materials/", json=data)
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "created"
    assert "order_no" in result
    assert "order_id" in result
    return result["order_id"]


def test_late_submission_detection(checker):
    data = {
        "batch_number": "TEST-BATCH-002",
        "sterilization_cycle": "TEST-CYCLE-002",
        "operating_room": "手术室2",
        "receiving_nurse": "测试护士",
        "isolation_reason": "迟交测试",
        "submission_time": time_offset(-1),
        "surgery_time": time_offset(-2),
        "supplementary_info": None
    }
    response = requests.post(f"{BASE_URL}/api/raw-materials/", json=data)
    assert response.status_code == 200
    result = response.json()
    assert result["flags"]["is_late_submission"] == True
    assert "迟交" in str(result["validation"]["issues"][0]) or result["validation"]["risk_level"] == "high"


def test_duplicate_submission(checker):
    data = {
        "batch_number": "TEST-BATCH-003",
        "sterilization_cycle": "TEST-CYCLE-003",
        "operating_room": "手术室1",
        "receiving_nurse": "测试护士A",
        "isolation_reason": "重复提交测试-第一次",
        "submission_time": time_offset(-3),
        "surgery_time": time_offset(-4),
        "supplementary_info": None
    }
    response1 = requests.post(f"{BASE_URL}/api/raw-materials/", json=data)
    assert response1.status_code == 200
    result1 = response1.json()
    assert result1["status"] == "created"

    data2 = data.copy()
    data2["operating_room"] = "手术室2"
    data2["receiving_nurse"] = "测试护士B"
    data2["isolation_reason"] = "重复提交测试-第二次"
    
    response2 = requests.post(f"{BASE_URL}/api/raw-materials/", json=data2)
    assert response2.status_code == 200
    result2 = response2.json()
    assert result2["status"] == "duplicate"
    assert "有效记录" in result2["message"]
    assert "existing_order" in result2


def test_cross_room_detection(checker):
    data1 = {
        "batch_number": "TEST-BATCH-004",
        "sterilization_cycle": "TEST-CYCLE-004",
        "operating_room": "手术室1",
        "receiving_nurse": "测试护士",
        "isolation_reason": "跨房间测试-第一次",
        "submission_time": time_offset(-5),
        "surgery_time": time_offset(-6),
        "supplementary_info": None
    }
    response1 = requests.post(f"{BASE_URL}/api/raw-materials/", json=data1)
    assert response1.status_code == 200

    data2 = {
        "batch_number": "TEST-BATCH-004",
        "sterilization_cycle": "TEST-CYCLE-005",
        "operating_room": "手术室2",
        "receiving_nurse": "测试护士",
        "isolation_reason": "跨房间测试-第二次",
        "submission_time": time_offset(-7),
        "surgery_time": time_offset(-8),
        "supplementary_info": None
    }
    response2 = requests.post(f"{BASE_URL}/api/raw-materials/", json=data2)
    assert response2.status_code == 200
    result2 = response2.json()
    assert result2["flags"]["cross_room_usage"] == True


def test_approve_decision(checker):
    data = {
        "batch_number": "TEST-BATCH-APPROVE",
        "sterilization_cycle": "TEST-CYCLE-APPROVE",
        "operating_room": "手术室5",
        "receiving_nurse": "测试护士",
        "isolation_reason": "放行测试",
        "submission_time": time_offset(-10),
        "surgery_time": time_offset(-11),
        "supplementary_info": None
    }
    response = requests.post(f"{BASE_URL}/api/raw-materials/", json=data)
    order_id = response.json()["order_id"]

    decision = {
        "isolation_order_id": order_id,
        "decision_type": "approve",
        "conclusion": "同意放行",
        "reason": "材料齐全",
        "operator": "测试复核员",
        "supplementary_evidence": "测试证据"
    }
    response = requests.post(f"{BASE_URL}/api/decisions/", json=decision)
    assert response.status_code == 200
    result = response.json()
    assert result["order_status"] == "released"


def test_duplicate_release_block(checker):
    data = {
        "batch_number": "TEST-BATCH-BLOCK",
        "sterilization_cycle": "TEST-CYCLE-BLOCK",
        "operating_room": "手术室6",
        "receiving_nurse": "测试护士",
        "isolation_reason": "重复放行拦截测试",
        "submission_time": time_offset(-12),
        "surgery_time": time_offset(-13),
        "supplementary_info": None
    }
    response = requests.post(f"{BASE_URL}/api/raw-materials/", json=data)
    order_id = response.json()["order_id"]

    decision = {
        "isolation_order_id": order_id,
        "decision_type": "approve",
        "conclusion": "第一次放行",
        "reason": "材料齐全",
        "operator": "测试复核员"
    }
    response1 = requests.post(f"{BASE_URL}/api/decisions/", json=decision)
    assert response1.status_code == 200

    response2 = requests.post(f"{BASE_URL}/api/decisions/", json=decision)
    assert response2.status_code == 400
    assert "重复放行拦截" in response2.json()["detail"]


def test_reject_decision(checker):
    data = {
        "batch_number": "TEST-BATCH-REJECT",
        "sterilization_cycle": "TEST-CYCLE-REJECT",
        "operating_room": "手术室7",
        "receiving_nurse": "测试护士",
        "isolation_reason": "驳回测试",
        "submission_time": time_offset(-14),
        "surgery_time": time_offset(-15),
        "supplementary_info": None
    }
    response = requests.post(f"{BASE_URL}/api/raw-materials/", json=data)
    order_id = response.json()["order_id"]

    decision = {
        "isolation_order_id": order_id,
        "decision_type": "reject",
        "conclusion": "驳回",
        "reason": "材料不全",
        "operator": "测试复核员"
    }
    response = requests.post(f"{BASE_URL}/api/decisions/", json=decision)
    assert response.status_code == 200
    result = response.json()
    assert result["order_status"] == "rejected"


def test_supplement_decision(checker):
    data = {
        "batch_number": "TEST-BATCH-SUPP",
        "sterilization_cycle": "TEST-CYCLE-SUPP",
        "operating_room": "手术室8",
        "receiving_nurse": "测试护士",
        "isolation_reason": "补证测试",
        "submission_time": time_offset(-16),
        "surgery_time": time_offset(-17),
        "supplementary_info": None
    }
    response = requests.post(f"{BASE_URL}/api/raw-materials/", json=data)
    order_id = response.json()["order_id"]

    decision = {
        "isolation_order_id": order_id,
        "decision_type": "supplement",
        "conclusion": "需要补证",
        "reason": "缺少消毒记录",
        "operator": "测试复核员",
        "supplementary_evidence": "请补充照片"
    }
    response = requests.post(f"{BASE_URL}/api/decisions/", json=decision)
    assert response.status_code == 200
    result = response.json()
    assert result["order_status"] == "pending"


def test_export_report(checker):
    response = requests.get(f"{BASE_URL}/api/export/report")
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    content = response.text
    assert "隔离单号" in content
    assert "批号" in content


def test_batch_trace(checker):
    response = requests.get(f"{BASE_URL}/api/batch-trace/TEST-BATCH-004")
    assert response.status_code == 200
    data = response.json()
    assert "batch_number" in data
    assert "has_cross_room_usage" in data


def test_temp_package_change(checker):
    data = {
        "batch_number": "TEST-BATCH-TEMP",
        "sterilization_cycle": "TEST-CYCLE-TEMP",
        "operating_room": "手术室9",
        "receiving_nurse": "测试护士",
        "isolation_reason": "术中临时换包处理",
        "submission_time": time_offset(-18),
        "surgery_time": time_offset(-19),
        "supplementary_info": None
    }
    response = requests.post(f"{BASE_URL}/api/raw-materials/", json=data)
    assert response.status_code == 200
    result = response.json()
    assert result["flags"]["temp_package_change"] == True


def main():
    print("="*50)
    print("🔍 手术器械批号隔离 API - 轻量自检")
    print("="*50)

    try:
        requests.get(f"{BASE_URL}/api/health", timeout=3)
    except:
        print("❌ 无法连接到服务，请先启动服务:")
        print("   uvicorn main:app --reload")
        sys.exit(1)

    checker = SelfCheck()

    print("\n📋 基础功能检查")
    checker.check("服务健康检查", lambda: test_health_check(checker))
    checker.check("正常提交材料", lambda: test_submit_normal(checker))

    print("\n⚠️  校验规则检查")
    checker.check("迟交检测", lambda: test_late_submission_detection(checker))
    checker.check("重复提交检测", lambda: test_duplicate_submission(checker))
    checker.check("跨房间使用检测", lambda: test_cross_room_detection(checker))
    checker.check("临时换包标记", lambda: test_temp_package_change(checker))

    print("\n✅ 判定流程检查")
    checker.check("放行操作", lambda: test_approve_decision(checker))
    checker.check("驳回操作", lambda: test_reject_decision(checker))
    checker.check("补证操作", lambda: test_supplement_decision(checker))
    checker.check("重复放行拦截", lambda: test_duplicate_release_block(checker))

    print("\n📊 追踪与导出")
    checker.check("批号追踪", lambda: test_batch_trace(checker))
    checker.check("报告导出", lambda: test_export_report(checker))

    success = checker.summary()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
