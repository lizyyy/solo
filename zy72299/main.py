import argparse
import json
import uuid
import sys
import os
from datetime import datetime
from typing import List, Dict, Optional

from models import (
    ProcessingResult,
    ObstacleRecord,
    ConflictEvidence,
    RecordStatus,
)
from coordinate_importer import CoordinateOriginImporter
from photo_matcher import PhotoMatcher
from conflict_detector import DuplicateNameDetector, ConflictResolver
from view_updater import View3DUpdater
from history_manager import HistoryManager, ResultFormatter


def load_json_file(filepath: str) -> Dict:
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def build_origin_data_map(origin_spec: Dict, records: List[ObstacleRecord]) -> Dict[str, Dict]:
    origin_data_map = {}
    origin_obstacle_map = {}
    for obs in origin_spec["obstacles"]:
        origin_obstacle_map[obs["name"]] = obs

    for record in records:
        if record.origin_id and record.obstacle_name in origin_obstacle_map:
            origin_obs = origin_obstacle_map[record.obstacle_name]
            origin_data_map[record.record_id] = {
                "position": origin_obs["position"],
                "obstacle_name": origin_obs["name"],
                "obstacle_type": origin_obs["type"],
                "source": "coordinate_origin_spec",
                "origin_id": record.origin_id,
            }
    return origin_data_map


def build_photo_data_map(photos_data: List[Dict]) -> Dict[str, Dict]:
    photo_map = {}
    for photo in photos_data:
        photo_map[photo["photo_number"]] = {
            "position": photo["position"],
            "obstacle_name": photo["obstacle_name"],
            "obstacle_type": photo["type"],
            "source": "inspection_photo",
            "photo_number": photo["photo_number"],
        }
    return photo_map


