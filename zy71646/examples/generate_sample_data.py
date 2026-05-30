"""
生成示例测试数据
包含正常数据、重复样本、活动加成、概率不归一等常见问题
"""
import os
import random
import pandas as pd
from datetime import datetime, timedelta
import numpy as np

random.seed(42)
np.random.seed(42)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "sample_data")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def generate_drop_config():
    """生成掉落配置 - 包含概率不归一的问题"""
    data = [
        {"pool_id": "pool_gacha", "pool_name": "抽卡池", "item_id": "item_sr", "item_name": "SR级装备", "probability": 0.05, "weight": 50, "min_count": 1, "max_count": 1},
        {"pool_id": "pool_gacha", "pool_name": "抽卡池", "item_id": "item_ssr", "item_name": "SSR级装备", "probability": 0.01, "weight": 10, "min_count": 1, "max_count": 1},
        {"pool_id": "pool_gacha", "pool_name": "抽卡池", "item_id": "item_r", "item_name": "R级装备", "probability": 0.40, "weight": 400, "min_count": 1, "max_count": 1},
        {"pool_id": "pool_gacha", "pool_name": "抽卡池", "item_id": "item_n", "item_name": "N级装备", "probability": 0.50, "weight": 500, "min_count": 1, "max_count": 1},
        {"pool_id": "pool_gacha", "pool_name": "抽卡池", "item_id": "item_ur", "item_name": "UR级装备", "probability": 0.02, "weight": 20, "min_count": 1, "max_count": 1},

        {"pool_id": "pool_dungeon", "pool_name": "副本掉落池", "item_id": "item_gold", "item_name": "金币", "probability": 0.30, "weight": 300, "min_count": 100, "max_count": 500},
        {"pool_id": "pool_dungeon", "pool_name": "副本掉落池", "item_id": "item_exp", "item_name": "经验药水", "probability": 0.25, "weight": 250, "min_count": 1, "max_count": 3},
        {"pool_id": "pool_dungeon", "pool_name": "副本掉落池", "item_id": "item_mat_common", "item_name": "普通材料", "probability": 0.25, "weight": 250, "min_count": 1, "max_count": 5},
        {"pool_id": "pool_dungeon", "pool_name": "副本掉落池", "item_id": "item_mat_rare", "item_name": "稀有材料", "probability": 0.10, "weight": 100, "min_count": 1, "max_count": 1},
        {"pool_id": "pool_dungeon", "pool_name": "副本掉落池", "item_id": "item_mat_epic", "item_name": "史诗材料", "probability": 0.08, "weight": 80, "min_count": 1, "max_count": 1},
        {"pool_id": "pool_dungeon", "pool_name": "副本掉落池", "item_id": "item_weapon", "item_name": "专属武器", "probability": 0.015, "weight": 15, "min_count": 1, "max_count": 1},
    ]

    df = pd.DataFrame(data)
    path = os.path.join(OUTPUT_DIR, "drop_config.csv")
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"生成掉落配置: {path}")
    return path


def generate_item_pool():
    """生成道具池配置"""
    data = [
        {"pool_id": "pool_gacha", "pool_name": "抽卡池", "description": "玩家付费抽卡的奖池", "pool_type": "gacha", "total_weight": 980, "item_count": 5},
        {"pool_id": "pool_dungeon", "pool_name": "副本掉落池", "description": "通关副本后的掉落奖励池", "pool_type": "dungeon", "total_weight": 995, "item_count": 6},
    ]
    df = pd.DataFrame(data)
    path = os.path.join(OUTPUT_DIR, "item_pool.csv")
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"生成道具池: {path}")
    return path


