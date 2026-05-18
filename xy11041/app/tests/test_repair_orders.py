import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient
from main import app
from app.models.database import init_db, seed_data, RepairStatus, FaultType, AlarmLevel, TeamType

pytestmark = pytest.mark.asyncio

class TestRepairOrderFlow:
    @pytest.fixture(autouse=True)
    async def setup(self):
        await init_db()
        await seed_data()

    async def test_01_normal_complete_flow(self):
        """测试完整正常流程：创建->接单->开始处理->完成维修->验证->闭环"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_data = {
                "alarm_id": "ALM-TEST-001",
                "charger_id": "CP-TEST-001",
                "charger_name": "测试站01号桩",
                "station_id": "ST-TEST-001",
                "station_name": "测试运维站",
                "fault_type": FaultType.POWER_MODULE_FAILURE,
                "alarm_level": AlarmLevel.CRITICAL,
                "alarm_time": (datetime.now() - timedelta(hours=1)).isoformat(),
                "fault_description": "功率模块故障，输出电压不稳定",
                "manufacturer": "测试厂商",
                "model": "TEST-120KW",
                "location": "A区1号位",
                "remark": "请携带备用模块",
                "dispatch_user": "调度员-张",
                "assigned_team": TeamType.ELECTRICAL_TEAM,
                "team_leader": "李班长",
                "team_phone": "13800138000"
            }
            
            response = await client.post("/api/v1/repair-orders", json=create_data)
            assert response.status_code == 201, f"创建派修单失败: {response.text}"
            order_id = response.json()["order_id"]
            assert response.json()["status"] == RepairStatus.DISPATCHED
            
            response = await client.post(
                f"/api/v1/repair-orders/{order_id}/accept",
                json={"accept_user": "李班长"}
            )
            assert response.status_code == 200, f"接单失败: {response.text}"
            assert response.json()["status"] == RepairStatus.ACCEPTED
            
            now = datetime.now()
            response = await client.post(
                f"/api/v1/repair-orders/{order_id}/start-process",
                json={
                    "arrival_time": now.isoformat(),
                    "repair_start_time": (now + timedelta(minutes=10)).isoformat()
                }
            )
            assert response.status_code == 200, f"开始处理失败: {response.text}"
            assert response.json()["status"] == RepairStatus.IN_PROGRESS
            
            response = await client.post(
                f"/api/v1/repair-orders/{order_id}/complete-repair",
                json={
                    "repair_end_time": (now + timedelta(hours=2)).isoformat(),
                    "repair_content": "更换了3号功率模块，重新校准电压输出，测试充电3次正常",
                    "replaced_parts": "功率模块x1, 保险丝x2"
                }
            )
            assert response.status_code == 200, f"完成维修失败: {response.text}"
            assert response.json()["status"] == RepairStatus.PENDING_REVIEW
            
            response = await client.post(
                f"/api/v1/repair-orders/{order_id}/verify",
                json={
                    "verification_result": "故障已排除，充电桩恢复正常运行，连续充电1小时无异常",
                    "verification_user": "验证员-王"
                }
            )
            assert response.status_code == 200, f"验证失败: {response.text}"
            
            response = await client.post(
                f"/api/v1/repair-orders/{order_id}/close",
                json={"close_user": "审核员-赵"}
            )
            assert response.status_code == 200, f"闭环失败: {response.text}"
            assert response.json()["status"] == RepairStatus.CLOSED

    async def test_02_duplicate_accept_prevention(self):
        """测试重复接单拦截：同一告警被多个班组接单时应拦截"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_data = {
                "alarm_id": "ALM-TEST-DUP-001",
                "charger_id": "CP-TEST-002",
                "charger_name": "测试站02号桩",
                "station_id": "ST-TEST-001",
                "station_name": "测试运维站",
                "fault_type": FaultType.COMMUNICATION_FAILURE,
                "alarm_level": AlarmLevel.MAJOR,
                "alarm_time": datetime.now().isoformat(),
                "fault_description": "通信模块离线，数据无法上传",
                "manufacturer": "测试厂商",
                "model": "TEST-7KW",
                "location": "B区1号位",
                "remark": "",
                "dispatch_user": "调度员-张",
                "assigned_team": TeamType.COMMUNICATION_TEAM,
                "team_leader": "王班长",
                "team_phone": "13900139000"
            }
            
            response = await client.post("/api/v1/repair-orders", json=create_data)
            assert response.status_code == 201
            order_id_1 = response.json()["order_id"]
            
            create_data_2 = create_data.copy()
            create_data_2["assigned_team"] = TeamType.ELECTRICAL_TEAM
            create_data_2["team_leader"] = "李班长"
            create_data_2["team_phone"] = "13800138000"
            
            response = await client.post("/api/v1/repair-orders", json=create_data_2)
            assert response.status_code == 201
            order_id_2 = response.json()["order_id"]
            
            response = await client.post(
                f"/api/v1/repair-orders/{order_id_1}/accept",
                json={"accept_user": "王班长"}
            )
            assert response.status_code == 200
            
            response = await client.post(
                f"/api/v1/repair-orders/{order_id_2}/accept",
                json={"accept_user": "李班长"}
            )
            assert response.status_code == 400, "重复接单应该被拦截"
            error_detail = response.json()["detail"]
            assert error_detail["error_code"] == "DUPLICATE_ACCEPT"
            assert "已被" in error_detail["detail"]["intercept_reason"]
            assert len(error_detail["detail"]["suggestions"]) > 0
            assert "existing_orders" in error_detail["detail"]

    async def test_03_inconsistent_closure_prevention(self):
        """测试闭环一致性校验：信息不完整时应拦截"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_data = {
                "alarm_id": "ALM-TEST-CLOSE-001",
                "charger_id": "CP-TEST-003",
                "charger_name": "测试站03号桩",
                "station_id": "ST-TEST-001",
                "station_name": "测试运维站",
                "fault_type": FaultType.GUN_LOCK_FAILURE,
                "alarm_level": AlarmLevel.MINOR,
                "alarm_time": datetime.now().isoformat(),
                "fault_description": "充电枪锁止机构故障",
                "manufacturer": "测试厂商",
                "model": "TEST-60KW",
                "location": "C区1号位",
                "remark": "",
                "dispatch_user": "调度员-张",
                "assigned_team": TeamType.MECHANICAL_TEAM,
                "team_leader": "赵班长",
                "team_phone": "13700137000"
            }
            
            response = await client.post("/api/v1/repair-orders", json=create_data)
            order_id = response.json()["order_id"]
            
            await client.post(f"/api/v1/repair-orders/{order_id}/accept", json={"accept_user": "赵班长"})
            
            now = datetime.now()
            await client.post(
                f"/api/v1/repair-orders/{order_id}/start-process",
                json={
                    "arrival_time": now.isoformat(),
                    "repair_start_time": (now + timedelta(minutes=10)).isoformat()
                }
            )
            
            await client.post(
                f"/api/v1/repair-orders/{order_id}/complete-repair",
                json={
                    "repair_end_time": (now + timedelta(hours=1)).isoformat(),
                    "repair_content": "更换锁止机构",
                    "replaced_parts": "锁止机构x1"
                }
            )
            
            response = await client.post(
                f"/api/v1/repair-orders/{order_id}/close",
                json={"close_user": "审核员-赵"}
            )
            assert response.status_code == 400, "信息不完整应该被拦截"
            error_detail = response.json()["detail"]
            assert error_detail["error_code"] == "INCONSISTENT_CLOSURE"
            assert "故障闭环信息不完整" in error_detail["message"]
            assert len(error_detail["detail"]["issues"]) > 0
            assert len(error_detail["detail"]["suggestions"]) > 0

    async def test_04_invalid_status_transition(self):
        """测试无效状态流转拦截"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_data = {
                "alarm_id": "ALM-TEST-STATUS-001",
                "charger_id": "CP-TEST-004",
                "charger_name": "测试站04号桩",
                "station_id": "ST-TEST-001",
                "station_name": "测试运维站",
                "fault_type": FaultType.SCREEN_FAILURE,
                "alarm_level": AlarmLevel.MINOR,
                "alarm_time": datetime.now().isoformat(),
                "fault_description": "触摸屏无响应",
                "manufacturer": "测试厂商",
                "model": "TEST-60KW",
                "location": "D区1号位",
                "remark": "",
                "dispatch_user": "调度员-张",
                "assigned_team": TeamType.ELECTRICAL_TEAM,
                "team_leader": "李班长",
                "team_phone": "13800138000"
            }
            
            response = await client.post("/api/v1/repair-orders", json=create_data)
            order_id = response.json()["order_id"]
            
            now = datetime.now()
            response = await client.post(
                f"/api/v1/repair-orders/{order_id}/start-process",
                json={
                    "arrival_time": now.isoformat(),
                    "repair_start_time": now.isoformat()
                }
            )
            assert response.status_code == 400, "未接单直接开始处理应该被拦截"
            error_detail = response.json()["detail"]
            assert error_detail["error_code"] == "INVALID_STATUS"

    async def test_05_reject_order(self):
        """测试驳回派修单功能"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_data = {
                "alarm_id": "ALM-TEST-REJECT-001",
                "charger_id": "CP-TEST-005",
                "charger_name": "测试站05号桩",
                "station_id": "ST-TEST-001",
                "station_name": "测试运维站",
                "fault_type": FaultType.OTHER,
                "alarm_level": AlarmLevel.WARNING,
                "alarm_time": datetime.now().isoformat(),
                "fault_description": "其他故障",
                "manufacturer": "测试厂商",
                "model": "TEST-60KW",
                "location": "E区1号位",
                "remark": "",
                "dispatch_user": "调度员-张",
                "assigned_team": TeamType.COMPREHENSIVE_TEAM,
                "team_leader": "周班长",
                "team_phone": "13600136000"
            }
            
            response = await client.post("/api/v1/repair-orders", json=create_data)
            order_id = response.json()["order_id"]
            
            response = await client.post(
                f"/api/v1/repair-orders/{order_id}/reject",
                json={"reject_reason": "该故障不属于本班组职责范围，需转其他班组处理"}
            )
            assert response.status_code == 200, "驳回失败"
            assert response.json()["status"] == RepairStatus.REJECTED
            assert "不属于本班组职责范围" in response.json()["reject_reason"]

    async def test_06_list_and_get_orders(self):
        """测试查询派修单列表和详情"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/repair-orders")
            assert response.status_code == 200
            assert len(response.json()) >= 2
            
            response = await client.get(f"/api/v1/repair-orders?status={RepairStatus.DISPATCHED}")
            assert response.status_code == 200
            
            all_orders = await client.get("/api/v1/repair-orders")
            order_id = all_orders.json()[0]["order_id"]
            
            response = await client.get(f"/api/v1/repair-orders/{order_id}")
            assert response.status_code == 200
            assert response.json()["order_id"] == order_id
            
            response = await client.get("/api/v1/repair-orders/NONEXISTENT")
            assert response.status_code == 404

    async def test_07_seed_data_exists(self):
        """测试种子数据已正确加载"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/repair-orders")
            orders = response.json()
            
            order_ids = [o["order_id"] for o in orders]
            assert any("RO-" in oid for oid in order_ids), "种子派修单应该存在"
            
            charger_names = [o["charger_name"] for o in orders]
            assert any("西城站" in name for name in charger_names), "种子数据应该包含西城站信息"

    async def test_08_error_response_structure(self):
        """测试错误响应结构是否完整"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/v1/repair-orders/INVALID-ID")
            assert response.status_code == 404
            error_detail = response.json()["detail"]
            
            assert "error_code" in error_detail
            assert "message" in error_detail
            assert "detail" in error_detail
            assert "intercept_reason" in error_detail["detail"]
            assert "suggestions" in error_detail["detail"]
            assert "timestamp" in error_detail
