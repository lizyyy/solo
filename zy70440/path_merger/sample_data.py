import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import List

from .models import PathRecord


def generate_sample_records(batch_id: str = "SAMPLE_20240515") -> List[PathRecord]:
    records = []

    base_time = datetime(2024, 5, 15, 9, 0, 0)

    records.append(PathRecord(
        record_id=f"{batch_id}_001",
        batch_id=batch_id,
        source="after_sales_recording",
        recording_id="REC_20240515_0900_A001",
        agent_id="AGENT_001",
        customer_id="CUST_10001",
        start_time=base_time,
        end_time=base_time + timedelta(minutes=15),
        permission_path=[
            "/customer/profile/basic",
            "/customer/service/history",
            "/order/query/basic"
        ],
        actual_path=[
            "/customer/profile/basic",
            "/customer/service/history",
            "/order/query/basic",
            "/order/query/detail"
        ]
    ))

    records.append(PathRecord(
        record_id=f"{batch_id}_002",
        batch_id=batch_id,
        source="after_sales_recording",
        recording_id="REC_20240515_0920_A001",
        agent_id="AGENT_001",
        customer_id="CUST_10002",
        start_time=base_time + timedelta(minutes=20),
        end_time=base_time + timedelta(minutes=45),
        permission_path=[
            "/customer/profile/basic",
            "/refund/apply",
            "/complaint/create"
        ],
        actual_path=[
            "/customer/profile/basic",
            "/customer/profile/contact",
            "/refund/apply",
            "/refund/approve",
            "/complaint/create"
        ]
    ))

    records.append(PathRecord(
        record_id=f"{batch_id}_003",
        batch_id=batch_id,
        source="after_sales_recording",
        recording_id="REC_20240515_2330_A002",
        agent_id="AGENT_002",
        customer_id="CUST_10003",
        start_time=datetime(2024, 5, 15, 23, 30, 0),
        end_time=datetime(2024, 5, 16, 0, 15, 0),
        permission_path=[
            "/customer/profile/basic",
            "/technical/support/basic"
        ],
        actual_path=[
            "/customer/profile/basic",
            "/technical/support/basic",
            "/technical/support/advanced"
        ]
    ))

    records.append(PathRecord(
        record_id=f"{batch_id}_004",
        batch_id=batch_id,
        source="after_sales_recording",
        recording_id="REC_20240515_1000_A003",
        agent_id="AGENT_003",
        customer_id="CUST_10004",
        start_time=base_time + timedelta(hours=1),
        end_time=base_time + timedelta(hours=1, minutes=20),
        permission_path=[
            "/customer/profile/basic",
            "/warranty/check"
        ],
        actual_path=[
            "/customer/profile/basic",
            "/customer/profile/sensitive",
            "/warranty/check",
            "/warranty/claim",
            "/admin/system/access"
        ]
    ))

    records.append(PathRecord(
        record_id=f"{batch_id}_005",
        batch_id=batch_id,
        source="after_sales_recording",
        recording_id="REC_20240515_1030_A003",
        agent_id="AGENT_003",
        customer_id="CUST_10005",
        start_time=base_time + timedelta(hours=1, minutes=30),
        end_time=base_time + timedelta(hours=2),
        permission_path=[
            "/customer/profile/basic"
        ],
        actual_path=[]
    ))

    records.append(PathRecord(
        record_id=f"{batch_id}_006",
        batch_id=batch_id,
        source="after_sales_recording",
        recording_id="REC_20240515_1100_A004",
        agent_id="AGENT_004",
        customer_id="CUST_10006",
        start_time=base_time + timedelta(hours=2),
        end_time=base_time + timedelta(hours=2, minutes=25),
        permission_path=[
            "/customer/profile/basic",
            "/return/process",
            "/exchange/apply"
        ],
        actual_path=[
            "/customer/profile/basic",
            "/return/process",
            "/exchange/apply"
        ]
    ))

    records.append(PathRecord(
        record_id=f"{batch_id}_007",
        batch_id=batch_id,
        source="after_sales_recording",
        recording_id="REC_20240515_1400_A005",
        agent_id="AGENT_005",
        customer_id="CUST_10007",
        start_time=base_time + timedelta(hours=5),
        end_time=base_time + timedelta(hours=5, minutes=40),
        permission_path=[
            "/customer/profile/basic",
            "/feedback/submit"
        ],
        actual_path=[
            "/customer/profile/basic",
            "/feedback/submit",
            "/feedback/escalate",
            "/manager/special/approval"
        ]
    ))

    records.append(PathRecord(
        record_id=f"{batch_id}_008",
        batch_id=batch_id,
        source="manual_fix",
        recording_id="REC_20240514_1600_A001",
        agent_id="AGENT_001",
        customer_id="CUST_10008",
        start_time=base_time - timedelta(hours=17),
        end_time=base_time - timedelta(hours=16, minutes=30),
        permission_path=[
            "/customer/profile/basic",
            "/complaint/review"
        ],
        actual_path=[
            "/customer/profile/basic",
            "/complaint/review",
            "/complaint/close"
        ],
        is_manual_fix=True,
        fix_reason="人工审核确认：高级客服主管有权限处理客诉关闭，此前误判为权限放大",
        fix_time=base_time - timedelta(hours=2)
    ))

    return records


def save_sample_data(records: List[PathRecord], output_dir: str = "./data/samples") -> str:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    batch_id = records[0].batch_id if records else "UNKNOWN"
    filename = f"sample_batch_{batch_id}.json"
    file_path = output_path / filename

    data = [r.model_dump() for r in records]
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    return str(file_path)


def load_sample_data(file_path: str) -> List[PathRecord]:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        return [PathRecord(**r) for r in data]


if __name__ == "__main__":
    records = generate_sample_records()
    path = save_sample_data(records)
    print(f"Generated {len(records)} sample records at: {path}")
