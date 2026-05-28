import argparse
import os
import sys
import datetime
import json

import numpy as np

from .io_utils import collect_inputs, save_json
from .map import Map
from .filter import ParticleFilter
from .conflict import check_conflicts
from .alerts import check_excessive_noise, check_obstacle_crossing_estimated
from .trajectory import compare_trajectories
from .report import (
    generate_report, save_report, save_params,
    save_trajectory, save_estimated_trajectory, save_ground_truth
)


def build_argparser():
    parser = argparse.ArgumentParser(
        prog="particle-filter-loc",
        description="粒子滤波定位CLI —— 支持可调噪声与障碍物的蒙特卡洛定位演示工具"
    )
    parser.add_argument(
        "--input-dir", required=True,
        help="输入目录，包含地图、里程计、观测、参数等JSON文件"
    )
    parser.add_argument(
        "--output-dir", required=True,
        help="输出目录，存放定位报告、轨迹对比、参数快照等"
    )
    parser.add_argument("--num-particles", type=int, default=None,
                        help="覆盖参数文件中的粒子数")
    parser.add_argument("--motion-noise-dx", type=float, default=None)
    parser.add_argument("--motion-noise-dy", type=float, default=None)
    parser.add_argument("--motion-noise-dtheta", type=float, default=None)
    parser.add_argument("--sensor-noise-range", type=float, default=None)
    parser.add_argument("--sensor-noise-bearing", type=float, default=None)
    parser.add_argument("--resample-threshold", type=float, default=None,
                        help="重采样ESS阈值比例(0~1)，默认0.5")
    parser.add_argument("--seed", type=int, default=None,
                        help="随机种子，用于可复现实验")
    return parser


def merge_params(inputs, args):
    if not inputs["params"]:
        params = {
            "id": "default_params",
            "version": 1,
            "num_particles": 200,
            "motion_noise": {"dx": 0.2, "dy": 0.2, "dtheta": 0.05},
            "sensor_noise": {"range": 0.5, "bearing": 0.05},
            "resample_threshold": 0.5,
            "initial_position": {"x": 5, "y": 5, "theta": 0}
        }
    else:
        params = inputs["params"][0].copy()

    if args.num_particles is not None:
        params["num_particles"] = args.num_particles
    if args.motion_noise_dx is not None:
        params.setdefault("motion_noise", {})["dx"] = args.motion_noise_dx
    if args.motion_noise_dy is not None:
        params.setdefault("motion_noise", {})["dy"] = args.motion_noise_dy
    if args.motion_noise_dtheta is not None:
        params.setdefault("motion_noise", {})["dtheta"] = args.motion_noise_dtheta
    if args.sensor_noise_range is not None:
        params.setdefault("sensor_noise", {})["range"] = args.sensor_noise_range
    if args.sensor_noise_bearing is not None:
        params.setdefault("sensor_noise", {})["bearing"] = args.sensor_noise_bearing
    if args.resample_threshold is not None:
        params["resample_threshold"] = args.resample_threshold

    return params


def simulate_ground_truth(world_map, odometry_data, initial_pos):
    gt = [list(initial_pos)]
    x, y, theta = initial_pos
    for entry in odometry_data:
        dx = entry.get("dx", 0)
        dy = entry.get("dy", 0)
        dtheta = entry.get("dtheta", 0)
        x += dx
        y += dy
        theta += dtheta
        import math
        theta = (theta + math.pi) % (2 * math.pi) - math.pi
        x = max(0, min(world_map.width, x))
        y = max(0, min(world_map.height, y))
        gt.append([x, y, theta])
    return gt


