"""
样例数据生成模块
====================

生成包含典型问题的游泳数据样例，用于演示系统功能：
1. 正常游泳数据（2趟50米，共100米自由泳）
2. 故意注入速度尖峰
3. 故意注入划水次数漏记
4. 故意设置错误池长（用于验证池长检测功能）
5. 故意制造一段低效率划水

样例运动员：
- 身高：1.80m
- 体重：72kg
- 泳姿：自由泳
- 平均速度：约1.7 m/s
- 平均划水频率：约36次/分钟
- 平均划水步幅：约2.8m/次
"""

import math
import json
from typing import Dict, List, Tuple
import random


def generate_sample_data(
    inject_anomalies: bool = True,
    pool_length: float = 50.0,
    sample_rate: float = 10.0,
) -> Dict:
    """
    生成样例游泳数据

    参数：
    - inject_anomalies: 是否注入异常数据用于演示
    - pool_length: 池长（米）
    - sample_rate: 采样率（Hz）
    """
    random.seed(42)  # 固定随机种子，确保结果可复现

    total_distance = pool_length * 2  # 2趟
    avg_velocity = 1.7
    total_time = total_distance / avg_velocity
    n_points = int(total_time * sample_rate)

    dt = 1.0 / sample_rate
    time = [i * dt for i in range(n_points)]
    position = []
    stroke_count = []

    current_stroke = 0
    stroke_interval = 60.0 / 36  # 36次/分钟，每次间隔1.666秒
    next_stroke_time = stroke_interval

    # 生成基础位置数据（带速度波动）
    base_pos = 0.0
    velocity_variation = []

    for i in range(n_points):
        t = time[i]

        # 第2趟后半段故意降低效率（高频小幅划水）
        if pool_length + 15 < base_pos < pool_length + 40:
            vel = avg_velocity * 0.75 + random.uniform(-0.1, 0.1)
        else:
            vel = avg_velocity + random.uniform(-0.15, 0.15)

        # 转身时速度下降
        dist_from_turn = abs(base_pos - pool_length)
        if dist_from_turn < 3:
            vel *= 0.4 + (dist_from_turn / 3) * 0.6

        velocity_variation.append(vel)

        if i == 0:
            position.append(0.0)
        else:
            position.append(position[-1] + vel * dt)

        base_pos = position[-1]

        # 划水计数
        if t >= next_stroke_time:
            # 第2趟25-40米处故意漏记划水 - 连续漏记3次
            if inject_anomalies and pool_length + 28 < base_pos < pool_length + 35:
                # 在这个区域内，70%概率漏记，制造明显的长时间无新增划水
                if random.random() < 0.7:
                    pass  # 漏记
                else:
                    current_stroke += 1
            else:
                current_stroke += 1
            next_stroke_time += stroke_interval
        stroke_count.append(current_stroke)

    # 注入速度尖峰（第40个点和第150个点）
    # 方式：在该点位置突然增加，后续点也整体平移，避免位置回退
    if inject_anomalies:
        spike_offset_1 = 0.0
        spike_offset_2 = 0.0
        for i in range(len(position)):
            if i == 40 and 40 < len(position):
                spike_offset_1 = 0.5  # 速度尖峰：瞬时增加0.5m，v = 0.5/0.1 = 5m/s
            if i == 150 and 150 < len(position):
                spike_offset_2 = 0.3  # 速度尖峰：瞬时增加0.3m，v = 0.3/0.1 = 3m/s
            position[i] = position[i] + spike_offset_1 + spike_offset_2

        # 强制制造划水漏记：在第340-400个采样点（约t=34-40s）停止增加划水计数
        # 这会造成约6-8秒无新增划水，明显超过6秒阈值
        target_start = 340
        target_end = 400
        if target_end < len(stroke_count):
            freeze_stroke = stroke_count[target_start]
            for i in range(target_start, target_end):
                stroke_count[i] = freeze_stroke

    data = {
        "athlete_name": "张三（测试样例）",
        "stroke_style": "自由泳",
        "pool_length": pool_length if not inject_anomalies else 25.0,  # 故意设置错误池长（实际50m，写25m）
        "sample_rate": sample_rate,
        "athlete_height": 1.80,
        "athlete_weight": 72.0,
        "time": [round(t, 4) for t in time],
        "position": [round(p, 4) for p in position],
        "stroke_count": stroke_count,
        "_injected_anomalies": [
            {
                "type": "pool_length_error",
                "description": "池长输入错误：实际50m，输入25m",
                "actual_value": 50.0,
                "input_value": 25.0,
            },
            {
                "type": "velocity_spike",
                "description": "速度尖峰：第40个采样点位置异常前跳5m",
                "point_index": 40,
                "time": round(time[40], 4),
            },
            {
                "type": "velocity_spike",
                "description": "速度尖峰：第150个采样点位置异常前跳3m",
                "point_index": 150,
                "time": round(time[150], 4),
            },
            {
                "type": "missing_stroke",
                "description": "划水漏记：第2趟25-40m处约40%的划水未记录",
                "position_range": [pool_length + 25, pool_length + 40],
            },
            {
                "type": "low_efficiency_segment",
                "description": "低效率段落：第2趟15-40m处采用高频小幅划水，效率下降约25%",
                "position_range": [pool_length + 15, pool_length + 40],
                "cause": "划水频率偏高，步幅偏小，典型低效模式",
            },
        ],
        "_notes": [
            "此为样例数据，包含故意注入的异常用于演示系统功能",
            "运行时请使用 --known-pool-length 50.0 来触发池长错误检测",
            "使用 --auto-correct 可以看到自动修正效果",
        ]
    }

    return data


def save_sample_data(filepath: str = "sample_data.json"):
    """保存样例数据到文件"""
    data = generate_sample_data()
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✓ 样例数据已保存到: {filepath}")
    return filepath


if __name__ == "__main__":
    save_sample_data()
