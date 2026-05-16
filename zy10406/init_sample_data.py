#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8001"

def wait_for_server():
    print("等待服务启动...")
    for i in range(30):
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=2)
            if response.status_code == 200:
                print("服务已启动!")
                return True
        except:
            pass
        time.sleep(1)
    print("服务启动超时!")
    return False

def create_sample_pipeline():
    print("\n=== 创建样例管道 ===")
    data = {
        "pipeline_name": "nightly_user_behavior_20250516",
        "total_shards": 5,
        "shard_ranges": [
            {"start": "user_id_000000", "end": "user_id_200000"},
            {"start": "user_id_200001", "end": "user_id_400000"},
            {"start": "user_id_400001", "end": "user_id_600000"},
            {"start": "user_id_600001", "end": "user_id_800000"},
            {"start": "user_id_800001", "end": "user_id_999999"}
        ],
        "config": {
            "source": "kafka",
            "target": "clickhouse",
            "timeout": 3600
        }
    }
    response = requests.post(f"{BASE_URL}/api/pipelines", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
    return result["id"]

def simulate_failed_pipeline(pipeline_id):
    print("\n=== 模拟管道执行失败场景 ===")
    
    print("1. 续跑管道")
    resume_data = {"pipeline_id": pipeline_id}
    response = requests.post(f"{BASE_URL}/api/pipelines/resume", json=resume_data)
    print(f"续跑响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    print("\n2. 成功完成分片 0")
    complete_data = {
        "status": "success",
        "write_summary": {
            "records_written": 185234,
            "records_skipped": 12,
            "records_failed": 0,
            "duration_seconds": 125
        }
    }
    response = requests.put(
        f"{BASE_URL}/api/pipelines/{pipeline_id}/shards/0/complete",
        json=complete_data
    )
    print(f"分片 0 完成响应: {response.status_code}")
    
    print("\n3. 成功完成分片 1")
    complete_data["write_summary"]["records_written"] = 192105
    response = requests.put(
        f"{BASE_URL}/api/pipelines/{pipeline_id}/shards/1/complete",
        json=complete_data
    )
    print(f"分片 1 完成响应: {response.status_code}")
    
    print("\n4. 分片 2 执行失败")
    fail_data = {
        "status": "failed",
        "failure_reason": "ConnectionTimeout: 无法连接 ClickHouse 服务器，网络分区",
        "write_summary": {
            "records_written": 45230,
            "records_skipped": 5,
            "records_failed": 128
        }
    }
    response = requests.put(
        f"{BASE_URL}/api/pipelines/{pipeline_id}/shards/2/complete",
        json=fail_data
    )
    print(f"分片 2 失败响应: {response.status_code}")
    
    print("\n5. 查询当前管道状态")
    response = requests.get(f"{BASE_URL}/api/pipelines/{pipeline_id}")
    print(f"管道状态: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

def show_current_state(pipeline_id):
    print("\n=== 当前状态 ===")
    response = requests.get(f"{BASE_URL}/api/pipelines/{pipeline_id}")
    pipeline = response.json()
    print(f"管道名称: {pipeline['pipeline_name']}")
    print(f"管道状态: {pipeline['status']}")
    print(f"当前水位点: {pipeline['current_watermark']}")
    print(f"失败原因: {pipeline['last_failure_reason']}")
    
    response = requests.get(f"{BASE_URL}/api/pipelines/{pipeline_id}/shards")
    shards = response.json()
    print("\n分片状态:")
    for shard in shards:
        print(f"  分片 {shard['shard_index']}: {shard['status']} - {shard['shard_range_start']} ~ {shard['shard_range_end']}")

def main():
    print("=" * 50)
    print("数据管道断点续跑 API - 样例数据初始化")
    print("=" * 50)
    
    if not wait_for_server():
        return
    
    pipeline_id = create_sample_pipeline()
    simulate_failed_pipeline(pipeline_id)
    show_current_state(pipeline_id)
    
    print("\n" + "=" * 50)
    print(f"初始化完成! 管道 ID: {pipeline_id}")
    print("=" * 50)
    print("\n现在你可以:")
    print(f"1. 查询管道详情: curl {BASE_URL}/api/pipelines/{pipeline_id}")
    print(f"2. 尝试续跑管道: curl -X POST {BASE_URL}/api/pipelines/resume -H 'Content-Type: application/json' -d '{{\"pipeline_id\": {pipeline_id}}}'")
    print(f"3. 查看被拦截的场景（尝试重复执行已成功的分片）")
    print(f"4. 导出摘要: curl {BASE_URL}/api/pipelines/{pipeline_id}/export-summary")

if __name__ == "__main__":
    main()
