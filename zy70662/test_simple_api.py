#!/usr/bin/env python3
"""
简单API事务提交测试
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from database import Base, engine, get_db
from sqlalchemy.orm import sessionmaker

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

from main import app
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def color_print(text, color="white"):
    colors = {
        "red": "\033[91m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "white": "\033[97m",
        "reset": "\033[0m"
    }
    print(f"{colors.get(color, colors['white'])}{text}{colors['reset']}")


def main():
    color_print("=" * 60, "blue")
    color_print("API事务提交测试", "blue")
    color_print("=" * 60, "blue")

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    try:
        color_print("\n[1/6] 创建组别", "blue")
        r = client.post("/age-groups/", json={"name": "成年组", "description": "测试"})
        r.raise_for_status()
        group_id = r.json()["id"]
        color_print(f"  ✓ 组别ID: {group_id}", "green")

        color_print("\n[2/6] 创建选手", "blue")
        r = client.post("/participants/", json={
            "bib_number": "API001",
            "name": "API测试选手",
            "age": 25,
            "age_group_id": group_id
        })
        r.raise_for_status()
        participant_id = r.json()["id"]
        color_print(f"  ✓ 选手ID: {participant_id}", "green")

        color_print("\n[3/6] 创建计时记录", "blue")
        for checkpoint, time_sec in [("start", 0), ("finish", 1800)]:
            r = client.post("/time-records/", json={
                "participant_id": participant_id,
                "checkpoint": checkpoint,
                "time_seconds": time_sec
            })
            r.raise_for_status()
        color_print("  ✓ 计时记录已创建", "green")

        color_print("\n[4/6] 通过API创建处罚", "blue")
        r = client.post("/penalties/", json={
            "participant_id": participant_id,
            "penalty_type": "抢跑",
            "time_penalty_seconds": 5.0,
            "description": "起步抢跑"
        })
        r.raise_for_status()
        penalty_id = r.json()["id"]
        color_print(f"  ✓ 处罚ID: {penalty_id}, applied={r.json()['applied']}", "green")

        r = client.get(f"/penalties/", params={"participant_id": participant_id})
        r.raise_for_status()
        penalties = r.json()
        if len(penalties) != 1:
            raise Exception(f"处罚未持久化！预期1条，实际{len(penalties)}条")
        color_print("  ✓ 处罚已持久化", "green")

        color_print("\n[5/6] 通过API创建申诉", "blue")
        r = client.post("/appeals/", json={
            "appeal_number": "API-TEST-001",
            "participant_id": participant_id,
            "reason": "对处罚有异议"
        })
        r.raise_for_status()
        appeal_id = r.json()["id"]
        color_print(f"  ✓ 申诉ID: {appeal_id}, 状态={r.json()['status']}", "green")

        r = client.get(f"/appeals/", params={"participant_id": participant_id})
        r.raise_for_status()
        appeals = r.json()
        if len(appeals) != 1:
            raise Exception(f"申诉未持久化！预期1条，实际{len(appeals)}条")
        if appeals[0]["status"] != "pending":
            raise Exception(f"申诉状态不正确: {appeals[0]['status']}")
        color_print("  ✓ 申诉已持久化", "green")

        color_print("\n[6/6] 审核并执行申诉", "blue")
        r = client.post(f"/appeals/{appeal_id}/review", json={
            "status": "reviewed",
            "decision": "penalty_removed",
            "decision_notes": "测试撤销处罚",
            "reviewer": "测试裁判"
        })
        r.raise_for_status()
        color_print(f"  ✓ 审核完成，决定={r.json()['decision']}", "green")

        r = client.post(f"/appeals/{appeal_id}/process")
        r.raise_for_status()
        process_result = r.json()
        color_print(f"  ✓ 执行完成，操作={process_result['actions_taken']}", "green")

        color_print("\n最终状态验证", "yellow")
        r = client.get(f"/appeals/", params={"participant_id": participant_id})
        r.raise_for_status()
        final_appeal = r.json()[0]
        if final_appeal["status"] != "processed":
            raise Exception(f"申诉处理后状态不正确: {final_appeal['status']}")
        color_print(f"  ✓ 申诉最终状态: {final_appeal['status']}", "green")

        r = client.get(f"/penalties/", params={"participant_id": participant_id})
        r.raise_for_status()
        final_penalty = r.json()[0]
        if final_penalty["applied"] != False:
            raise Exception(f"处罚状态未更新: applied={final_penalty['applied']}")
        color_print(f"  ✓ 处罚最终状态: applied={final_penalty['applied']}", "green")

        color_print("\n" + "=" * 60, "green")
        color_print("✓ 所有API事务提交测试通过！", "green")
        color_print("=" * 60, "green")
        return 0

    except Exception as e:
        color_print(f"\n测试失败: {str(e)}", "red")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
