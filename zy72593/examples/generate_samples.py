#!/usr/bin/env python3
import pandas as pd
from pathlib import Path
import random
from datetime import datetime, timedelta


def generate_negative_samples(output_path: str, num_samples: int = 20):
    random.seed(42)
    base_time = datetime.now() - timedelta(days=7)

    data = []
    for i in range(num_samples):
        batch_id = f"B{random.randint(1, 5):03d}"
        item_id = f"ITEM{random.randint(100, 120):04d}"

        if i in [3, 7]:
            batch_id = "B001"
            item_id = "ITEM0105"
        if i in [10, 15, 18]:
            batch_id = "B003"
            item_id = "ITEM0112"

        data.append(
            {
                "sample_id": f"S{i+1:04d}",
                "batch_id": batch_id,
                "item_id": item_id,
                "feature_version": f"v{random.randint(1, 3)}.0",
                "import_time": (base_time + timedelta(hours=i)).isoformat(),
                "source": random.choice(["用户反馈", "运营标注", "系统自动"]),
                "status": "待复核",
                "remarks": "",
            }
        )

    df = pd.DataFrame(data)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    print(f"✅ 生成负样本样例: {output_path} ({len(df)} 条)")
    print(f"   包含重复数据: B001-ITEM0105 (2次), B003-ITEM0112 (3次)")


def generate_recall_candidates(output_path: str, num_candidates: int = 25):
    random.seed(123)
    base_time = datetime.now() - timedelta(days=5)

    data = []
    for i in range(num_candidates):
        batch_id = f"B{random.randint(1, 5):03d}"
        item_id = f"ITEM{random.randint(100, 125):04d}"

        if i in [2, 9]:
            batch_id = "B001"
            item_id = "ITEM0105"
        if i in [12, 20]:
            batch_id = "B002"
            item_id = "ITEM0108"

        data.append(
            {
                "candidate_id": f"C{i+1:04d}",
                "batch_id": batch_id,
                "item_id": item_id,
                "recall_score": round(random.uniform(0.3, 0.95), 4),
                "rank": i + 1,
                "recall_strategy": random.choice(
                    ["协同过滤", "内容相似", "行为序列", "热门推荐"]
                ),
                "import_time": (base_time + timedelta(hours=i)).isoformat(),
                "status": "待复核",
                "linked_sample_id": "",
                "remarks": "",
            }
        )

    df = pd.DataFrame(data)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    print(f"✅ 生成召回候选样例: {output_path} ({len(df)} 条)")
    print(f"   包含重复数据: B001-ITEM0105 (2次, 与负样本交叉), B002-ITEM0108 (2次)")


if __name__ == "__main__":
    base_dir = Path(__file__).parent
    generate_negative_samples(str(base_dir / "negative_samples.csv"))
    print()
    generate_recall_candidates(str(base_dir / "recall_candidates.csv"))
    print()
    print("=" * 50)
    print("样例数据生成完成！")
    print("=" * 50)
    print()
    print("快速开始:")
    print("  python cli.py run-all examples/negative_samples.csv examples/recall_candidates.csv")
