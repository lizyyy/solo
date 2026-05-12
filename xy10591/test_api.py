#!/usr/bin/env python3
import sys
import json
import requests

BASE_URL = "http://127.0.0.1:8000"


def test_create_batch():
    print("\n📌 测试1: 创建批次")
    r = requests.post(f"{BASE_URL}/api/batches", json={
        "origin": {
            "farm_id": "FARM_API_001",
            "farm_name": "API测试农场",
            "region": "上海市浦东新区",
            "country": "中国"
        },
        "product_type": "黄瓜",
        "quantity": 500,
        "unit": "公斤"
    })
    assert r.status_code == 200, f"创建失败: {r.text}"
    data = r.json()["data"]
    print(f"   ✅ 成功: batch_id={data['batch_id']}, status={data['status']}")
    return data["batch_id"]


def test_submit_inspection(batch_id):
    print("\n📌 测试2: 提交检测报告（通过）")
    r = requests.post(f"{BASE_URL}/api/inspections", json={
        "batch_id": batch_id,
        "inspector_id": "INS_API_001",
        "items": [
            {"name": "农药残留", "result": "合格", "value": "0.05mg/kg", "limit": "0.1mg/kg"},
            {"name": "重金属", "result": "合格", "value": "0.1mg/kg", "limit": "0.5mg/kg"}
        ],
        "status": "PASSED",
        "expiry_days": 30,
        "remarks": "全部合格"
    })
    assert r.status_code == 200, f"提交失败: {r.text}"
    data = r.json()["data"]
    print(f"   ✅ 成功: report_id={data['report_id']}, batch_status={data['status']}")
    return data


def test_warehouse_in(batch_id):
    print("\n📌 测试3: 入仓操作")
    r = requests.post(f"{BASE_URL}/api/warehouse/in", json={
        "batch_id": batch_id,
        "box_count": 10,
        "operator_id": "WH_API_001",
        "operator_name": "API仓库管理员"
    })
    assert r.status_code == 200, f"入仓失败: {r.text}"
    data = r.json()["data"]
    print(f"   ✅ 成功: box_count={data['box_count']}, status={data['status']}")
    return data


def test_mix_and_sort():
    print("\n📌 测试4: 混装分拣流程")
    
    batch1 = requests.post(f"{BASE_URL}/api/batches", json={
        "origin": {"farm_id": "M1", "farm_name": "混装农场1", "region": "山东", "country": "中国"},
        "product_type": "苹果", "quantity": 400, "unit": "公斤"
    }).json()["data"]["batch_id"]
    
    batch2 = requests.post(f"{BASE_URL}/api/batches", json={
        "origin": {"farm_id": "M2", "farm_name": "混装农场2", "region": "陕西", "country": "中国"},
        "product_type": "苹果", "quantity": 300, "unit": "公斤"
    }).json()["data"]["batch_id"]
    
    requests.post(f"{BASE_URL}/api/inspections", json={
        "batch_id": batch1, "inspector_id": "I1", "items": [{}], "status": "PASSED"
    })
    requests.post(f"{BASE_URL}/api/inspections", json={
        "batch_id": batch2, "inspector_id": "I2", "items": [{}], "status": "PASSED"
    })
    
    r = requests.post(f"{BASE_URL}/api/warehouse/in", json={"batch_id": batch1, "box_count": 8})
    r = requests.post(f"{BASE_URL}/api/warehouse/in", json={"batch_id": batch2, "box_count": 6})
    
    print(f"   ✅ 创建两个批次并完成检测入仓")
    
    r = requests.post(f"{BASE_URL}/api/batches/mix", json={
        "source_batch_ids": [batch1, batch2],
        "new_batch_info": {"product_type": "混合苹果"},
        "operator_id": "MIX_001", "operator_name": "混装员"
    })
    assert r.status_code == 200, f"混装失败: {r.text}"
    mixed_batch = r.json()["data"]["new_batch_id"]
    total_boxes = r.json()["data"]["total_boxes"]
    print(f"   ✅ 混装成功: mixed_batch={mixed_batch}, 总箱子={total_boxes}")
    
    r = requests.post(f"{BASE_URL}/api/batches/sort", json={
        "batch_id": mixed_batch,
        "sorting_plan": [
            {"box_count": 5, "product_type": "精品"},
            {"box_count": 5, "product_type": "普通"},
            {"box_count": 4, "product_type": "次级"}
        ],
        "operator_id": "SORT_001", "operator_name": "分拣员"
    })
    assert r.status_code == 200, f"分拣失败: {r.text}"
    children = r.json()["data"]["child_batches"]
    print(f"   ✅ 分拣成功: 生成 {len(children)} 个子批次")
    for c in children:
        print(f"      - {c['child_batch_id']}: {c['product_type']} ({c['box_count']}箱)")
    
    return mixed_batch, children


