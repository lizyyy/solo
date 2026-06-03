from __future__ import annotations

import argparse
import json
import sys

from .workflow import WorkflowEngine
from .core import generate_occlusion_report, _phase_label


def main():
    parser = argparse.ArgumentParser(
        prog="sewage-inspection",
        description="污水厂池体巡检路线 — 不一致检测与遮挡点管理",
    )
    sub = parser.add_subparsers(dest="command")

    p_create = sub.add_parser("create", help="创建巡检项目")
    p_create.add_argument("--name", required=True, help="项目名称")
    p_create.add_argument("--plant", default="", help="厂区名称")
    p_create.add_argument("--by", default="cli", help="创建人")

    p_list = sub.add_parser("list", help="列出所有项目")

    p_import_obs = sub.add_parser("import-obstacles", help="导入障碍物备注")
    p_import_obs.add_argument("--project", required=True, help="项目ID")
    p_import_obs.add_argument("--file", required=True, help="障碍物备注JSON文件路径")

    p_import_floor = sub.add_parser("import-floor-profiles", help="补录楼层剖面草图")
    p_import_floor.add_argument("--project", required=True, help="项目ID")
    p_import_floor.add_argument("--file", required=True, help="楼层剖面草图JSON文件路径")

    p_import_coords = sub.add_parser("import-coordinates", help="补录坐标表")
    p_import_coords.add_argument("--project", required=True, help="项目ID")
    p_import_coords.add_argument("--file", required=True, help="坐标表JSON文件路径")

    p_step = sub.add_parser("step", help="推进工作流到下一阶段")
    p_step.add_argument("--project", required=True, help="项目ID")

    p_report = sub.add_parser("report", help="生成遮挡点清单报告")
    p_report.add_argument("--project", required=True, help="项目ID")
    p_report.add_argument("--output", default=None, help="输出文件路径（默认打印到终端）")

    p_show = sub.add_parser("show", help="查看项目详情")
    p_show.add_argument("--project", required=True, help="项目ID")

    args = parser.parse_args()
    engine = WorkflowEngine()

    if args.command == "create":
        project = engine.create_project(args.name, args.plant, args.by)
        print(f"✅ 项目已创建: {project.name} (ID: {project.id})")
        print(f"   当前阶段: {_phase_label(project.current_phase)}")

    elif args.command == "list":
        projects = engine.list_projects()
        if not projects:
            print("暂无项目，使用 create 命令创建。")
        for p in projects:
            print(f"  {p['id']}  {p['name']}  ({p.get('plant_name', '')})  阶段: {p.get('current_phase', '')}")

    elif args.command == "import-obstacles":
        data = _load_json(args.file)
        project = engine.import_obstacle_remarks(args.project, data)
        _print_summary(project)

    elif args.command == "import-floor-profiles":
        data = _load_json(args.file)
        project = engine.import_floor_profiles(args.project, data)
        _print_summary(project)

    elif args.command == "import-coordinates":
        data = _load_json(args.file)
        project = engine.import_coordinate_rows(args.project, data)
        _print_summary(project)

    elif args.command == "step":
        project = engine.run_step(args.project)
        print(f"➡️ 工作流已推进到: {_phase_label(project.current_phase)}")
        _print_summary(project)

    elif args.command == "report":
        report = engine.get_report(args.project)
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(report)
            print(f"📄 报告已输出到: {args.output}")
        else:
            print(report)

    elif args.command == "show":
        project = engine.load_project(args.project)
        print(f"项目: {project.name} ({project.plant_name})")
        print(f"ID: {project.id}")
        print(f"阶段: {_phase_label(project.current_phase)}")
        print(f"障碍物备注: {len(project.obstacle_remarks)}")
        print(f"楼层剖面草图: {len(project.floor_profiles)}")
        print(f"照片点位: {len(project.photo_locations)}")
        print(f"坐标表行: {len(project.coordinate_rows)}")
        print(f"遮挡点: {len(project.occlusion_points)}")

    else:
        parser.print_help()


def _load_json(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    return data


def _print_summary(project):
    pending = sum(1 for op in project.occlusion_points if op.status.value == "pending_review")
    resolved = sum(1 for op in project.occlusion_points if op.status.value == "resolved")
    print(f"   障碍物备注: {len(project.obstacle_remarks)}  |  "
          f"楼层剖面草图: {len(project.floor_profiles)}  |  "
          f"照片点位: {len(project.photo_locations)}  |  "
          f"坐标表行: {len(project.coordinate_rows)}")
    print(f"   ⚠️ 遮挡点: {len(project.occlusion_points)} "
          f"(待复核: {pending}, 已解决: {resolved})")
    if pending > 0:
        print(f"   💡 照片有点位但坐标表缺行 — 不要急着归正常，留给安全员复核！")


if __name__ == "__main__":
    main()