def generate_activity_period():
    """生成活动时段 - 包含活动加成"""
    base_time = datetime(2026, 5, 1, 0, 0, 0)
    data = [
        {
            "activity_id": "act_001",
            "activity_name": "五一庆典活动",
            "start_time": (base_time + timedelta(days=0)).strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": (base_time + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
            "pool_id": "pool_gacha",
            "item_id": "",
            "drop_rate_multiplier": 2.0,
            "guaranteed_drop_count": 0,
        },
        {
            "activity_id": "act_002",
            "activity_name": "SSR概率UP",
            "start_time": (base_time + timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": (base_time + timedelta(days=4)).strftime("%Y-%m-%d %H:%M:%S"),
            "pool_id": "pool_gacha",
            "item_id": "item_ssr",
            "drop_rate_multiplier": 3.0,
            "guaranteed_drop_count": 0,
        },
        {
            "activity_id": "act_003",
            "activity_name": "周末双倍掉落",
            "start_time": (base_time + timedelta(days=14)).strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": (base_time + timedelta(days=16)).strftime("%Y-%m-%d %H:%M:%S"),
            "pool_id": "pool_dungeon",
            "item_id": "",
            "drop_rate_multiplier": 2.0,
            "guaranteed_drop_count": 0,
        },
    ]
    df = pd.DataFrame(data)
    path = os.path.join(OUTPUT_DIR, "activity_period.csv")
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"生成活动时段: {path}")
    return path


def generate_player_logs():
    """
    生成玩家掉落日志
    包含：
    - 正常随机掉落
    - 活动期间的加成掉落
    - 一些重复记录（用于测试去重）
    - SSR掉率偏低（用于测试异常检测）
    """
    base_time = datetime(2026, 5, 1, 0, 0, 0)

    pool_items = {
        "pool_gacha": [
            ("item_n", 0.50),
            ("item_r", 0.40),
            ("item_sr", 0.07),
            ("item_ssr", 0.005),
            ("item_ur", 0.025),
        ],
        "pool_dungeon": [
            ("item_gold", 0.30),
            ("item_exp", 0.25),
            ("item_mat_common", 0.25),
            ("item_mat_rare", 0.12),
            ("item_mat_epic", 0.065),
            ("item_weapon", 0.015),
        ],
    }

    item_names = {
        "item_sr": "SR级装备",
        "item_ssr": "SSR级装备",
        "item_r": "R级装备",
        "item_n": "N级装备",
        "item_ur": "UR级装备",
        "item_gold": "金币",
        "item_exp": "经验药水",
        "item_mat_common": "普通材料",
        "item_mat_rare": "稀有材料",
        "item_mat_epic": "史诗材料",
        "item_weapon": "专属武器",
    }

    records = []
    log_id = 1

    for player_idx in range(100):
        player_id = f"player_{player_idx:04d}"
        server_id = f"server_{player_idx % 5 + 1}"
        channel = ["ios", "android", "pc"][player_idx % 3]

        for day in range(20):
            day_start = base_time + timedelta(days=day)

            activity_multiplier = 1.0
            if 0 <= day < 7:
                activity_multiplier = 2.0
            if 2 <= day < 4:
                ssr_multiplier = 3.0
            else:
                ssr_multiplier = 1.0

            if 14 <= day < 16:
                dungeon_multiplier = 2.0
            else:
                dungeon_multiplier = 1.0

            for _ in range(random.randint(5, 20)):
                drop_time = day_start + timedelta(
                    hours=random.randint(8, 23),
                    minutes=random.randint(0, 59),
                    seconds=random.randint(0, 59)
                )

                pool_id = random.choice(["pool_gacha", "pool_dungeon"])
                items = pool_items[pool_id]

                probs = []
                for item_id, base_prob in items:
                    prob = base_prob
                    if pool_id == "pool_gacha":
                        prob *= activity_multiplier
                        if item_id == "item_ssr":
                            prob *= ssr_multiplier / activity_multiplier
                    elif pool_id == "pool_dungeon":
                        prob *= dungeon_multiplier
                    probs.append(prob)

                total = sum(probs)
                probs = [p / total for p in probs]

                chosen_idx = np.random.choice(len(items), p=probs)
                item_id, _ = items[chosen_idx]

                drop_count = random.randint(1, 3) if item_id in ["item_gold", "item_exp", "item_mat_common"] else 1

                records.append({
                    "player_id": player_id,
                    "pool_id": pool_id,
                    "item_id": item_id,
                    "item_name": item_names[item_id],
                    "drop_count": drop_count,
                    "drop_time": drop_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "server_id": server_id,
                    "channel": channel,
                })
                log_id += 1

    for _ in range(50):
        dup_record = dict(records[random.randint(0, len(records) - 1)])
        records.append(dup_record)
        log_id += 1

    df = pd.DataFrame(records)
    path = os.path.join(OUTPUT_DIR, "player_logs.csv")
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"生成玩家日志: {path} (共 {len(records)} 条记录)")
    return path


