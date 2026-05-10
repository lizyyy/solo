#!/usr/bin/env python3
"""快速测试脚本 - 验证核心功能"""

import asyncio
import sys
from datetime import datetime, timedelta
import json

sys.path.insert(0, ".")

import httpx

BASE_URL = "http://localhost:8000"


async def test_scenario_1_normal():
    print("\n" + "="*60)
    print("场景1: 正常处理 - 事件在迟到窗口内到达")
    print("="*60)
    
    now = datetime.utcnow()
    event_time = now - timedelta(minutes=30)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{BASE_URL}/api/events", json={
            "event_id": "test_normal_001",
            "event_time": event_time.isoformat(),
            "metric_name": "sales_amount",
            "metric_value": 50000,
            "entity_id": "merchant_A",
            "dimensions": {"test": "normal"}
        })
        result = resp.json()
        print(f"  event_id: test_normal_001")
        print(f"  is_late: {result['is_late']} (预期: false)")
        print(f"  status: {result['status']} (预期: processed)")
        if result['snapshot']:
            print(f"  snapshot.value: {result['snapshot']['value']} (预期: 50000)")
            print(f"  snapshot.version: {result['snapshot']['version']} (预期: 1)")
        
        assert result['is_late'] == False, "正常事件不应标记为迟到"
        assert result['status'] == 'processed', "正常事件应被处理"
        print("  ✅ 正常处理测试通过")


async def test_scenario_2_exception():
    print("\n" + "="*60)
    print("场景2: 异常拦截 - 负数指标值")
    print("="*60)
    
    now = datetime.utcnow()
    event_time = now - timedelta(minutes=15)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{BASE_URL}/api/events", json={
            "event_id": "test_abnormal_001",
            "event_time": event_time.isoformat(),
            "metric_name": "sales_amount",
            "metric_value": -1000,
            "entity_id": "merchant_A",
            "dimensions": {"test": "negative"}
        })
        result = resp.json()
        print(f"  metric_value: -1000 (负数)")
        print(f"  status: {result['status']} (预期: aborted)")
        print(f"  message: {result['message']}")
        
        assert result['status'] == 'aborted', "负数应被拦截"
        assert "异常拦截" in result['message'], "应包含异常拦截消息"
        print("  ✅ 异常拦截测试通过")


async def test_scenario_3_duplicate():
    print("\n" + "="*60)
    print("场景3: 重复操作 - 相同event_id")
    print("="*60)
    
    now = datetime.utcnow()
    event_time = now - timedelta(minutes=45)
    event_data = {
        "event_id": "test_dup_001",
        "event_time": event_time.isoformat(),
        "metric_name": "sales_amount",
        "metric_value": 15000,
        "entity_id": "merchant_B",
        "dimensions": {"test": "duplicate"}
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("  第一次上报...")
        resp1 = await client.post(f"{BASE_URL}/api/events", json=event_data)
        result1 = resp1.json()
        print(f"    第一次 status: {result1['status']} (预期: processed)")
        assert result1['status'] == 'processed', "第一次应正常处理"
        
        print("  第二次上报 (相同event_id)...")
        resp2 = await client.post(f"{BASE_URL}/api/events", json=event_data)
        result2 = resp2.json()
        print(f"    第二次 status: {result2['status']} (预期: duplicate)")
        assert result2['status'] == 'duplicate', "第二次应识别为重复"
        
        print("  ✅ 重复操作测试通过")


async def test_scenario_4_late_event():
    print("\n" + "="*60)
    print("场景4: 迟到事件 - 超过迟到窗口到达")
    print("="*60)
    
    now = datetime.utcnow()
    event_time = now - timedelta(hours=2, minutes=30)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{BASE_URL}/api/events", json={
            "event_id": "test_late_001",
            "event_time": event_time.isoformat(),
            "metric_name": "sales_amount",
            "metric_value": 80000,
            "entity_id": "merchant_A",
            "dimensions": {"test": "late"}
        })
        result = resp.json()
        latency = int((now - datetime.fromisoformat(event_time.isoformat())).total_seconds())
        print(f"  延迟: {latency} 秒 (迟到窗口: 3600秒)")
        print(f"  is_late: {result['is_late']} (预期: true)")
        print(f"  reports_count: {len(result.get('triggered_reports', []))}")
        
        assert result['is_late'] == True, "迟到事件应被标记"
        print("  ✅ 迟到事件测试通过")


async def test_scenario_5_manual_correction():
    print("\n" + "="*60)
    print("场景5: 人工修正")
    print("="*60)
    
    now = datetime.utcnow()
    bucket_time = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("  执行人工修正...")
        resp = await client.post(f"{BASE_URL}/api/metrics/manual-correction", json={
            "metric_name": "sales_amount",
            "entity_id": "merchant_A",
            "bucket_time": bucket_time.isoformat(),
            "new_value": 200000,
            "operator": "test_admin",
            "reason": "测试人工修正"
        })
        result = resp.json()
        print(f"    success: {result['success']}")
        print(f"    原值 -> 新值: {result['original_value']} -> {result['new_value']}")
        print(f"    新版本: {result['version']}")
        
        assert result['success'] == True, "人工修正应成功"
        
        print("  验证修正后的值...")
        resp2 = await client.get(f"{BASE_URL}/api/metrics/snapshots", params={
            "metric_name": "sales_amount",
            "entity_id": "merchant_A",
            "bucket_time": bucket_time.isoformat(),
            "is_latest_only": "true"
        })
        snapshots = resp2.json()
        if snapshots:
            print(f"    is_manual_overridden: {snapshots[0]['is_manual_overridden']} (预期: true)")
            print(f"    value: {snapshots[0]['value']} (预期: 200000)")
            assert snapshots[0]['is_manual_overridden'] == True, "应标记为人工覆盖"
            assert snapshots[0]['value'] == 200000, "值应为人工修正值"
        
        print("  ✅ 人工修正测试通过")


async def test_query_apis():
    print("\n" + "="*60)
    print("场景6: 查询API验证")
    print("="*60)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("  查询事件列表...")
        resp = await client.get(f"{BASE_URL}/api/events", params={"limit": 10})
        events = resp.json()
        print(f"    事件数量: {len(events)}")
        assert len(events) > 0, "应有事件记录"
        
        print("  查询指标快照...")
        resp = await client.get(f"{BASE_URL}/api/metrics/snapshots", params={"limit": 10})
        snapshots = resp.json()
        print(f"    快照数量: {len(snapshots)}")
        
        print("  查询修正报告...")
        resp = await client.get(f"{BASE_URL}/api/correction-reports")
        reports = resp.json()
        print(f"    报告数量: {len(reports)}")
        
        print("  ✅ 查询API测试通过")


async def main():
    print("🚀 实时指标迟到修正服务 - 快速测试")
    print("="*60)
    
    try:
        await test_scenario_1_normal()
        await test_scenario_2_exception()
        await test_scenario_3_duplicate()
        await test_scenario_4_late_event()
        await test_scenario_5_manual_correction()
        await test_query_apis()
        
        print("\n" + "="*60)
        print("🎉 所有测试通过！")
        print("="*60)
        print("\n下一步:")
        print("  - 访问 http://localhost:8000/docs 查看完整API文档")
        print("  - 阅读 docs/使用说明.md 了解更多")
        print("  - 运行 ./run_sample.sh 运行完整样例")
        
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
