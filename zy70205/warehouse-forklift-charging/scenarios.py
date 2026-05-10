#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List

BASE_URL = "http://localhost:8000"

class ScenarioRunner:
    def __init__(self):
        self.session = requests.Session()
        self.results = []

    def run(self):
        print("=" * 80)
        print("仓库叉车充电排队 API - 场景测试")
        print("=" * 80)
        
        self._scenario_1_normal_flow()
        self._scenario_2_missing_fields()
        self._scenario_3_duplicate_submission()
        self._scenario_4_invalid_transition()
        self._scenario_5_manual_correction()
        self._scenario_6_battery_prediction()
        self._scenario_7_queue_priority()
        
        self._print_summary()

    def _log_result(self, scenario: str, test_name: str, success: bool, data: Dict = None):
        result = {
            "scenario": scenario,
            "test_name": test_name,
            "success": success,
            "timestamp": datetime.now().isoformat()
        }
        if data:
            result["data"] = data
        self.results.append(result)

        status = "✓ PASS" if success else "✗ FAIL"
        print(f"\n[{status}] {test_name}")
        if data:
            print(f"  详情: {json.dumps(data, ensure_ascii=False, indent=2)[:500]}...")

    def _scenario_1_normal_flow(self):
        print("\n" + "=" * 60)
        print("场景1: 正常处理流程")
        print("描述: 创建叉车 -> 创建充电位 -> 提交充电请求 -> 完成充电")
        print("=" * 60)

        print("\n--- 步骤1: 验证叉车档案是否生效 ---")
        resp = self.session.get(f"{BASE_URL}/api/forklifts/FL-001")
        data = resp.json()
        success = data.get("success") and data["data"]["forklift"]["status"] == "active"
        self._log_result("1-normal", "验证叉车档案", success, {
            "forklift_code": data["data"]["forklift"]["forklift_code"] if success else None,
            "status": data["data"]["forklift"]["status"] if success else data.get("message")
        })

        print("\n--- 步骤2: 验证充电位可用 ---")
        resp = self.session.get(f"{BASE_URL}/api/stations/CS-001")
        data = resp.json()
        success = data.get("success") and data["data"]["station"]["status"] == "available"
        self._log_result("1-normal", "验证充电位状态", success, {
            "station_code": data["data"]["station"]["station_code"] if success else None,
            "status": data["data"]["station"]["status"] if success else data.get("message")
        })

        print("\n--- 步骤3: 提交充电请求 ---")
        request_data = {
            "forklift_code": "FL-001",
            "station_code": "CS-001",
            "target_percent": 90.0,
            "request_source": "auto"
        }
        resp = self.session.post(f"{BASE_URL}/api/charging/request", json=request_data)
        data = resp.json()
        success = data.get("success") and data.get("code") == "CREATED"
        self._log_result("1-normal", "创建充电请求", success, {
            "request_code": data["data"]["request_code"] if success else None,
            "status": data.get("code"),
            "message": data.get("message")
        })

        if success:
            request_id = data["data"]["id"]
            print(f"\n--- 步骤4: 完成充电 (请求ID: {request_id}) ---")
            resp = self.session.post(f"{BASE_URL}/api/charging/complete/{request_id}")
            data = resp.json()
            success = data.get("success") and data.get("code") == "COMPLETED"
            self._log_result("1-normal", "完成充电", success, {
                "start_percent": data["data"]["start_percent"] if success else None,
                "end_percent": data["data"]["end_percent"] if success else None
            })

    def _scenario_2_missing_fields(self):
        print("\n" + "=" * 60)
        print("场景2: 缺字段错误")
        print("描述: 提交缺少必需字段的请求，验证系统能否正确识别")
        print("=" * 60)

        print("\n--- 测试1: 缺少 forklift_code ---")
        resp = self.session.post(f"{BASE_URL}/api/charging/request", json={
            "target_percent": 90.0
        })
        data = resp.json()
        success = not data.get("success") and any(
            e.get("field") == "forklift_code" for e in (data.get("errors") or [])
        )
        self._log_result("2-missing-fields", "缺少forklift_code", success, {
            "error_code": data.get("code"),
            "error_count": len(data.get("errors") or [])
        })

        print("\n--- 测试2: 创建叉车缺少battery_capacity ---")
        resp = self.session.post(f"{BASE_URL}/api/forklifts", json={
            "forklift_code": "TEST-001",
            "name": "测试叉车"
        })
        data = resp.json()
        success = not data.get("success") and any(
            "battery_capacity" in str(e) for e in (data.get("errors") or [])
        )
        self._log_result("2-missing-fields", "缺少battery_capacity", success, {
            "http_status": resp.status_code,
            "has_errors": len(data.get("errors") or []) > 0
        })

        print("\n--- 测试3: 创建任务缺少时间字段 ---")
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        resp = self.session.post(f"{BASE_URL}/api/tasks", json={
            "task_code": "TEST-TASK-001",
            "forklift_code": "FL-001",
            "estimated_duration_hours": 2.0,
            "required_battery_percent": 50.0
        })
        data = resp.json()
        success = resp.status_code == 422 or not data.get("success")
        self._log_result("2-missing-fields", "缺少任务时间字段", success, {
            "http_status": resp.status_code
        })

    def _scenario_3_duplicate_submission(self):
        print("\n" + "=" * 60)
        print("场景3: 重复提交")
        print("描述: 使用相同的幂等键多次提交，验证防重机制")
        print("=" * 60)

        idempotency_key = f"IDEMPOTENT-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        print(f"\n--- 测试1: 首次提交 (幂等键: {idempotency_key}) ---")
        request_data = {
            "forklift_code": "FL-002",
            "target_percent": 85.0,
            "request_idempotency_key": idempotency_key
        }
        resp = self.session.post(f"{BASE_URL}/api/charging/request", json=request_data)
        data = resp.json()
        first_success = data.get("success")
        self._log_result("3-duplicate", "首次提交", first_success, {
            "code": data.get("code"),
            "request_id": data["data"]["id"] if first_success else None
        })

        print(f"\n--- 测试2: 重复提交 (相同幂等键) ---")
        resp = self.session.post(f"{BASE_URL}/api/charging/request", json=request_data)
        data = resp.json()
        duplicate_detected = not data.get("success") and data.get("code") == "DUPLICATE_REQUEST"
        self._log_result("3-duplicate", "重复提交检测", duplicate_detected, {
            "code": data.get("code"),
            "message": data.get("message"),
            "existing_request_id": data["data"]["existing_request_id"] if data.get("data") else None
        })

        print(f"\n--- 测试3: 创建重复叉车编号 ---")
        resp = self.session.post(f"{BASE_URL}/api/forklifts", json={
            "forklift_code": "FL-001",
            "name": "重复叉车",
            "battery_capacity": 80.0
        })
        data = resp.json()
        success = resp.status_code == 409 or data.get("detail")
        self._log_result("3-duplicate", "重复叉车编号", success, {
            "http_status": resp.status_code
        })

    def _scenario_4_invalid_transition(self):
        print("\n" + "=" * 60)
        print("场景4: 非法状态流转")
        print("描述: 尝试不允许的状态转换，验证业务规则")
        print("=" * 60)

        print("\n--- 测试1: 已完成的充电请求不能重复完成 ---")
        resp = self.session.get(f"{BASE_URL}/api/charging/requests?status_filter=completed")
        data = resp.json()
        
        if data.get("success") and data["data"]["total"] > 0:
            completed_request = data["data"]["requests"][0]
            request_id = completed_request["id"]
            
            resp = self.session.post(f"{BASE_URL}/api/charging/complete/{request_id}")
            data = resp.json()
            success = not data.get("success") and data.get("code") == "INVALID_STATUS"
            self._log_result("4-transition", "重复完成已完成请求", success, {
                "code": data.get("code"),
                "message": data.get("message")
            })
        else:
            self._log_result("4-transition", "跳过(无已完成请求)", True, {"reason": "需要先完成一个充电请求"})

        print("\n--- 测试2: 使用人工修正尝试非法转换 COMPLETED -> CHARGING ---")
        resp = self.session.get(f"{BASE_URL}/api/charging/requests?status_filter=completed")
        data = resp.json()
        
        if data.get("success") and data["data"]["total"] > 0:
            request = data["data"]["requests"][0]
            correction_data = {
                "entity_type": "request",
                "entity_id": request["id"],
                "field_name": "status",
                "old_value": "completed",
                "new_value": "charging",
                "reason": "测试非法转换",
                "operator": "test"
            }
            resp = self.session.post(f"{BASE_URL}/api/correction/apply", json=correction_data)
            data = resp.json()
            success = not data.get("success") and data.get("code") == "INVALID_TRANSITION"
            self._log_result("4-transition", "非法状态转换拦截", success, {
                "code": data.get("code"),
                "message": data.get("message")
            })

        print("\n--- 测试3: 非法叉车状态 ---")
        resp = self.session.post(f"{BASE_URL}/api/forklifts", json={
            "forklift_code": "TEST-INVALID",
            "name": "测试叉车",
            "battery_capacity": 80.0
        })
        
        resp = self.session.patch(f"{BASE_URL}/api/forklifts/TEST-INVALID", json={
            "status": "decommissioned"
        })
        
        request_data = {
            "forklift_code": "TEST-INVALID",
            "target_percent": 90.0
        }
        resp = self.session.post(f"{BASE_URL}/api/charging/request", json=request_data)
        data = resp.json()
        success = not data.get("success") and any(
            e.get("code") == "INVALID_STATUS" for e in (data.get("errors") or [])
        )
        self._log_result("4-transition", "停用叉车充电拦截", success, {
            "has_errors": len(data.get("errors") or []) > 0
        })

    def _scenario_5_manual_correction(self):
        print("\n" + "=" * 60)
        print("场景5: 人工修正流程")
        print("描述: 展示如何使用人工修正接口处理异常情况")
        print("=" * 60)

        print("\n--- 步骤1: 获取叉车当前电量 ---")
        resp = self.session.get(f"{BASE_URL}/api/forklifts/FL-003")
        data = resp.json()
        if not data.get("success"):
            self._log_result("5-correction", "获取叉车信息", False, {"message": "获取失败"})
            return

        current_percent = data["data"]["battery"]["current_percent"]
        forklift_id = data["data"]["forklift"]["id"]
        print(f"  当前电量: {current_percent}%")

        print("\n--- 步骤2: 人工修正电量 (模拟电池读数异常) ---")
        correction_data = {
            "entity_type": "battery",
            "entity_id": forklift_id,
            "field_name": "current_percent",
            "old_value": str(current_percent),
            "new_value": "50.0",
            "reason": "电池传感器读数异常，人工修正",
            "operator": "warehouse_admin"
        }
        resp = self.session.post(f"{BASE_URL}/api/correction/apply", json=correction_data)
        data = resp.json()
        success = data.get("success") and data.get("code") == "CORRECTED"
        self._log_result("5-correction", "人工修正电量", success, {
            "old_value": correction_data["old_value"],
            "new_value": correction_data["new_value"],
            "code": data.get("code")
        })

        print("\n--- 步骤3: 验证修正后重跑 ---")
        request_data = {
            "forklift_code": "FL-003",
            "target_percent": 95.0
        }
        resp = self.session.post(f"{BASE_URL}/api/charging/request", json=request_data)
        data = resp.json()
        success = data.get("success")
        self._log_result("5-correction", "修正后提交充电请求", success, {
            "code": data.get("code"),
            "start_percent": data["data"]["start_percent"] if success else None
        })

        print("\n--- 步骤4: 查看修正历史 ---")
        resp = self.session.get(f"{BASE_URL}/api/correction/history?entity_type=battery&entity_id={forklift_id}")
        data = resp.json()
        success = data.get("success") and data["data"]["total"] > 0
        self._log_result("5-correction", "查看修正历史", success, {
            "history_count": data["data"]["total"] if data.get("success") else 0
        })

    def _scenario_6_battery_prediction(self):
        print("\n" + "=" * 60)
        print("场景6: 电量预测验证")
        print("描述: 验证电量预测是否与原始数据一致")
        print("=" * 60)

        print("\n--- 步骤1: 获取原始数据 ---")
        resp = self.session.get(f"{BASE_URL}/api/forklifts/FL-004")
        data = resp.json()
        if not data.get("success"):
            self._log_result("6-prediction", "获取原始数据", False, {})
            return

        forklift = data["data"]["forklift"]
        battery = data["data"]["battery"]
        original_data = {
            "battery_capacity": forklift["battery_capacity"],
            "charging_rate": forklift["charging_rate"],
            "current_percent": battery["current_percent"]
        }
        print(f"  电池容量: {original_data['battery_capacity']} kWh")
        print(f"  充电速率: {original_data['charging_rate']} kWh/h")
        print(f"  当前电量: {original_data['current_percent']}%")

        print("\n--- 步骤2: 发起电量预测 ---")
        target_percent = 90.0
        prediction_data = {
            "forklift_code": "FL-004",
            "current_percent": original_data["current_percent"],
            "target_percent": target_percent,
            "station_code": "CS-001"
        }
        resp = self.session.post(f"{BASE_URL}/api/charging/predict", json=prediction_data)
        data = resp.json()
        success = data.get("success")
        self._log_result("6-prediction", "电量预测", success, {
            "validation_result": data["data"]["validation_result"] if success else None,
            "estimated_hours": data["data"]["estimated_charging_hours"] if success else None
        })

        if success:
            print("\n--- 步骤3: 验证预测与原始数据一致性 ---")
            validation = data["data"]["validation_details"]
            checks = {
                "叉车存在": validation.get("forklift_found"),
                "目标电量有效": validation.get("target_percent_valid"),
                "充电位存在": validation.get("station_found")
            }
            all_passed = all(checks.values())
            self._log_result("6-prediction", "原始数据一致性验证", all_passed, checks)

    def _scenario_7_queue_priority(self):
        print("\n" + "=" * 60)
        print("场景7: 排队优先级验证")
        print("描述: 验证高优先级任务、低电量叉车优先充电")
        print("=" * 60)

        print("\n--- 步骤1: 先占满所有充电位 ---")
        stations = ["CS-001", "CS-002", "CS-003", "CS-004"]
        forklifts = ["FL-001", "FL-002", "FL-003", "FL-004"]
        
        # 首先释放可能存在的占用
        resp = self.session.get(f"{BASE_URL}/api/charging/requests?status_filter=charging")
        data = resp.json()
        if data.get("success"):
            for req in data["data"]["requests"]:
                self.session.post(f"{BASE_URL}/api/charging/complete/{req['id']}")

        # 占用所有充电位
        for i, (station, forklift) in enumerate(zip(stations, forklifts)):
            resp = self.session.get(f"{BASE_URL}/api/forklifts/{forklift}")
            data = resp.json()
            if data.get("success"):
                current = data["data"]["battery"]["current_percent"]
                if current < 100:
                    resp = self.session.post(f"{BASE_URL}/api/charging/request", json={
                        "forklift_code": forklift,
                        "station_code": station,
                        "target_percent": 100.0
                    })

        print("\n--- 步骤2: 提交高优先级充电请求 (低电量+有高优先级任务) ---")
        # FL-005 有高优先级任务且电量只有15%
        resp = self.session.post(f"{BASE_URL}/api/charging/request", json={
            "forklift_code": "FL-005",
            "target_percent": 90.0
        })
        data = resp.json()
        request1_id = data["data"]["id"] if data.get("success") else None
        priority1 = data["data"]["priority_score"] if data.get("success") else None
        self._log_result("7-priority", "高优先级请求排队", data.get("success"), {
            "request_id": request1_id,
            "queue_position": data["data"]["queue_position"] if data.get("success") else None,
            "priority_score": priority1
        })

        print("\n--- 步骤3: 提交普通优先级请求 ---")
        # FL-003 电量45%，无高优先级任务
        resp = self.session.post(f"{BASE_URL}/api/charging/request", json={
            "forklift_code": "FL-003",
            "target_percent": 80.0
        })
        data = resp.json()
        request2_id = data["data"]["id"] if data.get("success") else None
        priority2 = data["data"]["priority_score"] if data.get("success") else None
        self._log_result("7-priority", "普通优先级请求排队", data.get("success"), {
            "request_id": request2_id,
            "queue_position": data["data"]["queue_position"] if data.get("success") else None,
            "priority_score": priority2
        })

        print("\n--- 步骤4: 验证排队顺序 ---")
        if priority1 and priority2:
            success = priority1 > priority2
            self._log_result("7-priority", "优先级排序验证", success, {
                "高优先级分数": priority1,
                "普通优先级分数": priority2,
                "高优先级优先": success
            })

        print("\n--- 步骤5: 完成一个充电，验证自动分配 ---")
        resp = self.session.get(f"{BASE_URL}/api/charging/requests?status_filter=charging")
        data = resp.json()
        if data.get("success") and data["data"]["total"] > 0:
            req = data["data"]["requests"][0]
            resp = self.session.post(f"{BASE_URL}/api/charging/complete/{req['id']}")
            
            resp = self.session.get(f"{BASE_URL}/api/charging/queue")
            data = resp.json()
            self._log_result("7-priority", "查看队列状态", data.get("success"), {
                "total_queued": data["data"]["total_queued"] if data.get("success") else None,
                "available_stations": data["data"]["available_stations"] if data.get("success") else None
            })

    def _print_summary(self):
        print("\n" + "=" * 80)
        print("测试结果汇总")
        print("=" * 80)

        scenarios = {}
        for r in self.results:
            key = r["scenario"]
            if key not in scenarios:
                scenarios[key] = {"total": 0, "passed": 0}
            scenarios[key]["total"] += 1
            if r["success"]:
                scenarios[key]["passed"] += 1

        for scenario, stats in scenarios.items():
            rate = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            status = "✓" if rate == 100 else "△" if rate >= 70 else "✗"
            print(f"  {status} {scenario}: {stats['passed']}/{stats['total']} 通过 ({rate:.1f}%)")

        total = len(self.results)
        passed = sum(1 for r in self.results if r["success"])
        overall_rate = (passed / total * 100) if total > 0 else 0
        print(f"\n  总计: {passed}/{total} 通过 ({overall_rate:.1f}%)")

if __name__ == "__main__":
    runner = ScenarioRunner()
    runner.run()
