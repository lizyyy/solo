import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite:///./test_rebalance.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def test_1_normal_flow():
    print_section("测试 1: 正常流程 - 完整生命周期")

    plan_data = {
        "source_shard": "shard-001",
        "target_node": "node-003",
        "target_shard": "shard-001-new",
        "tenant_distribution": [
            {
                "tenant_id": "tenant-a",
                "tenant_name": "租户A",
                "data_size_gb": 15.5,
                "qps": 800,
                "is_hot": False,
            },
            {
                "tenant_id": "tenant-b",
                "tenant_name": "租户B",
                "data_size_gb": 25.2,
                "qps": 1200,
                "is_hot": False,
            },
            {
                "tenant_id": "tenant-c",
                "tenant_name": "租户C",
                "data_size_gb": 10.0,
                "qps": 500,
                "is_hot": True,
            },
        ],
        "created_by": "admin",
    }

    print("\n[步骤 1] 创建重平衡计划...")
    response = client.post("/api/v1/rebalance/plans", json=plan_data)
    assert response.status_code == 200, f"创建失败: {response.text}"
    plan = response.json()
    plan_id = plan["id"]
    print(f"  ✓ 计划创建成功, ID: {plan_id}, 编号: {plan['plan_no']}")
    print(f"  ✓ 热点租户数量: {plan['hot_tenant_count']}")
    print(f"  ✓ 迁移流量: {plan['migration_traffic_gb']} GB")
    print(f"  ✓ 风险等级: {plan['risk_level']}, 分数: {plan['risk_score']}")
    assert plan["hot_tenant_count"] == 2, "应该识别到2个热点租户"
    assert plan["status"] == "draft", "初始状态应为草稿"

    print("\n[步骤 2] 提交审批...")
    response = client.post(
        f"/api/v1/rebalance/plans/{plan_id}/approval",
        json={"approver": "manager-a", "action": "submit", "comments": "请审批"},
    )
    assert response.status_code == 200, f"提交失败: {response.text}"
    plan = response.json()
    print(f"  ✓ 状态更新为: {plan['status']}")
    assert plan["status"] == "pending_approval", "提交后状态应为待审批"

    print("\n[步骤 3] 批准计划...")
    response = client.post(
        f"/api/v1/rebalance/plans/{plan_id}/approval",
        json={"approver": "manager-b", "action": "approve", "comments": "同意执行"},
    )
    assert response.status_code == 200, f"审批失败: {response.text}"
    plan = response.json()
    print(f"  ✓ 状态更新为: {plan['status']}")
    assert plan["status"] == "approved", "批准后状态应为已批准"

    print("\n[步骤 4] 开始执行...")
    response = client.put(
        f"/api/v1/rebalance/plans/{plan_id}/status",
        json={"new_status": "executing", "operator": "operator-a"},
    )
    assert response.status_code == 200, f"状态更新失败: {response.text}"
    plan = response.json()
    print(f"  ✓ 状态更新为: {plan['status']}")
    assert plan["status"] == "executing", "执行中状态"

    print("\n[步骤 5] 记录执行结果（成功）...")
    response = client.post(
        f"/api/v1/rebalance/plans/{plan_id}/execution",
        json={
            "success": True,
            "actual_traffic_gb": 52.0,
            "execution_details": {"steps_completed": 5, "total_steps": 5},
        },
    )
    assert response.status_code == 200, f"记录结果失败: {response.text}"
    execution = response.json()
    print(f"  ✓ 执行记录创建成功, 成功状态: {execution['success']}")

    print("\n[步骤 6] 验证最终状态...")
    response = client.get(f"/api/v1/rebalance/plans/{plan_id}")
    plan = response.json()
    print(f"  ✓ 最终状态: {plan['status']}")
    assert plan["status"] == "completed", "最终状态应为已完成"

    print("\n[步骤 7] 查询审批记录...")
    response = client.get(f"/api/v1/rebalance/plans/{plan_id}/approvals")
    approvals = response.json()
    print(f"  ✓ 审批记录数量: {len(approvals)}")
    assert len(approvals) == 2, "应该有2条审批记录"

    print("\n  ✓ 正常流程测试通过!")
    return plan_id


