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

def _load_notes_into_tracks(tracks, notes_file=None):
    if not notes_file:
        notes_file = str(OUTPUT_DIR / "notes.json")
    note_mgr = NoteManager(notes_file)
    for track in tracks:
        note_record = note_mgr.get_note(track.track_id)
        if note_record:
            track.supplementary_notes = note_record.note_content
            track.log(f"加载补录备注: {note_record.note_content[:60]}")

def run_pipeline(excel_path: str, audio_dir: str, report_name: str = None,
                 baseline_tracks=None, notes_file: str = None):
    print("=" * 60)
    print("少儿打击乐课堂评分 - 处理管道")
    print("=" * 60)

    print(f"\n[1/6] 读取曲目清单...")
    reader = ExcelReader(excel_path)
    original_tracks = reader.read_tracks()
    print(f"   成功读取 {len(original_tracks)} 条曲目记录")

    print(f"\n[2/6] 扫描音频文件...")
    scanner = AudioScanner(audio_dir)
    audio_files = scanner.scan_files()
    print(f"   扫描到 {len(audio_files)} 个音频文件")

    total_audio = len(audio_files)
    valid_audio = sum(1 for af in audio_files if af.is_valid)
    corrupted_audio = sum(1 for af in audio_files if not af.is_valid)
    print(f"   可用音频: {valid_audio} 个, 损坏音频: {corrupted_audio} 个")

    invalid_files = [af for af in audio_files if not af.is_valid]
    if invalid_files:
        print(f"   ⚠️ 损坏音频列表:")
        for af in invalid_files:
            print(f"      - {af.file_name}: {af.error_message}")

    working_tracks = copy.deepcopy(original_tracks)

    print(f"\n[3/6] 匹配曲目与音频文件...")
    matcher = TrackMatcher(working_tracks, audio_files)
    matched_tracks = matcher.match_all()
    matched_count = sum(1 for t in matched_tracks if t.audio_file)
    matched_valid_count = sum(1 for t in matched_tracks if t.audio_file and not any(
        a.value == "文件损坏" for a in t.anomalies))
    matched_corrupted_count = sum(1 for t in matched_tracks if t.audio_file and any(
        a.value == "文件损坏" for a in t.anomalies))
    print(f"   成功匹配 {matched_count}/{len(matched_tracks)} 条曲目")
    print(f"   其中可用音频: {matched_valid_count} 条, 损坏音频: {matched_corrupted_count} 条")

    print(f"\n[4/6] 检测异常情况...")
    detector = AnomalyDetector(matched_tracks)
    detected_tracks = detector.detect_all()
    anomaly_summary = detector.get_anomaly_summary()
    total_anomalies = sum(len(v) for v in anomaly_summary.values())
    print(f"   检测到 {total_anomalies} 个异常")
    for anomaly_type, tracks in anomaly_summary.items():
        print(f"      - {anomaly_type.value}: {len(tracks)} 条")

    print(f"\n[5/6] 加载补录备注 & 检测冲突...")
    _load_notes_into_tracks(detected_tracks, notes_file)
    notes_count = sum(1 for t in detected_tracks if t.supplementary_notes)
    if notes_count:
        print(f"   已加载 {notes_count} 条补录备注")

    conflicts = {}
    if baseline_tracks is not None:
        conflict_detector = ConflictDetector(baseline_tracks, detected_tracks)
        conflicts = conflict_detector.detect_conflicts()
        if conflicts:
            print(f"   检测到 {len(conflicts)} 条数据冲突:")
            for tid, cr in conflicts.items():
                for c in cr.conflicts:
                    print(f"      - {tid} [{c.field_name}]: Excel='{c.excel_value}' vs 导入='{c.import_value}'")
                    print(f"        建议: {c.suggestion}")

        diffs = DiffComparator.compare_track_lists(baseline_tracks, detected_tracks)
        if diffs:
            print(f"   检测到 {len(diffs)} 条数据差异:")
            for d in diffs:
                for ch in d.changes:
                    print(f"      - {d.track_id} [{ch.change_type}] {ch.field}: '{ch.old_value}' → '{ch.new_value}'")
    else:
        diffs = None
        print("   (无基线数据，跳过冲突/差异检测)")

    print(f"\n[6/6] 生成报告...")
    batch_processor = BatchProcessor(error_isolation=True)
    summary = batch_processor.process_batch(detected_tracks, lambda t: None)

    summary.total_audio_files = total_audio
    summary.valid_audio_count = valid_audio
    summary.corrupted_audio_count = corrupted_audio
    summary.matched_tracks = matched_count
    summary.matched_with_valid_audio = matched_valid_count
    summary.matched_with_corrupted_audio = matched_corrupted_count

    report_gen = ReportGenerator(str(OUTPUT_DIR))
    report_paths = report_gen.generate_full_report(
        tracks=detected_tracks,
        summary=summary,
        conflicts=conflicts if conflicts else None,
        diffs=diffs,
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
        "report_paths": report_paths,
        "conflicts": conflicts,
        "diffs": diffs
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
    print(f"     其中可用音频: {summary.matched_with_valid_audio}")
    print(f"     其中损坏音频: {summary.matched_with_corrupted_audio}")
    print(f"   未匹配: {summary.unmatched_tracks}")
    print(f"   处理失败: {summary.error_tracks}")
    print(f"   异常总数: {summary.total_anomalies}")
    print(f"   音频文件: 共{summary.total_audio_files}个（可用{summary.valid_audio_count}个，损坏{summary.corrupted_audio_count}个）")

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
        notes_file = str(OUTPUT_DIR / "notes.json")
        if os.path.exists(notes_file):
            os.remove(notes_file)

        print("\n" + "=" * 60)
        print("演示模式: 首次处理 → 补录备注 → 返工处理（含差异对比）")
        print("=" * 60)

        print("\n▶️ 第一阶段：首次处理（无基线，无补录备注）")
        result1 = run_pipeline(
            str(SAMPLE_EXCEL_DIR / "曲目清单.xlsx"),
            str(SAMPLE_AUDIO_DIR),
            "首次处理"
        )
        show_summary(result1)

        print("\n▶️ 第二阶段：补录真实备注")
        print("\n为 TRK005 补录: '家长已补交授权签字文件'")
        add_note("TRK005", "家长已补交授权签字文件", notes_file)
        print("\n为 TRK003 补录: '旧版母带已确认可用，无需重新录制'")
        add_note("TRK003", "旧版母带已确认可用，无需重新录制", notes_file)

        print("\n▶️ 第三阶段：返工处理（以首次结果为基线，备注加载进曲目）")
        print("   模拟场景：TRK005 授权状态更新为'是'")
        import pandas as pd
        excel_path = str(SAMPLE_EXCEL_DIR / "曲目清单.xlsx")
        df = pd.read_excel(excel_path)
        df.loc[df['曲目编号'] == 'TRK005', '已授权'] = '是'
        rework_excel = str(SAMPLE_EXCEL_DIR / "曲目清单_返工.xlsx")
        df.to_excel(rework_excel, index=False)

        result2 = run_pipeline(
            rework_excel,
            str(SAMPLE_AUDIO_DIR),
            "返工处理",
            baseline_tracks=result1["processed_tracks"],
            notes_file=notes_file
        )

        print("\n🔄 两次处理差异汇总（已在返工报告中体现）:")
        diffs = result2["diffs"]
        if diffs:
            for diff in diffs:
                print(f"\n  曲目 {diff.track_id}:")
                for change in diff.changes:
                    print(f"    [{change.change_type}] {change.field}: '{change.old_value or '(空)'}' → '{change.new_value or '(空)'}'")
        else:
            print("  无差异")

        conflicts = result2["conflicts"]
        if conflicts:
            print("\n🔀 数据冲突汇总（已在返工报告中体现）:")
            for tid, cr in conflicts.items():
                print(f"\n  曲目 {tid}:")
                for c in cr.conflicts:
                    print(f"    {c.field_name}: Excel='{c.excel_value}' vs 导入='{c.import_value}'")
                    print(f"    建议: {c.suggestion}")
        else:
            print("\n🔀 无数据冲突")

        print("\n" + "=" * 60)
        print("演示完成！返工报告中已包含冲突证据与补录差异。")
        print("=" * 60)

if __name__ == "__main__":
    main()
