#!/usr/bin/env python3
import yaml
import argparse
from pathlib import Path

from src import (
    TrackImporter,
    AudioScanner,
    TrackMatcher,
    AuditLog,
    ConflictResolver,
    ReportGenerator
)


def load_config(config_path: str = "config.yaml"):
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


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
    conflicts = conflict_resolver.get_unresolved_conflicts()
    print(f"   待解决冲突: {len(conflicts)} 个")
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
