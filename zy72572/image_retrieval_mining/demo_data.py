from typing import Tuple

from .core import HardCaseMiner
from .models import MiningResult


def generate_demo_data() -> Tuple[HardCaseMiner, MiningResult]:
    miner = HardCaseMiner()

    miner.import_training_log(
        log_id="log_v2.1_20260601",
        experiment_name="图像检索模型v2.1训练",
        points=[
            (0, 2.5, 0.52),
            (1000, 1.8, 0.65),
            (2000, 1.2, 0.72),
            (3000, 0.8, 0.78),
            (4000, 0.5, 0.82),
            (5000, 0.35, 0.85),
            (6000, 0.28, 0.87),
            (7000, 0.22, 0.88),
            (8000, 0.18, 0.885),
            (9000, 0.15, 0.89),
            (10000, 0.12, 0.892),
        ],
        model_version="v2.1.0",
    )

    record_smooth = miner.add_record(
        image_id="IMG_0001_smooth",
        query="红色连衣裙",
        offline_score=0.85,
        online_score=0.83,
        training_log_id="log_v2.1_20260601",
        remark="顺利记录: 离线线上均为B桶",
    )

    record_bucket_diff = miner.add_record(
        image_id="IMG_0002_diff",
        query="白色运动鞋",
        offline_score=0.82,
        online_score=0.78,
        training_log_id="log_v2.1_20260601",
        remark="分桶差异记录: 离线B桶, 线上C桶, 差一个桶",
    )

    record_old_caliber = miner.add_record(
        image_id="IMG_0003_old",
        query="蓝色牛仔裤",
        offline_score=0.75,
        online_score=0.73,
        training_log_id="log_v2.1_20260601",
        remark="待补录: 后续会通过阈值调参笔记更新为旧口径",
    )

    record_pending = miner.add_record(
        image_id="IMG_0004_pending",
        query="黑色背包 双肩",
        offline_score=0.81,
        online_score=0.77,
        training_log_id="log_v2.1_20260601",
        remark="待评测运营复核: 离线B桶, 线上C桶, 差一个桶",
    )

    miner.add_experiment_comparison(
        baseline_record_id=record_smooth.record_id,
        compared_record_id=record_bucket_diff.record_id,
        note="基线vs分桶差记录",
    )
    miner.add_experiment_comparison(
        baseline_record_id=record_smooth.record_id,
        compared_record_id=record_old_caliber.record_id,
        note="基线vs旧口径记录(应用前)",
    )

    note = miner.add_threshold_note(
        record_id=record_old_caliber.record_id,
        old_offline_score=0.75,
        old_online_score=0.73,
        new_offline_score=0.68,
        new_online_score=0.66,
        caliber_note="2026Q1旧口径: 特征相似度阈值从0.7下调到0.65, 对应历史记录分数修正",
        operator="阿越",
    )

    miner.apply_threshold_note(note.note_id)

    miner.manual_fix(
        record_id=record_bucket_diff.record_id,
        new_offline_score=0.81,
        new_online_score=0.80,
        remark="人工修正: 特征库版本不匹配导致线上分数偏低, 重算后均为B桶",
        operator="阿越",
    )

    miner.rerun_record(
        record_id=record_old_caliber.record_id,
        new_offline_score=0.70,
        new_online_score=0.69,
    )

    result = miner.run_mining()
    return miner, result
