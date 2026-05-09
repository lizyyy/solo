#!/usr/bin/env python3
"""口岸冷藏车排队温控API - 异常样例脚本

包含三类异常:
1. 重复数据异常
2. 缺字段异常
3. 人工改错异常
"""

import sys
import json
from datetime import datetime, timedelta
from scripts.client import PortApiClient


def print_separator(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def demo_duplicate_data(client: PortApiClient):
    """演示: 重复数据异常"""
    print_separator("异常样例 1: 重复数据异常")

    plate = "沪A-TEST-001"
    print(f"\n[步骤1] 首次入队: {plate}")
    result1 = client.enqueue_vehicle(
        plate_number=plate,
        cargo_type="疫苗",
        target_temp_low=-25.0,
        target_temp_high=-15.0
    )
    print(f"  成功: 排队号={result1.get('queue_number')}, 状态={result1.get('status')}")

    print(f"\n[步骤2] 同一车牌再次入队 (应该报错)...")
    result2 = client.enqueue_vehicle(
        plate_number=plate,
        cargo_type="药品",
        target_temp_low=-20.0,
        target_temp_high=-10.0
    )
    print(f"  结果: {json.dumps(result2, ensure_ascii=False, indent=2)}")

    vehicle_id = result1.get("id")
    record_time = datetime.utcnow()

    print(f"\n[步骤3] 首次上报温度...")
    temp1 = client.add_temperature(vehicle_id, -20.0, record_time)
    print(f"  成功: 温度记录ID={temp1.get('id')}, 是否正常={temp1.get('is_normal')}")

    print(f"\n[步骤4] 同一时间点再次上报 (应该报错)...")
    temp2 = client.add_temperature(vehicle_id, -18.0, record_time)
    print(f"  结果: {json.dumps(temp2, ensure_ascii=False, indent=2)}")

    return vehicle_id


def demo_missing_fields(client: PortApiClient):
    """演示: 缺字段异常"""
    print_separator("异常样例 2: 缺字段异常")

    import httpx

    print(f"\n[步骤1] 入队请求缺少 cargo_type 字段...")
    resp = httpx.post(
        f"{client.base_url}/api/queue/vehicles",
        json={
            "plate_number": "沪A-TEST-002",
            "target_temp_low": -18.0,
            "target_temp_high": 0.0
        }
    )
    print(f"  结果: {resp.status_code} - {json.dumps(resp.json(), ensure_ascii=False, indent=2)}")

    print(f"\n[步骤2] 入队请求缺少 plate_number 字段...")
    resp2 = httpx.post(
        f"{client.base_url}/api/queue/vehicles",
        json={
            "cargo_type": "海鲜",
            "target_temp_low": -5.0,
            "target_temp_high": 5.0
        }
    )
    print(f"  结果: {resp2.status_code} - {json.dumps(resp2.json(), ensure_ascii=False, indent=2)}")

    print(f"\n[步骤3] 人工修改温度缺少修改人...")
    resp3 = httpx.patch(
        f"{client.base_url}/api/temperature/999/manual-update",
        json={
            "new_temperature": -18.0,
            "reason": "设备校准"
        }
    )
    print(f"  结果: {resp3.status_code} - {json.dumps(resp3.json(), ensure_ascii=False, indent=2)}")


def demo_manual_modification(client: PortApiClient):
    """演示: 人工改错异常"""
    print_separator("异常样例 3: 人工改错异常")

    print(f"\n[步骤1] 入队一辆疫苗运输车 (高风险)...")
    vehicle = client.enqueue_vehicle(
        plate_number="沪A-TEST-003",
        cargo_type="疫苗",
        target_temp_low=-25.0,
        target_temp_high=-15.0,
        remark="新冠疫苗冷链运输"
    )
    vehicle_id = vehicle.get("id")
    print(f"  车辆ID={vehicle_id}, 风险等级={vehicle.get('risk_level')}, 优先级={vehicle.get('inspection_priority')}")

    print(f"\n[步骤2] 上报一个异常高温 (8℃, 应该触发异常)...")
    record_time = datetime.utcnow()
    temp_record = client.add_temperature(vehicle_id, 8.0, record_time, remark="首次温度读取")
    print(f"  温度记录ID={temp_record.get('id')}, 是否正常={temp_record.get('is_normal')}, 异常类型={temp_record.get('anomaly_type')}")

    print(f"\n[步骤3] 再次查询车辆，查验优先级应该已提升...")
    vehicle_detail = client.get_vehicle(vehicle_id)
    print(f"  当前优先级={vehicle_detail.get('inspection_priority')}")

    record_id = temp_record.get("id")
    print(f"\n[步骤4] 人工改错: 把8℃改为-18℃ (试图掩盖温控异常)...")
    modified = client.manual_update_temperature(
        record_id=record_id,
        new_temperature=-18.0,
        modified_by="可疑人员X",
        reason="温度探头误报"
    )
    print(f"  修改结果:")
    print(f"    - 原温度={modified.get('original_temperature')}℃")
    print(f"    - 现温度={modified.get('temperature')}℃")
    print(f"    - 是否人为修改={modified.get('is_manual_modified')}")
    print(f"    - 修改人={modified.get('modified_by')}")
    print(f"    - 备注={modified.get('remark')}")

    print(f"\n[步骤5] 再次查询车辆详情，人工修改痕迹被保留...")
    detail = client.get_vehicle(vehicle_id)
    print(f"  温度记录详情:")
    for tr in detail.get("temperature_records", []):
        print(f"    - 时间={tr.get('record_time')[:19]}, 温度={tr.get('temperature')}℃, 原温度={tr.get('original_temperature')}℃, 人工修改={tr.get('is_manual_modified')}")

    print(f"\n[步骤6] 尝试再次修改同一条记录 (应该报错: 已修改过不可再次修改)...")
    modified2 = client.manual_update_temperature(
        record_id=record_id,
        new_temperature=-20.0,
        modified_by="张三",
        reason="再次修改"
    )
    print(f"  结果: {json.dumps(modified2, ensure_ascii=False, indent=2)}")

    return vehicle_id


def demo_status_flow_exception(client: PortApiClient):
    """演示: 状态流转异常"""
    print_separator("异常样例 4: 状态流转异常")

    print(f"\n[步骤1] 入队一辆正常冷冻食品车...")
    vehicle = client.enqueue_vehicle(
        plate_number="沪A-TEST-004",
        cargo_type="冷冻食品",
        target_temp_low=-18.0,
        target_temp_high=-10.0
    )
    vehicle_id = vehicle.get("id")
    print(f"  初始状态={vehicle.get('status')}")

    print(f"\n[步骤2] 开始查验...")
    inspection = client.start_inspection(vehicle_id, inspector="李查验员")
    inspection_id = inspection.get("id")
    vehicle_after = client.get_vehicle(vehicle_id)
    print(f"  查验ID={inspection_id}, 车辆状态={vehicle_after.get('status')}")

    print(f"\n[步骤3] 完成查验 - 放行...")
    result = client.complete_inspection(
        inspection_id=inspection_id,
        inspection_result="passed",
        check_points="温控正常, 单据齐全",
        issues_found="无"
    )
    print(f"  查验结果={result.get('vehicle', {}).get('status')}")

    print(f"\n[步骤4] 已放行车辆尝试再次开始查验 (应该报错)...")
    inspection2 = client.start_inspection(vehicle_id, inspector="王查验员")
    print(f"  结果: {json.dumps(inspection2, ensure_ascii=False, indent=2)}")


def main():
    print("口岸冷藏车排队温控API - 异常样例演示")
    print("=" * 60)

    with PortApiClient() as client:
        try:
            print("\n[前置检查] 健康检查...")
            health = client.health_check()
            print(f"  服务状态: {health}")
        except Exception as e:
            print(f"\n[错误] 无法连接到服务器: {e}")
            print("\n请先启动服务:")
            print("  cd /Users/mac/pro/solo/workspaces/xy10262")
            print("  pip install -r requirements.txt")
            print("  python -m uvicorn app.main:app --reload")
            sys.exit(1)

        try:
            demo_duplicate_data(client)
            demo_missing_fields(client)
            demo_manual_modification(client)
            demo_status_flow_exception(client)
        except Exception as e:
            print(f"\n[执行异常] {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 60)
    print("  异常样例演示完成")
    print("  异常类型: 重复数据 | 缺字段 | 人工改错 | 状态流转")
    print("=" * 60)


if __name__ == "__main__":
    main()
