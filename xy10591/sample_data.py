#!/usr/bin/env python3
import sys
import os
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services import service
from app.database import db
from app.models import BatchStatus, InspectionStatus


def scenario_1_normal_flow():
    print("\n" + "="*60)
    print("【场景1】正常入仓流程")
    print("="*60)
    
    origin = {
        "farm_id": "FARM001",
        "farm_name": "绿源农场",
        "region": "山东省寿光市",
        "country": "中国"
    }
    
    result = service.create_batch(
        origin=origin,
        product_type="西红柿",
        quantity=1000,
        unit="公斤",
        operator_id="OP001",
        operator_name="采购经理"
    )
    batch_id = result["batch_id"]
    print(f"✅ 创建批次: {batch_id}")
    print(f"   当前状态: {result['status']}")
    
    result = service.submit_inspection(
        batch_id=batch_id,
        inspector_id="INS001",
        items=[
            {"name": "农药残留", "result": "合格", "value": "0.01mg/kg", "limit": "0.1mg/kg"},
            {"name": "重金属", "result": "合格", "value": "0.05mg/kg", "limit": "0.5mg/kg"},
            {"name": "微生物", "result": "合格", "value": "100CFU/g", "limit": "1000CFU/g"}
        ],
        status=InspectionStatus.PASSED.value,
        expiry_days=30,
        remarks="各项指标均符合国家标准"
    )
    print(f"✅ 提交检测报告: {result['report_id']}")
    print(f"   批次状态: {result['status']}")
    print(f"   检测结果: {result['inspection_status']}")
    
    result = service.warehouse_in(
        batch_id=batch_id,
        box_count=20,
        operator_id="OP002",
        operator_name="仓库管理员"
    )
    print(f"✅ 入仓成功，生成箱子: {result['box_count']} 个")
    print(f"   批次状态: {result['status']}")
    
    detail = service.get_batch_detail(batch_id)
    print(f"\n📋 批次详情:")
    print(f"   - 产品: {detail['batch']['product_type']}")
    print(f"   - 产地: {detail['batch']['origin']['farm_name']}")
    print(f"   - 状态: {detail['batch']['status']}")
    print(f"   - 箱子数量: {len(detail['boxes'])}")
    print(f"   - 审计记录: {len(detail['audit_logs'])} 条")
    
    return batch_id


def scenario_2_mix_and_sort():
    print("\n" + "="*60)
    print("【场景2】混装分拣流程")
    print("="*60)
    
    origin_a = {
        "farm_id": "FARM002",
        "farm_name": "阳光果园",
        "region": "陕西省洛川县",
        "country": "中国"
    }
    origin_b = {
        "farm_id": "FARM003",
        "farm_name": "红富士基地",
        "region": "甘肃省静宁县",
        "country": "中国"
    }
    
    r1 = service.create_batch(origin_a, "苹果", 800, "公斤", "OP001", "采购经理")
    batch_a = r1["batch_id"]
    print(f"✅ 创建批次A: {batch_a}")
    
    r2 = service.create_batch(origin_b, "苹果", 600, "公斤", "OP001", "采购经理")
    batch_b = r2["batch_id"]
    print(f"✅ 创建批次B: {batch_b}")
    
    service.submit_inspection(
        batch_a, "INS001",
        [{"name": "农药残留", "result": "合格"}],
        InspectionStatus.PASSED.value, 30
    )
    service.submit_inspection(
        batch_b, "INS001",
        [{"name": "农药残留", "result": "合格"}],
        InspectionStatus.PASSED.value, 30
    )
    print(f"✅ 两个批次检测通过")
    
    service.warehouse_in(batch_a, 16, "OP002", "仓库管理员")
    service.warehouse_in(batch_b, 12, "OP002", "仓库管理员")
    print(f"✅ 两个批次入仓完成，共 28 个箱子")
    
    mix_result = service.mix_batches(
        source_batch_ids=[batch_a, batch_b],
        new_batch_info={"product_type": "混合苹果"},
        operator_id="OP003",
        operator_name="混装操作员"
    )
    mixed_batch = mix_result["new_batch_id"]
    print(f"✅ 混装完成，新批次: {mixed_batch}")
    print(f"   总箱子数: {mix_result['total_boxes']}")
    print(f"   来源批次: {mix_result['source_batches']}")
    
    sort_result = service.sort_batch(
        batch_id=mixed_batch,
        sorting_plan=[
            {"box_count": 10, "product_type": "精品苹果"},
            {"box_count": 10, "product_type": "普通苹果"},
            {"box_count": 8, "product_type": "次级苹果"}
        ],
        operator_id="OP004",
        operator_name="分拣操作员"
    )
    print(f"✅ 分拣完成，生成 {len(sort_result['child_batches'])} 个子批次:")
    for child in sort_result['child_batches']:
        print(f"   - {child['child_batch_id']}: {child['product_type']} ({child['box_count']}箱)")
    
    detail = service.get_batch_detail(mixed_batch)
    print(f"\n📊 混合批次血缘关系:")
    print(json.dumps(detail['lineage'], ensure_ascii=False, indent=2))
    
    return mixed_batch, sort_result['child_batches']


