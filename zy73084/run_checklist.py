from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict, Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.models import HumanOverride, JudgmentStatus
from src.engine import CurtainWallChecklist, export_all
from src.sample_data import (
    build_sample_nodes,
    build_sample_meeting_minutes_round5,
    build_sample_overrides,
)


def load_json_if_exists(path: Path) -> List[Dict[str, Any]]:
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    return []


def build_from_files(base_dir: Path) -> CurtainWallChecklist:
    checklist = CurtainWallChecklist()
    nodes_path = base_dir / "nodes.json"
    minutes_path = base_dir / "meeting_minutes.json"
    overrides_path = base_dir / "overrides.json"

    if nodes_path.exists():
        raw_nodes = load_json_if_exists(nodes_path)
        if raw_nodes:
            from src.engine import CurtainWallNode, MaterialBatch, OpinionRecord, OpinionSource, SceneLabel
            import enum
            for rn in raw_nodes:
                n = CurtainWallNode(
                    code=rn.get("code", ""),
                    name=rn.get("name", ""),
                    scene=SceneLabel(rn.get("scene", "钢龙骨连接节点")),
                    floor_range=rn.get("floor_range", ""),
                    drawing_ref=rn.get("drawing_ref", ""),
                )
                for rm in rn.get("materials", []):
                    n.materials.append(MaterialBatch(**rm))
                for ro in rn.get("opinions", []):
                    src = ro.get("source", "会议纪要")
                    try:
                        ro["source"] = OpinionSource(src)
                    except ValueError:
                        ro["source"] = OpinionSource.MEETING_MINUTE
                    n.opinions.append(OpinionRecord(**ro))
                checklist.add_node(n)
    else:
        for n in build_sample_nodes():
            checklist.add_node(n)

    if minutes_path.exists():
        checklist.import_meeting_minutes(load_json_if_exists(minutes_path))
    else:
        checklist.import_meeting_minutes(build_sample_meeting_minutes_round5())

    if overrides_path.exists():
        raw_ovs = load_json_if_exists(overrides_path)
    else:
        raw_ovs = build_sample_overrides()

    for rov in raw_ovs:
        node = checklist.nodes.get(rov["node_code"])
        if not node:
            continue
        try:
            orig = next(s for s in JudgmentStatus if s.value == rov["original_status"])
        except StopIteration:
            orig = JudgmentStatus.UNSTABLE
        try:
            over = next(s for s in JudgmentStatus if s.value == rov["overridden_status"])
        except StopIteration:
            over = JudgmentStatus.OVERRIDDEN_STABLE
        node.register_override(HumanOverride(
            original_status=orig,
            overridden_status=over,
            reason=rov.get("reason", ""),
            operator=rov.get("operator", ""),
        ))

    return checklist


def main() -> int:
    parser = argparse.ArgumentParser(
        description="幕墙节点交底清单生成器 —— 统一标注 / 改判追溯 / 材料挂起 / 会议纪要追踪",
    )
    parser.add_argument(
        "--data-dir",
        "-d",
        type=Path,
        default=Path(__file__).resolve().parent / "data",
        help="输入数据目录 (默认: ./data)，目录下可放置 nodes.json / meeting_minutes.json / overrides.json",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        type=Path,
        default=Path(__file__).resolve().parent / "output",
        help="导出目录 (默认: ./output)",
    )
    parser.add_argument(
        "--use-sample",
        action="store_true",
        help="强制使用内置示例数据，忽略 data 目录",
    )
    parser.add_argument(
        "--show-metrics",
        action="store_true",
        help="终端中打印整体指标",
    )
    args = parser.parse_args()

    if args.use_sample or not (args.data_dir / "nodes.json").exists():
        checklist = CurtainWallChecklist()
        for n in build_sample_nodes():
            checklist.add_node(n)
        checklist.import_meeting_minutes(build_sample_meeting_minutes_round5())
        for rov in build_sample_overrides():
            node = checklist.nodes.get(rov["node_code"])
            if not node:
                continue
            orig = next(s for s in JudgmentStatus if s.value == rov["original_status"])
            over = next(s for s in JudgmentStatus if s.value == rov["overridden_status"])
            node.register_override(HumanOverride(
                original_status=orig,
                overridden_status=over,
                reason=rov.get("reason", ""),
                operator=rov.get("operator", ""),
            ))
        print(f"[提示] 使用内置示例数据运行，可在 {Path(__file__).resolve().parent / 'data'}/ 放置配置文件切换到真实数据")
    else:
        checklist = build_from_files(args.data_dir)

    result = checklist.run_pipeline()
    files_map = export_all(result, args.output_dir)

    print("\n========== 幕墙节点交底清单导出完成 ==========")
    print(f"导出目录: {args.output_dir.resolve()}")
    print("\n生成文件清单（请按 README 指引顺序查看）：")
    for k, v in files_map.items():
        print(f"  - {k}: {v}")

    if args.show_metrics:
        print("\n【整体指标】")
        for k, v in result["metrics"].items():
            print(f"  {k}: {v}")
        print("\n【异常队列状态】")
        for k, v in result["queue_status"].items():
            print(f"  {k}: {v}")

    if result["warnings"]:
        print(f"\n【本次运行共 {len(result['warnings'])} 条提醒，请重点关注 README_现场老师请先看.txt】")
        for w in result["warnings"][:3]:
            print(f"  ⚠ {w}")
        if len(result["warnings"]) > 3:
            print(f"  …… 剩余 {len(result['warnings']) - 3} 条详见 README_现场老师请先看.txt")

    print("\n现场老师操作步骤：")
    print("  1. 先打开  output/README_现场老师请先看.txt  查看本次重点提醒")
    print("  2. 再打开  output/05_材料批次缺失挂起清单.csv  补齐批次")
    print("  3. 然后看  output/02_异常队列_含处理状态与改判记录.csv  逐条闭环")
    print("  4. 最后看  output/01_幕墙节点交底清单_汇总表.csv  核对最终判定")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
