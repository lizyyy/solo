#!/usr/bin/env python3
"""造一组停在 pending_review 状态的演示数据，用来在页面/API/导出展示重复训练记录"""
import json
import os
import pandas as pd
import numpy as np

from semantic_cluster_naming.models import init_db
from semantic_cluster_naming.snapshot_import import SnapshotImporter
from semantic_cluster_naming.clustering import ClusteringEngine

DB_PATH = "semantic_cluster_verify.db"
SNAPSHOT_ID = "SNAP_PENDING_DEMO"

if __name__ == "__main__":
    Session, _ = init_db(f"sqlite:///{DB_PATH}")
    db = Session()

    np.random.seed(99)
    n = 40
    centers = np.array([
        [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1],
    ])
    labels = np.random.randint(0, 4, n)
    X = np.array([centers[l] + np.random.randn(4) * 0.2 for l in labels])

    data = []
    for i in range(n):
        data.append({"id": i + 1, "text": f"样本{i}", "vector": json.dumps(X[i].tolist())})
    df = pd.DataFrame(data)

    importer = SnapshotImporter(db, actor="林姐")
    importer.import_from_dataframe(df, snapshot_id=SNAPSHOT_ID, vector_column="vector")

    engine = ClusteringEngine(db, actor="林姐")
    run1, _ = engine.run_clustering(SNAPSHOT_ID, n_clusters=4)
    run2, stats = engine.run_clustering(SNAPSHOT_ID, n_clusters=4)  # 第二次 → pending_review

    print(f"快照: {SNAPSHOT_ID}")
    print(f"第一次训练 run_id={run1.run_id} status={run1.status} review={run1.review_status}")
    print(f"第二次训练 run_id={run2.run_id} status={run2.status} review={run2.review_status}")
    print(f"  is_duplicate={run2.is_duplicate_run} duplicate_of={run2.duplicate_of_run_id}")
    print()
    print(f"请打开页面查看：")
    print(f"  总览: http://127.0.0.1:8765/")
    print(f"  快照详情: http://127.0.0.1:8765/snapshot/{SNAPSHOT_ID}")
    print(f"  重复训练运行详情: http://127.0.0.1:8765/run/{run2.run_id}")
    print(f"  API: http://127.0.0.1:8765/api/runs/{run2.run_id}")
    print(f"  待复核列表API: http://127.0.0.1:8765/api/reviews/pending")
    db.close()
