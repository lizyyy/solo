from datetime import datetime, timedelta
import json
import uuid

SAMPLE_SNAPSHOTS = [
    {
        "snapshot_id": "snap_001",
        "client_id": "client_A",
        "round_num": 5,
        "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
        "feature_hash": "a1b2c3d4e5f6",
        "feature_count": 128
    },
    {
        "snapshot_id": "snap_002",
        "client_id": "client_B",
        "round_num": 5,
        "timestamp": (datetime.now() - timedelta(hours=26)).isoformat(),
        "feature_hash": "f6e5d4c3b2a1",
        "feature_count": 128
    },
    {
        "snapshot_id": "snap_003",
        "client_id": "client_A",
        "round_num": 5,
        "timestamp": (datetime.now() - timedelta(hours=25)).isoformat(),
        "feature_hash": "123456789abc",
        "feature_count": 128
    },
    {
        "snapshot_id": "snap_004",
        "client_id": "client_C",
        "round_num": 5,
        "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
        "feature_hash": "abcdef123456",
        "feature_count": 128
    }
]

SAMPLE_TRAINING_LOGS = [
    {
        "log_id": "log_001",
        "client_id": "client_A",
        "round_num": 5,
        "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
        "loss": 0.85,
        "accuracy": 0.78,
        "epoch": 10,
        "samples_processed": 5000,
        "log_content": "正常训练完成"
    },
    {
        "log_id": "log_002",
        "client_id": "client_A",
        "round_num": 5,
        "timestamp": (datetime.now() - timedelta(hours=25)).isoformat(),
        "loss": 3.2,
        "accuracy": 0.45,
        "epoch": 3,
        "samples_processed": 1200,
        "log_content": "训练中断，疑似网络问题"
    },
    {
        "log_id": "log_003",
        "client_id": "client_B",
        "round_num": 5,
        "timestamp": (datetime.now() - timedelta(hours=26)).isoformat(),
        "loss": 2.8,
        "accuracy": 0.52,
        "epoch": 5,
        "samples_processed": 2500,
        "log_content": "客户端响应超时"
    },
    {
        "log_id": "log_004",
        "client_id": "client_C",
        "round_num": 5,
        "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
        "loss": 0.72,
        "accuracy": 0.82,
        "epoch": 10,
        "samples_processed": 5000,
        "log_content": "正常训练完成"
    }
]


def generate_sample_files():
    with open("sample_snapshots.json", "w") as f:
        json.dump(SAMPLE_SNAPSHOTS, f, indent=2, ensure_ascii=False)
    with open("sample_logs.json", "w") as f:
        json.dump(SAMPLE_TRAINING_LOGS, f, indent=2, ensure_ascii=False)
    print("示例数据文件已生成: sample_snapshots.json, sample_logs.json")


if __name__ == "__main__":
    generate_sample_files()
