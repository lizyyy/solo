import click
import numpy as np
import json
import os
from typing import Tuple, Optional

from models import GridMap, Pose, RobotParams, Path
from curvature_constraints import CurvatureConstraint
from path_planner import HybridAStarPlanner
from trajectory_smoother import TrajectorySmoother
from validator import PathValidator
from evidence_chain import EvidenceChain


def parse_map_input(map_str: str, resolution: float) -> GridMap:
    if os.path.exists(map_str):
        with open(map_str, 'r') as f:
            data = json.load(f)
        obstacles = np.array(data['obstacles'], dtype=np.float64)
        width_m = data.get('width_m', obstacles.shape[1] * resolution)
        height_m = data.get('height_m', obstacles.shape[0] * resolution)
        origin = tuple(data.get('origin', [0.0, 0.0]))
        return GridMap(
            resolution=resolution,
            width_m=width_m,
            height_m=height_m,
            obstacles=obstacles,
            origin=origin,
        )
    else:
        parts = list(map(int, map_str.split(',')))
        if len(parts) < 2:
            raise ValueError("地图格式应为 '宽度栅格数,高度栅格数[,障碍列表...]'")
        width_cells, height_cells = parts[0], parts[1]
        obstacles = np.zeros((height_cells, width_cells), dtype=np.float64)

        if len(parts) > 2:
            obstacle_cells = parts[2:]
            for i in range(0, len(obstacle_cells), 2):
                if i + 1 < len(obstacle_cells):
                    gx, gy = obstacle_cells[i], obstacle_cells[i + 1]
                    if 0 <= gx < width_cells and 0 <= gy < height_cells:
                        obstacles[gy, gx] = 1.0

        return GridMap(
            resolution=resolution,
            width_m=width_cells * resolution,
            height_m=height_cells * resolution,
            obstacles=obstacles,
        )


def parse_pose(pose_str: str) -> Pose:
    parts = list(map(float, pose_str.split(',')))
    if len(parts) == 2:
        return Pose(parts[0], parts[1], 0.0)
    elif len(parts) == 3:
        return Pose(parts[0], parts[1], np.radians(parts[2]))
    else:
        raise ValueError("位姿格式应为 'x,y' 或 'x,y,角度(度)'")


