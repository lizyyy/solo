import requests
from datetime import date, timedelta

BASE_URL = "http://localhost:8000"


def create_elder(prefix):
    """创建老人"""
    elder_data = {
        "name": f"{prefix}老人",
        "id_card": f"STAT{prefix}{int(date.today().strftime('%Y%m%d%H%M%S'))}",
        "room_number": "101",
        "bed_number": "A",
        "gender": "男",
        "age": 80,
        "contact_person": "家属",
        "contact_phone": "13800000000"
    }
    r = requests.post(f"{BASE_URL}/elders", json=elder_data)
    return r.json()["id"]


def create_prescription(elder_id):
    """创建医嘱"""
    prescription_data = {
        "elder_id": elder_id,
        "doctor_name": "王医生",
        "diagnosis": "高血压",
        "start_date": date.today().isoformat(),
        "source": "测试",
        "created_by": "测试员",
        "remark": "测试医嘱",
        "items": [
            {
                "medicine_name": "测试药",
                "specification": "10mg",
                "dosage": "1片",
                "frequency": "每日1次",
                "usage": "口服",
                "quantity": 1,
                "unit": "盒"
            }
        ]
    }
    r = requests.post(f"{BASE_URL}/prescriptions", json=prescription_data)
    return r.json()["id"]


def create_medicine_box(elder_id, prescription_id, batch_no, box_no):
    """创建药盒"""
    box_data = {
        "elder_id": elder_id,
        "prescription_id": prescription_id,
        "batch_no": batch_no,
        "box_no": box_no,
        "distribution_date": date.today().isoformat(),
        "time_slot": "morning",
        "medicines": "测试药 1片",
        "source": "测试",
        "prepared_by": "测试药师"
    }
    r = requests.post(f"{BASE_URL}/medicine-boxes", json=box_data)
    return r.json()["id"]


def sign_box(box_id, is_backfilled=False):
    """签收药盒"""
    sign_data = {
        "medicine_box_id": box_id,
        "nurse_name": "测试护士",
        "is_backfilled": is_backfilled,
        "backfill_reason": "补录测试" if is_backfilled else None,
        "backfilled_by": "护士长" if is_backfilled else None,
        "receiver_name": "测试老人",
        "receiver_relation": "本人"
    }
    r = requests.put(
        f"{BASE_URL}/medicine-boxes/{box_id}/status",
        params={"new_status": "prepared", "operator": "测试药师"}
    )
    r = requests.post(f"{BASE_URL}/medicine-boxes/{box_id}/sign", json=sign_data)
    return r.status_code == 200


def create_dispute(box_id, reporter):
    """创建争议"""
    dispute_data = {
        "medicine_box_id": box_id,
        "reporter": reporter,
        "reporter_role": "家属",
        "dispute_type": "签收异常",
        "description": "测试争议"
    }
    r = requests.post(f"{BASE_URL}/disputes", json=dispute_data)
    return r.status_code == 200


