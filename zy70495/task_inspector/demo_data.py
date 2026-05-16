from datetime import datetime, timedelta
from typing import List

from .models import DutyRecord, generate_id
from .storage import Storage


def generate_demo_data(storage: Storage):
    now = datetime.now()
    records = []

    for i in range(5):
        date = (now - timedelta(days=i+1)).strftime("%Y-%m-%d")
        record = DutyRecord(
            record_id=generate_id(),
            date=date,
            engineer=f"工程师{i+1}",
            content=f"正常值班记录{i+1}：完成代码评审、处理线上告警3个、同步进度",
            version=3,
            last_updated=now - timedelta(days=i),
            created_at=now - timedelta(days=i+1),
            is_expired=False,
            metadata={
                "version_history": [
                    {
                        "version": 1,
                        "content": f"草稿记录{i+1}",
                        "updated_at": (now - timedelta(days=i+2)).isoformat()
                    },
                    {
                        "version": 2,
                        "content": f"更新记录{i+1}",
                        "updated_at": (now - timedelta(days=i+1, hours=12)).isoformat()
                    },
                    {
                        "version": 3,
                        "content": f"正常值班记录{i+1}：完成代码评审、处理线上告警3个、同步进度",
                        "updated_at": (now - timedelta(days=i)).isoformat()
                    }
                ]
            }
        )
        records.append(record)

    bad_record = DutyRecord(
        record_id=generate_id(),
        date=(now - timedelta(days=10)).strftime("%Y-%m-%d"),
        engineer="工程师6",
        content="有问题的记录：旧版本覆盖了新版本",
        version=2,
        last_updated=now - timedelta(days=8),
        created_at=now - timedelta(days=10),
        is_expired=True,
        metadata={
            "version_history": [
                {
                    "version": 1,
                    "content": "草稿记录6",
                    "updated_at": (now - timedelta(days=12)).isoformat()
                },
                {
                    "version": 2,
                    "content": "有问题的记录：旧版本覆盖了新版本",
                    "updated_at": (now - timedelta(days=8)).isoformat()
                },
                {
                    "version": 3,
                    "content": "正确的完整记录：完成部署上线、值班日志完整、交接清晰",
                    "updated_at": (now - timedelta(days=9)).isoformat()
                }
            ]
        }
    )
    records.append(bad_record)

    expired_record = DutyRecord(
        record_id=generate_id(),
        date=(now - timedelta(days=30)).strftime("%Y-%m-%d"),
        engineer="工程师7",
        content="过期不完整记录",
        version=1,
        last_updated=now - timedelta(days=30),
        created_at=now - timedelta(days=30),
        is_expired=True,
        metadata={}
    )
    records.append(expired_record)

    for r in records:
        storage.save_duty_record(r)

    return len(records)