def scenario_3_abnormal_freeze():
    print("\n" + "="*60)
    print("【场景3】检测异常冻结流程")
    print("="*60)
    
    origin = {
        "farm_id": "FARM004",
        "farm_name": "问题农场",
        "region": "某省某市",
        "country": "中国"
    }
    
    r = service.create_batch(origin, "菠菜", 500, "公斤", "OP001", "采购经理")
    batch_id = r["batch_id"]
    print(f"✅ 创建批次: {batch_id}")
    
    r = service.submit_inspection(
        batch_id, "INS002",
        [
            {"name": "农药残留", "result": "不合格", "value": "0.5mg/kg", "limit": "0.1mg/kg"},
            {"name": "重金属", "result": "不合格", "value": "2.0mg/kg", "limit": "0.5mg/kg"}
        ],
        InspectionStatus.FAILED.value,
        remarks="农残和重金属严重超标"
    )
    print(f"⚠️  检测失败: {r['inspection_status']}")
    print(f"   批次状态: {r['status']}")
    
    freeze_result = service.freeze_entity(
        entity_type="BATCH",
        entity_id=batch_id,
        reason="检测报告不合格，农残重金属超标",
        operator_id="OP005",
        operator_name="质量管理员"
    )
    print(f"❄️  冻结批次: {batch_id}")
    print(f"   冻结ID: {freeze_result['freeze_id']}")
    print(f"   原因: {freeze_result['reason']}")
    print(f"   影响批次: {freeze_result['affected_batches_count']} 个")
    print(f"   影响箱子: {freeze_result['affected_boxes_count']} 个")
    
    detail = service.get_batch_detail(batch_id)
    print(f"\n📋 冻结后批次状态:")
    print(f"   - 状态: {detail['batch']['status']}")
    print(f"   - 已冻结: {detail['batch']['frozen']}")
    print(f"   - 冻结原因: {detail['batch']['frozen_reason']}")
    
    freeze_report = service.generate_freeze_report(freeze_result['freeze_id'])
    print(f"\n📄 冻结报告摘要:")
    print(f"   - 报告ID: {freeze_report['report_id']}")
    print(f"   - 总影响批次: {freeze_report['summary']['total_affected_batches']}")
    print(f"   - 总影响箱子: {freeze_report['summary']['total_affected_boxes']}")
    
    return batch_id, freeze_result['freeze_id']