def test_outbound_and_recall():
    print("\n📌 测试5: 出库追溯与召回")
    
    batch = requests.post(f"{BASE_URL}/api/batches", json={
        "origin": {"farm_id": "R1", "farm_name": "召回农场", "region": "浙江", "country": "中国"},
        "product_type": "草莓", "quantity": 200, "unit": "公斤"
    }).json()["data"]["batch_id"]
    
    requests.post(f"{BASE_URL}/api/inspections", json={
        "batch_id": batch, "inspector_id": "I1", "items": [{}], "status": "PASSED"
    })
    requests.post(f"{BASE_URL}/api/warehouse/in", json={"batch_id": batch, "box_count": 5})
    
    r = requests.post(f"{BASE_URL}/api/batches/sort", json={
        "batch_id": batch,
        "sorting_plan": [
            {"box_count": 3, "product_type": "商超"},
            {"box_count": 2, "product_type": "电商"}
        ]
    })
    children = r.json()["data"]["child_batches"]
    
    r1 = requests.post(f"{BASE_URL}/api/warehouse/out", json={
        "batch_id": children[0]["child_batch_id"],
        "destination": "北京华联超市",
        "operator_id": "OUT_001", "operator_name": "出库员"
    })
    print(f"   ✅ 子批次1出库: 目的地=北京华联超市")
    
    r2 = requests.post(f"{BASE_URL}/api/warehouse/out", json={
        "batch_id": children[1]["child_batch_id"],
        "destination": "京东电商仓",
        "operator_id": "OUT_001", "operator_name": "出库员"
    })
    print(f"   ✅ 子批次2出库: 目的地=京东电商仓")
    
    r = requests.get(f"{BASE_URL}/api/batches/{batch}/outbound-trace")
    trace = r.json()["data"]
    print(f"   ✅ 出库追溯: 共 {trace['outbound_boxes_count']} 个箱子已出库")
    for box in trace["outbound_boxes"]:
        print(f"      - {box['box_id']} -> {box['destination']}")
    
    r = requests.post(f"{BASE_URL}/api/recall", json={
        "source_batch_ids": [batch],
        "reason": "可能受污染，紧急召回",
        "operator_id": "RCL_001", "operator_name": "召回专员"
    })
    assert r.status_code == 200, f"召回失败: {r.text}"
    recall = r.json()["data"]
    print(f"   ✅ 召回成功: recall_id={recall['recall_id']}")
    print(f"      - 影响批次: {recall['affected_batches_count']} 个")
    print(f"      - 影响箱子: {recall['affected_boxes_count']} 个")
    print(f"      - 已出库箱子: {recall['outbound_boxes_count']} 个")
    
    r = requests.get(f"{BASE_URL}/api/reports/recall/{recall['recall_id']}")
    report = r.json()["data"]
    print(f"   ✅ 召回报告: 报告ID={report['report_id']}")
    print(f"      - 在库箱子: {report['summary']['in_warehouse_boxes_count']}")
    print(f"      - 出库箱子: {report['summary']['outbound_boxes_count']}")
    
    return recall["recall_id"]


