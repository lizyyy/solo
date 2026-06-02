#!/usr/bin/env python3
import sys
import os
import argparse
import copy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.config import SAMPLE_AUDIO_DIR, SAMPLE_EXCEL_DIR, OUTPUT_DIR
from src.excel_reader import ExcelReader
from src.audio_scanner import AudioScanner
from src.matcher import TrackMatcher
from src.anomaly_detector import AnomalyDetector
from src.batch_processor import BatchProcessor
from src.conflict_detector import ConflictDetector
from src.note_manager import NoteManager, DiffComparator
from src.report_generator import ReportGenerator

def run_pipeline(excel_path: str, audio_dir: str, report_name: str = None):
    print("=" * 60)
    print("少儿打击乐课堂评分 - 处理管道")
    print("=" * 60)
    
    print(f"\n[1/5] 读取曲目清单...")
    reader = ExcelReader(excel_path)
    original_tracks = reader.read_tracks()
    print(f"   成功读取 {len(original_tracks)} 条曲目记录")
    
    print(f"\n[2/5] 扫描音频文件...")
    scanner = AudioScanner(audio_dir)
    audio_files = scanner.scan_files()
    print(f"   扫描到 {len(audio_files)} 个音频文件")
    
    invalid_files = [af for af in audio_files if not af.is_valid]
    if invalid_files:
        print(f"   ⚠️ 发现 {len(invalid_files)} 个损坏的音频文件")
        for af in invalid_files:
            print(f"      - {af.file_name}: {af.error_message}")
    
    working_tracks = copy.deepcopy(original_tracks)
    
    print(f"\n[3/5] 匹配曲目与音频文件...")
    matcher = TrackMatcher(working_tracks, audio_files)
    matched_tracks = matcher.match_all()
    matched_count = sum(1 for t in matched_tracks if t.status.value == "已匹配")
    print(f"   成功匹配 {matched_count}/{len(matched_tracks)} 条曲目")
    
    print(f"\n[4/5] 检测异常情况...")
    detector = AnomalyDetector(matched_tracks)
    detected_tracks = detector.detect_all()
    anomaly_summary = detector.get_anomaly_summary()
    total_anomalies = sum(len(v) for v in anomaly_summary.values())
    print(f"   检测到 {total_anomalies} 个异常")
    for anomaly_type, tracks in anomaly_summary.items():
        print(f"      - {anomaly_type.value}: {len(tracks)} 条")
    
    print(f"\n[5/5] 生成报告...")
    batch_processor = BatchProcessor(error_isolation=True)
    summary = batch_processor.process_batch(detected_tracks, lambda t: None)
    
    report_gen = ReportGenerator(str(OUTPUT_DIR))
    report_paths = report_gen.generate_full_report(
        tracks=detected_tracks,
        summary=summary,
        report_name=report_name
    )
    
    print("\n" + "=" * 60)
    print("处理完成！报告已生成：")
    print(f"   📊 Excel明细: {report_paths['excel']}")
    print(f"   📋 文本汇总: {report_paths['summary']}")
    print(f"   🌐 HTML报告: {report_paths['html']}")
    print("=" * 60)
    
    return {
        "original_tracks": original_tracks,
        "processed_tracks": detected_tracks,
        "summary": summary,
        "report_paths": report_paths
    }

def add_note(track_id: str, note_content: str, notes_file: str = None):
    if not notes_file:
        notes_file = str(OUTPUT_DIR / "notes.json")
    
    note_mgr = NoteManager(notes_file)
    note = note_mgr.add_note(track_id, note_content)
    print(f"✅ 已为曲目 {track_id} 添加备注:")
    print(f"   {note.note_content}")
    return note

def show_summary(result):
    summary = result["summary"]
    tracks = result["processed_tracks"]
    
    print("\n📋 处理摘要:")
    print(f"   总曲目: {summary.total_tracks}")
    print(f"   已匹配: {summary.matched_tracks}")
    print(f"   未匹配: {summary.unmatched_tracks}")
    print(f"   处理失败: {summary.error_tracks}")
    print(f"   异常总数: {summary.total_anomalies}")
    
    need_attention = [t for t in tracks if t.anomalies or t.status.value in ["待审核", "数据冲突", "处理失败"]]
    if need_attention:
        print("\n⚠️ 需要关注的曲目:")
        for track in need_attention:
            print(f"   {track.track_id} - {track.track_name} ({track.student_name}):")
            print(f"      状态: {track.status.value}")
            for detail in track.anomaly_details:
                print(f"      - {detail}")

def main():
    parser = argparse.ArgumentParser(description="少儿打击乐课堂评分工具")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    run_parser = subparsers.add_parser("run", help="运行完整处理流程")
    run_parser.add_argument("--excel", default=str(SAMPLE_EXCEL_DIR / "曲目清单.xlsx"), help="Excel文件路径")
    run_parser.add_argument("--audio", default=str(SAMPLE_AUDIO_DIR), help="音频目录路径")
    run_parser.add_argument("--name", default="首次处理", help="报告名称")
    
    note_parser = subparsers.add_parser("note", help="添加备注")
    note_parser.add_argument("track_id", help="曲目编号")
    note_parser.add_argument("content", help="备注内容")
    
    sample_parser = subparsers.add_parser("demo", help="运行完整演示（首次处理+补录备注+返工）")
    
    args = parser.parse_args()
    
    if args.command == "run" or args.command is None:
        result = run_pipeline(args.excel, args.audio, args.name)
        show_summary(result)
    
    elif args.command == "note":
        add_note(args.track_id, args.content)
    
    elif args.command == "demo":
        print("\n" + "=" * 60)
        print("演示模式: 首次处理 → 补录备注 → 返工处理")
        print("=" * 60)
        
        print("\n▶️ 第一阶段：首次处理")
        result1 = run_pipeline(
            str(SAMPLE_EXCEL_DIR / "曲目清单.xlsx"),
            str(SAMPLE_AUDIO_DIR),
            "首次处理"
        )
        show_summary(result1)
        
        print("\n▶️ 第二阶段：补录备注")
        print("\n为TRK005添加备注: '家长已确认授权，下周补交签字文件'")
        add_note("TRK005", "家长已确认授权，下周补交签字文件")
        print("\n为TRK003添加备注: '旧版母带已确认可用，无需重新录制'")
        add_note("TRK003", "旧版母带已确认可用，无需重新录制")
        
        print("\n▶️ 第三阶段：返工处理（模拟二次导入，验证差异）")
        print("   模拟场景：TRK005授权状态更新为已授权")
        import pandas as pd
        excel_path = str(SAMPLE_EXCEL_DIR / "曲目清单.xlsx")
        df = pd.read_excel(excel_path)
        df.loc[df['曲目编号'] == 'TRK005', '已授权'] = '是'
        rework_excel = str(SAMPLE_EXCEL_DIR / "曲目清单_返工.xlsx")
        df.to_excel(rework_excel, index=False)
        
        result2 = run_pipeline(rework_excel, str(SAMPLE_AUDIO_DIR), "返工处理")
        
        print("\n🔄 对比两次处理的差异:")
        diffs = DiffComparator.compare_track_lists(result1["processed_tracks"], result2["processed_tracks"])
        if diffs:
            for diff in diffs:
                print(f"\n曲目 {diff.track_id}:")
                for change in diff.changes:
                    print(f"  [{change.change_type}] {change.field}: {change.old_value} → {change.new_value}")
        else:
            print("  无差异")
        
        print("\n" + "=" * 60)
        print("演示完成！")
        print("=" * 60)

if __name__ == "__main__":
    main()
