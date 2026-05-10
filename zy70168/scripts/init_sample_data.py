#!/usr/bin/env python3
"""
样例数据初始化脚本

覆盖三种场景：
1. 正常处理
2. 异常拦截
3. 重复操作
"""

import asyncio
import sys
from datetime import datetime, timedelta
import json

sys.path.insert(0, ".")

from sqlalchemy import select, and_
from app.database import AsyncSessionLocal, init_db
from app.models import LatencyWindow, Ranking, RankingType


async def setup_latency_windows(db):
    """设置迟到窗口配置"""
    print("=" * 60)
    print("【配置迟到窗口】")
    print("=" * 60)
    
    windows = [
        ("sales_amount", 3600, "销售额，迟到窗口1小时"),
        ("order_count", 1800, "订单数，迟到窗口30分钟"),
        ("conversion_rate", 7200, "转化率，迟到窗口2小时"),
    ]
    
    for metric_name, window_seconds, desc in windows:
        from app.models import LatencyWindow
        stmt = select(LatencyWindow).where(LatencyWindow.metric_name == metric_name)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if not existing:
            window = LatencyWindow(
                metric_name=metric_name,
                window_seconds=window_seconds,
                description=desc,
                is_active=True
            )
            db.add(window)
            print(f"  ✓ 创建: {metric_name} = {window_seconds}秒 ({desc})")
        else:
            print(f"  ℹ 已存在: {metric_name}")
    
    await db.commit()
    print()


async def send_event(session, event_data):
    """发送事件到API"""
    import httpx
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "http://localhost:8000/api/events",
            json=event_data
        )
        return response.json()


async def create_initial_rankings(db):
    """创建初始榜单数据"""
    print("=" * 60)
    print("【创建初始榜单】")
    print("=" * 60)
    
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    entities = [
        ("merchant_A", 150000),
        ("merchant_B", 120000),
        ("merchant_C", 90000),
        ("merchant_D", 60000),
        ("merchant_E", 30000),
    ]
    
    for rank, (entity_id, value) in enumerate(entities, start=1):
        ranking = Ranking(
            ranking_type=RankingType.DAILY,
            metric_name="sales_amount",
            ranking_date=today,
            entity_id=entity_id,
            rank=rank,
            value=value,
            version=1,
            is_latest=True,
            is_replayed=False
        )
        db.add(ranking)
        print(f"  ✓ 排名 {rank}: {entity_id} = ¥{value:,.0f}")
    
    await db.commit()
    print()


async def scenario_1_normal_processing():
    """场景1：正常处理"""
    print("\n" + "=" * 60)
    print("场景1：正常处理")
    print("=" * 60)
    print("说明：事件在迟到窗口内到达，正常处理")
    print()
    
    now = datetime.utcnow()
    event_time = now - timedelta(minutes=30)
    
    events = [
        {
            "event_id": "evt_normal_001",
            "event_time": event_time.isoformat(),
            "metric_name": "sales_amount",
            "metric_value": 50000,
            "entity_id": "merchant_A",
            "dimensions": {"channel": "mobile", "region": "east"}
        },
        {
            "event_id": "evt_normal_002",
            "event_time": (event_time + timedelta(minutes=5)).isoformat(),
            "metric_name": "sales_amount",
            "metric_value": 30000,
            "entity_id": "merchant_B",
            "dimensions": {"channel": "pc", "region": "north"}
        },
        {
            "event_id": "evt_normal_003",
            "event_time": (event_time + timedelta(minutes=10)).isoformat(),
            "metric_name": "order_count",
            "metric_value": 25,
            "entity_id": "merchant_A",
            "dimensions": {}
        }
    ]
    
    import httpx
    async with httpx.AsyncClient(timeout=30.0) as client:
        for i, event in enumerate(events, 1):
            print(f"【事件 {i}】{event['event_id']}")
            print(f"  event_time: {event['event_time']}")
            print(f"  metric: {event['metric_name']} = {event['metric_value']}")
            print(f"  entity: {event['entity_id']}")
            
            response = await client.post(
                "http://localhost:8000/api/events",
                json=event
            )
            result = response.json()
            print(f"  状态: {result['status']}")
            print(f"  是否迟到: {result['is_late']}")
            print(f"  消息: {result['message']}")
            if result.get('snapshot'):
                print(f"  快照值: {result['snapshot']['value']} (版本 {result['snapshot']['version']})")
            print()


async def scenario_2_exception_interception():
    """场景2：异常拦截"""
    print("\n" + "=" * 60)
    print("场景2：异常拦截")
    print("=" * 60)
    print("说明：指标值为负数，被异常拦截")
    print()
    
    now = datetime.utcnow()
    event_time = now - timedelta(minutes=15)
    
    events = [
        {
            "event_id": "evt_abnormal_001",
            "event_time": event_time.isoformat(),
            "metric_name": "sales_amount",
            "metric_value": -1000,
            "entity_id": "merchant_A",
            "dimensions": {"note": "测试负数拦截"}
        }
    ]
    
    import httpx
    async with httpx.AsyncClient(timeout=30.0) as client:
        for i, event in enumerate(events, 1):
            print(f"【事件 {i}】{event['event_id']}")
            print(f"  指标值: {event['metric_value']} (负数)")
            
            response = await client.post(
                "http://localhost:8000/api/events",
                json=event
            )
            result = response.json()
            print(f"  状态: {result['status']}")
            print(f"  消息: {result['message']}")
            print()