def generate_complaint_records():
    """生成投诉记录"""
    data = [
        {
            "complaint_id": "cmp_001",
            "player_id": "player_0012",
            "pool_id": "pool_gacha",
            "item_id": "item_ssr",
            "complaint_time": "2026-05-05 14:30:00",
            "complaint_content": "抽了500次都没出SSR，掉率肯定有问题！",
            "expected_probability": 0.01,
            "actual_drop_count": 0,
            "total_attempts": 500,
            "is_verified": True,
            "verification_result": "已核实，玩家确实500抽未获得SSR",
        },
        {
            "complaint_id": "cmp_002",
            "player_id": "player_0045",
            "pool_id": "pool_gacha",
            "item_id": "item_ur",
            "complaint_time": "2026-05-08 09:15:00",
            "complaint_content": "活动结束前UR掉率明显降低，暗改实锤！",
            "expected_probability": 0.02,
            "actual_drop_count": 0,
            "total_attempts": 200,
            "is_verified": True,
            "verification_result": "已核实，活动结束后概率恢复正常",
        },
        {
            "complaint_id": "cmp_003",
            "player_id": "player_0078",
            "pool_id": "pool_dungeon",
            "item_id": "item_weapon",
            "complaint_time": "2026-05-15 18:45:00",
            "complaint_content": "刷了一个月副本都没出专属武器，这合理吗？",
            "expected_probability": 0.015,
            "actual_drop_count": 0,
            "total_attempts": 300,
            "is_verified": False,
            "verification_result": "",
        },
    ]
    df = pd.DataFrame(data)
    path = os.path.join(OUTPUT_DIR, "complaint_records.csv")
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"生成投诉记录: {path}")
    return path


def generate_old_config():
    """生成旧版本配置，用于测试多版本导入"""
    data = [
        {"pool_id": "pool_gacha", "pool_name": "抽卡池", "item_id": "item_sr", "item_name": "SR级装备", "probability": 0.06, "weight": 60, "min_count": 1, "max_count": 1},
        {"pool_id": "pool_gacha", "pool_name": "抽卡池", "item_id": "item_ssr", "item_name": "SSR级装备", "probability": 0.015, "weight": 15, "min_count": 1, "max_count": 1},
        {"pool_id": "pool_gacha", "pool_name": "抽卡池", "item_id": "item_r", "item_name": "R级装备", "probability": 0.42, "weight": 420, "min_count": 1, "max_count": 1},
        {"pool_id": "pool_gacha", "pool_name": "抽卡池", "item_id": "item_n", "item_name": "N级装备", "probability": 0.505, "weight": 505, "min_count": 1, "max_count": 1},
    ]
    df = pd.DataFrame(data)
    path = os.path.join(OUTPUT_DIR, "drop_config_old_v0.9.csv")
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"生成旧版配置: {path}")
    return path


def generate_bad_data():
    """生成包含错误的数据，用于测试错误处理"""
    data = [
        {"pool_id": "pool_gacha", "item_id": "", "item_name": "缺少item_id", "probability": 0.05},
        {"pool_id": "", "item_id": "item_test", "item_name": "缺少pool_id", "probability": 0.05},
        {"pool_id": "pool_gacha", "item_id": "item_test2", "item_name": "概率格式错误", "probability": "不是数字"},
    ]
    df = pd.DataFrame(data)
    path = os.path.join(OUTPUT_DIR, "bad_data.csv")
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"生成错误数据: {path}")
    return path


def generate_all():
    """生成所有示例数据"""
    print("=" * 60)
    print("生成游戏掉落概率校准示例数据")
    print("=" * 60)

    paths = {
        "drop_config": generate_drop_config(),
        "item_pool": generate_item_pool(),
        "activity_period": generate_activity_period(),
        "player_logs": generate_player_logs(),
        "complaint_records": generate_complaint_records(),
        "old_config": generate_old_config(),
        "bad_data": generate_bad_data(),
    }

    print("\n" + "=" * 60)
    print("示例数据生成完成！")
    print("=" * 60)
    for name, path in paths.items():
        print(f"  {name}: {path}")
    print("=" * 60)

    return paths


if __name__ == "__main__":
    generate_all()
