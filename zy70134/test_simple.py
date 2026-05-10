from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from database import Base, get_db
import models

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_quality.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
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


def test_full_workflow():
    print("=" * 60)
    print("测试完整工作流程")
    print("=" * 60)
    
    recording_ids = [f"REC_{i:04d}" for i in range(100)]
    
    print("\n1. 创建录音批次...")
    response = client.post(
        "/api/batches",
        json={
            "batch_code": "TEST_BATCH_001",
            "name": "测试批次",
            "agent_id": "AGENT_TEST",
            "record_count": 100,
            "recording_ids": recording_ids
        }
    )
    assert response.status_code == 200
    batch = response.json()
    batch_id = batch["id"]
    print(f"   ✓ 批次创建成功: ID={batch_id}")
    
    print("\n2. 创建抽样规则...")
    response = client.post(
        "/api/rules",
        json={
            "name": "测试规则",
            "sampling_ratio": 0.1,
            "min_samples": 5,
            "max_samples": 20
        }
    )
    assert response.status_code == 200
    rule = response.json()
    rule_id = rule["id"]
    print(f"   ✓ 规则创建成功: ID={rule_id}, 比例=10%")
    
    print("\n3. 执行抽样派单...")
    response = client.post(
        "/api/sampling/execute",
        json={
            "batch_id": batch_id,
            "rule_id": rule_id,
            "inspectors": ["INS_001", "INS_002"]
        }
    )
    assert response.status_code == 200
    result = response.json()
    task_id = result["task"]["id"]
    assignments = result["assignments"]
    print(f"   ✓ 抽样成功: 任务ID={task_id}, 抽样数={result['task']['sampled_count']}")
    print(f"   ✓ 派单数={len(assignments)}")
    
    print("\n4. 验证重跑幂等性...")
    response = client.post(
        "/api/sampling/execute",
        json={
            "batch_id": batch_id,
            "rule_id": rule_id,
            "inspectors": ["INS_001", "INS_002"]
        }
    )
    result2 = response.json()
    assert result2["task"]["id"] == task_id
    print(f"   ✓ 重跑返回相同任务ID: {result2['task']['id']}")
    
    print("\n5. 提交质检结果...")
    assignment_id = assignments[0]["id"]
    inspector_id = assignments[0]["inspector_id"]
    
    response = client.post(
        "/api/inspections/submit",
        json={
            "assignment_id": assignment_id,
            "score": 92.5,
            "is_passed": True,
            "comments": "测试质检",
            "inspector_id": inspector_id
        }
    )
    assert response.status_code == 200
    inspection = response.json()
    print(f"   ✓ 质检提交成功: 分数={inspection['score']}")
    
    print("\n6. 验证重复提交拦截...")
    response = client.post(
        "/api/inspections/submit",
        json={
            "assignment_id": assignment_id,
            "score": 80.0,
            "is_passed": False,
            "comments": "重复提交",
            "inspector_id": inspector_id
        }
    )
    assert response.status_code == 400
    print(f"   ✓ 重复提交被拦截: {response.json()['detail']}")
    
    print("\n7. 验证质检员不匹配拦截...")
    response = client.post(
        "/api/inspections/submit",
        json={
            "assignment_id": assignment_id,
            "score": 75.0,
            "is_passed": True,
            "comments": "错误质检员",
            "inspector_id": "WRONG_INS"
        }
    )
    assert response.status_code == 400
    print(f"   ✓ 质检员不匹配被拦截: {response.json()['detail']}")
    
    print("\n8. 提交申诉...")
    response = client.post(
        "/api/reviews/appeal",
        json={
            "inspection_result_id": inspection["id"],
            "appeal_reason": "测试申诉",
            "appeal_by": "AGENT_TEST"
        }
    )
    assert response.status_code == 200
    review = response.json()
    print(f"   ✓ 申诉提交成功: ID={review['id']}")
    
    print("\n9. 验证重复申诉拦截...")
    response = client.post(
        "/api/reviews/appeal",
        json={
            "inspection_result_id": inspection["id"],
            "appeal_reason": "重复申诉",
            "appeal_by": "AGENT_TEST"
        }
    )
    assert response.status_code == 400
    print(f"   ✓ 重复申诉被拦截: {response.json()['detail']}")
    
    print("\n10. 处理申诉...")
    response = client.post(
        "/api/reviews/process",
        json={
            "review_id": review["id"],
            "review_comments": "测试复核",
            "review_by": "SUP_TEST",
            "score_adjusted": True,
            "adjusted_score": 95.0
        }
    )
    assert response.status_code == 200
    print(f"   ✓ 申诉处理成功: 分数调整={response.json()['score_adjusted']}")
    
    print("\n11. 扣分冻结...")
    response = client.post(
        "/api/score-freeze",
        json={
            "inspection_result_id": inspection["id"],
            "reason": "测试冻结",
            "frozen_score": 92.5,
            "operator_id": "SUP_TEST"
        }
    )
    assert response.status_code == 200
    freeze = response.json()
    print(f"   ✓ 冻结成功: ID={freeze['id']}")
    
    print("\n12. 验证重复冻结拦截...")
    response = client.post(
        "/api/score-freeze",
        json={
            "inspection_result_id": inspection["id"],
            "reason": "重复冻结",
            "frozen_score": 90.0,
            "operator_id": "SUP_TEST"
        }
    )
    assert response.status_code == 400
    print(f"   ✓ 重复冻结被拦截: {response.json()['detail']}")
    
    print("\n13. 查看历史记录...")
    response = client.get(f"/api/history/InspectionResult/{inspection['id']}")
    history = response.json()
    print(f"   ✓ 历史记录数量: {len(history)}")
    for h in history:
        print(f"      - {h['action']} by {h['operator_id']}")
    
    print("\n14. 生成质量报表...")
    response = client.get(f"/api/reports/quality/{batch_id}")
    report = response.json()
    print(f"   ✓ 质量报表:")
    print(f"      总派单: {report['total_assigned']}")
    print(f"      已完成: {report['completed']}")
    print(f"      平均分: {report['avg_score']}")
    print(f"      申诉中: {report['under_review']}")
    print(f"      冻结中: {report['score_frozen']}")
    
    print("\n" + "=" * 60)
    print("所有测试通过！")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_full_workflow()
    finally:
        if os.path.exists("./test_quality.db"):
            os.remove("./test_quality.db")