def generate_human_reasoning(
    grid_map: GridMap,
    start: Pose,
    goal: Pose,
    robot_params: RobotParams,
    path: Optional[Path],
    evidence: EvidenceChain,
) -> str:
    lines = []
    lines.append("=" * 70)
    lines.append("🤖 机器人路径曲率限制 - 规划结果说明")
    lines.append("=" * 70)

    lines.append(f"\n📥 输入线索汇总：")
    lines.append(f"   • 地图：{grid_map.width_cells}×{grid_map.height_cells} 栅格，"
                f"分辨率 {grid_map.resolution}m，"
                f"障碍物 {int(np.sum(grid_map.obstacles))} 个")
    lines.append(f"   • 起点：({start.x:.1f}, {start.y:.1f})，"
                f"朝向 {np.degrees(start.theta):.0f}°")
    lines.append(f"   • 终点：({goal.x:.1f}, {goal.y:.1f})，"
                f"朝向 {np.degrees(goal.theta):.0f}°")
    lines.append(f"   • 机器人：轴距 {robot_params.wheelbase:.2f}m，"
                f"最大转向 {np.degrees(robot_params.max_steering_angle):.0f}°")
    lines.append(f"   • 最小转弯半径：{robot_params.min_turning_radius:.2f}m，"
                f"对应最大曲率 {robot_params.max_curvature:.4f} 1/m")

    lines.append(f"\n❓ 为什么不能直接走直线？")
    straight_dist = start.distance_to(goal)
    lines.append(f"   直线距离 {straight_dist:.2f}m，但机器人不是点，")
    lines.append(f"   最小转弯半径 {robot_params.min_turning_radius:.2f}m，")
    lines.append(f"   意味着转向需要空间，就像汽车不能原地掉头一样。")

    if path is None:
        lines.append(f"\n❌ 规划失败：")
        summary = evidence.get_chain_summary()
        if summary['violation_links']:
            lines.append(f"   主要问题：{summary['violation_links'][0]['reasoning']}")
        else:
            lines.append(f"   可能原因：")
            lines.append(f"   1. 障碍物阻挡了所有可行路径")
            lines.append(f"   2. 最小转弯半径太大，无法通过狭窄区域")
            lines.append(f"   3. 起点或终点朝向需要的转向超过了限制")
        lines.append(f"\n💡 建议：")
        lines.append(f"   • 检查障碍物是否正确设置")
        lines.append(f"   • 尝试减小最小转弯半径（如果机器人实际可以）")
        lines.append(f"   • 调整起点/终点朝向，使其更容易到达")
    else:
        lines.append(f"\n✅ 规划成功！")
        lines.append(f"   路径总长：{path.total_length:.2f}m")
        lines.append(f"   路径点数：{len(path.points)}")
        lines.append(f"   最大曲率：{path.max_curvature:.4f} 1/m "
                    f"（限制 {robot_params.max_curvature:.4f}）")
        lines.append(f"   平均曲率：{path.avg_curvature:.4f} 1/m")
        lines.append(f"   平滑度：{path.smoothness:.4f}（越小越平滑）")

        max_k_idx = max(range(len(path.points)),
                       key=lambda i: abs(path.points[i].curvature))
        max_k_point = path.points[max_k_idx]
        max_curv = abs(max_k_point.curvature)
        turning_radius = 1.0 / max_curv if max_curv > 1e-8 else float('inf')
        turning_radius_str = "∞（直线）" if turning_radius == float('inf') else f"{turning_radius:.2f}m"

        lines.append(f"\n📍 最急的弯在点 {max_k_idx}：")
        lines.append(f"   位置：({max_k_point.pose.x:.1f}, {max_k_point.pose.y:.1f})")
        lines.append(f"   曲率：{max_curv:.4f} 1/m，转弯半径 {turning_radius_str}")
        lines.append(f"   建议速度：{max_k_point.speed:.2f} m/s "
                    f"（因为转弯越急，速度要越慢）")

        if path.max_curvature > robot_params.max_curvature * 0.9:
            lines.append(f"\n⚠️  注意：最大曲率已接近限制的 90%，")
            lines.append(f"   实际运行时可能需要更慢的速度。")

        lines.append(f"\n📐 速度怎么算出来的？")
        lines.append(f"   用公式 v(κ) = v_max × (1 - κ/κ_max)")
        lines.append(f"   曲率 κ 越大（转弯越急），速度 v 越小，")
        lines.append(f"   这样可以防止侧翻或失控。")

    lines.append(f"\n🔗 处理环节链（共 {len(evidence.get_chain_summary()['module_distribution'])} 个模块）：")
    module_icons = {
        "input_parser": "📥",
        "curvature_constraint": "📐",
        "path_search": "🔍",
        "trajectory_smoother": "✨",
        "validator": "✅",
    }
    for mod, count in evidence.get_chain_summary()['module_distribution'].items():
        icon = module_icons.get(mod, "❓")
        lines.append(f"   {icon} {mod}: {count} 次操作")

    lines.append(f"\n📋 交接时可以看这些证据：")
    lines.append(f"   • 曲率计算记录：在 curvature_constraints 模块")
    lines.append(f"   • 节点扩展过程：在 path_search 模块")
    lines.append(f"   • 平滑迭代过程：在 trajectory_smoother 模块")
    lines.append(f"   • 碰撞/曲率/速度验证：在 validator 模块")
    lines.append(f"   • 完整追溯链：调用 --trace 查看")

    lines.append("\n" + "=" * 70)
    return "\n".join(lines)


@click.group()
def cli():
    """机器人路径曲率限制 - 考虑最小转弯半径的路径规划工具"""
    pass


