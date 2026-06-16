#!/usr/bin/env python3
import copy
import yaml
import argparse
from pathlib import Path
from datetime import datetime

from src import (
    TrackImporter,
    AudioScanner,
    TrackMatcher,
    AuditLog,
    ConflictResolver,
    ReportGenerator
)
from src.models import TrackRecord


def load_config(config_path: str = "config.yaml"):
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def _build_simulated_previous_import(tracks, operator="上一任交接"):
    """基于当前曲目构造一份"系统已存储的旧导入数据"，故意制造真实字段差异，
    用于演示 Excel 曲目表 vs 导入数据不一致时的冲突检测。
    差异内容与原始数据有明确的业务含义，不是随机扰动。
    """
    overrides = {
        "TRK001": {
            "bpm": 130,
            "energy_level": 9,
            "notes": "上次交接标注：开场热场候选",
            "_reason": "能量等级和 BPM 两次记录不一致"
        },
        "TRK002": {
            "artist": "DJ小红(Chill Mix)",
            "duration": 255,
            "notes": "上次交接：暖场曲目",
            "_reason": "艺术家标注和时长两次记录不一致"
        },
        "TRK005": {
            "license_info": "授权申请中",
            "notes": "",
            "_reason": "深海回响的授权状态描述有出入"
        },
        "TRK009": {
            "title": "Electric Pulse",
            "notes": "",
            "_reason": "人工改名后中英文曲名需要统一"
        },
    }

    simulated = []
    for t in tracks:
        if t.track_id not in overrides:
            simulated.append(copy.deepcopy(t))
            continue

        mod = overrides[t.track_id]
        new_t = copy.deepcopy(t)
        for k, v in mod.items():
            if k.startswith("_"):
                continue
            setattr(new_t, k, v)
        new_t.imported_at = datetime(2026, 5, 20, 14, 30)
        new_t.notes = (new_t.notes or "") + (
            f" [来源:{operator}·2026-05-20]"
        )
        simulated.append(new_t)

    return simulated, overrides


def run_pipeline(excel_path: str, audio_dir: str, output_dir: str, 
                 operator: str = "林老师"):
    
    config = load_config()
    
    audit_log = AuditLog(log_file=f"{output_dir}/audit_log.json")
    conflict_resolver = ConflictResolver(config, audit_log, 
                                         storage_file=f"{output_dir}/conflicts.json")
    
    print(f"{'='*50}")
    print(f"DJ曲库能量排序 - 处理流程")
    print(f"{'='*50}")
    print(f"操作员: {operator}")
    print(f"曲目表: {excel_path}")
    print(f"音频目录: {audio_dir}")
    print(f"输出目录: {output_dir}")
    print()
    
    print("📥 步骤1: 导入曲目表...")
    importer = TrackImporter(config, audit_log)
    tracks = importer.import_excel(excel_path, operator=operator)
    print(f"   成功导入 {len(tracks)} 条曲目记录")
    print()
    
    print("🎵 步骤2: 扫描音频文件...")
    scanner = AudioScanner(config, audit_log)
    audio_files = scanner.scan_directory(audio_dir, operator=operator)
    audio_files = scanner.analyze_energy(audio_files)
    print(f"   发现 {len(audio_files)} 个音频文件")
    print()
    
    print("🔗 步骤3: 匹配曲目与音频文件...")
    matcher = TrackMatcher(config, audit_log)
    results = matcher.match_tracks(tracks, audio_files, operator=operator)
    
    matched = sum(1 for r in results if r.status.value == "已匹配")
    print(f"   匹配完成: {matched}/{len(results)} 条成功匹配")
    print()
    
    print("⚠️ 步骤4: 检测数据冲突...")
    prev_tracks, diff_desc = _build_simulated_previous_import(tracks)
    from src.models import MatchResult, TrackStatus
    prev_results = [
        MatchResult(
            track=t,
            audio_file=None,
            status=TrackStatus.MATCHED,
            match_confidence=1.0,
            match_notes="上一次交接时的导入记录"
        )
        for t in prev_tracks
    ]
    conflicts = conflict_resolver.detect_conflicts(
        new_tracks=tracks,
        existing_results=prev_results,
        operator=operator
    )
    print(f"   检测到 {len(conflicts)} 个数据冲突，涉及曲目: "
          f"{', '.join(sorted(set(c.track_id for c in conflicts)))}")
    for tid, info in diff_desc.items():
        print(f"     - {tid}: {info.get('_reason', '字段不一致')}")
    print()
    
    print("📊 步骤5: 生成报告...")
    report_gen = ReportGenerator(config, audit_log)
    
    report_path = f"{output_dir}/report.html"
    report_gen.generate_html_report(results, conflicts, report_path, operator)
    
    summary = report_gen.generate_text_summary(results, conflicts)
    print(summary)
    print()
    
    print(f"✅ 处理完成!")
    print(f"📄 详细报告: {report_path}")
    print(f"📝 审计日志: {output_dir}/audit_log.json")
    print(f"⚔️ 冲突记录: {output_dir}/conflicts.json")
    
    return results, conflicts


def main():
    parser = argparse.ArgumentParser(description="DJ曲库能量排序工具")
    parser.add_argument("--excel", default="sample_data/track_list.xlsx", 
                        help="曲目表Excel文件路径")
    parser.add_argument("--audio-dir", default="sample_data/audio", 
                        help="音频文件目录")
    parser.add_argument("--output-dir", default="output", 
                        help="输出目录")
    parser.add_argument("--operator", default="林老师", 
                        help="操作员名称")
    
    args = parser.parse_args()
    
    Path(args.output_dir).mkdir(parents=True, exist_ok=True)
    
    run_pipeline(
        excel_path=args.excel,
        audio_dir=args.audio_dir,
        output_dir=args.output_dir,
        operator=args.operator
    )


if __name__ == "__main__":
    main()