def test_2_dirty_data():
    print_section("测试 2: 脏数据处理 - 输入验证")

    print("\n[测试 2.1] 缺少必填字段...")
    response = client.post(
        "/api/v1/rebalance/plans",
        json={
            "source_shard": "",
            "target_node": "node-001",
            "tenant_distribution": [],
            "created_by": "admin",
        },
    )
    print(f"  ✓ 响应状态码: {response.status_code}")
    assert response.status_code == 422 or response.status_code == 400, "应该返回错误"

    print("\n[测试 2.2] 租户分布为空...")
    response = client.post(
        "/api/v1/rebalance/plans",
        json={
            "source_shard": "shard-002",
            "target_node": "node-001",
            "tenant_distribution": [],
            "created_by": "admin",
        },
    )
    print(f"  ✓ 响应状态码: {response.status_code}")
    assert response.status_code == 422 or response.status_code == 400, "应该返回错误"

    print("\n[测试 2.3] 无效的状态转换...")
    plan_data = {
        "source_shard": "shard-002",
        "target_node": "node-004",
        "tenant_distribution": [
            {
                "tenant_id": "tenant-x",
                "data_size_gb": 5.0,
                "qps": 100,
            }
        ],
        "created_by": "admin",
    }
    response = client.post("/api/v1/rebalance/plans", json=plan_data)
    plan_id = response.json()["id"]

    response = client.put(
        f"/api/v1/rebalance/plans/{plan_id}/status",
        json={"new_status": "completed", "operator": "operator-a"},
    )
    print(f"  ✓ 无效状态转换响应: {response.status_code}")
    assert response.status_code == 400, "无效转换应该返回400"

    print("\n[测试 2.4] 查询不存在的计划...")
    response = client.get("/api/v1/rebalance/plans/999999")
    print(f"  ✓ 不存在计划查询响应: {response.status_code}")
    assert response.status_code == 404, "应该返回404"

    print("\n[测试 2.5] 审批人不能为空...")
    response = client.post(
        f"/api/v1/rebalance/plans/{plan_id}/approval",
        json={"approver": "", "action": "approve"},
    )
    print(f"  ✓ 空审批人响应: {response.status_code}")
    assert response.status_code == 422, "应该返回422验证错误"

    print("\n  ✓ 脏数据处理测试通过!")


def test_3_duplicate_request():
    print_section("测试 3: 重复请求处理 - 幂等性验证")

    plan_data = {
        "source_shard": "shard-003",
        "target_node": "node-005",
        "tenant_distribution": [
            {"tenant_id": "tenant-y", "data_size_gb": 20.0, "qps": 200}
        ],
        "created_by": "admin",
    }

    print("\n[测试 3.1] 第一次创建计划...")
    response1 = client.post("/api/v1/rebalance/plans", json=plan_data)
    assert response1.status_code == 200
    plan1 = response1.json()
    print(f"  ✓ 计划1 ID: {plan1['id']}, 编号: {plan1['plan_no']}")

    print("\n[测试 3.2] 相同分片和目标节点的重复创建...")
    response2 = client.post("/api/v1/rebalance/plans", json=plan_data)
    print(f"  ✓ 重复创建响应: {response2.status_code}")
    assert response2.status_code == 400, "相同源分片和目标节点应该禁止"

    print("\n[测试 3.3] 不同目标节点应该允许...")
    plan_data["target_node"] = "node-006"
    response3 = client.post("/api/v1/rebalance/plans", json=plan_data)
    print(f"  ✓ 不同目标节点响应: {response3.status_code}")
    assert response3.status_code == 200, "不同目标节点应该允许"

    print("\n  ✓ 重复请求处理测试通过!")