@cli.command()
@click.option('--map', 'map_input', required=True,
              help='地图：JSON文件路径 或 "宽度,高度[,障碍x,障碍y...]"')
@click.option('--start', required=True, help='起点：x,y 或 x,y,角度(度)')
@click.option('--goal', required=True, help='终点：x,y 或 x,y,角度(度)')
@click.option('--resolution', default=0.5, help='栅格分辨率(m)，默认0.5')
@click.option('--wheelbase', default=0.5, help='机器人轴距(m)，默认0.5')
@click.option('--max-steering', default=30.0, help='最大转向角(度)，默认30')
@click.option('--max-speed', default=1.0, help='最大速度(m/s)，默认1.0')
@click.option('--smooth/--no-smooth', default=True, help='是否平滑路径，默认平滑')
@click.option('--validate/--no-validate', default=True, help='是否验证路径，默认验证')
@click.option('--output', default=None, help='输出路径文件(JSON)')
@click.option('--evidence', default=None, help='证据链输出文件(JSON)')
@click.option('--trace', is_flag=True, help='显示完整追溯链')
@click.option('--show-formulas', is_flag=True, help='显示所有用到的公式')
def plan(map_input, start, goal, resolution, wheelbase, max_steering,
         max_speed, smooth, validate, output, evidence, trace, show_formulas):
    """规划考虑最小转弯半径的路径"""

    click.echo("📥 正在解析输入...")

    grid_map = parse_map_input(map_input, resolution)
    start_pose = parse_pose(start)
    goal_pose = parse_pose(goal)

    robot_params = RobotParams.from_wheelbase_steering(
        wheelbase=wheelbase,
        max_steering_angle=np.radians(max_steering),
        max_speed=max_speed,
    )

    evidence_chain = EvidenceChain()

    evidence_chain.record_input_clue("map", {
        "width_cells": grid_map.width_cells,
        "height_cells": grid_map.height_cells,
        "resolution": resolution,
        "obstacles": int(np.sum(grid_map.obstacles)),
    }, "user")
    evidence_chain.record_input_clue("robot_params", {
        "wheelbase": wheelbase,
        "max_steering_deg": max_steering,
        "min_turning_radius": robot_params.min_turning_radius,
        "max_curvature": robot_params.max_curvature,
    }, "calculated")

    if show_formulas:
        click.echo("\n📐 核心公式：")
        formulas = CurvatureConstraint.UNITS
        for name, formula in CurvatureConstraint.FORMULAS.items():
            click.echo(f"   {formula}")
        click.echo(f"   单位：{formulas}")

    click.echo(f"\n🔍 正在规划路径（考虑最小转弯半径 {robot_params.min_turning_radius:.2f}m）...")

    planner = HybridAStarPlanner(grid_map, robot_params, evidence_chain)
    path = planner.plan(start_pose, goal_pose)

    if path is not None and smooth:
        click.echo("✨ 正在平滑路径...")
        smoother = TrajectorySmoother(robot_params, grid_map, evidence_chain)
        path = smoother.smooth(path)

    if path is not None and validate:
        click.echo("✅ 正在验证路径...")
        validator = PathValidator(grid_map, robot_params, evidence_chain)
        result = validator.validate(path)

        click.echo(validator.get_human_readable_report(result))
        click.echo(validator.explain_why_needed())

    click.echo(generate_human_reasoning(
        grid_map, start_pose, goal_pose, robot_params, path, evidence_chain
    ))

    if trace:
        evidence_chain.print_trace_chain()
        evidence_chain.print_curvature_chain()

    if output and path is not None:
        path_data = {
            "points": [
                {
                    "x": p.pose.x,
                    "y": p.pose.y,
                    "theta_deg": np.degrees(p.pose.theta),
                    "curvature": p.curvature,
                    "speed": p.speed,
                    "timestamp": p.timestamp,
                    "steering_deg": np.degrees(p.steering_angle),
                }
                for p in path.points
            ],
            "total_length": path.total_length,
            "max_curvature": path.max_curvature,
            "avg_curvature": path.avg_curvature,
            "smoothness": path.smoothness,
        }
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(path_data, f, ensure_ascii=False, indent=2)
        click.echo(f"\n💾 路径已保存到 {output}")

    if evidence:
        evidence_chain.export_to_json(evidence)
        click.echo(f"💾 证据链已保存到 {evidence}")

    click.echo("\n📋 交接信息：")
    click.echo(evidence_chain.get_chain_for_handoff())

    return path


