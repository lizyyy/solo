from __future__ import annotations

import argparse
import json
import sys

from .workflow import WorkflowEngine
from .core import generate_occlusion_report, _phase_label, _status_label, _next_action_label


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

    p_import_obs = sub.add_parser("import-obstacles", help="导入障碍物备注（步骤1）")
    p_import_obs.add_argument("--project", required=True, help="项目ID")
    p_import_obs.add_argument("--file", required=True, help="障碍物备注JSON文件路径")

    p_import_floor = sub.add_parser("import-floor-profiles", help="补录楼层剖面草图（步骤2：老梁补看）")
    p_import_floor.add_argument("--project", required=True, help="项目ID")
    p_import_floor.add_argument("--file", required=True, help="楼层剖面草图JSON文件路径")

    p_import_coords = sub.add_parser("import-coordinates", help="补录坐标表（解决遮挡点）")
    p_import_coords.add_argument("--project", required=True, help="项目ID")
    p_import_coords.add_argument("--file", required=True, help="坐标表JSON文件路径")

    p_step = sub.add_parser("step", help="推进工作流到下一阶段")
    p_step.add_argument("--project", required=True, help="项目ID")

    p_report = sub.add_parser("report", help="生成遮挡点清单报告（含变更历史）")
    p_report.add_argument("--project", required=True, help="项目ID")
    p_report.add_argument("--output", default=None, help="输出文件路径（默认打印到终端）")

    p_show = sub.add_parser("show", help="查看项目详情 + 遮挡点审计轨迹")
    p_show.add_argument("--project", required=True, help="项目ID")

    p_escalate = sub.add_parser("escalate", help="升级遮挡点到安全员复核")
    p_escalate.add_argument("--project", required=True, help="项目ID")
    p_escalate.add_argument("--occlusion", required=True, help="遮挡点ID")

    p_review = sub.add_parser("review-comment", help="对遮挡点写人工复核批注（写入审计轨迹）")
    p_review.add_argument("--project", required=True, help="项目ID")
    p_review.add_argument("--occlusion", required=True, help="遮挡点ID")
    p_review.add_argument("--comment", required=True, help="批注内容")
    p_review.add_argument("--by", default="safety_officer", help="复核人：safety_officer 或 instructor_liang")

    args = parser.parse_args()
    engine = WorkflowEngine()

    if args.command == "create":
        project = engine.create_project(args.name, args.plant, args.by)
        print(f"✅ 项目已创建: {project.name} (ID: {project.id})")
        print(f"   当前阶段: {_phase_label(project.current_phase)}")
        print(f"   下一步: 导入障碍物备注 — 命令参考：")
        print(f"     python3 -m sewage_inspection.cli import-obstacles --project {project.id} --file sample_data/obstacles.json")

    elif args.command == "list":
        projects = engine.list_projects()
        if not projects:
            print("暂无项目，使用 create 命令创建。")
        for p in projects:
            print(f"  {p['id']}  {p['name']}  ({p.get('plant_name', '')})  阶段: {p.get('current_phase', '')}")

    elif args.command == "import-obstacles":
        data = _load_json(args.file)
        before = engine.load_project(args.project)
        before_ids = {op.id for op in before.occlusion_points}
        before_obs = len(before.obstacle_remarks)

        project = engine.import_obstacle_remarks(args.project, data)
        new_ops = [op for op in project.occlusion_points if op.id not in before_ids]
        print(f"📥 导入障碍物备注成功（{len(data)} 条备注 → {len(project.obstacle_remarks)-before_obs} 新增）")
        _print_summary(project)
        if new_ops:
            print(f"\n🆕 新增遮挡点（照片有点位但坐标表缺一行）— 不要急着归正常，留给安全员复核：")
            for op in new_ops:
                print(f"  · [{op.id}] 照片 {op.photo_ref}  ({op.point_x:.2f},{op.point_y:.2f},{op.point_z:.2f})")
                print(f"      为什么被留下: {op.reason}")
                print(f"      还缺什么材料: {op.missing_material}")
                print(f"      下一步: {_next_action_label(op.next_action)}")
        if not new_ops:
            print(f"\n✅ 所有照片点位在坐标表中均有匹配，没有产生新遮挡点。")

    elif args.command == "import-floor-profiles":
        data = _load_json(args.file)
        before = engine.load_project(args.project)
        before_ids = {op.id for op in before.occlusion_points}
        before_pro = len(before.floor_profiles)

        project = engine.import_floor_profiles(args.project, data)
        new_ops = [op for op in project.occlusion_points if op.id not in before_ids]
        print(f"📥 老梁补录楼层剖面草图成功（{len(data)} 条 → {len(project.floor_profiles)-before_pro} 新增）")
        _print_summary(project)
        if new_ops:
            print(f"\n🆕 新发现遮挡点（老梁补看后楼层剖面照片冒出点位但坐标表缺行）：")
            for op in new_ops:
                print(f"  · [{op.id}] 照片 {op.photo_ref}  ({op.point_x:.2f},{op.point_y:.2f},{op.point_z:.2f})")
                print(f"      为什么被留下: {op.reason}")
                print(f"      还缺什么材料: {op.missing_material}")
                print(f"      下一步: {_next_action_label(op.next_action)}")
        print(f"\n💡 遮挡点清单已更新。下一步参考：")
        print(f"     补录坐标表: import-coordinates --project {project.id} --file sample_data/coordinates.json")

    elif args.command == "import-coordinates":
        data = _load_json(args.file)
        before = engine.load_project(args.project)
        before_pending = [op.id for op in before.occlusion_points if op.status.value == "pending_review"]

        project = engine.import_coordinate_rows(args.project, data)
        now_resolved = [
            op for op in project.occlusion_points
            if op.id in before_pending and op.status.value == "resolved"
        ]
        still_pending = [
            op for op in project.occlusion_points
            if op.id in before_pending and op.status.value == "pending_review"
        ]
        print(f"📥 补录坐标表成功（{len(data)} 行 → {len(project.coordinate_rows)} 总计）")
        _print_summary(project)
        if now_resolved:
            print(f"\n✅ 自动解决的遮挡点（坐标表补录后匹配成功 — 保留原始说法）：")
            for op in now_resolved:
                print(f"  · [{op.id}] 照片 {op.photo_ref}")
                print(f"      原始说法（保留）: {op.original_missing_material}")
                print(f"      改后值: {op.missing_material}")
                for entry in op.audit_trail[-1:]:
                    print(f"      变更原因: {entry.change_cause}  |  下一步: {_next_action_label(op.next_action)}")
        if still_pending:
            print(f"\n⚠️ 仍然待安全员复核（坐标表仍缺行 — 不要提前归正常）：")
            for op in still_pending:
                print(f"  · [{op.id}] 照片 {op.photo_ref}  ({op.point_x:.2f},{op.point_y:.2f},{op.point_z:.2f})")
                print(f"      还缺什么材料: {op.missing_material}")
                print(f"      下一步: {_next_action_label(op.next_action)}")

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
        print(f"障碍物备注: {len(project.obstacle_remarks)}  |  "
              f"楼层剖面草图: {len(project.floor_profiles)}  |  "
              f"照片点位: {len(project.photo_locations)}  |  "
              f"坐标表行: {len(project.coordinate_rows)}")
        pending = sum(1 for op in project.occlusion_points if op.status.value == "pending_review")
        resolved = sum(1 for op in project.occlusion_points if op.status.value == "resolved")
        escalated = sum(1 for op in project.occlusion_points if op.status.value == "escalated_safety")
        print(f"遮挡点: {len(project.occlusion_points)}  (待复核: {pending}, 已解决: {resolved}, 已升级安全员: {escalated})")
        if project.occlusion_points:
            print(f"\n{'='*60}")
            print("遮挡点详情（含审计轨迹）")
            print("="*60)
            for i, op in enumerate(project.occlusion_points, 1):
                print(f"\n#{i} [{op.id}] 照片 {op.photo_ref}  ({op.point_x:.2f},{op.point_y:.2f},{op.point_z:.2f})")
                print(f"  状态: {_status_label(op.status)}")
                print(f"  为什么被留下: {op.reason}")
                print(f"  还缺什么材料: {op.missing_material}")
                print(f"  下一步: {_next_action_label(op.next_action)}")
                if op.original_reason and (op.original_missing_material != op.missing_material or op.original_next_action != op.next_action.value or op.status.value != "pending_review"):
                    print(f"  原始缺失描述（保留）: {op.original_missing_material}")
                    if op.original_next_action and op.original_next_action != op.next_action.value:
                        from .models import NextAction
                        print(f"  原始下一步（保留）: {_next_action_label(NextAction(op.original_next_action))}")
                if op.obstacle_remark_id:
                    from .core import _find_obstacle_remark
                    r = _find_obstacle_remark(project, op.obstacle_remark_id)
                    if r:
                        print(f"  关联障碍物备注: {r.location} — {r.description}")
                if op.floor_profile_id:
                    from .core import _find_floor_profile
                    p = _find_floor_profile(project, op.floor_profile_id)
                    if p:
                        print(f"  关联楼层剖面草图: {p.floor_name}")
                if op.audit_trail:
                    print(f"  变更历史:")
                    for j, entry in enumerate(op.audit_trail, 1):
                        print(f"    {j}. [{entry.timestamp}] {_action_label(entry.action)} — 操作人: {entry.changed_by}")
                        if entry.from_status or entry.to_status:
                            print(f"       状态: {entry.from_status or '(新建)'} → {entry.to_status}")
                        if entry.from_missing_material != entry.to_missing_material:
                            print(f"       缺失材料: {entry.from_missing_material or '(无)'} → {entry.to_missing_material}")
                        if entry.from_next_action != entry.to_next_action:
                            from .models import NextAction
                            fn = lambda v: _next_action_label(NextAction(v)) if v else "(无)"
                            print(f"       下一步: {fn(entry.from_next_action)} → {fn(entry.to_next_action)}")
                        print(f"       原因: {entry.change_cause}")
                        if entry.note:
                            print(f"       备注: {entry.note}")

    elif args.command == "escalate":
        project = engine.escalate_occlusion(args.project, args.occlusion, "safety_officer")
        op = next((o for o in project.occlusion_points if o.id == args.occlusion), None)
        if op:
            print(f"🚨 遮挡点 {op.photo_ref} 已升级安全员复核")
            print(f"   审计轨迹最新条目已写入（保留原始说法+改后值+原因）")
        _print_summary(project)

    elif args.command == "review-comment":
        project = engine.add_review_comment(args.project, args.occlusion, args.comment, args.by)
        op = next((o for o in project.occlusion_points if o.id == args.occlusion), None)
        if op:
            print(f"📝 复核批注已写入审计轨迹")
            print(f"   复核人: {args.by}  |  内容: {args.comment}")
        _print_summary(project)

    else:
        parser.print_help()


def _action_label(action):
    return ({
        "created": "首次检测生成",
        "resolved_by_coordinate": "坐标表补录后自动解决",
        "escalated_to_safety": "升级安全员复核",
        "revert_to_pending": "回退待复核",
        "review_comment": "人工复核批注",
    }).get(action, action)


def _load_json(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    return data


def _print_summary(project):
    pending = sum(1 for op in project.occlusion_points if op.status.value == "pending_review")
    resolved = sum(1 for op in project.occlusion_points if op.status.value == "resolved")
    escalated = sum(1 for op in project.occlusion_points if op.status.value == "escalated_safety")
    print(f"   障碍物备注: {len(project.obstacle_remarks)}  |  "
          f"楼层剖面草图: {len(project.floor_profiles)}  |  "
          f"照片点位: {len(project.photo_locations)}  |  "
          f"坐标表行: {len(project.coordinate_rows)}")
    print(f"   ⚠️ 遮挡点: {len(project.occlusion_points)} "
          f"(待复核: {pending}, 已解决: {resolved}, 已升级安全员: {escalated})")
    if pending > 0:
        print(f"   💡 照片有点位但坐标表缺行 — 不要急着归正常，留给安全员复核！")


if __name__ == "__main__":
    main()
