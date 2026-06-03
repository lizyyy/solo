#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
高架桥施工围挡视域分析系统 - 培训演示版
"""

import json
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
HISTORY_DIR = OUTPUT_DIR / "history"

for d in [OUTPUT_DIR, HISTORY_DIR]:
    d.mkdir(exist_ok=True)


def load_json(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data, filepath):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class ViaductVisualFieldProcessor:
    def __init__(self, origin_file=None, observation_file=None, supplement_file=None):
        self.origin_file = origin_file or DATA_DIR / "coordinate_origin.json"
        self.observation_file = observation_file or DATA_DIR / "raw_observations.json"
        self.supplement_file = supplement_file or DATA_DIR / "supplementary_observations.json"
        self.inspection_photos = load_json(DATA_DIR / "inspection_photos.json")
        
        self.origin = None
        self.observations = None
        self.supplements = None
        self.processed_obstacles = []
        self.history = []
        self.run_id = None
        self.manual_corrections = []
        
    def step1_import_origin(self):
        print("=" * 60)
        print("【步骤1】坐标原点说明导入")
        print("=" * 60)
        
        self.origin = load_json(self.origin_file)
        self._add_history("import_origin", "坐标原点说明导入完成", {
            "origin_id": self.origin["origin_id"],
            "import_date": self.origin["import_date"],
            "coordinate_system": self.origin["coordinate_system"]
        })
        
        print(f"✓ 坐标原点ID: {self.origin['origin_id']}")
        print(f"✓ 坐标系: {self.origin['coordinate_system']}")
        print(f"✓ 原点坐标: X={self.origin['origin_point']['x']:.3f}, "
              f"Y={self.origin['origin_point']['y']:.3f}, "
              f"Z={self.origin['origin_point']['z']:.3f}")
        print(f"✓ 命名规则: {self.origin['obstacle_naming_rule']}")
        print(f"ℹ 注意: {self.origin['notes']}")
        print()
        return self.origin

    def step2_supplement_inspection_photos(self):
        print("=" * 60)
        print("【步骤2】展陈设计师阿景补看巡检照片编号")
        print("=" * 60)
        print(f"补录人: {self.inspection_photos['supplemented_by']}")
        print(f"补录日期: {self.inspection_photos['supplement_date']}")
        print()
        
        self.observations = load_json(self.observation_file)
        
        photo_map = {p["photo_id"]: p for p in self.inspection_photos["photos"]}
        
        for obs in self.observations["obstacles"]:
            photo_id = obs.get("inspection_photo_id")
            if photo_id and photo_id in photo_map:
                photo = photo_map[photo_id]
                obs["inspection_photo_detail"] = {
                    "shoot_date": photo["shoot_date"],
                    "shoot_position": photo["shoot_position"],
                    "visibility": photo["visibility"]
                }
                print(f"✓ 障碍物 [{obs['obstacle_id']}] {obs['name']}")
                print(f"  关联巡检照片: {photo_id}")
                print(f"  拍摄日期: {photo['shoot_date']}")
                
                if obs.get("old_caliber"):
                    for observed in photo["obstacle_observed"]:
                        if "old_caliber_name" in observed:
                            print(f"  ⚠ 检测到旧口径: '{observed['old_caliber_name']}'")
                            obs["old_caliber_name"] = observed["old_caliber_name"]
                
                print()
        
        self._add_history("supplement_photos", "阿景补看巡检照片编号完成", {
            "supplemented_by": "阿景",
            "supplement_count": len(self.observations["obstacles"])
        })
        return self.observations

    def step3_process_obstacles(self):
        print("=" * 60)
        print("【步骤3】三维标注视图更新 - 障碍物处理")
        print("=" * 60)
        
        self.processed_obstacles = []
        
        for obs in self.observations["obstacles"]:
            processed = dict(obs)
            processed["processed_at"] = datetime.now().isoformat()
            processed["run_id"] = self.run_id
            
            if obs["type"] == "normal":
                processed["processing_result"] = "normal"
                processed["processing_status"] = "completed"
                print(f"✓ [正常] {obs['obstacle_id']} - {obs['name']}")
                print(f"  处理结果: 命名规范，坐标正确，归入正常记录")
                
            elif obs["type"] == "dual_name":
                processed["processing_result"] = "needs_review"
                processed["processing_status"] = "review_pending"
                print(f"⚠ [待复核] {obs['obstacle_id']} - {obs['name']}")
                print(f"  同一障碍物被标了两个名字: '{obs['name']}' vs '{obs['dual_name']}'")
                print(f"  坐标重合: X={obs['coordinates']['x']:.3f}, "
                      f"Y={obs['coordinates']['y']:.3f}, "
                      f"Z={obs['coordinates']['z']:.3f}")
                print(f"  ℹ 按要求：留给培训学员复核，暂不归为正常")
                
            elif obs["type"] == "old_caliber":
                processed["processing_result"] = "old_caliber"
                processed["processing_status"] = "pending_caliber_update"
                print(f"△ [旧口径] {obs['obstacle_id']} - {obs['name']}")
                print(f"  来源: {obs['source']}")
                print(f"  待更新为新口径（按《施工围挡视域障碍物命名规范V2.0》）")
            
            elif obs["type"] == "wrong_caliber":
                processed["processing_result"] = "wrong_caliber"
                processed["processing_status"] = "rejected"
                print(f"✗ [错误] {obs['obstacle_id']} - {obs['name']}")
                print(f"  命名不符合规范，已驳回，待重新命名")
            
            elif obs["type"] == "old_caliber_updated":
                processed["processing_result"] = "caliber_updated"
                processed["processing_status"] = "completed"
                print(f"✓ [已补录] {obs['obstacle_id']}")
                print(f"  旧口径: {obs['old_name']}")
                print(f"  新口径: {obs['new_name']}")
                print(f"  补录人: {obs['supplemented_by']}")
            
            self.processed_obstacles.append(processed)
            print()
        
        self._add_history("process_obstacles", "三维标注视图处理完成", {
            "total": len(self.processed_obstacles),
            "normal": sum(1 for o in self.processed_obstacles if o["processing_result"] == "normal"),
            "needs_review": sum(1 for o in self.processed_obstacles if o["processing_result"] == "needs_review"),
            "old_caliber": sum(1 for o in self.processed_obstacles if o["processing_result"] == "old_caliber"),
            "wrong_caliber": sum(1 for o in self.processed_obstacles if o["processing_result"] == "wrong_caliber"),
            "caliber_updated": sum(1 for o in self.processed_obstacles if o["processing_result"] == "caliber_updated")
        })
        
        return self.processed_obstacles

    def step4_manual_correction(self, obstacle_id, correction_note, corrected_name=None):
        print("=" * 60)
        print("【步骤4】人工修正")
        print("=" * 60)
        
        for obs in self.processed_obstacles:
            if obs["obstacle_id"] == obstacle_id:
                obs["manual_correction"] = {
                    "corrected_at": datetime.now().isoformat(),
                    "corrected_by": "培训学员",
                    "correction_note": correction_note,
                    "original_name": obs["name"],
                    "corrected_name": corrected_name or obs["name"]
                }
                if corrected_name:
                    obs["name"] = corrected_name
                obs["processing_status"] = "manually_corrected"
                
                self.manual_corrections.append({
                    "obstacle_id": obstacle_id,
                    "correction_note": correction_note,
                    "corrected_name": corrected_name
                })
                
                self._add_history("manual_correction", f"人工修正障碍物 {obstacle_id}", {
                    "obstacle_id": obstacle_id,
                    "correction_note": correction_note,
                    "corrected_name": corrected_name
                })
                
                print(f"✓ 障碍物 [{obstacle_id}] 已人工修正")
                print(f"  修正说明: {correction_note}")
                if corrected_name:
                    print(f"  命名更新: {obs['manual_correction']['original_name']} → {corrected_name}")
                print()
                return obs
        
        print(f"✗ 未找到障碍物 {obstacle_id}")
        return None

    def step5_rerun(self):
        print("=" * 60)
        print("【步骤5】重跑 - 应用人工修正后重新处理")
        print("=" * 60)
        
        self.run_id = f"RUN-{datetime.now().strftime('%Y%m%d-%H%M%S')}-RERUN"
        print(f"重跑ID: {self.run_id}")
        print(f"应用修正数: {len(self.manual_corrections)}")
        print()
        
        for correction in self.manual_corrections:
            for obs in self.observations["obstacles"]:
                if obs["obstacle_id"] == correction["obstacle_id"]:
                    if correction["corrected_name"]:
                        obs["name"] = correction["corrected_name"]
                    obs["notes"] = obs.get("notes", "") + f" [已人工修正: {correction['correction_note']}]"
                    print(f"✓ 已应用修正: {correction['obstacle_id']}")
        
        result = self.step3_process_obstacles()
        self._add_history("rerun", "重跑完成", {"run_id": self.run_id})
        return result

    def generate_3d_annotation_view(self):
        print("=" * 60)
        print("【三维标注视图】")
        print("=" * 60)
        
        origin_x = self.origin["origin_point"]["x"]
        origin_y = self.origin["origin_point"]["y"]
        origin_z = self.origin["origin_point"]["z"]
        
        print(f"坐标原点: ({origin_x:.3f}, {origin_y:.3f}, {origin_z:.3f})")
        print(f"{'ID':<12} {'名称':<25} {'相对X(m)':>10} {'相对Y(m)':>10} {'相对Z(m)':>10} {'状态':<12}")
        print("-" * 90)
        
        for obs in self.processed_obstacles:
            rel_x = obs["coordinates"]["x"] - origin_x
            rel_y = obs["coordinates"]["y"] - origin_y
            rel_z = obs["coordinates"]["z"] - origin_z
            status = self._get_status_display(obs)
            
            print(f"{obs['obstacle_id']:<12} {obs['name'][:24]:<25} "
                  f"{rel_x:>10.3f} {rel_y:>10.3f} {rel_z:>10.3f} "
                  f"{status:<12}")
        
        print()
        
        view_data = {
            "origin": self.origin["origin_point"],
            "obstacles": self.processed_obstacles,
            "generated_at": datetime.now().isoformat(),
            "run_id": self.run_id
        }
        
        output_file = OUTPUT_DIR / f"3d_annotation_view_{self.run_id}.json"
        save_json(view_data, output_file)
        print(f"✓ 三维标注视图已保存: {output_file}")
        return view_data

    def generate_history_records(self):
        print("=" * 60)
        print("【历史记录】")
        print("=" * 60)
        
        for i, entry in enumerate(self.history, 1):
            print(f"{i:2d}. [{entry['timestamp']}] {entry['action']}")
            print(f"    说明: {entry['description']}")
            if entry.get("details"):
                for k, v in entry["details"].items():
                    print(f"    - {k}: {v}")
            print()
        
        history_file = HISTORY_DIR / f"history_{self.run_id}.json"
        save_json({
            "run_id": self.run_id,
            "history": self.history,
            "generated_at": datetime.now().isoformat()
        }, history_file)
        print(f"✓ 历史记录已保存: {history_file}")
        return self.history

    def verify_3d_view_matches_history(self):
        print("=" * 60)
        print("【验证】三维标注视图与历史记录核对")
        print("=" * 60)
        
        history_obstacle_states = {}
        for entry in self.history:
            if entry["action"] == "process_obstacles":
                for obs in self.processed_obstacles:
                    history_obstacle_states[obs["obstacle_id"]] = obs.get("processing_result")
        
        all_match = True
        for obs in self.processed_obstacles:
            view_status = obs.get("processing_result")
            history_status = history_obstacle_states.get(obs["obstacle_id"])
            match = view_status == history_status
            all_match = all_match and match
            
            status_icon = "✓" if match else "✗"
            print(f"{status_icon} {obs['obstacle_id']}: 视图={view_status}, 历史={history_status}")
        
        print()
        if all_match:
            print("✓ 三维标注视图与历史记录完全一致")
        else:
            print("✗ 存在不一致，请检查")
        
        return all_match

    def _get_status_display(self, obs):
        status_map = {
            "normal": "正常",
            "needs_review": "待复核",
            "old_caliber": "旧口径",
            "wrong_caliber": "错误",
            "caliber_updated": "已补录",
            "manually_corrected": "已修正"
        }
        return status_map.get(obs.get("processing_result", "unknown"), obs.get("processing_status", "未知"))

    def _add_history(self, action, description, details=None):
        self.history.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "description": description,
            "details": details or {}
        })

    def run_full_workflow(self, mode="normal"):
        print("\n" + "=" * 60)
        print(f"高架桥施工围挡视域分析 - 运行模式: {mode}")
        print("=" * 60 + "\n")
        
        self.run_id = f"RUN-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{mode.upper()}"
        print(f"运行ID: {self.run_id}\n")
        
        self.step1_import_origin()
        self.step2_supplement_inspection_photos()
        self.step3_process_obstacles()
        
        self.generate_3d_annotation_view()
        self.generate_history_records()
        self.verify_3d_view_matches_history()
        
        result_file = OUTPUT_DIR / f"result_{self.run_id}.json"
        save_json({
            "run_id": self.run_id,
            "mode": mode,
            "origin": self.origin,
            "processed_obstacles": self.processed_obstacles,
            "history": self.history,
            "generated_at": datetime.now().isoformat()
        }, result_file)
        
        print(f"\n✓ 处理完成，结果已保存: {result_file}")
        return self.run_id

    def run_demo_with_correction(self):
        print("\n" + "=" * 60)
        print("高架桥施工围挡视域分析 - 完整演示流程（含人工修正和重跑）")
        print("=" * 60 + "\n")
        
        self.run_id = f"RUN-{datetime.now().strftime('%Y%m%d-%H%M%S')}-DEMO"
        print(f"运行ID: {self.run_id}\n")
        
        self.step1_import_origin()
        self.step2_supplement_inspection_photos()
        self.step3_process_obstacles()
        
        print("\n" + "~" * 60)
        print("【一次人工修正】培训学员复核后修正OBS-003旧口径")
        print("~" * 60 + "\n")
        self.step4_manual_correction(
            "OBS-003",
            "经复核，旧口径'东向斜拉钢筋架'应更新为新口径'WD-C段-斜拉钢筋架-001'",
            "WD-C段-斜拉钢筋架-001"
        )
        
        print("\n" + "~" * 60)
        print("【一次重跑】应用修正后重新处理")
        print("~" * 60 + "\n")
        self.step5_rerun()
        
        self.generate_3d_annotation_view()
        self.generate_history_records()
        self.verify_3d_view_matches_history()
        
        result_file = OUTPUT_DIR / f"result_{self.run_id}.json"
        save_json({
            "run_id": self.run_id,
            "mode": "demo_full",
            "origin": self.origin,
            "processed_obstacles": self.processed_obstacles,
            "manual_corrections": self.manual_corrections,
            "history": self.history,
            "generated_at": datetime.now().isoformat()
        }, result_file)
        
        print(f"\n✓ 完整演示流程完成，结果已保存: {result_file}")
        return self.run_id


def main():
    parser = argparse.ArgumentParser(description="高架桥施工围挡视域分析系统")
    parser.add_argument("mode", nargs="?", default="demo",
                       choices=["normal", "wrong", "supplement", "demo", "full-demo"],
                       help="运行模式")
    parser.add_argument("--observation", help="指定观测数据文件")
    
    args = parser.parse_args()
    
    mode_map = {
        "normal": ("正常材料", DATA_DIR / "raw_observations.json"),
        "wrong": ("错口径材料", DATA_DIR / "wrong_caliber_observations.json"),
        "supplement": ("补录材料", DATA_DIR / "supplementary_observations.json"),
        "demo": ("正常材料演示", DATA_DIR / "raw_observations.json"),
        "full-demo": ("完整演示流程（含修正+重跑）", DATA_DIR / "raw_observations.json")
    }
    
    obs_file = Path(args.observation) if args.observation else mode_map[args.mode][1]
    
    processor = ViaductVisualFieldProcessor(observation_file=obs_file)
    
    if args.mode == "full-demo":
        run_id = processor.run_demo_with_correction()
    else:
        mode_desc = mode_map[args.mode][0]
        print(f"\n使用材料: {mode_desc}")
        print(f"数据文件: {obs_file}\n")
        run_id = processor.run_full_workflow(mode=args.mode)
    
    print(f"\n" + "=" * 60)
    print("复盘说明:")
    print("=" * 60)
    print(f"运行ID: {run_id}")
    print(f"可重新执行命令: python src/viaduct_visual_field.py {args.mode}")
    print(f"查看结果文件: output/result_{run_id}.json")
    print(f"查看三维视图: output/3d_annotation_view_{run_id}.json")
    print(f"查看历史记录: output/history/history_{run_id}.json")
    print()
    print("三种处理结果对比:")
    print("  1. 顺利记录: OBS-001 → 直接归入正常")
    print("  2. 同一障碍物被标了两个名字: OBS-002-A / OBS-002-B → 待学员复核")
    print("  3. 旧口径补录: OBS-003 '东向斜拉钢筋架' → 人工修正后重跑更新")
    print()


if __name__ == "__main__":
    main()
