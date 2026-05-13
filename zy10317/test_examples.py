#!/usr/bin/env python3
"""
数据同步水位 API - 使用示例与测试脚本

包含:
1. 成功流程演示（正常的同步流程）
2. 问题流程演示（异常处理、幂等验证、回退重放）
3. 重启验证（重启服务后状态持久化验证）
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def print_section(title):
    """打印章节标题"""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


def print_response(title, response):
    """打印响应"""
    print(f"--- {title} ---")
    print(f"状态码: {response.status_code}")
    if response.status_code in [200, 201]:
        data = response.json()
        print(f"成功: {data.get('success')}")
        print(f"消息: {data.get('message')}")
        if data.get('data'):
            print(f"数据: {json.dumps(data.get('data'), ensure_ascii=False, indent=2)[:500]}...")
    else:
        print(f"错误: {response.text}")
    print()


def test_successful_flow():
    """测试1: 成功流程演示"""
    print_section("测试1: 成功流程演示 - 正常的同步流程")

    channel_code = f"ORDERS_{int(datetime.now().timestamp())}"
    batch_id = f"BATCH_{int(datetime.now().timestamp())}"
    consumer_id = f"consumer_{int(datetime.now().timestamp())}"

    # 1. 创建同步通道
    print("1. 创建同步通道")
    channel_data = {
        "channel_code": channel_code,
        "channel_name": "订单数据同步",
        "source_system": "MySQL-订单库",
        "target_system": "Elasticsearch-订单索引",
        "description": "订单表全量+增量同步通道",
        "initial_watermark": "0",
        "created_by": "admin"
    }
    response = requests.post(f"{BASE_URL}/api/channels", json=channel_data)
    print_response("创建通道", response)
    assert response.status_code == 200, "创建通道失败"

    # 2. 创建回退点（每日快照）
    print("2. 创建回退点")
    rollback_data = {
        "channel_code": channel_code,
        "point_name": "每日快照-2024-01-15",
        "watermark_value": "1000",
        "watermark_time": (datetime.now() - timedelta(days=1)).isoformat(),
        "created_by": "scheduler",
        "remark": "每日自动快照"
    }
    response = requests.post(f"{BASE_URL}/api/rollback-points", json=rollback_data)
    print_response("创建回退点", response)
    assert response.status_code == 200, "创建回退点失败"

    # 3. 推进水位
    print("3. 推进水位")
    watermark_data = {
        "channel_code": channel_code,
        "watermark_value": "5000",
        "watermark_time": datetime.now().isoformat(),
        "created_by": "sync_job",
        "remark": "增量同步推进"
    }
    response = requests.post(f"{BASE_URL}/api/watermarks/advance", json=watermark_data)
    print_response("推进水位", response)
    assert response.status_code == 200, "推进水位失败"

    # 4. 创建批次
    print("4. 创建批次")
    batch_data = {
        "channel_code": channel_code,
        "batch_id": batch_id,
        "start_watermark": "1000",
        "end_watermark": "5000",
        "record_count": 4000,
        "data_size": 1024000
    }
    response = requests.post(f"{BASE_URL}/api/batches", json=batch_data)
    print_response("创建批次", response)
    assert response.status_code == 200, "创建批次失败"

    # 5. 更新批次状态
    print("5. 更新批次状态为处理中")
    update_data = {"status": "processing", "processed_by": consumer_id}
    response = requests.put(f"{BASE_URL}/api/batches/{batch_id}/status", json=update_data)
    print_response("更新批次状态", response)
    assert response.status_code == 200, "更新批次状态失败"

    # 6. 消费确认
    print("6. 消费确认")
    confirm_data = {
        "batch_id": batch_id,
        "consumer_id": consumer_id,
        "confirmed_count": 4000,
        "success": True,
        "processing_time_ms": 1234.56
    }
    response = requests.post(f"{BASE_URL}/api/confirmations", json=confirm_data)
    print_response("消费确认", response)
    assert response.status_code == 200, "消费确认失败"

    # 7. 记录差异扫描
    print("7. 记录差异扫描结果")
    diff_data = {
        "channel_code": channel_code,
        "scan_start_time": (datetime.now() - timedelta(minutes=5)).isoformat(),
        "scan_end_time": datetime.now().isoformat(),
        "start_watermark": "1000",
        "end_watermark": "5000",
        "source_count": 4000,
        "target_count": 3998,
        "missing_in_target": 2,
        "missing_in_source": 0,
        "mismatch_count": 0,
        "scanned_by": "diff_checker"
    }
    response = requests.post(f"{BASE_URL}/api/diff-summaries", json=diff_data)
    print_response("记录差异扫描", response)
    assert response.status_code == 200, "记录差异扫描失败"

    # 8. 获取通道详情（完整状态）
    print("8. 获取通道完整状态")
    response = requests.get(f"{BASE_URL}/api/channels/{channel_code}")
    print_response("通道详情", response)
    assert response.status_code == 200, "获取通道详情失败"

    print(f"✓ 成功流程测试完成！通道: {channel_code}")
    return channel_code


def test_problem_flow():
    """测试2: 问题流程演示 - 异常处理、幂等验证、回退重放"""
    print_section("测试2: 问题流程演示 - 异常处理、幂等验证、回退重放")

    channel_code = f"USERS_{int(datetime.now().timestamp())}"
    batch_id = f"BATCH_ERR_{int(datetime.now().timestamp())}"
    consumer_id = "consumer_001"

    # 1. 创建同步通道
    print("1. 创建同步通道")
    channel_data = {
        "channel_code": channel_code,
        "channel_name": "用户数据同步",
        "source_system": "PostgreSQL-用户库",
        "target_system": "Redis-用户缓存",
        "description": "用户信息同步通道",
        "initial_watermark": "10000",
        "created_by": "admin"
    }
    response = requests.post(f"{BASE_URL}/api/channels", json=channel_data)
    print_response("创建通道", response)

    # 2. 幂等验证: 重复创建通道
    print("2. 幂等验证: 重复创建同一通道（应该失败）")
    response = requests.post(f"{BASE_URL}/api/channels", json=channel_data)
    print_response("重复创建通道", response)
    assert response.status_code == 400, "重复创建应该返回400"

    # 3. 创建回退点
    print("3. 创建回退点")
    rollback_data = {
        "channel_code": channel_code,
        "point_name": "校验点_v1",
        "watermark_value": "15000",
        "watermark_time": (datetime.now() - timedelta(hours=1)).isoformat(),
        "created_by": "admin",
        "remark": "数据校验通过"
    }
    response = requests.post(f"{BASE_URL}/api/rollback-points", json=rollback_data)
    rollback_point_id = response.json()['data']['rollback_point']['id']
    print_response("创建回退点", response)

    # 4. 推进水位
    print("4. 推进水位")
    watermark_data = {
        "channel_code": channel_code,
        "watermark_value": "20000",
        "watermark_time": datetime.now().isoformat(),
        "created_by": "sync_job"
    }
    response = requests.post(f"{BASE_URL}/api/watermarks/advance", json=watermark_data)
    print_response("推进水位", response)

    # 5. 幂等验证: 重复推进同一水位
    print("5. 幂等验证: 重复推进同一水位（应该幂等返回）")
    response = requests.post(f"{BASE_URL}/api/watermarks/advance", json=watermark_data)
    print_response("重复推进水位", response)
    data = response.json()
    assert data['data']['is_idempotent'] == True, "应该返回幂等标记"

    # 6. 创建批次
    print("6. 创建批次")
    batch_data = {
        "channel_code": channel_code,
        "batch_id": batch_id,
        "start_watermark": "15000",
        "end_watermark": "20000",
        "record_count": 5000
    }
    response = requests.post(f"{BASE_URL}/api/batches", json=batch_data)
    print_response("创建批次", response)

    # 7. 消费确认失败
    print("7. 消费确认失败（模拟消费异常）")
    confirm_data = {
        "batch_id": batch_id,
        "consumer_id": consumer_id,
        "confirmed_count": 4500,
        "success": False,
        "error_message": "数据格式转换错误: 第1234条记录缺少字段phone",
        "processing_time_ms": 890.23
    }
    response = requests.post(f"{BASE_URL}/api/confirmations", json=confirm_data)
    print_response("消费确认失败", response)

    # 8. 查看批次状态（应该是ERROR）
    print("8. 查看批次状态（应该是ERROR）")
    response = requests.get(f"{BASE_URL}/api/batches/{batch_id}")
    print_response("批次详情", response)
    data = response.json()
    assert data['data']['batch']['status'] == 'error'

    # 9. 执行回退
    print("9. 执行回退重放（回退到校验点）")
    rollback_execute = {
        "channel_code": channel_code,
        "rollback_point_id": rollback_point_id,
        "executed_by": "operator_001",
        "remark": "消费异常，回退后重放"
    }
    response = requests.post(f"{BASE_URL}/api/rollback/execute", json=rollback_execute)
    print_response("执行回退", response)
    data = response.json()
    assert data['data']['new_watermark'] == '15000', "水位应该回退到15000"
    assert data['data']['rolled_back_batches_count'] > 0, "应该有批次被回退"

    # 10. 查看通道当前水位
    print("10. 查看通道当前水位")
    response = requests.get(f"{BASE_URL}/api/channels/{channel_code}")
    print_response("通道详情", response)
    data = response.json()
    assert data['data']['channel']['current_watermark'] == '15000'

    # 11. 查看批次状态（应该是ROLLED_BACK）
    print("11. 查看批次状态（应该是ROLLED_BACK）")
    response = requests.get(f"{BASE_URL}/api/batches/{batch_id}")
    print_response("批次详情", response)
    data = response.json()
    assert data['data']['batch']['status'] == 'rolled_back'

    print(f"✓ 问题流程测试完成！通道: {channel_code}")
    return channel_code


def test_restart_persistence():
    """测试3: 重启后状态持久化验证"""
    print_section("测试3: 重启后状态持久化验证")

    # 使用之前测试创建的通道
    channel_code = input("请输入要验证的通道编码（直接回车跳过）: ").strip()

    if not channel_code:
        print("跳过重启验证测试")
        return

    print(f"验证通道 '{channel_code}' 的状态...")
    print("(如果服务已重启，请确认数据是否仍然存在)\n")

    # 1. 获取通道信息
    print("1. 获取通道基本信息")
    response = requests.get(f"{BASE_URL}/api/channels/{channel_code}")
    print_response("通道信息", response)

    # 2. 获取水位历史
    print("2. 获取水位历史")
    response = requests.get(f"{BASE_URL}/api/watermarks/{channel_code}/history")
    print_response("水位历史", response)

    # 3. 获取批次列表
    print("3. 获取批次列表")
    response = requests.get(f"{BASE_URL}/api/batches", params={"channel_code": channel_code})
    print_response("批次列表", response)

    # 4. 获取回退点
    print("4. 获取回退点列表")
    response = requests.get(f"{BASE_URL}/api/rollback-points/{channel_code}")
    print_response("回退点列表", response)

    # 5. 获取差异历史
    print("5. 获取差异扫描历史")
    response = requests.get(f"{BASE_URL}/api/diff-summaries", params={"channel_code": channel_code})
    print_response("差异历史", response)

    print(f"✓ 重启持久化验证完成！")


def run_all_tests():
    """运行所有测试"""
    print_section("数据同步水位 API 测试套件")
    print(f"服务地址: {BASE_URL}")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        # 检查服务是否运行
        response = requests.get(f"{BASE_URL}/", timeout=5)
        if response.status_code != 200:
            raise Exception("服务响应异常")
        print("✓ API 服务运行正常\n")
    except Exception as e:
        print(f"✗ 无法连接到 API 服务: {e}")
        print("请先启动服务: python -m app.main")
        return

    channels = []

    # 运行成功流程测试
    try:
        channel1 = test_successful_flow()
        channels.append(channel1)
    except Exception as e:
        print(f"✗ 成功流程测试失败: {e}")
        import traceback
        traceback.print_exc()

    # 运行问题流程测试
    try:
        channel2 = test_problem_flow()
        channels.append(channel2)
    except Exception as e:
        print(f"✗ 问题流程测试失败: {e}")
        import traceback
        traceback.print_exc()

    print_section("测试总结")
    print(f"创建的测试通道: {', '.join(channels)}")
    print("提示: 你可以重启服务后，使用这些通道编码验证数据持久化")
    print("\n要查看 API 文档，请访问: http://localhost:8000/docs")
    print("\n✓ 所有测试完成！")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        if sys.argv[1] == "success":
            test_successful_flow()
        elif sys.argv[1] == "problem":
            test_problem_flow()
        elif sys.argv[1] == "restart":
            test_restart_persistence()
        else:
            print("用法: python test_examples.py [success|problem|restart]")
    else:
        run_all_tests()