def test_4_manual_correction_recalculation():
    print_section("测试 4: 人工修正后重新计算")

    plan_data = {
        "source_shard": "shard-004",
        "target_node": "node-007",
        "tenant_distribution": [
            {
                "tenant_id": "tenant-m",
                "tenant_name": "租户M",
                "data_size_gb": 10.0,
                "qps": 500,
                "is_hot": False,
            },
            {
                "tenant_id": "tenant-n",
                "tenant_name": "租户N",
                "data_size_gb": 20.0,
                "qps": 800,
                "is_hot": False,
            },
        ],
        "created_by": "admin",
    }

    print("\n[步骤 1] 创建初始计划...")
    response = client.post("/api/v1/rebalance/plans", json=plan_data)
    plan_id = response.json()["id"]
    initial_plan = response.json()
    print(f"  ✓ 初始热点数: {initial_plan['hot_tenant_count']}")
    print(f"  ✓ 初始流量: {initial_plan['migration_traffic_gb']} GB")
    print(f"  ✓ 初始风险分数: {initial_plan['risk_score']}")

    print("\n[步骤 2] 标记为需要修正状态...")
    response = client.post(
        f"/api/v1/rebalance/plans/{plan_id}/approval",
        json={"approver": "manager", "action": "submit"},
    )
    response = client.post(
        f"/api/v1/rebalance/plans/{plan_id}/approval",
        json={"approver": "manager", "action": "approve"},
    )
    response = client.put(
        f"/api/v1/rebalance/plans/{plan_id}/status",
        json={"new_status": "needs_correction", "operator": "operator"},
    )
    assert response.status_code == 200
    print(f"  ✓ 状态更新为: {response.json()['status']}")

    print("\n[步骤 3] 应用人工修正（修改租户分布）...")
    corrected_tenants = [
        {
            "tenant_id": "tenant-m",
            "tenant_name": "租户M（已修正）",
            "data_size_gb": 50.0,
            "qps": 1500,
            "is_hot": False,
        },
        {
            "tenant_id": "tenant-n",
            "tenant_name": "租户N（已修正）",
            "data_size_gb": 80.0,
            "qps": 2000,
            "is_hot": True,
        },
        {
            "tenant_id": "tenant-p",
            "tenant_name": "新增租户P",
            "data_size_gb": 30.0,
            "qps": 100,
            "is_hot": False,
        },
    ]

    response = client.post(
        f"/api/v1/rebalance/plans/{plan_id}/correction",
        json={
            "corrected_by": "operator-a",
            "corrected_values": {
                "tenant_distribution": corrected_tenants,
                "target_node": "node-008",
            },
            "correction_reason": "修正租户数据和目标节点",
        },
    )
    assert response.status_code == 200, f"修正失败: {response.text}"
    corrected_plan = response.json()

    print(f"  ✓ 修正后热点数: {corrected_plan['hot_tenant_count']}")
    print(f"  ✓ 修正后流量: {corrected_plan['migration_traffic_gb']} GB")
    print(f"  ✓ 修正后风险分数: {corrected_plan['risk_score']}")
    print(f"  ✓ 修正后目标节点: {corrected_plan['target_node']}")
    print(f"  ✓ 修正后状态: {corrected_plan['status']}")

    assert corrected_plan["hot_tenant_count"] == 2, "应该识别到2个热点租户"
    assert corrected_plan["migration_traffic_gb"] == 160.0, "流量应该重新计算为160GB"
    assert corrected_plan["target_node"] == "node-008", "目标节点应该已更新"
    assert corrected_plan["status"] == "draft", "修正后状态应为草稿"

    print("\n  ✓ 人工修正重新计算测试通过!")


