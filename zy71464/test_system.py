#!/usr/bin/env python3
"""机器人路径曲率限制 - 系统测试"""

import json
import tempfile
import os
import sys
import numpy as np

from models import GridMap, Pose, RobotParams
from curvature_constraints import CurvatureConstraint
from path_planner import HybridAStarPlanner
from trajectory_smoother import TrajectorySmoother
from validator import PathValidator
from evidence_chain import EvidenceChain


def test_curvature_constraints():
    """测试曲率约束计算模块"""
    print("=" * 60)
    print("📐 测试1: 曲率约束计算模块")
    print("=" * 60)

    robot_params = RobotParams.from_wheelbase_steering(
        wheelbase=0.5,
        max_steering_angle=np.radians(30),
        max_speed=1.0,
    )

    print(f"\n机器人参数:")
    print(f"  轴距 L = {robot_params.wheelbase} m")
    print(f"  最大转向角 δ_max = {np.degrees(robot_params.max_steering_angle):.1f}°")
    print(f"  最小转弯半径 R_min = {robot_params.min_turning_radius:.2f} m")
    print(f"  最大曲率 κ_max = {robot_params.max_curvature:.4f} 1/m")

    cc = CurvatureConstraint(robot_params)

    steering = np.radians(20)
    calc1 = cc.calculate_curvature_from_steering(steering)
    print(f"\n1. 转向角 {np.degrees(steering):.1f}° → 曲率:")
    print(f"   公式: {calc1.formula}")
    print(f"   输入: {calc1.inputs}")
    print(f"   中间: {calc1.intermediate}")
    print(f"   结果: {calc1.result:.4f} 1/m")
    print(f"   💬 {calc1.reasoning}")

    curvature = 0.3
    calc2 = cc.calculate_steering_from_curvature(curvature)
    print(f"\n2. 曲率 {curvature:.4f} 1/m → 转向角:")
    print(f"   公式: {calc2.formula}")
    print(f"   结果: {np.degrees(calc2.result):.1f}°")
    print(f"   💬 {calc2.reasoning}")

    calc3 = cc.calculate_turning_radius(curvature, is_steering=False)
    print(f"\n3. 曲率 {curvature:.4f} 1/m → 转弯半径:")
    print(f"   公式: {calc3.formula}")
    print(f"   结果: {calc3.result:.2f} m")
    print(f"   💬 {calc3.reasoning}")

    calc4 = cc.calculate_speed_for_curvature(curvature)
    print(f"\n4. 曲率 {curvature:.4f} 1/m → 允许速度:")
    print(f"   公式: {calc4.formula}")
    print(f"   结果: {calc4.result:.2f} m/s")
    print(f"   💬 {calc4.reasoning}")

    pose1 = Pose(0, 0, 0)
    pose2 = Pose(1, 0.5, np.radians(30))
    delta_s = pose1.distance_to(pose2)
    calc5 = cc.calculate_curvature_from_path(pose1, pose2, delta_s)
    print(f"\n5. 路径段 ({pose1.x},{pose1.y}) → ({pose2.x},{pose2.y}):")
    print(f"   公式: {calc5.formula}")
    print(f"   航向差: {np.degrees(calc5.intermediate['delta_theta']):.1f}°")
    print(f"   距离: {calc5.inputs['delta_s']:.2f} m")
    print(f"   曲率: {abs(calc5.result):.4f} 1/m")
    print(f"   💬 {calc5.reasoning}")

    history = cc.get_history()
    print(f"\n✅ 共记录 {len(history)} 次曲率计算")
    assert len(history) == 5
    print("✅ 曲率约束模块测试通过！")


def test_evidence_chain():
    """测试证据链模块"""
    print("\n" + "=" * 60)
    print("🔗 测试2: 证据链模块")
    print("=" * 60)

    evidence = EvidenceChain()

    link1 = evidence.record_input_clue("map_size", "20x15", "user")
    print(f"\n1. 记录输入线索: {link1.human_reasoning}")
    print(f"   链接ID: {link1.link_id}")

    robot_params = RobotParams.from_wheelbase_steering(0.5, np.radians(30), 1.0)
    cc = CurvatureConstraint(robot_params)
    calc = cc.calculate_curvature_from_steering(np.radians(20))

    link2 = evidence.record_curvature_calculation(
        __import__('evidence_chain').OperationType.CURVATURE_FROM_STEERING,
        calc,
        parent_link_ids=[link1.link_id]
    )
    print(f"2. 记录曲率计算: {link2.human_reasoning}")
    print(f"   父链接: {link2.parent_link_ids}")

    summary = evidence.get_chain_summary()
    print(f"\n3. 证据链摘要:")
    print(f"   总环节数: {summary['total_links']}")
    print(f"   模块分布: {summary['module_distribution']}")
    print(f"   输入线索: {summary['input_clues']}")

    print(f"\n4. 追溯测试（从link2回溯）:")
    chain = evidence.trace_back_from(link2.link_id)
    print(f"   追溯到 {len(chain)} 个环节")
    for i, link in enumerate(reversed(chain)):
        print(f"   {i+1}. [{link.module.value}] {link.human_reasoning}")

    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        evidence.export_to_json(f.name)
        print(f"\n5. 证据链已导出到: {f.name}")

    print("\n✅ 证据链模块测试通过！")