def process_building(
    building_id: str,
    origin_spec: Dict,
    inspection_photos: List[Dict],
    scenario_type: str,
    conflict_resolutions: Optional[List[Dict]] = None,
    duplicate_resolutions: Optional[List[Dict]] = None,
    origin_file: Optional[str] = None,
    photo_file: Optional[str] = None,
) -> ProcessingResult:
    history_manager = HistoryManager()
    all_records: List[ObstacleRecord] = []
    all_conflicts: List[ConflictEvidence] = []
    pending_reviews: List[ObstacleRecord] = []

    print(f"\n[步骤 1/3] 导入坐标原点说明，楼宇: {building_id}")
    importer = CoordinateOriginImporter()
    import_result = importer.import_origin_spec(
        building_id=building_id,
        origin_point=origin_spec["origin_point"],
        description=origin_spec["description"],
        obstacles_data=origin_spec["obstacles"],
        actor="system",
    )
    origin = import_result["origin"]
    all_records = import_result["records"]
    history_manager.merge_history([import_result["history"]])
    print(f"  → 成功导入 {len(all_records)} 条障碍物记录")

    print(f"\n[步骤 2/3] 园区运维小陶补看巡检照片编号")
    matcher = PhotoMatcher(all_records)
    match_result = matcher.match_photos(
        photos_data=inspection_photos,
        building_id=building_id,
        actor="xiaotao",
    )
    all_records = match_result["updated_records"]
    all_records.extend(match_result["new_records"])
    history_manager.merge_history([match_result["history"]])
    print(f"  → 匹配完成，新增补录记录 {len(match_result['new_records'])} 条")

    print(f"\n[步骤 2.1] 检测同一障碍物多名称情况")
    dup_detector = DuplicateNameDetector(all_records)
    dup_result = dup_detector.detect_duplicate_names(actor="system")
    all_records = dup_result["records"]
    history_manager.merge_history([dup_result["history"]])

    if duplicate_resolutions:
        print(f"  → 正在处理 {len(duplicate_resolutions)} 个重复名称决议")
        for res in duplicate_resolutions:
            resolved = dup_detector.resolve_duplicate(
                record_id=res["record_id"],
                action=res["action"],
                actor=res.get("actor", "xiaotao"),
                canonical_name=res.get("canonical_name"),
            )
            if resolved:
                print(f"    · 记录 {res['record_id']} 已按 {res['action']} 处理")

    for record in all_records:
        if record.status in [RecordStatus.DUPLICATE_NAME, RecordStatus.PENDING_REVIEW]:
            pending_reviews.append(record)

    dup_count = len([r for r in all_records if r.status == RecordStatus.DUPLICATE_NAME])
    pending_count = len([r for r in all_records if r.status == RecordStatus.PENDING_REVIEW])
    print(f"  → 检测到 {dup_count} 条同一障碍物多名称，{pending_count} 条留待培训学员复核")

    print(f"\n[步骤 2.2] 检测坐标原点说明与巡检照片编号冲突")
    origin_data_map = build_origin_data_map(origin_spec, all_records)
    photo_data_map = build_photo_data_map(inspection_photos)

    conflict_resolver = ConflictResolver(all_records)
    conflict_result = conflict_resolver.detect_conflicts(
        origin_data_map=origin_data_map,
        photo_data_map=photo_data_map,
        actor="system",
    )
    all_records = conflict_result["records"]
    all_conflicts = conflict_result["conflicts"]
    history_manager.merge_history([conflict_result["history"]])

    if conflict_resolutions:
        print(f"  → 正在处理 {len(conflict_resolutions)} 个冲突决议")
        for res in conflict_resolutions:
            resolved = conflict_resolver.resolve_conflict(
                conflict_id=res["conflict_id"],
                resolution=res["resolution"],
                actor=res.get("actor", "xiaotao"),
            )
            if resolved:
                print(f"    · 冲突 {res['conflict_id']} 已按 {res['resolution']} 处理")

    conflict_count = len([r for r in all_records if r.status == RecordStatus.CONFLICT])
    if conflict_count > 0:
        print(f"  ⚠ 检测到 {conflict_count} 条数据冲突，需要园区运维小陶选择确认或驳回")
        for review_item in conflict_resolver.list_conflicts_for_review():
            print(f"    · {review_item['message']}")
            print(f"      冲突ID: {review_item['conflict_id']}, 记录: {review_item['record_id']}")
            print(f"      矛盾字段: {', '.join(review_item['conflicting_fields'])}")

    print(f"\n[步骤 3/3] 三维标注视图更新")
    view_updater = View3DUpdater(all_records)
    view_result = view_updater.generate_3d_view(
        building_id=building_id,
        origin_point=origin_spec["origin_point"],
        actor="system",
    )
    history_manager.merge_history([view_result["history"]])

    cleaning_path = view_updater.generate_cleaning_path(
        building_id=building_id,
        path_name=f"{building_id}-清洗路径-{datetime.now().strftime('%Y%m%d')}",
        actor="system",
    )
    print(f"  → 生成清洗路径，包含 {len(cleaning_path.points)} 个清洗点")

    audit_report = history_manager.generate_audit_report(all_records)
    replay_command = history_manager.generate_replay_command(
        building_id=building_id,
        scenario_type=scenario_type,
        origin_file=origin_file,
        photo_file=photo_file,
        conflict_resolutions=conflict_resolutions,
        duplicate_resolutions=duplicate_resolutions,
    )

    result = ProcessingResult(
        result_id=f"result_{uuid.uuid4().hex[:8]}",
        building_id=building_id,
        scenario_type=scenario_type,
        processed_records=all_records,
        conflicts=all_conflicts,
        pending_reviews=pending_reviews,
        cleaning_path=cleaning_path,
        history=history_manager.all_history,
        replay_command=replay_command,
        summary=audit_report,
    )

    return result