async def scenario_3_duplicate_operation():
    """场景3：重复操作"""
    print("\n" + "=" * 60)
    print("场景3：重复操作")
    print("=" * 60)
    print("说明：相同event_id重复上报，被识别为重复事件")
    print()
    
    now = datetime.utcnow()
    event_time = now - timedelta(minutes=45)
    
    event = {
        "event_id": "evt_duplicate_test",
        "event_time": event_time.isoformat(),
        "metric_name": "sales_amount",
        "metric_value": 15000,
        "entity_id": "merchant_C",
        "dimensions": {"test": "duplicate"}
    }
    
    import httpx
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("【第一次上报】")
        response1 = await client.post(
            "http://localhost:8000/api/events",
            json=event
        )
        result1 = response1.json()
        print(f"  状态: {result1['status']}")
        print(f"  消息: {result1['message']}")
        print()
        
        print("【第二次上报（相同event_id）】")
        response2 = await client.post(
            "http://localhost:8000/api/events",
            json=event
        )
        result2 = response2.json()
        print(f"  状态: {result2['status']}")
        print(f"  消息: {result2['message']}")
        print()


async def scenario_4_late_event_correction():
    """场景4：迟到事件触发修正"""
    print("\n" + "=" * 60)
    print("场景4：迟到事件触发修正")
    print("=" * 60)
    print("说明：事件超过迟到窗口到达，触发自动修正流程")
    print()
    
    now = datetime.utcnow()
    event_time = now - timedelta(hours=2, minutes=30)
    
    events = [
        {
            "event_id": "evt_late_001",
            "event_time": event_time.isoformat(),
            "metric_name": "sales_amount",
            "metric_value": 80000,
            "entity_id": "merchant_A",
            "dimensions": {"note": "迟到事件测试"}
        }
    ]
    
    import httpx
    async with httpx.AsyncClient(timeout=30.0) as client:
        for i, event in enumerate(events, 1):
            print(f"【事件 {i}】{event['event_id']}")
            print(f"  event_time: {event['event_time']}")
            print(f"  延迟: {(now - datetime.fromisoformat(event['event_time'])).total_seconds() / 60:.0f} 分钟")
            
            response = await client.post(
                "http://localhost:8000/api/events",
                json=event
            )
            result = response.json()
            print(f"  状态: {result['status']}")
            print(f"  是否迟到: {result['is_late']}")
            print(f"  消息: {result['message']}")
            if result.get('snapshot'):
                print(f"  快照值: {result['snapshot']['value']} (版本 {result['snapshot']['version']})")
            if result.get('triggered_reports'):
                print(f"  生成修正报告: {len(result['triggered_reports'])} 个")
            print()


async def scenario_5_manual_correction():
    """场景5：人工修正"""
    print("\n" + "=" * 60)
    print("场景5：人工修正")
    print("=" * 60)
    print("说明：人工指定修正值，锁定状态")
    print()
    
    now = datetime.utcnow()
    bucket_time = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
    
    correction_data = {
        "metric_name": "sales_amount",
        "entity_id": "merchant_A",
        "bucket_time": bucket_time.isoformat(),
        "new_value": 200000,
        "operator": "admin_user",
        "reason": "财务对账发现漏记一笔订单"
    }
    
    import httpx
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("【查看修正前快照】")
        response = await client.get(
            f"http://localhost:8000/api/metrics/snapshots",
            params={
                "metric_name": "sales_amount",
                "entity_id": "merchant_A",
                "bucket_time": bucket_time.isoformat(),
                "is_latest_only": "true"
            }
        )
        snapshots = response.json()
        if snapshots:
            print(f"  当前值: {snapshots[0]['value']}")
            print(f"  版本: {snapshots[0]['version']}")
            print(f"  来源: {snapshots[0]['source']}")
        else:
            print("  暂无快照")
        print()
        
        print("【执行人工修正】")
        print(f"  修正值: {correction_data['new_value']}")
        print(f"  操作人: {correction_data['operator']}")
        print(f"  原因: {correction_data['reason']}")
        
        response = await client.post(
            "http://localhost:8000/api/metrics/manual-correction",
            json=correction_data
        )
        result = response.json()
        print(f"\n  结果: {result['success']}")
        print(f"  原值 -> 新值: {result['original_value']} -> {result['new_value']}")
        print(f"  新版本: {result['version']}")
        print(f"  影响告警: {result['affected_alerts_count']} 个")
        print(f"  影响榜单: {result['affected_rankings_count']} 个")
        print(f"  报告ID: {result['report_id']}")
        print()


async def main():
    print("\n" + "█" * 60)
    print("█    实时指标迟到修正服务 - 样例数据初始化")
    print("█" * 60)
    print()
    
    import os
    db_dir = "./data"
    if not os.path.exists(db_dir):
        os.makedirs(db_dir)
    
    await init_db()
    
    async with AsyncSessionLocal() as db:
        await setup_latency_windows(db)
        await create_initial_rankings(db)
    
    print("\n请确保服务已启动 (uvicorn app.main:app --reload)")
    print("按回车键继续执行样例场景...")
    input()
    
    await scenario_1_normal_processing()
    await scenario_2_exception_interception()
    await scenario_3_duplicate_operation()
    await scenario_4_late_event_correction()
    await scenario_5_manual_correction()
    
    print("\n" + "=" * 60)
    print("样例场景执行完成！")
    print("=" * 60)
    print("\n下一步可以：")
    print("  1. 访问 http://localhost:8000/docs 查看API文档")
    print("  2. GET /api/events 查看所有事件")
    print("  3. GET /api/metrics/snapshots 查看指标快照")
    print("  4. GET /api/correction-reports 查看修正报告")
    print("  5. GET /api/alerts 查看告警记录")
    print("  6. GET /api/rankings?metric_name=sales_amount&ranking_date=... 查看榜单")
    print()


if __name__ == "__main__":
    asyncio.run(main())