def test_rules_validation():
    print("\n📌 测试6: 规则验证（失败路径）")
    
    batch = requests.post(f"{BASE_URL}/api/batches", json={
        "origin": {"farm_id": "RULE_001", "farm_name": "规则农场", "region": "江苏", "country": "中国"},
        "product_type": "白菜", "quantity": 100, "unit": "公斤"
    }).json()["data"]["batch_id"]
    
    print("   🔍 测试: 未检测就入仓（应该失败）")
    r = requests.post(f"{BASE_URL}/api/warehouse/in", json={"batch_id": batch, "box_count": 2})
    assert r.status_code == 400, f"应该失败但成功了: {r.text}"
    err = r.json()
    print(f"   ✅ 正确拦截: error_code={err['error_code']}, message={err['message']}")
    
    requests.post(f"{BASE_URL}/api/inspections", json={
        "batch_id": batch, "inspector_id": "I1", "items": [{}], "status": "PASSED"
    })
    requests.post(f"{BASE_URL}/api/warehouse/in", json={"batch_id": batch, "box_count": 2})
    
    print("   🔍 测试: 重复入仓（应该失败）")
    r = requests.post(f"{BASE_URL}/api/warehouse/in", json={"batch_id": batch, "box_count": 2})
    assert r.status_code == 400, f"应该失败但成功了: {r.text}"
    err = r.json()
    print(f"   ✅ 正确拦截: error_code={err['error_code']}, message={err['message']}")
    
    print("   🔍 测试: 幂等性验证")
    key = "IDEMP_TEST_001_" + str(hash("test"))
    r1 = requests.post(f"{BASE_URL}/api/batches", json={
        "origin": {"farm_id": "I1", "farm_name": "幂等农场", "region": "测试", "country": "中国"},
        "product_type": "幂等测试", "quantity": 100, "unit": "公斤"
    }, headers={"X-Idempotency-Key": key})
    r2 = requests.post(f"{BASE_URL}/api/batches", json={
        "origin": {"farm_id": "I1", "farm_name": "幂等农场", "region": "测试", "country": "中国"},
        "product_type": "幂等测试", "quantity": 100, "unit": "公斤"
    }, headers={"X-Idempotency-Key": key})
    
    data1 = r1.json()["data"]
    data2 = r2.json()["data"]
    assert data1["batch_id"] == data2["batch_id"], "幂等性失败: batch_id 不同"
    assert data2.get("idempotent") == True, "幂等性失败: 缺少 idempotent 标记"
    print(f"   ✅ 幂等性生效: 两次调用返回相同 batch_id={data1['batch_id']}")
    
    print("   🔍 测试: 召回后禁止分拣（应该失败）")
    requests.post(f"{BASE_URL}/api/recall", json={
        "source_batch_ids": [batch], "reason": "测试召回"
    })
    r = requests.post(f"{BASE_URL}/api/batches/sort", json={
        "batch_id": batch, "sorting_plan": [{"box_count": 1}]
    })
    assert r.status_code == 400, f"应该失败但成功了: {r.text}"
    err = r.json()
    print(f"   ✅ 正确拦截: error_code={err['error_code']}, message={err['message']}")


def test_query_and_audit():
    print("\n📌 测试7: 查询和审计日志")
    
    r = requests.get(f"{BASE_URL}/status")
    status = r.json()["data"]
    print(f"   ✅ 系统状态:")
    print(f"      - 总批次: {status['batches_total']}")
    print(f"      - 总箱子: {status['boxes_total']}")
    print(f"      - 冻结箱子: {status['frozen_boxes']}")
    print(f"      - 召回箱子: {status['recalled_boxes']}")
    
    r = requests.get(f"{BASE_URL}/api/audit")
    audit = r.json()["data"]
    print(f"   ✅ 审计日志: 共 {audit['total']} 条记录")
    
    if audit["logs"]:
        latest = audit["logs"][-1]
        print(f"   📝 最新审计记录:")
        print(f"      - 操作: {latest['operation']} - {latest['action']}")
        print(f"      - 操作人: {latest['operator_name']}")
        print(f"      - 时间: {latest['timestamp']}")
        print(f"      - 状态: {latest['status']}")
        if latest.get("diff"):
            print(f"      - 有差异记录")


def run_all_tests():
    print("\n" + "="*60)
    print("  API 综合测试")
    print("="*60)
    
    try:
        batch_id = test_create_batch()
        test_submit_inspection(batch_id)
        test_warehouse_in(batch_id)
        test_mix_and_sort()
        test_outbound_and_recall()
        test_rules_validation()
        test_query_and_audit()
        
        print("\n" + "="*60)
        print("  ✅ 所有测试通过！")
        print("="*60)
        
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()