def run(args):
    if args.seed is not None:
        np.random.seed(args.seed)

    os.makedirs(args.output_dir, exist_ok=True)

    inputs = collect_inputs(args.input_dir)

    conflicts = check_conflicts(inputs)
    if conflicts:
        print("=" * 60)
        print("⚠ 输入冲突检测（不会覆盖旧数据）:")
        for c in conflicts:
            print(f"  [{c['type']}] {c['reason']}")
        print("=" * 60)

    if not inputs["maps"]:
        print("错误：未找到地图文件", file=sys.stderr)
        sys.exit(1)

    world_map = Map.from_dict(inputs["maps"][0])

    params = merge_params(inputs, args)
    motion_noise = params.get("motion_noise", {"dx": 0.2, "dy": 0.2, "dtheta": 0.05})
    sensor_noise = params.get("sensor_noise", {"range": 0.5, "bearing": 0.05})
    num_particles = params.get("num_particles", 200)
    resample_threshold = params.get("resample_threshold", 0.5)
    init_pos_dict = params.get("initial_position", {"x": 5, "y": 5, "theta": 0})
    initial_pos = [init_pos_dict["x"], init_pos_dict["y"], init_pos_dict["theta"]]

    noise_alerts = check_excessive_noise(motion_noise, sensor_noise)
    if noise_alerts:
        print("=" * 60)
        print("⚠ 噪声过大警告:")
        for a in noise_alerts:
            print(f"  [{a['parameter']}] {a['reason']}")
        print("=" * 60)

    odometry_data = inputs["odometry"][0].get("data", []) if inputs["odometry"] else []
    observations_data = inputs["observations"][0].get("data", []) if inputs["observations"] else []
    obs_timestamps = inputs["observations"][0].get("timestamps", []) if inputs["observations"] else []
    odom_timestamps = inputs["odometry"][0].get("timestamps", []) if inputs["odometry"] else []

    pf = ParticleFilter(
        num_particles=num_particles,
        world_map=world_map,
        motion_noise=motion_noise,
        sensor_noise=sensor_noise,
        resample_threshold_ratio=resample_threshold,
        initial_pos=initial_pos
    )

    num_steps = max(len(odometry_data), len(observations_data))
    estimated_positions = [list(pf.estimate())]

    for step in range(num_steps):
        if step < len(odometry_data):
            odom = odometry_data[step]
            pf.predict(odom.get("dx", 0), odom.get("dy", 0), odom.get("dtheta", 0))

        if step < len(observations_data):
            pf.update(observations_data[step])

        estimated_positions.append(list(pf.estimate()))

    filter_alerts = pf.get_alerts()
    resample_events = pf.get_resample_events()

    ground_truth = simulate_ground_truth(world_map, odometry_data, initial_pos)

    obstacle_alerts = check_obstacle_crossing_estimated(world_map, estimated_positions)

    if obstacle_alerts:
        print("=" * 60)
        print("⚠ 估计轨迹穿越障碍:")
        for a in obstacle_alerts:
            print(f"  [step {a['step']}] {a['reason']}")
        print("=" * 60)

    if filter_alerts:
        print("=" * 60)
        print("⚠ 粒子滤波运行时警告:")
        for a in filter_alerts:
            print(f"  [{a['type']} step {a['step']}] {a['reason']}")
        print("=" * 60)

    trajectory_result = compare_trajectories(estimated_positions, ground_truth)

    run_id = f"run_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    report = generate_report(
        run_id=run_id,
        inputs=inputs,
        conflicts=conflicts,
        noise_alerts=noise_alerts,
        filter_alerts=filter_alerts,
        obstacle_alerts=obstacle_alerts,
        trajectory_result=trajectory_result,
        resample_events=resample_events,
        params=params
    )

    report_path = save_report(args.output_dir, report)
    params_path = save_params(args.output_dir, params)
    traj_path = save_trajectory(args.output_dir, trajectory_result)
    est_path = save_estimated_trajectory(args.output_dir, estimated_positions)
    gt_path = save_ground_truth(args.output_dir, ground_truth)

    print()
    print("✅ 运行完成！输出文件:")
    print(f"  定位报告:     {report_path}")
    print(f"  参数快照:     {params_path}")
    print(f"  轨迹对比:     {traj_path}")
    print(f"  估计轨迹:     {est_path}")
    print(f"  真实轨迹:     {gt_path}")
    print()
    print(f"  定位均方误差: {trajectory_result['summary']['mean_pos_error']:.4f}")
    print(f"  最大位置误差: {trajectory_result['summary']['max_pos_error']:.4f}")
    print(f"  重采样次数:   {len(resample_events)}")
    print(f"  冲突数:       {len(conflicts)}")
    print(f"  警告数:       {len(noise_alerts) + len(filter_alerts) + len(obstacle_alerts)}")

    return report


def main():
    parser = build_argparser()
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