@cli.command()
@click.option('--path-file', required=True, help='路径文件(JSON)')
@click.option('--map', 'map_input', required=True, help='地图：JSON文件路径 或 "宽度,高度[,障碍x,障碍y...]"')
@click.option('--resolution', default=0.5, help='栅格分辨率(m)，默认0.5')
@click.option('--wheelbase', default=0.5, help='机器人轴距(m)，默认0.5')
@click.option('--max-steering', default=30.0, help='最大转向角(度)，默认30')
@click.option('--max-speed', default=1.0, help='最大速度(m/s)，默认1.0')
@click.option('--evidence', default=None, help='证据链输出文件(JSON)')
def validate(path_file, map_input, resolution, wheelbase, max_steering,
             max_speed, evidence):
    """验证已有路径的曲率、碰撞和速度约束"""

    click.echo("📥 正在加载路径和地图...")

    with open(path_file, 'r', encoding='utf-8') as f:
        path_data = json.load(f)

    from models import PathPoint, Pose
    points = []
    for p in path_data['points']:
        points.append(PathPoint(
            pose=Pose(p['x'], p['y'], np.radians(p['theta_deg'])),
            curvature=p['curvature'],
            speed=p['speed'],
            timestamp=p['timestamp'],
            steering_angle=np.radians(p.get('steering_deg', 0.0)),
        ))

    path = Path(
        points=points,
        total_length=path_data['total_length'],
        max_curvature=path_data['max_curvature'],
        avg_curvature=path_data['avg_curvature'],
        smoothness=path_data['smoothness'],
    )

    grid_map = parse_map_input(map_input, resolution)
    robot_params = RobotParams.from_wheelbase_steering(
        wheelbase=wheelbase,
        max_steering_angle=np.radians(max_steering),
        max_speed=max_speed,
    )

    evidence_chain = EvidenceChain()
    validator = PathValidator(grid_map, robot_params, evidence_chain)

    click.echo("✅ 正在验证路径...")
    result = validator.validate(path)

    click.echo(validator.get_human_readable_report(result))
    click.echo(validator.explain_why_needed())

    if evidence:
        evidence_chain.export_to_json(evidence)
        click.echo(f"\n💾 证据链已保存到 {evidence}")

    click.echo("\n📋 交接信息：")
    click.echo(evidence_chain.get_chain_for_handoff())


