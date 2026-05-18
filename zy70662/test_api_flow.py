#!/usr/bin/env python3
"""
API级别端到端测试脚本
通过真实 HTTP 请求验证事务提交机制
"""

import os
import sys
import json
import time
import subprocess
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import Base, engine

BASE_URL = "http://127.0.0.1:8000"


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


def wait_for_server(timeout=10):
    start = time.time()
    while time.time() - start < timeout:
        try:
            response = requests.get(f"{BASE_URL}/", timeout=2)
            if response.status_code == 200:
                return True
        except:
            pass
        time.sleep(0.5)
    return False


def test_step(step_name, func):
    try:
        result = func()
        color_print(f"  ✓ {step_name}", "green")
        return result
    except Exception as e:
        color_print(f"  ✗ {step_name}: {str(e)}", "red")
        raise


def main():
    color_print("=" * 60, "blue")
    color_print("API端到端事务测试", "blue")
    color_print("=" * 60, "blue")

    color_print("\n[1/8] 初始化数据库...", "blue")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    color_print("  ✓ 数据库已重置", "green")

    color_print("\n[2/8] 启动API服务...", "blue")
    server_proc = subprocess.Popen(
        [sys.executable, "-u", "main.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    
    if not wait_for_server():
        color_print("  ✗ 服务启动超时", "red")
        server_proc.terminate()
        return 1
    color_print("  ✓ API服务已启动", "green")

    try:
        color_print("\n[3/8] 创建基础数据...", "blue")

        create_group1 = requests.post(f"{BASE_URL}/age-groups/", json={"name": "成年组", "description": "测试组别"})
        create_group1.raise_for_status()
        group_id = create_group1.json()["id"]
        color_print(f"    创建组别ID: {group_id}", "green")

        create_participant = requests.post(f"{BASE_URL}/participants/", json={
            "bib_number": "API001",
            "name": "API测试选手",
            "age": 25,
            "age_group_id": group_id
        })
        create_participant.raise_for_status()
        participant_id = create_participant.json()["id"]
        color_print(f"    创建选手ID: {participant_id}", "green")

        for checkpoint, time_sec in [("start", 0), ("finish", 1800)]:
            requests.post(f"{BASE_URL}/time-records/", json={
                "participant_id": participant_id,
                "checkpoint": checkpoint,
                "time_seconds": time_sec
            }).raise_for_status()
        color_print("    创建计时记录完成", "green")

        color_print("\n[4/8] 通过API创建处罚...", "blue")
        create_penalty = requests.post(f"{BASE_URL}/penalties/", json={
            "participant_id": participant_id,
            "penalty_type": "抢跑",
            "time_penalty_seconds": 5.0,
            "description": "起步抢跑"
        })
        create_penalty.raise_for_status()
        penalty_id = create_penalty.json()["id"]
        color_print(f"    处罚ID: {penalty_id}, 状态: applied={create_penalty.json()['applied']}", "green")

        color_print("\n[5/8] 验证处罚持久化...", "blue")
        get_penalties = requests.get(f"{BASE_URL}/penalties/", params={"participant_id": participant_id})
        get_penalties.raise_for_status()
        penalties = get_penalties.json()
        if len(penalties) != 1:
            raise Exception(f"处罚未持久化！预期1条，实际{len(penalties)}条")
        color_print(f"    处罚已持久化，共{len(penalties)}条", "green")

        color_print("\n[6/8] 通过API创建申诉...", "blue")
        create_appeal = requests.post(f"{BASE_URL}/appeals/", json={
            "appeal_number": "API-TEST-001",
            "participant_id": participant_id,
            "reason": "对处罚有异议"
        })
        create_appeal.raise_for_status()
        appeal_id = create_appeal.json()["id"]
        color_print(f"    申诉ID: {appeal_id}, 状态: {create_appeal.json()['status']}", "green")

        color_print("\n[7/8] 验证申诉持久化...", "blue")
        get_appeals = requests.get(f"{BASE_URL}/appeals/", params={"participant_id": participant_id})
        get_appeals.raise_for_status()
        appeals = get_appeals.json()
        if len(appeals) != 1:
            raise Exception(f"申诉未持久化！预期1条，实际{len(appeals)}条")
        if appeals[0]["status"] != "pending":
            raise Exception(f"申诉状态不正确: {appeals[0]['status']}")
        color_print(f"    申诉已持久化，状态: {appeals[0]['status']}", "green")

        color_print("\n[8/8] 审核并执行申诉...", "blue")
        review_appeal = requests.post(f"{BASE_URL}/appeals/{appeal_id}/review", json={
            "status": "reviewed",
            "decision": "penalty_removed",
            "decision_notes": "测试撤销处罚",
            "reviewer": "测试裁判"
        })
        review_appeal.raise_for_status()
        color_print(f"    审核完成，决定: {review_appeal.json()['decision']}", "green")

        process_appeal = requests.post(f"{BASE_URL}/appeals/{appeal_id}/process")
        process_appeal.raise_for_status()
        process_result = process_appeal.json()
        color_print(f"    执行完成，操作: {process_result['actions_taken']}", "green")

        color_print("\n[验证] 最终状态验证...", "yellow")
        get_appeals_final = requests.get(f"{BASE_URL}/appeals/", params={"participant_id": participant_id})
        get_appeals_final.raise_for_status()
        final_appeal = get_appeals_final.json()[0]
        if final_appeal["status"] != "processed":
            raise Exception(f"申诉处理后状态不正确: {final_appeal['status']}")
        color_print(f"    申诉最终状态: {final_appeal['status']}", "green")

        get_penalties_final = requests.get(f"{BASE_URL}/penalties/", params={"participant_id": participant_id})
        get_penalties_final.raise_for_status()
        final_penalty = get_penalties_final.json()[0]
        if final_penalty["applied"] != False:
            raise Exception(f"处罚状态未更新: applied={final_penalty['applied']}")
        color_print(f"    处罚最终状态: applied={final_penalty['applied']}", "green")

        color_print("\n" + "=" * 60, "green")
        color_print("✓ 所有API端到端测试通过！事务正确提交", "green")
        color_print("=" * 60, "green")
        return 0

    except Exception as e:
        color_print(f"\n测试失败: {str(e)}", "red")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        server_proc.terminate()
        server_proc.wait()


if __name__ == "__main__":
    sys.exit(main())
