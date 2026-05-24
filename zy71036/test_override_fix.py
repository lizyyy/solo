import requests

BASE_URL = "http://localhost:8001"


def test_auto_rejected_manual_override():
    """测试 AUTO_REJECTED 状态的人工改判功能"""
    print("=" * 60)
    print("  测试: AUTO_REJECTED 状态人工改判")
    print("=" * 60)

    # 1. 创建区域和脚手架
    area = requests.post(f"{BASE_URL}/areas/", json={
        "name": "人工改判测试区",
        "description": "测试 AUTO_REJECTED -> MANUAL_APPROVED 转换"
    }).json()
    print(f"✓ 创建区域: {area['name']}")

    scaffold = requests.post(f"{BASE_URL}/scaffolds/", json={
        "scaffold_number": "TEST-OVERRIDE-001",
        "area_id": area["id"],
        "type": "测试脚手架"
    }).json()
    print(f"✓ 创建脚手架: {scaffold['scaffold_number']}")

    # 2. 创建验收记录（上传部分照片，但缺少整改项关闭）
    record = requests.post(f"{BASE_URL}/acceptance/", json={
        "batch_no": "BATCH-OVERRIDE-TEST",
        "scaffold_id": scaffold["id"],
        "inspector": "测试员",
        "rectifications": [
            {"item_no": "TEST-001", "description": "测试整改项", "severity": "normal"}
        ]
    }).json()
    print(f"✓ 创建验收记录 ID: {record['id']}, 当前状态: {record['status']}")

    # 3. 上传全部3种类型照片（避免照片问题触发 pending_manual）
    photo_types = ["overall", "detail", "connection"]
    for ptype in photo_types:
        with open("test_temp.jpg", "wb") as f:
            f.write(b"fake_image_content")
        with open("test_temp.jpg", "rb") as f:
            requests.post(
                f"{BASE_URL}/acceptance/{record['id']}/photos/",
                params={"photo_type": ptype},
                files={"file": ("photo.jpg", f, "image/jpeg")}
            ).json()
    import os
    os.remove("test_temp.jpg")
    print("✓ 已上传全部3种类型照片")

    # 4. 提交验收，预期进入 AUTO_REJECTED（因为有未关闭整改项，且照片齐全不需要人工审核）
    result = requests.post(f"{BASE_URL}/acceptance/{record['id']}/submit").json()
    print(f"✓ 提交验收后状态: {result['record']['status']}")
    print(f"  自动校验问题: {result['validation']['issues']}")
    print(f"  需要人工审核: {result['validation']['requires_manual_review']}")

    assert result['record']['status'] == 'auto_rejected', f"预期 auto_rejected，实际 {result['record']['status']}"
    print("✓ 确认: 成功进入 auto_rejected 状态")

    # 4. 尝试人工审核通过 - 这是之前失败的点
    print("\n尝试人工审核通过 (AUTO_REJECTED -> MANUAL_APPROVED)...")
    approved = requests.post(
        f"{BASE_URL}/acceptance/{record['id']}/manual-review",
        json={
            "operator": "安全总监",
            "reason": "经现场核查，特殊情况特批通过",
            "approved": True
        }
    )

    if approved.status_code == 200:
        approved_data = approved.json()
        print(f"✓ 人工审核成功! 新状态: {approved_data['status']}")
        print(f"  人工改判人: {approved_data['manual_override_by']}")
        print(f"  改判原因: {approved_data['manual_override_reason']}")
        assert approved_data['status'] == 'manual_approved', "状态应为 manual_approved"
    else:
        print(f"✗ 人工审核失败! 状态码: {approved.status_code}")
        print(f"  错误: {approved.text}")
        return False

    # 5. 验证操作日志
    logs = requests.get(f"{BASE_URL}/acceptance/{record['id']}/logs/").json()
    print(f"\n✓ 操作日志记录数: {len(logs)}")
    for log in logs:
        print(f"  - {log['operation']}: {log['previous_status']} -> {log['new_status']}")

    # 6. 再测试另一个场景：AUTO_REJECTED -> MANUAL_REJECTED
    print("\n" + "-" * 50)
    print("测试: AUTO_REJECTED -> MANUAL_REJECTED")

    record2 = requests.post(f"{BASE_URL}/acceptance/", json={
        "batch_no": "BATCH-OVERRIDE-TEST2",
        "scaffold_id": scaffold["id"],
        "inspector": "测试员"
    }).json()

    result2 = requests.post(f"{BASE_URL}/acceptance/{record2['id']}/submit").json()
    print(f"✓ 提交后状态: {result2['record']['status']}")

    rejected = requests.post(
        f"{BASE_URL}/acceptance/{record2['id']}/manual-review",
        json={
            "operator": "审核员",
            "reason": "问题严重，不予通过",
            "approved": False
        }
    )

    if rejected.status_code == 200:
        rejected_data = rejected.json()
        print(f"✓ 人工拒绝成功! 新状态: {rejected_data['status']}")
        assert rejected_data['status'] == 'manual_rejected', "状态应为 manual_rejected"
    else:
        print(f"✗ 人工拒绝失败! 状态码: {rejected.status_code}")
        print(f"  错误: {rejected.text}")
        return False

    print("\n" + "=" * 60)
    print("  ✓ 所有测试通过!")
    print("=" * 60)
    return True


def test_state_machine_consistency():
    """验证状态机与 manual_review 逻辑的一致性"""
    print("\n" + "=" * 60)
    print("  状态机一致性验证")
    print("=" * 60)

    from models import ScaffoldStatus
    from services import StatusMachine

    # 验证 PENDING_MANUAL 的转换
    pending_ok = StatusMachine.can_transition(
        ScaffoldStatus.PENDING_MANUAL, ScaffoldStatus.MANUAL_APPROVED
    ) and StatusMachine.can_transition(
        ScaffoldStatus.PENDING_MANUAL, ScaffoldStatus.MANUAL_REJECTED
    )
    print(f"✓ PENDING_MANUAL 可人工审核: {pending_ok}")

    # 验证 AUTO_REJECTED 的转换
    auto_rejected_ok = StatusMachine.can_transition(
        ScaffoldStatus.AUTO_REJECTED, ScaffoldStatus.MANUAL_APPROVED
    ) and StatusMachine.can_transition(
        ScaffoldStatus.AUTO_REJECTED, ScaffoldStatus.MANUAL_REJECTED
    )
    print(f"✓ AUTO_REJECTED 可人工审核: {auto_rejected_ok}")

    # 验证所有人工审核支持的状态
    reviewable_states = ['pending_manual', 'auto_rejected']
    for state in reviewable_states:
        can_approve = StatusMachine.can_transition(
            ScaffoldStatus(state), ScaffoldStatus.MANUAL_APPROVED
        )
        can_reject = StatusMachine.can_transition(
            ScaffoldStatus(state), ScaffoldStatus.MANUAL_REJECTED
        )
        print(f"  - {state}: 可通过={can_approve}, 可拒绝={can_reject}")

    return pending_ok and auto_rejected_ok


if __name__ == "__main__":
    import sys

    # 先验证状态机逻辑
    consistency_ok = test_state_machine_consistency()
    if not consistency_ok:
        print("\n✗ 状态机一致性验证失败!")
        sys.exit(1)

    # 再进行 API 测试
    api_ok = test_auto_rejected_manual_override()
    if not api_ok:
        print("\n✗ API 测试失败!")
        sys.exit(1)

    print("\n🎉 全部验证通过!")