def scenario_4_outbound_and_recall():
    print("\n" + "="*60)
    print("【场景4】出库追溯与召回")
    print("="*60)
    
    origin = {
        "farm_id": "FARM005",
        "farm_name": "追溯农场",
        "region": "浙江省杭州市",
        "country": "中国"
    }
    
    r = service.create_batch(origin, "草莓", 400, "公斤", "OP001", "采购经理")
    batch_id = r["batch_id"]
    print(f"✅ 创建批次: {batch_id}")
    
    service.submit_inspection(
        batch_id, "INS001",
        [{"name": "各项检测", "result": "合格"}],
        InspectionStatus.PASSED.value, 30
    )
    
    service.warehouse_in(batch_id, 10, "OP002", "仓库管理员")
    print(f"✅ 入仓完成，10个箱子")
    
    r = service.sort_batch(
        batch_id,
        [
            {"box_count": 6, "product_type": "商超配送"},
            {"box_count": 4, "product_type": "电商配送"}
        ],
        "OP004", "分拣操作员"
    )
    child_batches = r['child_batches']
    print(f"✅ 分拣完成，子批次: {[c['child_batch_id'] for c in child_batches]}")
    
    out_result1 = service.warehouse_out(
        child_batches[0]['child_batch_id'],
        destination="上海沃尔玛超市",
        operator_id="OP006",
        operator_name="出库管理员"
    )
    print(f"✅ 子批次1出库: 目的地={out_result1['destination']}")
    print(f"   出库箱子: {len(out_result1['outbound_boxes'])} 个")
    
    out_result2 = service.warehouse_out(
        child_batches[1]['child_batch_id'],
        destination="杭州电商仓",
        operator_id="OP006",
        operator_name="出库管理员"
    )
    print(f"✅ 子批次2出库: 目的地={out_result2['destination']}")
    print(f"   出库箱子: {len(out_result2['outbound_boxes'])} 个")
    
    trace_result = service.trace_outbound(batch_id)
    print(f"\n🔍 追溯原批次 {batch_id} 的出库情况:")
    print(f"   总出库箱子: {trace_result['outbound_boxes_count']} 个")
    for box in trace_result['outbound_boxes']:
        print(f"   - {box['box_id']}: 原批次={box['original_batch_id']}, 目的地={box['destination']}")
    
    recall_result = service.recall_batches(
        source_batch_ids=[batch_id],
        reason="接到通知，该批次草莓可能受污染",
        operator_id="OP007",
        operator_name="召回管理员"
    )
    print(f"\n🚨 发起召回:")
    print(f"   召回ID: {recall_result['recall_id']}")
    print(f"   原因: {recall_result['reason']}")
    print(f"   影响批次: {recall_result['affected_batches_count']} 个")
    print(f"   影响箱子: {recall_result['affected_boxes_count']} 个")
    print(f"   已出库箱子: {recall_result['outbound_boxes_count']} 个")
    
    print(f"\n📦 已出库箱子详情（需要追回）:")
    for box in recall_result['outbound_boxes']:
        print(f"   - {box['box_id']}: 目的地={box['destination']}, 出库时间={box['outbound_at']}")
    
    recall_report = service.generate_recall_report(recall_result['recall_id'])
    print(f"\n📄 召回报告摘要:")
    print(f"   - 报告ID: {recall_report['report_id']}")
    print(f"   - 总影响批次: {recall_report['summary']['total_affected_batches']}")
    print(f"   - 总影响箱子: {recall_report['summary']['total_affected_boxes']}")
    print(f"   - 已出库箱子: {recall_report['summary']['outbound_boxes_count']}")
    print(f"   - 在库箱子: {recall_report['summary']['in_warehouse_boxes_count']}")
    
    return batch_id, recall_result['recall_id']