def test_stats_consistency():
    """验证：按业务条件查询时，统计结果与明细查询对得上"""
    print("=" * 70)
    print("测试：统计查询与明细查询的一致性")
    print("=" * 70)

    today = date.today().isoformat()

    print("\n【准备测试数据】")
    print("-" * 70)

    print("\n1. 创建两位老人 (A和B)")
    elder_a_id = create_elder("A")
    elder_b_id = create_elder("B")
    print(f"  ✓ 老人A ID: {elder_a_id}")
    print(f"  ✓ 老人B ID: {elder_b_id}")

    print("\n2. 为两位老人创建医嘱")
    presc_a_id = create_prescription(elder_a_id)
    presc_b_id = create_prescription(elder_b_id)
    print(f"  ✓ 老人A医嘱ID: {presc_a_id}")
    print(f"  ✓ 老人B医嘱ID: {presc_b_id}")

    print("\n3. 创建两个批次 (BA和BB)，每个批次各2个药盒")
    batch_ba = f"BA-{int(date.today().strftime('%Y%m%d%H%M%S'))}"
    batch_bb = f"BB-{int(date.today().strftime('%Y%m%d%H%M%S'))}"

    box_a1 = create_medicine_box(elder_a_id, presc_a_id, batch_ba, "A1")
    box_a2 = create_medicine_box(elder_a_id, presc_a_id, batch_ba, "A2")
    box_b1 = create_medicine_box(elder_b_id, presc_b_id, batch_bb, "B1")
    box_b2 = create_medicine_box(elder_b_id, presc_b_id, batch_bb, "B2")
    print(f"  ✓ 批次BA药盒: {box_a1}, {box_a2}")
    print(f"  ✓ 批次BB药盒: {box_b1}, {box_b2}")

    print("\n4. 正常签收: 老人A的A1药盒")
    sign_box(box_a1, is_backfilled=False)
    print(f"  ✓ 正常签收: 药盒{box_a1}")

    print("\n5. 补录签收: 老人B的B1药盒")
    sign_box(box_b1, is_backfilled=True)
    print(f"  ✓ 补录签收: 药盒{box_b1}")

    print("\n6. 创建争议: 老人B的B2药盒")
    create_dispute(box_b2, "老人B家属")
    print(f"  ✓ 创建争议: 药盒{box_b2}")

    print("\n【执行一致性验证】")
    print("-" * 70)

    print("\n场景1: 查询全部日期范围")
    print("  预期: 总数=4, 已签收=2, 补录数=1, 争议数=1")
    r = requests.get(
        f"{BASE_URL}/reports/distribution/stats",
        params={"start_date": today, "end_date": today}
    )
    stats = r.json()
    print(f"  实际: 总数={stats['total_boxes']}, 已签收={stats['signed_count']}, "
          f"补录数={stats['backfill_count']}, 争议数={stats['dispute_count']}")
    assert stats["total_boxes"] == 4, f"预期总数4，实际{stats['total_boxes']}"
    assert stats["signed_count"] == 2, f"预期已签收2，实际{stats['signed_count']}"
    assert stats["backfill_count"] == 1, f"预期补录数1，实际{stats['backfill_count']}"
    assert stats["dispute_count"] == 1, f"预期争议数1，实际{stats['dispute_count']}"
    print("  ✓ 验证通过！")

    print("\n场景2: 按老人A过滤")
    print("  预期: 总数=2, 已签收=1, 补录数=0, 争议数=0 (因为补录和争议都在老人B)")
    r = requests.get(
        f"{BASE_URL}/reports/distribution/stats",
        params={"start_date": today, "end_date": today, "elder_id": elder_a_id}
    )
    stats = r.json()
    print(f"  实际: 总数={stats['total_boxes']}, 已签收={stats['signed_count']}, "
          f"补录数={stats['backfill_count']}, 争议数={stats['dispute_count']}")
    
    print(f"\n  验证明细查询一致性:")
    r_detail = requests.get(
        f"{BASE_URL}/reports/distribution",
        params={"start_date": today, "end_date": today, "elder_id": elder_a_id}
    )
    details = r_detail.json()
    print(f"  明细查询返回: {len(details)} 条记录")
    
    assert stats["total_boxes"] == len(details), f"统计({stats['total_boxes']})与明细({len(details)})数量不一致"
    assert stats["total_boxes"] == 2, f"预期总数2，实际{stats['total_boxes']}"
    assert stats["signed_count"] == 1, f"预期已签收1，实际{stats['signed_count']}"
    assert stats["backfill_count"] == 0, f"预期补录数0，实际{stats['backfill_count']}"
    assert stats["dispute_count"] == 0, f"预期争议数0，实际{stats['dispute_count']}"
    print("  ✓ 验证通过！按老人A过滤时，排除了老人B的补录和争议")

    print("\n场景3: 按批次BA过滤")
    print("  预期: 总数=2, 已签收=1, 补录数=0, 争议数=0 (批次BA只有老人A的药盒)")
    r = requests.get(
        f"{BASE_URL}/reports/distribution/stats",
        params={"start_date": today, "end_date": today, "batch_no": batch_ba}
    )
    stats = r.json()
    print(f"  实际: 总数={stats['total_boxes']}, 已签收={stats['signed_count']}, "
          f"补录数={stats['backfill_count']}, 争议数={stats['dispute_count']}")
    
    r_detail = requests.get(
        f"{BASE_URL}/reports/distribution",
        params={"start_date": today, "end_date": today, "batch_no": batch_ba}
    )
    details = r_detail.json()
    print(f"  明细查询返回: {len(details)} 条记录")
    
    assert stats["total_boxes"] == len(details), f"统计({stats['total_boxes']})与明细({len(details)})数量不一致"
    assert stats["backfill_count"] == 0, f"预期补录数0，实际{stats['backfill_count']}"
    assert stats["dispute_count"] == 0, f"预期争议数0，实际{stats['dispute_count']}"
    print("  ✓ 验证通过！按批次BA过滤时，排除了其他批次的补录和争议")

    print("\n场景4: 按批次BB过滤")
    print("  预期: 总数=2, 已签收=1, 补录数=1, 争议数=1 (批次BB有补录和争议)")
    r = requests.get(
        f"{BASE_URL}/reports/distribution/stats",
        params={"start_date": today, "end_date": today, "batch_no": batch_bb}
    )
    stats = r.json()
    print(f"  实际: 总数={stats['total_boxes']}, 已签收={stats['signed_count']}, "
          f"补录数={stats['backfill_count']}, 争议数={stats['dispute_count']}")
    
    r_detail = requests.get(
        f"{BASE_URL}/reports/distribution",
        params={"start_date": today, "end_date": today, "batch_no": batch_bb}
    )
    details = r_detail.json()
    print(f"  明细查询返回: {len(details)} 条记录")
    
    assert stats["total_boxes"] == len(details), f"统计({stats['total_boxes']})与明细({len(details)})数量不一致"
    assert stats["backfill_count"] == 1, f"预期补录数1，实际{stats['backfill_count']}"
    assert stats["dispute_count"] == 1, f"预期争议数1，实际{stats['dispute_count']}"
    print("  ✓ 验证通过！按批次BB过滤时，正确统计了该批次的补录和争议")

    print("\n场景5: 按老人B + 批次BB 组合过滤")
    print("  预期: 总数=2, 补录数=1, 争议数=1")
    r = requests.get(
        f"{BASE_URL}/reports/distribution/stats",
        params={"start_date": today, "end_date": today, "elder_id": elder_b_id, "batch_no": batch_bb}
    )
    stats = r.json()
    print(f"  实际: 总数={stats['total_boxes']}, 补录数={stats['backfill_count']}, 争议数={stats['dispute_count']}")
    
    r_detail = requests.get(
        f"{BASE_URL}/reports/distribution",
        params={"start_date": today, "end_date": today, "elder_id": elder_b_id, "batch_no": batch_bb}
    )
    details = r_detail.json()
    print(f"  明细查询返回: {len(details)} 条记录")
    
    assert stats["total_boxes"] == len(details), f"统计({stats['total_boxes']})与明细({len(details)})数量不一致"
    assert stats["backfill_count"] == 1, f"预期补录数1，实际{stats['backfill_count']}"
    assert stats["dispute_count"] == 1, f"预期争议数1，实际{stats['dispute_count']}"
    print("  ✓ 验证通过！组合过滤条件正确传递给补录和争议统计")

    print("\n" + "=" * 70)
    print("✓ 所有场景验证通过！统计结果与查询结果完全对得上")
    print("=" * 70)
    return True


if __name__ == "__main__":
    try:
        success = test_stats_consistency()
        exit(0 if success else 1)
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器")
        exit(1)
    except AssertionError as e:
        print(f"\n✗ 断言失败: {e}")
        exit(1)
    except Exception as e:
        print(f"\n测试出错: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