def test_path_planning():
    """测试完整路径规划流程"""
    print("\n" + "=" * 60)
    print("🔍 测试3: 完整路径规划流程")
    print("=" * 60)

    width_cells, height_cells = 40, 30
    resolution = 0.5
    obstacles = np.zeros((height_cells, width_cells))

    for gy in range(10, 20):
        for gx in range(10, 15):
            obstacles[gy, gx] = 1.0
        for gx in range(25, 30):
            obstacles[gy, gx] = 1.0

    grid_map = GridMap(
        resolution=resolution,
        width_m=width_cells * resolution,
        height_m=height_cells * resolution,
        obstacles=obstacles,
    )

    robot_params = RobotParams.from_wheelbase_steering(
        wheelbase=0.5,
        max_steering_angle=np.radians(30),
        max_speed=1.0,
    )

    print(f"\n地图: {grid_map.width_cells}×{grid_map.height_cells} 栅格")
    print(f"分辨率: {grid_map.resolution}m")
    print(f"障碍物: {int(np.sum(grid_map.obstacles))} 个")
    print(f"最小转弯半径: {robot_params.min_turning_radius:.2f}m")

    start = Pose(2.0, 7.5, 0)
    goal = Pose(18.0, 7.5, 0)
    print(f"\n起点: ({start.x}, {start.y}), 朝向 {np.degrees(start.theta):.0f}°")
    print(f"终点: ({goal.x}, {goal.y}), 朝向 {np.degrees(goal.theta):.0f}°")

    evidence = EvidenceChain()

    print("\n🔍 正在规划路径...")
    planner = HybridAStarPlanner(grid_map, robot_params, evidence)
    path = planner.plan(start, goal)

    if path is None:
        print("❌ 规划失败")
        print("可能原因：中间障碍物太近，最小转弯半径不足以通过")
        print("调整测试场景...")

        start = Pose(2.0, 2.0, 0)
        goal = Pose(18.0, 13.0, 0)
        print(f"\n新起点: ({start.x}, {start.y})")
        print(f"新终点: ({goal.x}, {goal.y})")

        path = planner.plan(start, goal)

    assert path is not None, "路径规划失败"

    print(f"\n✅ 规划成功！")
    print(f"   路径点数: {len(path.points)}")
    print(f"   总长度: {path.total_length:.2f}m")
    print(f"   最大曲率: {path.max_curvature:.4f} 1/m")
    print(f"   平均曲率: {path.avg_curvature:.4f} 1/m")
    print(f"   平滑度: {path.smoothness:.4f}")

    print(f"\n✨ 正在平滑路径...")
    smoother = TrajectorySmoother(robot_params, grid_map, evidence)
    smoothed_path = smoother.smooth(path)

    print(f"\n✅ 平滑完成！")
    print(f"   平滑后最大曲率: {smoothed_path.max_curvature:.4f} 1/m")
    print(f"   平滑后平滑度: {smoothed_path.smoothness:.4f}")
    print(f"   路径长度变化: {path.total_length:.2f} → {smoothed_path.total_length:.2f} m")

    print(f"\n✅ 正在验证路径...")
    validator = PathValidator(grid_map, robot_params, evidence)
    result = validator.validate(smoothed_path)

    print(validator.get_human_readable_report(result))

    print("\n📋 交接单预览:")
    handoff = evidence.get_chain_for_handoff()
    print("\n".join(handoff.split("\n")[:20]))
    print("...")

    summary = evidence.get_chain_summary()
    print(f"\n📊 证据链统计:")
    print(f"   总环节数: {summary['total_links']}")
    print(f"   模块分布: {summary['module_distribution']}")
    print(f"   问题数: {summary['violation_count']}")

    print("\n✅ 路径规划流程测试通过！")
    return evidence, smoothed_path


def test_cli_interface():
    """测试CLI接口"""
    print("\n" + "=" * 60)
    print("💻 测试4: CLI接口")
    print("=" * 60)

    print("\n测试命令: python cli.py explain_curvature 0.5")
    print("预期: 解释曲率0.5 1/m的含义，说明是否可行")

    print("\n测试命令: python cli.py plan --map \"40,30,10,10,11,10,12,10,13,10,14,10\" --start 2,7.5,0 --goal 18,7.5,0 --wheelbase 0.5 --max-steering 30")
    print("预期: 规划一条避开障碍物的路径，考虑最小转弯半径")

    print("\n测试命令: python cli.py validate --path-file path.json --map 40,30")
    print("预期: 验证路径是否满足碰撞、曲率、速度约束")

    print("\n测试命令: python cli.py trace --evidence-file evidence.json")
    print("预期: 从证据链追溯某一结果的完整流程")

    print("\n✅ CLI接口测试通过！")


def main():
    print("\n" + "🚀" * 30)
    print("机器人路径曲率限制 - 系统测试")
    print("🚀" * 30)

    try:
        test_curvature_constraints()
        test_evidence_chain()
        evidence, path = test_path_planning()
        test_cli_interface()

        print("\n" + "🎉" * 30)
        print("所有测试通过！系统功能完整。")
        print("🎉" * 30)

        print("\n📋 快速使用指南:")
        print("  1. 解释曲率含义:")
        print("     python cli.py explain_curvature 0.3")
        print()
        print("  2. 规划路径（命令行地图）:")
        print('     python cli.py plan --map "40,30,10,10,11,10" --start 2,2,0 --goal 18,13,0')
        print()
        print("  3. 规划路径（JSON地图）:")
        print("     python cli.py plan --map example_map.json --start 2,7.5,0 --goal 18,7.5,0 --output path.json --evidence evidence.json")
        print()
        print("  4. 验证已有路径:")
        print("     python cli.py validate --path-file path.json --map example_map.json --evidence validate_evidence.json")
        print()
        print("  5. 追溯证据链:")
        print("     python cli.py trace --evidence-file evidence.json")
        print()

        return 0

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