@cli.command()
@click.argument('curvature', type=float)
@click.option('--wheelbase', default=0.5, help='机器人轴距(m)，默认0.5')
@click.option('--max-steering', default=30.0, help='最大转向角(度)，默认30')
@click.option('--max-speed', default=1.0, help='最大速度(m/s)，默认1.0')
def explain_curvature(curvature, wheelbase, max_steering, max_speed):
    """解释一个曲率值对机器人意味着什么"""

    robot_params = RobotParams.from_wheelbase_steering(
        wheelbase=wheelbase,
        max_steering_angle=np.radians(max_steering),
        max_speed=max_speed,
    )

    cc = CurvatureConstraint(robot_params)

    click.echo(f"\n📐 曲率 {curvature:.4f} 1/m 的含义：")
    click.echo(f"   机器人参数：轴距 {wheelbase}m，最大转向 {max_steering}°")
    click.echo(f"   最大允许曲率：{robot_params.max_curvature:.4f} 1/m")
    click.echo(f"   最小允许转弯半径：{robot_params.min_turning_radius:.2f} m")

    turning_radius_calc = cc.calculate_turning_radius(curvature, is_steering=False)
    click.echo(f"\n   对应转弯半径：{turning_radius_calc.result:.2f} m")
    click.echo(f"   公式：{turning_radius_calc.formula}")
    click.echo(f"   {turning_radius_calc.reasoning}")

    steering_calc = cc.calculate_steering_from_curvature(curvature)
    click.echo(f"\n   对应转向角：{np.degrees(steering_calc.result):.1f}°")
    click.echo(f"   公式：{steering_calc.formula}")
    click.echo(f"   {steering_calc.reasoning}")

    speed_calc = cc.calculate_speed_for_curvature(curvature)
    click.echo(f"\n   对应允许速度：{speed_calc.result:.2f} m/s")
    click.echo(f"   公式：{speed_calc.formula}")
    click.echo(f"   {speed_calc.reasoning}")

    feasible = abs(curvature) <= robot_params.max_curvature + 1e-8
    if feasible:
        click.echo(f"\n✅ 这个曲率是可行的")
        click.echo(f"   机器人可以完成这个转弯。")
    else:
        click.echo(f"\n❌ 这个曲率不可行！")
        excess = abs(curvature) - robot_params.max_curvature
        click.echo(f"   超出限制 {excess:.4f} 1/m，")
        click.echo(f"   就像让自行车原地掉头一样不可能。")
        click.echo(f"\n💡 建议：")
        click.echo(f"   • 需要更大的转弯空间")
        click.echo(f"   • 或者换一个转向更灵活的机器人")


@cli.command()
@click.option('--evidence-file', required=True, help='证据链JSON文件')
@click.option('--link-id', default=None, help='从哪个链接开始追溯，默认从最后一个')
def trace(evidence_file, link_id):
    """从证据链文件中追溯某一结果的来龙去脉"""

    with open(evidence_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    click.echo("\n" + "=" * 70)
    click.echo("🔍 证据链追溯")
    click.echo("=" * 70)

    click.echo(f"\n📊 摘要：")
    click.echo(f"   总环节数：{data['summary']['total_links']}")
    click.echo(f"   输入线索：{json.dumps(data['summary']['input_clues'], ensure_ascii=False)}")
    click.echo(f"   问题数：{data['summary']['violation_count']}")

    if data['summary']['violation_links']:
        click.echo(f"\n⚠️  问题点：")
        for v in data['summary']['violation_links']:
            click.echo(f"   • {v['reasoning']}")

    links = {l['link_id']: l for l in data['links']}

    if link_id is None:
        link_id = data['links'][-1]['link_id']

    if link_id not in links:
        click.echo(f"\n❌ 未找到链接 {link_id}")
        return

    chain = []
    visited = set()
    current = [link_id]

    while current:
        next_ids = []
        for cid in current:
            if cid in visited:
                continue
            visited.add(cid)
            link = links[cid]
            chain.append(link)
            next_ids.extend(link['parent_link_ids'])
        current = next_ids

    click.echo(f"\n🔗 追溯链（从结果到输入）：")
    for i, link in enumerate(reversed(chain)):
        module_icon = {
            "curvature_constraint": "📐",
            "path_search": "🔍",
            "trajectory_smoother": "✨",
            "validator": "✅",
            "input_parser": "📥",
        }.get(link['module'], "❓")

        click.echo(f"\n{i+1}. {module_icon} [{link['module']}] {link['operation']}")
        click.echo(f"   链接ID: {link['link_id']}")
        click.echo(f"   💬 {link['human_reasoning']}")

        if 'raw_data' in link and 'calculation' in link['raw_data']:
            calc = link['raw_data']['calculation']
            if isinstance(calc, dict) and 'formula' in calc:
                click.echo(f"   📐 公式: {calc['formula']}")
                click.echo(f"      输入: {calc['inputs']}")
                click.echo(f"      结果: {calc['result']:.6f}")

        if link['parent_link_ids']:
            click.echo(f"   ← 依赖: {', '.join(link['parent_link_ids'])}")

    click.echo("\n" + "=" * 70)


if __name__ == '__main__':
    cli()