def test_5_exception_handling_and_export():
    print_section("测试 5: 异常处理和导出功能")

    plan_data = {
        "source_shard": "shard-005",
        "target_node": "node-009",
        "tenant_distribution": [
            {"tenant_id": "tenant-z", "data_size_gb": 30.0, "qps": 300}
        ],
        "created_by": "admin",
    }

    print("\n[步骤 1] 创建计划并进入执行状态...")
    response = client.post("/api/v1/rebalance/plans", json=plan_data)
    plan_id = response.json()["id"]

    client.post(
        f"/api/v1/rebalance/plans/{plan_id}/approval",
        json={"approver": "manager", "action": "submit"},
    )
    client.post(
        f"/api/v1/rebalance/plans/{plan_id}/approval",
        json={"approver": "manager", "action": "approve"},
    )
    client.put(
        f"/api/v1/rebalance/plans/{plan_id}/status",
        json={"new_status": "executing", "operator": "operator"},
    )

    print("\n[步骤 2] 记录执行失败并保留原始输入...")
    response = client.post(
        f"/api/v1/rebalance/plans/{plan_id}/execution",
        json={
            "success": False,
            "error_message": "网络超时, 连接被重置",
        },
    )
    assert response.status_code == 200
    print(f"  ✓ 执行失败已记录")

    print("\n[步骤 3] 记录详细失败信息...")
    response = client.post(
        f"/api/v1/rebalance/plans/{plan_id}/failure?failed_step=数据同步&final_conclusion=源节点故障,需切换备用方案&error_details=连接超时10次,重试失败",
    )
    assert response.status_code == 200
    failure = response.json()
    print(f"  ✓ 失败记录ID: {failure['id']}")
    print(f"  ✓ 原始输入快照已保留: {'raw_input_snapshot' in failure}")
    print(f"  ✓ 处理依据已保留: {'processing_evidence' in failure}")
    assert failure["raw_input_snapshot"] is not None, "应保留原始输入"
    assert failure["processing_evidence"] is not None, "应保留处理依据"

    print("\n[步骤 4] 查询失败记录...")
    response = client.get(f"/api/v1/rebalance/plans/{plan_id}/failures")
    failures = response.json()
    print(f"  ✓ 失败记录数量: {len(failures)}")
    assert len(failures) >= 1

    print("\n[步骤 5] 导出汇总数据...")
    response = client.post(
        "/api/v1/rebalance/plans",
        json={
            "source_shard": "shard-export-1",
            "target_node": "node-export",
            "tenant_distribution": [
                {"tenant_id": "t1", "data_size_gb": 10.0, "qps": 100}
            ],
            "created_by": "admin",
        },
    )

    response = client.post("/api/v1/rebalance/export/summary", json={})
    assert response.status_code == 200
    summary = response.json()
    print(f"  ✓ 总计划数: {summary['total_plans']}")
    print(f"  ✓ 总迁移流量: {summary['total_migration_traffic_gb']} GB")
    print(f"  ✓ 状态分布: {summary['status_distribution']}")

    print("\n  ✓ 异常处理和导出功能测试通过!")


def test_6_list_and_pagination():
    print_section("测试 6: 列表查询和分页")

    print("\n[步骤 1] 创建多个测试计划...")
    for i in range(5):
        plan_data = {
            "source_shard": f"shard-list-{i}",
            "target_node": f"node-list-{i}",
            "tenant_distribution": [
                {"tenant_id": f"tenant-{i}", "data_size_gb": 10.0 + i, "qps": 100 * i}
            ],
            "created_by": "tester",
        }
        client.post("/api/v1/rebalance/plans", json=plan_data)

    print("\n[步骤 2] 查询第一页...")
    response = client.get("/api/v1/rebalance/plans?page=1&page_size=3")
    result = response.json()
    print(f"  ✓ 总数: {result['total']}")
    print(f"  ✓ 当前页数量: {len(result['items'])}")
    assert len(result["items"]) == 3, "第一页应该有3条"

    print("\n[步骤 3] 按创建人筛选...")
    response = client.get("/api/v1/rebalance/plans?created_by=tester&page_size=10")
    result = response.json()
    print(f"  ✓ tester创建的计划数: {len(result['items'])}")
    assert len(result["items"]) >= 5

    print("\n[步骤 4] 按状态筛选...")
    response = client.get("/api/v1/rebalance/plans?status=draft&page_size=10")
    result = response.json()
    print(f"  ✓ 草稿状态计划数: {len(result['items'])}")

    print("\n  ✓ 列表查询和分页测试通过!")


def main():
    print("\n" + "#" * 60)
    print("#" + " " * 58 + "#")
    print("#" + " " * 10 + "分片重平衡审批API - 自动化测试" + " " * 16 + "#")
    print("#" + " " * 58 + "#")
    print("#" * 60)

    try:
        plan_id = test_1_normal_flow()
        test_2_dirty_data()
        test_3_duplicate_request()
        test_4_manual_correction_recalculation()
        test_5_exception_handling_and_export()
        test_6_list_and_pagination()

        print("\n" + "=" * 60)
        print("  ✅ 所有测试通过!")
        print("=" * 60)

    except AssertionError as e:
        print(f"\n  ❌ 测试失败: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        print(f"\n  ❌ 发生错误: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        if os.path.exists("./test_rebalance.db"):
            os.remove("./test_rebalance.db")
            print("\n  🧹 测试数据库已清理")


if __name__ == "__main__":
    main()