def scenario_5_rules_validation():
    print("\n" + "="*60)
    print("【场景5】规则验证（失败路径演示）")
    print("="*60)
    
    origin = {
        "farm_id": "FARM006",
        "farm_name": "规则验证农场",
        "region": "江苏省南京市",
        "country": "中国"
    }
    
    r = service.create_batch(origin, "黄瓜", 200, "公斤", "OP001", "测试员")
    batch_id = r["batch_id"]
    print(f"✅ 创建测试批次: {batch_id}")
    
    print("\n📌 测试1: 未检测就入仓（应该失败）")
    try:
        service.warehouse_in(batch_id, 5, "OP002", "仓库管理员")
        print("   ❌ 错误: 应该失败但成功了")
    except Exception as e:
        print(f"   ✅ 正确拦截: {e}")
    
    service.submit_inspection(
        batch_id, "INS001",
        [{"name": "检测", "result": "合格"}],
        InspectionStatus.PASSED.value, 30
    )
    service.warehouse_in(batch_id, 5, "OP002", "仓库管理员")
    print(f"\n✅ 正常检测并入仓")
    
    print("\n📌 测试2: 重复入仓（应该失败）")
    try:
        service.warehouse_in(batch_id, 5, "OP002", "仓库管理员")
        print("   ❌ 错误: 应该失败但成功了")
    except Exception as e:
        print(f"   ✅ 正确拦截: {e}")
    
    print("\n📌 测试3: 幂等性验证（重复调用）")
    idemp_key = "TEST_IDEMP_001"
    r1 = service.create_batch(
        origin, "测试产品", 100, "公斤", "OP001", "测试员",
        idempotency_key=idemp_key
    )
    r2 = service.create_batch(
        origin, "测试产品", 100, "公斤", "OP001", "测试员",
        idempotency_key=idemp_key
    )
    print(f"   第一次调用 batch_id: {r1['batch_id']}")
    print(f"   第二次调用 idempotent: {r2.get('idempotent')}, batch_id: {r2.get('batch_id')}")
    print(f"   ✅ 幂等性生效: {r1['batch_id'] == r2.get('batch_id') and r2.get('idempotent')}")
    
    recall_result = service.recall_batches(
        [batch_id], "测试召回", "OP007", "召回管理员"
    )
    print(f"\n✅ 召回批次: {batch_id}")
    
    print("\n📌 测试4: 召回后禁止分拣（应该失败）")
    try:
        service.sort_batch(
            batch_id,
            [{"box_count": 2, "product_type": "测试"}],
            "OP004", "分拣操作员"
        )
        print("   ❌ 错误: 应该失败但成功了")
    except Exception as e:
        print(f"   ✅ 正确拦截: {e}")
    
    return batch_id


def run_all_scenarios():
    print("\n" + "#"*60)
    print("#  农产品检测溯源API - 完整演示")
    print("#"*60)
    
    batch1 = scenario_1_normal_flow()
    mixed_batch, children = scenario_2_mix_and_sort()
    batch3, freeze_id = scenario_3_abnormal_freeze()
    batch4, recall_id = scenario_4_outbound_and_recall()
    batch5 = scenario_5_rules_validation()
    
    print("\n" + "="*60)
    print("【系统状态总览】")
    print("="*60)
    status = service.get_all_status()
    print(f"📊 总批次数量: {status['batches_total']}")
    print(f"📦 总箱子数量: {status['boxes_total']}")
    print(f"❄️  冻结箱子: {status['frozen_boxes']}")
    print(f"🚨 召回箱子: {status['recalled_boxes']}")
    print(f"📋 召回记录: {status['recalls_total']} 条")
    print(f"🧊 冻结记录: {status['freezes_total']} 条")
    print(f"\n批次状态分布:")
    for s, c in status['batch_status_summary'].items():
        print(f"   - {s}: {c} 个")
    
    audit = service.get_audit_history()
    print(f"\n📝 总审计记录: {audit['total']} 条")
    
    print("\n" + "#"*60)
    print("#  演示完成！")
    print("#"*60)
    print("\n关键数据ID供测试:")
    print(f"  正常批次: {batch1}")
    print(f"  混合批次: {mixed_batch}")
    print(f"  冻结批次: {batch3}, 冻结ID: {freeze_id}")
    print(f"  召回批次: {batch4}, 召回ID: {recall_id}")
    print(f"  规则测试: {batch5}")
    print(f"\n可访问接口:")
    print(f"  GET  /api/batches/{{batch_id}}          - 查询批次详情")
    print(f"  GET  /api/batches/{{batch_id}}/lineage  - 查询批次血缘")
    print(f"  GET  /api/reports/recall/{{recall_id}} - 查看召回报告")
    print(f"  GET  /api/reports/freeze/{{freeze_id}} - 查看冻结报告")
    print(f"  GET  /api/audit                         - 查看审计日志")


if __name__ == "__main__":
    if os.path.exists("./data/db.json"):
        print("⚠️  检测到已有数据，是否清空重新生成？(y/n): ", end="")
        try:
            choice = input().strip().lower()
            if choice == 'y':
                os.remove("./data/db.json")
                print("✅ 已清空旧数据")
                from app.database import db
                db.__init__(persist_path="./data/db.json")
        except:
            pass
    
    run_all_scenarios()