def run_scenario(scenario_name: str, building_id: str = "BUILDING_A") -> ProcessingResult:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_dir = os.path.join(base_dir, "sample_data")

    origin_file = os.path.join(sample_dir, "origin_spec_building_a.json")
    origin_spec = load_json_file(origin_file)

    if scenario_name == "normal":
        photo_file = os.path.join(sample_dir, "inspection_photos_building_a_normal.json")
        photos_data = load_json_file(photo_file)["photos"]
        scenario_type = "正常场景-顺利记录"
    elif scenario_name == "duplicate":
        photo_file = os.path.join(sample_dir, "inspection_photos_building_a_duplicate.json")
        photos_data = load_json_file(photo_file)["photos"]
        scenario_type = "重复名称场景-同一障碍物多名称"
    elif scenario_name == "supplement":
        photo_file = os.path.join(sample_dir, "inspection_photos_building_a_supplement.json")
        photos_data = load_json_file(photo_file)["photos"]
        scenario_type = "补录场景-旧口径补录"
    elif scenario_name == "conflict":
        photo_file = os.path.join(sample_dir, "inspection_photos_building_a_conflict.json")
        photos_data = load_json_file(photo_file)["photos"]
        scenario_type = "冲突场景-坐标与照片矛盾"
    elif scenario_name == "all":
        normal_photos = load_json_file(
            os.path.join(sample_dir, "inspection_photos_building_a_normal.json")
        )["photos"]
        dup_photos = load_json_file(
            os.path.join(sample_dir, "inspection_photos_building_a_duplicate.json")
        )["photos"]
        supp_photos = load_json_file(
            os.path.join(sample_dir, "inspection_photos_building_a_supplement.json")
        )["photos"]
        conflict_photos = load_json_file(
            os.path.join(sample_dir, "inspection_photos_building_a_conflict.json")
        )["photos"]
        photos_data = normal_photos + dup_photos + supp_photos + conflict_photos
        photo_file = "sample_data/*_building_a_*.json"
        scenario_type = "完整场景-三种情况全包含"
    else:
        raise ValueError(f"未知场景: {scenario_name}")

    print(f"\n{'=' * 60}")
    print(f"开始处理场景: {scenario_type}")
    print(f"{'=' * 60}")

    result = process_building(
        building_id=building_id,
        origin_spec=origin_spec,
        inspection_photos=photos_data,
        scenario_type=scenario_type,
        origin_file=origin_file,
        photo_file=photo_file,
    )

    return result


def main():
    parser = argparse.ArgumentParser(
        description="楼宇外立面清洗路径 - 坐标与照片数据处理系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 运行正常场景
  python main.py --scenario normal

  # 运行重复名称场景
  python main.py --scenario duplicate

  # 运行补录场景
  python main.py --scenario supplement

  # 运行冲突场景
  python main.py --scenario conflict

  # 运行完整场景（包含所有情况）
  python main.py --scenario all --generate-report --output result.json

  # 自定义数据文件
  python main.py --origin-spec custom_origin.json --inspection-photos custom_photos.json
        """,
    )

    parser.add_argument(
        "--scenario",
        type=str,
        choices=["normal", "duplicate", "supplement", "conflict", "all"],
        default="all",
        help="选择运行场景",
    )
    parser.add_argument(
        "--building-id",
        type=str,
        default="BUILDING_A",
        help="楼宇ID",
    )
    parser.add_argument(
        "--origin-spec",
        type=str,
        help="坐标原点说明JSON文件路径",
    )
    parser.add_argument(
        "--inspection-photos",
        type=str,
        help="巡检照片JSON文件路径",
    )
    parser.add_argument(
        "--conflict-resolutions",
        type=str,
        help="冲突决议JSON数组字符串",
    )
    parser.add_argument(
        "--duplicate-resolutions",
        type=str,
        help="重复名称决议JSON数组字符串",
    )
    parser.add_argument(
        "--generate-report",
        action="store_true",
        help="生成完整报告",
    )
    parser.add_argument(
        "--output",
        type=str,
        help="输出结果到JSON文件",
    )

    args = parser.parse_args()

    conflict_resolutions = None
    if args.conflict_resolutions:
        conflict_resolutions = json.loads(args.conflict_resolutions)

    duplicate_resolutions = None
    if args.duplicate_resolutions:
        duplicate_resolutions = json.loads(args.duplicate_resolutions)

    if args.origin_spec and args.inspection_photos:
        origin_spec = load_json_file(args.origin_spec)
        photos_data = load_json_file(args.inspection_photos)["photos"]

        result = process_building(
            building_id=args.building_id,
            origin_spec=origin_spec,
            inspection_photos=photos_data,
            scenario_type="custom",
            conflict_resolutions=conflict_resolutions,
            duplicate_resolutions=duplicate_resolutions,
            origin_file=args.origin_spec,
            photo_file=args.inspection_photos,
        )
    else:
        result = run_scenario(args.scenario, args.building_id)

    ResultFormatter.print_console_report(result)

    if args.generate_report or args.output:
        formatted_result = ResultFormatter.format_result(result)

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(formatted_result, f, ensure_ascii=False, indent=2)
            print(f"\n结果已保存到: {args.output}")

    return result


if __name__ == "__main__":
    main()
